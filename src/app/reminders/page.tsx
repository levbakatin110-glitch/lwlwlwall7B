"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { subscribePush } from "@/components/PushReminders";
import { MayaIcon, type IconName } from "@/components/icons/MayaIcon";
import {
  CARE_PRESETS,
  defaultReminder,
  formatHhMm,
  parseHhMm,
  sanitizeReminder,
  type CareReminder,
  type CareReminderKind,
} from "@/lib/care-reminders";
import { getCareReminders, useAppStore } from "@/lib/store";

const INTERVALS = [
  { min: 60, label: "1 ч" },
  { min: 90, label: "1.5 ч" },
  { min: 120, label: "2 ч" },
  { min: 150, label: "2.5 ч" },
  { min: 180, label: "3 ч" },
  { min: 240, label: "4 ч" },
  { min: 300, label: "5 ч" },
  { min: 360, label: "6 ч" },
] as const;

function kindOf(kind: CareReminderKind) {
  return CARE_PRESETS.find((p) => p.kind === kind);
}

function mergeList(stored: CareReminder[]): CareReminder[] {
  const out: CareReminder[] = [];
  for (const p of CARE_PRESETS) {
    const existing = stored.find((r) => r.kind === p.kind);
    out.push(sanitizeReminder(existing) ?? defaultReminder(p.kind));
  }
  for (const r of stored) {
    if (r.kind === "custom") {
      const clean = sanitizeReminder(r);
      if (clean) out.push(clean);
    }
  }
  return out;
}

export default function RemindersPage() {
  const childSpaces = useAppStore((s) => s.childSpaces);
  const activeChildId = useAppStore((s) => s.activeChildId);
  const upsert = useAppStore((s) => s.upsertCareReminder);
  const remove = useAppStore((s) => s.removeCareReminder);
  const emailVerified = useAppStore((s) => s.emailVerified);
  const stored = useMemo(
    () => getCareReminders({ childSpaces, activeChildId }),
    [childSpaces, activeChildId],
  );
  const list = useMemo(() => mergeList(stored), [stored]);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [customTime, setCustomTime] = useState("10:00");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
    if (Notification.permission === "granted") void subscribePush();
  }, []);

  async function enablePush() {
    try {
      const next = await Notification.requestPermission();
      setPerm(next);
      if (next === "granted") await subscribePush();
    } catch {
      /* ignore */
    }
  }

  function save(row: CareReminder) {
    upsert(row);
  }

  function addCustom() {
    const body = customText.trim();
    if (!body) return;
    const row = defaultReminder("custom");
    row.body = body;
    row.title = "Мая";
    row.times = [customTime];
    row.enabled = true;
    upsert(row);
    setCustomText("");
  }

  const pushOk = perm === "granted";

  return (
    <div className="maya-page mx-auto w-full max-w-2xl px-4 py-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        режим
      </p>
      <h1 className="font-display mt-1.5 text-3xl font-semibold">Напоминания</h1>
      <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted">
        На сайте ничего не всплывает. Пуш приходит на экран телефона, когда Мая
        свёрнута или телефон заблокирован. На iPhone сначала поставьте сайт на
        экран «Домой» и разрешите уведомления.
      </p>

      <div className="mt-5 rounded-2xl border border-line bg-card/80 p-4">
        <p className="text-sm font-semibold">Пуш-уведомления</p>
        {perm === "unsupported" ? (
          <p className="mt-1 text-sm text-muted">
            Этот браузер не умеет уведомления. На iPhone поставьте Маю на экран
            «Домой» через Safari.
          </p>
        ) : pushOk ? (
          <p className="mt-1 text-sm text-muted">
            Включены. {emailVerified ? "Придут и при закрытой вкладке." : "Привяжите почту в профиле — тогда напомним и при закрытой вкладке."}
          </p>
        ) : perm === "denied" ? (
          <p className="mt-1 text-sm text-muted">
            Браузер запретил уведомления. Разрешите их для hey-maya.ru в
            настройках сайта.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              Нужно разрешение телефона. На iPhone сначала «На экран Домой».
            </p>
            <button
              type="button"
              onClick={() => void enablePush()}
              className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Включить
            </button>
          </>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {list.map((row) => {
          const meta = kindOf(row.kind);
          const open = openId === row.id;
          return (
            <div
              key={row.id}
              className="rounded-2xl border border-line bg-card/80 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <MayaIcon name={(meta?.icon as IconName) || "notes"} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {meta?.label ?? row.body}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {meta?.hint ?? row.body}
                  </p>
                  <p className="mt-1 text-[11px] tabular-nums text-muted">
                    {row.enabled
                      ? row.mode === "times"
                        ? (row.times ?? []).join(" · ")
                        : `каждые ${INTERVALS.find((i) => i.min === row.intervalMin)?.label ?? `${row.intervalMin} мин`}`
                      : "выключено"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.enabled}
                  onClick={() => save({ ...row, enabled: !row.enabled })}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    row.enabled ? "bg-accent" : "bg-line"
                  }`}
                >
                  <span
                    className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]"
                    style={{ left: row.enabled ? "1.35rem" : "0.15rem" }}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setOpenId(open ? null : row.id)}
                className="mt-3 text-[11px] font-semibold text-accent"
              >
                {open ? "Скрыть" : "Настроить"}
              </button>

              {open ? (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  {row.kind === "custom" ? (
                    <label className="block text-xs text-muted">
                      Текст
                      <input
                        value={row.body}
                        onChange={(e) => save({ ...row, body: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-foreground"
                      />
                    </label>
                  ) : null}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        save({
                          ...row,
                          mode: "interval",
                          intervalMin: row.intervalMin || 180,
                          resetOnLog: row.kind !== "custom",
                        })
                      }
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                        row.mode === "interval"
                          ? "bg-accent text-white"
                          : "border border-line text-muted"
                      }`}
                    >
                      Интервал
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        save({
                          ...row,
                          mode: "times",
                          times: row.times?.length ? row.times : ["21:00"],
                        })
                      }
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                        row.mode === "times"
                          ? "bg-accent text-white"
                          : "border border-line text-muted"
                      }`}
                    >
                      По часам
                    </button>
                  </div>

                  {row.mode === "interval" ? (
                    <div className="flex flex-wrap gap-1.5">
                      {INTERVALS.map((i) => (
                        <button
                          key={i.min}
                          type="button"
                          onClick={() => save({ ...row, intervalMin: i.min })}
                          className={`rounded-lg px-2.5 py-1 text-xs ${
                            row.intervalMin === i.min
                              ? "bg-accent-soft font-semibold text-accent"
                              : "text-muted"
                          }`}
                        >
                          {i.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <TimesEditor
                      times={row.times ?? ["21:00"]}
                      onChange={(times) => save({ ...row, times })}
                    />
                  )}

                  <QuietEditor
                    from={row.quietFrom}
                    to={row.quietTo}
                    onChange={(quietFrom, quietTo) =>
                      save({ ...row, quietFrom, quietTo })
                    }
                  />

                  {row.kind === "custom" ? (
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      className="text-xs text-blush"
                    >
                      Удалить
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-line p-4">
        <p className="text-sm font-semibold">Своё напоминание</p>
        <p className="mt-0.5 text-xs text-muted">
          Витамин, смеси в фиксированное время, всё что угодно.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Например: смесь в 16:00"
            className="min-w-0 flex-1 rounded-xl border border-line bg-background px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className="rounded-xl border border-line bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addCustom}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Добавить
          </button>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted">
        Лекарства по времени по-прежнему задаются в{" "}
        <Link href="/m/preg_meds" className="text-accent">
          лекарствах
        </Link>
        .
      </p>
    </div>
  );
}

function TimesEditor({
  times,
  onChange,
}: {
  times: string[];
  onChange: (times: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {times.map((t, i) => (
        <div key={`${t}-${i}`} className="flex items-center gap-2">
          <input
            type="time"
            value={t}
            onChange={(e) => {
              const next = [...times];
              next[i] = e.target.value;
              onChange(next.filter((x) => parseHhMm(x) != null));
            }}
            className="rounded-xl border border-line bg-background px-3 py-1.5 text-sm"
          />
          {times.length > 1 ? (
            <button
              type="button"
              onClick={() => onChange(times.filter((_, j) => j !== i))}
              className="text-xs text-muted"
            >
              убрать
            </button>
          ) : null}
        </div>
      ))}
      {times.length < 6 ? (
        <button
          type="button"
          onClick={() => onChange([...times, "12:00"])}
          className="text-xs font-semibold text-accent"
        >
          + ещё время
        </button>
      ) : null}
    </div>
  );
}

function QuietEditor({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (from?: string, to?: string) => void;
}) {
  const on = Boolean(from && to);
  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) =>
            onChange(e.target.checked ? from || "22:00" : undefined, e.target.checked ? to || "07:00" : undefined)
          }
        />
        Не беспокоить ночью
      </label>
      {on ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          с
          <input
            type="time"
            value={from || "22:00"}
            onChange={(e) => onChange(e.target.value, to || "07:00")}
            className="rounded-lg border border-line bg-background px-2 py-1"
          />
          до
          <input
            type="time"
            value={to || "07:00"}
            onChange={(e) => onChange(from || "22:00", e.target.value)}
            className="rounded-lg border border-line bg-background px-2 py-1"
          />
          <span className="tabular-nums">
            {formatHhMm(parseHhMm(from || "22:00") ?? 0)}–
            {formatHhMm(parseHhMm(to || "07:00") ?? 0)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
