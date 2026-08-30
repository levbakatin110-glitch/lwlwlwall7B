"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { CIRCLE_MAX_UPLOAD_BYTES } from "@/components/CircleRecorder";
import { VOICE_MAX_UPLOAD_BYTES } from "@/components/VoiceRecorder";
import { isAppleMobile } from "@/lib/media-mime";

export type HoldRecordKind = "voice" | "circle";

function pickVideoMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const apple = isAppleMobile();
  const candidates = apple
    ? ["video/mp4", "video/webm;codecs=vp8,opus", "video/webm"]
    : ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const apple = isAppleMobile();
  const types = apple
    ? ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

type Options = {
  onReady: (file: File, kind: HoldRecordKind) => void;
  onError: (message: string) => void;
};

export function useHoldMediaRecord({ onReady, onError }: Options) {
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const liveRef = useRef<HTMLVideoElement | null>(null);
  const cancelRef = useRef(false);
  const activeKindRef = useRef<HoldRecordKind | null>(null);
  const startYRef = useRef(0);
  const facingRef = useRef<"user" | "environment">("user");
  const flippingRef = useRef(false);

  const [active, setActive] = useState<HoldRecordKind | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [cancelHint, setCancelHint] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");

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

  const cleanup = useCallback(() => {
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
    chunksRef.current = [];
    activeKindRef.current = null;
    cancelRef.current = false;
    setCancelHint(false);
    setActive(null);
    setElapsedMs(0);
  }, [clearTick, stopTracks]);

  const finishBlob = useCallback(
    (kind: HoldRecordKind, blob: Blob, mime: string) => {
      const cleanMime = mime.split(";")[0] || mime;
      if (kind === "voice") {
        const type = cleanMime.startsWith("audio/")
          ? cleanMime
          : cleanMime.includes("mp4")
            ? "audio/mp4"
            : "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `voice.${ext}`, { type });
        if (file.size > VOICE_MAX_UPLOAD_BYTES) {
          onErrorRef.current("Голосовое слишком длинное — короче");
          return;
        }
        onReadyRef.current(file, "voice");
        return;
      }

      const type = cleanMime.startsWith("video/")
        ? cleanMime
        : isAppleMobile()
          ? "video/mp4"
          : "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `circle.${ext}`, { type });
      if (file.size > CIRCLE_MAX_UPLOAD_BYTES) {
        onErrorRef.current("Кружок слишком большой — короче");
        return;
      }
      onReadyRef.current(file, "circle");
    },
    [],
  );

  const stopRecording = useCallback(
    (send: boolean) => {
      const kind = activeKindRef.current;
      const rec = recorderRef.current;
      if (!kind || !rec) {
        cleanup();
        return;
      }

      if (!send || cancelRef.current) {
        try {
          rec.ondataavailable = null;
          rec.onstop = () => cleanup();
          if (rec.state === "recording") rec.stop();
          else cleanup();
        } catch {
          cleanup();
        }
        return;
      }

      rec.onstop = () => {
        const mime =
          rec.mimeType ||
          (kind === "voice" ? pickAudioMime() : pickVideoMime()) ||
          (kind === "voice" ? "audio/webm" : "video/webm");
        const ms = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, {
          type: mime.split(";")[0] || mime,
        });
        cleanup();
        if (ms < 450 || blob.size < 80) return;
        finishBlob(kind, blob, mime);
      };

      try {
        if (rec.state === "recording") rec.stop();
        else cleanup();
      } catch {
        cleanup();
      }
    },
    [cleanup, finishBlob],
  );

  const beginRecorder = useCallback((stream: MediaStream, kind: HoldRecordKind) => {
    const mime = kind === "voice" ? pickAudioMime() : pickVideoMime();
    let rec: MediaRecorder;
    try {
      rec = mime
        ? new MediaRecorder(stream, {
            mimeType: mime,
            ...(kind === "circle"
              ? { videoBitsPerSecond: 420_000, audioBitsPerSecond: 48_000 }
              : {}),
          })
        : new MediaRecorder(stream);
    } catch {
      rec = new MediaRecorder(stream);
    }
    recorderRef.current = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.start(120);
  }, []);

  const flipCamera = useCallback(async () => {
    if (activeKindRef.current !== "circle" || flippingRef.current) return;
    flippingRef.current = true;
    const next = facingRef.current === "user" ? "environment" : "user";
    try {
      const rec = recorderRef.current;
      if (rec && rec.state === "recording") {
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          rec.stop();
        });
        recorderRef.current = null;
      }

      const oldStream = streamRef.current;
      const audioTracks = oldStream ? [...oldStream.getAudioTracks()] : [];
      oldStream?.getVideoTracks().forEach((track) => {
        oldStream.removeTrack(track);
        track.stop();
      });

      const videoOnly = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: next },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
      });
      const videoTrack = videoOnly.getVideoTracks()[0];
      videoOnly.getAudioTracks().forEach((t) => t.stop());

      const combined = new MediaStream([...audioTracks, videoTrack]);
      streamRef.current = combined;
      facingRef.current = next;
      setFacing(next);

      if (liveRef.current) {
        liveRef.current.srcObject = combined;
        liveRef.current.muted = true;
        await liveRef.current.play().catch(() => undefined);
      }

      beginRecorder(combined, "circle");
    } catch {
      onErrorRef.current("Не удалось переключить камеру");
    } finally {
      flippingRef.current = false;
    }
  }, [beginRecorder]);

  const startRecording = useCallback(
    async (kind: HoldRecordKind) => {
      if (activeKindRef.current) return;
      activeKindRef.current = kind;
      setActive(kind);
      setElapsedMs(0);
      cancelRef.current = false;
      setCancelHint(false);
      chunksRef.current = [];

      try {
        const stream =
          kind === "circle"
            ? await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: {
                  facingMode: { ideal: facingRef.current },
                  width: { ideal: 480 },
                  height: { ideal: 480 },
                },
              })
            : await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
              });
        streamRef.current = stream;

        if (kind === "circle" && liveRef.current) {
          const video = liveRef.current;
          video.srcObject = stream;
          video.muted = true;
          await video.play().catch(() => undefined);
        }

        beginRecorder(stream, kind);
        startedAtRef.current = Date.now();
        clearTick();
        tickRef.current = window.setInterval(() => {
          const ms = Date.now() - startedAtRef.current;
          setElapsedMs(ms);
          const maxMs = kind === "circle" ? 30_000 : 60_000;
          if (ms >= maxMs) stopRecording(true);
        }, 80);
      } catch {
        cleanup();
        onErrorRef.current(
          kind === "circle"
            ? "Нет доступа к камере или микрофону"
            : "Нет доступа к микрофону",
        );
      }
    },
    [beginRecorder, cleanup, clearTick, stopRecording],
  );

  const bindHold = useCallback(
    (kind: HoldRecordKind) => ({
      onPointerDown: (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        startYRef.current = e.clientY;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        void startRecording(kind);
      },
      onPointerMove: (e: PointerEvent) => {
        if (!activeKindRef.current) return;
        const slideUp = startYRef.current - e.clientY > 72;
        cancelRef.current = slideUp;
        setCancelHint(slideUp);
      },
      onPointerUp: (e: PointerEvent) => {
        e.preventDefault();
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        stopRecording(true);
      },
      onPointerCancel: () => {
        stopRecording(false);
      },
    }),
    [startRecording, stopRecording],
  );

  useEffect(() => () => cleanup(), [cleanup]);

  const secs = Math.floor(elapsedMs / 1000);

  return {
    active,
    elapsedMs,
    cancelHint,
    secs,
    facing,
    liveRef,
    bindHold,
    flipCamera,
    stopRecording,
  };
}

export function HoldRecordOverlay({
  active,
  cancelHint,
  secs,
  liveRef,
  onFlipCamera,
}: {
  active: HoldRecordKind | null;
  cancelHint: boolean;
  secs: number;
  liveRef: RefObject<HTMLVideoElement | null>;
  onFlipCamera?: () => void;
}) {
  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/55 px-6 backdrop-blur-sm">
      {active === "circle" ? (
        <div className="relative h-44 w-44 overflow-visible">
          <div className="relative h-full w-full overflow-hidden rounded-full bg-black ring-2 ring-white/25">
            <video
              ref={liveRef}
              muted
              playsInline
              autoPlay
              className="h-full w-full object-cover"
            />
          </div>
          {onFlipCamera && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                void onFlipCamera();
              }}
              className="pointer-events-auto absolute -right-1 -top-1 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/25 backdrop-blur-md"
              aria-label="Переключить камеру"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path
                  d="M16 4l2.2 2.2H18a4 4 0 014 4v1M8 20l-2.2-2.2H6a4 4 0 01-4-4v-1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3.2" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-[var(--on-accent,#fff)] shadow-lg">
          <span className="maya-circle-rec-dot h-4 w-4 rounded-full bg-white" />
        </div>
      )}
      <p className="mt-5 text-center text-sm font-medium text-white">
        {cancelHint
          ? "Отпустите — отмена"
          : active === "circle"
            ? "Кружок · отпустите, чтобы отправить"
            : "Голосовое · отпустите, чтобы отправить"}
      </p>
      <p className="mt-1 font-mono text-xs text-white/70">
        {String(Math.floor(secs / 60))}:{String(secs % 60).padStart(2, "0")}
      </p>
      <p className="mt-3 text-center text-[11px] text-white/55">
        {active === "circle"
          ? "Другим пальцем — перевернуть камеру · вверх — отмена"
          : "Потяните вверх, чтобы отменить"}
      </p>
    </div>
  );
}
