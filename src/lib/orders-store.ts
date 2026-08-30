import { randomBytes } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getDb } from "@/lib/db";
import { normalizeEmail } from "@/lib/email-codes";
import { applyOrderLifecycle } from "@/lib/plan-order-lifecycle";
import type { JournalEntry } from "@/lib/types";
import {
  ACCOMPANIMENT_DAYS,
  ACCOMPANIMENT_RUB,
  PLAN_CHAT_DAYS,
  type PlanProductId,
  type PlanTopic,
} from "@/lib/plan-products";
import {
  accompanimentIntroMessage,
  consultantRoleForTopic,
  getPlanConsultant,
  pickConsultantForNewOrder,
  systemIntroMessage,
  type PlanConsultantId,
} from "@/lib/plan-consultants";
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
  planSentAt?: string;
  chatDeadlineAt?: string;
  accompanimentDeadlineAt?: string;
  consultantId: PlanConsultantId;
};

type DbRow = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  child_id: string | null;
  child_name: string | null;
  topic: PlanTopic;
  product_id: PlanProductId;
  status: OrderStatus;
  price_rub: number;
  paid_at: string | null;
  payment_ref: string | null;
  accompaniment_paid: number;
  accompaniment_pending: number;
  accompaniment_price_rub: number | null;
  chat_closed_at: string | null;
  plan_sent_at: string | null;
  chat_deadline_at: string | null;
  accompaniment_deadline_at: string | null;
  consultant_id: string;
  messages_json: string;
  diary_snapshot_json: string | null;
  ai_draft_json: string | null;
};

const DATA_DIR = join(process.cwd(), "data");
const PDF_DIR = join(DATA_DIR, "plan-pdfs");
const AWAITING_TTL_MS = 45 * 60 * 1000;

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(PDF_DIR)) mkdirSync(PDF_DIR, { recursive: true });
}

function rowToOrder(row: DbRow): PlanOrder {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    email: row.email,
    childId: row.child_id ?? undefined,
    childName: row.child_name ?? undefined,
    topic: row.topic,
    productId: row.product_id,
    status: row.status,
    priceRub: row.price_rub,
    paidAt: row.paid_at ?? undefined,
    paymentRef: row.payment_ref ?? undefined,
    accompanimentPaid: Boolean(row.accompaniment_paid),
    accompanimentPending: Boolean(row.accompaniment_pending),
    accompanimentPriceRub: row.accompaniment_price_rub ?? undefined,
    chatClosedAt: row.chat_closed_at ?? undefined,
    planSentAt: row.plan_sent_at ?? undefined,
    chatDeadlineAt: row.chat_deadline_at ?? undefined,
    accompanimentDeadlineAt: row.accompaniment_deadline_at ?? undefined,
    consultantId: getPlanConsultant(row.consultant_id).id,
    messages: JSON.parse(row.messages_json) as OrderMessage[],
    diarySnapshot: row.diary_snapshot_json
      ? (JSON.parse(row.diary_snapshot_json) as PlanOrder["diarySnapshot"])
      : undefined,
    aiDraft: row.ai_draft_json
      ? (JSON.parse(row.ai_draft_json) as OrderAiDraft)
      : undefined,
  };
}

function orderToParams(order: PlanOrder) {
  return {
    id: order.id,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    email: order.email,
    child_id: order.childId ?? null,
    child_name: order.childName ?? null,
    topic: order.topic,
    product_id: order.productId,
    status: order.status,
    price_rub: order.priceRub,
    paid_at: order.paidAt ?? null,
    payment_ref: order.paymentRef ?? null,
    accompaniment_paid: order.accompanimentPaid ? 1 : 0,
    accompaniment_pending: order.accompanimentPending ? 1 : 0,
    accompaniment_price_rub: order.accompanimentPriceRub ?? null,
    chat_closed_at: order.chatClosedAt ?? null,
    plan_sent_at: order.planSentAt ?? null,
    chat_deadline_at: order.chatDeadlineAt ?? null,
    accompaniment_deadline_at: order.accompanimentDeadlineAt ?? null,
    consultant_id: order.consultantId,
    messages_json: JSON.stringify(order.messages),
    diary_snapshot_json: order.diarySnapshot
      ? JSON.stringify(order.diarySnapshot)
      : null,
    ai_draft_json: order.aiDraft ? JSON.stringify(order.aiDraft) : null,
  };
}

function loadOrderRaw(id: string): PlanOrder | null {
  const row = getDb()
    .prepare("SELECT * FROM plan_orders WHERE id = ?")
    .get(id) as DbRow | undefined;
  if (!row) return null;
  return rowToOrder(row);
}

export function getOrder(id: string): PlanOrder | null {
  const raw = loadOrderRaw(id);
  if (!raw) return null;
  return applyOrderLifecycle(raw);
}

function upsertOrder(order: PlanOrder): PlanOrder {
  const db = getDb();
  const params = orderToParams(order);
  db.prepare(
    `INSERT INTO plan_orders (
      id, created_at, updated_at, email, child_id, child_name, topic, product_id,
      status, price_rub, paid_at, payment_ref, accompaniment_paid, accompaniment_pending,
      accompaniment_price_rub, chat_closed_at, plan_sent_at, chat_deadline_at,
      accompaniment_deadline_at, consultant_id, messages_json, diary_snapshot_json, ai_draft_json
    ) VALUES (
      @id, @created_at, @updated_at, @email, @child_id, @child_name, @topic, @product_id,
      @status, @price_rub, @paid_at, @payment_ref, @accompaniment_paid, @accompaniment_pending,
      @accompaniment_price_rub, @chat_closed_at, @plan_sent_at, @chat_deadline_at,
      @accompaniment_deadline_at, @consultant_id, @messages_json, @diary_snapshot_json, @ai_draft_json
    )
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      email = excluded.email,
      child_id = excluded.child_id,
      child_name = excluded.child_name,
      topic = excluded.topic,
      product_id = excluded.product_id,
      status = excluded.status,
      price_rub = excluded.price_rub,
      paid_at = excluded.paid_at,
      payment_ref = excluded.payment_ref,
      accompaniment_paid = excluded.accompaniment_paid,
      accompaniment_pending = excluded.accompaniment_pending,
      accompaniment_price_rub = excluded.accompaniment_price_rub,
      chat_closed_at = excluded.chat_closed_at,
      plan_sent_at = excluded.plan_sent_at,
      chat_deadline_at = excluded.chat_deadline_at,
      accompaniment_deadline_at = excluded.accompaniment_deadline_at,
      consultant_id = excluded.consultant_id,
      messages_json = excluded.messages_json,
      diary_snapshot_json = excluded.diary_snapshot_json,
      ai_draft_json = excluded.ai_draft_json`,
  ).run(params as Record<string, string | number | null>);
  return order;
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
  const rows = getDb()
    .prepare("SELECT * FROM plan_orders ORDER BY updated_at DESC")
    .all() as DbRow[];
  return rows.map((r) => applyOrderLifecycle(rowToOrder(r)));
}

export function ordersForEmail(email: string): PlanOrder[] {
  const norm = normalizeEmail(email);
  const rows = getDb()
    .prepare("SELECT * FROM plan_orders WHERE email = ? ORDER BY updated_at DESC")
    .all(norm) as DbRow[];
  return rows.map((r) => applyOrderLifecycle(rowToOrder(r)));
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
  const rows = getDb()
    .prepare(
      "SELECT * FROM plan_orders WHERE email = ? AND topic = ? ORDER BY updated_at DESC",
    )
    .all(norm, topic) as DbRow[];
  for (const row of rows) {
    const order = applyOrderLifecycle(rowToOrder(row));
    if (isActivePlanOrder(order)) return order;
  }
  return null;
}

function purgeStaleAwaiting(email: string, topic: PlanTopic) {
  const norm = normalizeEmail(email);
  const cutoff = new Date(Date.now() - AWAITING_TTL_MS).toISOString();
  getDb()
    .prepare(
      `DELETE FROM plan_orders
       WHERE email = ? AND topic = ? AND status = 'awaiting_payment' AND created_at < ?`,
    )
    .run(norm, topic, cutoff);
}

export function chatDeadlineFromNow(): string {
  return new Date(
    Date.now() + PLAN_CHAT_DAYS * 86_400_000,
  ).toISOString();
}

export function accompanimentDeadlineFromNow(): string {
  return new Date(Date.now() + ACCOMPANIMENT_DAYS * 86_400_000).toISOString();
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
  purgeStaleAwaiting(input.email, input.topic);

  const existing = activeOrderForTopic(input.email, input.topic);
  if (existing) return existing;

  const norm = normalizeEmail(input.email);
  const awaitingRow = getDb()
    .prepare(
      `SELECT * FROM plan_orders
       WHERE email = ? AND topic = ? AND status = 'awaiting_payment'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(norm, input.topic) as DbRow | undefined;
  if (awaitingRow) return rowToOrder(awaitingRow);

  const orderCount = (
    getDb().prepare("SELECT COUNT(*) AS c FROM plan_orders").get() as {
      c: number;
    }
  ).c;
  const consultantId = pickConsultantForNewOrder(orderCount);

  const now = new Date().toISOString();
  const order: PlanOrder = {
    id: newOrderId(),
    createdAt: now,
    updatedAt: now,
    email: norm,
    childId: input.childId,
    childName: input.childName,
    topic: input.topic,
    productId: input.productId,
    status: "awaiting_payment",
    priceRub: input.priceRub,
    consultantId,
    messages: [],
    diarySnapshot: mergeDiaryEntries(
      input.email,
      input.topic,
      input.childId,
      input.clientEntries,
    ),
    aiDraft: { status: "pending" },
  };

  upsertOrder(order);
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
      | "planSentAt"
      | "chatDeadlineAt"
      | "accompanimentDeadlineAt"
    >
  >,
): PlanOrder | null {
  const prev = loadOrderRaw(id);
  if (!prev) return null;
  const next: PlanOrder = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  upsertOrder(next);
  return next;
}

export function appendMessage(
  orderId: string,
  msg: Omit<OrderMessage, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): PlanOrder | null {
  const order = loadOrderRaw(orderId);
  if (!order) return null;
  if (order.chatClosedAt && msg.role === "user") return null;

  const row: OrderMessage = {
    id: msg.id ?? newMessageId(),
    createdAt: msg.createdAt ?? new Date().toISOString(),
    role: msg.role,
    text: msg.text,
    pdfFile: msg.pdfFile,
  };

  let status = order.status;
  if (msg.role === "specialist" && order.status === "paid") {
    status = "contacted";
  } else if (msg.pdfFile) {
    status = "plan_sent";
  } else if (order.status === "plan_sent") {
    status = "clarifying";
  }

  const planPatch: Partial<PlanOrder> = {};
  if (msg.pdfFile || status === "plan_sent") {
    if (!order.planSentAt) planPatch.planSentAt = row.createdAt;
    if (!order.chatDeadlineAt) {
      planPatch.chatDeadlineAt = order.accompanimentPaid
        ? (order.accompanimentDeadlineAt ?? accompanimentDeadlineFromNow())
        : chatDeadlineFromNow();
    }
  }

  const next: PlanOrder = {
    ...order,
    ...planPatch,
    messages: [...order.messages, row],
    updatedAt: row.createdAt,
    status,
  };
  upsertOrder(next);
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
  const consultant = getPlanConsultant(order.consultantId);
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
        text: systemIntroMessage(consultant.name),
      },
    ],
  };
  upsertOrder(next);
  return next;
}

export function fulfillAccompanimentPayment(
  parentOrderId: string,
  paymentRef?: string,
  opts?: { skipIntro?: boolean },
): PlanOrder | null {
  const order = getOrder(parentOrderId);
  if (!order) return null;
  if (order.accompanimentPaid) return order;

  const now = new Date().toISOString();
  const consultant = getPlanConsultant(order.consultantId);
  const extra =
    opts?.skipIntro
      ? []
      : [
          {
            id: newMessageId(),
            createdAt: now,
            role: "system" as const,
            text: accompanimentIntroMessage(consultant.name),
          },
        ];
  const next: PlanOrder = {
    ...order,
    accompanimentPaid: true,
    accompanimentPending: false,
    accompanimentPriceRub: ACCOMPANIMENT_RUB,
    status: "accompaniment_active",
    chatClosedAt: undefined,
    accompanimentDeadlineAt: accompanimentDeadlineFromNow(),
    paymentRef: paymentRef ?? order.paymentRef,
    updatedAt: now,
    messages: [...order.messages, ...extra],
  };
  upsertOrder(next);
  return next;
}

export function markAccompanimentPending(orderId: string): PlanOrder | null {
  return updateOrder(orderId, { accompanimentPending: true });
}

export function orderForClient(order: PlanOrder) {
  const pdfUrl = (file?: string) =>
    file ? `/api/plan-orders/${order.id}/pdf/${file}` : undefined;

  const c = getPlanConsultant(order.consultantId);
  return {
    ...order,
    consultant: {
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      role: consultantRoleForTopic(order.topic),
    },
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
