"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFacingAvStream, getFacingVideoTrack } from "@/lib/camera-facing";
import { isAppleMobile, isWebmUnsupported } from "@/lib/media-mime";

const CIRCLE_MAX_MS = 30_000;
/** Жёсткий потолок под nginx/прокси (~1–3 МБ) */
export const CIRCLE_MAX_UPLOAD_BYTES = 2_800_000;

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const apple = isAppleMobile();
  const candidates = apple
    ? [
        "video/mp4",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9,opus",
        "video/webm",
      ]
    : [
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9,opus",
        "video/webm",
        "video/mp4",
      ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function ProgressRing({
  progress,
  tone = "idle",
}: {
  progress: number;
  tone?: "idle" | "rec" | "play";
}) {
  const size = 100;
  const stroke = 2.4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  const strokeColor =
    tone === "rec"
      ? "#ff4d6d"
      : tone === "play"
        ? "var(--accent)"
        : "rgba(255,255,255,0.92)";
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - p)}
        style={{ transition: "stroke-dashoffset 80ms linear" }}
      />
    </svg>
  );
}

export function CircleNotePlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [broken, setBroken] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    setBroken(false);
    setPlaying(false);
    setProgress(0);

    const onTime = () => {
      if (v.duration && Number.isFinite(v.duration)) {
        setProgress(v.currentTime / v.duration);
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
    };
    const onError = () => {
      if (!cancelled) setBroken(true);
    };

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    v.addEventListener("error", onError);

    void (async () => {
      try {
        // Полный blob обходит кривые Range у части прокси/Safari
        const res = await fetch(url, {
          credentials: "same-origin",
          cache: reloadKey > 0 ? "reload" : "default",
        });
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        if (cancelled || blob.size < 64) throw new Error("empty");
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        const obj = URL.createObjectURL(blob);
        blobUrlRef.current = obj;
        v.src = obj;
        v.load();
      } catch {
        if (cancelled) return;
        // fallback на прямой URL
        try {
          v.src = url;
          v.load();
        } catch {
          setBroken(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnd);
      v.removeEventListener("error", onError);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [url, reloadKey]);

  async function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (broken) {
      setBroken(false);
      setReloadKey((k) => k + 1);
      return;
    }
    if (playing) {
      v.pause();
      setPlaying(false);
      return;
    }
    try {
      v.muted = false;
      await v.play();
      setPlaying(true);
    } catch {
      try {
        v.muted = true;
        await v.play();
        setPlaying(true);
      } catch {
        setBroken(true);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      className="maya-circle-note relative mx-auto mt-1.5 block h-44 w-44 shrink-0 overflow-visible"
      aria-label={playing ? "Пауза кружка" : "Смотреть кружок"}
    >
      <ProgressRing
        progress={progress || (playing ? 0.01 : 0)}
        tone="play"
      />
      <span className="absolute inset-[7px] overflow-hidden rounded-full bg-black shadow-[0_8px_28px_rgba(0,0,0,0.35)] ring-1 ring-white/15">
        <video
          ref={videoRef}
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
        />
        {broken ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/70 px-3 text-center text-[11px] leading-snug text-white/85">
            {isWebmUnsupported()
              ? "Кружок ещё готовится — нажмите ещё раз через пару секунд"
              : "Не удалось открыть — нажмите ещё раз"}
          </span>
        ) : !playing ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8.5 6.8v10.4L18 12 8.5 6.8z" />
              </svg>
            </span>
          </span>
        ) : null}
      </span>
    </button>
  );
}

type Props = {
  onCancel: () => void;
  onReady: (file: File, previewUrl: string) => void;
};

export function CircleRecorder({ onCancel, onReady }: Props) {
  const liveRef = useRef<HTMLVideoElement>(null);
  const reviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const facingRef = useRef<"user" | "environment">("user");
  const flippingRef = useRef(false);

  const [phase, setPhase] = useState<"booting" | "live" | "recording" | "review">(
    "booting",
  );
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [flipping, setFlipping] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);
  const ownedPreviewRef = useRef<string | null>(null);
  const didAutoStart = useRef(false);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (liveRef.current) liveRef.current.srcObject = null;
  }, []);

  const attachStream = useCallback(
    async (mode: "user" | "environment") => {
      stopTracks();
      setCamReady(false);
      const stream = await getFacingAvStream(mode, { width: 480, height: 480 });
      streamRef.current = stream;
      facingRef.current = mode;
      const video = liveRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        await video.play();
      }
      setCamReady(true);
    },
    [stopTracks],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await attachStream("user");
        if (!cancelled) setPhase("live");
      } catch {
        if (!cancelled) {
          setError("Нет доступа к камере или микрофону");
          setPhase("live");
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTick();
      if (recorderRef.current) {
        try {
          recorderRef.current.ondataavailable = null;
          recorderRef.current.onstop = null;
          if (recorderRef.current.state !== "inactive") recorderRef.current.stop();
        } catch {
          /* ignore */
        }
        recorderRef.current = null;
      }
      stopTracks();
    };
  }, [attachStream, clearTick, stopTracks]);

  useEffect(() => {
    return () => {
      if (ownedPreviewRef.current) {
        URL.revokeObjectURL(ownedPreviewRef.current);
        ownedPreviewRef.current = null;
      }
    };
  }, []);

  function revokeOwnedPreview() {
    if (ownedPreviewRef.current) {
      URL.revokeObjectURL(ownedPreviewRef.current);
      ownedPreviewRef.current = null;
    }
    setReviewUrl(null);
  }

  async function flipCamera() {
    if (
      flippingRef.current ||
      phase === "booting" ||
      phase === "review" ||
      !streamRef.current
    ) {
      return;
    }
    const next = facingRef.current === "user" ? "environment" : "user";
    flippingRef.current = true;
    setFlipping(true);
    setError(null);

    const wasRecording = phase === "recording";
    const stream = streamRef.current;

    try {
      // 1) applyConstraints — без нового getUserMedia
      const old = stream.getVideoTracks()[0];
      if (old) {
        try {
          await old.applyConstraints({ facingMode: { exact: next } });
          facingRef.current = next;
          setFacing(next);
          return;
        } catch {
          /* fall through */
        }
      }

      // 2) новый видеотрек + замена
      const newTrack = await getFacingVideoTrack(next, {
        width: 480,
        height: 480,
      });
      if (old) {
        stream.removeTrack(old);
        old.stop();
      }
      stream.addTrack(newTrack);
      facingRef.current = next;
      setFacing(next);

      if (liveRef.current) {
        liveRef.current.srcObject = stream;
        liveRef.current.muted = true;
        await liveRef.current.play().catch(() => undefined);
      }

      // replaceTrack ломает WebM — перезапускаем MediaRecorder
      if (wasRecording && recorderRef.current) {
        try {
          const rec = recorderRef.current;
          rec.ondataavailable = null;
          rec.onstop = null;
          if (rec.state !== "inactive") rec.stop();
        } catch {
          /* ignore */
        }
        recorderRef.current = null;
        chunksRef.current = [];
        beginRecorderOnStream(stream);
      }
    } catch {
      setError("Не удалось переключить камеру");
    } finally {
      flippingRef.current = false;
      setFlipping(false);
    }
  }

  function beginRecorderOnStream(stream: MediaStream) {
    const mime = pickMime();
    let rec: MediaRecorder;
    const opts: MediaRecorderOptions = mime ? { mimeType: mime } : {};
    opts.videoBitsPerSecond = 420_000;
    opts.audioBitsPerSecond = 48_000;
    try {
      rec = new MediaRecorder(stream, opts);
    } catch {
      try {
        rec = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
      } catch {
        setError("Запись недоступна в этом браузере");
        return;
      }
    }
    recorderRef.current = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      clearTick();
      const rawType =
        rec.mimeType || mime || (isAppleMobile() ? "video/mp4" : "video/webm");
      const type = rawType.startsWith("video/")
        ? rawType.split(";")[0]
        : "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `circle.${ext}`, { type });
      if (file.size > CIRCLE_MAX_UPLOAD_BYTES) {
        setError("Слишком тяжёлый кружок — запишите короче (до 15–20 сек)");
      }
      const url = URL.createObjectURL(blob);
      setReviewFile(file);
      if (ownedPreviewRef.current) URL.revokeObjectURL(ownedPreviewRef.current);
      ownedPreviewRef.current = url;
      setReviewUrl(url);
      stopTracks();
      setPhase("review");
      setElapsedMs(0);
      window.setTimeout(() => {
        const v = reviewRef.current;
        if (!v) return;
        v.currentTime = 0;
        void v.play().catch(() => undefined);
      }, 60);
    };
    rec.start(120);
  }

  function startRecord() {
    const stream = streamRef.current;
    if (!stream || phase === "recording" || !camReady) return;
    setError(null);
    chunksRef.current = [];
    beginRecorderOnStream(stream);
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setPhase("recording");
    clearTick();
    tickRef.current = window.setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      if (ms >= CIRCLE_MAX_MS) {
        setElapsedMs(CIRCLE_MAX_MS);
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        return;
      }
      setElapsedMs(ms);
    }, 80);
  }

  useEffect(() => {
    if (phase !== "live" || !camReady || error || didAutoStart.current) return;
    didAutoStart.current = true;
    startRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, camReady, error]);

  function stopRecord() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;
    const ms = Date.now() - startedAtRef.current;
    if (ms < 450) {
      try {
        rec.ondataavailable = null;
        rec.onstop = () => {
          clearTick();
          recorderRef.current = null;
          setPhase("live");
          setElapsedMs(0);
        };
        rec.stop();
      } catch {
        setPhase("live");
      }
      return;
    }
    rec.stop();
  }

  function discardReview() {
    revokeOwnedPreview();
    setReviewFile(null);
    setElapsedMs(0);
    setError(null);
    didAutoStart.current = false;
    void attachStream(facingRef.current)
      .then(() => setPhase("live"))
      .catch(() => {
        setError("Не удалось снова открыть камеру");
        setPhase("live");
      });
  }

  function acceptReview() {
    if (!reviewFile || !reviewUrl) return;
    if (reviewFile.size > CIRCLE_MAX_UPLOAD_BYTES) {
      setError("Слишком тяжёлый кружок — переснимите короче");
      return;
    }
    const file = reviewFile;
    const url = reviewUrl;
    ownedPreviewRef.current = null;
    setReviewFile(null);
    setReviewUrl(null);
    onReady(file, url);
  }

  function closeAll() {
    clearTick();
    if (recorderRef.current) {
      try {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;
        if (recorderRef.current.state !== "inactive") recorderRef.current.stop();
      } catch {
        /* ignore */
      }
      recorderRef.current = null;
    }
    stopTracks();
    revokeOwnedPreview();
    onCancel();
  }

  const progress = phase === "recording" ? elapsedMs / CIRCLE_MAX_MS : 0;
  const secs = Math.floor(elapsedMs / 1000);

  return (
    <div className="maya-circle-recorder fixed inset-0 z-[220] flex flex-col text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#2a1520_0%,#0a0709_72%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,transparent_28%,transparent_70%,rgba(0,0,0,0.55)_100%)]" />

      <header className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={closeAll}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md"
          aria-label="Закрыть"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-[13px] font-semibold tracking-wide">Кружок</p>
          <p className="text-[11px] text-white/55">до 30 секунд</p>
        </div>
        <button
          type="button"
          onClick={() => void flipCamera()}
          disabled={phase === "booting" || phase === "review" || flipping}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md disabled:opacity-35"
          aria-label="Перевернуть камеру"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="M16 4l2.2 2.2H18a4 4 0 014 4v1M8 20l-2.2-2.2H6a4 4 0 01-4-4v-1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        </button>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5">
        <div
          className={`maya-circle-stage relative h-[min(78vw,20rem)] w-[min(78vw,20rem)] ${
            phase === "recording" ? "maya-circle-recording" : ""
          }`}
        >
          <ProgressRing
            progress={
              phase === "recording"
                ? Math.max(progress, 0.02)
                : phase === "review"
                  ? 1
                  : 0
            }
            tone={phase === "recording" ? "rec" : phase === "review" ? "play" : "idle"}
          />

          <div className="absolute inset-[10px] overflow-hidden rounded-full bg-black shadow-[0_20px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
            {phase !== "review" ? (
              <video
                ref={liveRef}
                muted
                playsInline
                autoPlay
                className="h-full w-full object-cover"
              />
            ) : (
              <video
                ref={reviewRef}
                src={reviewUrl ?? undefined}
                playsInline
                loop
                autoPlay
                className="h-full w-full object-cover"
              />
            )}
            {(phase === "booting" || (!camReady && phase === "live")) && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white/70">
                Открываем камеру…
              </div>
            )}
          </div>

          {phase === "recording" && (
            <div className="absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-[12px] font-semibold tracking-wide backdrop-blur-md">
              <span className="maya-circle-rec-dot h-2 w-2 rounded-full bg-[#ff4d6d]" />
              {String(Math.floor(secs / 60)).padStart(1, "0")}:
              {String(secs % 60).padStart(2, "0")}
            </div>
          )}
        </div>

        <p className="mt-6 min-h-[1.25rem] text-center text-[13px] text-white/65">
          {error
            ? error
            : flipping
              ? "Переключаем камеру…"
              : phase === "recording"
                ? "Нажмите ещё раз, чтобы закончить · сверху — камера"
                : phase === "review"
                  ? "Посмотрите и отправьте — или переснимите"
                  : "Запись уже идёт"}
        </p>
      </div>

      <footer className="relative z-10 flex items-center justify-center gap-8 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
        {phase === "review" ? (
          <>
            <button
              type="button"
              onClick={discardReview}
              className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur-md"
            >
              Переснять
            </button>
            <button
              type="button"
              onClick={acceptReview}
              disabled={
                !reviewFile || reviewFile.size > CIRCLE_MAX_UPLOAD_BYTES
              }
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-[var(--on-accent,#fff)] shadow-[0_10px_30px_rgba(232,90,140,0.35)] disabled:opacity-40"
            >
              Готово
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!!error || phase === "booting" || !camReady}
            onClick={() => {
              if (phase === "recording") stopRecord();
              else startRecord();
            }}
            className="maya-circle-shutter relative flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full disabled:opacity-40"
            aria-label={phase === "recording" ? "Остановить запись" : "Начать запись"}
          >
            <span className="absolute inset-0 rounded-full border-[3px] border-white/90" />
            <span
              className={`relative transition-all duration-200 ${
                phase === "recording"
                  ? "h-7 w-7 rounded-md bg-[#ff4d6d]"
                  : "h-[3.35rem] w-[3.35rem] rounded-full bg-accent"
              }`}
            />
          </button>
        )}
      </footer>
    </div>
  );
}
