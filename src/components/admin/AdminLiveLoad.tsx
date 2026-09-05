"use client";

import { useCallback, useEffect, useState } from "react";
import type { LiveLoadReport } from "@/lib/live-load";

const SCREEN_LABEL: Record<string, string> = {
  home: "Главная / чат",
  community: "Круг мам",
  diary: "Дневники",
  pricing: "Цены",
  profile: "Профиль",
  med: "Анализы",
  wardrobe: "Гардероб",
  recipes: "Рецепты",
  reminders: "Напоминания",
  summary: "Сводка",
  plan: "План",
  other: "Другое",
};

function passHeaders(): HeadersInit {
  const admin =
    sessionStorage.getItem("maya-admin-pass") ||
    sessionStorage.getItem("maya-analytics-pass") ||
    "";
  return {
    "x-admin-password": admin,
    "x-analytics-password": admin,
  };
}

function tone(verdict: LiveLoadReport["verdict"]) {
  if (verdict === "overload") {
    return {
      box: "border-rose-200 bg-rose-50",
      badge: "bg-rose-600 text-white",
    };
  }
  if (verdict === "busy") {
    return {
      box: "border-amber-200 bg-amber-50",
      badge: "bg-amber-500 text-white",
    };
  }
  return {
    box: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-600 text-white",
  };
}

export function AdminLiveLoad() {
  const [data, setData] = useState<LiveLoadReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/live", { headers: passHeaders() });
      if (res.status === 401) {
        setError("Нужен пароль админки");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Не удалось загрузить");
      const json = (await res.json()) as LiveLoadReport;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (loading && !data) {
    return (
      <section className="mt-6 rounded-2xl border border-line bg-card/80 p-5">
        <p className="text-sm text-muted">Снимаю нагрузку…</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="mt-6 rounded-2xl border border-line bg-card/80 p-5">
        <p className="text-sm text-rose-700">{error}</p>
      </section>
    );
  }

  if (!data) return null;

  const t = tone(data.verdict);
  const screens = Object.entries(data.byScreen).sort((a, b) => b[1] - a[1]);
  const chatPct =
    data.chat.maxConcurrent > 0
      ? Math.round((data.chat.active / data.chat.maxConcurrent) * 100)
      : 0;

  return (
    <section className={`mt-6 rounded-2xl border p-5 ${t.box}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Сейчас на сайте
          </p>
          <p className="font-display mt-1 text-4xl font-semibold tabular-nums text-foreground">
            {data.online}
          </p>
          <p className="mt-1 text-sm text-muted">
            {data.recent5min !== data.online
              ? `за 5 мин заходили ещё ${Math.max(0, data.recent5min - data.online)} · `
              : ""}
            пик сегодня {data.peakOnlineToday}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${t.badge}`}
          >
            {data.verdictLabel}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="text-[11px] text-muted underline"
          >
            Обновить
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-foreground">{data.hint}</p>
      {data.reasons.length > 1 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted">
          {data.reasons.slice(1).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {screens.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {screens.map(([screen, n]) => (
            <span
              key={screen}
              className="rounded-full border border-line/80 bg-card/70 px-2.5 py-1 text-xs text-foreground"
            >
              {SCREEN_LABEL[screen] || screen} · {n}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-line/70 bg-card/80 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Сколько вывозим, если можно ждать до минуты
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
          Мая отвечает за{" "}
          <span className="font-semibold">
            {data.capacity.answerSec} сек
          </span>
          {data.capacity.answerMeasured ? " (по факту)" : " (пока среднее)"}.
          Одновременно болтает с {data.capacity.instant} мамами. Остальные
          встают в очередь.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          <li>
            {data.capacity.instant} человек нажали отправить сразу → ждут{" "}
            <span className="font-semibold">0 сек</span>
          </li>
          <li>
            60 человек сразу → последняя ждёт{" "}
            <span className="font-semibold">{data.capacity.waitAt60} сек</span>
          </li>
          <li>
            100 человек сразу →{" "}
            <span className="font-semibold">{data.capacity.waitAt100} сек</span>
          </li>
          <li>
            {data.capacity.withMinute} человек сразу → около{" "}
            <span className="font-semibold">1 минуты</span>
          </li>
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Это если все одновременно пишут в ИИ. На сайте при этом могут сидеть
          примерно {data.capacity.siteTypical.toLocaleString("ru-RU")} человек
          — в чат в одну секунду пишет не каждый. Круг мам очередь не создаёт,
          это обычные сообщения.
          {data.capacity.nowWaitSec > 0
            ? ` Сейчас очередь ≈ ${data.capacity.nowWaitSec} сек.`
            : " Сейчас очереди нет."}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Чат ИИ"
          value={`${data.chat.active} / ${data.chat.maxConcurrent}`}
          sub={
            data.chat.waiting > 0
              ? `очередь ${data.chat.waiting}`
              : `${chatPct}% слотов`
          }
        />
        <Stat
          label="Память сервера"
          value={`${Math.round(data.server.systemUsedPct)}%`}
          sub={`свободно ${data.server.freeMb} из ${data.server.totalMb} МБ`}
        />
        <Stat
          label="Нагрузка CPU"
          value={`${data.server.load1}`}
          sub={`${data.server.cpuCount} ядер`}
        />
        <Stat
          label="Процесс Маи"
          value={`${data.server.rssMb} МБ`}
          sub={`${data.server.mayaPct}% от всей RAM`}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {Math.round(data.server.systemUsedPct)}% занято — это не гости. Linux,
        кэш диска и система сразу едят сотни мегабайт на пустом сервере. Мая
        сейчас занимает {data.server.rssMb} МБ (
        {data.server.mayaPct}% RAM). Сто гостей не умножат это на сто: чат ест
        память, только пока отвечает. Тревога с ~78%. 100% — кончилась
        оперативка, не «в десять раз больше людей».
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Mini label="Визиты 24ч" value={data.today.visits} />
        <Mini label="Уники 24ч" value={data.today.uniqueVisitors} />
        <Mini label="Чат 24ч" value={data.today.chatSend} />
        <Mini label="Круг 24ч" value={data.today.communityPost} />
        <Mini label="Регистрации 24ч" value={data.today.register} />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-line/70 bg-card/80 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="text-[11px] text-muted">{sub}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line/70 bg-card/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
