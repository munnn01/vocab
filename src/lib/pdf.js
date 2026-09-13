import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseVocabularyText } from "./vocabulary";

GlobalWorkerOptions.workerSrc = pdfWorker;

function linesFromTextItems(items) {
  const rows = new Map();

  for (const item of items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const y = Math.round(item.transform[5] / 3) * 3;
    const row = rows.get(y) || [];
    row.push({ x: item.transform[4], text: item.str.trim() });
    rows.set(y, row);
  }

  return [...rows.entries()]
    .sort(([yA], [yB]) => yB - yA)
    .map(([, row]) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text)
        .join(" "),
    )
    .join("\n");
}

export async function extractVocabularyFromPdf(file, onProgress = () => {}) {
  if (!file || file.type !== "application/pdf") {
    throw new Error("Vui lòng chọn đúng file PDF.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("File PDF cần nhỏ hơn 20 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const task = getDocument({ data: bytes });
  const pdf = await task.promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    pageTexts.push(linesFromTextItems(textContent.items));
    onProgress(Math.round((pageNumber / pdf.numPages) * 100));
  }

  const rawText = pageTexts.join("\n");
  const parsed = parseVocabularyText(rawText);
  return { ...parsed, rawText, pageCount: pdf.numPages };
}
