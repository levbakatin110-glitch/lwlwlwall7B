"use client";

import { useMemo, useState } from "react";
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
  const [withRemind, setWithRemind] = useState(true);
  const [remindAt, setRemindAt] = useState(() =>
    toLocalInputValue(tomorrowAt(18, 0)),
  );
  const [savedFlash, setSavedFlash] = useState(false);

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
      withRemind && remindAt
        ? new Date(remindAt).toISOString()
        : undefined;
    if (withRemind && remindIso && Number.isNaN(new Date(remindIso).getTime())) {
      return;
    }

    const value = remindIso
      ? `${body} · ⏰ ${formatRemind(remindIso)}`
      : body;

    addJournalEntry("notes", {
      date: new Date().toISOString().slice(0, 10),
      value,
      note: body,
      fields: remindIso
        ? {
            remindAt: remindIso,
            text: body,
          }
        : { text: body },
    });

    if (remindIso && typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        void Notification.requestPermission();
      }
    }

    setText("");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  return (
    <div className="maya-rise overflow-hidden rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        Заметка
      </h2>
      <p className="mt-1 text-xs text-muted">
        Можно просто записать или поставить напоминание
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Например: завтра погулять в 18:00"
        rows={3}
        className="mt-4 w-full resize-none rounded-2xl border border-line bg-card px-3 py-2.5 text-sm leading-relaxed"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          { label: "Завтра 18:00", at: tomorrowAt(18) },
          { label: "Завтра 10:00", at: tomorrowAt(10) },
          {
            label: "Через 1 час",
            at: new Date(Date.now() + 60 * 60 * 1000),
          },
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setWithRemind(true);
              setRemindAt(toLocalInputValue(p.at));
              if (!text.trim()) setText("Погулять с малышом");
            }}
            className="rounded-full border border-line px-3 py-1.5 text-[11px] font-semibold text-muted hover:text-foreground"
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={withRemind}
          onChange={(e) => setWithRemind(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        <span>Напоминание</span>
      </label>

      {withRemind && (
        <label className="mt-2 block text-sm">
          <span className="text-xs text-muted">Когда напомнить</span>
          <input
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
          />
        </label>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!text.trim()}
        className="mt-4 w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-on-accent disabled:opacity-40"
      >
        {savedFlash ? "Сохранено ✓" : withRemind ? "Сохранить с напоминанием" : "Сохранить"}
      </button>

      {upcoming.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            Ближайшие напоминания
          </p>
          <ul className="mt-2 space-y-2">
            {upcoming.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-line bg-card/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    {String(e.fields?.text || e.note || e.value)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    ⏰ {formatRemind(String(e.fields?.remindAt))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeJournalEntry("notes", e.id)}
                  className="shrink-0 text-[11px] text-muted hover:text-foreground"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
