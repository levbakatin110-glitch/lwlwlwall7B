import { cpus, freemem, loadavg, totalmem } from "os";
import { capacityModel, type CapacityModel } from "@/lib/capacity";
import { chatQueueSnapshot } from "@/lib/chat-queue";
import { chatAnswerEstimate } from "@/lib/chat-timing";
import { getDb } from "@/lib/db";
import {
  noteLivePeaks,
  presenceSnapshot,
  type PresenceScreen,
} from "@/lib/presence";

export type LoadVerdict = "ok" | "busy" | "overload";

export type LiveLoadReport = {
  at: string;
  online: number;
  recent5min: number;
  byScreen: Partial<Record<PresenceScreen, number>>;
  peakOnlineToday: number;
  peakChatToday: number;
  today: {
    day: string;
    visits: number;
    uniqueVisitors: number;
    chatSend: number;
    communityPost: number;
    register: number;
  };
  chat: {
    active: number;
    waiting: number;
    maxConcurrent: number;
    maxWaiting: number;
  };
  capacity: CapacityModel;
  server: {
    rssMb: number;
    heapMb: number;
    systemUsedPct: number;
    freeMb: number;
    totalMb: number;
    load1: number;
    cpuCount: number;
  };
  verdict: LoadVerdict;
  verdictLabel: string;
  hint: string;
  reasons: string[];
};

export function classifyLoad(input: {
  estimatedWaitSec: number;
  rssMb: number;
  systemUsedPct: number;
  load1: number;
  cpuCount: number;
}): { verdict: LoadVerdict; reasons: string[] } {
  const reasons: string[] = [];
  const loadRatio = input.cpuCount > 0 ? input.load1 / input.cpuCount : 0;

  let verdict: LoadVerdict = "ok";

  if (input.estimatedWaitSec > 60) {
    verdict = "overload";
    reasons.push("Очередь ИИ уже больше минуты");
  } else if (input.estimatedWaitSec >= 15) {
    verdict = "busy";
    reasons.push("Очередь ИИ растёт — до минуты ещё терпимо");
  }

  if (input.systemUsedPct >= 90) {
    verdict = "overload";
    reasons.push("Оперативка сервера почти кончилась");
  } else if (input.systemUsedPct >= 78 && verdict !== "overload") {
    verdict = "busy";
    reasons.push("Память сервера заполняется");
  }

  if (loadRatio >= 1.35) {
    verdict = "overload";
    reasons.push("Процессор перегружен");
  } else if (loadRatio >= 0.85 && verdict === "ok") {
    verdict = "busy";
    reasons.push("Процессор под нагрузкой");
  }

  if (input.rssMb >= 3500) {
    verdict = "overload";
    reasons.push("Процесс сайта ест слишком много памяти");
  } else if (input.rssMb >= 2200 && verdict === "ok") {
    verdict = "busy";
    reasons.push("Процесс сайта тяжёлый");
  }

  return { verdict, reasons };
}

function verdictCopy(
  verdict: LoadVerdict,
  online: number,
  nowWaitSec: number,
  reasons: string[],
): { verdictLabel: string; hint: string } {
  if (verdict === "overload") {
    return {
      verdictLabel: "Не вывозим",
      hint:
        reasons[0] ||
        "Нагрузка высокая — лучше подождать, не слать рассылки.",
    };
  }
  if (verdict === "busy") {
    return {
      verdictLabel: "На грани",
      hint:
        reasons[0] ||
        "Пока держимся. Минута ожидания в ИИ ещё норма, дальше — уже нет.",
    };
  }
  if (nowWaitSec > 0) {
    return {
      verdictLabel: "Вывозим",
      hint: `Очередь есть, но короткая: ~${nowWaitSec} сек. Минута ещё в запасе.`,
    };
  }
  const people =
    online === 0
      ? "Сейчас почти никого нет."
      : `Сейчас ${online} ${online === 1 ? "человек" : "человек"} на сайте — спокойно вывозим.`;
  return { verdictLabel: "Вывозим", hint: people };
}

function last24hCounts() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT name, COUNT(*) AS c
       FROM analytics_events WHERE at >= ?
       GROUP BY name`,
    )
    .all(since) as { name: string; c: number }[];
  const unique = db
    .prepare(
      `SELECT COUNT(DISTINCT visitor_id) AS c
       FROM analytics_events
       WHERE at >= ? AND visitor_id IS NOT NULL AND visitor_id != ''`,
    )
    .get(since) as { c: number };
  const map = Object.fromEntries(rows.map((r) => [r.name, r.c]));
  return {
    visits: map.visit ?? 0,
    uniqueVisitors: unique.c,
    chatSend: map.chat_send ?? 0,
    communityPost: map.community_post ?? 0,
    register: map.register ?? 0,
  };
}

export function getLiveLoadReport(): LiveLoadReport {
  const presence = presenceSnapshot();
  const chat = chatQueueSnapshot();
  const peaks = noteLivePeaks(presence.online, chat.active);
  const mem = process.memoryUsage();
  const total = totalmem();
  const free = freemem();
  const systemUsedPct =
    total > 0 ? Math.round(((total - free) / total) * 1000) / 10 : 0;
  const cpuCount = Math.max(1, cpus().length);
  const load1 = loadavg()[0] ?? 0;
  const rssMb = Math.round(mem.rss / 1024 / 1024);
  const answer = chatAnswerEstimate();
  const capacity = capacityModel({
    slots: chat.maxConcurrent,
    answerSec: answer.answerSec,
    answerMeasured: answer.measured,
    waiting: chat.waiting,
  });
  const classified = classifyLoad({
    estimatedWaitSec: capacity.nowWaitSec,
    rssMb,
    systemUsedPct,
    load1,
    cpuCount,
  });
  const copy = verdictCopy(
    classified.verdict,
    presence.online,
    capacity.nowWaitSec,
    classified.reasons,
  );
  const todayCounts = last24hCounts();

  return {
    at: new Date().toISOString(),
    online: presence.online,
    recent5min: presence.recent,
    byScreen: presence.byScreen,
    peakOnlineToday: peaks.peakOnline,
    peakChatToday: peaks.peakChat,
    today: {
      day: peaks.day,
      ...todayCounts,
    },
    chat: {
      active: chat.active,
      waiting: chat.waiting,
      maxConcurrent: chat.maxConcurrent,
      maxWaiting: chat.maxWaiting,
    },
    capacity,
    server: {
      rssMb,
      heapMb: Math.round(mem.heapUsed / 1024 / 1024),
      systemUsedPct,
      freeMb: Math.round(free / 1024 / 1024),
      totalMb: Math.round(total / 1024 / 1024),
      load1: Math.round(load1 * 100) / 100,
      cpuCount,
    },
    verdict: classified.verdict,
    verdictLabel: copy.verdictLabel,
    hint: copy.hint,
    reasons: classified.reasons,
  };
}
