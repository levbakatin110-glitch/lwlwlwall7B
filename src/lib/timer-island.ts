import { formatDuration } from "@/lib/diary-day";
import type { IslandTarget } from "@/lib/live-timer-actions";
import { islandElapsedSec } from "@/lib/live-timer-actions";

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
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private playing: Playing | null = null;
  private handlers: IslandHandlers = {};
  private posTimer: number | null = null;
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

  /** Вызвать в том же клике, что и «старт» — иначе iPhone не пустит звук. */
  unlock() {
    if (typeof window === "undefined") return;
    void this.ensureCtx();
  }

  snapshot() {
    return this.playing;
  }

  async sync(target: IslandTarget | null) {
    if (!target) {
      if (this.playing) this.teardown(false);
      return;
    }
    const same =
      this.playing &&
      this.playing.target.id === target.id &&
      this.playing.target.startedAt === target.startedAt &&
      this.playing.target.title === target.title;
    if (!this.playing || this.playing.target.id !== target.id) {
      this.playing = { target, paused: Boolean(target.paused) };
      if (!this.playing.paused) await this.ensureAudio();
      this.bindMedia();
      this.refreshMedia();
      this.emit();
      return;
    }
    this.playing.target = target;
    if (target.paused && !this.playing.paused) {
      this.playing.paused = true;
      this.suspendAudio();
      this.refreshMedia();
      this.emit();
      return;
    }
    if (!target.paused && this.playing.paused) {
      this.playing.paused = false;
      await this.ensureAudio();
      this.refreshMedia();
      this.emit();
      return;
    }
    if (!same) this.refreshMedia();
    else this.updatePosition();
  }

  async pauseFromUi() {
    if (!this.playing || this.playing.paused) return;
    this.playing = { ...this.playing, paused: true };
    this.suspendAudio();
    this.refreshMedia();
    this.emit();
    this.handlers.onPause?.();
  }

  async resumeFromUi() {
    if (!this.playing || !this.playing.paused) return;
    this.playing = { ...this.playing, paused: false };
    await this.ensureAudio();
    this.refreshMedia();
    this.emit();
    this.handlers.onPlay?.();
  }

  stopFromUi() {
    this.handlers.onStop?.();
    this.teardown(false);
  }

  private async ensureCtx() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  private async ensureAudio() {
    await this.ensureCtx();
    if (!this.ctx || this.source) return;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin((i / this.ctx.sampleRate) * 18 * Math.PI * 2) * 0.0004;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
    this.source = src;
    this.gain = gain;
  }

  private suspendAudio() {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* */
      }
      try {
        this.source.disconnect();
      } catch {
        /* */
      }
      this.source = null;
    }
    if (this.gain) {
      try {
        this.gain.disconnect();
      } catch {
        /* */
      }
      this.gain = null;
    }
  }

  private teardown(emit = true) {
    this.suspendAudio();
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
    if (emit) this.emit();
    else this.emit();
  }

  private bindMedia() {
    if (typeof navigator === "undefined" || !navigator.mediaSession) return;
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler("play", () => {
        void this.resumeFromUi();
      });
      ms.setActionHandler("pause", () => {
        void this.pauseFromUi();
      });
      ms.setActionHandler("stop", () => {
        this.stopFromUi();
      });
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
      this.posTimer = window.setInterval(() => this.updatePosition(), 1000);
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
      /* iOS иногда кидает, если position > duration */
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
}

export const timerIsland = new TimerIsland();
