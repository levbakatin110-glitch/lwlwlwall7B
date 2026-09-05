import {
  islandElapsedSec,
  type IslandKind,
  type IslandTarget,
} from "@/lib/live-timer-actions";
import { formatLockClock } from "@/lib/timer-lock-art";

const ISLAND_ART: Record<IslandKind, string> = {
  sleep: "/icons/island-sleep.png?v=2",
  preg_sleep: "/icons/island-sleep.png?v=2",
  bf: "/icons/island-feeding.png?v=2",
  walk: "/icons/island-walk.png?v=2",
  contractions: "/icons/island-pulse.png?v=2",
  timer: "/icons/island-timer.png?v=2",
};

export type IslandHandlers = {
  onPause?: () => void;
  onPlay?: () => void;
  onStop?: () => void;
};

type Playing = {
  target: IslandTarget;
  paused: boolean;
};

const SW_URL = "/sw.js?v=17";
const KEEP_SRC = "/timer-keep.wav";

class TimerIsland {
  private el: HTMLAudioElement | null = null;
  private playing: Playing | null = null;
  private handlers: IslandHandlers = {};
  private posTimer: number | null = null;
  private visBound = false;
  private noticeTicks = 0;
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
    this.armAudioSession();
    const el = this.ensureEl();
    this.bindMedia();
    this.bindVisibility();
    this.refreshMedia();
    if (!this.playing.paused) {
      el.volume = 0.18;
      el.muted = false;
      const play = el.play();
      if (play) void play.catch(() => undefined);
    }
    this.askNoticeInGesture();
    this.emit();
  }

  /** Прогреть файл до тапа «Старт», чтобы play() в жесте не ждал сеть. */
  warmup() {
    if (typeof window === "undefined") return;
    this.armAudioSession();
    this.ensureEl().load();
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register(SW_URL).catch(() => undefined);
    }
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
    const el = document.createElement("audio");
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.setAttribute("x-webkit-airplay", "deny");
    el.loop = true;
    el.preload = "auto";
    el.controls = false;
    el.volume = 0.18;
    el.src = KEEP_SRC;
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    this.el = el;
    return el;
  }

  private bindVisibility() {
    if (this.visBound || typeof document === "undefined") return;
    this.visBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.applyMetadata();
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
    this.noticeTicks = 0;
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
      ms.setActionHandler("seekbackward", () => undefined);
      ms.setActionHandler("seekforward", () => undefined);
      ms.setActionHandler("previoustrack", () => undefined);
      ms.setActionHandler("nexttrack", () => undefined);
    } catch {
      /* старый Safari */
    }
  }

  private artwork(kind: IslandKind): MediaImage[] {
    const src = new URL(ISLAND_ART[kind], window.location.origin).href;
    return [{ src, sizes: "512x512", type: "image/png" }];
  }

  private applyMetadata() {
    if (typeof navigator === "undefined" || !navigator.mediaSession || !this.playing) {
      return;
    }
    const t = this.playing.target;
    const elapsed = islandElapsedSec(t);
    const clock = formatLockClock(elapsed);
    const paused = this.playing.paused;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: clock,
        artist: t.title,
        album: paused ? "пауза · Мая" : "идёт · Мая",
        artwork: this.artwork(t.id),
      });
      navigator.mediaSession.playbackState = paused ? "paused" : "playing";
    } catch {
      /* */
    }
    try {
      navigator.mediaSession.setPositionState?.({
        duration: elapsed + 1,
        playbackRate: 0,
        position: elapsed,
      });
    } catch {
      /* */
    }
  }

  private refreshMedia() {
    this.applyMetadata();
    if (this.posTimer == null) {
      this.posTimer = window.setInterval(() => {
        this.applyMetadata();
        if (typeof document !== "undefined" && document.hidden) {
          this.noticeTicks += 1;
          if (this.noticeTicks % 15 === 0) this.pushLockNotice();
        }
      }, 1000);
    }
  }

  private armAudioSession() {
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      /* */
    }
  }

  /** requestPermission должен стартовать в том же тапе, что и «Старт». */
  private askNoticeInGesture() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      try {
        const req = Notification.requestPermission();
        if (req && typeof req.then === "function") {
          void req.then(() => this.pushLockNotice());
        }
      } catch {
        /* */
      }
      return;
    }
    this.pushLockNotice();
  }

  private pushLockNotice() {
    if (typeof window === "undefined" || !this.playing) return;
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }
    const t = this.playing.target;
    const elapsed = islandElapsedSec(t);
    const clock = formatLockClock(elapsed);
    const title = clock;
    const url = t.href;
    const text = this.playing.paused
      ? `${t.title} · пауза · Мая`
      : `${t.title} · идёт · Мая`;
    void (async () => {
      try {
        if ("serviceWorker" in navigator) {
          await navigator.serviceWorker.register(SW_URL);
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, {
            body: text,
            tag: "maya-live-timer",
            silent: true,
            requireInteraction: true,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            data: { url },
            renotify: true,
          } as NotificationOptions);
          return;
        }
      } catch {
        /* */
      }
      try {
        new Notification(title, {
          body: text,
          tag: "maya-live-timer",
          silent: true,
          icon: "/icons/icon-192.png",
        });
      } catch {
        /* */
      }
    })();
  }

  private clearLockNotice() {
    void (async () => {
      try {
        const reg = await navigator.serviceWorker?.ready;
        const list = await reg?.getNotifications({ tag: "maya-live-timer" });
        for (const n of list ?? []) n.close();
      } catch {
        /* */
      }
    })();
  }
}

export const timerIsland = new TimerIsland();
