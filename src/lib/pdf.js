import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseVocabularyText } from "./vocabulary";

GlobalWorkerOptions.workerSrc = pdfWorker;

function linesFromTextItems(items) {
  const rows = new Map();

  for (const item of items) {
    if (!("str" in item) || item.str === "") continue;
    // Group text items sharing similar vertical baseline (tolerance ~3.5 points)
    const y = Math.round(item.transform[5] / 3.5) * 3.5;
    const row = rows.get(y) || [];
    row.push({
      x: item.transform[4],
      width: item.width || 0,
      text: item.str,
    });
    rows.set(y, row);
  }

  return [...rows.entries()]
    .sort(([yA], [yB]) => yB - yA)
    .map(([, row]) => {
      const sorted = row.sort((a, b) => a.x - b.x);
      let line = "";
      let lastX = null;
      let lastWidth = 0;

      for (const item of sorted) {
        if (!item.text) continue;
        if (lastX === null) {
          line += item.text;
        } else {
          const gap = item.x - (lastX + lastWidth);
          // If there is an evident gap (>= 2.5 points) and neither piece has a space, insert one
          if (gap >= 2.5 && !line.endsWith(" ") && !item.text.startsWith(" ")) {
            line += " ";
          }
          line += item.text;
        }
        lastX = item.x;
        lastWidth = item.width;
      }
      return line.trim();
    })
    .filter(Boolean)
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
