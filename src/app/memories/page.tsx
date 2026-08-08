"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DiaryHowTo } from "@/components/DiaryHowTo";
import { OnThisDayCard } from "@/components/OnThisDayCard";
import { MEMORIES_HINT } from "@/lib/diary-hints";
import { compressImageFile } from "@/lib/image";
import { useAppStore } from "@/lib/store";
import type { MemoryStory } from "@/lib/types";

export default function MemoriesPage() {
  const memories = useAppStore((s) => s.memories);
  const memoryStory = useAppStore((s) => s.memoryStory);
  const setMemoryStory = useAppStore((s) => s.setMemoryStory);
  const profile = useAppStore((s) => s.profile);
  const addMemory = useAppStore((s) => s.addMemory);
  const removeMemory = useAppStore((s) => s.removeMemory);
  const fileRef = useRef<HTMLInputElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [text, setText] = useState("");
  const [photoData, setPhotoData] = useState("");
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [montageBusy, setMontageBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [siteHome, setSiteHome] = useState(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  );

  useEffect(() => {
    setSiteHome(window.location.origin);
  }, []);

  const chronological = useMemo(
    () => [...memories].sort((a, b) => a.date.localeCompare(b.date)),
    [memories],
  );

  const byId = useMemo(
    () => Object.fromEntries(memories.map((m) => [m.id, m])),
    [memories],
  );

  async function shareFilm() {
    if (!memoryStory) return;
    setShareBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/share-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          babyName: profile.name,
          story: memoryStory,
          media: memoryStory.scenes.map((s) => {
            const m = byId[s.memoryId];
            return {
              memoryId: s.memoryId,
              date: m?.date || "",
              text: m?.text || "",
              photoUrl: m?.photoUrl || undefined,
            };
          }),
        }),
      });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось создать ссылку");
      const url = `${window.location.origin}${data.path}`;
      setShareUrl(url);
      if (navigator.share) {
        try {
          await navigator.share({
            title: memoryStory.title,
            text: memoryStory.subtitle || "Фильм-воспоминание из Маи",
            url,
          });
        } catch {
          /* отмена шаринга — ссылка уже есть */
        }
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка ссылки");
    } finally {
      setShareBusy(false);
    }
  }

  async function onPickPhoto(file: File | null) {
    if (!file) return;
    setError(null);
    setLoadingPhoto(true);
    try {
      const compressed = await compressImageFile(file, 960, 0.72);
      setPhotoData(compressed);
    } catch {
      setError("Не удалось загрузить фото");
    } finally {
      setLoadingPhoto(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() && !photoData) {
      setError("Добавьте текст или фото");
      return;
    }
    try {
      addMemory({ date, text: text.trim(), photoUrl: photoData });
      setText("");
      setPhotoData("");
      setError(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setError("Не удалось сохранить — удалите старые воспоминания с фото");
    }
  }

  async function buildMontage() {
    if (memories.length < 2) {
      setError("Добавьте хотя бы 2 момента — тогда можно собрать историю.");
      return;
    }
    setMontageBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/montage-memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          babyName: profile.name,
          birthDate: profile.birthDate,
          memories: chronological.map((m) => ({
            id: m.id,
            date: m.date,
            text: m.text,
            photoUrl: m.photoUrl || undefined,
          })),
        }),
      });
      const data = (await res.json()) as MemoryStory & { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось собрать монтаж");
      setMemoryStory(data);
      window.setTimeout(() => {
        storyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка монтажа");
    } finally {
      setMontageBusy(false);
    }
  }

  return (
    <div className="maya-page mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold">Моменты</h1>

      {memories.length === 0 && (
        <DiaryHowTo hintId="memories" hint={MEMORIES_HINT} />
      )}

      <div className="mt-5">
        <OnThisDayCard />
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-3 rounded-2xl border border-line bg-card/70 p-4 maya-panel"
      >
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
          <span className="text-muted">Что произошло</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Сегодня впервые улыбнулась…"
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
          />
        </label>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickPhoto(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={loadingPhoto}
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-accent-soft/50 disabled:opacity-50"
          >
            {loadingPhoto ? "Загрузка…" : photoData ? "Сменить фото" : "Загрузить фото"}
          </button>
          {photoData && (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoData}
                alt=""
                className="max-h-48 rounded-xl object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setPhotoData("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="mt-2 text-xs text-muted hover:text-foreground"
              >
                Убрать фото
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-xl border border-blush/40 bg-blush-soft px-3 py-2 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-[#ffffff]"
        >
          Сохранить момент
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={montageBusy || memories.length < 2}
          onClick={() => void buildMontage()}
          className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-40"
        >
          {montageBusy
            ? "Мая монтирует…"
            : memoryStory
              ? "Пересобрать фильм-воспоминание"
              : "Собрать фильм-воспоминание"}
        </button>
        <p className="text-xs text-muted">
          Нужно от 2 моментов. ИИ расставит кадры по датам и свяжет историю.
        </p>
      </div>

      {memoryStory && (
        <div
          ref={storyRef}
          className="maya-panel mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start"
        >
          <div className="overflow-hidden rounded-[1.75rem] border border-line bg-card shadow-sm">
            <div className="border-b border-line bg-accent-soft/70 px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                Фильм-воспоминание
              </p>
              <h2 className="font-display mt-2 text-2xl font-semibold leading-tight">
                {memoryStory.title}
              </h2>
              <p className="mt-1 text-sm text-muted">{memoryStory.subtitle}</p>
              <p className="mt-3 text-sm leading-relaxed text-foreground">
                {memoryStory.intro}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={shareBusy}
                  onClick={() => void shareFilm()}
                  className="rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-[#ffffff] disabled:opacity-50"
                >
                  {shareBusy ? "Делаю ссылку…" : "Поделиться ссылкой"}
                </button>
                {shareUrl && (
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(shareUrl)}
                    className="rounded-xl border border-line bg-card px-3.5 py-2 text-xs font-medium text-foreground"
                  >
                    Скопировать
                  </button>
                )}
              </div>
              {shareUrl && (
                <p className="mt-2 break-all text-xs text-accent">{shareUrl}</p>
              )}
            </div>

            <div className="divide-y divide-line">
              {memoryStory.scenes.map((scene, i) => {
                const mem = byId[scene.memoryId];
                return (
                  <article
                    key={`${scene.memoryId}-${i}`}
                    className="maya-item grid gap-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="relative min-h-[200px] bg-accent-soft/40">
                      {mem?.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mem.photoUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-muted">
                          Без фото · {mem?.date || scene.whenLabel}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col justify-center px-5 py-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                        {scene.whenLabel}
                      </p>
                      <h3 className="font-display mt-1.5 text-xl font-semibold">
                        {scene.headline}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                        {scene.line}
                      </p>
                      {mem?.text && mem.text !== scene.line && (
                        <p className="mt-3 text-xs italic text-muted">
                          Ваша запись: {mem.text}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="border-t border-line px-5 py-5">
              <p className="text-sm leading-relaxed text-foreground">
                {memoryStory.outro}
              </p>
              <button
                type="button"
                onClick={() => setMemoryStory(null)}
                className="mt-3 text-xs text-muted hover:text-foreground"
              >
                Скрыть фильм
              </button>
            </div>
          </div>

          <aside className="lg:sticky lg:top-6">
            <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                Сайт Маи
              </p>
              <p className="font-display mt-2 text-lg font-semibold leading-snug">
                Попробуй сама
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Когда делишься фильмом, справа у друзей тоже будет вход на Маю.
              </p>
              <a
                href="/"
                className="mt-3 flex w-full items-center justify-center rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-[#ffffff]"
              >
                Открыть сайт
              </a>
              <p className="mt-2 break-all text-center text-[11px] text-muted">
                {siteHome.replace(/^https?:\/\//, "")}
              </p>
            </div>
          </aside>
        </div>
      )}

      <h2 className="font-display mt-10 text-xl font-semibold">Все кадры</h2>
      <ul className="mt-3 space-y-3">
        {memories.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line bg-card/40 px-4 py-8 text-center text-sm text-muted">
            Пока пусто — сохраните первое воспоминание с датой.
          </li>
        )}
        {[...memories]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((m, i) => (
            <li
              key={m.id}
              className="maya-item overflow-hidden rounded-2xl border border-line bg-card/70"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              {m.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.photoUrl}
                  alt=""
                  className="max-h-56 w-full object-cover"
                />
              )}
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-xs text-muted">{m.date}</p>
                  {m.text && (
                    <p className="mt-1 whitespace-pre-wrap">{m.text}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeMemory(m.id)}
                  className="shrink-0 text-xs text-muted hover:text-foreground"
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}
