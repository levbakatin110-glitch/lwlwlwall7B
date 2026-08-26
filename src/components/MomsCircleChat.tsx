"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { childDisplayName } from "@/lib/children";
import { compressImageFile } from "@/lib/image";
import { useAppStore } from "@/lib/store";

type CommunityMessage = {
  id: string;
  createdAt: string;
  authorKey: string;
  displayName: string;
  avatar?: string;
  babyTag?: string;
  text: string;
};

type CommunityProfile = {
  nick: string;
  avatar?: string;
  babyName: string;
  babyBirth: string;
};

const PROFILE_KEY = "maya-community-profile-v2";

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
    bg: `hsl(${hue} 45% 88%)`,
    fg: `hsl(${hue} 35% 28%)`,
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
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} ${time}`;
}

function formatBirthDigits(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso.trim();
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function buildBabyTag(babyName: string, babyBirth: string) {
  const n = babyName.trim();
  const b = babyBirth.trim() ? formatBirthDigits(babyBirth.trim()) : "";
  if (n && b) return `${n} · ${b}`;
  if (n) return n;
  if (b) return b;
  return "";
}

function loadProfile(): CommunityProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as CommunityProfile;
      if (p?.nick && p.nick.trim().length >= 2) {
        return {
          nick: p.nick.trim().slice(0, 32),
          avatar: p.avatar,
          babyName: p.babyName || "",
          babyBirth: p.babyBirth || "",
        };
      }
    }
    // старый ключ только с ником
    const legacy = localStorage.getItem("maya-community-nick");
    if (legacy && legacy.trim().length >= 2) {
      return {
        nick: legacy.trim().slice(0, 32),
        babyName: "",
        babyBirth: "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

function saveProfile(p: CommunityProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* quota */
  }
}

function Avatar({
  name,
  avatar,
  authorKey,
  mine,
  size = 36,
}: {
  name: string;
  avatar?: string;
  authorKey: string;
  mine?: boolean;
  size?: number;
}) {
  const colors = pastelFromKey(authorKey);
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{
        width: size,
        height: size,
        background: mine ? "var(--accent)" : colors.bg,
        color: mine ? "var(--on-accent, #fff)" : colors.fg,
      }}
      aria-hidden
    >
      {(name[0] || "?").toUpperCase()}
    </div>
  );
}

export function MomsCircleChat() {
  const accountEmail = useAppStore((s) => s.accountEmail);
  const emailVerified = useAppStore((s) => s.emailVerified);
  const profile = useAppStore((s) => s.profile);

  const [ready, setReady] = useState(false);
  const [setupNick, setSetupNick] = useState("");
  const [setupAvatar, setSetupAvatar] = useState<string | undefined>();
  const [setupBabyName, setSetupBabyName] = useState("");
  const [setupBabyBirth, setSetupBabyBirth] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);

  const [commProfile, setCommProfile] = useState<CommunityProfile | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [text, setText] = useState("");
  const [myKey, setMyKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = loadProfile();
    if (saved) {
      setCommProfile(saved);
    } else {
      const baby = childDisplayName(profile);
      setSetupNick("");
      setSetupBabyName(baby && baby !== "Малыш" ? baby : "");
      setSetupBabyBirth(profile.birthDate || "");
    }
    setReady(true);
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
      if (!silent) setError(null);
    } catch {
      if (!silent) setError("Нет связи. Попробуйте ещё раз.");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!stickBottom.current) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, commProfile]);

  async function onPickAvatar(file: File | null) {
    if (!file) return;
    try {
      const data = await compressImageFile(file, 240, 0.7);
      setSetupAvatar(data);
    } catch {
      setError("Не удалось загрузить фото");
    }
  }

  function finishSetup() {
    const nick = setupNick.trim();
    if (nick.length < 2) {
      setError("Введите имя");
      return;
    }
    const next: CommunityProfile = {
      nick: nick.slice(0, 32),
      avatar: setupAvatar,
      babyName: setupBabyName.trim().slice(0, 24),
      babyBirth: setupBabyBirth.trim(),
    };
    saveProfile(next);
    setCommProfile(next);
    setEditingProfile(false);
    setError(null);
  }

  function openEdit() {
    if (!commProfile) return;
    setSetupNick(commProfile.nick);
    setSetupAvatar(commProfile.avatar);
    setSetupBabyName(commProfile.babyName);
    setSetupBabyBirth(commProfile.babyBirth);
    setEditingProfile(true);
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!emailVerified || !accountEmail || !commProfile) return;
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/community/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: accountEmail,
          displayName: commProfile.nick,
          text: body,
          avatar: commProfile.avatar,
          babyTag: buildBabyTag(commProfile.babyName, commProfile.babyBirth) || undefined,
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
  const needSetup = ready && canPost && (!commProfile || editingProfile);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        …
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      {/* шапка как в мессенджере */}
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-card/95 px-3 py-2.5">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-muted hover:bg-accent-soft hover:text-foreground"
          aria-label="Назад"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold tracking-tight">
            Общение
          </p>
        </div>
        {commProfile && !editingProfile && canPost && (
          <button
            type="button"
            onClick={openEdit}
            className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-accent-soft hover:text-foreground"
          >
            Профиль
          </button>
        )}
      </header>

      {needSetup ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-8">
          <div className="w-full max-w-sm space-y-4">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Как вас зовут?
            </h2>
            <p className="text-sm text-muted">
              Имя обязательно. Фото и про малыша — по желанию.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-line bg-card text-muted"
              >
                {setupAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={setupAvatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[11px] font-medium">фото</span>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  void onPickAvatar(e.target.files?.[0] ?? null)
                }
              />
              <input
                value={setupNick}
                onChange={(e) => setSetupNick(e.target.value.slice(0, 32))}
                placeholder="Ваше имя"
                autoFocus
                className="min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 py-3 text-base text-foreground outline-none focus:border-accent/40"
              />
            </div>

            <div className="space-y-2 rounded-2xl border border-line/70 bg-card/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                Про малыша · необязательно
              </p>
              <input
                value={setupBabyName}
                onChange={(e) => setSetupBabyName(e.target.value.slice(0, 24))}
                placeholder="Как зовут"
                className="w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent/40"
              />
              <label className="block text-xs text-muted">
                Дата рождения
                <input
                  type="date"
                  value={setupBabyBirth}
                  onChange={(e) => setSetupBabyBirth(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm text-foreground"
                />
              </label>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            )}

            <button
              type="button"
              onClick={finishSetup}
              disabled={setupNick.trim().length < 2}
              className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[var(--on-accent,#fff)] disabled:opacity-40"
            >
              {editingProfile ? "Сохранить" : "Войти в чат"}
            </button>
            {editingProfile && (
              <button
                type="button"
                onClick={() => {
                  setEditingProfile(false);
                  setError(null);
                }}
                className="w-full text-sm text-muted underline"
              >
                Отмена
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            ref={listRef}
            onScroll={() => {
              const el = listRef.current;
              if (!el) return;
              stickBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3 sm:px-4"
          >
            {messages.map((m) => {
              const mine = Boolean(myKey && m.authorKey === myKey);
              const isMaya = m.authorKey === "maya";
              return (
                <article
                  key={m.id}
                  className={`flex max-w-[88%] gap-2 ${
                    mine ? "ml-auto flex-row-reverse" : "mr-auto"
                  }`}
                >
                  {!mine && (
                    <Avatar
                      name={m.displayName}
                      avatar={m.avatar}
                      authorKey={m.authorKey}
                    />
                  )}
                  <div
                    className={`min-w-0 rounded-2xl px-3 py-2 ${
                      isMaya
                        ? "border border-accent/20 bg-accent-soft/60"
                        : mine
                          ? "bg-user-bubble"
                          : "bg-card ring-1 ring-line/80"
                    }`}
                  >
                    {!mine && (
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[13px] font-semibold text-foreground">
                          {m.displayName}
                        </span>
                        {m.babyTag && (
                          <span className="text-[11px] text-muted">
                            {m.babyTag}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap text-[15px] leading-snug text-foreground">
                      {m.text}
                    </p>
                    <p
                      className={`mt-1 text-[10px] text-muted ${
                        mine ? "text-right" : ""
                      }`}
                    >
                      {formatWhen(m.createdAt)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-line bg-card/95 px-3 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
            {!canPost ? (
              <div className="rounded-xl bg-accent-soft/50 px-3 py-2.5 text-sm">
                <Link href="/profile" className="font-semibold text-accent underline">
                  Войдите
                </Link>
                <span className="text-muted">, чтобы писать</span>
              </div>
            ) : (
              <form
                onSubmit={(e) => void send(e)}
                className="flex items-end gap-2"
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder="Сообщение"
                  className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-line bg-background px-3.5 py-2.5 text-[15px] text-foreground outline-none focus:border-accent/40"
                />
                <button
                  type="submit"
                  disabled={busy || !text.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-[var(--on-accent,#fff)] disabled:opacity-40"
                  aria-label="Отправить"
                >
                  <MayaIcon name="chat" size={18} />
                </button>
              </form>
            )}
            {error && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-300">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
