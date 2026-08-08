"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { MODULE_BY_ID } from "@/lib/modules";
import { useAppStore } from "@/lib/store";
import type { ModuleId } from "@/lib/types";

export type LogPreviewData = {
  mode?: "log" | "created";
  moduleId: string;
  title: string;
  date?: string;
  value?: string;
  note?: string;
  fieldKey?: string;
  fieldsHint?: string;
};

function parseMetric(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = String(raw)
    .replace(",", ".")
    .match(/([+-]?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function formatDelta(n: number): string {
  const s = Number(n.toFixed(2));
  return `${s > 0 ? "+" : ""}${s}`;
}

function useTypewriter(text: string, enabled: boolean, msPerChar = 55) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!enabled || !text) {
      setOut("");
      setDone(false);
      return;
    }
    setOut("");
    setDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [text, enabled, msPerChar]);

  return { out, done };
}

const TOAST_MS = 5200;

/** Уведомление о записи: фиксировано сверху экрана + печать значения */
export function LogPreviewSheet({
  data,
  onClose,
}: {
  data: LogPreviewData;
  onClose: () => void;
}) {
  const mode = data.mode ?? "log";
  const custom = useAppStore((s) =>
    s.customModules.find((m) => m.id === data.moduleId),
  );
  const entries = useAppStore((s) => s.journals[data.moduleId] ?? []);
  const builtin = MODULE_BY_ID[data.moduleId as ModuleId];
  const icon = custom?.icon || builtin?.icon || "spark";

  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [phase, setPhase] = useState(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const heroValue = useMemo(() => {
    if (mode === "created") return "Готово";
    return data.value?.trim() || "ok";
  }, [mode, data.value]);

  const statusLine = useMemo(() => {
    if (mode === "created") {
      return data.fieldsHint || "Можно писать цифры прямо в чат";
    }

    const fieldKey =
      data.fieldKey ||
      custom?.chartFieldKey ||
      custom?.fields?.find((f) => f.type === "number")?.key;

    const series = entries
      .map((e) => {
        const fromField =
          fieldKey != null ? Number(e.fields?.[fieldKey]) : NaN;
        const value = Number.isFinite(fromField)
          ? fromField
          : parseMetric(e.value);
        return value;
      })
      .filter((v): v is number => v != null);

    const hero = parseMetric(data.value);
    const latest = series[0] ?? hero;
    const prev = series.length > 1 ? series[1] : null;
    const delta =
      latest != null && prev != null
        ? latest - prev
        : hero != null &&
            (data.value?.trim().startsWith("+") ||
              data.value?.trim().startsWith("-"))
          ? hero
          : null;

    if (delta != null && delta !== 0) {
      return `Изменение ${formatDelta(delta)} · сохранено`;
    }
    if (data.note?.trim()) return data.note.trim();
    if (data.date) return data.date;
    return "Сохранено в дневник";
  }, [mode, data, custom, entries]);

  const { out: typedValue, done: typedDone } = useTypewriter(
    heroValue,
    phase >= 1,
    62,
  );
  const { out: typedStatus } = useTypewriter(statusLine, phase >= 2, 16);

  useEffect(() => {
    setVisible(false);
    setLeaving(false);
    setPhase(0);
    const show = window.setTimeout(() => setVisible(true), 30);
    const t1 = window.setTimeout(() => setPhase(1), 200);
    const t2 = window.setTimeout(
      () => setPhase(2),
      200 + Math.max(heroValue.length, 4) * 62 + 220,
    );
    const hideAt = window.setTimeout(() => setLeaving(true), TOAST_MS - 380);
    const closeAt = window.setTimeout(() => onCloseRef.current(), TOAST_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(hideAt);
      window.clearTimeout(closeAt);
    };
  }, [data.moduleId, data.value, data.date, data.title, mode, heroValue.length]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[99950] flex justify-center px-3 md:left-[17.5rem] md:px-4 md:top-4"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={onClose}
        className={`maya-log-toast pointer-events-auto w-full max-w-3xl origin-top text-left ${
          visible && !leaving ? "maya-log-toast-on" : ""
        } ${leaving ? "maya-log-toast-out" : ""}`}
      >
        <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-accent/35 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.18)] ring-1 ring-line backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.2]"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 15% 0%, var(--accent-soft), transparent 55%)",
            }}
          />
          <div className="relative flex items-center gap-4 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/20 ring-1 ring-accent/40">
              <MayaIcon name={icon} size={22} className="text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                    {mode === "created" ? "Дневник создан" : "Записано в дневник"}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{data.title}</p>
                </div>
                <p className="font-display min-h-[2rem] text-3xl font-semibold tracking-tight text-foreground sm:text-[2.1rem]">
                  {typedValue}
                  {phase >= 1 && !typedDone && (
                    <span className="maya-caret text-accent">|</span>
                  )}
                </p>
              </div>
              <p className="mt-1.5 min-h-[1.1rem] font-mono text-[12px] text-muted">
                {phase >= 2 ? typedStatus : "…"}
              </p>
            </div>
          </div>
          <div className="h-[3px] w-full bg-line">
            <div className="maya-log-toast-bar h-full bg-accent" />
          </div>
        </div>
      </button>
    </div>,
    document.body,
  );
}
