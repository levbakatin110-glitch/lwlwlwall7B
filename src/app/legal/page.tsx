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
      <p className="rounded-xl border border-line bg-card/60 px-3 py-2 text-xs text-muted">
        Услуги носят информационный характер и не являются медицинской помощью.
        При любых вопросах о здоровье ребёнка обращайтесь к врачу.
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
