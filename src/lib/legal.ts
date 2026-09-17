/**
 * Реквизиты Исполнителя / Оператора ПДн для hey-maya.ru.
 * Те же, что у ИП Ковалевой на lollypollya.ru (пакет документов в папке «Евгений»).
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

export const LEGAL_EDITION = "31.08.2026";
export const LEGAL_PD_EDITION = "10.09.2026";

export const LEGAL_BRAND = "Мая";
export const LEGAL_PRODUCT = "Maya Premium";

export type LegalDocKey = "offer" | "privacy" | "consent";

export const LEGAL_DOCS: {
  key: LegalDocKey;
  href: string;
  label: string;
  fileName: string;
  pdfHref?: string;
  edition: string;
}[] = [
  {
    key: "offer",
    href: "/legal/offer",
    label: "Публичная оферта",
    fileName: "1_Публичная_оферта.pdf",
    pdfHref: "/Документы/1_Публичная_оферта.pdf",
    edition: LEGAL_EDITION,
  },
  {
    key: "privacy",
    href: "/legal/privacy",
    label: "Политика обработки персональных данных",
    fileName: "Политика_обработки_персональных_данных.pdf",
    pdfHref: "/docs/privacy-policy.pdf",
    edition: LEGAL_PD_EDITION,
  },
  {
    key: "consent",
    href: "/legal/consent",
    label: "Согласие на обработку персональных данных",
    fileName: "Согласие_на_обработку_ПДн.pdf",
    pdfHref: "/docs/consent-pd.pdf",
    edition: LEGAL_PD_EDITION,
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
