import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Удаление аккаунта · Дневник малыша: Мая",
  description:
    "Как запросить удаление аккаунта и связанных данных в приложении «Дневник малыша: Мая».",
};

export default function DeleteAccountPage() {
  const o = LEGAL_OPERATOR;

  return (
    <LegalShell title="Удаление аккаунта">
      <p>
        Приложение «Дневник малыша: Мая» на сайте hey-maya.ru. Разработчик:{" "}
        {o.fullName}
        {o.inn ? `, ИНН ${o.inn}` : ""}.
      </p>

      <h2 className="font-display pt-4 text-xl font-semibold">
        Как запросить удаление
      </h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Напишите письмо на{" "}
          <a className="text-accent underline" href={`mailto:${o.email}`}>
            {o.email}
          </a>{" "}
          с той почты, на которую зарегистрирован аккаунт.
        </li>
        <li>В теме письма укажите: Удаление аккаунта.</li>
        <li>
          В тексте напишите почту аккаунта в приложении «Дневник малыша: Мая».
        </li>
      </ol>
      <p>
        После письма мы удалим аккаунт и связанные с ним данные: дневник,
        профиль и сведения об аккаунте. Ответ придёт на это же письмо. Обычно
        это занимает до 30 дней.
      </p>
    </LegalShell>
  );
}
