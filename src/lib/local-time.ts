/** Локальные часы по городу профиля — чтобы Мая не выдумывала время. */

const CITY_TZ: { re: RegExp; tz: string; label: string }[] = [
  { re: /улан[-\s]?уд[эе]|ulan[-\s]?ude/i, tz: "Asia/Irkutsk", label: "Улан-Удэ" },
  { re: /иркутск/i, tz: "Asia/Irkutsk", label: "Иркутск" },
  { re: /москва|moscow/i, tz: "Europe/Moscow", label: "Москва" },
  { re: /санкт[-\s]?петербург|питер|spb|petersburg/i, tz: "Europe/Moscow", label: "Санкт-Петербург" },
  { re: /новосибирск/i, tz: "Asia/Novosibirsk", label: "Новосибирск" },
  { re: /красноярск/i, tz: "Asia/Krasnoyarsk", label: "Красноярск" },
  { re: /владивосток/i, tz: "Asia/Vladivostok", label: "Владивосток" },
  { re: /хабаровск/i, tz: "Asia/Vladivostok", label: "Хабаровск" },
  { re: /якутск/i, tz: "Asia/Yakutsk", label: "Якутск" },
  { re: /екатеринбург|екб/i, tz: "Asia/Yekaterinburg", label: "Екатеринбург" },
  { re: /казань/i, tz: "Europe/Moscow", label: "Казань" },
  { re: /сочи|краснодар/i, tz: "Europe/Moscow", label: "юг РФ" },
  { re: /калининград/i, tz: "Europe/Kaliningrad", label: "Калининград" },
  { re: /омск/i, tz: "Asia/Omsk", label: "Омск" },
  { re: /томск|барнаул|кемерово/i, tz: "Asia/Novosibirsk", label: "Сибирь" },
  { re: /чита/i, tz: "Asia/Yakutsk", label: "Чита" },
  { re: /магадан/i, tz: "Asia/Magadan", label: "Магадан" },
  { re: /камчатк|петропавловск/i, tz: "Asia/Kamchatka", label: "Камчатка" },
];

export type LocalClock = {
  timeZone: string;
  cityLabel: string;
  /** ЧЧ:ММ */
  time: string;
  /** день недели, дата */
  dateLabel: string;
  /** YYYY-MM-DD в этом поясе */
  dateIso: string;
};

export function resolveCityTimeZone(city?: string | null): {
  tz: string;
  label: string;
} {
  const c = (city || "").trim();
  if (c) {
    for (const row of CITY_TZ) {
      if (row.re.test(c)) return { tz: row.tz, label: row.label };
    }
  }
  // fallback: часовой пояс среды выполнения (часто совпадает с мамой на localhost)
  let tz = "UTC";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    tz = "UTC";
  }
  return { tz, label: c || "ваше место" };
}

export function getLocalClock(city?: string | null, now = new Date()): LocalClock {
  const { tz, label } = resolveCityTimeZone(city);
  const time = now.toLocaleTimeString("ru-RU", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateLabel = now.toLocaleDateString("ru-RU", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // YYYY-MM-DD в целевом поясе
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  const dateIso = y && m && d ? `${y}-${m}-${d}` : now.toISOString().slice(0, 10);

  return {
    timeZone: tz,
    cityLabel: label,
    time,
    dateLabel,
    dateIso,
  };
}
