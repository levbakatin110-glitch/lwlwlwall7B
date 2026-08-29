"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACCOMPANIMENT_RUB,
  ORDER_STATUS_MOM,
  PLAN_TOPIC_LABEL,
} from "@/lib/plan-products";
import {
  consultantRoleForTopic,
  getPlanConsultant,
  orderStatusHint,
} from "@/lib/plan-consultants";
import { PlanConsultantAvatar } from "@/components/plan/PlanConsultantAvatar";
import type { PlanConsultantId } from "@/lib/plan-consultants";
import type { JournalEntry } from "@/lib/types";

const PASS_KEY = "maya-admin-pass";

type OrderMessage = {
  id: string;
  createdAt: string;
  role: string;
  text?: string;
  pdfUrl?: string;
};

type PlanOrder = {
  id: string;
  email: string;
  childName?: string;
  topic: "sleep" | "feed";
  status: string;
  consultantId?: PlanConsultantId | string;
  chatClosedAt?: string;
  chatDeadlineAt?: string;
  messages: OrderMessage[];
  diarySnapshot?: { entries: JournalEntry[]; capturedAt: string };
  aiDraft?: {
    analysis?: string;
    planText?: string;
    status?: string;
    error?: string;
    generatedAt?: string;
    pdfUrl?: string;
  };
};

function fmtEntry(e: JournalEntry) {
  const when = e.createdAt
    ? `${e.date} ${e.createdAt.slice(11, 16)}`
    : e.date;
  return `${when} — ${e.value}${e.note ? ` · ${e.note}` : ""}`;
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type QueueFilter = "all" | "active" | "needs_reply" | "closed";

function orderNeedsReply(o: PlanOrder) {
  if (o.chatClosedAt && o.status !== "accompaniment_active") return false;
  const last = o.messages[o.messages.length - 1];
  return last?.role === "user";
}

function orderIsActive(o: PlanOrder) {
  return (
    o.status !== "awaiting_payment" &&
    o.status !== "closed" &&
    o.status !== "completed" &&
    (!o.chatClosedAt || o.status === "accompaniment_active")
  );
}

function statusLabel(order: PlanOrder) {
  const c = getPlanConsultant(order.consultantId);
  return orderStatusHint(order.status, c.name) ?? ORDER_STATUS_MOM[order.status] ?? order.status;
}

export default function AdminOrdersPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState<PlanOrder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<PlanOrder | null>(null);
  const [tab, setTab] = useState<"diary" | "ai">("diary");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("active");
  const [reply, setReply] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  const headers = useCallback(
    () => ({
      "x-admin-password": password,
      "Content-Type": "application/json",
    }),
    [password],
  );

  const login = async () => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setNote("Неверный пароль");
      return;
    }
    setAuthed(true);
    sessionStorage.setItem(PASS_KEY, password);
  };

  const filteredOrders = orders.filter((o) => {
    if (queueFilter === "all") return true;
    if (queueFilter === "active") return orderIsActive(o);
    if (queueFilter === "needs_reply") return orderNeedsReply(o);
    return o.status === "closed" || o.status === "completed" || Boolean(o.chatClosedAt);
  });

  const loadList = useCallback(async () => {
    const res = await fetch("/api/admin/plan-orders", {
      headers: { "x-admin-password": password },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { orders: PlanOrder[] };
    setOrders(data.orders);
  }, [password]);

  const loadOne = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/plan-orders/${id}`, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { order: PlanOrder };
      setActive(data.order);
    },
    [password],
  );

  useEffect(() => {
    const saved = sessionStorage.getItem(PASS_KEY);
    if (saved) {
      setPassword(saved);
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("pick");
    if (q) setActiveId(q);
  }, []);

  useEffect(() => {
    if (!authed) return;
    void loadList();
    const t = window.setInterval(() => void loadList(), 8000);
    return () => window.clearInterval(t);
  }, [authed, loadList]);

  useEffect(() => {
    if (!activeId || !authed) return;
    void loadOne(activeId);
    const ms = active?.aiDraft?.status === "pending" ? 2500 : 5000;
    const t = window.setInterval(() => void loadOne(activeId), ms);
    return () => window.clearInterval(t);
  }, [activeId, authed, loadOne, active?.aiDraft?.status]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length]);

  const sendReply = async () => {
    if (!activeId || (!reply.trim() && !pdfFile)) return;
    setBusy(true);
    setNote(null);
    try {
      let res: Response;
      if (pdfFile) {
        const fd = new FormData();
        if (reply.trim()) fd.set("text", reply.trim());
        fd.set("pdf", pdfFile);
        res = await fetch(`/api/admin/plan-orders/${activeId}/messages`, {
          method: "POST",
          headers: { "x-admin-password": password },
          body: fd,
        });
      } else {
        res = await fetch(`/api/admin/plan-orders/${activeId}/messages`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ text: reply.trim() }),
        });
      }
      if (!res.ok) {
        setNote("Не удалось отправить");
        return;
      }
      setReply("");
      setPdfFile(null);
      void loadOne(activeId);
      setNote("Отправлено");
    } finally {
      setBusy(false);
    }
  };

  const runGenerateAi = async () => {
    if (!activeId) return;
    setBusy(true);
    setNote("ИИ генерирует разбор…");
    try {
      const res = await fetch(
        `/api/admin/plan-orders/${activeId}/generate-ai`,
        { method: "POST", headers: { "x-admin-password": password } },
      );
      if (!res.ok) {
        setNote("Ошибка генерации");
        return;
      }
      const data = (await res.json()) as { order: PlanOrder };
      setActive(data.order);
      setNote("ИИ-черновик готов");
    } finally {
      setBusy(false);
    }
  };

  const openDraftPdf = async () => {
    if (!activeId || !active?.aiDraft?.pdfUrl) return;
    await openPdfUrl(active.aiDraft.pdfUrl);
  };

  const openPdfUrl = async (url: string) => {
    try {
      const res = await fetch(url, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) {
        setNote("Не удалось открыть PDF");
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener");
    } catch {
      setNote("Не удалось открыть PDF");
    }
  };

  const copyQuestions = () => {
    const text = active?.aiDraft?.analysis ?? "";
    const match = text.split("---").pop()?.trim();
    if (match) void navigator.clipboard.writeText(match);
    setNote("Вопросы скопированы");
  };

  const insertAiQuestions = async () => {
    if (!activeId || !active?.aiDraft?.analysis) return;
    const block = active.aiDraft.analysis.split("---").pop()?.trim();
    if (!block) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/plan-orders/${activeId}/messages`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ text: block }),
      });
      if (res.ok) {
        setNote("Вопросы отправлены в чат");
        void loadOne(activeId);
      }
    } finally {
      setBusy(false);
    }
  };

  const closeChat = async () => {
    if (!activeId) return;
    setBusy(true);
    await fetch(`/api/admin/plan-orders/${activeId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ closeChat: true }),
    });
    void loadOne(activeId);
    setBusy(false);
    setNote("Чат закрыт");
  };

  const activeConsultant = active ? getPlanConsultant(active.consultantId) : null;
  const activeRole = active ? consultantRoleForTopic(active.topic) : "";

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="font-display text-2xl font-semibold">План + чат</h1>
        <p className="text-sm text-muted">Разборы дневника · Марина, Юлия, Анна</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль админки"
          className="rounded-xl border border-line px-3 py-2"
        />
        <button
          type="button"
          onClick={() => void login()}
          className="rounded-xl bg-accent py-2.5 font-semibold text-[var(--on-accent,#fff)]"
        >
          Войти
        </button>
        <Link href="/admin" className="text-center text-sm text-muted">
          ← Основная админка
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="flex max-h-[42vh] min-h-0 w-full shrink-0 flex-col border-b border-line md:h-full md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <div className="flex shrink-0 items-center justify-between border-b border-line p-3">
          <div>
            <h1 className="font-display text-lg font-semibold">Консультанты</h1>
            <p className="text-[10px] text-muted">Чаты · дневники · PDF</p>
          </div>
          <Link href="/admin" className="text-xs text-accent">
            Админка
          </Link>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1 border-b border-line p-2">
          {(
            [
              ["active", "Активные"],
              ["needs_reply", "Ждут ответа"],
              ["closed", "Закрытые"],
              ["all", "Все"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setQueueFilter(id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                queueFilter === id
                  ? "bg-accent text-[var(--on-accent,#fff)]"
                  : "bg-accent-soft/50 text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredOrders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setActiveId(o.id);
                setTab("diary");
              }}
              className={`block w-full border-b border-line px-3 py-3 text-left text-sm ${
                activeId === o.id ? "bg-accent-soft" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{PLAN_TOPIC_LABEL[o.topic]}</p>
                {orderNeedsReply(o) ? (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-[var(--on-accent,#fff)]">
                    новое
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted">{o.email}</p>
              <p className="text-[10px] text-muted">
                {getPlanConsultant(o.consultantId).name} · {statusLabel(o)}
              </p>
            </button>
          ))}
          {filteredOrders.length === 0 ? (
            <p className="p-4 text-sm text-muted">Заказов в этой очереди нет</p>
          ) : null}
        </div>
      </aside>

      {!activeId || !active ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-muted">
          Выберите заказ
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 flex-1 flex-col border-b border-line lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-line p-3">
              <div className="flex items-center gap-3">
                <PlanConsultantAvatar
                  consultantId={activeConsultant!.id}
                  size={40}
                />
                <div className="min-w-0">
                  <p className="font-medium">{activeConsultant!.name}</p>
                  <p className="text-[11px] text-muted">{activeRole}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                {active.email}
                {active.childName ? ` · ${active.childName}` : ""}
              </p>
              <p className="text-sm font-medium">
                {PLAN_TOPIC_LABEL[active.topic]} · {statusLabel(active)}
              </p>
              {active.chatDeadlineAt && !active.chatClosedAt ? (
                <p className="text-[10px] text-muted">
                  Чат до {fmtWhen(active.chatDeadlineAt)}
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {active.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    m.role === "specialist"
                      ? "ml-8 bg-accent text-[var(--on-accent,#fff)]"
                      : m.role === "user"
                        ? "mr-8 border border-line bg-card"
                        : "bg-accent-soft/60 text-center text-xs"
                  }`}
                >
                  {m.role === "specialist" ? (
                    <p className="mb-1 text-[10px] opacity-70">
                      {activeConsultant!.name}
                    </p>
                  ) : null}
                  {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : null}
                  {m.pdfUrl ? (
                    <button
                      type="button"
                      onClick={() => void openPdfUrl(m.pdfUrl!)}
                      className="mt-1 block text-left text-xs underline"
                    >
                      PDF план
                    </button>
                  ) : null}
                  <p className="mt-1 text-[10px] opacity-60">{fmtWhen(m.createdAt)}</p>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>

            {!active.chatClosedAt ? (
              <div className="shrink-0 space-y-2 border-t border-line p-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder={`Сообщение от ${activeConsultant!.name}…`}
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                />
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  className="text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendReply()}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[var(--on-accent,#fff)]"
                  >
                    Отправить
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void closeChat()}
                    className="rounded-xl border border-line px-4 py-2 text-sm"
                  >
                    Закрыть чат
                  </button>
                </div>
                {note ? <p className="text-xs text-muted">{note}</p> : null}
              </div>
            ) : (
              <p className="shrink-0 border-t border-line p-3 text-center text-sm text-muted">
                Чат закрыт · апсейл сопровождение +{ACCOMPANIMENT_RUB} ₽
              </p>
            )}
          </div>

          <div className="flex w-full shrink-0 flex-col lg:w-[22rem]">
            <div className="flex border-b border-line">
              <button
                type="button"
                onClick={() => setTab("diary")}
                className={`flex-1 py-2.5 text-sm font-medium ${
                  tab === "diary" ? "border-b-2 border-accent text-accent" : ""
                }`}
              >
                Дневник
              </button>
              <button
                type="button"
                onClick={() => setTab("ai")}
                className={`flex-1 py-2.5 text-sm font-medium ${
                  tab === "ai" ? "border-b-2 border-accent text-accent" : ""
                }`}
              >
                ИИ + PDF
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
              {tab === "diary" ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted">
                    Записей: {active.diarySnapshot?.entries.length ?? 0}
                    {active.diarySnapshot?.capturedAt
                      ? ` · снимок ${fmtWhen(active.diarySnapshot.capturedAt)}`
                      : ""}
                  </p>
                  {(active.diarySnapshot?.entries ?? []).map((e) => (
                    <p
                      key={e.id}
                      className="rounded-lg border border-line bg-card/60 px-2.5 py-2 text-xs leading-relaxed"
                    >
                      {fmtEntry(e)}
                    </p>
                  ))}
                  {(active.diarySnapshot?.entries.length ?? 0) === 0 ? (
                    <p className="text-muted">
                      Нет записей на сервере. Пусть мама откроет приложение —
                      бэкап подтянется.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || active.aiDraft?.status === "pending"}
                      onClick={() => void runGenerateAi()}
                      className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-[var(--on-accent,#fff)] disabled:opacity-50"
                    >
                      {active.aiDraft?.status === "pending"
                        ? "Генерация…"
                        : active.aiDraft?.status === "ready"
                          ? "Перегенерировать"
                          : "Сгенерировать ИИ"}
                    </button>
                    {active.aiDraft?.analysis ? (
                      <>
                        <button
                          type="button"
                          onClick={copyQuestions}
                          className="rounded-lg border border-line px-3 py-1.5 text-[11px]"
                        >
                          Копировать
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void insertAiQuestions()}
                          className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-[11px] font-semibold text-accent"
                        >
                          В чат маме
                        </button>
                      </>
                    ) : null}
                  </div>

                  {active.aiDraft?.status === "pending" ? (
                    <p className="text-muted">ИИ готовит разбор и черновик PDF…</p>
                  ) : null}
                  {active.aiDraft?.status === "error" ? (
                    <p className="text-red-600">
                      {active.aiDraft.error ?? "Ошибка ИИ"}
                    </p>
                  ) : null}
                  {active.aiDraft?.generatedAt ? (
                    <p className="text-[10px] text-muted">
                      Обновлено: {fmtWhen(active.aiDraft.generatedAt)}
                    </p>
                  ) : null}

                  {active.aiDraft?.analysis ? (
                    <div>
                      <p className="font-semibold">Разбор для вас</p>
                      <p className="mt-1 whitespace-pre-wrap text-foreground/90">
                        {active.aiDraft.analysis}
                      </p>
                    </div>
                  ) : null}
                  {active.aiDraft?.planText ? (
                    <div>
                      <p className="font-semibold">Текст плана (черновик)</p>
                      <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-card/50 p-2">
                        {active.aiDraft.planText}
                      </p>
                    </div>
                  ) : null}
                  {active.aiDraft?.pdfUrl ? (
                    <button
                      type="button"
                      onClick={() => void openDraftPdf()}
                      className="inline-flex rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 font-semibold text-accent"
                    >
                      📄 Черновик PDF
                    </button>
                  ) : null}
                  {!active.aiDraft?.analysis &&
                  active.aiDraft?.status !== "pending" ? (
                    <p className="text-muted">
                      Нажмите «Сгенерировать ИИ» или дождитесь автогенерации
                      после нового заказа.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
