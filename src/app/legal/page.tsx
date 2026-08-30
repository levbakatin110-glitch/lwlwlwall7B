import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/LegalShell";
import { LEGAL_DOCS, LEGAL_EDITION, LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Юридические документы · Мая",
  description:
    "Публичная оферта, политика персональных данных и согласия для сервиса Мая (hey-maya.ru).",
};

export default function LegalIndexPage() {
  return (
    <LegalShell title="Юридические документы">
      <p>
        Пакет документов {LEGAL_OPERATOR.shortName} для сервиса «Мая»
        (hey-maya.ru). Редакция от {LEGAL_EDITION} г.
      </p>
      <div className="rounded-xl border border-line bg-card/60 px-3 py-3 text-xs leading-relaxed text-muted">
        <p className="font-medium text-foreground">{LEGAL_OPERATOR.fullName}</p>
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
      </div>
      <p className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-xs leading-relaxed text-muted">
        Мая — информационный сервис, не врач и не медицинская помощь. Ответы ИИ
        могут быть неточными. Решения о здоровье — только ваши и лечащего
        врача. Подробности — в{" "}
        <Link href="/legal/offer" className="text-accent underline">
          оферте
        </Link>
        .
      </p>
      <ul className="mt-6 space-y-3">
        {LEGAL_DOCS.map((d) => (
          <li key={d.key}>
            <Link
              href={d.href}
              className="font-medium text-accent underline underline-offset-2"
            >
              {d.label}
            </Link>
          </li>
        ))}
      </ul>
    </LegalShell>
  );
}
