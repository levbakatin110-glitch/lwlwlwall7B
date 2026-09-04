import { describe, expect, it } from "vitest";
import { splitLinkParts } from "./linkify-text";

describe("splitLinkParts", () => {
  it("turns https shop links into urls", () => {
    const parts = splitLinkParts("смотрите https://www.ozon.ru/t/abc цена");
    expect(parts).toEqual([
      { type: "text", value: "смотрите " },
      {
        type: "url",
        value: "https://www.ozon.ru/t/abc",
        href: "https://www.ozon.ru/t/abc",
        external: true,
      },
      { type: "text", value: " цена" },
    ]);
  });

  it("opens Maya links in the same tab", () => {
    const parts = splitLinkParts("зайдите https://hey-maya.ru/community");
    expect(parts[1]).toMatchObject({
      type: "url",
      href: "https://hey-maya.ru/community",
      external: false,
    });
  });

  it("accepts ozon.ru without https", () => {
    const parts = splitLinkParts("ozon.ru/product/1");
    expect(parts[0]).toMatchObject({
      type: "url",
      href: "https://ozon.ru/product/1",
    });
  });

  it("does not treat an email as a link", () => {
    const parts = splitLinkParts("пишите на mama@mail.ru завтра");
    expect(parts).toEqual([
      { type: "text", value: "пишите на mama@mail.ru завтра" },
    ]);
  });

  it("drops javascript urls", () => {
    const parts = splitLinkParts("javascript:alert(1)");
    expect(parts.every((p) => p.type === "text")).toBe(true);
  });
});
