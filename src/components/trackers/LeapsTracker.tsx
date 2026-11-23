"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import {
  LEAPS,
  addDays,
  currentLeapIndex,
  dayOfLife,
  formatLeapDate,
  leapPhase,
  leapWindow,
  parseBirth,
  type LeapPhase,
} from "@/lib/leaps";

const TABS = [
  { id: "about", label: "О скачке" },
  { id: "games", label: "Игры" },
  { id: "skills", label: "Навыки" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function phaseLine(phase: LeapPhase): string {
  if (phase === "storm") return "Фаза капризов. Новое даётся тяжело, он чаще хочет быть на руках.";
  if (phase === "sunny") return "Обычно становится спокойнее. Он пробует то, что только открыл.";
  if (phase === "past") return "Этот скачок уже позади.";
  return "Этот скачок ещё впереди.";
}

export function LeapsTracker() {
  const birthDate = useAppStore((s) => s.profile?.birthDate) ?? "";
  const birth = parseBirth(birthDate);
  const day = birth ? dayOfLife(birthDate) : null;
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<TabId>("about");

  useEffect(() => {
    if (day == null) return;
    setIndex(currentLeapIndex(day));
    setTab("about");
  }, [birthDate, day]);

  if (!birth || day == null) {
    return (
      <div className="rounded-2xl border border-line bg-card/70 px-4 py-6 text-center">
        <p className="text-sm text-muted">
          Нужна дата рождения, иначе скачок не к чему привязать.
        </p>
        <Link href="/profile" className="mt-3 inline-block text-sm font-semibold text-accent">
          Указать в профиле
        </Link>
      </div>
    );
  }

  const leap = LEAPS[index] ?? LEAPS[0]!;
  const phase = leapPhase(leap, day);
  const window = leapWindow(leap);
  const span = Math.max(1, window.end - window.start);
  const before = Math.max(0, leap.stormStart - window.start);
  const storm = Math.max(1, leap.stormEnd - leap.stormStart);
  const after = Math.max(0, window.end - leap.stormEnd);
  const ticks = [0, 0.34, 0.67, 1].map((part) =>
    formatLeapDate(addDays(birth, Math.round(window.start + part * span))),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Предыдущий скачок"
          disabled={index === 0}
          onClick={() => {
            setIndex((value) => Math.max(0, value - 1));
            setTab("about");
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg disabled:opacity-30"
        >
          ‹
        </button>
        <div className="min-w-0 text-center">
          <p className="font-display text-2xl font-semibold">Скачок {leap.n}</p>
          <p className="mt-0.5 text-sm text-muted">{leap.title}</p>
        </div>
        <button
          type="button"
          aria-label="Следующий скачок"
          disabled={index === LEAPS.length - 1}
          onClick={() => {
            setIndex((value) => Math.min(LEAPS.length - 1, value + 1));
            setTab("about");
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div>
        <div className="flex h-8 overflow-hidden rounded-full bg-card">
          <div className="bg-white/10" style={{ width: `${(before / span) * 100}%` }} />
          <div className="bg-white/25" style={{ width: `${(storm / span) * 100}%` }} />
          <div className="bg-accent/80" style={{ width: `${(after / span) * 100}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted">
          {ticks.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>

      <p className="text-sm leading-relaxed">{phaseLine(phase)}</p>

      <div className="grid grid-cols-3 gap-1 rounded-full bg-card p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-2 py-2 text-xs font-semibold ${
              tab === item.id ? "bg-accent text-on-accent" : "text-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "about" ? (
        <section>
          <h2 className="font-display text-xl font-semibold">Скачок {leap.n}</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{leap.about}</p>
        </section>
      ) : null}

      {tab === "games" ? (
        <ul className="space-y-2">
          {leap.games.map((game) => (
            <li
              key={game}
              className="rounded-2xl border border-line bg-card/70 px-4 py-3 text-sm"
            >
              {game}
            </li>
          ))}
        </ul>
      ) : null}

      {tab === "skills" ? (
        <ul className="space-y-2">
          {leap.skills.map((skill) => (
            <li
              key={skill}
              className="rounded-2xl border border-line bg-card/70 px-4 py-3 text-sm"
            >
              {skill}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-[11px] leading-relaxed text-muted">
        Ориентир по возрасту, не расписание. У одного раньше, у другого позже.
        За два дня до скачка придёт пуш, если уведомления включены.
      </p>
    </div>
  );
}
