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
  messages?: unknown[];
  [k: string]: unknown;
};

export type ChildLike = {
  id?: string;
  name?: string;
  birthDate?: string;
  [k: string]: unknown;
};

function mergeOneSpace(
  left: SpaceLike | undefined,
  right: SpaceLike | undefined,
): SpaceLike {
  const leftMsg = Array.isArray(left?.messages) ? left.messages : [];
  const rightMsg = Array.isArray(right?.messages) ? right.messages : [];
  return {
    ...(left ?? {}),
    ...(right ?? {}),
    journals: mergeJournalDict(left?.journals, right?.journals),
    messages: leftMsg.length >= rightMsg.length ? leftMsg : rightMsg,
  };
}

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
    out[id] = mergeOneSpace(a?.[id], b?.[id]);
  }
  return out;
}

export function childIdentityKey(c: ChildLike): string {
  const name = String(c.name || "").trim().toLowerCase();
  const birth = String(c.birthDate || "").trim();
  if (name || birth) return `n:${name}|b:${birth}`;
  return c.id ? `id:${c.id}` : "";
}

/** Одинаковый малыш (имя + дата) с разными id — один профиль, дневники склеиваем. */
export function mergeChildrenLists(
  current: ChildLike[] | undefined,
  incoming: ChildLike[] | undefined,
): { children: ChildLike[]; idMap: Record<string, string> } {
  const idMap: Record<string, string> = {};
  const byKey = new Map<string, ChildLike>();

  for (const child of current ?? []) {
    if (!child?.id) continue;
    const key = childIdentityKey(child);
    if (!key) continue;
    byKey.set(key, child);
    idMap[child.id] = child.id;
  }

  for (const child of incoming ?? []) {
    if (!child?.id) continue;
    const key = childIdentityKey(child);
    if (!key) {
      idMap[child.id] = child.id;
      continue;
    }
    const existing = byKey.get(key);
    if (existing?.id && existing.id !== child.id) {
      idMap[child.id] = existing.id;
      byKey.set(key, {
        ...child,
        ...existing,
        id: existing.id,
        name: String(existing.name || child.name || "").trim()
          ? existing.name || child.name
          : child.name,
        birthDate: String(existing.birthDate || child.birthDate || "").trim()
          ? existing.birthDate || child.birthDate
          : child.birthDate,
      });
    } else if (!existing) {
      byKey.set(key, child);
      idMap[child.id] = child.id;
    } else {
      idMap[child.id] = existing.id || child.id;
    }
  }

  return { children: [...byKey.values()], idMap };
}

function remapSpaces(
  spaces: Record<string, SpaceLike> | undefined,
  idMap: Record<string, string>,
): Record<string, SpaceLike> {
  const out: Record<string, SpaceLike> = {};
  for (const [id, space] of Object.entries(spaces ?? {})) {
    const canon = idMap[id] || id;
    out[canon] = mergeOneSpace(out[canon], space);
  }
  return out;
}

export function spaceDataScore(space: SpaceLike | undefined): number {
  if (!space) return 0;
  return (
    journalEntryCount(space.journals) +
    (Array.isArray(space.messages) ? space.messages.length : 0)
  );
}

/** Активный малыш — тот, у кого реально есть записи, а не пустой профиль с компа. */
export function pickRichestChildId(
  spaces: Record<string, SpaceLike> | undefined,
  preferred?: string,
): string {
  const ids = Object.keys(spaces ?? {});
  if (ids.length === 0) return preferred || "";
  let best = preferred && spaces?.[preferred] ? preferred : ids[0];
  let bestN = spaceDataScore(spaces?.[best]);
  for (const id of ids) {
    const n = spaceDataScore(spaces?.[id]);
    if (n > bestN) {
      bestN = n;
      best = id;
    }
  }
  return best;
}

function preferFilledArray(
  current: unknown,
  incoming: unknown,
): unknown {
  const cur = Array.isArray(current) ? current : [];
  const inc = Array.isArray(incoming) ? incoming : [];
  if (inc.length === 0 && cur.length > 0) return cur;
  if (inc.length > 0) return inc;
  return cur;
}

/** Склеить облако и телефон: записи не выкидываем, только объединяем. */
export function mergeBackupData(
  current: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (!current) return incoming;
  const { children, idMap } = mergeChildrenLists(
    current.children as ChildLike[] | undefined,
    incoming.children as ChildLike[] | undefined,
  );
  const childSpaces = mergeChildSpaces(
    remapSpaces(
      current.childSpaces as Record<string, SpaceLike> | undefined,
      idMap,
    ),
    remapSpaces(
      incoming.childSpaces as Record<string, SpaceLike> | undefined,
      idMap,
    ),
  );
  const preferredRaw = String(
    incoming.activeChildId ?? current.activeChildId ?? "",
  );
  const preferred = preferredRaw ? idMap[preferredRaw] || preferredRaw : "";
  return {
    ...current,
    ...incoming,
    children: children.length > 0 ? children : incoming.children ?? current.children,
    activeChildId: pickRichestChildId(childSpaces, preferred),
    momJournals: mergeJournalDict(
      current.momJournals as Record<string, JournalEntryLike[]> | undefined,
      incoming.momJournals as Record<string, JournalEntryLike[]> | undefined,
    ),
    childSpaces,
    customModules: preferFilledArray(
      current.customModules,
      incoming.customModules,
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

type StoreLike = {
  children?: { name?: string }[];
  childSpaces?: Record<string, SpaceLike | undefined>;
  momJournals?: Record<string, unknown[] | undefined>;
  customModules?: unknown[];
  pregnancy?: { active?: boolean; dueDate?: string; lmpDate?: string };
};

/** Есть что беречь в RAM (не затирать IDB / облаком). */
export function storeHasUserData(state: StoreLike): boolean {
  if (state.children?.some((c) => Boolean(c.name?.trim()))) return true;
  if (storeHasBackupWorthyData(state)) return true;
  return false;
}

/** Есть дневник/чат/беременность — имеет смысл пушить в облако. Имя малыша само по себе нет. */
export function storeHasBackupWorthyData(state: StoreLike): boolean {
  const hasDiaryData = Object.values(state.childSpaces ?? {}).some((sp) => {
    if ((sp?.messages?.length ?? 0) > 0) return true;
    return journalEntryCount(sp?.journals) > 0;
  });
  const hasCustomModules = (state.customModules?.length ?? 0) > 0;
  const hasMomJournals = journalEntryCount(state.momJournals) > 0;
  const hasPregnancy = Boolean(
    state.pregnancy?.active ||
      state.pregnancy?.dueDate ||
      state.pregnancy?.lmpDate,
  );
  return hasDiaryData || hasCustomModules || hasMomJournals || hasPregnancy;
}
