"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { formatDuration } from "@/lib/diary-day";
import {
  applyIslandPause,
  applyIslandResume,
  applyIslandStop,
  islandElapsedSec,
  ISLAND_EVENT,
  readIslandTarget,
  type IslandTarget,
} from "@/lib/live-timer-actions";
import { timerIsland } from "@/lib/timer-island";
import { useAppStore } from "@/lib/store";

function iconFor(id: IslandTarget["id"]) {
  if (id === "bf") return "feeding" as const;
  if (id === "walk") return "walk" as const;
  if (id === "contractions") return "pulse" as const;
  return "sleep" as const;
}

export function TimerIslandHost() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const [target, setTarget] = useState<IslandTarget | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    timerIsland.warmup();
    timerIsland.setHandlers({
      onPause: () => applyIslandPause(addJournalEntry),
      onPlay: () => applyIslandResume(),
      onStop: () => applyIslandStop(addJournalEntry),
    });
  }, [addJournalEntry]);

  useEffect(() => {
    let empty = 0;
    const pull = () => {
      const next = readIslandTarget();
      setTarget(next);
      if (!next) {
        empty += 1;
        if (empty >= 3) timerIsland.sync(null);
        return;
      }
      empty = 0;
      timerIsland.sync(next);
    };
    pull();
    const id = window.setInterval(pull, 800);
    window.addEventListener(ISLAND_EVENT, pull);
    window.addEventListener("storage", pull);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(ISLAND_EVENT, pull);
      window.removeEventListener("storage", pull);
    };
  }, []);

  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [target]);

  if (!target) return null;

  const elapsed = islandElapsedSec(target, now);
  const paused = Boolean(target.paused);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(8px,env(safe-area-inset-top))] z-[60] flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#111] px-3.5 py-2 text-white shadow-lg shadow-black/25">
        <Link
          href={target.href}
          className="flex min-w-0 items-center gap-2.5"
          onClick={() => timerIsland.unlock()}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7c5cbf]/30 text-[#c4b0f0]">
            <MayaIcon name={iconFor(target.id)} size={16} />
          </span>
          <span className="max-w-[7rem] truncate text-[11px] font-medium text-white/70">
            {target.title}
          </span>
          <span className="font-mono text-[18px] font-semibold tabular-nums tracking-tight text-[#c4b0f0]">
            {formatDuration(elapsed)}
          </span>
        </Link>
        <button
          type="button"
          aria-label={paused ? "Продолжить" : "Пауза"}
          onClick={() => {
            timerIsland.unlock();
            if (paused) void timerIsland.resumeFromUi();
            else void timerIsland.pauseFromUi();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white"
        >
          {paused ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path fill="currentColor" d="M3 1.5v9l8-4.5L3 1.5Z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path fill="currentColor" d="M3 1.5h2.2v9H3zm3.8 0H9v9H6.8z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
