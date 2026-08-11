import { MODULE_BY_ID, customToDef } from "./modules";
import { getLocalClock } from "./local-time";
import type {
  ChatMessage,
  ChildProfile,
  CustomModule,
  JournalEntry,
  MemoryItem,
  MemoryStory,
  ModuleId,
  WardrobeItem,
  WeatherSnapshot,
} from "./types";

function ageLabel(birthDate: string): string {
  if (!birthDate) return "возраст не указан";
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "возраст не указан";
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return "дата рождения в будущем";
  if (months < 1) {
    const days = Math.max(
      0,
      Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)),
    );
    return `${days} дн.`;
  }
  if (months < 24) return `${months} мес.`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years} г. ${rem} мес.` : `${years} г.`;
}

function sexLabel(sex: ChildProfile["sex"]) {
  if (sex === "girl") return "девочка";
  if (sex === "boy") return "мальчик";
  return "не указан";
}

function recent(entries: JournalEntry[], n = 40) {
  return entries.slice(0, n);
}

function entriesInMonths(entries: JournalEntry[], months: number) {
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  const fromStr = from.toISOString().slice(0, 10);
  return entries.filter((e) => e.date >= fromStr).slice(0, 80);
}

function wardrobeLine(w: WardrobeItem) {
  const temps =
    w.tempMinC != null && w.tempMaxC != null
      ? `, комфорт ${w.tempMinC}…${w.tempMaxC}°C${
          w.tempSource === "user" ? " (по данным мамы — приоритет)" : ""
        }`
      : "";
  const tags = w.weatherTags?.length ? `, теги: ${w.weatherTags.join(", ")}` : "";
  const ai = w.aiDescription ? `. ${w.aiDescription}` : "";
  const note = w.note ? ` (комментарий мамы: ${w.note})` : "";
  const photo = w.imageData ? ", есть фото" : ", без фото";
  return `- id=${w.id} | ${w.name}${temps}${tags}${photo}${ai}${note}`;
}

function fitsWeather(w: WardrobeItem, weather: WeatherSnapshot | null | undefined) {
  if (!weather || w.tempMinC == null || w.tempMaxC == null) return true;
  const t =
    typeof weather.feelsLikeC === "number"
      ? weather.feelsLikeC
      : weather.temperatureC;
  return t >= w.tempMinC - 2 && t <= w.tempMaxC + 2;
}

/** Экспорт для фильтрации фото в чате */
export function wardrobeFitsWeather(
  w: WardrobeItem,
  weather: WeatherSnapshot | null | undefined,
) {
  return fitsWeather(w, weather);
}

export function buildSystemPrompt(input: {
  profile: ChildProfile;
  enabledModules: ModuleId[];
  customModules: CustomModule[];
  wardrobe: WardrobeItem[];
  memories: MemoryItem[];
  memoryStory?: MemoryStory | null;
  journals: Record<string, JournalEntry[]>;
  weather?: WeatherSnapshot | null;
}): string {
  const {
    profile,
    enabledModules,
    customModules,
    wardrobe,
    memories,
    memoryStory,
    journals,
    weather,
  } = input;
  const name = profile.namePending
    ? "малыш (имя ещё не выбрали)"
    : profile.name.trim() || "малыш (имя пока не указано)";

  const connectedTitles = [
    ...enabledModules.map((id) => MODULE_BY_ID[id].title),
    ...customModules.map((c) => c.title),
  ];

  const clock = getLocalClock(profile.city || weather?.city);
  const today = clock.dateIso;

  const lines: string[] = [
    "Ты — «Мая»: тёплая ИИ-помощница для мам с малышом (беременность / грудничок / первый год).",
    "Главное — помнить про ЭТОГО ребёнка и помогать маме, когда голова не варит. Дневники — способ хранить память.",
    "В разговоре никогда не говори «модуль», «схема», «конструктор», «API». Говори: дневник, запомнить, учитывать.",
    "Отвечай по-русски, тепло, конкретно, без нравоучений. Ты не врач — при тревожных симптомах советуй педиатра.",
    "Если известен возраст малыша — опирайся на него: в ответах про сон, кормление, развитие коротко упомяни возраст и типичный ориентир («в ~3 месяца часто…»). Не пугай цифрами и не ставь диагнозы.",
    "Нормы — ориентиры (ВОЗ / типичная практика), не закон. Говори «часто бывает», «многие в этом возрасте», а не «должен». При сомнениях — к педиатру.",
    `Сегодняшняя дата (по местному времени мамы): ${today} — ${clock.dateLabel}.`,
    `Сейчас на часах: ${clock.time} (${clock.cityLabel}, пояс ${clock.timeZone}).`,
    "На вопрос «который час / какое время / сколько времени» отвечай ТОЛЬКО этим временем выше. НЕ округляй до «примерно 14:00» и НЕ выдумывай часы из головы.",
    "",
    "=== Психология ===",
    "Мама думает: «Мая знает про моего малыша» — не «мне открыть дневник».",
    "LOG_ENTRY только если мама в ЭТОМ сообщении явно назвала факт для дневника (сон, кормление, вес/рост, прикорм и т.п.).",
    "Если мама просто болтает, шутит, просит текст/совет без цифр и фактов дневника — НЕ пиши LOG_ENTRY и НЕ говори, что «записала».",
    "Никогда не выдумывай вес, рост, сон или другие показатели. Не копируй примеры служебных строк в ответ.",
    "Когда факт есть: коротко отреагируй и сразу LOG_ENTRY с РЕАЛЬНЫМИ данными из сообщения мамы. Не проси открыть другой экран.",
    "Когда предлагаешь трекинг: коротко спроси и ОБЯЗАТЕЛЬНО добавь служебную строку SUGGEST_MODULE:<id> или CREATE_MODULE:Имя|что помнить.",
    "Если мама пишет про смесь/бутылочку/ГВ/сон/прикорм, а такого дневника ещё нет во «включённых» — предложи завести и поставь SUGGEST_MODULE.",
    "Если дневник уже есть, но пустой — мягко скажи, что можно вести его таймером/бутылочкой в разделе слева (без SUGGEST_MODULE).",
    "Можно предлагать и дневники про саму маму (настроение, восстановление) — если она сама просит → CREATE_MODULE.",
    "«Что надеть» = погода + гардероб малыша + возраст/сезон.",
    "Связывай сон, кормление, рост, здоровье осторожно, без диагнозов.",
    "",
    "=== Рост и вес: запись vs оценка ===",
    "ДВА разных случая — не путай:",
    "A) Мама сообщает факт — СРАЗУ LOG_ENTRY:growth и коротко подтверди. Рост и вес одинаково важны:",
    "   вес: «прибавил 0.1 кг», «похудел на 500 г», «+1 кг», «набрал килограмм» → value=+0.1 кг / −0.5 кг / +1 кг",
    "   рост: «вырос на сантиметр», «вырос на 1 см», «+2 см», «рост 68 см» → value=+1 см / +2 см / 68 см",
    "   Если сказала «сантиметр» или «килограмм» без цифры — считай 1. НЕ отказывайся писать и НЕ требуй сначала «текущий вес» и «дату рождения».",
    "B) Мама спрашивает «это нормально?» / «всё ли ок с ростом?» — тогда можно сказать, чего не хватает для оценки (дата рождения, рост см, точный вес кг), НО если в том же сообщении есть новая цифра или «вырос на сантиметр» — всё равно сначала LOG_ENTRY, потом мягко попроси недостающее.",
    "Никогда не блокируй запись из‑за неполного профиля. Просьба доп. данных — только после записи или когда мама явно просит оценить норму.",
    "Ответ при записи роста такой же живой, как при весе: «Записала +1 см», можно коротко про гардероб если уместно — без лекции.",
    "",
    "=== Что надеть (важно) ===",
    "Если мама спрашивает, во что одеть малыша / на прогулку:",
    "1) Погода уже на виджете — не дублируй длинно °C, можно коротко: «сейчас жарко / прохладно…».",
    "2) Рекомендуй ТОЛЬКО вещи из блока «Подходят под текущую погоду». Смотри комфорт °C вещи vs ощущаемую температуру.",
    "3) Если подходящих вещей НЕТ (жара 30+°C, а в гардеробе только демисезон/зима) — честно скажи: «Сейчас очень жарко, вещи из гардероба не подходят — будет перегрев. Добавьте лёгкую одежду на жару.» НЕ советуй комбинезон/сапоги/куртку в жару.",
    "4) Вещи из блока «Не подходят» — НЕ рекомендуй и НЕ ставь в SHOW_WARDROBE.",
    "5) В тексте для мамы НИКОГДА не пиши id=, demo-, SHOW_WARDROBE, служебные теги. Только название вещи обычным языком.",
    "6) Если есть что посоветовать — в самом конце одна служебная строка: SHOW_WARDROBE:id1,id2 (только подходящие id). Если ничего не подходит — строки SHOW_WARDROBE не будет.",
    "Не выдумывай вещи, которых нет в гардеробе. Если гардероб пуст — попроси добавить фото. Если погоды нет — попроси нажать «Обновить» над чатом. НИКОГДА не проси ввести город вручную.",
    "",
    "=== Служебные строки (в конце; человек их не видит) ===",
    "В обычном тексте маме эти строки и id= писать нельзя — только отдельной последней строкой.",
    "LOG_ENTRY:<id>|date=YYYY-MM-DD|ключ_поля=значение|note=кратко",
    "Пиши LOG_ENTRY только после явного факта от мамы; value бери из её слов, не из примеров.",
    "date = день ФАКТА: если мама сказала «вчера» — вчера; «3 дня назад» — та дата; если день не назван — сегодня. Не подставляй одну дату разным событиям из разных дней.",
    `Формат сна: LOG_ENTRY:sleep|date=${today}|value=ночь 22:00–6:00|note=`,
    `Формат смеси: LOG_ENTRY:formula|date=${today}|value=120 мл|note=`,
    `Формат ГВ: LOG_ENTRY:breastfeeding|date=${today}|value=левая 12 мин|note=`,
    `Формат прикорма: LOG_ENTRY:solids|date=${today}|value=кабачок · 2 ч.л.|note=ок`,
    `Формат роста: LOG_ENTRY:growth|date=${today}|value=значение_из_сообщения|note=кратко`,
    `Формат диеты: LOG_ENTRY:diet|date=${today}|value=Обед · 450 ккал · салат|note=`,
    "Если мама назвала факт по сну/смеси/ГВ/прикорму/росту/диете — ОБЯЗАТЕЛЬНО LOG_ENTRY, не только словами «записала».",
    "date по умолчанию — сегодня. Для дневников без схемы: value=текст|note=…",
    "SHOW_CHART:<id>|<числовое_поле>|6",
    "SHOW_WARDROBE:<id1>,<id2> — только id вещей, которые реально подходят под погоду",
    "CREATE_MODULE:<КороткоеИмя>|<что запоминать>",
    "Пример: CREATE_MODULE:Прикорм|продукты, количество, реакция малыша",
    "SUGGEST_MODULE:<id>",
    `id: ${Object.keys(MODULE_BY_ID).join(", ")}`,
    "EVOLVE_MODULE:<id>|<что ещё запоминать или убрать>",
    "Только реальные id и ключи из списка ниже.",
    "",
    "=== Профиль малыша ===",
    `Имя: ${name}`,
    `Пол: ${sexLabel(profile.sex)}`,
    `Дата рождения: ${profile.birthDate || "не указана"} (${ageLabel(profile.birthDate)})`,
    `Рост при рождении: ${profile.birthHeightCm != null ? `${profile.birthHeightCm} см` : "не указан"}`,
    `Вес при рождении: ${profile.birthWeightKg != null ? `${profile.birthWeightKg} кг` : "не указан"}`,
    `Город: ${profile.city?.trim() || "не указан"}`,
    `Местное время сейчас: ${clock.time} (${clock.cityLabel})`,
    `Аллергии / особенности: ${profile.allergies.trim() || "не указаны"}`,
    `Заметки: ${profile.notes.trim() || "нет"}`,
  ];

  lines.push("", "=== Текущая погода (актуальные данные, не выдумывай) ===");
  if (weather) {
    lines.push(
      `Место: ${weather.city}`,
      `Сейчас: ${weather.temperatureC}°C (ощущается как ${weather.feelsLikeC}°C)`,
      `Условия: ${weather.description}`,
      `Осадки: ${weather.precipitationMm} мм, ветер: ${weather.windKmh} км/ч`,
      "Эти цифры свежие — опирайся на них для совета по одежде. Виджет уже показывает °C маме.",
      "НЕ проси указать город и НЕ говори, что не знаешь погоду — данные уже есть.",
    );
  } else {
    lines.push(
      "Погода ещё подтягивается по местоположению. НЕ проси город текстом. Скажи коротко: «нажмите «Обновить» над чатом» или подождите секунду и спросите снова. Не выдумывай °C.",
    );
  }

  lines.push(
    "",
    `Дневники, которые веду: ${
      connectedTitles.length ? connectedTitles.join(", ") : "пока почти пусто — предложи сон/ГВ/рост"
    }`,
  );

  for (const id of enabledModules) {
    const mod = MODULE_BY_ID[id];
    const entries = recent(journals[id] ?? [], 25);
    lines.push("", `=== ${mod.title} (записи) ===`);
    if (!entries.length) {
      lines.push("записей пока нет — когда пользователь назовёт цифру, сразу LOG_ENTRY");
      continue;
    }
    for (const e of entries) {
      lines.push(`- ${e.date}: ${e.value}${e.note ? ` (${e.note})` : ""}`);
    }
  }

  // Подсказка Мае, чего не хватает для оценки роста
  if (enabledModules.includes("growth")) {
    const growthEntries = journals.growth ?? [];
    const hasCm = growthEntries.some((e) => /\d+(?:[.,]\d+)?\s*см/i.test(e.value));
    const hasAbsKg = growthEntries.some((e) => {
      const m = e.value.match(/([+-]?\d+(?:[.,]\d+)?)\s*кг/i);
      if (!m) return false;
      const n = Math.abs(Number(m[1].replace(",", ".")));
      return n >= 2 && !m[1].startsWith("+") && !/набрал|прибав/i.test(e.value);
    });
    const gaps: string[] = [];
    if (!profile.birthDate?.trim()) gaps.push("дата рождения в профиле");
    if (!hasCm) gaps.push("рост в см");
    if (!hasAbsKg) gaps.push("точный вес в кг (не только +N кг)");
    if (gaps.length) {
      lines.push(
        "",
        "=== Оценка роста: не хватает (только для вопроса «это нормально?») ===",
        `Для вердикта «растёт нормально / нет» не хватает: ${gaps.join(", ")}.`,
        "Важно: если мама просто пишет прибавку/убыль веса ИЛИ роста («вырос на сантиметр», «+1 см») — ВСЁ РАВНО сразу LOG_ENTRY. Не откладывай запись ради этих полей. Просьбу доп. данных — только если спрашивают про норму, и коротко в конце.",
      );
    }
  }

  for (const custom of customModules) {
    const mod = customToDef(custom);
    const all = journals[custom.id] ?? [];
    const halfYear = entriesInMonths(all, 6);
    const entries = halfYear.length ? halfYear : recent(all, 40);
    lines.push("", `=== Память id=${custom.id}: ${mod.title} ===`);
    lines.push(`Описание: ${mod.description}`);
    if (custom.fields?.length) {
      lines.push(
        `Поля (key:label:type): ${custom.fields
          .map((f) => `${f.key}:${f.label}:${f.type}`)
          .join("; ")}`,
      );
    }
    if (custom.chartFieldKey) {
      lines.push(`Поле графика по умолчанию: ${custom.chartFieldKey}`);
    }
    lines.push(`Всего записей: ${all.length}; в ответе до ${entries.length} за ~6 мес.`);
    if (!entries.length) {
      lines.push("записей пока нет — когда пользователь назовёт цифру, сразу LOG_ENTRY");
      continue;
    }
    for (const e of entries) {
      lines.push(`- ${e.date}: ${e.value}${e.note ? ` (${e.note})` : ""}`);
    }
  }

  lines.push("", "=== Гардероб малыша ===");
  lines.push(
    "Температуры с пометкой «по данным мамы» — приоритет. Для «что надеть» опирайся на блоки ниже.",
  );
  if (!wardrobe.length) {
    lines.push("пусто — попроси добавить фото вещей");
  } else if (!weather) {
    for (const w of wardrobe.slice(0, 20)) lines.push(wardrobeLine(w));
  } else {
    const suited = wardrobe.filter((w) => fitsWeather(w, weather));
    const others = wardrobe.filter((w) => !fitsWeather(w, weather));
    const tLabel = Math.round(
      typeof weather.feelsLikeC === "number"
        ? weather.feelsLikeC
        : weather.temperatureC,
    );
    if (suited.length) {
      lines.push(
        `Подходят под текущую погоду (~${tLabel}°C) — ТОЛЬКО из них можно советовать и SHOW_WARDROBE:`,
      );
      for (const w of suited.slice(0, 20)) lines.push(wardrobeLine(w));
    } else {
      lines.push(
        `Подходящих вещей НЕТ (~${tLabel}°C). Не советуй ничего из гардероба для прогулки. Скажи, что сейчас слишком ${tLabel >= 25 ? "жарко" : tLabel <= 0 ? "холодно" : "не подходящая погода"} для имеющихся вещей, и что добавить.`,
      );
    }
    if (others.length) {
      lines.push(
        "Не подходят под эту погоду (НЕ рекомендовать, НЕ показывать в SHOW_WARDROBE):",
      );
      for (const w of others.slice(0, 20)) lines.push(wardrobeLine(w));
    }
  }

  lines.push("", "=== Воспоминания / моменты ===");
  if (!memories.length) lines.push("пока нет");
  else {
    const chronological = [...memories].sort((a, b) => a.date.localeCompare(b.date));
    for (const m of chronological.slice(-12)) {
      lines.push(`- ${m.date}: ${m.text || "(фото без подписи)"}`);
    }
  }

  if (memoryStory?.scenes?.length) {
    lines.push("", "=== Фильм-воспоминание (монтаж Маи) ===");
    lines.push(`«${memoryStory.title}» — ${memoryStory.subtitle}`);
    lines.push(memoryStory.intro);
    for (const s of memoryStory.scenes) {
      lines.push(`- ${s.whenLabel}: ${s.headline}. ${s.line}`);
    }
    lines.push(memoryStory.outro);
    lines.push(
      "Если мама просит рассказать историю малыша / вспомнить путь — опирайся на этот монтаж.",
    );
  }

  const disabled = (Object.keys(MODULE_BY_ID) as ModuleId[]).filter(
    (id) => !enabledModules.includes(id),
  );
  lines.push(
    "",
    `Каталог готовой памяти (можно предложить включить): ${
      disabled.length ? disabled.map((id) => `${id}=${MODULE_BY_ID[id].title}`).join(", ") : "нет"
    }`,
  );

  return lines.join("\n");
}

export type LogEntryDraft = {
  moduleId: string;
  date: string;
  value: string;
  note: string;
  fields?: Record<string, string | number>;
};

function parseLogKv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split("|")) {
    const p = part.trim();
    if (!p) continue;
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    const key = p.slice(0, eq).trim();
    const val = p.slice(eq + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

/** Разбор LOG_ENTRY:id|date=…|field=…|note=… */
export function parseLogEntries(content: string): LogEntryDraft[] {
  const matches = [...content.matchAll(/^LOG_ENTRY:([^\n|]+)(?:\|(.+))?$/gim)];
  const today = new Date().toISOString().slice(0, 10);
  const drafts: LogEntryDraft[] = [];

  for (const m of matches) {
    const moduleId = m[1].trim();
    if (!moduleId) continue;
    const kv = parseLogKv(m[2] || "");
    const date =
      /^\d{4}-\d{2}-\d{2}$/.test(kv.date || "") ? kv.date : today;
    const note = kv.note || "";
    const fields: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(kv)) {
      if (k === "date" || k === "note" || k === "value") continue;
      const num = Number(v.replace(",", "."));
      fields[k] = v !== "" && Number.isFinite(num) && /^-?\d+(\.\d+)?$/.test(v.replace(",", "."))
        ? num
        : v;
    }
    const value =
      kv.value?.trim() ||
      Object.entries(fields)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ") ||
      note ||
      "запись";
    drafts.push({
      moduleId,
      date,
      value,
      note,
      fields: Object.keys(fields).length ? fields : undefined,
    });
  }
  return drafts;
}

export function stripSuggestMarker(content: string): {
  text: string;
  suggestedModuleId?: ModuleId;
  createModulePrompt?: string;
  createModuleTitle?: string;
  evolveModule?: { moduleId: string; instruction: string };
  showCharts?: { moduleId: string; fieldKey: string; months?: number }[];
  showWardrobeIds?: string[];
  logEntries?: LogEntryDraft[];
} {
  const createMatch = content.match(/CREATE_MODULE:(.+)$/im);
  const suggestMatch = content.match(/SUGGEST_MODULE:([a-z_]+)/i);
  const evolveMatch = content.match(/EVOLVE_MODULE:([^|\n]+)\|(.+)$/im);
  const chartMatches = [...content.matchAll(/SHOW_CHART:([^|\n]+)\|([^|\n]+)(?:\|(\d+))?/gi)];
  const wardrobeMatch = content.match(/SHOW_WARDROBE:([^\n]+)/i);
  const logEntries = parseLogEntries(content);

  let text = content
    .replace(/\n?CREATE_MODULE:.+$/gim, "")
    .replace(/\n?SUGGEST_MODULE:[a-z_]+\s*/gi, "")
    .replace(/\n?EVOLVE_MODULE:[^\n]+$/gim, "")
    .replace(/\n?SHOW_CHART:[^\n]+$/gim, "")
    .replace(/\n?SHOW_WARDROBE:[^\n]+$/gim, "")
    .replace(/\n?LOG_ENTRY:[^\n]+$/gim, "")
    // Модель иногда пишет id=demo-romper в тексте — убираем
    .replace(/\s*\(\s*id\s*=\s*[^)]+\)/gi, "")
    .replace(/\bid\s*=\s*[a-z0-9_-]+/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  let createModulePrompt: string | undefined;
  let createModuleTitle: string | undefined;
  if (createMatch?.[1]) {
    const raw = createMatch[1].trim();
    const pipeIdx = raw.indexOf("|");
    if (pipeIdx > 0) {
      createModuleTitle = raw.slice(0, pipeIdx).trim();
      createModulePrompt = raw.slice(pipeIdx + 1).trim() || createModuleTitle;
    } else {
      createModulePrompt = raw;
      createModuleTitle = raw.split(/[,:—\-]/)[0]?.trim().slice(0, 40);
    }
  }

  const suggested = suggestMatch?.[1]?.toLowerCase();
  const evolveModule = evolveMatch
    ? {
        moduleId: evolveMatch[1].trim(),
        instruction: evolveMatch[2].trim(),
      }
    : undefined;
  const showCharts = chartMatches.map((m) => ({
    moduleId: m[1].trim(),
    fieldKey: m[2].trim(),
    months: m[3] ? Number(m[3]) : 6,
  }));

  const showWardrobeIds = wardrobeMatch?.[1]
    ? wardrobeMatch[1]
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6)
    : undefined;

  const charts = showCharts.length ? showCharts : undefined;
  const logs = logEntries.length ? logEntries : undefined;
  const wardrobeIds = showWardrobeIds?.length ? showWardrobeIds : undefined;

  const extra = { showCharts: charts, logEntries: logs, showWardrobeIds: wardrobeIds };

  if (evolveModule) {
    return { text, evolveModule, ...extra };
  }
  if (createModulePrompt) {
    return {
      text,
      createModulePrompt,
      createModuleTitle,
      ...extra,
    };
  }
  if (suggested && suggested in MODULE_BY_ID) {
    return {
      text,
      suggestedModuleId: suggested as ModuleId,
      ...extra,
    };
  }
  return { text, ...extra };
}

/** Найти дневник по id или по названию (если модель ошиблась в id) */
export function resolveDiaryId(
  rawId: string,
  customModules: CustomModule[],
  enabledModules: ModuleId[],
): string | null {
  const id = rawId.trim();
  if (!id) return null;
  if (customModules.some((c) => c.id === id)) return id;
  if ((enabledModules as string[]).includes(id) && id in MODULE_BY_ID) return id;
  if (id in MODULE_BY_ID) return id;

  const lower = id.toLowerCase();
  const byTitle = customModules.find(
    (c) =>
      c.title.toLowerCase() === lower ||
      c.title.toLowerCase().includes(lower) ||
      lower.includes(c.title.toLowerCase()),
  );
  if (byTitle) return byTitle.id;

  const builtin = (Object.keys(MODULE_BY_ID) as ModuleId[]).find((mid) => {
    const t = MODULE_BY_ID[mid].title.toLowerCase();
    return t === lower || t.includes(lower) || lower.includes(t);
  });
  return builtin ?? null;
}

/** Без фото — чтобы не слать огромные base64 в чат */
export function wardrobeForChat(items: WardrobeItem[]): WardrobeItem[] {
  return items.map(({ imageData: _img, labelImageData: _label, ...rest }) => rest);
}

export type ClientChatPayload = {
  messages: Pick<ChatMessage, "role" | "content">[];
  profile: ChildProfile;
  enabledModules: ModuleId[];
  customModules: CustomModule[];
  wardrobe: WardrobeItem[];
  memories: MemoryItem[];
  memoryStory?: MemoryStory | null;
  journals: Record<string, JournalEntry[]>;
  /** Геолокация браузера — точнее города, если без VPN и рядом с профилем */
  coords?: { latitude: number; longitude: number } | null;
};
