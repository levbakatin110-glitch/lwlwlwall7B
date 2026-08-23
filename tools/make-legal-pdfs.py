# -*- coding: utf-8 -*-
"""Генерирует только 2 PDF: оферта + политика."""
from pathlib import Path
from fpdf import FPDF

ROOT = Path(r"C:\Users\Глеб и Лев\Desktop\Женщины\mom-ai")
OUT_DIRS = [ROOT / "Документы", ROOT / "public" / "Документы"]
FONT = r"C:\Windows\Fonts\arial.ttf"
FONTB = r"C:\Windows\Fonts\arialbd.ttf"

OP = {
    "full": "Индивидуальный предприниматель Ковалева Полина Андреевна",
    "inn": "344107729380",
    "ogrnip": "325344300155000",
    "address": "400120, Волгоградская обл., г. Волгоград, ул. Елецкая, 91, Российская Федерация",
    "email": "pollilollipop@yandex.ru",
    "site": "https://hey-maya.ru",
    "edition": "31.07.2026",
}


def footer_block():
    return [
        "",
        OP["full"],
        f"ИНН {OP['inn']} · ОГРНИП {OP['ogrnip']}",
        OP["address"],
        f"Email: {OP['email']}",
        f"Сайт: {OP['site']}",
    ]


docs = [
    (
        "1_Публичная_оферта.pdf",
        "ПУБЛИЧНАЯ ОФЕРТА НА ОКАЗАНИЕ ПЛАТНЫХ ИНФОРМАЦИОННЫХ УСЛУГ",
        [
            f"в редакции от {OP['edition']} г.",
            "",
            f"{OP['full']}, ИНН: {OP['inn']}; ОГРНИП: {OP['ogrnip']}, именуемый(ая) «Исполнитель», предлагает заключить Оферту на платные информационные услуги сервиса «Мая» (Maya Premium) на сайте {OP['site']}.",
            "",
            "Акцепт по ст. 437–438 ГК РФ равносилен заключению договора.",
            "",
            "МЕДИЦИНСКИЙ ДИСКЛЕЙМЕР",
            "Услуги не являются медицинской помощью и телемедициной. Это информационный сервис (ИИ-подсказки, дневники). Не заменяет врача. Ответственность за применение информации — на Заказчике.",
            "",
            "ПРЕДМЕТ И ОПЛАТА",
            "Предмет — доступ к Maya Premium на оплаченный срок. Оплата через Prodamus. Цена — на странице /pricing (ориентир 1990 руб./мес). Услуга считается оказанной с активации Premium.",
            "",
            "ВОЗВРАТ",
            f"Заявление на {OP['email']}. Возврат за вычетом оказанного, комиссий и расходов Исполнителя.",
            "",
            "СПОРЫ",
            f"Претензии: {OP['email']}. Суд — по месту регистрации Исполнителя.",
            "",
            f"Полный текст на сайте: {OP['site']}/документы/публичная-оферта",
        ]
        + footer_block(),
    ),
    (
        "2_Политика_персональных_данных.pdf",
        "ПОЛИТИКА ОБРАБОТКИ ПЕРСОНАЛЬНЫХ ДАННЫХ",
        [
            f"в редакции от {OP['edition']} г.",
            "",
            f"Оператор: {OP['full']}, ИНН {OP['inn']}, ОГРНИП {OP['ogrnip']}, {OP['email']}.",
            f"Сайт: {OP['site']} (сервис «Мая»). Политика по ФЗ № 152-ФЗ.",
            "",
            "ЧТО ОБРАБАТЫВАЕМ",
            "Email; данные профиля и дневников ребёнка, которые вносит родитель; чат; фото при загрузке; сведения об оплате (через Prodamus); cookie/технические данные для работы сайта.",
            "",
            "ЗАЧЕМ",
            "Регистрация и доступ к сервису; оказание услуг «Мая»; оплата Premium; поддержка; безопасность сайта. Сервисные письма (код входа) — не реклама.",
            "",
            "КОМУ ПЕРЕДАЁМ",
            "Хостинг VPS в РФ; Prodamus; Resend; провайдер ИИ API — в объёме, нужном для работы. Не продаём данные.",
            "",
            "СРОК",
            "Обычно до 3 лет / до отзыва согласия / срок договора, если закон не требует иного.",
            "",
            "СОГЛАСИЕ",
            "Регистрация и отметка на сайте = согласие на обработку по этой Политике.",
            "",
            f"Отзыв / запросы: {OP['email']}",
            f"Полный текст: {OP['site']}/документы/политика-персональных-данных",
        ]
        + footer_block(),
    ),
]


class Doc(FPDF):
    def footer(self):
        self.set_y(-15)
        self.set_x(self.l_margin)
        self.set_font("ArialRu", "", 8)
        self.set_text_color(120)
        self.cell(0, 10, f"стр. {self.page_no()} · Мая · {OP['site']}", align="C")


def write_line(pdf: Doc, line: str) -> None:
    pdf.set_x(pdf.l_margin)
    if not line:
        pdf.ln(3)
        return
    bold = line.isupper() and len(line) < 80
    pdf.set_font("ArialRu", "B" if bold else "", 11 if bold else 10)
    if bold:
        pdf.ln(2)
    pdf.multi_cell(0, 6 if bold else 5.5, line)


def main() -> None:
    for out in OUT_DIRS:
        out.mkdir(parents=True, exist_ok=True)
    for fname, title, lines in docs:
        pdf = Doc(format="A4")
        pdf.set_auto_page_break(auto=True, margin=18)
        pdf.set_margins(18, 18, 18)
        pdf.add_page()
        pdf.add_font("ArialRu", "", FONT)
        pdf.add_font("ArialRu", "B", FONTB)
        pdf.set_font("ArialRu", "B", 13)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 7, title)
        pdf.ln(4)
        for line in lines:
            write_line(pdf, line)
        for out in OUT_DIRS:
            pdf.output(str(out / fname))
            print("wrote", out / fname)


if __name__ == "__main__":
    main()
