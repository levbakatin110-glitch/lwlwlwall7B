import { ageLabelRu, formatDayLabel, formatDurationRu } from "@/lib/day-summary";
import { childDisplayName } from "@/lib/children";
import {
  ageMonths,
  parseHeightCm,
  parseWeightKg,
} from "@/lib/growth-norms";
import {
  ageMonthsAt,
  estimateWhoPercentile,
} from "@/lib/who-growth";
import type { ChildProfile, JournalEntry, Sex } from "@/lib/types";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dayEntries(
  journals: Record<string, JournalEntry[]>,
  date: string,
  id: string,
) {
  return (journals[id] ?? []).filter((e) => e.date === date);
}

function sumSleepSec(list: JournalEntry[]) {
  return list.reduce((s, e) => {
    const n = Number(e.fields?.totalSec);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function sumFormulaMl(list: JournalEntry[]) {
  return list.reduce((s, e) => {
    const n = Number(e.fields?.ml);
    if (Number.isFinite(n) && n > 0) return s + n;
    const m = e.value.match(/(\d+)\s*мл/i);
    return s + (m ? Number(m[1]) : 0);
  }, 0);
}

function growthLines(
  journals: Record<string, JournalEntry[]>,
  profile: ChildProfile,
) {
  const list = [...(journals.growth ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const rows: string[] = [];
  for (const e of list.slice(-12)) {
    const w = parseWeightKg(e.value);
    const h = parseHeightCm(e.value);
    const age = ageMonthsAt(profile.birthDate, e.date);
    let who = "";
    if (w && !w.delta && age != null) {
      const hint = estimateWhoPercentile({
        sex: profile.sex,
        metric: "weight",
        months: age,
        value: w.kg,
      });
      who = ` · ВОЗ вес: ${hint.label}`;
    } else if (h && !h.delta && age != null) {
      const hint = estimateWhoPercentile({
        sex: profile.sex,
        metric: "length",
        months: age,
        value: h.cm,
      });
      who = ` · ВОЗ рост: ${hint.label}`;
    }
    rows.push(
      `<tr><td>${esc(e.date)}</td><td>${esc(e.value)}${e.note ? ` <span class="muted">(${esc(e.note)})</span>` : ""}${esc(who)}</td></tr>`,
    );
  }
  return rows;
}

function sexRu(sex: Sex) {
  if (sex === "girl") return "девочка";
  if (sex === "boy") return "мальчик";
  return "не указан";
}

/** HTML-отчёт → окно печати («Сохранить как PDF») */
export function openDoctorReportPdf(opts: {
  profile: ChildProfile;
  journals: Record<string, JournalEntry[]>;
  /** день для детализации */
  date: string;
  verdict?: string | null;
}) {
  const { profile, journals, date, verdict } = opts;
  const name = childDisplayName(profile);
  const age = ageLabelRu(profile.birthDate);
  const months = ageMonths(profile.birthDate);

  const sleep = dayEntries(journals, date, "sleep");
  const bf = dayEntries(journals, date, "breastfeeding");
  const formula = dayEntries(journals, date, "formula");
  const solids = dayEntries(journals, date, "solids");
  const diaper = dayEntries(journals, date, "diaper");
  const walk = dayEntries(journals, date, "walk");
  const water = dayEntries(journals, date, "water");
  const health = dayEntries(journals, date, "health");
  const vaccines = dayEntries(journals, date, "vaccines");
  const notes = dayEntries(journals, date, "notes");

  const sleepSec = sumSleepSec(sleep);
  const formulaMl = sumFormulaMl(formula);

  const listBlock = (title: string, list: JournalEntry[]) => {
    if (!list.length) return "";
    const items = list
      .map(
        (e) =>
          `<li><strong>${esc(e.value)}</strong>${e.note ? ` — ${esc(e.note)}` : ""}</li>`,
      )
      .join("");
    return `<h3>${esc(title)} (${list.length})</h3><ul>${items}</ul>`;
  };

  const growth = growthLines(journals, profile).join("") ||
    `<tr><td colspan="2" class="muted">Записей роста/веса пока нет</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<title>Отчёт — ${esc(name)} — ${esc(date)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; max-width: 720px; margin: 24px auto; padding: 0 16px; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 22px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 14px 0 6px; }
  .muted { color: #666; font-size: 12px; }
  .meta { margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td, th { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  ul { margin: 0; padding-left: 18px; }
  li { margin: 3px 0; }
  .disclaimer { margin-top: 28px; font-size: 11px; color: #666; }
  @media print { body { margin: 0; } .no-print { display: none; } }
</style>
</head>
<body>
  <p class="no-print muted">Нажмите «Печать» → «Сохранить как PDF». <button onclick="window.print()">Печать / PDF</button></p>
  <h1>Отчёт для педиатра</h1>
  <div class="meta muted">
    <div><strong>${esc(name)}</strong>${age ? ` · ${esc(age)}` : ""}${months != null ? ` (~${months} мес.)` : ""}</div>
    <div>Пол: ${esc(sexRu(profile.sex))}${profile.birthDate ? ` · дата рождения: ${esc(profile.birthDate)}` : ""}</div>
    <div>День среза: ${esc(formatDayLabel(date))} (${esc(date)})</div>
    <div>Сформировано в Мае · ${esc(new Date().toLocaleString("ru-RU"))}</div>
  </div>

  <h2>Сводка за день</h2>
  <table>
    <tr><th>Показатель</th><th>Значение</th></tr>
    <tr><td>Сон</td><td>${sleepSec > 0 ? esc(formatDurationRu(sleepSec)) : "—"} (${sleep.length} зап.)</td></tr>
    <tr><td>ГВ</td><td>${bf.length} раз</td></tr>
    <tr><td>Смесь</td><td>${formulaMl > 0 ? `${formulaMl} мл` : "—"} (${formula.length} раз)</td></tr>
    <tr><td>Прикорм</td><td>${solids.length} зап.</td></tr>
    <tr><td>Подгузник</td><td>${diaper.length} зап.</td></tr>
    <tr><td>Прогулка / вода</td><td>${walk.length} / ${water.length}</td></tr>
  </table>

  ${listBlock("Сон", sleep)}
  ${listBlock("Грудное вскармливание", bf)}
  ${listBlock("Смесь", formula)}
  ${listBlock("Прикорм", solids)}
  ${listBlock("Подгузник", diaper)}
  ${listBlock("Здоровье", health)}
  ${listBlock("Прививки", vaccines)}
  ${listBlock("Заметки", notes)}

  <h2>Рост и вес (последние записи)</h2>
  <table>
    <tr><th>Дата</th><th>Запись</th></tr>
    ${growth}
  </table>

  ${
    verdict
      ? `<h2>Заметка мамы / Маи</h2><p>${esc(verdict)}</p>`
      : ""
  }

  <p class="disclaimer">
    Документ сформирован приложением «Мая» для удобства мамы. Это не медицинское заключение.
    Ориентиры ВОЗ в приложении упрощены; решения принимает педиатр.
  </p>
  <script>setTimeout(function(){ window.print(); }, 250);</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Разрешите всплывающие окна — так сохраняется PDF.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
