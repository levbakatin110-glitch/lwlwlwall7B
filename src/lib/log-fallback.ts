import type { LogEntryDraft } from "@/lib/ai-context";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** «один», «два» или обычная цифра */
const RU_NUM: Record<string, number> = {
  пол: 0.5,
  половину: 0.5,
  один: 1,
  одна: 1,
  одну: 1,
  одного: 1,
  два: 2,
  две: 2,
  двух: 2,
  три: 3,
  трех: 3,
  трёх: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
};

function parseAmount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (RU_NUM[s] != null) return RU_NUM[s]!;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const AMOUNT =
  "(\\d+(?:[.,]\\d+)?|пол(?:овину)?|один|одну|одного|одна|два|две|двух|три|тр[её]х|четыре|пять|шесть|семь|восемь|девять|десять)";

/**
 * Достаём факт из слов мамы — даже если модель забыла LOG_ENTRY.
 * Это главный источник правды для чипа «Записано» и тоста.
 */
export function inferLogDraftsFromUserText(text: string): LogEntryDraft[] {
  const t = text.trim();
  if (!t) return [];
  const today = todayIso();
  const out: LogEntryDraft[] = [];

  // —— Рост (см) ——  «вырос на сантиметр» / «+1 см» / «рост 68 см»
  const heightLoss = t.match(
    new RegExp(
      `(?:стал\\w*\\s+ниже|уменьшил\\w*|убавил\\w*|минус|−|-)\\s*(?:на\\s*)?${AMOUNT}\\s*(?:см|сантиметр\\w*)`,
      "i",
    ),
  );
  const heightGain = t.match(
    new RegExp(
      `(?:вырос\\w*|прибавил\\w*|стал\\w*\\s+выше|плюс|\\+)\\s*(?:на\\s*)?(?:${AMOUNT}\\s*)?(?:см|сантиметр\\w*)`,
      "i",
    ),
  );
  const heightAbs = t.match(
    /рост\s*(?:сейчас\s*)?(?:[—\-:=]\s*)?(\d{2,3}(?:[.,]\d+)?)\s*(?:см|сантиметр\w*)/i,
  );
  const heightBare = t.match(/(\d+(?:[.,]\d+)?)\s*(?:см|сантиметр\w*)/i);

  if (heightLoss) {
    const n = parseAmount(heightLoss[1]);
    if (n != null) {
      out.push({
        moduleId: "growth",
        date: today,
        value: `−${n} см`,
        note: "убыль роста",
      });
    }
  } else if (heightGain) {
    // «вырос на сантиметр» без числа → +1 см
    const n = parseAmount(heightGain[1]) ?? 1;
    out.push({
      moduleId: "growth",
      date: today,
      value: `+${n} см`,
      note: "прибавка роста",
    });
  } else if (
    /вырос\w*|стал\w*\s+выше/i.test(t) &&
    /сантиметр|\bсм\b/i.test(t) &&
    !/кг|вес|мл/i.test(t)
  ) {
    out.push({
      moduleId: "growth",
      date: today,
      value: "+1 см",
      note: "прибавка роста",
    });
  } else if (heightAbs) {
    const n = parseAmount(heightAbs[1]);
    if (n != null && n >= 40 && n <= 160) {
      out.push({
        moduleId: "growth",
        date: today,
        value: `${n} см`,
        note: "рост",
      });
    }
  } else if (
    heightBare &&
    /рост|вырос|см|сантиметр/i.test(t) &&
    !/кг|вес|мл/i.test(t)
  ) {
    const n = parseAmount(heightBare[1]);
    if (n != null) {
      out.push({
        moduleId: "growth",
        date: today,
        value: n >= 40 ? `${n} см` : `+${n} см`,
        note: n >= 40 ? "рост" : "прибавка роста",
      });
    }
  }

  // —— Вес (кг) ——  «набрал килограмм» / «+1 кг» / «вес 8.2 кг»
  const loss = t.match(
    new RegExp(
      `(?:похудел\\w*|убавил\\w*|минус|−)\\s*(?:на\\s*)?(?:${AMOUNT}\\s*)?(кг|г|гр|грамм\\w*|килограмм\\w*)?`,
      "i",
    ),
  );
  const gain = t.match(
    new RegExp(
      `(?:прибавил\\w*|набрал\\w*|потолстел\\w*|плюс|\\+)\\s*(?:на\\s*)?(?:${AMOUNT}\\s*)?(кг|г|гр|грамм\\w*|килограмм\\w*)?`,
      "i",
    ),
  );
  const wordKgOnly =
    /(?:прибавил\w*|набрал\w*|потолстел\w*)\s+(?:на\s+)?(?:килограмм\w*)|(?:похудел\w*|убавил\w*)\s+(?:на\s+)?(?:килограмм\w*)/i.test(
      t,
    );
  const plainKg = t.match(/([+-]?\d+(?:[.,]\d+)?)\s*(кг|г|гр|грамм)\b/i);
  if (
    (loss || gain || plainKg || wordKgOnly) &&
    /кг|вес|потолстел|похудел|прибавил|набрал|грамм|\bг\b|килограмм/i.test(t)
  ) {
    const m = loss || gain || plainKg;
    let n =
      (m ? parseAmount(m[1]) : null) ?? (wordKgOnly ? 1 : null);
    const unit = ((m && m[2]) || "кг").toLowerCase();
    if (n != null && Number.isFinite(n)) {
      if (unit.startsWith("г") && !unit.startsWith("кг") && !unit.includes("кило")) {
        n = n / 1000;
      }
      const isLoss = Boolean(loss) || /похудел|убавил/i.test(t);
      const isGain =
        Boolean(gain) ||
        (wordKgOnly && /прибавил|набрал|потолстел/i.test(t));
      if (isLoss) n = -Math.abs(n);
      else if (isGain) n = Math.abs(n);
      const isAbs =
        !isLoss &&
        !isGain &&
        Boolean(m) &&
        /вес\s*(?:сейчас\s*)?[—\-:]?\s*\d/i.test(t) &&
        !/^[+-]/.test(m![0]);
      const value = isAbs ? `${n} кг` : n > 0 ? `+${n} кг` : `${n} кг`;
      out.push({
        moduleId: "growth",
        date: today,
        value,
        note: isLoss ? "убыль" : isAbs ? "вес" : "прибавка",
      });
    }
  }

  // —— Смесь ——
  const formula = t.match(/(\d{2,4})\s*мл/i);
  if (formula && /мл|смес|бутыл/i.test(t)) {
    const ml = Number(formula[1]);
    if (ml >= 10 && ml <= 400) {
      const brand = t.match(
        /\b(nutrilon|nan|similac|kabrita|нутрилон|симилак)\b/i,
      );
      out.push({
        moduleId: "formula",
        date: today,
        value: brand ? `${ml} мл · ${brand[1]}` : `${ml} мл`,
        note: "",
        fields: { ml, brand: brand?.[1] || "" },
      });
    }
  }

  // —— ГВ ——
  if (/груд|кормил|покорм|\bгв\b|сосал|левой|правой|слева|справа/i.test(t)) {
    const bfMin = t.match(/(\d{1,3})\s*(?:мин|минут\w*)/i);
    const sideRaw = (
      t.match(/\b(левой|правой|слева|справа|левая|правая)\b/i)?.[1] || ""
    ).toLowerCase();
    const left = /лев|слева/.test(sideRaw);
    const right = /прав|справа/.test(sideRaw);
    const mins = bfMin ? Number(bfMin[1]) : null;
    if (mins != null || left || right) {
      const sideLabel = left ? "левая" : right ? "правая" : "";
      const value =
        mins != null
          ? sideLabel
            ? `${sideLabel} ${mins} мин`
            : `${mins} мин`
          : `кормление · ${sideLabel}`;
      out.push({
        moduleId: "breastfeeding",
        date: today,
        value,
        note: "",
        fields: {
          side: left ? "left" : right ? "right" : "",
          totalSec: mins != null ? mins * 60 : 0,
        },
      });
    }
  }

  // —— Сон ——
  const sleepRange = t.match(
    /(\d{1,2})[:.](\d{2})\s*[–\-—]\s*(\d{1,2})[:.](\d{2})/,
  );
  const sleepHours = t.match(
    /(?:спал\w*|проспал\w*|сон)\s*(?:около\s*)?(\d+(?:[.,]\d+)?)\s*(?:ч|час)/i,
  );
  if (
    sleepRange ||
    sleepHours ||
    /уснул|ночн\w*\s*сон|дневн\w*\s*сон|спал\s+с\s+\d/i.test(t)
  ) {
    const nap = /дневн|дремал|днём/i.test(t);
    let value = "";
    if (sleepRange) {
      value = `${sleepRange[1]}:${sleepRange[2]}–${sleepRange[3]}:${sleepRange[4]}`;
    } else if (sleepHours) {
      value = `${sleepHours[1].replace(",", ".")} ч`;
    } else {
      value = nap ? "дневной сон" : "ночной сон";
    }
    out.push({
      moduleId: "sleep",
      date: today,
      value: `${nap ? "дневной" : "ночь"} ${value}`.replace(/\s+/g, " ").trim(),
      note: "",
      fields: { kind: nap ? "nap" : "night" },
    });
  }

  // —— Прикорм ——
  if (/прикорм|пюре|кабачок|каш[аеи]|ложк|брокколи|тыкв/i.test(t)) {
    const food = t.match(
      /\b(кабачок|тыква|брокколи|яблоко|груша|банан|каша|творог|мясо|рыба|пюре)\b/i,
    )?.[1];
    const tsp = t.match(/(\d+)\s*(?:ч\.?\s*л\.?|чайн\w*\s*лож)/i);
    if (food || tsp || /прикорм/i.test(t)) {
      const portion = tsp ? `${tsp[1]} ч.л.` : "пробование";
      out.push({
        moduleId: "solids",
        date: today,
        value: food ? `${food} · ${portion}` : `прикорм · ${portion}`,
        note: /сыпь|аллерг|отказал/i.test(t) ? "реакция" : "ок",
        fields: {
          food: food || "",
          portion,
          reaction: /сыпь|аллерг/i.test(t)
            ? "rash"
            : /отказал/i.test(t)
              ? "refused"
              : "ok",
        },
      });
    }
  }

  // —— Температура ——
  const temp = t.match(
    /температур\w*\s*(\d{2}(?:[.,]\d)?)|(\d{2}(?:[.,]\d)?)\s*(?:°|градус)/i,
  );
  if (temp && /температур|градус|°|жар|боле/i.test(t)) {
    const v = (temp[1] || temp[2] || "").replace(",", ".");
    const n = Number(v);
    if (n >= 35 && n <= 42) {
      out.push({
        moduleId: "health",
        date: today,
        value: `${v} °C`,
        note: "температура",
      });
    }
  }

  // —— Диета мамы (ккал) ——
  const dietKcal = t.match(/(\d{2,4})\s*ккал/i);
  if (
    dietKcal &&
    /ккал|съел|съела|поел|поела|завтрак|обед|ужин|перекус|диет/i.test(t)
  ) {
    const n = Number(dietKcal[1]);
    if (n >= 30 && n <= 2000) {
      const meal = /завтрак/i.test(t)
        ? "Завтрак"
        : /ужин/i.test(t)
          ? "Ужин"
          : /перекус/i.test(t)
            ? "Перекус"
            : /обед/i.test(t)
              ? "Обед"
              : "Приём";
      out.push({
        moduleId: "diet",
        date: today,
        value: `${meal} · ${n} ккал`,
        note: "",
        fields: { kcal: n, meal: meal.toLowerCase(), food: "" },
      });
    }
  }

  const seen = new Set<string>();
  return out.filter((d) => {
    const k = `${d.moduleId}|${d.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function looksLikeDiaryFact(text: string): boolean {
  return (
    /\d/.test(text) ||
    /кг|см|сантиметр|килограмм|рост|вес|набрал|прибавил|убавил|похудел|потолстел|вырос|грамм|\bг\b|спал|сон|уснул|кормл|груд|прикорм|смес|бутыл|мл|температур|°|градус|прививк|пюре|ложк|ккал|диет|завтрак|обед|ужин/i.test(
      text,
    )
  );
}

/** Склеиваем: факты из текста мамы важнее, чем LOG_ENTRY модели */
export function mergeDiaryDrafts(
  fromUser: LogEntryDraft[],
  fromAi: LogEntryDraft[],
): LogEntryDraft[] {
  const bad = /значение_из_сообщения|^запись$|^ok$/i;
  const out = [...fromUser];
  for (const d of fromAi) {
    if (!d.value?.trim() || bad.test(d.value.trim())) continue;
    const covered = out.some((x) => x.moduleId === d.moduleId);
    if (!covered) out.push(d);
  }
  return out;
}
