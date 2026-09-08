export type LabFlag = "low" | "border" | "typical" | "high";

export type LabMarkerIn = {
  name?: unknown;
  value?: unknown;
  unit?: unknown;
};

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(",", ".").replace(/[^\d.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace(".", ",");
}

function normName(name: string): string {
  return name.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function isHb(name: string): boolean {
  const n = normName(name);
  return n.includes("гемоглобин") || /^(hb|hgb|hemoglobin)\b/.test(n);
}

function hbToGL(value: number, unit: string): number {
  const u = unit.toLowerCase().replace(/\s/g, "");
  if (u.includes("g/dl") || u.includes("г/дл") || u.includes("гдл")) return value * 10;
  if (value >= 4 && value <= 20 && !u.includes("г/л") && !u.includes("g/l")) {
    return value * 10;
  }
  return value;
}

/** ВОЗ при беременности: анемия <110 (I тр.) / <105 (II–III). Без срока — мягкие пороги. */
export function interpretHbGL(gL: number): { flag: LabFlag; text: string } {
  if (gL < 105) {
    return {
      flag: "low",
      text: `гемоглобин ${fmt(gL)} г/л — ниже типичного для беременности`,
    };
  }
  if (gL < 110) {
    return {
      flag: "border",
      text: `гемоглобин ${fmt(gL)} г/л — на нижней границе для беременности`,
    };
  }
  if (gL <= 150) {
    return {
      flag: "typical",
      text: `гемоглобин ${fmt(gL)} г/л — в типичном диапазоне для беременности`,
    };
  }
  return {
    flag: "high",
    text: `гемоглобин ${fmt(gL)} г/л — выше типичного для беременности`,
  };
}

function flagWord(flag: LabFlag): string {
  if (flag === "low") return "ниже типичного";
  if (flag === "border") return "граница";
  if (flag === "high") return "выше типичного";
  return "типично";
}

export function extractHbFromText(text: string): number | null {
  const m =
    text.match(/гемоглобин[^0-9]{0,16}(\d{2,3}(?:[.,]\d+)?)/i) ||
    text.match(/\b(?:hb|hgb)[^\d]{0,8}(\d{2,3}(?:[.,]\d+)?)/i);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (n >= 4 && n <= 20) return n * 10;
  if (n >= 40 && n <= 220) return n;
  return null;
}

export function sanitizeLabProse(s: string): string {
  return s
    .replace(/анеми[яиею]/gi, "снижение гемоглобина")
    .replace(/вс[её]\s+в\s+норме/gi, "цифры лучше сверить с врачом")
    .replace(/вс[её]\s+нормально/gi, "цифры лучше сверить с врачом")
    .replace(/все\s+ок/gi, "цифры лучше сверить с врачом");
}

function hbFromMarkers(markers: LabMarkerIn[] | null | undefined): number | null {
  for (const m of markers ?? []) {
    const name = String(m.name || "");
    const value = toNumber(m.value);
    if (value == null || !isHb(name)) continue;
    return hbToGL(value, String(m.unit || ""));
  }
  return null;
}

const DISCLAIMER = "Это не диагноз — цифры с фото, итог скажет врач.";

export function applyLabInterpretation(input: {
  title: string;
  summary: string;
  value: string;
  note: string;
  markers?: LabMarkerIn[] | null;
}): { title: string; summary: string; value: string; note: string } {
  const hb =
    hbFromMarkers(input.markers) ??
    extractHbFromText(`${input.note} ${input.summary} ${input.value}`);

  if (hb == null) {
    return {
      title: input.title,
      summary: sanitizeLabProse(input.summary).slice(0, 800),
      value: sanitizeLabProse(input.value).slice(0, 200),
      note: sanitizeLabProse(input.note).slice(0, 400),
    };
  }

  const hbI = interpretHbGL(hb);
  const title = input.title.slice(0, 80) || "Анализ";
  const summary = `${hbI.text}. ${DISCLAIMER}`.slice(0, 800);
  const value = `${title.slice(0, 40)} · Hb ${fmt(hb)} · ${flagWord(hbI.flag)}`.slice(
    0,
    200,
  );
  const note = [input.note.trim(), hbI.text].filter(Boolean).join(" · ").slice(0, 400);
  return { title, summary, value, note };
}
