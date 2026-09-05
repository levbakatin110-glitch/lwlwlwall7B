import { formatDuration } from "@/lib/diary-day";
import type { IslandTarget } from "@/lib/live-timer-actions";
import { islandElapsedSec } from "@/lib/live-timer-actions";
import { buildQuietLoopWav } from "@/lib/quiet-loop-wav";

export type IslandHandlers = {
  onPause?: () => void;
  onPlay?: () => void;
  onStop?: () => void;
};

type Playing = {
  target: IslandTarget;
  paused: boolean;
};

const POSITION_DURATION = 12 * 60 * 60;

class TimerIsland {
  private el: HTMLAudioElement | null = null;
  private srcUrl: string | null = null;
  private playing: Playing | null = null;
  private handlers: IslandHandlers = {};
  private posTimer: number | null = null;
  private visBound = false;
  private listeners = new Set<(p: Playing | null) => void>();

  subscribe(fn: (p: Playing | null) => void) {
    this.listeners.add(fn);
    fn(this.playing);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    const snap = this.playing;
    this.listeners.forEach((fn) => fn(snap));
  }

  setHandlers(h: IslandHandlers) {
    this.handlers = h;
    this.bindMedia();
  }

  /**
   * Запустить плеер в том же тапе, что и «сон».
   * Без этого iPhone не рисует островок и заставку.
   */
  begin(target: IslandTarget) {
    if (typeof window === "undefined") return;
    this.playing = { target, paused: Boolean(target.paused) };
    const el = this.ensureEl();
    this.bindMedia();
    this.bindVisibility();
    this.refreshMedia();
    if (!this.playing.paused) {
      el.volume = 0.05;
      el.muted = false;
      void el.play().catch(() => {
        /* жест уже мог потеряться при повторном sync */
      });
    }
    this.pushLockNotice();
    this.emit();
  }

  /** Доиграть / разбудить плеер в жесте (пауза, возврат на экран). */
  unlock() {
    if (typeof window === "undefined") return;
    const el = this.ensureEl();
    el.muted = false;
    void el.play().catch(() => undefined);
  }

  snapshot() {
    return this.playing;
  }

  sync(target: IslandTarget | null) {
    if (!target) {
      this.teardown();
      return;
    }
    if (!this.playing) {
      this.playing = { target, paused: Boolean(target.paused) };
      this.bindMedia();
      this.refreshMedia();
      if (!target.paused) this.unlock();
      this.pushLockNotice();
      this.emit();
      return;
    }
    this.playing.target = target;
    if (target.paused && !this.playing.paused) {
      this.playing.paused = true;
      this.el?.pause();
      this.refreshMedia();
      this.pushLockNotice();
      this.emit();
      return;
    }
    if (!target.paused && this.playing.paused) {
      this.playing.paused = false;
      this.unlock();
      this.refreshMedia();
      this.pushLockNotice();
      this.emit();
      return;
    }
    this.refreshMedia();
  }

  pauseFromUi() {
    if (!this.playing || this.playing.paused) return;
    this.playing = { ...this.playing, paused: true };
    this.el?.pause();
    this.refreshMedia();
    this.pushLockNotice();
    this.emit();
    this.handlers.onPause?.();
  }

  resumeFromUi() {
    if (!this.playing || !this.playing.paused) return;
    this.playing = { ...this.playing, paused: false };
    this.unlock();
    this.refreshMedia();
    this.pushLockNotice();
    this.emit();
    this.handlers.onPlay?.();
  }

  stopFromUi() {
    this.handlers.onStop?.();
    this.teardown();
  }

  private ensureEl(): HTMLAudioElement {
    if (this.el) return this.el;
    if (!this.srcUrl) {
      this.srcUrl = URL.createObjectURL(buildQuietLoopWav());
    }
    const el = document.createElement("audio");
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.setAttribute("x-webkit-airplay", "deny");
    el.loop = true;
    el.preload = "auto";
    el.controls = false;
    el.volume = 0.05;
    el.src = this.srcUrl;
    el.style.position = "fixed";
    el.style.left = "-9999px";
    el.style.width = "1px";
    el.style.height = "1px";
    document.body.appendChild(el);
    this.el = el;
    return el;
  }

  private bindVisibility() {
    if (this.visBound || typeof document === "undefined") return;
    this.visBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.pushLockNotice();
        return;
      }
      if (this.playing && !this.playing.paused) this.unlock();
    });
  }

  private teardown() {
    this.el?.pause();
    if (this.posTimer != null) {
      window.clearInterval(this.posTimer);
      this.posTimer = null;
    }
    this.playing = null;
    if (typeof navigator !== "undefined" && navigator.mediaSession) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      } catch {
        /* */
      }
    }
    this.clearLockNotice();
    this.emit();
  }

  private bindMedia() {
    if (typeof navigator === "undefined" || !navigator.mediaSession) return;
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler("play", () => this.resumeFromUi());
      ms.setActionHandler("pause", () => this.pauseFromUi());
      ms.setActionHandler("stop", () => this.stopFromUi());
    } catch {
      /* старый Safari */
    }
  }

  private artwork(): MediaImage[] {
    return [
      {
        src: new URL("/icons/icon-192.png", window.location.origin).href,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: new URL("/icons/icon-512.png", window.location.origin).href,
        sizes: "512x512",
        type: "image/png",
      },
    ];
  }

  private refreshMedia() {
    if (typeof navigator === "undefined" || !navigator.mediaSession || !this.playing) {
      return;
    }
    const t = this.playing.target;
    const elapsed = islandElapsedSec(t);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: "Мая",
        album: formatDuration(elapsed),
        artwork: this.artwork(),
      });
      navigator.mediaSession.playbackState = this.playing.paused
        ? "paused"
        : "playing";
    } catch {
      /* */
    }
    this.updatePosition();
    if (this.posTimer == null) {
      this.posTimer = window.setInterval(() => {
        this.updatePosition();
        this.pushLockNotice();
      }, 5000);
    }
  }

  private updatePosition() {
    if (!this.playing || typeof navigator === "undefined") return;
    const elapsed = islandElapsedSec(this.playing.target);
    try {
      navigator.mediaSession?.setPositionState?.({
        duration: POSITION_DURATION,
        playbackRate: this.playing.paused ? 0 : 1,
        position: Math.min(elapsed, POSITION_DURATION - 1),
      });
    } catch {
      /* */
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.playing.target.title,
        artist: "Мая",
        album: formatDuration(elapsed),
        artwork: this.artwork(),
      });
    } catch {
      /* */
    }
  }

  private pushLockNotice() {
    if (typeof window === "undefined" || !this.playing) return;
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }
    const t = this.playing.target;
    const elapsed = islandElapsedSec(t);
    const body = this.playing.paused
      ? `${formatDuration(elapsed)} · пауза`
      : formatDuration(elapsed);
    const payload = {
      type: "LIVE_TIMER",
      title: t.title,
      body: `${body} · Мая`,
      url: t.href,
    };
    try {
      const ready = navigator.serviceWorker?.controller;
      if (ready) {
        ready.postMessage(payload);
        return;
      }
    } catch {
      /* */
    }
    try {
      new Notification(t.title, {
        body: `${body} · Мая`,
        tag: "maya-live-timer",
        silent: true,
        icon: "/icons/icon-192.png",
      });
    } catch {
      /* */
    }
  }

  private clearLockNotice() {
    try {
      navigator.serviceWorker?.controller?.postMessage({ type: "LIVE_TIMER_CLEAR" });
    } catch {
      /* */
    }
  }
}

export const timerIsland = new TimerIsland();
