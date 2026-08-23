import type { PregnancyProfile } from "@/lib/pregnancy";
import { pregnancyAgeLabel } from "@/lib/pregnancy";
import type { JournalEntry } from "@/lib/types";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function recent(list: JournalEntry[] | undefined, n = 8) {
  return [...(list ?? [])].slice(0, n);
}

/** PDF: план родов */
export function openBirthPlanPdf(pregnancy: PregnancyProfile) {
  const age = pregnancy.dueDate
    ? pregnancyAgeLabel(pregnancy.dueDate, pregnancy.lmpDate)
    : null;
  const body = pregnancy.birthPlan?.trim() || "Пока пусто — заполните в Мае.";
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>
<title>План родов · Мая</title>
<style>
body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;line-height:1.5;color:#1a1a1a}
h1{font-size:1.5rem} .muted{color:#666;font-size:.9rem}
pre{white-space:pre-wrap;border:1px solid #ddd;border-radius:12px;padding:16px;background:#fafafa}
@media print{.no-print{display:none}}
</style></head><body>
<p class="no-print muted">Печать → «Сохранить как PDF». <button onclick="window.print()">Печать / PDF</button></p>
<h1>План родов</h1>
<p class="muted">Сервис Мая (hey-maya.ru)${age ? ` · срок ${esc(age)}` : ""}${
    pregnancy.dueDate ? ` · ПДР ${esc(pregnancy.dueDate)}` : ""
  }</p>
<pre>${esc(body)}</pre>
<p class="muted">Это пожелания мамы, не медицинский документ. Решения принимаются с врачом.</p>
<script>setTimeout(function(){window.print()},250)</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    alert("Разрешите всплывающие окна — так сохраняется PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

/** PDF: подготовка к приёму */
export function openAppointmentPrepPdf(opts: {
  pregnancy: PregnancyProfile;
  journals: Record<string, JournalEntry[]>;
}) {
  const { pregnancy, journals } = opts;
  const age = pregnancy.dueDate
    ? pregnancyAgeLabel(pregnancy.dueDate, pregnancy.lmpDate)
    : null;
  const rows = (id: string, title: string) => {
    const list = recent(journals[id]);
    if (!list.length) return `<p class="muted">${esc(title)}: пока нет записей</p>`;
    return `<h3>${esc(title)}</h3><ul>${list
      .map(
        (e) =>
          `<li><strong>${esc(e.date)}</strong> — ${esc(e.value)}${
            e.note ? ` <span class="muted">(${esc(e.note)})</span>` : ""
          }</li>`,
      )
      .join("")}</ul>`;
  };

  const questions =
    pregnancy.doctorQuestions?.trim() ||
    "— Что важно проверить на этом сроке?\n— Какие анализы ещё сдать?\n— Когда ехать в роддом?";

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>
<title>К приёму · Мая</title>
<style>
body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;line-height:1.5;color:#1a1a1a}
h1{font-size:1.5rem} h3{margin-top:1.2rem;font-size:1.05rem}
.muted{color:#666;font-size:.9rem} pre{white-space:pre-wrap;border:1px solid #ddd;border-radius:12px;padding:12px;background:#fafafa}
ul{padding-left:1.2rem} @media print{.no-print{display:none}}
</style></head><body>
<p class="no-print muted">Печать → «Сохранить как PDF». <button onclick="window.print()">Печать / PDF</button></p>
<h1>Подготовка к приёму</h1>
<p class="muted">Мая · hey-maya.ru${age ? ` · ${esc(age)}` : ""}${
    pregnancy.dueDate ? ` · ПДР ${esc(pregnancy.dueDate)}` : ""
  }</p>
<h3>Вопросы врачу</h3>
<pre>${esc(questions)}</pre>
${rows("preg_weight", "Вес")}
${rows("preg_pressure", "Давление")}
${rows("kicks", "Шевеления")}
${rows("contractions", "Схватки")}
${rows("preg_symptoms", "Самочувствие")}
${rows("preg_labs", "Анализы")}
${rows("preg_meds", "Лекарства")}
${rows("preg_visits", "Визиты")}
<p class="muted">Ориентир для разговора с врачом, не замена консультации.</p>
<script>setTimeout(function(){window.print()},250)</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    alert("Разрешите всплывающие окна — так сохраняется PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();
}
