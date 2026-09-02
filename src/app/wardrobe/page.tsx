"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { DiaryHowTo } from "@/components/DiaryHowTo";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { WARDROBE_HINT } from "@/lib/diary-hints";
import { compressImageFile } from "@/lib/image";
import { useAppStore } from "@/lib/store";
import type { ClothingAnalysis, WardrobeItem } from "@/lib/types";

type AnalysisResult = ClothingAnalysis & {
  tempFromUser?: boolean;
  error?: string;
};

const NOTE_PLACEHOLDERS = [
  "На карточке товара написано: от +3°C до +6°C. Используй эту температуру вместо своей оценки.",
  "Это зимний комбинезон, носим только с тёплым конвертом.",
  "Мы всегда надеваем его только поверх флисового костюма.",
  "Этот комбинезон маломерит, комфортно носить только до +5°C.",
];

const NAME_PLACEHOLDERS = [
  "Комбинезон на прогулку",
  "Ночнушка",
  "Белое боди",
  "Синие ползунки",
  "Куртка на осень",
  "Шапка с ушками",
];

function parseTempRangeFromText(text: string): { min: number; max: number } | null {
  const m = text.match(
    /(?:от\s*)?[+\-−]?\s*(\d+(?:[.,]\d+)?)\s*(?:°\s*[cс]|с)?\s*(?:до|[–\-—…]+)\s*[+\-−]?\s*(\d+(?:[.,]\d+)?)/i,
  );
  if (m) {
    let min = Number(m[1].replace(",", "."));
    let max = Number(m[2].replace(",", "."));
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (min > max) [min, max] = [max, min];
    return { min, max };
  }
  const single = text.match(
    /(?:до|только\s+до|ниже)\s*[+\-−]?\s*(\d+(?:[.,]\d+)?)\s*°?\s*[cс]?/i,
  );
  if (single) {
    const max = Number(single[1].replace(",", "."));
    if (!Number.isFinite(max)) return null;
    return { min: max - 10, max };
  }
  return null;
}

export default function WardrobePage() {
  const wardrobe = useAppStore((s) => s.wardrobe);
  const addWardrobeItem = useAppStore((s) => s.addWardrobeItem);
  const updateWardrobeItem = useAppStore((s) => s.updateWardrobeItem);
  const removeWardrobeItem = useAppStore((s) => s.removeWardrobeItem);

  const clothingRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  const [imageData, setImageData] = useState("");
  const [labelImageData, setLabelImageData] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [tempMinC, setTempMinC] = useState<number | "">("");
  const [tempMaxC, setTempMaxC] = useState<number | "">("");
  const [tempSource, setTempSource] = useState<"user" | "ai">("ai");
  const [weatherTags, setWeatherTags] = useState<string[]>([]);
  const [aiDescription, setAiDescription] = useState("");
  const [type, setType] = useState("одежда");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [namePlaceholderIdx, setNamePlaceholderIdx] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % NOTE_PLACEHOLDERS.length);
      setNamePlaceholderIdx((i) => (i + 1) % NAME_PLACEHOLDERS.length);
    }, 3000);
    return () => window.clearInterval(t);
  }, []);

  async function runAnalyze(clothing: string, label: string, hint: string) {
    if (!clothing) return null;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze-clothing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: clothing,
          labelImageData: label || undefined,
          userHint: hint.trim() || undefined,
        }),
      });
      const data = (await res.json()) as AnalysisResult;
      if (!res.ok) throw new Error(data.error || "Не удалось разобрать фото");

      setName((prev) => prev.trim() || data.name);
      setType(data.type || "одежда");
      setTempMinC(data.tempMinC);
      setTempMaxC(data.tempMaxC);
      setTempSource(data.tempFromUser ? "user" : "ai");
      setWeatherTags(data.weatherTags ?? []);
      setAiDescription(data.aiDescription ?? "");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      return null;
    } finally {
      setAnalyzing(false);
    }
  }

  async function onPickClothing(file: File | null) {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setImageData(compressed);
      await runAnalyze(compressed, labelImageData, note);
    } catch {
      setError("Не удалось загрузить фото одежды");
    }
  }

  async function onPickLabel(file: File | null) {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 960, 0.72);
      setLabelImageData(compressed);
      if (imageData) await runAnalyze(imageData, compressed, note);
    } catch {
      setError("Не удалось загрузить фото бирки");
    }
  }

  function resetForm() {
    setImageData("");
    setLabelImageData("");
    setName("");
    setNote("");
    setTempMinC("");
    setTempMaxC("");
    setTempSource("ai");
    setWeatherTags([]);
    setAiDescription("");
    setType("одежда");
    if (clothingRef.current) clothingRef.current.value = "";
    if (labelRef.current) labelRef.current.value = "";
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!imageData) {
      setError("Сначала загрузите фото одежды");
      return;
    }
    try {
      addWardrobeItem({
        name: name.trim() || "Вещь из гардероба",
        type,
        season: "всесезон",
        note: note.trim(),
        imageData,
        labelImageData: labelImageData || undefined,
        tempMinC: tempMinC === "" ? undefined : Number(tempMinC),
        tempMaxC: tempMaxC === "" ? undefined : Number(tempMaxC),
        tempSource,
        weatherTags,
        aiDescription,
        analyzed: true,
      });
      resetForm();
      setError(null);
    } catch {
      setError(
        "Не удалось сохранить — слишком много фото в браузере. Удалите лишние вещи.",
      );
    }
  }

  function openEdit(item: WardrobeItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditNote(item.note || "");
  }

  async function saveEdit() {
    if (!editingId) return;
    const item = wardrobe.find((x) => x.id === editingId);
    if (!item) return;

    setEditBusy(true);
    try {
      const nextNote = editNote.trim();
      const patch: Partial<Omit<WardrobeItem, "id">> = {
        name: editName.trim() || "Вещь из гардероба",
        note: nextNote,
      };

      if (item.imageData) {
        const res = await fetch("/api/analyze-clothing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageData: item.imageData,
            labelImageData: item.labelImageData || undefined,
            userHint: nextNote || undefined,
          }),
        });
        const data = (await res.json()) as AnalysisResult;
        if (res.ok) {
          patch.tempMinC = data.tempMinC;
          patch.tempMaxC = data.tempMaxC;
          patch.tempSource = data.tempFromUser ? "user" : "ai";
          patch.aiDescription = data.aiDescription;
          patch.weatherTags = data.weatherTags;
          patch.type = data.type || item.type;
        }
      } else {
        const fromNote = parseTempRangeFromText(nextNote);
        if (fromNote) {
          patch.tempMinC = fromNote.min;
          patch.tempMaxC = fromNote.max;
          patch.tempSource = "user";
        }
      }

      updateWardrobeItem(editingId, patch);
      setEditingId(null);
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="maya-page mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold">Одежда малыша</h1>

      <div className="mt-4 rounded-2xl border border-accent/20 bg-accent-soft/35 px-4 py-3.5">
        <p className="text-[13px] leading-relaxed text-foreground/90">
          Когда в чате спросите,{" "}
          <span className="font-medium text-foreground">что надеть на прогулку</span>, Мая
          подберёт подходящую одежду по погоде из того, что вы сохраните здесь.
        </p>
      </div>

      {wardrobe.length === 0 && (
        <DiaryHowTo hintId="wardrobe" hint={WARDROBE_HINT} />
      )}

      <form
        onSubmit={onSubmit}
        className="maya-panel mt-6 space-y-4 rounded-2xl border border-line bg-card/70 p-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <button
              type="button"
              onClick={() => clothingRef.current?.click()}
              disabled={analyzing}
              className="group relative flex h-44 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-accent-soft/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageData || "/demo/upload-clothing.png"}
                alt=""
                className="h-full w-full object-cover"
              />
              {!imageData && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/55 to-transparent px-2 pb-2.5 pt-8 text-center text-[11px] font-semibold text-white sm:text-xs">
                  {analyzing ? "ИИ смотрит…" : "Загрузить"}
                </span>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] font-medium text-foreground">
              Одежда <span className="text-blush">*</span>
            </p>
            <input
              ref={clothingRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onPickClothing(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => labelRef.current?.click()}
              disabled={analyzing || !imageData}
              className="group relative flex h-44 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-card disabled:cursor-not-allowed"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={labelImageData || "/demo/upload-label.png"}
                alt=""
                className="h-full w-full object-cover"
              />
              {!labelImageData && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/55 to-transparent px-2 pb-2.5 pt-8 text-center text-[11px] font-semibold text-white sm:text-xs">
                  {imageData ? "Загрузить" : "Сначала одежда"}
                </span>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">Бирка · необязательно</p>
            <input
              ref={labelRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onPickLabel(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-accent/15 bg-accent-soft/40 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            Зачем бирка
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/80">
            По ярлыку Мая точнее поймёт материал и температуру — без бирки оценит только по виду
            вещи.
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-muted">Название · по желанию</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={NAME_PLACEHOLDERS[namePlaceholderIdx]}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted">Комментарий мамы</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (imageData && note.trim()) void runAnalyze(imageData, labelImageData, note);
            }}
            rows={3}
            placeholder={NOTE_PLACEHOLDERS[placeholderIdx]}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm transition-opacity"
          />
          <span className="mt-1 block text-[11px] text-muted">
            Пишите как обычно — температуру и нюансы Мая поймёт из текста.
          </span>
        </label>

        {(tempMinC !== "" || tempMaxC !== "" || aiDescription) && (
          <div className="rounded-xl bg-accent-soft/50 px-3 py-2.5 text-sm">
            {tempMinC !== "" && tempMaxC !== "" && (
              <p>
                Мая поняла:{" "}
                <span className="font-medium">
                  {tempMinC}…{tempMaxC}°C
                </span>
                {tempSource === "user"
                  ? " (из вашего комментария)"
                  : " (по фото)"}
              </p>
            )}
            {aiDescription && <p className="mt-1 text-muted">{aiDescription}</p>}
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-blush/40 bg-blush-soft px-3 py-2 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={analyzing}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {analyzing ? "Анализирую…" : "Сохранить одежду"}
        </button>
      </form>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {wardrobe.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line bg-card/40 px-4 py-8 text-center text-sm text-muted sm:col-span-2">
            Пока пусто — сфотографируйте боди, комбинезон или куртку малыша.
          </li>
        )}
        {wardrobe.map((item, i) => (
          <li
            key={item.id}
            className="maya-item overflow-hidden rounded-2xl border border-line bg-card/70"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            {item.imageData && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageData}
                alt={item.name}
                className="h-40 w-full object-cover"
              />
            )}
            <div className="p-3">
              {editingId === item.id ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
                    placeholder="Название · по желанию"
                  />
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
                    placeholder={NOTE_PLACEHOLDERS[0]}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={editBusy}
                      onClick={() => void saveEdit()}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {editBusy ? "Обновляю…" : "Сохранить"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted">
                      {item.tempMinC != null && item.tempMaxC != null
                        ? `${item.tempMinC}…${item.tempMaxC}°C`
                        : "температура не указана"}
                      {item.tempSource === "user" ? " · из комментария" : " · по фото"}
                    </p>
                    {item.aiDescription && (
                      <p className="mt-1 text-sm text-muted">{item.aiDescription}</p>
                    )}
                    {item.note && (
                      <p className="mt-1 text-xs text-muted">«{item.note}»</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded-lg p-1.5 text-muted hover:bg-accent-soft hover:text-foreground"
                      aria-label="Редактировать"
                      title="Редактировать"
                    >
                      <MayaIcon name="edit" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeWardrobeItem(item.id)}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
