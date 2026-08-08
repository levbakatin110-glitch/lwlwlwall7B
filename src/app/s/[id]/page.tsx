import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSharedFilm } from "@/lib/share-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function SharedFilmPage({ params }: Props) {
  const { id } = await params;
  const film = await loadSharedFilm(id);
  if (!film) notFound();

  const byId = Object.fromEntries(film.media.map((m) => [m.memoryId, m]));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          <div className="border-b border-line bg-user-bubble px-5 py-5 sm:px-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Фильм-воспоминание · Мая
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">
              {film.story.title}
            </h1>
            <p className="mt-1 text-sm text-muted">{film.story.subtitle}</p>
            {film.babyName && (
              <p className="mt-2 text-xs text-muted">Про {film.babyName}</p>
            )}
            <p className="mt-4 text-sm leading-relaxed">{film.story.intro}</p>
          </div>

          <div className="divide-y divide-line">
            {film.story.scenes.map((scene, i) => {
              const mem = byId[scene.memoryId];
              return (
                <section
                  key={`${scene.memoryId}-${i}`}
                  className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
                >
                  <div className="relative min-h-[200px] bg-user-bubble">
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
                    <h2 className="mt-1.5 font-display text-xl font-semibold">
                      {scene.headline}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed">{scene.line}</p>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="border-t border-line px-5 py-5 sm:px-7">
            <p className="text-sm leading-relaxed">{film.story.outro}</p>
          </div>
        </article>

        <aside className="lg:sticky lg:top-6">
          <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Мая
            </p>
            <p className="mt-2 font-display text-xl font-semibold leading-snug">
              ИИ-помощница для мам
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Сон, гардероб, рост и такие же фильмы-воспоминания — у себя в телефоне.
            </p>
            <Link
              href="/"
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hot"
            >
              Открыть Маю
            </Link>
            {siteUrl && (
              <a
                href={siteUrl}
                className="mt-2 block break-all text-center text-xs text-accent underline-offset-2 hover:underline"
              >
                {siteUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
            {!siteUrl && (
              <p className="mt-2 text-center text-xs text-muted">maya.app</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
