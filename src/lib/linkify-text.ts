export type LinkPart =
  | { type: "text"; value: string }
  | { type: "url"; value: string; href: string; external: boolean };

const URL_RE =
  /(?:https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|\b(?:[a-z0-9-]+\.)+(?:ru|com|net)\/[^\s<>"']+)/gi;

const TRAIL = /[.,;:!?…»")\]]+$/;

function hrefFor(raw: string): { href: string; external: boolean } | null {
  let u = raw.trim();
  if (!u || /^(javascript|data|vbscript):/i.test(u)) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u.replace(/^\/\//, "")}`;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const internal = host === "hey-maya.ru";
    return { href: parsed.href, external: !internal };
  } catch {
    return null;
  }
}

/** Режем текст на обычные куски и кликабельные http(s)-ссылки. */
export function splitLinkParts(text: string): LinkPart[] {
  if (!text) return [];
  const parts: LinkPart[] = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let raw = m[0];
    let trail = "";
    const cut = raw.match(TRAIL);
    if (cut) {
      trail = cut[0];
      raw = raw.slice(0, -trail.length);
    }
    if (m.index > last) {
      parts.push({ type: "text", value: text.slice(last, m.index) });
    }
    const parsed = hrefFor(raw);
    if (parsed) {
      parts.push({ type: "url", value: raw, ...parsed });
    } else {
      parts.push({ type: "text", value: raw });
    }
    last = m.index + m[0].length - trail.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}
