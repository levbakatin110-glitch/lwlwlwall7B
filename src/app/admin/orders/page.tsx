"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACCOMPANIMENT_RUB,
  PLAN_TOPIC_LABEL,
  SPECIALIST_DISPLAY_NAME,
} from "@/lib/plan-products";
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
  chatClosedAt?: string;
  messages: OrderMessage[];
  diarySnapshot?: { entries: JournalEntry[]; capturedAt: string };
  aiDraft?: {
    analysis?: string;
    planText?: string;
    status?: string;
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

export default function AdminOrdersPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState<PlanOrder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<PlanOrder | null>(null);
  const [tab, setTab] = useState<"diary" | "ai">("diary");
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
    if (!res.ok) return;
    setAuthed(true);
    sessionStorage.setItem(PASS_KEY, password);
  };

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
    const t = window.setInterval(() => void loadOne(activeId), 5000);
    return () => window.clearInterval(t);
  }, [activeId, authed, loadOne]);

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

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="font-display text-2xl font-semibold">Заказы планов</h1>
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
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-line md:w-72 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-line p-3">
          <h1 className="font-display text-lg font-semibold">Заказы</h1>
          <Link href="/admin" className="text-xs text-accent">
            Админка
          </Link>
        </div>
        <div className="max-h-48 overflow-y-auto md:max-h-none md:flex-1">
          {orders.map((o) => (
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
              <p className="font-medium">{PLAN_TOPIC_LABEL[o.topic]}</p>
              <p className="truncate text-xs text-muted">{o.email}</p>
              <p className="text-[10px] text-muted">{o.status}</p>
            </button>
          ))}
          {orders.length === 0 ? (
            <p className="p-4 text-sm text-muted">Заказов пока нет</p>
          ) : null}
        </div>
      </aside>

      {!activeId || !active ? (
        <div className="flex flex-1 items-center justify-center p-8 text-muted">
          Выберите заказ
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 flex-1 flex-col border-b border-line lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-line p-3">
              <p className="text-xs text-muted">
                {active.email}
                {active.childName ? ` · ${active.childName}` : ""}
              </p>
              <p className="text-sm font-medium">
                {PLAN_TOPIC_LABEL[active.topic]} · {active.status}
              </p>
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
                      {SPECIALIST_DISPLAY_NAME}
                    </p>
                  ) : null}
                  {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : null}
                  {m.pdfUrl ? (
                    <a href={m.pdfUrl} className="mt-1 block text-xs underline">
                      PDF план
                    </a>
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
                  placeholder={`Сообщение от ${SPECIALIST_DISPLAY_NAME}…`}
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
                  <p className="text-muted">
                    ИИ-разбор и черновик PDF — на следующем этапе. Пока
                    составляйте план сами по вкладке «Дневник».
                  </p>
                  {active.aiDraft?.analysis ? (
                    <div>
                      <p className="font-semibold">Разбор ИИ</p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {active.aiDraft.analysis}
                      </p>
                    </div>
                  ) : null}
                  {active.aiDraft?.planText ? (
                    <div>
                      <p className="font-semibold">Черновик плана</p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {active.aiDraft.planText}
                      </p>
                    </div>
                  ) : null}
                  {active.aiDraft?.pdfUrl ? (
                    <a href={active.aiDraft.pdfUrl} className="text-accent underline">
                      Черновик PDF
                    </a>
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
