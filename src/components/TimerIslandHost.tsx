"use client";

import { useEffect } from "react";
import {
  applyIslandPause,
  applyIslandResume,
  applyIslandStop,
  ISLAND_EVENT,
  readIslandTarget,
} from "@/lib/live-timer-actions";
import { timerIsland } from "@/lib/timer-island";
import { useAppStore } from "@/lib/store";

/** Держит плеер/островок, без фальшивой капсулы поверх страницы. */
export function TimerIslandHost() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);

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

  return null;
}
