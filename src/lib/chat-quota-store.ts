import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  chatAllowance,
  chatMonthKey,
  type ChatQuotaView,
  CHAT_INCLUDED_BUDGET_RUB,
  CHAT_INCLUDED_MSGS,
  CHAT_TOPUP_MSGS,
  CHAT_TOPUP_RUB,
  CHAT_COST_PER_MSG_RUB,
} from "@/lib/chat-quota";
import { normalizeEmail } from "@/lib/paid-store";

type MonthRow = { used: number; boosts: number };
type Store = { byEmail: Record<string, Record<string, MonthRow>> };

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "chat-quota.json");

function load(): Store {
  try {
    if (!existsSync(DATA_FILE)) return { byEmail: {} };
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Store;
    if (!raw.byEmail || typeof raw.byEmail !== "object") return { byEmail: {} };
    return raw;
  } catch {
    return { byEmail: {} };
  }
}

function save(store: Store) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

function rowFor(email: string, month: string): MonthRow {
  const store = load();
  const key = normalizeEmail(email);
  const months = store.byEmail[key] ?? {};
  const row = months[month] ?? { used: 0, boosts: 0 };
  return {
    used: Math.max(0, row.used | 0),
    boosts: Math.max(0, row.boosts | 0),
  };
}

function writeRow(email: string, month: string, row: MonthRow) {
  const store = load();
  const key = normalizeEmail(email);
  if (!store.byEmail[key]) store.byEmail[key] = {};
  store.byEmail[key]![month] = row;
  save(store);
}

export function getChatQuotaView(email: string): ChatQuotaView {
  const month = chatMonthKey();
  const row = rowFor(email, month);
  const allowance = chatAllowance(row.boosts);
  const remaining = Math.max(0, allowance - row.used);
  return {
    month,
    used: row.used,
    boosts: row.boosts,
    allowance,
    remaining,
    includedMsgs: CHAT_INCLUDED_MSGS,
    topupRub: CHAT_TOPUP_RUB,
    topupMsgs: CHAT_TOPUP_MSGS,
    includedBudgetRub: CHAT_INCLUDED_BUDGET_RUB,
    estimatedSpendRub: row.used * CHAT_COST_PER_MSG_RUB,
    needsTopup: remaining <= 0,
  };
}

/** true = можно слать; false = нужна доплата */
export function tryConsumeChatQuota(email: string): {
  ok: boolean;
  view: ChatQuotaView;
} {
  const month = chatMonthKey();
  const row = rowFor(email, month);
  const allowance = chatAllowance(row.boosts);
  if (row.used >= allowance) {
    return { ok: false, view: getChatQuotaView(email) };
  }
  writeRow(email, month, { ...row, used: row.used + 1 });
  return { ok: true, view: getChatQuotaView(email) };
}

export function grantChatTopup(email: string, orderId?: string): ChatQuotaView {
  const month = chatMonthKey();
  const row = rowFor(email, month);
  writeRow(email, month, {
    used: row.used,
    boosts: row.boosts + 1,
  });
  void orderId;
  return getChatQuotaView(email);
}
