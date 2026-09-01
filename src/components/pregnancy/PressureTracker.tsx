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
import {
  entriesForToday,
  entryTimeMs,
  formatClock,
  todayYmd,
} from "@/lib/diary-day";
import { getJournalEntries, useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const JOURNAL = "preg_pressure";

const QUICK_BP: { sys: number; dia: number }[] = [
  { sys: 110, dia: 70 },
  { sys: 120, dia: 80 },
  { sys: 130, dia: 85 },
  { sys: 140, dia: 90 },
];

function entryBp(e: JournalEntry): { sys: number; dia: number; pulse: number | null } {
  const sys = Number(e.fields?.sys);
  const dia = Number(e.fields?.dia);
  const pulse = Number(e.fields?.pulse);
  if (Number.isFinite(sys) && Number.isFinite(dia)) {
    return {
      sys,
      dia,
      pulse: Number.isFinite(pulse) && pulse > 0 ? pulse : null,
    };
  }
  const m = e.value.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  const pm = e.value.match(/пульс\s*(\d+)/i);
  return {
    sys: m ? Number(m[1]) : 0,
    dia: m ? Number(m[2]) : 0,
    pulse: pm ? Number(pm[1]) : null,
  };
}

function formatBp(sys: number, dia: number, pulse?: number | null): string {
  const base = `${sys}/${dia}`;
  return pulse != null && pulse > 0 ? `${base} · пульс ${pulse}` : base;
}

export function PressureTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, JOURNAL));
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [pulse, setPulse] = useState("");

  const todayEntries = useMemo(
    () =>
      entriesForToday(entries)
        .map((e) => ({
          e,
          ...entryBp(e),
          startMs: entryTimeMs(e),
        }))
        .filter((x) => x.sys > 0 && x.dia > 0)
        .sort((a, b) => b.startMs - a.startMs),
    [entries],
  );

  const lastAll = useMemo(() => {
    return [...entries]
      .map((e) => ({ e, ...entryBp(e), startMs: entryTimeMs(e) }))
      .filter((x) => x.sys > 0 && x.dia > 0)
      .sort((a, b) => b.startMs - a.startMs)[0];
  }, [entries]);

  const sysNum = Number(sys);
  const diaNum = Number(dia);
  const pulseNum = pulse.trim() ? Number(pulse) : null;
  const canSave =
    Number.isFinite(sysNum) &&
    sysNum >= 60 &&
    sysNum <= 220 &&
    Number.isFinite(diaNum) &&
    diaNum >= 40 &&
    diaNum <= 140 &&
    sysNum > diaNum;

  function applyQuick(s: number, d: number) {
    setSys(String(s));
    setDia(String(d));
  }

  function save() {
    if (!canSave) return;
    const startMs = Date.now();
    const p = pulseNum != null && Number.isFinite(pulseNum) && pulseNum > 0 ? pulseNum : null;
    addJournalEntry(JOURNAL, {
      date: todayYmd(),
      value: formatBp(sysNum, diaNum, p),
      note: "",
      fields: {
        sys: sysNum,
        dia: diaNum,
        ...(p != null ? { pulse: p } : {}),
        startMs,
      },
    });
    setSys("");
    setDia("");
    setPulse("");
  }

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          { label: "Сегодня измерений", value: todayEntries.length },
          {
            label: "Последнее АД",
            value: lastAll ? `${lastAll.sys}/${lastAll.dia}` : "—",
          },
          {
            label: "Пульс",
            value: lastAll?.pulse ?? "—",
          },
        ]}
      />

      <DiaryCoach
        tone={
          lastAll && (lastAll.sys >= 140 || lastAll.dia >= 90)
            ? "go"
            : lastAll && (lastAll.sys < 90 || lastAll.dia < 60)
              ? "watch"
              : lastAll
                ? "ok"
                : "tip"
        }
        title={
          lastAll && (lastAll.sys >= 140 || lastAll.dia >= 90)
            ? "Давление повышено"
            : lastAll && (lastAll.sys < 90 || lastAll.dia < 60)
              ? "Давление низковато"
              : lastAll
                ? "Цифры в привычном коридоре"
                : "Утро и вечер, одна рука"
        }
      >
        {lastAll && (lastAll.sys >= 140 || lastAll.dia >= 90)
          ? "140/90 и выше в беременности — не «просто нервы». Перемерьте через 5 минут сидя. Головная боль, мушки, отёки — сразу к врачу / скорой. Это не диагноз в приложении."
          : lastAll && (lastAll.sys < 90 || lastAll.dia < 60)
            ? "Головокружение, слабость — прилягте, попейте. Если обмороки — к врачу. Низкое без симптомов часто бывает, но фиксируйте."
            : "Сидя, рука на столе, манжета на уровне сердца. Три измерения подряд в карточке врача ценнее одного «с порога»."}
      </DiaryCoach>

      <div className="mt-5 rounded-2xl border border-line bg-card p-4">
        <p className="text-[11px] font-medium text-muted">Быстрый выбор</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_BP.map((bp) => (
            <DiaryChip
              key={`${bp.sys}/${bp.dia}`}
              active={sysNum === bp.sys && diaNum === bp.dia}
              onClick={() => applyQuick(bp.sys, bp.dia)}
            >
              {bp.sys}/{bp.dia}
            </DiaryChip>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <label className="text-xs text-muted">
            Систол.
            <input
              type="number"
              inputMode="numeric"
              min={60}
              max={220}
              value={sys}
              onChange={(e) => setSys(e.target.value)}
              placeholder="120"
              className="mt-1 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-center text-lg font-semibold tabular-nums"
            />
          </label>
          <label className="text-xs text-muted">
            Диастол.
            <input
              type="number"
              inputMode="numeric"
              min={40}
              max={140}
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              placeholder="80"
              className="mt-1 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-center text-lg font-semibold tabular-nums"
            />
          </label>
          <label className="text-xs text-muted">
            Пульс
            <input
              type="number"
              inputMode="numeric"
              min={40}
              max={200}
              value={pulse}
              onChange={(e) => setPulse(e.target.value)}
              placeholder="—"
              className="mt-1 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-center text-lg font-semibold tabular-nums"
            />
          </label>
        </div>
      </div>

      {todayEntries.length > 0 ? (
        <div className="mt-6">
          <DiarySectionTitle left="Сегодня" right={`${todayEntries.length}`} />
          <DiaryTimeline>
            {todayEntries.map((item, i) => (
              <li key={item.e.id}>
                <DiaryTimelineRow
                  accent={i === 0}
                  left={
                    <span className="text-[11px] tabular-nums text-muted">
                      {formatClock(item.startMs)}
                    </span>
                  }
                  mark={
                    <span className="text-[10px] leading-none">
                      {item.sys}
                      <br />
                      {item.dia}
                    </span>
                  }
                  right={
                    <span className="text-sm tabular-nums text-muted">
                      {item.pulse != null ? `${item.pulse} уд/м` : "—"}
                    </span>
                  }
                  onClick={() => {
                    if (window.confirm("Удалить измерение?")) {
                      removeJournalEntry(JOURNAL, item.e.id);
                    }
                  }}
                />
              </li>
            ))}
          </DiaryTimeline>
        </div>
      ) : (
        <DiaryEmpty>Запишите давление — утром и вечером</DiaryEmpty>
      )}

      <DiaryStickyCta>
        <DiaryPrimaryButton disabled={!canSave} onClick={save}>
          {canSave
            ? `Сохранить ${formatBp(sysNum, diaNum, pulseNum)}`
            : "Сохранить"}
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
