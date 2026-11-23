/** Ориентиры скачков развития по возрасту. Не расписание и не диагноз. */

export type LeapPhase = "ahead" | "storm" | "sunny" | "past";

export type LeapDef = {
  n: number;
  title: string;
  /** День жизни, с которого обычно капризничает. День рождения = 0 */
  stormStart: number;
  stormEnd: number;
  about: string;
  games: string[];
  skills: string[];
};

export const LEAPS: LeapDef[] = [
  {
    n: 1,
    title: "Ощущения",
    stormStart: 29,
    stormEnd: 36,
    about:
      "Мир перестаёт быть одним пятном. Свет, звук, голод и ваши руки становятся разными. От этого малыш чаще просится к вам и хуже засыпает.",
    games: [
      "Говорите лицом к лицу, медленно",
      "Тихо спойте одну и ту же песенку",
      "Поводите яркой игрушкой недалеко от глаз",
    ],
    skills: [
      "Дольше смотрит на лицо",
      "Вздрагивает от резкого звука",
      "Успокаивается на руках",
    ],
  },
  {
    n: 2,
    title: "Повторы",
    stormStart: 51,
    stormEnd: 60,
    about:
      "Он начинает узнавать простое: ваше лицо, голос, ритм укачивания. Одинаковое успокаивает, новое может бесить.",
    games: [
      "Короткое «ку-ку» ладошками",
      "Один и тот же стишок каждый день",
      "Покажите две контрастные картинки",
    ],
    skills: ["Улыбается в ответ", "Следит за лицом", "Узнаёт голос"],
  },
  {
    n: 3,
    title: "Плавные перемены",
    stormStart: 77,
    stormEnd: 88,
    about:
      "Он замечает, как меняется звук и как вы приближаетесь. Мир уже не прыгает кусками, и это тоже утомляет.",
    games: [
      "Спойте громче, потом тише",
      "Медленно подкатите мячик",
      "Походите так, чтобы он видел, как вы подходите",
    ],
    skills: ["Гулит", "Увереннее держит голову", "Тянется к игрушке"],
  },
  {
    n: 4,
    title: "События",
    stormStart: 112,
    stormEnd: 133,
    about:
      "Появляется «я сделал, и что-то случилось»: погремушка звучит, потому что он её трясёт. Проверяет это снова и снова.",
    games: [
      "Погремушка, которую можно схватить",
      "Помните бумагу вместе",
      "Прячьте игрушку под платок на секунду",
    ],
    skills: ["Хватает и тянет в рот", "Смеётся в голос", "Переворачивается охотнее"],
  },
  {
    n: 5,
    title: "Свои и чужие",
    stormStart: 154,
    stormEnd: 182,
    about:
      "Мама становится отдельным человеком. Когда вы уходите из комнаты, для него это событие, не мелочь.",
    games: [
      "Прятки за дверью на пару секунд",
      "Посмотрите вместе в зеркало",
      "Дайте две игрушки и заберите одну",
    ],
    skills: [
      "Отличает своих",
      "Перекладывает игрушку из руки в руку",
      "Может заплакать, если вы скрылись",
    ],
  },
  {
    n: 6,
    title: "Группы",
    stormStart: 231,
    stormEnd: 266,
    about:
      "Он раскладывает мир по кучкам: еда отдельно, собака отдельно, мяч отдельно. Любит, когда вы называете.",
    games: [
      "Две кучки: машинки и кубики",
      "Спросите «где мяч?» и покажите",
      "Книжка с одной большой картинкой",
    ],
    skills: ["Показывает пальцем", "Понимает несколько слов", "Машет «пока»"],
  },
  {
    n: 7,
    title: "Порядок",
    stormStart: 301,
    stormEnd: 336,
    about:
      "Он видит цепочку: сначала носок, потом ботинок. Если привычный порядок ломается, может капризничать.",
    games: [
      "Пирамидка из двух-трёх колец",
      "Положить в коробку и достать",
      "Повторите одно бытовое действие дважды",
    ],
    skills: ["Первые осмысленные слова", "Подражает жестам", "Любит повторять"],
  },
  {
    n: 8,
    title: "Сценарии",
    stormStart: 364,
    stormEnd: 399,
    about:
      "Появляются свои маленькие истории: покормить мишку, уложить куклу. Игра уже не про одну игрушку, а про действие.",
    games: [
      "Покормите мишку ложкой",
      "Уложите куклу и накройте",
      "Покажите, как вы сами пьёте из чашки",
    ],
    skills: ["Показывает части тела", "Подражает быту", "Играет рядом с вами"],
  },
  {
    n: 9,
    title: "Правила",
    stormStart: 427,
    stormEnd: 469,
    about:
      "Он пробует границы: так можно, так нет, и смотрит, что вы сделаете. Это проверка, не характер.",
    games: [
      "Разложите два цвета по мискам",
      "Простая игра «дай мне» и «на»",
      "Одна понятная граница, без длинных объяснений",
    ],
    skills: ["Несколько слов подряд", "Понимает «нельзя»", "Тащит вас показать"],
  },
  {
    n: 10,
    title: "Целая картина",
    stormStart: 497,
    stormEnd: 539,
    about:
      "Куски собираются в день: дом, семья, прогулка. Ломается привычный ход, и он это замечает сильнее, чем раньше.",
    games: [
      "Сюжет из двух шагов: взять и отнести",
      "Книжка, где на странице одно действие",
      "Проговорите, что будет дальше: «сейчас есть, потом гулять»",
    ],
    skills: ["Понимает простую просьбу", "Узнаёт себя", "Держится своего порядка"],
  },
];

export function parseBirth(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function addDays(base: Date, days: number): Date {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/** Сколько полных дней от даты рождения до дня now. */
export function dayOfLife(birthIso: string, now = new Date()): number | null {
  const birth = parseBirth(birthIso);
  if (!birth) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = today.getTime() - birth.getTime();
  return Math.round(ms / 86_400_000);
}

export function currentLeapIndex(day: number): number {
  for (let i = 0; i < LEAPS.length; i++) {
    const leap = LEAPS[i]!;
    const next = LEAPS[i + 1];
    if (day < leap.stormStart) return Math.max(0, i - 1);
    if (!next || day < next.stormStart) return i;
  }
  return LEAPS.length - 1;
}

export function leapPhase(leap: LeapDef, day: number): LeapPhase {
  const index = LEAPS.findIndex((item) => item.n === leap.n);
  const next = LEAPS[index + 1];
  if (day < leap.stormStart) return "ahead";
  if (day <= leap.stormEnd) return "storm";
  if (next && day >= next.stormStart) return "past";
  return "sunny";
}

export function leapWindow(leap: LeapDef): { start: number; end: number } {
  const index = LEAPS.findIndex((item) => item.n === leap.n);
  const next = LEAPS[index + 1];
  const start = Math.max(0, leap.stormStart - 4);
  const end = next
    ? Math.max(leap.stormEnd + 6, next.stormStart - 1)
    : leap.stormEnd + 14;
  return { start, end };
}

export function formatLeapDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

/** За сколько дней до капризной фазы предупреждаем. Бесплатно. */
export const LEAP_PUSH_DAYS_BEFORE = 2;

export type LeapPushKind = "soon" | "start";

export type LeapPush = {
  id: string;
  leap: LeapDef;
  kind: LeapPushKind;
  at: Date;
};

function atHour(day: Date, hour: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0);
}

/** Ближайшие пуши скачка: за 2 дня и утром в первый день. Дальше 36 дней не ставим. */
export function upcomingLeapPushes(birthIso: string, now = new Date()): LeapPush[] {
  const birth = parseBirth(birthIso);
  if (!birth) return [];
  const from = now.getTime() - 2 * 60 * 60 * 1000;
  const until = now.getTime() + 36 * 24 * 60 * 60 * 1000;
  const out: LeapPush[] = [];
  for (const leap of LEAPS) {
    const soon = atHour(addDays(birth, Math.max(0, leap.stormStart - LEAP_PUSH_DAYS_BEFORE)), 10);
    const start = atHour(addDays(birth, leap.stormStart), 10);
    if (soon.getTime() >= from && soon.getTime() <= until) {
      out.push({ id: `leap-${leap.n}-soon`, leap, kind: "soon", at: soon });
    }
    if (start.getTime() >= from && start.getTime() <= until) {
      out.push({ id: `leap-${leap.n}-start`, leap, kind: "start", at: start });
    }
  }
  return out;
}

export function leapPushText(kind: LeapPushKind, leap: LeapDef): { title: string; body: string } {
  if (kind === "soon") {
    return {
      title: `Мая · скоро скачок ${leap.n}`,
      body: `Через пару дней обычно неспокойнее: «${leap.title}». Чаще на руках, это не поломка.`,
    };
  }
  return {
    title: `Мая · скачок ${leap.n}`,
    body: `Неделя «${leap.title}». Если больше капризов, так в эти дни бывает.`,
  };
}
