"use client";

import { useMemo, useState } from "react";
import {
  DiaryCoach,
  DiaryEmpty,
  DiaryPage,
  DiaryPrimaryButton,
  DiarySectionTitle,
  DiaryStats,
  DiaryStickyCta,
  DiaryTimeline,
  DiaryTimelineRow,
} from "@/components/diary/DiaryShell";
import { entryTimeMs, formatClock, todayYmd } from "@/lib/diary-day";
import { getJournalEntries, useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const JOURNAL = "preg_belly";

function entryCm(e: JournalEntry): number {
  const fromField = Number(e.fields?.cm);
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  const m = e.value.match(/([\d]+[.,]?\d*)\s*см/i);
  return m ? Number(m[1].replace(",", ".")) : 0;
}

function formatCm(cm: number): string {
  const rounded = Math.round(cm);
  return `${rounded} см`;
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  const rounded = Math.round(delta);
  return `${sign}${rounded} см`;
}

export function BellyTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, JOURNAL));
  const [cm, setCm] = useState("");
  const [note, setNote] = useState("");

  const sorted = useMemo(
    () =>
      entries
        .map((e) => ({ e, cm: entryCm(e), startMs: entryTimeMs(e) }))
        .filter((x) => x.cm > 0)
        .sort((a, b) => b.startMs - a.startMs),
    [entries],
  );

  const latest = sorted[0];
  const prev = sorted[1];
  const delta =
    latest && prev ? Math.round(latest.cm - prev.cm) : null;

  const cmNum = Number(cm.replace(",", "."));
  const canSave = Number.isFinite(cmNum) && cmNum >= 50 && cmNum <= 200;

  function save() {
    if (!canSave) return;
    const rounded = Math.round(cmNum);
    addJournalEntry(JOURNAL, {
      date: todayYmd(),
      value: formatCm(rounded),
      note: note.trim(),
      fields: { cm: rounded, note: note.trim(), startMs: Date.now() },
    });
    setCm("");
    setNote("");
  }

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          {
            label: "Последняя",
            value: latest ? formatCm(latest.cm) : "—",
          },
          {
            label: "Дельта",
            value: delta != null ? formatDelta(delta) : "—",
          },
          { label: "Записей", value: sorted.length },
        ]}
      />

      <DiaryCoach
        tone={sorted.length >= 2 ? "ok" : "tip"}
        title={
          delta != null && delta <= -2
            ? "Окружность уменьшилась"
            : sorted.length === 0
              ? "Сантиметр на уровне пупка"
              : "Рост живота — ориентир"
        }
      >
        {delta != null && delta <= -2
          ? "Падение на пару см — перемерьте стоя, утром. Если живот «опал» и шевелений мало — к врачу, не ждите планового."
          : "Лента горизонтально, на одном уровне, после туалета. Врач смотрит ВДМ, не только «обхват». Скачок без веса бывает из‑за положения малыша."}
      </DiaryCoach>

      <div className="mt-5 flex flex-col items-center rounded-3xl border border-line bg-gradient-to-b from-card to-[color-mix(in_oklab,var(--accent)_6%,var(--card))] py-10 shadow-sm">
        <input
          type="text"
          inputMode="numeric"
          value={cm}
          onChange={(e) => setCm(e.target.value)}
          placeholder="0"
          className="w-40 border-0 bg-transparent text-center font-display text-5xl font-semibold tabular-nums tracking-tight text-accent outline-none placeholder:text-muted/30"
        />
        <span className="mt-1 text-sm font-medium text-muted">см</span>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Заметка (по желанию)"
        className="mt-4 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-sm"
      />

      {sorted.length > 0 ? (
        <div className="mt-6">
          <DiarySectionTitle left="История" right={`${sorted.length}`} />
          <DiaryTimeline>
            {sorted.map((item, i) => (
              <li key={item.e.id}>
                <DiaryTimelineRow
                  accent={i === 0}
                  left={
                    <div>
                      <span className="text-[11px] tabular-nums text-muted">
                        {formatClock(item.startMs)}
                      </span>
                      <p className="text-[10px] text-muted/70">{item.e.date}</p>
                    </div>
                  }
                  mark={<span className="text-xs tabular-nums">{item.cm}</span>}
                  right={
                    <div>
                      <span className="text-sm tabular-nums text-muted">
                        {formatCm(item.cm)}
                      </span>
                      {item.e.note ? (
                        <p className="mt-0.5 text-xs text-muted/80">{item.e.note}</p>
                      ) : null}
                    </div>
                  }
                  onClick={() => {
                    if (window.confirm("Удалить запись?")) {
                      removeJournalEntry(JOURNAL, item.e.id);
                    }
                  }}
                />
              </li>
            ))}
          </DiaryTimeline>
        </div>
      ) : (
        <DiaryEmpty>Замеряйте окружность раз в неделю</DiaryEmpty>
      )}

      <DiaryStickyCta>
        <DiaryPrimaryButton disabled={!canSave} onClick={save}>
          {canSave ? `Сохранить ${formatCm(cmNum)}` : "Сохранить"}
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
