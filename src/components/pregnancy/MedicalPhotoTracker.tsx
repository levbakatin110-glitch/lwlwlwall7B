"use client";

import { useRef, useState } from "react";
import { compressImageFile } from "@/lib/image";
import { localToday } from "@/lib/local-date";
import { useAppStore } from "@/lib/store";

export function MedicalPhotoTracker({
  moduleId,
}: {
  moduleId: "preg_labs" | "preg_docs";
}) {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [result, setResult] = useState<{
    title: string;
    summary: string;
    value: string;
    note: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const data = await compressImageFile(file, 1280, 0.72);
      setPreview(data);
    } catch {
      setError("Не удалось прочитать фото");
    }
  }

  async function scan() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze-medical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: preview,
          hint,
          kind: moduleId === "preg_labs" ? "lab" : "document",
        }),
        signal: AbortSignal.timeout(55_000),
      });
      const data = (await res.json()) as {
        error?: string;
        title?: string;
        summary?: string;
        value?: string;
        note?: string;
      };
      if (!res.ok) throw new Error(data.error || "Не удалось распознать");
      setResult({
        title: data.title || "Документ",
        summary: data.summary || "",
        value: data.value || data.title || "Запись",
        note: data.note || "",
      });
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "TimeoutError"
          ? "Слишком долго — попробуйте фото поменьше или ещё раз"
          : e instanceof Error
            ? e.message
            : "Ошибка";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!result) return;
    addJournalEntry(moduleId, {
      date: localToday(),
      value: result.value,
      note: result.note || result.summary.slice(0, 200),
      fields: {
        title: result.title,
        summary: result.summary,
        ...(preview ? { hasPhoto: 1 } : {}),
      },
    });
    setPreview(null);
    setResult(null);
    setHint("");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card/60 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        Фото → текст (ИИ)
      </p>
      <p className="text-xs text-muted">
        Сфотографируйте анализ или документ — Мая коротко расшифрует. Не замена
        врачу.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-xl border border-dashed border-accent/40 bg-accent-soft/30 py-3 text-sm font-medium"
      >
        {preview ? "Заменить фото" : "Сделать / выбрать фото"}
      </button>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="max-h-48 w-full rounded-xl object-contain bg-background/50"
        />
      )}
      <input
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder="Подсказка: «это ОАК» / «результат УЗИ»…"
        className="w-full rounded-xl border border-line px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={!preview || busy}
        onClick={() => void scan()}
        className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Читаю…" : "Распознать"}
      </button>
      {error && <p className="text-sm text-blush">{error}</p>}
      {result && (
        <div className="rounded-xl border border-line bg-background/40 p-3 text-sm">
          <p className="font-semibold">{result.title}</p>
          <p className="mt-1 text-muted">{result.summary}</p>
          <p className="mt-2 text-xs">В дневник: {result.value}</p>
          <button
            type="button"
            onClick={save}
            className="mt-3 w-full rounded-xl border border-line py-2 text-sm font-medium"
          >
            Сохранить в дневник
          </button>
        </div>
      )}
    </div>
  );
}
