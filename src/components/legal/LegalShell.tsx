import Link from "next/link";
import {
  LEGAL_BRAND,
  LEGAL_DOCS,
  LEGAL_EDITION,
  LEGAL_OPERATOR,
  legalOperatorIncomplete,
} from "@/lib/legal";

export function LegalShell({
  title,
  children,
  edition,
  pdfHref,
}: {
  title: string;
  children: React.ReactNode;
  edition?: string;
  pdfHref?: string;
}) {
  const incomplete = legalOperatorIncomplete();
  const shownEdition = edition ?? LEGAL_EDITION;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-line bg-card/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link
            href="/legal"
            className="font-display text-lg font-semibold tracking-tight"
          >
            {LEGAL_BRAND}
          </Link>
          <Link href="/" className="text-sm text-accent underline">
            На сайт
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          Юридические документы · ред. {shownEdition}
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        {pdfHref ? (
          <p className="mt-4">
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium text-accent underline-offset-2 hover:underline"
            >
              Скачать PDF
            </a>
          </p>
        ) : null}

        {incomplete && (
          <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            Черновик: в реквизитах Исполнителя ещё стоят заглушки. Укажите ФИО
            ИП, ИНН, ОГРНИП и адрес.
          </p>
        )}

        <div className="legal-prose mt-8 space-y-4 text-sm leading-relaxed text-foreground/90">
          {children}
        </div>

        <section className="mt-12 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">
            Реквизиты Исполнителя
          </p>
          <p className="mt-2 font-medium text-foreground">
            {LEGAL_OPERATOR.fullName}
          </p>
          <p>
            ИНН {LEGAL_OPERATOR.inn} · ОГРНИП {LEGAL_OPERATOR.ogrnip}
          </p>
          <p>{LEGAL_OPERATOR.address}</p>
          <p>
            <a
              className="text-accent underline"
              href={`mailto:${LEGAL_OPERATOR.email}`}
            >
              {LEGAL_OPERATOR.email}
            </a>
          </p>
          <p className="mt-1">
            Поддержка:{" "}
            <a
              className="text-accent underline"
              href={`mailto:${LEGAL_OPERATOR.supportEmail}`}
            >
              {LEGAL_OPERATOR.supportEmail}
            </a>
          </p>
        </section>

        <nav
          className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-xs"
          aria-label="Юридические документы"
        >
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.key}
              href={d.href}
              className="text-accent underline underline-offset-2"
            >
              {d.label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
