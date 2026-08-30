"use client";

import {
  FormEvent,
  MouseEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CircleNotePlayer,
} from "@/components/CircleRecorder";
import {
  HoldRecordOverlay,
  useHoldMediaRecord,
} from "@/components/community/HoldMediaRecord";
import { VoiceNotePlayer } from "@/components/VoiceRecorder";
import { MayaIcon } from "@/components/icons/MayaIcon";
import {
  COMMUNITY_REACTIONS,
  mediaPreviewText,
} from "@/lib/community-reactions";
import { childDisplayName } from "@/lib/children";
import { compressImageFile } from "@/lib/image";
import { trackEvent } from "@/lib/analytics-client";
import { useAppStore } from "@/lib/store";

type MediaKind = "image" | "video" | "circle" | "voice";

type CommunityReply = {
  id: string;
  displayName: string;
  text: string;
  mediaKind?: MediaKind;
};

type CommunityMessage = {
  id: string;
  createdAt: string;
  authorKey: string;
  displayName: string;
  avatarUrl?: string;
  avatar?: string;
  babyTag?: string;
  text: string;
  mediaKind?: MediaKind;
  mediaUrl?: string;
  replyToId?: string;
  replyTo?: CommunityReply;
  reactions?: Record<string, string[]>;
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
  avatarUrl,
  authorKey,
  mine,
  size = 36,
}: {
  name: string;
  avatarUrl?: string;
  authorKey: string;
  mine?: boolean;
  size?: number;
}) {
  const colors = pastelFromKey(authorKey);
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="shrink-0 rounded-full object-cover ring-1 ring-line/60"
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

function MessageMedia({
  kind,
  url,
}: {
  kind?: MediaKind;
  url?: string;
}) {
  if (!url || !kind) return null;
  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="mt-1.5 max-h-64 w-full rounded-xl object-cover"
      />
    );
  }
  if (kind === "circle") {
    return <CircleNotePlayer url={url} />;
  }
  if (kind === "voice") {
    return <VoiceNotePlayer url={url} />;
  }
  return (
    <video
      src={url}
      controls
      playsInline
      className="mt-1.5 max-h-64 w-full rounded-xl bg-black"
    />
  );
}

type MenuState = { id: string; x: number; y: number };

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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingKind, setPendingKind] = useState<MediaKind | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<CommunityMessage | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const stickBottom = useRef(true);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const pressStart = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const menuOpenedAt = useRef(0);

  const holdRecord = useHoldMediaRecord({
    onReady: (file, kind) => {
      void send(undefined, { file, kind });
    },
    onError: (message) => setError(message),
  });

  const canPost = Boolean(emailVerified && accountEmail);

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
    if (!emailVerified) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/community/profile", {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          profile?: {
            nick?: string;
            babyName?: string;
            babyBirth?: string;
          } | null;
        };
        if (!data.profile?.nick) return;
        const next: CommunityProfile = {
          nick: data.profile.nick,
          babyName: data.profile.babyName || "",
          babyBirth: data.profile.babyBirth || "",
          avatar: loadProfile()?.avatar,
        };
        saveProfile(next);
        if (!cancelled) setCommProfile(next);
      } catch {
        /* offline — localStorage */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [emailVerified]);

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

  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function openMenu(id: string, x: number, y: number) {
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignore */
    }
    menuOpenedAt.current = Date.now();
    const w = 236;
    const h = 268;
    const pad = 10;
    setMenu({
      id,
      x: Math.min(Math.max(pad, x - w / 2), window.innerWidth - w - pad),
      y: Math.min(Math.max(pad, y - 24), window.innerHeight - h - pad),
    });
  }

  function onMsgContextMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    clearLongPress();
    openMenu(id, e.clientX, e.clientY);
  }

  function onMsgPointerDown(e: PointerEvent, id: string) {
    if (e.pointerType === "mouse") return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      suppressClick.current = true;
      openMenu(id, pressStart.current.x, pressStart.current.y);
    }, 460);
  }

  function onMsgPointerMove(e: PointerEvent) {
    if (!longPressTimer.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;
    if (dx * dx + dy * dy > 144) clearLongPress();
  }

  function jumpToMessage(id: string) {
    const el = listRef.current?.querySelector(`[data-msg-id="${CSS.escape(id)}"]`);
    if (!(el instanceof HTMLElement)) return;
    stickBottom.current = false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1100);
  }

  async function toggleReact(id: string, emoji: string) {
    if (!canPost) {
      setError("Войдите, чтобы ставить реакции");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/community/react", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, emoji }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: CommunityMessage;
      };
      if (!res.ok || !data.message) throw new Error(data.error || "Не вышло");
      setMessages((prev) =>
        prev.map((m) => (m.id === data.message!.id ? data.message! : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function deleteMsg(id: string) {
    if (!confirm("Удалить сообщение?")) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/community/messages?id=${encodeURIComponent(id)}`,
        { method: "DELETE", credentials: "include" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалилось");
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (replyTo?.id === id) setReplyTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function copyMsg(m: CommunityMessage) {
    const t = mediaPreviewText(m.mediaKind, m.text) || m.text;
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      setError("Не скопировалось");
    }
  }

  function startReply(m: CommunityMessage) {
    if (!canPost) {
      setError("Войдите, чтобы отвечать");
      return;
    }
    setReplyTo(m);
    window.setTimeout(() => composerRef.current?.focus(), 40);
  }

  async function onPickAvatar(file: File | null) {
    if (!file) return;
    try {
      const data = await compressImageFile(file, 240, 0.72);
      setSetupAvatar(data);
    } catch {
      setError("Не удалось загрузить фото");
    }
  }

  async function syncAvatarToServer(avatar: string | undefined) {
    if (!avatar?.startsWith("data:image/")) return;
    try {
      await fetch("/api/community/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar }),
      });
    } catch {
      /* offline ok — уйдёт с сообщением */
    }
  }

  async function finishSetup() {
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
    try {
      await fetch("/api/community/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nick: next.nick,
          babyName: next.babyName,
          babyBirth: next.babyBirth,
          avatar: setupAvatar,
        }),
      });
    } catch {
      await syncAvatarToServer(setupAvatar);
    }
    void load(true);
  }

  function openEdit() {
    if (!commProfile) return;
    setSetupNick(commProfile.nick);
    setSetupAvatar(commProfile.avatar);
    setSetupBabyName(commProfile.babyName);
    setSetupBabyBirth(commProfile.babyBirth);
    setEditingProfile(true);
  }

  function clearPendingMedia() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingKind(null);
    setPendingPreview(null);
  }

  async function onPickMedia(file: File | null) {
    if (!file) return;
    try {
      if (file.type.startsWith("image/")) {
        const dataUrl = await compressImageFile(file, 1280, 0.72);
        const blob = await (await fetch(dataUrl)).blob();
        const compressed = new File([blob], "photo.jpg", { type: "image/jpeg" });
        clearPendingMedia();
        setPendingFile(compressed);
        setPendingKind("image");
        setPendingPreview(dataUrl);
        return;
      }
      if (file.type.startsWith("video/")) {
        if (file.size > 12_000_000) {
          setError("Видео до 12 МБ");
          return;
        }
        clearPendingMedia();
        setPendingFile(file);
        setPendingKind("video");
        setPendingPreview(URL.createObjectURL(file));
        return;
      }
      setError("Можно фото или видео");
    } catch {
      setError("Не удалось прикрепить файл");
    }
  }

  async function send(
    e?: FormEvent,
    override?: { file: File; kind: MediaKind },
  ) {
    e?.preventDefault();
    if (!emailVerified || !accountEmail || !commProfile) return;
    const file = override?.file ?? pendingFile;
    const kind = override?.kind ?? pendingKind;
    const body = text.trim();
    if ((!body && !file) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("displayName", commProfile.nick);
      form.set("text", body);
      if (replyTo) form.set("replyToId", replyTo.id);
      const tag = buildBabyTag(commProfile.babyName, commProfile.babyBirth);
      if (tag) form.set("babyTag", tag);
      if (file && kind) {
        if (kind === "circle" && file.size > 2_800_000) {
          throw new Error("Кружок слишком большой — запишите короче");
        }
        if (kind === "voice" && file.size > 2_000_000) {
          throw new Error("Голосовое слишком большое — короче");
        }
        form.set("mediaKind", kind);
        form.set("file", file);
      } else if (commProfile.avatar?.startsWith("data:image/")) {
        form.set("avatar", commProfile.avatar);
      }

      const res = await fetch("/api/community/messages", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = (await res.json()) as {
        error?: string;
        message?: CommunityMessage;
      };
      if (!res.ok) throw new Error(data.error || "Не отправилось");
      trackEvent("community_post");
      setText("");
      setReplyTo(null);
      clearPendingMedia();
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
      const raw = err instanceof Error ? err.message : "Ошибка";
      setError(
        /load failed|failed to fetch|networkerror|network error|fetch/i.test(
          raw,
        )
          ? "Не отправилось — сеть или файл слишком большой. Запишите кружок короче."
          : raw,
      );
    } finally {
      setBusy(false);
    }
  }

  const needSetup = ready && canPost && (!commProfile || editingProfile);
  const myAvatarUrl =
    myKey && messages.find((m) => m.authorKey === myKey)?.avatarUrl
      ? `/api/community/avatar/${myKey}`
      : myKey
        ? `/api/community/avatar/${myKey}`
        : undefined;

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        …
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
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
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-medium text-muted hover:bg-accent-soft hover:text-foreground"
          >
            <Avatar
              name={commProfile.nick}
              avatarUrl={commProfile.avatar || myAvatarUrl}
              authorKey={myKey || "me"}
              mine
              size={28}
            />
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
                onClick={() => avatarFileRef.current?.click()}
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
                ref={avatarFileRef}
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
              onClick={() => void finishSetup()}
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
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-none px-3 py-3 sm:px-4"
          >
            {messages.map((m) => {
              const mine = Boolean(myKey && m.authorKey === myKey);
              const isMaya = m.authorKey === "maya";
              const avatarUrl =
                m.avatarUrl ||
                (mine && commProfile?.avatar
                  ? commProfile.avatar
                  : undefined);
              const reactionEntries = Object.entries(m.reactions || {}).filter(
                ([, keys]) => keys.length > 0,
              );
              const open = menu?.id === m.id;
              return (
                <article
                  key={m.id}
                  data-msg-id={m.id}
                  onContextMenu={(e) => onMsgContextMenu(e, m.id)}
                  onPointerDown={(e) => onMsgPointerDown(e, m.id)}
                  onPointerMove={onMsgPointerMove}
                  onPointerUp={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onClickCapture={(e) => {
                    if (!suppressClick.current) return;
                    e.preventDefault();
                    e.stopPropagation();
                    suppressClick.current = false;
                  }}
                  className={`flex max-w-[88%] gap-2 select-none [-webkit-touch-callout:none] ${
                    mine ? "ml-auto flex-row-reverse" : "mr-auto"
                  }`}
                >
                  {!mine && (
                    <Avatar
                      name={m.displayName}
                      avatarUrl={avatarUrl}
                      authorKey={m.authorKey}
                    />
                  )}
                  <div
                    className={`min-w-0 rounded-2xl px-3 py-2 transition-shadow ${
                      isMaya
                        ? "border border-accent/20 bg-accent-soft/60"
                        : mine
                          ? "bg-user-bubble"
                          : "bg-card ring-1 ring-line/80"
                    } ${
                      open || flashId === m.id
                        ? "ring-2 ring-accent/70"
                        : ""
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
                    {m.replyTo && (
                      <button
                        type="button"
                        onClick={() => jumpToMessage(m.replyTo!.id)}
                        className="mt-0.5 mb-1 w-full rounded-lg border-l-[3px] border-accent/70 bg-black/5 px-2 py-1 text-left dark:bg-white/5"
                      >
                        <p className="truncate text-[11px] font-semibold text-accent">
                          {m.replyTo.displayName || "Сообщение"}
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          {m.replyTo.text}
                        </p>
                      </button>
                    )}
                    {m.mediaUrl && (
                      <MessageMedia kind={m.mediaKind} url={m.mediaUrl} />
                    )}
                    {m.text &&
                      !(
                        m.mediaUrl &&
                        (m.text === "📷 фото" ||
                          m.text === "🎬 видео" ||
                          m.text === "🎥 кружок" ||
                          m.text === "🎤 голосовое")
                      ) && (
                        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug text-foreground">
                          {m.text}
                        </p>
                      )}
                    {reactionEntries.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {reactionEntries.map(([emoji, keys]) => {
                          const mineReact = Boolean(
                            myKey && keys.includes(myKey),
                          );
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => void toggleReact(m.id, emoji)}
                              className={`rounded-full px-1.5 py-0.5 text-[12px] leading-none ${
                                mineReact
                                  ? "bg-accent/20 ring-1 ring-accent/40"
                                  : "bg-black/5 dark:bg-white/10"
                              }`}
                            >
                              {emoji} {keys.length}
                            </button>
                          );
                        })}
                      </div>
                    )}
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

          <div className="shrink-0 border-t border-line bg-card/95 px-3 pt-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {!canPost ? (
              <div className="rounded-xl bg-accent-soft/50 px-3 py-2.5 text-sm">
                <Link
                  href="/profile"
                  className="font-semibold text-accent underline"
                >
                  Войдите
                </Link>
                <span className="text-muted">, чтобы писать</span>
              </div>
            ) : (
              <>
                {replyTo && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-background px-2 py-1.5">
                    <div className="min-w-0 flex-1 border-l-[3px] border-accent pl-2">
                      <p className="truncate text-[11px] font-semibold text-accent">
                        {replyTo.displayName}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {mediaPreviewText(replyTo.mediaKind, replyTo.text) ||
                          replyTo.text}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-accent-soft"
                      aria-label="Отменить ответ"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {pendingPreview && pendingKind && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-background px-2 py-1.5">
                    {pendingKind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pendingPreview}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : pendingKind === "circle" ? (
                      <video
                        src={pendingPreview}
                        className="h-14 w-14 rounded-full object-cover ring-2 ring-accent/40"
                        muted
                        playsInline
                        autoPlay
                        loop
                      />
                    ) : pendingKind === "voice" ? (
                      <div className="flex h-12 min-w-[4.5rem] items-center px-2 text-xs text-muted">
                        Голосовое
                      </div>
                    ) : (
                      <video
                        src={pendingPreview}
                        className="h-12 w-16 rounded-lg object-cover"
                        muted
                      />
                    )}
                    <p className="min-w-0 flex-1 text-xs text-muted">
                      {pendingKind === "image"
                        ? "Фото"
                        : pendingKind === "circle"
                          ? "Кружок"
                          : pendingKind === "voice"
                            ? "Голосовое"
                            : "Видео"}{" "}
                      готово к отправке
                    </p>
                    <button
                      type="button"
                      onClick={clearPendingMedia}
                      className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-accent-soft"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <form
                  onSubmit={(e) => void send(e)}
                  className="flex items-end gap-1.5"
                >
                  <input
                    ref={mediaFileRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) =>
                      void onPickMedia(e.target.files?.[0] ?? null)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => mediaFileRef.current?.click()}
                    className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-accent-soft hover:text-foreground"
                    aria-label="Фото или видео"
                    title="Фото / видео"
                  >
                    <MayaIcon name="moments" size={18} />
                  </button>
                  <button
                    type="button"
                    {...holdRecord.bindHold("circle")}
                    disabled={busy || !!holdRecord.active}
                    className="flex h-11 w-10 shrink-0 touch-none select-none items-center justify-center rounded-xl text-muted hover:bg-accent-soft hover:text-foreground disabled:opacity-40"
                    aria-label="Зажмите — записать кружок"
                    title="Зажмите — кружок"
                  >
                    <MayaIcon name="videonote" size={18} />
                  </button>
                  <button
                    type="button"
                    {...holdRecord.bindHold("voice")}
                    disabled={busy || !!holdRecord.active}
                    className="flex h-11 w-10 shrink-0 touch-none select-none items-center justify-center rounded-xl text-muted hover:bg-accent-soft hover:text-foreground disabled:opacity-40"
                    aria-label="Зажмите — голосовое"
                    title="Зажмите — голосовое"
                  >
                    <MayaIcon name="mic" size={18} />
                  </button>
                  <textarea
                    ref={composerRef}
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 500))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={1}
                    placeholder={replyTo ? "Ответ" : "Сообщение"}
                    className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-line bg-background px-3.5 py-2.5 text-base text-foreground outline-none focus:border-accent/40"
                  />
                  <button
                    type="submit"
                    disabled={busy || (!text.trim() && !pendingFile)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-[var(--on-accent,#fff)] disabled:opacity-40"
                    aria-label="Отправить"
                  >
                    <MayaIcon name="chat" size={18} />
                  </button>
                </form>
              </>
            )}
            {error && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-300">
                {error}
              </p>
            )}
          </div>
        </>
      )}

      {menu &&
        createPortal(
        <div
          className="fixed inset-0 z-[80]"
          onClick={() => {
            if (Date.now() - menuOpenedAt.current < 450) return;
            setMenu(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (Date.now() - menuOpenedAt.current < 450) return;
            setMenu(null);
          }}
        >
          <div
            role="menu"
            className="absolute w-[236px] overflow-hidden rounded-2xl bg-card shadow-[0_12px_40px_rgba(0,0,0,0.22)] ring-1 ring-line"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-8 gap-0 px-1.5 py-1.5">
              {COMMUNITY_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-8 items-center justify-center rounded-lg text-[17px] hover:bg-accent-soft"
                  onClick={() => {
                    void toggleReact(menu.id, emoji);
                    setMenu(null);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="border-t border-line py-1">
              <button
                type="button"
                className="flex w-full px-3.5 py-2 text-left text-[15px] text-foreground hover:bg-accent-soft"
                onClick={() => {
                  const m = messages.find((x) => x.id === menu.id);
                  if (m) startReply(m);
                  setMenu(null);
                }}
              >
                Ответить
              </button>
              <button
                type="button"
                className="flex w-full px-3.5 py-2 text-left text-[15px] text-foreground hover:bg-accent-soft"
                onClick={() => {
                  const m = messages.find((x) => x.id === menu.id);
                  if (m) void copyMsg(m);
                  setMenu(null);
                }}
              >
                Копировать
              </button>
              {Boolean(myKey && messages.find((x) => x.id === menu.id)?.authorKey === myKey) && (
                <button
                  type="button"
                  className="flex w-full px-3.5 py-2 text-left text-[15px] text-red-600 hover:bg-accent-soft dark:text-red-300"
                  onClick={() => {
                    const id = menu.id;
                    setMenu(null);
                    void deleteMsg(id);
                  }}
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      <HoldRecordOverlay
        active={holdRecord.active}
        cancelHint={holdRecord.cancelHint}
        secs={holdRecord.secs}
        liveRef={holdRecord.liveRef}
        onFlipCamera={
          holdRecord.active === "circle"
            ? () => void holdRecord.flipCamera()
            : undefined
        }
      />
    </div>
  );
}
