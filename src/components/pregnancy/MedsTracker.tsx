"use client";

import { useMemo, useState } from "react";
import { toLocalDateIso } from "@/lib/local-date";
import { useAppStore } from "@/lib/store";

export function MedsTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const updateJournalEntry = useAppStore((s) => s.updateJournalEntry);
  const entries = useAppStore((s) => s.journals.preg_meds ?? []);
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
      .slice(0, 8);
  }, [entries]);

  function save() {
    const n = name.trim();
    if (!n) return;
    const today = new Date();
    const [hh, mm] = time.split(":").map(Number);
    const created: string[] = [];
    for (let i = 0; i < Math.max(1, Math.min(30, days)); i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      d.setHours(hh || 9, mm || 0, 0, 0);
      if (d.getTime() < Date.now() - 60_000) continue;
      const iso = d.toISOString();
      const date = toLocalDateIso(d);
      addJournalEntry("preg_meds", {
        date,
        value: dose.trim() ? `${n} · ${dose.trim()}` : n,
        note: `напоминание ${time}`,
        fields: {
          name: n,
          dose: dose.trim(),
          remindAt: iso,
          text: dose.trim() ? `${n} · ${dose.trim()}` : n,
        },
      });
      created.push(date);
    }
    setName("");
    setDose("");
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
    if (!created.length) {
      alert("Выберите время в будущем");
    }
  }

  function tookNow(id: string, label: string) {
    updateJournalEntry("preg_meds", id, {
      value: `Приняла · ${label}`,
      fields: { taken: 1, remindAt: "" },
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-card/60 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Курс с напоминаниями
        </p>
        <div className="mt-3 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Фолиевая / витамин D / железо…"
            className="w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-sm"
          />
          <input
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="Доза (необязательно)"
            className="w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">
              Время
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted">
              Дней курса
              <input
                type="number"
                min={1}
                max={30}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={save}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white"
          >
            Поставить напоминания
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Мая напомнит, пока вкладка открыта, и через уведомление браузера (если
          разрешите).
        </p>
      </div>

      {upcoming.length > 0 && (
        <div className="rounded-2xl border border-line bg-card/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Ближайшие
          </p>
          <ul className="mt-2 space-y-2">
            {upcoming.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {u.label}
                  <span className="block text-[11px] text-muted">
                    {new Date(u.at).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => tookNow(u.id, u.label)}
                  className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs"
                >
                  Приняла
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
