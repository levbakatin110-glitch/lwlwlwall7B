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
 * Если только что отправили, не возвращаем слот в прошлое, иначе тик
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

export type JournalBag = Record<
  string,
  { fields?: Record<string, string | number>; createdAt?: string; date?: string }[]
>;

export type UsageCta = {
  moduleId: string;
  title: string;
  body: string;
  href: string;
  slot: "day" | "evening";
  kind?: CareReminderKind;
};

/** Короткие призывы. Шлём только если в этом дневнике уже есть записи. */
export const USAGE_CTAS: UsageCta[] = [
  {
    moduleId: "breastfeeding",
    title: "Мая · ГВ",
    body: "ГВ: запишите кормление.",
    href: "/m/breastfeeding",
    slot: "day",
    kind: "feed",
  },
  {
    moduleId: "formula",
    title: "Мая · смесь",
    body: "Смесь: запишите, сколько дали.",
    href: "/m/formula",
    slot: "day",
    kind: "feed",
  },
  {
    moduleId: "solids",
    title: "Мая · прикорм",
    body: "Прикорм: запишите, что ел малыш.",
    href: "/m/solids",
    slot: "day",
    kind: "feed",
  },
  {
    moduleId: "diaper",
    title: "Мая · подгузник",
    body: "Подгузник: отметьте смену.",
    href: "/m/diaper",
    slot: "day",
    kind: "diaper",
  },
  {
    moduleId: "walk",
    title: "Мая · прогулка",
    body: "Прогулка: отметьте, если были на улице.",
    href: "/m/walk",
    slot: "day",
    kind: "walk",
  },
  {
    moduleId: "water",
    title: "Мая · вода",
    body: "Вода: отметьте стакан, если выпили.",
    href: "/m/water",
    slot: "day",
    kind: "water",
  },
  {
    moduleId: "health",
    title: "Мая · здоровье",
    body: "Здоровье: запишите, как малыш.",
    href: "/m/health",
    slot: "day",
  },
  {
    moduleId: "growth",
    title: "Мая · рост и вес",
    body: "Рост и вес: внесите новые цифры.",
    href: "/m/growth",
    slot: "day",
  },
  {
    moduleId: "vaccines",
    title: "Мая · прививки",
    body: "Прививки: откройте календарь и сверьте.",
    href: "/m/vaccines",
    slot: "day",
  },
  {
    moduleId: "kicks",
    title: "Мая · шевеления",
    body: "Шевеления: запишите, как шевелится.",
    href: "/m/kicks",
    slot: "day",
  },
  {
    moduleId: "preg_meds",
    title: "Мая · лекарство",
    body: "Витамин: отметьте, если приняли.",
    href: "/m/preg_meds",
    slot: "day",
    kind: "meds",
  },
  {
    moduleId: "preg_symptoms",
    title: "Мая · самочувствие",
    body: "Самочувствие: запишите, как вы.",
    href: "/m/preg_symptoms",
    slot: "day",
  },
  {
    moduleId: "pregnancy",
    title: "Мая · беременность",
    body: "Беременность: откройте дневник дня.",
    href: "/m/pregnancy",
    slot: "day",
  },
  {
    moduleId: "sleep",
    title: "Мая · сон",
    body: "Сон малыша: запишите, как спал.",
    href: "/m/sleep",
    slot: "evening",
    kind: "sleep",
  },
  {
    moduleId: "preg_sleep",
    title: "Мая · сон",
    body: "Ваш сон: запишите, как спали.",
    href: "/m/preg_sleep",
    slot: "evening",
  },
  {
    moduleId: "notes",
    title: "Мая · заметки",
    body: "Заметки: коротко запишите день.",
    href: "/m/notes",
    slot: "evening",
  },
];

export const INDEPENDENT_CTAS: UsageCta[] = [
  {
    moduleId: "recipes",
    title: "Мая · рецепты",
    body: "Откройте рецепты и приготовьте что-нибудь.",
    href: "/recipes",
    slot: "day",
  },
  {
    moduleId: "maya",
    title: "Мая",
    body: "Напишите Мае. Спросите, что нужно.",
    href: "/",
    slot: "day",
  },
  {
    moduleId: "community",
    title: "Мая · круг мам",
    body: "Круг мам: напишите, как у вас, или почитайте других.",
    href: "/community",
    slot: "day",
  },
  {
    moduleId: "summary",
    title: "Мая · итоги дня",
    body: "Итоги дня: откройте и посмотрите, как прошёл день.",
    href: "/summary",
    slot: "evening",
  },
];

export const DAILY_PUSH_TARGET = 3;
export const DAILY_PUSH_TIMES = ["11:00", "15:30", "19:30"] as const;
export const WEEKLY_EXTRA_TIME = "13:00";
export const USAGE_DAY_AT = "12:00";
export const USAGE_EVENING_AT = "20:00";

const MAYA_CTA =
  INDEPENDENT_CTAS.find((c) => c.moduleId === "maya") ?? INDEPENDENT_CTAS[1];

export function ctaForModule(moduleId: string): UsageCta | undefined {
  return USAGE_CTAS.find((c) => c.moduleId === moduleId);
}

export function pickLastUsedModule(
  journals: JournalBag,
  moduleIds: string[],
): string | null {
  let bestId: string | null = null;
  let best = 0;
  for (const id of moduleIds) {
    const t = lastLogMs(journals, [id]);
    if (t && t > best) {
      best = t;
      bestId = id;
    }
  }
  return bestId;
}

export function pickFeedCta(
  journals: JournalBag,
  enabled: string[],
): UsageCta {
  const used = pickLastUsedModule(journals, LOG_MODULES.feed);
  if (used) return ctaForModule(used) ?? USAGE_CTAS[0];
  if (enabled.includes("formula") && !enabled.includes("breastfeeding")) {
    return ctaForModule("formula") ?? USAGE_CTAS[0];
  }
  if (enabled.includes("solids") && !enabled.includes("breastfeeding")) {
    return ctaForModule("solids") ?? USAGE_CTAS[0];
  }
  return ctaForModule("breastfeeding") ?? USAGE_CTAS[0];
}

function rotateList<T>(items: T[], offset: number): T[] {
  if (!items.length) return [];
  const n = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(n), ...items.slice(0, n)];
}

function localDayIndex(now: number, tzOffsetMin: number): number {
  const wall = wallClock(now, tzOffsetMin);
  return Math.floor(Date.UTC(wall.y, wall.m - 1, wall.d) / 86_400_000);
}

function localWeekday(now: number, tzOffsetMin: number): number {
  const wall = wallClock(now, tzOffsetMin);
  return new Date(Date.UTC(wall.y, wall.m - 1, wall.d)).getUTCDay();
}

function weeklyMayaWeekday(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h + ch.charCodeAt(0)) % 7;
  return h;
}

/** Дневники с записями. Выключенный тип в напоминаниях не берём. */
export function usedDiaryCtas(
  journals: JournalBag,
  reminders: { kind: CareReminderKind; enabled: boolean }[],
): UsageCta[] {
  const blocked = new Set<CareReminderKind>();
  for (const r of reminders) {
    if (!r.enabled) blocked.add(r.kind);
  }
  const used: { cta: UsageCta; at: number }[] = [];
  for (const cta of USAGE_CTAS) {
    if (cta.kind && blocked.has(cta.kind)) continue;
    const at = lastLogMs(journals, [cta.moduleId]);
    if (!at) continue;
    used.push({ cta, at });
  }
  used.sort((a, b) => b.at - a.at);
  return used.map((row) => row.cta);
}

export type DailyPushSlot = { cta: UsageCta; at: string };

/**
 * 3 пуша в день: сначала дневники, недостающее добиваем общими.
 * Если дневников много, раз в неделю четвёртый: «напишите Мае».
 */
export function planDailyPushes(
  journals: JournalBag,
  reminders: { kind: CareReminderKind; enabled: boolean }[],
  now: number,
  tzOffsetMin: number,
  seed = "maya",
): DailyPushSlot[] {
  const day = localDayIndex(now, tzOffsetMin);
  const diaries = rotateList(usedDiaryCtas(journals, reminders), day);
  const diaryPicks = diaries.slice(0, DAILY_PUSH_TARGET);
  const need = DAILY_PUSH_TARGET - diaryPicks.length;
  const taken = new Set(diaryPicks.map((c) => c.moduleId));
  const fillers = rotateList(INDEPENDENT_CTAS, day)
    .filter((c) => !taken.has(c.moduleId))
    .slice(0, need);
  const picks = [...diaryPicks, ...fillers];
  picks.sort((a, b) => {
    const ae = a.slot === "evening" ? 1 : 0;
    const be = b.slot === "evening" ? 1 : 0;
    return ae - be;
  });
  if (
    diaries.length >= DAILY_PUSH_TARGET &&
    localWeekday(now, tzOffsetMin) === weeklyMayaWeekday(seed) &&
    !picks.some((c) => c.moduleId === "maya")
  ) {
    picks.push(MAYA_CTA);
  }
  return picks.map((cta, i) => ({
    cta,
    at:
      i < DAILY_PUSH_TIMES.length
        ? DAILY_PUSH_TIMES[i]
        : WEEKLY_EXTRA_TIME,
  }));
}

export function ctaCopyForKind(
  kind: CareReminderKind,
  journals: JournalBag,
  enabled: string[],
): UsageCta | null {
  if (kind === "feed") return pickFeedCta(journals, enabled);
  if (kind === "custom") return null;
  const row = USAGE_CTAS.find((c) => c.kind === kind);
  return row ?? null;
}

export type CarePreset = {
  kind: CareReminderKind;
  label: string;
  hint: string;
  icon: string;
  defaultEnabled?: boolean;
};

/** Сами включаем только это, остальное мама добавит, если нужно. */
export const CORE_PUSH_KINDS: readonly CareReminderKind[] = ["feed", "sleep"];

export function ensureCoreCareReminders(
  reminders: CareReminder[] | undefined,
  hasChild: boolean,
): CareReminder[] {
  const next = [...(reminders ?? [])];
  if (!hasChild) return next;
  for (const kind of CORE_PUSH_KINDS) {
    if (next.some((r) => r.kind === kind)) continue;
    next.push({ ...defaultReminder(kind), enabled: true });
  }
  return next;
}

export const CARE_PRESETS: CarePreset[] = [
  {
    kind: "feed",
    label: "Кормление",
    hint: "Напомним, если давно не было записи в ГВ, смеси или прикорме.",
    icon: "feeding",
    defaultEnabled: true,
  },
  {
    kind: "sleep",
    label: "Укладывание",
    hint: "Вечером напомним отметить сон, если вы ведёте этот дневник.",
    icon: "sleep",
    defaultEnabled: true,
  },
  {
    kind: "wake",
    label: "Бодрствование",
    hint: "Если малыш давно не спал, мягко напомним про сон.",
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
      enabled: true,
      mode: "interval",
      intervalMin: 180,
      title: "Мая · кормление",
      body: "ГВ: запишите кормление.",
      href: "/m/breastfeeding",
      resetOnLog: true,
    };
  }
  if (kind === "sleep") {
    return {
      id,
      kind,
      enabled: true,
      mode: "times",
      times: [USAGE_EVENING_AT],
      title: "Мая · сон",
      body: "Сон малыша: запишите, как спал.",
      href: "/m/sleep",
      resetOnLog: true,
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
      body: "Сон малыша: запишите, как спал.",
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
      body: "Подгузник: отметьте смену.",
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
      body: "Прогулка: отметьте, если были на улице.",
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
      body: "Вода: отметьте стакан, если выпили.",
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
      body: "Витамин: отметьте, если приняли.",
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
