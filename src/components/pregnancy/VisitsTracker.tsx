"use client";

import { useMemo, useState } from "react";
import {
  DiaryChip,
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
import { entryTimeMs, todayYmd } from "@/lib/diary-day";
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
  const when = e.fields?.when;
  if (typeof when === "string" && when.trim()) {
    const t = Date.parse(when);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

function formatVisitWhen(ms: number): string {
  const d = new Date(ms);
  return d
    .toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/\./g, "")
    .replace(/,/, "");
}

function buildValue(kind: string, whenMs: number | null): string {
  if (whenMs != null) return `${kind} · ${formatVisitWhen(whenMs)}`;
  return kind;
}

export function VisitsTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, JOURNAL));
  const [kind, setKind] = useState("");
  const [customKind, setCustomKind] = useState("");
  const [whenLocal, setWhenLocal] = useState("");
  const [place, setPlace] = useState("");

  const parsed = useMemo(
    () =>
      entries
        .map((e) => {
          const k = entryKind(e);
          const whenMs = entryWhenMs(e);
          const sortMs = whenMs ?? entryTimeMs(e);
          return {
            e,
            kind: k,
            whenMs,
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
        ? buildValue(nearest.kind, nearest.whenMs)
        : "—",
      past: past.length,
    };
  }, [parsed.length, upcoming, past.length]);

  const resolvedKind = kind === "другое" ? customKind.trim() : kind;
  const canSave = resolvedKind.length > 0;

  function save() {
    if (!canSave) return;
    const startMs = Date.now();
    const whenMs = whenLocal ? Date.parse(whenLocal) : null;
    const fields: Record<string, string | number> = { kind: resolvedKind, startMs };
    if (whenMs != null && !Number.isNaN(whenMs)) {
      fields.when = new Date(whenMs).toISOString();
    }
    const placeTrim = place.trim();
    if (placeTrim) fields.place = placeTrim;
    addJournalEntry(JOURNAL, {
      date: todayYmd(),
      value: buildValue(resolvedKind, whenMs != null && !Number.isNaN(whenMs) ? whenMs : null),
      note: placeTrim,
      fields,
    });
    setKind("");
    setCustomKind("");
    setWhenLocal("");
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

      <DiaryCoach
        tone={upcoming.length > 0 ? "ok" : "tip"}
        title={
          upcoming[0]
            ? `Следующее: ${upcoming[0].kind}`
            : "Календарь ЖК в одном месте"
        }
      >
        {upcoming[0]
          ? `${upcoming[0].whenMs != null ? formatVisitWhen(upcoming[0].whenMs) : "без точного времени"}${upcoming[0].place ? ` · ${upcoming[0].place}` : ""}. Возьмите паспорт, полис, обменку.`
          : "УЗИ, анализы, явка — с датой, чтобы не держать в голове. После визита фото результатов можно в «анализы»."}
      </DiaryCoach>

      <div className="mt-5 rounded-2xl border border-line bg-card p-4">
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

        <label className="mt-4 block text-[11px] font-medium text-muted">
          Дата и время
          <input
            type="datetime-local"
            value={whenLocal}
            onChange={(e) => setWhenLocal(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-sm text-foreground"
          />
        </label>

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
                          {formatVisitWhen(item.whenMs)}
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
          Сохранить
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
