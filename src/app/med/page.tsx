import { redirect } from "next/navigation";

/** Мед. карта убрана — старые ссылки ведут на главную. */
export default function MedCardRemoved() {
  redirect("/");
}
