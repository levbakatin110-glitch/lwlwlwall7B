import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { normalizeEmail } from "@/lib/email-codes";
import type { JournalEntry } from "@/lib/types";
import type { PlanProductId, PlanTopic } from "@/lib/plan-products";
import { diaryEntriesFromBackup } from "@/lib/backup-read";

export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "contacted"
  | "plan_sent"
  | "clarifying"
  | "closed"
  | "accompaniment_active"
  | "completed";

export type OrderMessageRole = "user" | "specialist" | "system";

export type OrderMessage = {
  id: string;
  createdAt: string;
  role: OrderMessageRole;
  text?: string;
  /** имя файла в data/plan-pdfs */
  pdfFile?: string;
};

export type OrderAiDraft = {
  analysis?: string;
  planText?: string;
  generatedAt?: string;
  pdfFile?: string;
  status?: "pending" | "ready" | "error";
  error?: string;
};

export type PlanOrder = {
  id: string;
  createdAt: string;
  updatedAt: string;
  email: string;
  childId?: string;
  childName?: string;
  topic: PlanTopic;
  productId: PlanProductId;
  status: OrderStatus;
  priceRub: number;
  paidAt?: string;
  accompanimentPaid?: boolean;
  accompanimentPriceRub?: number;
  messages: OrderMessage[];
  diarySnapshot?: {
    capturedAt: string;
    entries: JournalEntry[];
    source: "client" | "backup" | "merged";
  };
  aiDraft?: OrderAiDraft;
  chatClosedAt?: string;
};

type Store = { orders: PlanOrder[] };

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "plan-orders.json");
const PDF_DIR = join(DATA_DIR, "plan-pdfs");

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(PDF_DIR)) mkdirSync(PDF_DIR, { recursive: true });
}

function load(): Store {
  ensure();
  if (!existsSync(DATA_FILE)) return { orders: [] };
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf8")) as Store;
  } catch {
    return { orders: [] };
  }
}

function save(store: Store) {
  ensure();
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

export function pdfDir() {
  ensure();
  return PDF_DIR;
}

export function newOrderId() {
  return `po-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export function newMessageId() {
  return `pm-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
}

export function listOrders(): PlanOrder[] {
  return load().orders.sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function ordersForEmail(email: string): PlanOrder[] {
  const norm = normalizeEmail(email);
  return listOrders().filter((o) => normalizeEmail(o.email) === norm);
}

export function activeOrderForTopic(
  email: string,
  topic: PlanTopic,
): PlanOrder | null {
  const norm = normalizeEmail(email);
  return (
    listOrders().find(
      (o) =>
        normalizeEmail(o.email) === norm &&
        o.topic === topic &&
        !["completed", "closed"].includes(o.status) &&
        !o.chatClosedAt,
    ) ?? null
  );
}

export function getOrder(id: string): PlanOrder | null {
  return load().orders.find((o) => o.id === id) ?? null;
}

function mergeDiary(
  email: string,
  topic: PlanTopic,
  childId: string | undefined,
  clientEntries?: JournalEntry[],
): PlanOrder["diarySnapshot"] {
  const fromBackup = diaryEntriesFromBackup(email, topic, childId);
  const client = clientEntries ?? [];
  const byId = new Map<string, JournalEntry>();
  for (const e of fromBackup) byId.set(e.id, e);
  for (const e of client) byId.set(e.id, e);
  const entries = [...byId.values()].sort((a, b) => {
    const da = `${a.date}T${a.createdAt ?? "00:00"}`;
    const db = `${b.date}T${b.createdAt ?? "00:00"}`;
    return db.localeCompare(da);
  });
  let source: "client" | "backup" | "merged" = "backup";
  if (client.length && fromBackup.length) source = "merged";
  else if (client.length) source = "client";
  return { capturedAt: new Date().toISOString(), entries, source };
}

export function createOrder(input: {
  email: string;
  topic: PlanTopic;
  productId: PlanProductId;
  priceRub: number;
  childId?: string;
  childName?: string;
  clientEntries?: JournalEntry[];
  skipPayment?: boolean;
}): PlanOrder {
  const now = new Date().toISOString();
  const existing = activeOrderForTopic(input.email, input.topic);
  if (existing) return existing;

  const order: PlanOrder = {
    id: newOrderId(),
    createdAt: now,
    updatedAt: now,
    email: normalizeEmail(input.email),
    childId: input.childId,
    childName: input.childName,
    topic: input.topic,
    productId: input.productId,
    status: input.skipPayment ? "paid" : "awaiting_payment",
    priceRub: input.priceRub,
    paidAt: input.skipPayment ? now : undefined,
    messages: [
      {
        id: newMessageId(),
        createdAt: now,
        role: "system",
        text:
          "Специалист проанализирует записи в дневнике и составит персональный план. Ожидание — до 24 часов.",
      },
    ],
    diarySnapshot: mergeDiary(
      input.email,
      input.topic,
      input.childId,
      input.clientEntries,
    ),
    aiDraft: { status: "pending" },
  };

  const store = load();
  store.orders.unshift(order);
  save(store);
  return order;
}

export function updateOrder(
  id: string,
  patch: Partial<
    Pick<
      PlanOrder,
      | "status"
      | "aiDraft"
      | "chatClosedAt"
      | "accompanimentPaid"
      | "accompanimentPriceRub"
      | "diarySnapshot"
    >
  >,
): PlanOrder | null {
  const store = load();
  const idx = store.orders.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  const prev = store.orders[idx]!;
  const next: PlanOrder = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.orders[idx] = next;
  save(store);
  return next;
}

export function appendMessage(
  orderId: string,
  msg: Omit<OrderMessage, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): PlanOrder | null {
  const store = load();
  const idx = store.orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;
  const order = store.orders[idx]!;
  if (order.chatClosedAt && msg.role === "user") return null;

  const row: OrderMessage = {
    id: msg.id ?? newMessageId(),
    createdAt: msg.createdAt ?? new Date().toISOString(),
    role: msg.role,
    text: msg.text,
    pdfFile: msg.pdfFile,
  };
  const next: PlanOrder = {
    ...order,
    messages: [...order.messages, row],
    updatedAt: row.createdAt,
    status:
      msg.role === "specialist" && order.status === "paid"
        ? "contacted"
        : msg.pdfFile
          ? "plan_sent"
          : order.status,
  };
  store.orders[idx] = next;
  save(store);
  return next;
}

export function refreshDiarySnapshot(orderId: string): PlanOrder | null {
  const order = getOrder(orderId);
  if (!order) return null;
  return updateOrder(orderId, {
    diarySnapshot: mergeDiary(
      order.email,
      order.topic,
      order.childId,
      order.diarySnapshot?.entries,
    ),
  });
}

/** Для API — без лишних полей */
export function orderForClient(order: PlanOrder) {
  const pdfUrl = (file?: string) =>
    file ? `/api/plan-orders/${order.id}/pdf/${file}` : undefined;

  return {
    ...order,
    messages: order.messages.map((m) => ({
      ...m,
      pdfUrl: pdfUrl(m.pdfFile),
    })),
    aiDraft: order.aiDraft
      ? {
          ...order.aiDraft,
          pdfUrl: pdfUrl(order.aiDraft.pdfFile),
        }
      : order.aiDraft,
  };
}
