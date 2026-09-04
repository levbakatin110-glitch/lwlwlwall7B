"use client";

import { useMemo, useRef, useState } from "react";
import {
  DiaryPage,
  DiaryPrimaryButton,
  DiarySectionTitle,
  DiaryStats,
  DiaryStickyCta,
  DiaryTimeline,
  DiaryTimelineRow,
} from "@/components/diary/DiaryShell";
import {
  entriesForToday,
  entryTimeMs,
  formatClock,
  todayYmd,
} from "@/lib/diary-day";
import { compressImageFile } from "@/lib/image";
import { getJournalEntries, useAppStore } from "@/lib/store";

export function MedicalPhotoTracker({
  moduleId,
}: {
  moduleId: "preg_labs";
}) {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, moduleId));
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

  const sorted = useMemo(
    () =>
      [...entries]
        .map((e) => ({ e, startMs: entryTimeMs(e) }))
        .sort((a, b) => b.startMs - a.startMs),
    [entries],
  );

  const todayCount = useMemo(
    () => entriesForToday(entries).length,
    [entries],
  );

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
          kind: "lab",
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
      date: todayYmd(),
      value: result.value,
      note: result.note || result.summary.slice(0, 200),
      fields: {
        title: result.title,
        summary: result.summary,
        startMs: Date.now(),
        ...(preview ? { hasPhoto: 1 } : {}),
      },
    });
    setPreview(null);
    setResult(null);
    setHint("");
  }

  const stickyLabel = result
    ? "Сохранить в дневник"
    : preview
      ? busy
        ? "Читаю…"
        : "Распознать"
      : "Сфотографировать / выбрать";

  const stickyAction = result
    ? save
    : preview
      ? () => void scan()
      : () => fileRef.current?.click();

  const stickyDisabled = preview ? busy : false;

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          { label: "Документов", value: entries.length },
          { label: "Сегодня", value: todayCount },
        ]}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="mt-4 max-h-48 w-full rounded-xl bg-background/50 object-contain"
        />
      )}

      {preview && !result && (
        <input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Подсказка: «это ОАК» / «результат УЗИ»…"
          className="mt-3 w-full rounded-xl border border-line px-3 py-2 text-sm"
        />
      )}

      {error && <p className="mt-3 text-sm text-blush">{error}</p>}

      {result && (
        <div className="mt-4 rounded-xl border border-line bg-background/40 p-3 text-sm">
          <p className="font-semibold">{result.title}</p>
          <p className="mt-1 text-muted">{result.summary}</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="mt-6">
          <DiarySectionTitle left="Записи" right={`${sorted.length}`} />
          <DiaryTimeline>
            {sorted.map((item, i) => (
              <li key={item.e.id}>
                <DiaryTimelineRow
                  accent={i === 0}
                  left={
                    <span className="text-[11px] tabular-nums text-muted">
                      {formatClock(item.startMs)}
                    </span>
                  }
                  mark="📄"
                  right={
                    <span className="text-sm leading-snug">{item.e.value}</span>
                  }
                  onClick={() => {
                    if (window.confirm("Удалить запись?")) {
                      removeJournalEntry(moduleId, item.e.id);
                    }
                  }}
                />
              </li>
            ))}
          </DiaryTimeline>
        </div>
      )}

      <DiaryStickyCta>
        <DiaryPrimaryButton disabled={stickyDisabled} onClick={stickyAction}>
          {stickyLabel}
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
