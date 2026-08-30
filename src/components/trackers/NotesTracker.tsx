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
import {
  entriesForToday,
  entryTimeMs,
  formatClock,
  todayYmd,
} from "@/lib/diary-day";
import { useAppStore } from "@/lib/store";

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tomorrowAt(hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function formatRemind(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotesTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => s.journals.notes ?? []);
  const [text, setText] = useState("");
  const [withRemind, setWithRemind] = useState(false);
  const [remindAt, setRemindAt] = useState(() =>
    toLocalInputValue(tomorrowAt(18, 0)),
  );

  const today = entriesForToday(entries);
  const upcoming = useMemo(() => {
    const now = Date.now();
    return entries
      .filter((e) => {
        const at = String(e.fields?.remindAt || "");
        if (!at) return false;
        const t = new Date(at).getTime();
        return Number.isFinite(t) && t >= now - 60_000;
      })
      .sort((a, b) => {
        const ta = new Date(String(a.fields?.remindAt)).getTime();
        const tb = new Date(String(b.fields?.remindAt)).getTime();
        return ta - tb;
      });
  }, [entries]);

  function save() {
    const body = text.trim();
    if (!body) return;
    const remindIso =
      withRemind && remindAt ? new Date(remindAt).toISOString() : undefined;
    if (withRemind && remindIso && Number.isNaN(new Date(remindIso).getTime())) {
      return;
    }
    const value = remindIso
      ? `${body} · ${formatRemind(remindIso)}`
      : body;
    addJournalEntry("notes", {
      date: todayYmd(),
      value,
      note: body,
      fields: {
        text: body,
        startMs: Date.now(),
        ...(remindIso ? { remindAt: remindIso } : {}),
      },
    });
    if (remindIso && typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        void Notification.requestPermission();
      }
    }
    setText("");
  }

  const timeline = [...today].sort(
    (a, b) => entryTimeMs(b) - entryTimeMs(a),
  );

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          { label: "Сегодня", value: today.length },
          { label: "Напоминаний", value: upcoming.length },
          {
            label: "Всего",
            value: entries.length,
          },
        ]}
      />

      <div className="mt-4 rounded-2xl border border-line bg-card p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Текст заметки"
          rows={3}
          className="w-full resize-none rounded-xl border-0 bg-transparent px-1 py-1 text-sm leading-relaxed outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            { label: "Завтра 18:00", at: tomorrowAt(18) },
            { label: "Завтра 10:00", at: tomorrowAt(10) },
            { label: "+1 час", at: new Date(Date.now() + 3_600_000) },
          ].map((p) => (
            <DiaryChip
              key={p.label}
              active={false}
              onClick={() => {
                setWithRemind(true);
                setRemindAt(toLocalInputValue(p.at));
              }}
            >
              {p.label}
            </DiaryChip>
          ))}
          <DiaryChip
            active={withRemind}
            onClick={() => setWithRemind((v) => !v)}
          >
            {withRemind ? "с напоминанием" : "без напоминания"}
          </DiaryChip>
        </div>
        {withRemind ? (
          <input
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            className="mt-3 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm"
          />
        ) : null}
      </div>

      {upcoming.length > 0 ? (
        <div className="mt-5">
          <DiarySectionTitle left="Ближайшие" />
          <DiaryTimeline>
            {upcoming.map((e, i) => (
              <li key={e.id}>
                <DiaryTimelineRow
                  accent={i === 0}
                  mark={i + 1}
                  left={
                    <span className="text-sm font-medium leading-snug">
                      {String(e.fields?.text || e.note || e.value)}
                    </span>
                  }
                  right={
                    <span className="text-xs tabular-nums text-muted">
                      {formatRemind(String(e.fields?.remindAt))}
                    </span>
                  }
                  onClick={() => {
                    if (window.confirm("Удалить заметку?")) {
                      removeJournalEntry("notes", e.id);
                    }
                  }}
                />
              </li>
            ))}
          </DiaryTimeline>
        </div>
      ) : null}

      {timeline.length > 0 && upcoming.length === 0 ? (
        <div className="mt-5">
          <DiarySectionTitle left="Сегодня" />
          <DiaryTimeline>
            {timeline.map((e, i) => (
              <li key={e.id}>
                <DiaryTimelineRow
                  mark={timeline.length - i}
                  left={
                    <div>
                      <span className="text-[11px] tabular-nums text-muted">
                        {formatClock(entryTimeMs(e))}
                      </span>
                      <p className="text-sm font-medium leading-snug">
                        {String(e.fields?.text || e.note || e.value)}
                      </p>
                    </div>
                  }
                  right={
                    e.fields?.remindAt ? (
                      <span className="text-[11px] text-accent">⏰</span>
                    ) : (
                      <span className="text-muted/40">—</span>
                    )
                  }
                  onClick={() => {
                    if (window.confirm("Удалить заметку?")) {
                      removeJournalEntry("notes", e.id);
                    }
                  }}
                />
              </li>
            ))}
          </DiaryTimeline>
        </div>
      ) : null}

      {!timeline.length && !upcoming.length ? (
        <DiaryEmpty>Заметок пока нет</DiaryEmpty>
      ) : null}

      <DiaryStickyCta>
        <DiaryPrimaryButton disabled={!text.trim()} onClick={save}>
          Сохранить
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
