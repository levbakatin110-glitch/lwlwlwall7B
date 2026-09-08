"use client";

import { useMemo, useState } from "react";
import {
  DiaryChip,
  DiaryEmpty,
  DiaryPage,
  DiaryPrimaryButton,
  DiarySectionTitle,
  DiaryStats,
  DiaryStickyCta,
  DiaryTimeline,
  DiaryTimelineRow,
} from "@/components/diary/DiaryShell";
import { entryTimeMs, todayYmd } from "@/lib/diary-day";
import { formatVisitWhen, parseVisitDateTime } from "@/lib/visit-date";
import { getJournalEntries, useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const JOURNAL = "preg_visits";

const KINDS = ["УЗИ", "ЖК", "анализы", "педиатр", "другое"] as const;

function entryKind(e: JournalEntry): string {
  const k = e.fields?.kind;
  if (typeof k === "string" && k.trim()) return k.trim();
  const part = e.value.split("·")[0]?.trim();
  return part || e.value;
}

function entryWhenMs(e: JournalEntry): number | null {
  const date = typeof e.fields?.whenDate === "string" ? e.fields.whenDate : "";
  const time = typeof e.fields?.whenTime === "string" ? e.fields.whenTime : "";
  if (date) {
    const parsed = parseVisitDateTime(date, time);
    if (parsed.ms != null) return parsed.ms;
  }
  const when = e.fields?.when;
  if (typeof when === "string" && when.trim()) {
    const t = Date.parse(when);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

function entryHasTime(e: JournalEntry): boolean {
  if (typeof e.fields?.whenTime === "string" && e.fields.whenTime.trim()) {
    return true;
  }
  const ms = entryWhenMs(e);
  if (ms == null) return false;
  const d = new Date(ms);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

function buildValue(kind: string, whenMs: number | null, withTime = false): string {
  if (whenMs != null) return `${kind} · ${formatVisitWhen(whenMs, withTime)}`;
  return kind;
}

export function VisitsTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, JOURNAL));
  const [kind, setKind] = useState("");
  const [customKind, setCustomKind] = useState("");
  const [whenDate, setWhenDate] = useState(todayYmd);
  const [whenTime, setWhenTime] = useState("");
  const [place, setPlace] = useState("");

  const parsed = useMemo(
    () =>
      entries
        .map((e) => {
          const k = entryKind(e);
          const whenMs = entryWhenMs(e);
          const hasTime = entryHasTime(e);
          const sortMs = whenMs ?? entryTimeMs(e);
          return {
            e,
            kind: k,
            whenMs,
            hasTime,
            sortMs,
            place: String(e.fields?.place || "").trim(),
            startMs: entryTimeMs(e),
            isFuture: whenMs != null && whenMs > Date.now(),
          };
        })
        .filter((x) => x.kind),
    [entries],
  );

  const upcoming = useMemo(
    () =>
      parsed
        .filter((x) => x.isFuture)
        .sort((a, b) => a.sortMs - b.sortMs),
    [parsed],
  );

  const past = useMemo(
    () =>
      parsed
        .filter((x) => !x.isFuture)
        .sort((a, b) => b.sortMs - a.sortMs),
    [parsed],
  );

  const timeline = useMemo(() => [...upcoming, ...past], [upcoming, past]);

  const stats = useMemo(() => {
    const nearest = upcoming[0];
    return {
      total: parsed.length,
      nearest: nearest
        ? buildValue(nearest.kind, nearest.whenMs, nearest.hasTime)
        : "—",
      past: past.length,
    };
  }, [parsed.length, upcoming, past.length]);

  const resolvedKind = kind === "другое" ? customKind.trim() : kind;
  const parsedWhen = parseVisitDateTime(whenDate, whenTime);
  const canSave = resolvedKind.length > 0 && !parsedWhen.invalid;

  function save() {
    if (!canSave) return;
    const startMs = Date.now();
    const fields: Record<string, string | number> = { kind: resolvedKind, startMs };
    if (parsedWhen.ms != null) {
      const d = new Date(parsedWhen.ms);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      fields.whenDate = ymd;
      fields.when = d.toISOString();
      if (parsedWhen.hasTime) {
        fields.whenTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
    }
    const placeTrim = place.trim();
    if (placeTrim) fields.place = placeTrim;
    addJournalEntry(JOURNAL, {
      date: todayYmd(),
      value: buildValue(resolvedKind, parsedWhen.ms, parsedWhen.hasTime),
      note: placeTrim,
      fields,
    });
    setKind("");
    setCustomKind("");
    setWhenDate(todayYmd());
    setWhenTime("");
    setPlace("");
  }

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          { label: "визитов", value: stats.total },
          { label: "ближайший", value: stats.nearest },
          { label: "прошедших", value: stats.past },
        ]}
      />

      <div className="maya-diary-panel">
        <p className="text-[11px] font-medium text-muted">Тип визита</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <DiaryChip
              key={k}
              active={kind === k}
              onClick={() => setKind(kind === k ? "" : k)}
            >
              {k === "другое" ? "Другое" : k}
            </DiaryChip>
          ))}
        </div>
        {kind === "другое" ? (
          <input
            value={customKind}
            onChange={(e) => setCustomKind(e.target.value)}
            placeholder="Название визита"
            className="mt-3 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-sm"
          />
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="block text-[11px] font-medium text-muted">
            Дата
            <input
              type="date"
              value={whenDate}
              min="2000-01-01"
              max="2100-12-31"
              onChange={(e) => setWhenDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-sm text-foreground"
            />
          </label>
          <label className="block text-[11px] font-medium text-muted">
            Время
            <input
              type="time"
              value={whenTime}
              onChange={(e) => setWhenTime(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-sm text-foreground"
            />
          </label>
        </div>
        {parsedWhen.invalid ? (
          <p className="mt-1.5 text-[11px] text-rose-600">Проверьте дату — год должен быть от 2000 до 2100</p>
        ) : null}

        <label className="mt-3 block text-[11px] font-medium text-muted">
          Место
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Поликлиника, кабинет…"
            className="mt-1.5 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      {timeline.length > 0 ? (
        <div className="mt-6">
          <DiarySectionTitle
            left="Визиты"
            right={`${upcoming.length > 0 ? `${upcoming.length} предст.` : ""}${upcoming.length > 0 && past.length > 0 ? " · " : ""}${past.length > 0 ? `${past.length} прош.` : ""}`}
          />
          <DiaryTimeline>
            {timeline.map((item, i) => (
              <li key={item.e.id}>
                <DiaryTimelineRow
                  accent={i === 0 && item.isFuture}
                  mark={item.isFuture ? "→" : "✓"}
                  left={
                    <div>
                      <p className="text-sm font-medium">{item.kind}</p>
                      {item.whenMs != null ? (
                        <p className="text-[10px] tabular-nums text-muted">
                          {formatVisitWhen(item.whenMs, item.hasTime)}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted/70">
                          без даты
                        </p>
                      )}
                    </div>
                  }
                  right={
                    item.place ? (
                      <span className="text-sm text-muted">{item.place}</span>
                    ) : (
                      <span className="text-sm text-muted/40">—</span>
                    )
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
        <DiaryEmpty>Запланируйте или отметьте визит</DiaryEmpty>
      )}

      <DiaryStickyCta>
        <DiaryPrimaryButton disabled={!canSave} onClick={save}>
          {parsedWhen.invalid ? "Проверьте дату" : "Сохранить"}
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
