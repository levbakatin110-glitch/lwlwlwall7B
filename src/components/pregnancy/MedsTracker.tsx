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
import { formatClock, todayYmd } from "@/lib/diary-day";
import { toLocalDateIso } from "@/lib/local-date";
import { getJournalEntries, useAppStore } from "@/lib/store";

const QUICK = [
  "Фолиевая кислота",
  "Витамин D",
  "Железо",
  "Магний",
  "Йод",
  "Омега-3",
] as const;

export function MedsTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const updateJournalEntry = useAppStore((s) => s.updateJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, "preg_meds"));
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("09:00");
  const [days, setDays] = useState(7);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return entries
      .filter((e) => e.fields?.remindAt && !e.fields?.taken)
      .map((e) => ({
        id: e.id,
        label: e.value,
        at: String(e.fields!.remindAt),
        t: new Date(String(e.fields!.remindAt)).getTime(),
      }))
      .filter((e) => Number.isFinite(e.t) && e.t >= now - 60_000)
      .sort((a, b) => a.t - b.t)
      .slice(0, 12);
  }, [entries]);

  const takenToday = entries.filter(
    (e) => e.date === todayYmd() && e.fields?.taken,
  ).length;

  function save() {
    const n = name.trim();
    if (!n) return;
    const today = new Date();
    const [hh, mm] = time.split(":").map(Number);
    let created = 0;
    for (let i = 0; i < Math.max(1, Math.min(30, days)); i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      d.setHours(hh || 9, mm || 0, 0, 0);
      if (d.getTime() < Date.now() - 60_000) continue;
      addJournalEntry("preg_meds", {
        date: toLocalDateIso(d),
        value: dose.trim() ? `${n} · ${dose.trim()}` : n,
        note: "",
        fields: {
          name: n,
          dose: dose.trim(),
          remindAt: d.toISOString(),
          text: dose.trim() ? `${n} · ${dose.trim()}` : n,
          startMs: d.getTime(),
        },
      });
      created += 1;
    }
    setName("");
    setDose("");
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
    if (!created) {
      /* silently skip past times */
    }
  }

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          { label: "В очереди", value: upcoming.length },
          { label: "Принято сегодня", value: takenToday },
          { label: "Всего", value: entries.length },
        ]}
      />

      <DiaryCoach
        tone={upcoming.length > 0 ? "ok" : "tip"}
        title={
          upcoming.length > 0
            ? `Следующий приём: ${upcoming[0].label}`
            : "Курс, а не «когда вспомню»"
        }
      >
        {upcoming.length > 0
          ? "Тап по строке = приняла. Железо часто с едой, фолиевая — как сказал врач. Не смешивайте новые БАДы без консультации."
          : "Выберите витамин, время и число дней — появятся напоминания. Это не назначение: схему даёт гинеколог."}
      </DiaryCoach>

      <div className="mt-4 rounded-2xl border border-line bg-card p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <DiaryChip key={q} active={name === q} onClick={() => setName(q)}>
              {q}
            </DiaryChip>
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Препарат"
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
        />
        <input
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          placeholder="Доза"
          className="mt-2 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Время
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            Дней
            <input
              type="number"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      {upcoming.length > 0 ? (
        <div className="mt-5">
          <DiarySectionTitle left="Ближайшие" right="тап = приняла" />
          <DiaryTimeline>
            {upcoming.map((e, i) => (
              <li key={e.id}>
                <DiaryTimelineRow
                  accent={i === 0}
                  mark={i + 1}
                  left={
                    <div>
                      <p className="text-sm font-medium">{e.label}</p>
                      <p className="text-[11px] tabular-nums text-muted">
                        {formatClock(e.t)} ·{" "}
                        {new Date(e.t).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  }
                  right={
                    <span className="text-xs font-semibold text-accent">✓</span>
                  }
                  onClick={() => {
                    updateJournalEntry("preg_meds", e.id, {
                      value: `Приняла · ${e.label}`,
                      fields: { taken: 1, remindAt: "" },
                    });
                  }}
                />
              </li>
            ))}
          </DiaryTimeline>
        </div>
      ) : (
        <DiaryEmpty>Нет активных напоминаний</DiaryEmpty>
      )}

      {entries.filter((e) => e.fields?.taken).length > 0 ? (
        <div className="mt-4">
          <DiarySectionTitle left="История" />
          <DiaryTimeline>
            {entries
              .filter((e) => e.fields?.taken)
              .slice(0, 8)
              .map((e, i) => (
                <li key={e.id}>
                  <DiaryTimelineRow
                    mark={i + 1}
                    left={
                      <span className="text-sm text-muted">{e.value}</span>
                    }
                    right={
                      <span className="text-[11px] text-muted">{e.date}</span>
                    }
                    onClick={() => {
                      if (window.confirm("Удалить запись?")) {
                        removeJournalEntry("preg_meds", e.id);
                      }
                    }}
                  />
                </li>
              ))}
          </DiaryTimeline>
        </div>
      ) : null}

      <DiaryStickyCta>
        <DiaryPrimaryButton disabled={!name.trim()} onClick={save}>
          Добавить курс
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
