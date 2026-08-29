import type { PlanTopic } from "@/lib/plan-products";

export type PlanConsultantId = "marina" | "yulia" | "anna";

export type PlanConsultant = {
  id: PlanConsultantId;
  name: string;
  avatar: string;
};

const CONSULTANTS: Record<PlanConsultantId, PlanConsultant> = {
  marina: {
    id: "marina",
    name: "Марина",
    avatar: "/avatars/marina-v2.jpg",
  },
  yulia: {
    id: "yulia",
    name: "Юлия",
    avatar: "/avatars/yulia-v2.jpg",
  },
  anna: {
    id: "anna",
    name: "Анна",
    avatar: "/avatars/anna-v2.jpg",
  },
};

export const PLAN_CONSULTANT_IDS = Object.keys(CONSULTANTS) as PlanConsultantId[];

export function isPlanConsultantId(v: string): v is PlanConsultantId {
  return v === "marina" || v === "yulia" || v === "anna";
}

export function getPlanConsultant(id?: string | null): PlanConsultant {
  if (id && isPlanConsultantId(id)) return CONSULTANTS[id];
  return CONSULTANTS.marina;
}

/** Роль в чате — не «только сон», а живая поддержка мамы */
export function consultantRoleForTopic(_topic: PlanTopic): string {
  return "Консультант для мам";
}

export function consultantRoleShort(_topic: PlanTopic): string {
  return "консультант для мам";
}

export function planFocusLabel(topic: PlanTopic): string {
  return topic === "sleep" ? "план по сну" : "план по кормлению";
}

export function pickConsultantForNewOrder(orderIndex: number): PlanConsultantId {
  return PLAN_CONSULTANT_IDS[orderIndex % PLAN_CONSULTANT_IDS.length]!;
}

export function orderStatusHint(
  status: string,
  consultantName: string,
): string | null {
  const map: Record<string, string> = {
    paid: `${consultantName} готовит разбор — до 24 часов`,
    contacted: `${consultantName} на связи`,
    plan_sent: "План отправлен — можно уточнить в чате",
    clarifying: "Уточняем детали по плану",
    closed: "Разбор завершён",
    accompaniment_active: `Сопровождение с ${consultantName} · месяц`,
    completed: "Завершено",
  };
  return map[status] ?? null;
}

export function systemIntroMessage(consultantName: string): string {
  return `${consultantName} разберёт дневник, составит план и будет на связи в чате. Спрашивайте не только про план — про малыша, режим, кормление, сон, ваш день. Ожидание плана — до 24 часов. Это не врач.`;
}

export function accompanimentIntroMessage(consultantName: string): string {
  return `Сопровождение подключено на 30 дней. ${consultantName} будет смотреть дневник и подсказывать по ходу.`;
}

/** @deprecated */
export const PLAN_TEAM_DISPLAY_NAME = CONSULTANTS.marina.name;
