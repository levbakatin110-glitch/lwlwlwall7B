import { describe, expect, it } from "vitest";
import {
  applyLabInterpretation,
  extractHbFromText,
  interpretHbGL,
  sanitizeLabProse,
} from "./lab-interpret";

describe("interpretHbGL", () => {
  it("does not call 108 anemia or normal", () => {
    const r = interpretHbGL(108);
    expect(r.flag).toBe("border");
    expect(r.text).toMatch(/нижней границе/);
    expect(r.text.toLowerCase()).not.toMatch(/анеми/);
    expect(r.text.toLowerCase()).not.toMatch(/норм/);
  });

  it("flags 98 as below typical", () => {
    expect(interpretHbGL(98).flag).toBe("low");
  });

  it("flags 122 as typical", () => {
    expect(interpretHbGL(122).flag).toBe("typical");
  });
});

describe("applyLabInterpretation", () => {
  it("rebuilds summary from Hb so repeats stay stable", () => {
    const a = applyLabInterpretation({
      title: "ОАК",
      summary: "У вас анемия",
      value: "анемия",
      note: "Hb 108",
      markers: [{ name: "гемоглобин", value: 108, unit: "г/л" }],
    });
    const b = applyLabInterpretation({
      title: "ОАК",
      summary: "Всё нормально",
      value: "норма",
      note: "гемоглобин 108",
      markers: [{ name: "Hb", value: 108, unit: "g/L" }],
    });
    expect(a.summary).toBe(b.summary);
    expect(a.value).toBe(b.value);
    expect(a.summary.toLowerCase()).not.toMatch(/анеми/);
    expect(a.summary.toLowerCase()).not.toMatch(/нормально/);
  });

  it("reads g/dL as g/L", () => {
    const r = applyLabInterpretation({
      title: "ОАК",
      summary: "",
      value: "",
      note: "",
      markers: [{ name: "Hemoglobin", value: 12.2, unit: "g/dL" }],
    });
    expect(r.summary).toMatch(/122 г\/л/);
    expect(r.value).toMatch(/типично/);
  });

  it("falls back to text Hb and sanitizes diagnoses", () => {
    const r = applyLabInterpretation({
      title: "Анализ",
      summary: "Похоже на анемию, всё в норме",
      value: "анемия",
      note: "гемоглобин 108 г/л",
    });
    expect(r.summary).toMatch(/нижней границе/);
    expect(sanitizeLabProse("анемия")).toBe("снижение гемоглобина");
    expect(extractHbFromText("гемоглобин 108 г/л")).toBe(108);
  });
});
