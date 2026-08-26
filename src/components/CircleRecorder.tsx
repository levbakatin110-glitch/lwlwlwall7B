"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CIRCLE_MAX_MS = 30_000;
/** Жёсткий потолок под nginx/прокси (~1–3 МБ) */
export const CIRCLE_MAX_UPLOAD_BYTES = 2_800_000;

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
    return "video/webm;codecs=vp8,opus";
  }
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
    return "video/webm;codecs=vp9,opus";
  }
  if (MediaRecorder.isTypeSupported("video/webm")) return "video/webm";
  if (MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
  return "";
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
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.duration && Number.isFinite(v.duration)) {
        setProgress(v.currentTime / v.duration);
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      v.currentTime = 0;
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnd);
    };
  }, [url]);

  async function toggle() {
    const v = videoRef.current;
    if (!v) return;
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
        /* ignore */
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
          src={url}
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        {!playing && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8.5 6.8v10.4L18 12 8.5 6.8z" />
              </svg>
            </span>
          </span>
        )}
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

  const [phase, setPhase] = useState<"booting" | "live" | "recording" | "review">(
    "booting",
  );
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);
  const ownedPreviewRef = useRef<string | null>(null);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
      });
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
    if (phase === "recording") return;
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    setError(null);
    try {
      await attachStream(next);
      setPhase("live");
    } catch {
      setFacing(facing);
      setError("Не удалось переключить камеру");
    }
  }

  function startRecord() {
    const stream = streamRef.current;
    if (!stream || phase === "recording" || !camReady) return;
    setError(null);
    chunksRef.current = [];
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
      const rawType = rec.mimeType || mime || "video/webm";
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
  const mirror = facing === "user";

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
          disabled={phase === "recording" || phase === "booting" || !!reviewUrl}
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
                className={`h-full w-full object-cover ${mirror ? "scale-x-[-1]" : ""}`}
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
            : phase === "recording"
              ? "Нажмите ещё раз, чтобы закончить"
              : phase === "review"
                ? "Посмотрите и отправьте — или переснимите"
                : "Нажмите кнопку, чтобы начать запись"}
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
