"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAppleMobile } from "@/lib/media-mime";

const VOICE_MAX_MS = 60_000;
export const VOICE_MAX_UPLOAD_BYTES = 2_000_000;

function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const apple = isAppleMobile();
  const types = apple
    ? [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ]
    : [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function fmtSec(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function VoiceNotePlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    setBroken(false);
    setPlaying(false);
    setProgress(0);
    setDuration(0);

    const onTime = () => {
      if (a.duration && Number.isFinite(a.duration) && a.duration > 0) {
        setProgress(a.currentTime / a.duration);
        setDuration(a.duration * 1000);
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    const onError = () => setBroken(true);

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onError);
    };
  }, [url]);

  async function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    try {
      await a.play();
      setPlaying(true);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={broken}
      className="mt-1.5 flex w-[min(100%,16rem)] items-center gap-2.5 rounded-full bg-accent-soft/80 px-2.5 py-2 text-left disabled:opacity-60"
      aria-label={playing ? "Пауза" : "Слушать голосовое"}
    >
      <audio ref={audioRef} src={url} preload="metadata" playsInline />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[var(--on-accent,#fff)]">
        {broken ? (
          <span className="text-[10px] font-bold">!</span>
        ) : playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4.5" height="14" rx="1" />
            <rect x="13.5" y="5" width="4.5" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8.5 6.8v10.4L18 12 8.5 6.8z" />
          </svg>
        )}
      </span>
      <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </span>
      <span className="w-9 shrink-0 text-[11px] tabular-nums text-muted">
        {broken ? "—" : fmtSec(duration || 0)}
      </span>
    </button>
  );
}

type Props = {
  onCancel: () => void;
  onReady: (file: File) => void;
};

export function VoiceRecorder({ onCancel, onReady }: Props) {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const autoStarted = useRef(false);

  const [phase, setPhase] = useState<"booting" | "recording">("booting");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const onReadyRef = useRef(onReady);
  const onCancelRef = useRef(onCancel);
  onReadyRef.current = onReady;
  onCancelRef.current = onCancel;

  const finish = useCallback(
    (blob: Blob, mime: string) => {
      clearTick();
      stopTracks();
      const type = mime.startsWith("audio/")
        ? mime.split(";")[0]
        : mime.includes("mp4")
          ? "audio/mp4"
          : "audio/webm";
      const ext = type.includes("ogg")
        ? "ogg"
        : type.includes("mp4")
          ? "m4a"
          : "webm";
      const file = new File([blob], `voice.${ext}`, { type });
      if (file.size > VOICE_MAX_UPLOAD_BYTES) {
        setError("Слишком длинное голосовое — короче");
        setPhase("booting");
        return;
      }
      onReadyRef.current(file);
    },
    [clearTick, stopTracks],
  );

  const startRecord = useCallback(
    (stream: MediaStream) => {
      if (recorderRef.current?.state === "recording") return;
      chunksRef.current = [];
      const mime = pickAudioMime();
      let rec: MediaRecorder;
      try {
        rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch {
        setError("Запись недоступна в этом браузере");
        return;
      }
      recorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const raw = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: raw.split(";")[0] });
        const ms = Date.now() - startedAtRef.current;
        recorderRef.current = null;
        if (ms < 450) {
          stopTracks();
          onCancelRef.current();
          return;
        }
        finish(blob, raw);
      };
      rec.start(120);
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setPhase("recording");
      clearTick();
      tickRef.current = window.setInterval(() => {
        const ms = Date.now() - startedAtRef.current;
        if (ms >= VOICE_MAX_MS) {
          setElapsedMs(VOICE_MAX_MS);
          if (recorderRef.current?.state === "recording") recorderRef.current.stop();
          return;
        }
        setElapsedMs(ms);
      }, 80);
    },
    [clearTick, finish, stopTracks],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (!autoStarted.current) {
          autoStarted.current = true;
          startRecord(stream);
        }
      } catch {
        if (!cancelled) setError("Нет доступа к микрофону");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopRecord() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.stop();
  }

  function closeAll() {
    clearTick();
    if (recorderRef.current) {
      try {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = () => {
          recorderRef.current = null;
          stopTracks();
          onCancel();
        };
        if (recorderRef.current.state !== "inactive") recorderRef.current.stop();
        else {
          stopTracks();
          onCancel();
        }
      } catch {
        stopTracks();
        onCancel();
      }
      return;
    }
    stopTracks();
    onCancel();
  }

  const secs = Math.floor(elapsedMs / 1000);

  return (
    <div className="fixed inset-0 z-[220] flex flex-col justify-end bg-black/45">
      <div className="rounded-t-3xl border-t border-line bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Голосовое</p>
          <button
            type="button"
            onClick={closeAll}
            className="rounded-full px-3 py-1 text-sm text-muted"
          >
            Отмена
          </button>
        </div>
        {error ? (
          <p className="mb-4 text-sm text-red-600 dark:text-red-300">{error}</p>
        ) : (
          <p className="mb-4 text-center text-sm text-muted">
            {phase === "recording"
              ? "Идёт запись — нажмите, чтобы отправить"
              : "Открываем микрофон…"}
          </p>
        )}
        <div className="flex flex-col items-center gap-3">
          <p className="font-display text-2xl tabular-nums text-foreground">
            {String(Math.floor(secs / 60))}:{String(secs % 60).padStart(2, "0")}
          </p>
          <button
            type="button"
            disabled={!!error || phase !== "recording"}
            onClick={stopRecord}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ff4d6d] text-white disabled:opacity-40"
            aria-label="Остановить и отправить"
          >
            <span className="h-6 w-6 rounded-md bg-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
