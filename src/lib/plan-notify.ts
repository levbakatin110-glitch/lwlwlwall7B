import { MAYA_SITE } from "@/lib/telegram";
import { getResend, resendFromAddress } from "@/lib/resend";
import { PLAN_TOPIC_LABEL } from "@/lib/plan-products";
import { getPlanConsultant } from "@/lib/plan-consultants";
import { sendPushToEmail } from "@/lib/push-send";
import type { PlanOrder } from "@/lib/orders-store";

function planChatUrl(orderId: string) {
  return `${MAYA_SITE}/plan/${encodeURIComponent(orderId)}`;
}

async function sendMomEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
) {
  const resend = getResend();
  if (!resend) {
    console.warn("[plan-notify] RESEND_API_KEY не задан — письмо маме не отправлено");
    return;
  }
  try {
    await resend.emails.send({
      from: resendFromAddress(),
      to,
      subject,
      html,
      text,
    });
  } catch (e) {
    console.error("[plan-notify] mom email failed", e);
  }
}

/** Уведомление маме: команда ответила или отправила план */
export async function notifyMomPlanTeamReply(
  order: PlanOrder,
  input: { text?: string; hasPdf?: boolean },
) {
  const topic = PLAN_TOPIC_LABEL[order.topic];
  const url = planChatUrl(order.id);
  const preview = input.text?.trim().slice(0, 180);
  const consultant = getPlanConsultant(order.consultantId);
  const subject = input.hasPdf
    ? `Мая · ваш персональный план · ${topic}`
    : `Мая · ответ ${consultant.name} · ${topic}`;

  const lead = input.hasPdf
    ? `${consultant.name} отправила персональный план по теме «${topic}».`
    : `${consultant.name} ответила в чате по теме «${topic}».`;

  const text = [
    lead,
    preview ? `\n«${preview}${(input.text?.length ?? 0) > 180 ? "…" : ""}»` : "",
    `\nОткрыть чат: ${url}`,
    "\nНе врач и не экстренная помощь.",
  ]
    .filter(Boolean)
    .join("");

  const html = `<p>${lead}</p>${
    preview
      ? `<p style="color:#555">«${preview.replace(/</g, "&lt;")}${
          (input.text?.length ?? 0) > 180 ? "…" : ""
        }»</p>`
      : ""
  }<p><a href="${url}">Открыть чат в Мае</a></p><p style="font-size:12px;color:#888">Не врач и не экстренная помощь.</p>`;

  await Promise.all([
    sendMomEmail(order.email, subject, html, text),
    sendPushToEmail(order.email, {
      title: input.hasPdf ? "Мая · план готов" : `Мая · ${consultant.name}`,
      body: preview || lead,
      url: `/plan/${encodeURIComponent(order.id)}`,
      tag: `plan-${order.id}`,
    }).catch(() => ({ sent: 0, gone: 0 })),
  ]);
}

/** Уведомление маме: план готов к просмотру (первый PDF) */
export async function notifyMomPlanReady(order: PlanOrder) {
  await notifyMomPlanTeamReply(order, {
    text: "Ваш персональный план готов — откройте чат, чтобы скачать PDF.",
    hasPdf: true,
  });
}
