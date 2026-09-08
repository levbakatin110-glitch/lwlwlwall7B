type JournalEntryLike = {
  id?: string;
  createdAt?: string;
  date?: string;
  value?: string;
  fields?: Record<string, unknown>;
};

function entryKey(e: JournalEntryLike): string | null {
  if (typeof e.id === "string" && e.id.trim()) return e.id;
  const start = Number(e.fields?.startMs);
  const created = e.createdAt || "";
  if (Number.isFinite(start) && start > 0) return `t:${start}`;
  if (created) return `c:${created}:${String(e.value || "")}`;
  return null;
}

function newer(a: JournalEntryLike, b: JournalEntryLike): JournalEntryLike {
  const ta = Date.parse(String(a.createdAt || "")) || 0;
  const tb = Date.parse(String(b.createdAt || "")) || 0;
  return tb >= ta ? b : a;
}

export function mergeJournalList(
  a: JournalEntryLike[] | undefined,
  b: JournalEntryLike[] | undefined,
): JournalEntryLike[] {
  const map = new Map<string, JournalEntryLike>();
  for (const e of [...(a ?? []), ...(b ?? [])]) {
    if (!e || typeof e !== "object") continue;
    const key = entryKey(e);
    if (!key) continue;
    const prev = map.get(key);
    map.set(key, prev ? newer(prev, e) : e);
  }
  return [...map.values()].sort((x, y) => {
    const tx = Date.parse(String(x.createdAt || "")) || 0;
    const ty = Date.parse(String(y.createdAt || "")) || 0;
    return ty - tx;
  });
}

export function mergeJournalDict(
  a: Record<string, JournalEntryLike[]> | undefined,
  b: Record<string, JournalEntryLike[]> | undefined,
): Record<string, JournalEntryLike[]> {
  const keys = new Set([
    ...Object.keys(a ?? {}),
    ...Object.keys(b ?? {}),
  ]);
  const out: Record<string, JournalEntryLike[]> = {};
  for (const key of keys) {
    out[key] = mergeJournalList(a?.[key], b?.[key]);
  }
  return out;
}

type SpaceLike = {
  journals?: Record<string, JournalEntryLike[]>;
  [k: string]: unknown;
};

export function mergeChildSpaces(
  a: Record<string, SpaceLike> | undefined,
  b: Record<string, SpaceLike> | undefined,
): Record<string, SpaceLike> {
  const ids = new Set([
    ...Object.keys(a ?? {}),
    ...Object.keys(b ?? {}),
  ]);
  const out: Record<string, SpaceLike> = {};
  for (const id of ids) {
    const left = a?.[id];
    const right = b?.[id];
    out[id] = {
      ...(left ?? {}),
      ...(right ?? {}),
      journals: mergeJournalDict(left?.journals, right?.journals),
    };
  }
  return out;
}

/** Склеить облако и телефон: записи не выкидываем, только объединяем. */
export function mergeBackupData(
  current: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (!current) return incoming;
  return {
    ...current,
    ...incoming,
    momJournals: mergeJournalDict(
      current.momJournals as Record<string, JournalEntryLike[]> | undefined,
      incoming.momJournals as Record<string, JournalEntryLike[]> | undefined,
    ),
    childSpaces: mergeChildSpaces(
      current.childSpaces as Record<string, SpaceLike> | undefined,
      incoming.childSpaces as Record<string, SpaceLike> | undefined,
    ),
  };
}

export function journalEntryCount(
  journals: Record<string, unknown[] | undefined> | undefined,
): number {
  let n = 0;
  for (const list of Object.values(journals ?? {})) {
    if (Array.isArray(list)) n += list.length;
  }
  return n;
}
