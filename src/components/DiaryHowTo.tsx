"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";
import type { DiaryHint } from "@/lib/diary-hints";
import { useAppStore } from "@/lib/store";

export function DiaryHowTo({
  hintId,
  hint,
}: {
  hintId: string;
  hint: DiaryHint;
}) {
  const [ready, setReady] = useState(false);
  const setPendingChatPrompt = useAppStore((s) => s.setPendingChatPrompt);
  const dismissed = useAppStore((s) => s.dismissedDiaryHints.includes(hintId));
  const dismissDiaryHint = useAppStore((s) => s.dismissDiaryHint);
  const shownRef = useRef(false);

  useEffect(() => {
    setReady(true);
  }, []);

  // После первого нормального просмотра — больше не показываем
  useEffect(() => {
    if (!ready || dismissed) return;
    shownRef.current = true;
    const mountedAt = Date.now();
    return () => {
      // Strict Mode размонтирует почти сразу — не считаем это «увидели»
      if (shownRef.current && Date.now() - mountedAt > 400) {
        useAppStore.getState().dismissDiaryHint(hintId);
      }
    };
  }, [ready, dismissed, hintId]);

  if (!ready || dismissed) return null;
  if (!hint.body && (!hint.examples || hint.examples.length === 0)) return null;

  return (
    <div className="maya-panel relative mt-4 rounded-2xl border border-line bg-card/80 px-4 py-3 pr-11">
      <button
        type="button"
        onClick={() => dismissDiaryHint(hintId)}
        aria-label="Скрыть"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-foreground"
      >
        <MayaIcon name="close" size={16} />
      </button>
      <p className="text-sm leading-snug text-foreground/90">{hint.body}</p>
      {hint.examples.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {hint.examples.map((ex) => (
            <Link
              key={ex.label}
              href="/"
              onClick={() => {
                dismissDiaryHint(hintId);
                setPendingChatPrompt(ex.prompt);
              }}
              className="rounded-full border border-line/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-accent/40 hover:bg-accent-soft"
            >
              {ex.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
