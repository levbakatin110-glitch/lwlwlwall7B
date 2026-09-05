/** Планы напоминаний: кормление, сон, подгузник и т.д. */

export type CareReminderKind =
  | "feed"
  | "sleep"
  | "wake"
  | "diaper"
  | "walk"
  | "water"
  | "meds"
  | "custom";

export type CareReminderMode = "interval" | "times";

export type CareReminder = {
  id: string;
  kind: CareReminderKind;
  enabled: boolean;
  mode: CareReminderMode;
  /** Интервал в минутах (для mode=interval) */
  intervalMin?: number;
  /** Часы «HH:MM» (для mode=times) */
  times?: string[];
  /** Тихие часы, например 22:00–07:00 */
  quietFrom?: string;
  quietTo?: string;
  title: string;
  body: string;
  href: string;
  /** Сдвигать таймер, когда в дневнике появилась запись */
  resetOnLog?: boolean;
};

export type ScheduledPushItem = {
  id: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  nextAt: number;
  mode: CareReminderMode | "once";
  intervalMin?: number;
  times?: string[];
  quietFrom?: string;
  quietTo?: string;
  tzOffsetMin: number;
};

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function parseHhMm(value: string | undefined): number | null {
  if (!value) return null;
  const m = TIME_RE.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatHhMm(mins: number): string {
  const n = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** getTimezoneOffset() клиента: UTC+8 → -480 */
export function wallClock(epochMs: number, tzOffsetMin: number): {
  mins: number;
  y: number;
  m: number;
  d: number;
} {
  const local = new Date(epochMs - tzOffsetMin * 60_000);
  return {
    mins: local.getUTCHours() * 60 + local.getUTCMinutes(),
    y: local.getUTCFullYear(),
    m: local.getUTCMonth() + 1,
    d: local.getUTCDate(),
  };
}

export function isQuietAt(
  epochMs: number,
  tzOffsetMin: number,
  quietFrom?: string,
  quietTo?: string,
): boolean {
  const from = parseHhMm(quietFrom);
  const to = parseHhMm(quietTo);
  if (from == null || to == null || from === to) return false;
  const mins = wallClock(epochMs, tzOffsetMin).mins;
  if (from < to) return mins >= from && mins < to;
  return mins >= from || mins < to;
}

/** Следующий момент после `afterMs`, который не попадает в тихие часы. */
export function skipQuiet(
  afterMs: number,
  tzOffsetMin: number,
  quietFrom?: string,
  quietTo?: string,
): number {
  if (!isQuietAt(afterMs, tzOffsetMin, quietFrom, quietTo)) return afterMs;
  const to = parseHhMm(quietTo);
  if (to == null) return afterMs;
  const wall = wallClock(afterMs, tzOffsetMin);
  let add = to - wall.mins;
  if (add <= 0) add += 1440;
  return afterMs + add * 60_000;
}

export function nextTimesAt(
  afterMs: number,
  times: string[],
  tzOffsetMin: number,
  quietFrom?: string,
  quietTo?: string,
): number {
  const parsed = times
    .map(parseHhMm)
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);
  if (!parsed.length) return afterMs + 24 * 60 * 60 * 1000;

  const wall = wallClock(afterMs + 15_000, tzOffsetMin);
  for (let day = 0; day < 8; day++) {
    const midnightUtc =
      Date.UTC(wall.y, wall.m - 1, wall.d + day) + tzOffsetMin * 60_000;
    for (const t of parsed) {
      const candidate = midnightUtc + t * 60_000;
      if (candidate <= afterMs) continue;
      if (isQuietAt(candidate, tzOffsetMin, quietFrom, quietTo)) continue;
      return candidate;
    }
  }
  return afterMs + 24 * 60 * 60 * 1000;
}

export function nextIntervalAt(
  afterMs: number,
  intervalMin: number,
  tzOffsetMin: number,
  quietFrom?: string,
  quietTo?: string,
): number {
  const step = Math.max(5, Math.min(24 * 60, Math.round(intervalMin || 180)));
  return skipQuiet(afterMs + step * 60_000, tzOffsetMin, quietFrom, quietTo);
}

/** Последнее попадание в часы из `times` не позже `now`. */
export function lastTimesAt(
  now: number,
  times: string[],
  tzOffsetMin: number,
  quietFrom?: string,
  quietTo?: string,
): number | null {
  const parsed = times
    .map(parseHhMm)
    .filter((n): n is number => n != null)
    .sort((a, b) => b - a);
  if (!parsed.length) return null;
  const wall = wallClock(now, tzOffsetMin);
  for (let day = 0; day >= -1; day--) {
    const midnightUtc =
      Date.UTC(wall.y, wall.m - 1, wall.d + day) + tzOffsetMin * 60_000;
    for (const t of parsed) {
      const candidate = midnightUtc + t * 60_000;
      if (candidate > now) continue;
      if (isQuietAt(candidate, tzOffsetMin, quietFrom, quietTo)) continue;
      return candidate;
    }
  }
  return null;
}

export function advanceAfterFire(
  item: Pick<
    ScheduledPushItem,
    | "mode"
    | "intervalMin"
    | "times"
    | "quietFrom"
    | "quietTo"
    | "tzOffsetMin"
  >,
  firedAt: number,
): number | null {
  if (item.mode === "once") return null;
  if (item.mode === "times") {
    return nextTimesAt(
      firedAt,
      item.times ?? [],
      item.tzOffsetMin,
      item.quietFrom,
      item.quietTo,
    );
  }
  return nextIntervalAt(
    firedAt,
    item.intervalMin ?? 180,
    item.tzOffsetMin,
    item.quietFrom,
    item.quietTo,
  );
}

/** Минимум между пушами одного напоминания: не пачка, если мама не открыла. */
export const MIN_PUSH_GAP_MS = 60 * 60_000;

export function minGapAfterFireMs(item: {
  mode: CareReminderMode | "once";
  intervalMin?: number;
}): number {
  if (item.mode === "once") return 24 * MIN_PUSH_GAP_MS;
  if (item.mode === "times") return 10 * 60 * 60_000;
  const intervalMs = Math.max(60, item.intervalMin ?? 180) * 60_000;
  return Math.max(MIN_PUSH_GAP_MS, intervalMs);
}

/**
 * Клиент каждые пару секунд заново шлёт nextAt «уже пора».
 * Если только что отправили — не возвращаем слот в прошлое, иначе тик
 * шлёт снова каждую минуту.
 */
export function resolveScheduleWrite(
  incoming: {
    nextAt: number;
    mode: CareReminderMode | "once";
    intervalMin?: number;
  },
  prev: { nextAt: number; lastSentAt: number | null } | null,
  now: number,
): { nextAt: number; lastSentAt: number | null } {
  if (!prev?.lastSentAt) {
    return { nextAt: incoming.nextAt, lastSentAt: null };
  }
  const gap = minGapAfterFireMs(incoming);
  if (incoming.nextAt > now + 30_000) {
    return { nextAt: incoming.nextAt, lastSentAt: prev.lastSentAt };
  }
  if (now - prev.lastSentAt < gap) {
    return {
      nextAt: Math.max(prev.nextAt, prev.lastSentAt + gap),
      lastSentAt: prev.lastSentAt,
    };
  }
  return { nextAt: incoming.nextAt, lastSentAt: prev.lastSentAt };
}

export function lastLogMs(
  journals: Record<string, { fields?: Record<string, string | number>; createdAt?: string; date?: string }[]>,
  moduleIds: string[],
): number | null {
  let best = 0;
  for (const id of moduleIds) {
    for (const e of journals[id] ?? []) {
      const end = Number(e.fields?.endMs);
      const start = Number(e.fields?.startMs);
      const created = e.createdAt ? Date.parse(e.createdAt) : NaN;
      const t = [end, start, created].find((n) => Number.isFinite(n) && n > 0);
      if (t && t > best) best = t;
    }
  }
  return best > 0 ? best : null;
}

export const LOG_MODULES: Record<CareReminderKind, string[]> = {
  feed: ["breastfeeding", "formula", "solids"],
  sleep: ["sleep"],
  wake: ["sleep"],
  diaper: ["diaper"],
  walk: ["walk"],
  water: ["water"],
  meds: ["preg_meds"],
  custom: [],
};

export type CarePreset = {
  kind: CareReminderKind;
  label: string;
  hint: string;
  icon: string;
  defaultEnabled?: boolean;
};

export const CARE_PRESETS: CarePreset[] = [
  {
    kind: "feed",
    label: "Кормление",
    hint: "Напомним, если давно не было записи в ГВ, смеси или прикорме.",
    icon: "feeding",
  },
  {
    kind: "sleep",
    label: "Укладывание",
    hint: "В выбранное время — «пора укладывать малыша».",
    icon: "sleep",
  },
  {
    kind: "wake",
    label: "Бодрствование",
    hint: "Если малыш давно не спал — мягко напомним про сон.",
    icon: "sleep",
  },
  {
    kind: "diaper",
    label: "Подгузник",
    hint: "По интервалу после последней смены.",
    icon: "diaper",
  },
  {
    kind: "walk",
    label: "Прогулка",
    hint: "В удобные часы, без ночных пинков.",
    icon: "walk",
  },
  {
    kind: "water",
    label: "Вода маме",
    hint: "Стакан воды в течение дня.",
    icon: "water",
  },
];

export function defaultReminder(kind: CareReminderKind): CareReminder {
  const id = `care-${kind}`;
  if (kind === "feed") {
    return {
      id,
      kind,
      enabled: false,
      mode: "interval",
      intervalMin: 180,
      title: "Мая · кормление",
      body: "Пора покормить малыша. Если уже покормили — отметьте в дневнике.",
      href: "/m/breastfeeding",
      resetOnLog: true,
    };
  }
  if (kind === "sleep") {
    return {
      id,
      kind,
      enabled: false,
      mode: "times",
      times: ["21:00"],
      title: "Мая · сон",
      body: "Пора укладывать малыша. Спокойной ночи вам обоим.",
      href: "/m/sleep",
    };
  }
  if (kind === "wake") {
    return {
      id,
      kind,
      enabled: false,
      mode: "interval",
      intervalMin: 120,
      title: "Мая · бодрствование",
      body: "Окно бодрствования подходит к концу — можно готовить ко сну.",
      href: "/m/sleep",
      resetOnLog: true,
    };
  }
  if (kind === "diaper") {
    return {
      id,
      kind,
      enabled: false,
      mode: "interval",
      intervalMin: 180,
      title: "Мая · подгузник",
      body: "Проверьте подгузник у малыша.",
      href: "/m/diaper",
      resetOnLog: true,
    };
  }
  if (kind === "walk") {
    return {
      id,
      kind,
      enabled: false,
      mode: "times",
      times: ["11:00"],
      quietFrom: "21:00",
      quietTo: "08:00",
      title: "Мая · прогулка",
      body: "Время прогулки, если получится выйти.",
      href: "/m/walk",
    };
  }
  if (kind === "water") {
    return {
      id,
      kind,
      enabled: false,
      mode: "interval",
      intervalMin: 120,
      quietFrom: "22:00",
      quietTo: "08:00",
      title: "Мая · вода",
      body: "Напоминание: стакан воды для вас.",
      href: "/m/water",
    };
  }
  if (kind === "meds") {
    return {
      id,
      kind,
      enabled: false,
      mode: "times",
      times: ["09:00"],
      title: "Мая · лекарство",
      body: "Напоминание про витамин или препарат.",
      href: "/m/preg_meds",
    };
  }
  return {
    id: `care-custom-${Date.now().toString(36)}`,
    kind: "custom",
    enabled: true,
    mode: "times",
    times: ["10:00"],
    title: "Мая",
    body: "Напоминание",
    href: "/reminders",
  };
}

export function computeNextAt(
  reminder: CareReminder,
  now: number,
  tzOffsetMin: number,
  lastLog: number | null,
): number {
  if (reminder.mode === "times") {
    const recent = lastTimesAt(
      now,
      reminder.times ?? [],
      tzOffsetMin,
      reminder.quietFrom,
      reminder.quietTo,
    );
    if (recent != null && now - recent <= 2 * 60 * 60_000) return recent;
    return nextTimesAt(
      now,
      reminder.times ?? [],
      tzOffsetMin,
      reminder.quietFrom,
      reminder.quietTo,
    );
  }
  const interval = reminder.intervalMin ?? 180;
  if (
    reminder.resetOnLog &&
    lastLog &&
    lastLog > now - 14 * 24 * 60 * 60 * 1000
  ) {
    return nextIntervalAt(
      lastLog,
      interval,
      tzOffsetMin,
      reminder.quietFrom,
      reminder.quietTo,
    );
  }
  return nextIntervalAt(
    now,
    interval,
    tzOffsetMin,
    reminder.quietFrom,
    reminder.quietTo,
  );
}

export function sanitizeReminder(raw: unknown): CareReminder | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<CareReminder>;
  const kind = r.kind;
  if (
    kind !== "feed" &&
    kind !== "sleep" &&
    kind !== "wake" &&
    kind !== "diaper" &&
    kind !== "walk" &&
    kind !== "water" &&
    kind !== "meds" &&
    kind !== "custom"
  ) {
    return null;
  }
  const id = typeof r.id === "string" && r.id.trim() ? r.id.trim().slice(0, 80) : `care-${kind}`;
  const mode: CareReminderMode = r.mode === "times" ? "times" : "interval";
  const times = Array.isArray(r.times)
    ? r.times.filter((t) => parseHhMm(String(t)) != null).map(String).slice(0, 8)
    : undefined;
  const intervalMin = Math.max(
    15,
    Math.min(24 * 60, Math.round(Number(r.intervalMin) || 180)),
  );
  const title = String(r.title || "Мая").slice(0, 80);
  const body = String(r.body || "Напоминание").slice(0, 200);
  const href = String(r.href || "/").slice(0, 120);
  return {
    id,
    kind,
    enabled: Boolean(r.enabled),
    mode,
    intervalMin: mode === "interval" ? intervalMin : undefined,
    times: mode === "times" ? (times?.length ? times : ["21:00"]) : undefined,
    quietFrom: parseHhMm(r.quietFrom) != null ? r.quietFrom : undefined,
    quietTo: parseHhMm(r.quietTo) != null ? r.quietTo : undefined,
    title,
    body,
    href: href.startsWith("/") ? href : `/${href}`,
    resetOnLog: Boolean(r.resetOnLog),
  };
}
