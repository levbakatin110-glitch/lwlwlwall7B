/** Кольцевой лог ошибок чата / API (клиент + сервер). */

export type OpsErrorSource =
  | "chat"
  | "design"
  | "evolve"
  | "repair"
  | "server"
  | "other";

export type OpsErrorLog = {
  id: string;
  at: string;
  source: OpsErrorSource;
  message: string;
  userSnippet?: string;
  status?: number;
  detail?: string;
};

const MAX = 80;

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** In-memory на сервере Next (живёт, пока жив процесс) */
const serverRing: OpsErrorLog[] = [];

export function pushServerOpsError(
  entry: Omit<OpsErrorLog, "id" | "at"> & { at?: string },
): OpsErrorLog {
  const row: OpsErrorLog = {
    id: uid(),
    at: entry.at || new Date().toISOString(),
    source: entry.source,
    message: String(entry.message || "ошибка").slice(0, 500),
    userSnippet: entry.userSnippet?.slice(0, 160),
    status: entry.status,
    detail: entry.detail?.slice(0, 800),
  };
  serverRing.unshift(row);
  if (serverRing.length > MAX) serverRing.length = MAX;
  return row;
}

export function listServerOpsErrors(): OpsErrorLog[] {
  return [...serverRing];
}

export function clearServerOpsErrors() {
  serverRing.length = 0;
}

export function makeOpsError(
  entry: Omit<OpsErrorLog, "id" | "at"> & { at?: string },
): OpsErrorLog {
  return {
    id: uid(),
    at: entry.at || new Date().toISOString(),
    source: entry.source,
    message: String(entry.message || "ошибка").slice(0, 500),
    userSnippet: entry.userSnippet?.slice(0, 160),
    status: entry.status,
    detail: entry.detail?.slice(0, 800),
  };
}

export function trimOpsErrors(list: OpsErrorLog[]): OpsErrorLog[] {
  return list.slice(0, MAX);
}
