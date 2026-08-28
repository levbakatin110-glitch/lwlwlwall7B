import { createWriteStream, existsSync } from "fs";
import { join } from "path";
import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";
import { PLAN_TOPIC_LABEL, type PlanTopic } from "@/lib/plan-products";

const FONT_REGULAR = join(
  process.cwd(),
  "node_modules",
  "dejavu-fonts-ttf",
  "ttf",
  "DejaVuSans.ttf",
);
const FONT_BOLD = join(
  process.cwd(),
  "node_modules",
  "dejavu-fonts-ttf",
  "ttf",
  "DejaVuSans-Bold.ttf",
);

function ensureFonts() {
  if (!existsSync(FONT_REGULAR)) {
    throw new Error("Шрифт DejaVu не найден (npm install dejavu-fonts-ttf)");
  }
}

function writeWrapped(
  doc: PDFKit.PDFDocument,
  text: string,
  opts?: { font?: string; size?: number; gap?: number },
) {
  const font = opts?.font ?? "regular";
  const size = opts?.size ?? 11;
  const gap = opts?.gap ?? 6;
  doc.font(font).fontSize(size);
  doc.text(text, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, lineGap: gap });
}

export async function writePlanPdf(opts: {
  outPath: string;
  topic: PlanTopic;
  childName?: string;
  planText: string;
}): Promise<void> {
  ensureFonts();
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const stream = createWriteStream(opts.outPath);
    doc.pipe(stream);
    doc.registerFont("regular", FONT_REGULAR);
    doc.registerFont("bold", FONT_BOLD);

    const topicLabel = PLAN_TOPIC_LABEL[opts.topic];
    const title = `Персональный план · ${topicLabel}`;

    doc.font("bold").fontSize(20).text(title, { align: "left" });
    doc.moveDown(0.4);
    doc.font("regular").fontSize(10).fillColor("#666666");
    if (opts.childName?.trim()) {
      doc.text(`Малыш: ${opts.childName.trim()}`);
    }
    doc.text(
      new Date().toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    );
    doc.moveDown(1);
    doc.fillColor("#111111");

    const blocks = opts.planText.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    for (const block of blocks) {
      const isHeading =
        block.length < 80 &&
        (block.endsWith(":") || /^[А-ЯЁ0-9][^.!?]*$/.test(block));
      if (isHeading) {
        doc.moveDown(0.5);
        writeWrapped(doc, block.replace(/:$/, ""), { font: "bold", size: 13, gap: 4 });
      } else {
        writeWrapped(doc, block, { font: "regular", size: 11, gap: 5 });
      }
      doc.moveDown(0.6);
    }

    doc.moveDown(1);
    doc.font("regular").fontSize(9).fillColor("#888888");
    doc.text(
      "Не замена консультации врача. При тревоге за здоровье ребёнка обратитесь к педиатру.",
    );

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
    doc.on("error", reject);
  });
}
