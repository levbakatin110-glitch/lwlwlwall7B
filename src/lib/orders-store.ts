import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { normalizeEmail } from "@/lib/email-codes";
import type { JournalEntry } from "@/lib/types";
import {
  ACCOMPANIMENT_RUB,
  type PlanProductId,
  type PlanTopic,
} from "@/lib/plan-products";
import { mergeDiaryEntries } from "@/lib/backup-read";

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
  paymentRef?: string;
  accompanimentPaid?: boolean;
  accompanimentPending?: boolean;
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

const AWAITING_TTL_MS = 45 * 60 * 1000;

const SYSTEM_INTRO =
  "Специалист проанализирует записи в дневнике и составит персональный план. Ожидание — до 24 часов.";

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
  return load().orders.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function ordersForEmail(email: string): PlanOrder[] {
  const norm = normalizeEmail(email);
  return listOrders().filter((o) => normalizeEmail(o.email) === norm);
}

function isActivePlanOrder(o: PlanOrder) {
  if (o.status === "awaiting_payment") return false;
  if (o.status === "accompaniment_active") return true;
  if (o.chatClosedAt && !o.accompanimentPaid) return false;
  if (o.status === "closed" || o.status === "completed") return false;
  return true;
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
        isActivePlanOrder(o),
    ) ?? null
  );
}

export function getOrder(id: string): PlanOrder | null {
  return load().orders.find((o) => o.id === id) ?? null;
}

function purgeStaleAwaiting(store: Store, email: string, topic: PlanTopic) {
  const norm = normalizeEmail(email);
  const cutoff = Date.now() - AWAITING_TTL_MS;
  store.orders = store.orders.filter((o) => {
    if (normalizeEmail(o.email) !== norm || o.topic !== topic) return true;
    if (o.status !== "awaiting_payment") return true;
    return new Date(o.createdAt).getTime() > cutoff;
  });
}

export function createPlanOrder(input: {
  email: string;
  topic: PlanTopic;
  productId: PlanProductId;
  priceRub: number;
  childId?: string;
  childName?: string;
  clientEntries?: JournalEntry[];
}): PlanOrder {
  const store = load();
  purgeStaleAwaiting(store, input.email, input.topic);

  const existing = activeOrderForTopic(input.email, input.topic);
  if (existing) return existing;

  const awaiting = store.orders.find(
    (o) =>
      normalizeEmail(o.email) === normalizeEmail(input.email) &&
      o.topic === input.topic &&
      o.status === "awaiting_payment",
  );
  if (awaiting) return awaiting;

  const now = new Date().toISOString();
  const order: PlanOrder = {
    id: newOrderId(),
    createdAt: now,
    updatedAt: now,
    email: normalizeEmail(input.email),
    childId: input.childId,
    childName: input.childName,
    topic: input.topic,
    productId: input.productId,
    status: "awaiting_payment",
    priceRub: input.priceRub,
    messages: [],
    diarySnapshot: mergeDiaryEntries(
      input.email,
      input.topic,
      input.childId,
      input.clientEntries,
    ),
    aiDraft: { status: "pending" },
  };

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
      | "accompanimentPending"
      | "accompanimentPriceRub"
      | "diarySnapshot"
      | "paidAt"
      | "paymentRef"
      | "messages"
    >
  >,
): PlanOrder | null {
  const store = load();
  const idx = store.orders.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  const prev = store.orders[idx]!;
  const next: PlanOrder = { ...prev, ...patch, updatedAt: new Date().toISOString() };
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
          : order.status === "plan_sent"
            ? "clarifying"
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
    diarySnapshot: mergeDiaryEntries(
      order.email,
      order.topic,
      order.childId,
      order.diarySnapshot?.entries,
    ),
  });
}

export function fulfillPlanOrderPayment(
  orderId: string,
  paymentRef?: string,
): PlanOrder | null {
  const order = getOrder(orderId);
  if (!order) return null;
  if (order.status !== "awaiting_payment") return order;

  const now = new Date().toISOString();
  const store = load();
  const idx = store.orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;

  const next: PlanOrder = {
    ...order,
    status: "paid",
    paidAt: now,
    paymentRef: paymentRef ?? order.paymentRef,
    updatedAt: now,
    messages: [
      {
        id: newMessageId(),
        createdAt: now,
        role: "system",
        text: SYSTEM_INTRO,
      },
    ],
  };
  store.orders[idx] = next;
  save(store);
  return next;
}

export function fulfillAccompanimentPayment(
  parentOrderId: string,
  paymentRef?: string,
): PlanOrder | null {
  const order = getOrder(parentOrderId);
  if (!order) return null;
  if (order.accompanimentPaid) return order;

  const now = new Date().toISOString();
  const store = load();
  const idx = store.orders.findIndex((o) => o.id === parentOrderId);
  if (idx < 0) return null;

  const next: PlanOrder = {
    ...order,
    accompanimentPaid: true,
    accompanimentPending: false,
    accompanimentPriceRub: ACCOMPANIMENT_RUB,
    status: "accompaniment_active",
    chatClosedAt: undefined,
    paymentRef: paymentRef ?? order.paymentRef,
    updatedAt: now,
    messages: [
      ...order.messages,
      {
        id: newMessageId(),
        createdAt: now,
        role: "system",
        text:
          "Сопровождение подключено на 7 дней. Специалист будет смотреть дневник и подсказывать по ходу.",
      },
    ],
  };
  store.orders[idx] = next;
  save(store);
  return next;
}

export function markAccompanimentPending(orderId: string): PlanOrder | null {
  return updateOrder(orderId, { accompanimentPending: true });
}

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
      ? { ...order.aiDraft, pdfUrl: pdfUrl(order.aiDraft.pdfFile) }
      : order.aiDraft,
  };
}

/** @deprecated */
export function createOrder(
  input: Parameters<typeof createPlanOrder>[0] & { skipPayment?: boolean },
): PlanOrder {
  const order = createPlanOrder(input);
  if (input.skipPayment && order.status === "awaiting_payment") {
    return fulfillPlanOrderPayment(order.id) ?? order;
  }
  return order;
}
