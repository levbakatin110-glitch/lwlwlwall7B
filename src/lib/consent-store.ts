/** Согласия при регистрации: ПДн (обязательно) и рассылка (по желанию). Хранятся как доказательство: когда, какая редакция, IP. */

import { getDb } from "@/lib/db";
import { normalizeEmail } from "@/lib/email-codes";
import {
  LEGAL_MARKETING_EDITION,
  LEGAL_PD_EDITION,
  LEGAL_TG_EDITION,
} from "@/lib/legal";

export type MarketingContact = {
  email: string;
  marketingAt: string;
  marketingEdition: string | null;
  revokedAt: string | null;
};

const PD_EDITIONS = `pd ${LEGAL_PD_EDITION}; tg ${LEGAL_TG_EDITION}`;

export function recordRegistrationConsents(opts: {
  email: string;
  marketing: boolean;
  ip: string;
  userAgent: string;
}): void {
  const email = normalizeEmail(opts.email);
  const now = new Date().toISOString();
  const db = getDb();
  const prev = db
    .prepare("SELECT marketing FROM consents WHERE email = ?")
    .get(email) as { marketing: number } | undefined;

  db.prepare(
    `INSERT INTO consents (email, pd_at, pd_edition, marketing, marketing_at,
       marketing_edition, marketing_revoked_at, ip, user_agent, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       pd_at = excluded.pd_at,
       pd_edition = excluded.pd_edition,
       ip = excluded.ip,
       user_agent = excluded.user_agent,
       updated_at = excluded.updated_at`,
  ).run(
    email,
    now,
    PD_EDITIONS,
    opts.marketing ? 1 : 0,
    opts.marketing ? now : null,
    opts.marketing ? LEGAL_MARKETING_EDITION : null,
    opts.ip.slice(0, 64),
    opts.userAgent.slice(0, 300),
    now,
  );

  if (opts.marketing && prev && !prev.marketing) {
    db.prepare(
      `UPDATE consents SET marketing = 1, marketing_at = ?, marketing_edition = ?,
         marketing_revoked_at = NULL, updated_at = ? WHERE email = ?`,
    ).run(now, LEGAL_MARKETING_EDITION, now, email);
  }
}

export function hasPdConsent(email: string): boolean {
  return Boolean(
    getDb()
      .prepare("SELECT 1 AS ok FROM consents WHERE email = ?")
      .get(normalizeEmail(email)),
  );
}

export const CONSENT_REQUIRED_ERROR = {
  error:
    "Чтобы пользоваться Маей, отметьте согласие на обработку персональных данных в форме входа.",
  code: "consent_required",
} as const;

export function listMarketingContacts(): MarketingContact[] {
  return getDb()
    .prepare(
      `SELECT email, marketing_at AS marketingAt, marketing_edition AS marketingEdition,
              marketing_revoked_at AS revokedAt
       FROM consents WHERE marketing_at IS NOT NULL
       ORDER BY marketing_at DESC`,
    )
    .all() as MarketingContact[];
}

/** Отзыв согласия на рассылку (письмо на почту оператора → отмечаем в админке). */
export function revokeMarketing(email: string): boolean {
  const now = new Date().toISOString();
  const res = getDb()
    .prepare(
      `UPDATE consents SET marketing = 0, marketing_revoked_at = ?, updated_at = ?
       WHERE email = ? AND marketing = 1`,
    )
    .run(now, now, normalizeEmail(email));
  return Number(res.changes) > 0;
}
