import { Resend } from "resend";

export function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export function resendFromAddress() {
  return (
    process.env.RESEND_FROM?.trim() ||
    "Мая <onboarding@resend.dev>"
  );
}

export async function sendRegistrationCodeEmail(opts: {
  to: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResend();
  if (!resend) {
    return {
      ok: false,
      error:
        "На сервере не задан RESEND_API_KEY. Добавьте ключ в .env.local и перезапустите.",
    };
  }

  try {
    const { error } = await resend.emails.send({
      from: resendFromAddress(),
      to: opts.to,
      subject: "Код подтверждения регистрации — Мая",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1a1a1a">
          <p style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#c45c7a;margin:0 0 8px">Мая</p>
          <h1 style="font-size:22px;margin:0 0 12px">Код регистрации</h1>
          <p style="margin:0 0 20px;line-height:1.5;color:#555">Введите этот код в приложении, чтобы подтвердить почту:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:0.2em;margin:0 0 20px">${opts.code}</p>
          <p style="font-size:13px;color:#888;margin:0">Код действует 10 минут. Если это были не вы — просто игнорируйте письмо.</p>
        </div>
      `,
      text: `Ваш код регистрации в Мае: ${opts.code}. Действует 10 минут.`,
    });

    if (error) {
      return { ok: false, error: error.message || "Не удалось отправить письмо" };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка отправки";
    return { ok: false, error: msg };
  }
}
