/**
 * Генератор шума через Web Audio API (без файлов).
 * Singleton — переживает навигацию по приложению.
 */

export type NoiseKind = "white" | "pink" | "brown" | "rain";

export const NOISE_PRESETS: {
  id: NoiseKind;
  label: string;
  hint: string;
}[] = [
  { id: "white", label: "Белый", hint: "ровный мягкий фон" },
  { id: "pink", label: "Розовый", hint: "спокойнее, для сна" },
  { id: "brown", label: "Глубокий", hint: "низкий, как вентилятор" },
  { id: "rain", label: "Дождь", hint: "мягкий дождик за окном" },
];

type EngineState = {
  playing: boolean;
  kind: NoiseKind;
  volume: number;
  endsAt: number | null;
};

type Listener = (s: EngineState) => void;

class NoiseEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private rainLfo: OscillatorNode | null = null;
  private rainGain: GainNode | null = null;
  private timerId: number | null = null;
  private kind: NoiseKind = "pink";
  private volume = 0.45;
  private playing = false;
  private endsAt: number | null = null;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  snapshot(): EngineState {
    return {
      playing: this.playing,
      kind: this.kind,
      volume: this.volume,
      endsAt: this.endsAt,
    };
  }

  private emit() {
    const s = this.snapshot();
    this.listeners.forEach((fn) => fn(s));
  }

  private async ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.volume;
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 14000;
      this.filter.connect(this.gain);
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  private makeBuffer(kind: NoiseKind): AudioBuffer {
    const ctx = this.ctx!;
    const seconds = 2;
    const rate = ctx.sampleRate;
    const len = rate * seconds;
    const buffer = ctx.createBuffer(1, len, rate);
    const data = buffer.getChannelData(0);

    if (kind === "white" || kind === "rain") {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } else if (kind === "pink") {
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] =
          (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    }

    // лёгкий fade на стыках петли
    const fade = Math.min(256, Math.floor(len / 20));
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] *= t;
      data[len - 1 - i] *= t;
    }
    return buffer;
  }

  private applyKindFilter(kind: NoiseKind) {
    if (!this.filter || !this.ctx) return;
    if (kind === "rain") {
      this.filter.type = "bandpass";
      this.filter.frequency.value = 900;
      this.filter.Q.value = 0.55;
    } else if (kind === "brown") {
      this.filter.type = "lowpass";
      this.filter.frequency.value = 400;
      this.filter.Q.value = 0.7;
    } else if (kind === "pink") {
      this.filter.type = "lowpass";
      this.filter.frequency.value = 2800;
      this.filter.Q.value = 0.5;
    } else {
      this.filter.type = "lowpass";
      this.filter.frequency.value = 9000;
      this.filter.Q.value = 0.4;
    }
  }

  private stopNodes() {
    try {
      this.source?.stop();
    } catch {
      /* already stopped */
    }
    this.source?.disconnect();
    this.source = null;
    try {
      this.rainLfo?.stop();
    } catch {
      /* */
    }
    this.rainLfo?.disconnect();
    this.rainLfo = null;
    this.rainGain?.disconnect();
    this.rainGain = null;
  }

  private startNodes(kind: NoiseKind) {
    if (!this.ctx || !this.filter || !this.gain) return;
    this.applyKindFilter(kind);
    const buffer = this.makeBuffer(kind);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    if (kind === "rain") {
      const rainGain = this.ctx.createGain();
      rainGain.gain.value = 0.9;
      src.connect(rainGain);
      rainGain.connect(this.filter);
      this.rainGain = rainGain;
    } else {
      src.connect(this.filter);
    }

    src.start();
    this.source = src;
  }

  async play(opts?: { kind?: NoiseKind; volume?: number; minutes?: number | null }) {
    if (opts?.kind) this.kind = opts.kind;
    if (opts?.volume != null) this.volume = clamp(opts.volume, 0, 1);
    await this.ensureCtx();
    if (!this.gain) return;

    this.stopNodes();
    this.gain.gain.setTargetAtTime(this.volume, this.ctx!.currentTime, 0.05);
    this.startNodes(this.kind);
    this.playing = true;

    if (opts && "minutes" in opts) {
      this.setTimer(opts.minutes ?? null);
    }

    this.emit();
  }

  stop() {
    this.clearTimer();
    this.endsAt = null;
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
    window.setTimeout(() => this.stopNodes(), 200);
    this.playing = false;
    this.emit();
  }

  async toggle() {
    if (this.playing) this.stop();
    else await this.play();
  }

  async setKind(kind: NoiseKind) {
    this.kind = kind;
    if (this.playing) await this.play({ kind });
    else this.emit();
  }

  setVolume(v: number) {
    this.volume = clamp(v, 0, 1);
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
    }
    this.emit();
  }

  /** minutes = null → без таймера */
  setTimer(minutes: number | null) {
    this.clearTimer();
    if (minutes == null || minutes <= 0) {
      this.endsAt = null;
      this.emit();
      return;
    }
    this.endsAt = Date.now() + minutes * 60_000;
    this.timerId = window.setTimeout(() => {
      this.timerId = null;
      this.endsAt = null;
      this.stop();
    }, minutes * 60_000);
    this.emit();
  }

  private clearTimer() {
    if (this.timerId != null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

export const noiseEngine = new NoiseEngine();
