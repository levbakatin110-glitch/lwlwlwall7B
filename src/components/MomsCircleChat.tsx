"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { childDisplayName } from "@/lib/children";
import { useAppStore } from "@/lib/store";

type CommunityMessage = {
  id: string;
  createdAt: string;
  authorKey: string;
  displayName: string;
  city?: string;
  text: string;
  mood?: string;
};

const MOODS = ["💛", "😴", "☀️", "🥹", "💪", "☕", "🌧️", "🎉"] as const;
const STARTERS = [
  "Кто тоже сегодня без сил, но всё равно молодец?",
  "Подскажите тёплый совет на бессонную ночь…",
  "Делимся маленькой победой дня ✨",
  "Что надеть малышу — у нас +5 и ветер",
];

const NICK_KEY = "maya-community-nick";

async function hashAuthorKey(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function pastelFromKey(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return {
    bg: `hsl(${hue} 55% 92%)`,
    fg: `hsl(${hue} 40% 32%)`,
  };
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return time;
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} · ${time}`;
}

function initialNick(profileName: string, city: string) {
  try {
    const saved = localStorage.getItem(NICK_KEY);
    if (saved?.trim()) return saved.trim().slice(0, 32);
  } catch {
    /* ignore */
  }
  const baby = profileName.trim();
  if (baby && baby !== "Малыш") return `Мама ${baby}`;
  if (city.trim()) return `Мама из ${city.trim()}`;
  return "Мама";
}

export function MomsCircleChat() {
  const accountEmail = useAppStore((s) => s.accountEmail);
  const emailVerified = useAppStore((s) => s.emailVerified);
  const profile = useAppStore((s) => s.profile);

  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<string>("💛");
  const [nick, setNick] = useState("Мама");
  const [myKey, setMyKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlineHint, setOnlineHint] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);

  useEffect(() => {
    setNick(initialNick(childDisplayName(profile), profile.city || ""));
  }, [profile]);

  useEffect(() => {
    if (!accountEmail || !emailVerified) {
      setMyKey(null);
      return;
    }
    let cancelled = false;
    void hashAuthorKey(accountEmail).then((k) => {
      if (!cancelled) setMyKey(k);
    });
    return () => {
      cancelled = true;
    };
  }, [accountEmail, emailVerified]);

  const load = useCallback(async (silent = false) => {
    try {
      const res = await fetch("/api/community/messages?limit=100");
      if (!res.ok) throw new Error("Не удалось загрузить");
      const data = (await res.json()) as { messages?: CommunityMessage[] };
      setMessages(data.messages ?? []);
      setOnlineHint(true);
      if (!silent) setError(null);
    } catch {
      if (!silent) {
        setError("Пока не достучались до кружка. Попробуйте ещё раз.");
      }
      setOnlineHint(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(true), 3000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!stickBottom.current) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!emailVerified || !accountEmail) return;
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      try {
        localStorage.setItem(NICK_KEY, nick.trim().slice(0, 32));
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/community/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: accountEmail,
          displayName: nick.trim(),
          text: body,
          city: profile.city || undefined,
          mood,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: CommunityMessage;
      };
      if (!res.ok) throw new Error(data.error || "Не отправилось");
      setText("");
      if (data.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message!.id)
            ? prev
            : [...prev, data.message!],
        );
      } else {
        await load(true);
      }
      stickBottom.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const canPost = Boolean(emailVerified && accountEmail);

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-2xl flex-col md:h-[calc(100dvh-2rem)]">
      <header className="shrink-0 pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          Для всех в Мае
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Общение
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Беременность, малыш, цикл — пишите друг другу. Поддержка и живой чат,
          без нравоучений.
          {onlineHint ? (
            <span className="ml-1 text-accent"> · онлайн</span>
          ) : (
            <span className="ml-1"> · связь слабая</span>
          )}
        </p>
      </header>

      <div className="maya-sketch-frame relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-line bg-card/80 shadow-sm backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at 10% 0%, rgba(196,92,122,0.12), transparent 45%), radial-gradient(ellipse at 90% 20%, rgba(50,215,175,0.08), transparent 40%)",
          }}
        />

        <div
          ref={listRef}
          onScroll={() => {
            const el = listRef.current;
            if (!el) return;
            stickBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="relative z-[1] flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-4 sm:px-5"
        >
          {messages.map((m) => {
            const mine = Boolean(myKey && m.authorKey === myKey);
            const colors = pastelFromKey(m.authorKey);
            const isMaya = m.authorKey === "maya";
            return (
              <article
                key={m.id}
                className={`maya-msg-in flex max-w-[94%] gap-2.5 ${
                  mine ? "ml-auto flex-row-reverse" : "mr-auto"
                } ${isMaya ? "w-full max-w-full" : ""}`}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: isMaya
                      ? "var(--accent-soft)"
                      : mine
                        ? "var(--accent)"
                        : colors.bg,
                    color: isMaya
                      ? "var(--accent)"
                      : mine
                        ? "var(--on-accent, #fff)"
                        : colors.fg,
                  }}
                  aria-hidden
                >
                  {isMaya ? "М" : (m.displayName[0] || "?").toUpperCase()}
                </div>
                <div
                  className={`min-w-0 flex-1 rounded-2xl px-3.5 py-2.5 ${
                    isMaya
                      ? "border border-accent/20 bg-accent-soft/50"
                      : mine
                        ? "bg-user-bubble text-foreground"
                        : "border border-line/80 bg-background/70"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      {mine ? "Вы" : m.displayName}
                      {m.mood ? ` ${m.mood}` : ""}
                    </span>
                    {m.city && !mine && (
                      <span className="text-[11px] text-muted">{m.city}</span>
                    )}
                    <span className="text-[11px] text-muted">
                      {formatWhen(m.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/95">
                    {m.text}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="relative z-[1] border-t border-line/70 bg-card/90 px-3 py-3 sm:px-4">
          {!canPost ? (
            <div className="rounded-2xl border border-dashed border-accent/30 bg-accent-soft/40 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">Войдите, чтобы писать</p>
              <p className="mt-1 text-muted">
                Читать можно всем. Писать — любому с аккаунтом в Мае (беременность,
                малыш, цикл — без разницы).
              </p>
              <Link
                href="/profile"
                className="mt-2 inline-block text-sm font-semibold text-accent underline"
              >
                К профилю →
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => void send(e)} className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-[8rem] flex-1 items-center gap-2 text-xs text-muted">
                  В кружке я
                  <input
                    value={nick}
                    onChange={(e) => setNick(e.target.value.slice(0, 32))}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-background px-2 py-1.5 text-sm text-foreground"
                    placeholder="Имя"
                  />
                </label>
                <div className="flex flex-wrap gap-1">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMood(m)}
                      className={`rounded-full px-2 py-1 text-sm transition ${
                        mood === m
                          ? "bg-accent-soft ring-1 ring-accent/35"
                          : "opacity-60 hover:opacity-100"
                      }`}
                      aria-label={`Настроение ${m}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setText(s)}
                    className="rounded-full border border-line bg-background/60 px-2.5 py-1 text-[11px] text-muted transition hover:border-accent/30 hover:text-foreground"
                  >
                    {s.length > 36 ? `${s.slice(0, 34)}…` : s}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                  placeholder="Напишите тепло… Enter — отправить"
                  className="min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-line bg-background px-3.5 py-2.5 text-sm leading-relaxed text-foreground outline-none focus:border-accent/40"
                />
                <button
                  type="submit"
                  disabled={busy || !text.trim() || nick.trim().length < 2}
                  className="shrink-0 self-end rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-[var(--on-accent,#fff)] disabled:opacity-40"
                >
                  {busy ? "…" : "Отправить"}
                </button>
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
