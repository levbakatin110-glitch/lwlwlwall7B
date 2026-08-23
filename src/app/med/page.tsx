"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";
import {
  openAppointmentPrepPdf,
  openBirthPlanPdf,
} from "@/lib/pregnancy-report";
import {
  pregnancyAgeLabel,
  pregnancyWeek,
  trimesterLabel,
} from "@/lib/pregnancy";
import { useAppStore } from "@/lib/store";

const SECTIONS: {
  href: string;
  title: string;
  sub: string;
  moduleId: string;
}[] = [
  {
    href: "/m/preg_visits",
    title: "Записи к врачу",
    sub: "Приёмы и напоминания",
    moduleId: "preg_visits",
  },
  {
    href: "/m/preg_meds",
    title: "Лекарства",
    sub: "Витамины и курсы",
    moduleId: "preg_meds",
  },
  {
    href: "/m/preg_labs",
    title: "Анализы",
    sub: "ОАК, УЗИ, скрининги",
    moduleId: "preg_labs",
  },
  {
    href: "/m/preg_docs",
    title: "Заметки и документы",
    sub: "Обменка, направления",
    moduleId: "preg_docs",
  },
  {
    href: "/m/birth_plan",
    title: "План родов",
    sub: "Пожелания + PDF в роддом",
    moduleId: "birth_plan",
  },
  {
    href: "/m/contractions",
    title: "Схватки",
    sub: "Таймер и интервалы",
    moduleId: "contractions",
  },
  {
    href: "/m/kicks",
    title: "Шевеления",
    sub: "Активность малыша",
    moduleId: "kicks",
  },
  {
    href: "/m/preg_weight",
    title: "Вес",
    sub: "Динамика по неделям",
    moduleId: "preg_weight",
  },
  {
    href: "/m/preg_pressure",
    title: "Давление",
    sub: "АД и пульс",
    moduleId: "preg_pressure",
  },
  {
    href: "/m/preg_sleep",
    title: "Сон мамы",
    sub: "Отдых и ночи",
    moduleId: "preg_sleep",
  },
];

export default function MedCardPage() {
  const pregnancy = useAppStore((s) => s.pregnancy);
  const journals = useAppStore((s) => s.journals);
  const setPregnancy = useAppStore((s) => s.setPregnancy);
  const enablePregnancyModules = useAppStore((s) => s.enablePregnancyModules);
  const setPendingChatPrompt = useAppStore((s) => s.setPendingChatPrompt);

  const [questions, setQuestions] = useState(
    pregnancy.doctorQuestions || "",
  );
  const [emergency, setEmergency] = useState(
    pregnancy.emergencyContacts || "",
  );
  const [birthPlan, setBirthPlan] = useState(pregnancy.birthPlan || "");

  const age = useMemo(
    () =>
      pregnancy.active && pregnancy.dueDate
        ? pregnancyAgeLabel(pregnancy.dueDate, pregnancy.lmpDate)
        : null,
    [pregnancy],
  );
  const week =
    pregnancy.active && pregnancy.dueDate
      ? pregnancyWeek(pregnancy.dueDate)
      : null;

  const counts = useMemo(() => {
    const c = (id: string) => journals[id]?.length ?? 0;
    return {
      visits: c("preg_visits"),
      meds: c("preg_meds"),
      records:
        c("preg_labs") +
        c("preg_docs") +
        c("preg_symptoms") +
        c("preg_weight") +
        c("preg_pressure"),
    };
  }, [journals]);

  const kicksToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (journals.kicks ?? []).filter((e) => e.date === today).length;
  }, [journals.kicks]);

  function saveExtras() {
    setPregnancy({
      ...pregnancy,
      active: pregnancy.active || Boolean(pregnancy.dueDate),
      doctorQuestions: questions.trim() || undefined,
      emergencyContacts: emergency.trim() || undefined,
      birthPlan: birthPlan.trim() || undefined,
    });
    enablePregnancyModules();
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-5 pb-28">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          Мая
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">
          Мед. карта
        </h1>
        <p className="mt-1 text-sm text-muted">
          Визиты, анализы, план родов и подготовка к приёму — в одном месте
        </p>
      </div>

      {age ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft/50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            Моя беременность
          </p>
          <p className="font-display mt-1 text-2xl font-semibold">{age}</p>
          {week != null && (
            <p className="text-xs text-muted">{trimesterLabel(week)}</p>
          )}
          {kicksToday > 0 ? (
            <p className="mt-2 text-sm text-foreground/90">
              Сегодня есть записи о шевелениях — хороший знак. Ориентир, не
              диагноз.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Можно отметить шевеления в счётчике — врачи часто просят динамику.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-card/60 px-4 py-3 text-sm text-muted">
          Укажите ПДР в{" "}
          <Link href="/m/pregnancy" className="text-accent underline">
            Беременность по неделям
          </Link>
          , чтобы здесь появился срок.
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          saveExtras();
          openAppointmentPrepPdf({ pregnancy: useAppStore.getState().pregnancy, journals });
        }}
        className="flex w-full items-center gap-3 rounded-2xl border border-accent/35 bg-accent-soft/40 px-4 py-4 text-left"
      >
        <MayaIcon name="health" className="h-6 w-6 text-accent" />
        <div>
          <p className="font-semibold">Подготовиться к приёму</p>
          <p className="text-xs text-muted">
            Сводка, вопросы врачу и PDF — наша фишка: можно ещё спросить Маю в
            чате
          </p>
        </div>
      </button>

      <div className="grid grid-cols-3 gap-2">
        {[
          { n: counts.visits, label: "Визиты" },
          { n: counts.meds, label: "Лекарства" },
          { n: counts.records, label: "Записи" },
        ].map((x) => (
          <div
            key={x.label}
            className="rounded-xl border border-line bg-card/70 px-2 py-3 text-center"
          >
            <p className="font-display text-xl font-semibold">{x.n}</p>
            <p className="text-[10px] text-muted">{x.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {SECTIONS.map((s) => {
          const n = journals[s.moduleId]?.length ?? 0;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card/70 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted">{s.sub}</p>
              </div>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                {n}
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-2 rounded-2xl border border-line bg-card/60 p-4">
        <h2 className="font-display text-lg font-semibold">План родов</h2>
        <textarea
          value={birthPlan}
          onChange={(e) => setBirthPlan(e.target.value)}
          rows={4}
          placeholder="Пожелания: партнёр рядом, музыка, эпидуральная, контакт кожа-к-коже…"
          className="w-full rounded-xl border border-line bg-background/50 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              saveExtras();
              openBirthPlanPdf({
                ...useAppStore.getState().pregnancy,
                birthPlan: birthPlan.trim(),
              });
            }}
            className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white"
          >
            PDF плана родов
          </button>
          <Link
            href="/"
            onClick={() =>
              setPendingChatPrompt(
                "Помоги составить план родов: короткие пункты пожеланий для роддома.",
              )
            }
            className="rounded-xl border border-line px-3 py-2 text-sm font-medium"
          >
            Спросить Маю
          </Link>
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-line bg-card/60 p-4">
        <h2 className="font-display text-lg font-semibold">Вопросы врачу</h2>
        <textarea
          value={questions}
          onChange={(e) => setQuestions(e.target.value)}
          rows={3}
          placeholder="Что спросить на ближайшем приёме…"
          className="w-full rounded-xl border border-line bg-background/50 px-3 py-2 text-sm"
        />
      </section>

      <section className="space-y-2 rounded-2xl border border-line bg-card/60 p-4">
        <h2 className="font-display text-lg font-semibold">
          Экстренные контакты
        </h2>
        <textarea
          value={emergency}
          onChange={(e) => setEmergency(e.target.value)}
          rows={3}
          placeholder="Врач ЖК · роддом · скорая 103 · партнёр…"
          className="w-full rounded-xl border border-line bg-background/50 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={saveExtras}
          className="rounded-xl border border-line px-3 py-2 text-sm font-medium"
        >
          Сохранить контакты и план
        </button>
      </section>
    </div>
  );
}
