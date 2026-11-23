/** Молочные зубы: 10 сверху и 10 снизу, как смотрите на малыша. */

export type ToothJaw = "upper" | "lower";
export type ToothSide = "right" | "left";
export type ToothKind = "molar2" | "molar1" | "canine" | "lateral" | "central";

export type ToothDef = {
  id: string;
  jaw: ToothJaw;
  side: ToothSide;
  kind: ToothKind;
  name: string;
  /** Обычный срок, не диагноз */
  usual: string;
};

const UPPER: { side: ToothSide; kind: ToothKind; name: string; usual: string }[] = [
  { side: "right", kind: "molar2", name: "Второй моляр", usual: "25–33 мес" },
  { side: "right", kind: "molar1", name: "Первый моляр", usual: "13–19 мес" },
  { side: "right", kind: "canine", name: "Клык", usual: "16–22 мес" },
  { side: "right", kind: "lateral", name: "Боковой резец", usual: "9–13 мес" },
  { side: "right", kind: "central", name: "Центральный резец", usual: "8–12 мес" },
  { side: "left", kind: "central", name: "Центральный резец", usual: "8–12 мес" },
  { side: "left", kind: "lateral", name: "Боковой резец", usual: "9–13 мес" },
  { side: "left", kind: "canine", name: "Клык", usual: "16–22 мес" },
  { side: "left", kind: "molar1", name: "Первый моляр", usual: "13–19 мес" },
  { side: "left", kind: "molar2", name: "Второй моляр", usual: "25–33 мес" },
];

const LOWER: { side: ToothSide; kind: ToothKind; name: string; usual: string }[] = [
  { side: "right", kind: "molar2", name: "Второй моляр", usual: "23–31 мес" },
  { side: "right", kind: "molar1", name: "Первый моляр", usual: "14–18 мес" },
  { side: "right", kind: "canine", name: "Клык", usual: "17–23 мес" },
  { side: "right", kind: "lateral", name: "Боковой резец", usual: "10–16 мес" },
  { side: "right", kind: "central", name: "Центральный резец", usual: "6–10 мес" },
  { side: "left", kind: "central", name: "Центральный резец", usual: "6–10 мес" },
  { side: "left", kind: "lateral", name: "Боковой резец", usual: "10–16 мес" },
  { side: "left", kind: "canine", name: "Клык", usual: "17–23 мес" },
  { side: "left", kind: "molar1", name: "Первый моляр", usual: "14–18 мес" },
  { side: "left", kind: "molar2", name: "Второй моляр", usual: "23–31 мес" },
];

function row(jaw: ToothJaw, items: typeof UPPER): ToothDef[] {
  const mark = jaw === "upper" ? "u" : "l";
  return items.map((item, index) => ({
    id: `${mark}${item.side === "right" ? "r" : "l"}${index}`,
    jaw,
    side: item.side,
    kind: item.kind,
    name: item.name,
    usual: item.usual,
  }));
}

export const TEETH: ToothDef[] = [
  ...row("upper", UPPER),
  ...row("lower", LOWER),
];

export const TOOTH_BY_ID = Object.fromEntries(TEETH.map((t) => [t.id, t]));

export function teethOf(jaw: ToothJaw): ToothDef[] {
  return TEETH.filter((t) => t.jaw === jaw);
}

export function jawLabel(jaw: ToothJaw): string {
  return jaw === "upper" ? "Верхняя челюсть" : "Нижняя челюсть";
}

export function sideLabel(side: ToothSide): string {
  return side === "right" ? "справа" : "слева";
}

/** Точка на дуге, проценты. Края выше у верхней челюсти, ниже у нижней. */
export function archPoint(index: number, count: number, jaw: ToothJaw) {
  const t = count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
  const x = 50 + t * 43;
  const bow = t * t;
  const y = jaw === "upper" ? 62 - bow * 36 : 34 + bow * 36;
  const rot = t * (jaw === "upper" ? -14 : 14);
  return { x, y, rot };
}
