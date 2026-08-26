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

type MediaKind = "image" | "video" | "circle";

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
    return (
      <div className="mt-1.5 flex justify-center">
        <video
          src={url}
          controls
          playsInline
          className="h-44 w-44 rounded-full border-2 border-accent/30 object-cover bg-black"
        />
      </div>
    );
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
  const [circleOpen, setCircleOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      stopCircleStream();
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!accountEmail || !avatar?.startsWith("data:image/")) return;
    try {
      await fetch("/api/community/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: accountEmail, avatar }),
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
    await syncAvatarToServer(setupAvatar);
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

  function stopCircleStream() {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    recorderRef.current?.stop();
    recorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setRecording(false);
    setRecordSecs(0);
  }

  async function openCircle() {
    setError(null);
    setCircleOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user", width: 480, height: 480 },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCircleOpen(false);
      setError("Нет доступа к камере");
    }
  }

  function startCircleRecord() {
    const stream = mediaStreamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";
    const rec = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    recorderRef.current = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: rec.mimeType || "video/webm",
      });
      const file = new File([blob], "circle.webm", {
        type: blob.type || "video/webm",
      });
      clearPendingMedia();
      setPendingFile(file);
      setPendingKind("circle");
      setPendingPreview(URL.createObjectURL(blob));
      stopCircleStream();
      setCircleOpen(false);
    };
    rec.start(200);
    setRecording(true);
    setRecordSecs(0);
    recordTimerRef.current = window.setInterval(() => {
      setRecordSecs((s) => {
        if (s >= 59) {
          rec.stop();
          return 60;
        }
        return s + 1;
      });
    }, 1000);
  }

  function stopCircleRecord() {
    recorderRef.current?.stop();
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!emailVerified || !accountEmail || !commProfile) return;
    const body = text.trim();
    if ((!body && !pendingFile) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("email", accountEmail);
      form.set("displayName", commProfile.nick);
      form.set("text", body);
      const tag = buildBabyTag(commProfile.babyName, commProfile.babyBirth);
      if (tag) form.set("babyTag", tag);
      if (commProfile.avatar) form.set("avatar", commProfile.avatar);
      if (pendingFile && pendingKind) {
        form.set("mediaKind", pendingKind);
        form.set("file", pendingFile);
      }

      const res = await fetch("/api/community/messages", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        error?: string;
        message?: CommunityMessage;
      };
      if (!res.ok) throw new Error(data.error || "Не отправилось");
      setText("");
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
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const canPost = Boolean(emailVerified && accountEmail);
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
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3 sm:px-4"
          >
            {messages.map((m) => {
              const mine = Boolean(myKey && m.authorKey === myKey);
              const isMaya = m.authorKey === "maya";
              const avatarUrl =
                m.avatarUrl ||
                (mine && commProfile?.avatar
                  ? commProfile.avatar
                  : undefined);
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
                      avatarUrl={avatarUrl}
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
                    {m.mediaUrl && (
                      <MessageMedia kind={m.mediaKind} url={m.mediaUrl} />
                    )}
                    {m.text &&
                      !(
                        m.mediaUrl &&
                        (m.text === "📷 фото" ||
                          m.text === "🎬 видео" ||
                          m.text === "🎥 кружок")
                      ) && (
                        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug text-foreground">
                          {m.text}
                        </p>
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

          <div className="shrink-0 border-t border-line bg-card/95 px-3 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
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
                        className="h-12 w-12 rounded-full object-cover"
                        muted
                      />
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
                    onClick={() => void openCircle()}
                    className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-accent-soft hover:text-foreground"
                    aria-label="Записать кружок"
                    title="Кружок"
                  >
                    <MayaIcon name="circle" size={18} />
                  </button>
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

      {circleOpen && (
        <div className="fixed inset-0 z-[220] flex flex-col bg-black/90 px-4 py-6 text-white">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium">Кружок</p>
            <button
              type="button"
              onClick={() => {
                stopCircleStream();
                setCircleOpen(false);
              }}
              className="rounded-xl px-3 py-1.5 text-sm text-white/80"
            >
              Закрыть
            </button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="relative h-64 w-64 overflow-hidden rounded-full border-4 border-accent/50 bg-black">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-full w-full scale-x-[-1] object-cover"
              />
            </div>
            <p className="text-sm text-white/70">
              {recording ? `${recordSecs} с · до 60` : "Нажмите запись"}
            </p>
            {!recording ? (
              <button
                type="button"
                onClick={startCircleRecord}
                className="h-16 w-16 rounded-full border-4 border-white bg-accent"
                aria-label="Начать запись"
              />
            ) : (
              <button
                type="button"
                onClick={stopCircleRecord}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-red-500"
                aria-label="Стоп"
              >
                <span className="h-5 w-5 rounded-sm bg-white" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
