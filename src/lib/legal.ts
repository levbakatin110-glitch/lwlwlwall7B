/**
 * Реквизиты Исполнителя / Оператора ПДн для hey-maya.ru.
 * ФИО/ИНН взяты из ИП Ковалевой (получатель оплаты Prodamus).
 */
export type LegalOperator = {
  fullName: string;
  shortName: string;
  inn: string;
  ogrnip: string;
  address: string;
  email: string;
  supportEmail: string;
};

function env(name: string, fallback: string): string {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : fallback;
}

export const LEGAL_OPERATOR: LegalOperator = {
  fullName: env(
    "NEXT_PUBLIC_LEGAL_OPERATOR_NAME",
    "Индивидуальный предприниматель Ковалева Полина Андреевна",
  ),
  shortName: env(
    "NEXT_PUBLIC_LEGAL_OPERATOR_SHORT",
    "ИП Ковалева Полина Андреевна",
  ),
  inn: env("NEXT_PUBLIC_LEGAL_INN", "344107729380"),
  ogrnip: env("NEXT_PUBLIC_LEGAL_OGRNIP", "325344300155000"),
  address: env(
    "NEXT_PUBLIC_LEGAL_ADDRESS",
    "400120, Волгоградская обл., г. Волгоград, ул. Елецкая, 91, Российская Федерация",
  ),
  email: env("NEXT_PUBLIC_LEGAL_EMAIL", "pollilollipop@yandex.ru"),
  supportEmail: env(
    "NEXT_PUBLIC_LEGAL_SUPPORT_EMAIL",
    "levprogrammist@gmail.com",
  ),
};

export const LEGAL_SITE_URL = env(
  "NEXT_PUBLIC_SITE_URL",
  "https://hey-maya.ru",
).replace(/\/$/, "");

export const LEGAL_EDITION = "31.07.2026";

export const LEGAL_BRAND = "Мая";
export const LEGAL_PRODUCT = "Maya Premium";

/** Для Маи достаточно двух документов: оферта (оплата) + политика ПДн (152-ФЗ). */
export type LegalDocKey = "offer" | "privacy";

export const LEGAL_DOCS: {
  key: LegalDocKey;
  href: string;
  label: string;
  fileName: string;
}[] = [
  {
    key: "offer",
    href: "/legal/offer",
    label: "Публичная оферта",
    fileName: "1_Публичная_оферта.pdf",
  },
  {
    key: "privacy",
    href: "/legal/privacy",
    label: "Политика обработки персональных данных",
    fileName: "2_Политика_персональных_данных.pdf",
  },
];

export function legalDocHref(key: LegalDocKey): string {
  return LEGAL_DOCS.find((d) => d.key === key)?.href ?? "/legal";
}

export function legalDocAbsolute(key: LegalDocKey): string {
  return `${LEGAL_SITE_URL}${legalDocHref(key)}`;
}

export function legalOperatorIncomplete(): boolean {
  const o = LEGAL_OPERATOR;
  return (
    o.fullName.includes("[") ||
    o.inn.includes("[") ||
    o.ogrnip.includes("[") ||
    o.address.includes("[")
  );
}
