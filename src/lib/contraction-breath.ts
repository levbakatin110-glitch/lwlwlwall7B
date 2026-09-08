/** Цикл 10 с: вдох 4, пауза 2, выдох 4. Полоска 0 → 1 → 0, без пола 25%. */
export function breathGuide(elapsedMs: number): {
  title: string;
  hint: string;
  progress: number;
} {
  const t = (((elapsedMs % 10_000) + 10_000) % 10_000) / 1000;
  if (t < 4) {
    return {
      title: "Вдох",
      hint: "медленно через нос",
      progress: t / 4,
    };
  }
  if (t < 6) {
    return {
      title: "Пауза",
      hint: "мягко, без напряжения",
      progress: 1,
    };
  }
  return {
    title: "Выдох",
    hint: "длиннее, чем вдох",
    progress: 1 - (t - 6) / 4,
  };
}
