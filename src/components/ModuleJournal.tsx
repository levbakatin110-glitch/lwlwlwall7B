"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import { DiaryHowTo } from "@/components/DiaryHowTo";
import { DiaryQuickActions } from "@/components/DiaryQuickActions";
import { CustomSmartPanel } from "@/components/CustomSmartPanel";
import { ModuleRepairBanner } from "@/components/ModuleRepairBanner";
import { BottleTracker } from "@/components/feeding/BottleTracker";
import { BreastfeedingTracker } from "@/components/feeding/BreastfeedingTracker";
import { SleepTracker } from "@/components/feeding/SleepTracker";
import { SolidsTracker } from "@/components/feeding/SolidsTracker";
import { DietTracker } from "@/components/diet/DietTracker";
import { DiaperTracker } from "@/components/trackers/DiaperTracker";
import { NotesTracker } from "@/components/trackers/NotesTracker";
import { WalkTracker } from "@/components/trackers/WalkTracker";
import { WaterTracker } from "@/components/trackers/WaterTracker";
import { PregnancyWeekPanel } from "@/components/pregnancy/PregnancyWeekPanel";
import { ContractionsTracker } from "@/components/pregnancy/ContractionsTracker";
import { KicksTracker } from "@/components/pregnancy/KicksTracker";
import { MedsTracker } from "@/components/pregnancy/MedsTracker";
import { MedicalPhotoTracker } from "@/components/pregnancy/MedicalPhotoTracker";
import { MomSleepCalendar } from "@/components/pregnancy/MomSleepCalendar";
import { CycleTracker } from "@/components/cycle/CycleTracker";
import { IconBadge } from "@/components/icons/MayaIcon";
import { hintForDiary } from "@/lib/diary-hints";
import { isDietLikeModule } from "@/lib/diet";
import { fallbackSmartForTopic } from "@/lib/module-schema";
import {
  assessGrowth,
  buildSeries,
  parseHeightCm,
  parseWeightKg,
  type GrowthPoint,
} from "@/lib/growth-norms";
import { WhoGrowthChart } from "@/components/WhoGrowthChart";
import { isBuiltinModuleId, resolveModule } from "@/lib/modules";
import { summarizeEntryFields } from "@/lib/module-schema";
import {
  isFreeModuleId,
  isSubscriptionActive,
} from "@/lib/subscription";
import { useAppStore } from "@/lib/store";
import type { ModuleField, ModuleId } from "@/lib/types";

function formatEntryWhen(date: string, createdAt?: string) {
  const day = date;
  if (!createdAt) return day;
  const t = new Date(createdAt);
  if (Number.isNaN(t.getTime())) return day;
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  return `${day} · ${hh}:${mm}`;
}

function ProgressMini({
  series,
  unit,
  title,
}: {
  series: { at: string; y: number; label: string }[];
  unit: string;
  title: string;
}) {
  if (series.length < 2) return null;
  const values = series.map((s) => s.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 320;
  const h = 110;
  const pts = series
    .map((s, i) => {
      const x = series.length === 1 ? w / 2 : (i / (series.length - 1)) * (w - 16) + 8;
      const y = h - 18 - ((s.y - min) / span) * (h - 36);
      return `${x},${y}`;
    })
    .join(" ");
  const last = series[series.length - 1]!;
  const first = series[0]!;

  return (
    <div className="rounded-2xl border border-line bg-card/70 p-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            {title}
          </p>
          <p className="font-display mt-1 text-2xl font-semibold tracking-tight">
            {Number(last.y.toFixed(2))} {unit}
          </p>
        </div>
        <p className="text-xs text-muted">
          {Number(first.y.toFixed(1))} → {Number(last.y.toFixed(1))} {unit}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="maya-chart-draw mt-3 h-28 w-full text-accent"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pts}
        />
        {series.map((s, i) => {
          const x =
            series.length === 1 ? w / 2 : (i / (series.length - 1)) * (w - 16) + 8;
          const y = h - 18 - ((s.y - min) / span) * (h - 36);
          return <circle key={`${s.at}-${i}`} cx={x} cy={y} r="3.5" className="fill-accent-hot" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
        <span>{first.at.slice(0, 10)}</span>
        <span>{last.at.slice(0, 10)}</span>
      </div>
    </div>
  );
}

function GrowthStatusCard({
  assessment,
  onAskHeight,
  onAskWeight,
}: {
  assessment: ReturnType<typeof assessGrowth>;
  onAskHeight?: () => void;
  onAskWeight?: () => void;
}) {
  const styles =
    assessment.signal === "ok"
      ? "border-accent/35 bg-accent-soft/60"
      : assessment.signal === "watch"
        ? "border-amber-400/40 bg-amber-400/10"
        : assessment.signal === "hot"
          ? "border-blush/50 bg-blush-soft"
          : "border-line bg-card/70";

  const label =
    assessment.signal === "ok"
      ? "Нормально"
      : assessment.signal === "watch"
        ? "Обратить внимание"
        : assessment.signal === "hot"
          ? "Странные скачки"
          : "Нужны данные";

  const pill =
    assessment.signal === "ok"
      ? "bg-accent text-[#ffffff]"
      : assessment.signal === "watch"
        ? "bg-amber-500/90 text-[#111]"
        : assessment.signal === "hot"
          ? "bg-blush text-[#111]"
          : "bg-foreground/15 text-muted";

  const needs = assessment.needs ?? [];

  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${pill}`}
        >
          {label}
        </span>
        <p className="font-display text-lg font-semibold tracking-tight">
          {assessment.title}
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/85">{assessment.detail}</p>

      {needs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {needs.includes("birthDate") && (
            <Link
              href="/profile"
              className="inline-flex rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-[#ffffff]"
            >
              Указать дату рождения
            </Link>
          )}
          {needs.includes("height") && (
            <button
              type="button"
              onClick={onAskHeight}
              className="inline-flex rounded-xl border border-accent/40 bg-accent-soft px-3.5 py-2 text-sm font-semibold text-accent"
            >
              Добавить рост (см)
            </button>
          )}
          {(needs.includes("weight") || needs.includes("absolute")) && (
            <button
              type="button"
              onClick={onAskWeight}
              className="inline-flex rounded-xl border border-accent/40 bg-accent-soft px-3.5 py-2 text-sm font-semibold text-accent"
            >
              Добавить вес (кг)
            </button>
          )}
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted">
        Ориентир, не диагноз. При тревоге — к педиатру.
      </p>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ModuleField;
  value: string;
  onChange: (v: string) => void;
}) {
  const cls = "mt-1 w-full rounded-xl border border-line bg-card px-3 py-2";
  if (field.type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className={cls}
      />
    );
  }
  if (field.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        <option value="">Выберите…</option>
        {(field.options || []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={cls}
    />
  );
}

export function ModuleJournal({ moduleId }: { moduleId: string }) {
  const customModules = useAppStore((s) => s.customModules);
  const profile = useAppStore((s) => s.profile);
  const subscription = useAppStore((s) => s.subscription);
  const premium = isSubscriptionActive(subscription);
  const mod = resolveModule(moduleId, customModules);
  const custom = customModules.find((c) => c.id === moduleId);
  const premiumLocked =
    isBuiltinModuleId(moduleId) && !premium && !isFreeModuleId(moduleId);
  const enabledBuiltin = useAppStore((s) =>
    isBuiltinModuleId(moduleId) ? s.enabledModules.includes(moduleId) : true,
  );
  const enabled =
    Boolean(mod) &&
    !premiumLocked &&
    (mod?.custom ? premium : enabledBuiltin);
  const entries = useAppStore((s) => s.journals[moduleId] ?? []);
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const enableModule = useAppStore((s) => s.enableModule);
  const removeCustomModule = useAppStore((s) => s.removeCustomModule);

  const schemaFields = custom?.fields;
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const formAnchorRef = useRef<HTMLFormElement>(null);

  function focusAdd(prefill: string) {
    setValue(prefill);
    setNote("");
    requestAnimationFrame(() => {
      formAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      formAnchorRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    });
  }

  const isGrowth = moduleId === "growth";
  const isDietPage = isDietLikeModule(moduleId, mod?.title, mod?.description);
  const hideManualForm =
    isDietPage ||
    [
      "water",
      "walk",
      "diaper",
      "notes",
      "pregnancy",
      "contractions",
      "kicks",
      "preg_sleep",
      "cycle",
      "preg_meds",
      "preg_labs",
      "preg_docs",
    ].includes(moduleId);

  const growthPoints: GrowthPoint[] = useMemo(() => {
    if (!isGrowth) return [];
    return entries.map((e) => {
      const at = e.createdAt || `${e.date}T12:00:00`;
      return {
        at,
        label: e.date,
        value: e.value,
        weight: parseWeightKg(e.value) ?? undefined,
        height: parseHeightCm(e.value) ?? undefined,
      };
    });
  }, [entries, isGrowth]);

  const assessment = useMemo(
    () =>
      isGrowth
        ? assessGrowth({ birthDate: profile.birthDate, points: growthPoints })
        : null,
    [isGrowth, profile.birthDate, growthPoints],
  );

  const weightSeries = useMemo(
    () => (isGrowth ? buildSeries(growthPoints, "weight") : []),
    [growthPoints, isGrowth],
  );
  const heightSeries = useMemo(
    () => (isGrowth ? buildSeries(growthPoints, "height") : []),
    [growthPoints, isGrowth],
  );

  const chartValues = useMemo(() => {
    const key = custom?.chartFieldKey;
    if (!key) return [];
    return entries
      .map((e) => Number(e.fields?.[key]))
      .filter((n) => Number.isFinite(n))
      .slice(0, 12);
  }, [entries, custom?.chartFieldKey]);

  const customSeries = useMemo(() => {
    if (!chartValues.length) return [];
    return [...chartValues].reverse().map((y, i) => ({
      at: String(i),
      y,
      label: String(y),
    }));
  }, [chartValues]);

  if (!mod) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <p className="font-display text-2xl">Модуль не найден</p>
        <Link href="/modules" className="mt-4 inline-block text-accent underline">
          К дневникам
        </Link>
      </div>
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (schemaFields?.length) {
      const values: Record<string, string | number> = {};
      for (const f of schemaFields) {
        const raw = fieldValues[f.key] ?? "";
        if (f.required && !String(raw).trim()) return;
        values[f.key] = f.type === "number" && raw !== "" ? Number(raw) : raw;
      }
      const dateField = schemaFields.find((f) => f.type === "date");
      const entryDate = dateField
        ? String(values[dateField.key] || date)
        : date;
      addJournalEntry(moduleId, {
        date: entryDate,
        value: summarizeEntryFields(schemaFields, values),
        note: note.trim(),
        fields: values,
      });
      setFieldValues({});
      setNote("");
      return;
    }
    if (!value.trim()) return;
    addJournalEntry(moduleId, { date, value: value.trim(), note: note.trim() });
    setValue("");
    setNote("");
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <p className="font-display flex items-center gap-3 text-3xl">
          <IconBadge name={mod?.icon || "list"} />
          {mod?.title || "Дневник"}
        </p>
        {premiumLocked ? (
          <>
            <p className="mt-4 text-sm text-muted">
              Этот дневник — в Maya Premium. На бесплатном доступны рост и вес,
              ГВ и вода.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/pricing"
                className="rounded-xl bg-accent px-4 py-2 text-sm text-white"
              >
                Открыть Premium
              </Link>
              <Link
                href="/modules"
                className="rounded-xl border border-line bg-card px-4 py-2 text-sm"
              >
                К каталогу
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted">Раздел пока выключен.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => enableModule(moduleId as ModuleId)}
                className="rounded-xl bg-accent px-4 py-2 text-sm text-white"
              >
                Подключить
              </button>
              <Link
                href="/modules"
                className="rounded-xl border border-line bg-card px-4 py-2 text-sm"
              >
                К каталогу
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="maya-page mx-auto w-full max-w-2xl px-4 py-6 md:py-8">
      <div className="maya-rise flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <IconBadge name={mod.icon} />
          {mod.title}
        </h1>
        {mod.custom && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Удалить этот дневник и все записи?")) {
                removeCustomModule(moduleId);
                window.location.href = "/modules";
              }
            }}
            className="text-xs text-muted hover:text-foreground"
          >
            Удалить
          </button>
        )}
      </div>

      {mod.custom && custom && <ModuleRepairBanner mod={custom} />}

      {/* Подсказка только в пустом «простом» дневнике — трекерам не нужна */}
      {entries.length === 0 &&
        !isDietPage &&
        ![
          "sleep",
          "breastfeeding",
          "formula",
          "solids",
          "water",
          "walk",
          "diaper",
          "notes",
          "pregnancy",
          "contractions",
          "kicks",
          "preg_sleep",
          "cycle",
          "preg_meds",
          "preg_labs",
          "preg_docs",
        ].includes(moduleId) && (
        <DiaryHowTo
          hintId={moduleId}
          hint={hintForDiary(moduleId, mod.custom)}
        />
      )}

      {moduleId === "breastfeeding" && (
        <div className="mt-4">
          <BreastfeedingTracker />
        </div>
      )}
      {moduleId === "formula" && (
        <div className="mt-4">
          <BottleTracker />
        </div>
      )}
      {moduleId === "solids" && (
        <div className="mt-4">
          <SolidsTracker />
        </div>
      )}
      {moduleId === "sleep" && (
        <div className="mt-4">
          <SleepTracker />
        </div>
      )}
      {moduleId === "water" && (
        <div className="mt-4">
          <WaterTracker />
        </div>
      )}
      {moduleId === "walk" && (
        <div className="mt-4">
          <WalkTracker />
        </div>
      )}
      {moduleId === "diaper" && (
        <div className="mt-4">
          <DiaperTracker />
        </div>
      )}
      {moduleId === "notes" && (
        <div className="mt-4">
          <NotesTracker />
        </div>
      )}
      {moduleId === "pregnancy" && (
        <div className="mt-4">
          <PregnancyWeekPanel />
        </div>
      )}
      {moduleId === "contractions" && (
        <div className="mt-4">
          <ContractionsTracker />
        </div>
      )}
      {moduleId === "kicks" && (
        <div className="mt-4">
          <KicksTracker />
        </div>
      )}
      {moduleId === "preg_sleep" && (
        <div className="mt-4">
          <MomSleepCalendar />
        </div>
      )}
      {moduleId === "cycle" && (
        <div className="mt-4">
          <CycleTracker />
        </div>
      )}
      {moduleId === "preg_meds" && (
        <div className="mt-4">
          <MedsTracker />
        </div>
      )}
      {(moduleId === "preg_labs" || moduleId === "preg_docs") && (
        <div className="mt-4">
          <MedicalPhotoTracker moduleId={moduleId} />
        </div>
      )}
      {moduleId === "birth_plan" && (
        <div className="mt-4 rounded-2xl border border-line bg-card/60 p-4 text-sm">
          <p className="text-muted">
            Полный план родов и PDF — в{" "}
            <Link href="/med" className="text-accent underline">
              Мед. карте
            </Link>
            . Здесь можно коротко фиксировать пункты.
          </p>
        </div>
      )}

      {/* Профессиональный калькулятор — и для /m/diet, и для старых «своих» диет */}
      {isDietPage && (
        <div className="mt-4">
          <DietTracker journalId={moduleId === "diet" ? "diet" : moduleId} />
        </div>
      )}

      {/* Свой дневник: умный блок (вехи / цель / шкала…) */}
      {mod.custom && custom && !isDietPage && (
        <CustomSmartPanel
          moduleId={moduleId}
          mod={{
            ...custom,
            smart:
              custom.smart ||
              fallbackSmartForTopic(
                `${mod.title} ${mod.description || ""}`,
              ),
          }}
          onPrefill={focusAdd}
        />
      )}

      {!isDietPage &&
        !mod.custom &&
        ![
          "water",
          "walk",
          "notes",
          "pregnancy",
          "contractions",
          "kicks",
          "preg_sleep",
          "cycle",
          "preg_meds",
          "preg_labs",
          "preg_docs",
        ].includes(moduleId) && (
        <DiaryQuickActions moduleId={moduleId} onPrefill={focusAdd} />
      )}

      {isGrowth && assessment && (
        <div className="mt-4 space-y-3">
          <GrowthStatusCard
            assessment={assessment}
            onAskHeight={() => focusAdd("68 см")}
            onAskWeight={() => focusAdd("8.2 кг")}
          />
          <WhoGrowthChart
            metric="weight"
            sex={profile.sex}
            birthDate={profile.birthDate}
            series={weightSeries.filter((s) => s.y >= 2 && s.y <= 25)}
          />
          <WhoGrowthChart
            metric="length"
            sex={profile.sex}
            birthDate={profile.birthDate}
            series={heightSeries.filter((s) => s.y >= 40 && s.y <= 120)}
          />
          {weightSeries.length >= 2 && (
            <ProgressMini
              series={weightSeries}
              unit="кг"
              title={
                weightSeries.some((s) => s.y < 15)
                  ? "Прибавки"
                  : "Динамика веса"
              }
            />
          )}
          {heightSeries.length >= 2 && (
            <ProgressMini
              series={heightSeries}
              unit="см"
              title="Динамика роста"
            />
          )}
        </div>
      )}

      {!isGrowth && !isDietPage && customSeries.length >= 2 && (
        <div className="mt-4">
          <ProgressMini series={customSeries} unit="" title="Прогресс" />
        </div>
      )}

      {/* На диете / умных трекерах форма-анкета не нужна */}
      {!hideManualForm && (
      <form
        ref={formAnchorRef}
        onSubmit={onSubmit}
        className="mt-5 space-y-3 rounded-2xl border border-line bg-card/70 p-4"
      >
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">
              Своя запись
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Как угодно — не только кнопки сверху
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 text-xs font-semibold text-accent hover:underline"
          >
            В чат →
          </Link>
        </div>
        {schemaFields?.length ? (
          <>
            {schemaFields.map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="text-muted">
                  {f.label}
                  {f.required ? " *" : ""}
                </span>
                <FieldInput
                  field={f}
                  value={fieldValues[f.key] ?? ""}
                  onChange={(v) => setFieldValues((prev) => ({ ...prev, [f.key]: v }))}
                />
              </label>
            ))}
            <label className="block text-sm">
              <span className="text-muted">Заметка</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="По желанию"
                className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
              />
            </label>
          </>
        ) : (
          <>
            <label className="block text-sm">
              <span className="text-muted">Дата</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">{mod.valueLabel}</span>
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={mod.valuePlaceholder}
                rows={3}
                className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Заметка</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="По желанию"
                className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
              />
            </label>
          </>
        )}
        <button
          type="submit"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-[var(--on-accent)]"
        >
          Добавить
        </button>
      </form>
      )}

      <ul className="mt-6 space-y-2">
        {entries.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line bg-card/40 px-4 py-5 text-center text-sm text-muted">
            {isDietPage
              ? "После расчёта можно записывать приёмы — они появятся здесь"
              : "Пока пусто — запишите как удобно"}
          </li>
        )}
        {entries.map((e, i) => (
          <li
            key={e.id}
            className="maya-item flex items-start justify-between gap-3 rounded-2xl border border-line bg-card/70 px-4 py-3"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div>
              <p className="font-mono text-xs text-muted">
                {formatEntryWhen(e.date, e.createdAt)}
              </p>
              <p className="whitespace-pre-wrap font-medium">{e.value}</p>
              {e.note && <p className="text-sm text-muted">{e.note}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeJournalEntry(moduleId, e.id)}
              className="text-xs text-muted hover:text-foreground"
            >
              Удалить
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
