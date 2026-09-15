import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const USERNAME_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const PASSWORD_LOWER = "abcdefghjkmnpqrstuvwxyz";
const PASSWORD_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const PASSWORD_DIGITS = "23456789";
const MAX_ROSTER_BYTES = 2_500_000;
const MAX_STUDENTS = 100;

function randomIndex(length) {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % length;
}

function randomFrom(alphabet) {
  return alphabet[randomIndex(alphabet.length)];
}

function shuffleCharacters(characters) {
  const result = [...characters];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomIndex(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result.join("");
}

export function normalizeStudentPrefix(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16) || "sv";
}

export function makeReadablePassword(length = 10) {
  const all = PASSWORD_LOWER + PASSWORD_UPPER + PASSWORD_DIGITS;
  const characters = [
    randomFrom(PASSWORD_LOWER),
    randomFrom(PASSWORD_UPPER),
    randomFrom(PASSWORD_DIGITS),
  ];
  while (characters.length < length) characters.push(randomFrom(all));
  return shuffleCharacters(characters);
}

export function createDemoStudentAccounts({ students }) {
  const usernames = new Set();
  return students.map((student) => {
    let username;
    do {
      let suffix = "";
      for (let index = 0; index < 6; index += 1) suffix += randomFrom(USERNAME_ALPHABET);
      username = `${normalizeStudentPrefix(student.className)}-${suffix}`;
    } while (usernames.has(username));
    usernames.add(username);
    const initialPwd = makeReadablePassword();
    return {
      id: `demo-${username}`,
      username,
      password: initialPwd,
      initialPassword: initialPwd,
      currentPassword: null,
      hasChangedPassword: false,
      className: student.className,
      displayName: student.displayName,
      rosterRow: student.rowNumber,
      rosterId: "demo-roster",
    };
  });
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function columnNumber(reference) {
  const letters = String(reference || "").match(/[A-Z]+/i)?.[0]?.toUpperCase() || "";
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
}

function columnLetters(number) {
  let value = Number(number);
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function getAttribute(xml, name) {
  return xml.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] || "";
}

function parseSharedStrings(files) {
  const bytes = files["xl/sharedStrings.xml"] || files["xl/sharedstrings.xml"];
  if (!bytes) return [];
  const xml = strFromU8(bytes);
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((text) => decodeXml(text[1]))
      .join(""));
}

function readCellValue(cellXml, sharedStrings) {
  const type = getAttribute(cellXml, "t");
  if (type === "inlineStr" || cellXml.includes("<is>")) {
    return [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((text) => decodeXml(text[1]))
      .join("");
  }
  const raw = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
  if (type === "s") return sharedStrings[Number(raw)] ?? "";
  if (type === "b") return raw === "1" ? "TRUE" : "FALSE";
  if (type === "str") return decodeXml(raw);
  if (raw) return decodeXml(raw);
  const tMatches = [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)];
  if (tMatches.length) {
    return tMatches.map((text) => decodeXml(text[1])).join("");
  }
  return "";
}

function readRows(sheetXml, sharedStrings) {
  return [...sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const cells = new Map();
    for (const cellMatch of rowMatch[2].matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*>[\s\S]*?<\/c>/gi)) {
      cells.set(columnNumber(cellMatch[1]), readCellValue(cellMatch[0], sharedStrings).trim());
    }
    return { rowNumber: Number(rowMatch[1]), cells };
  });
}

function findWorksheet(files) {
  const workbookXml = strFromU8(files["xl/workbook.xml"] || files["xl/Workbook.xml"] || new Uint8Array());
  const sheetMatches = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?>/gi)];
  if (!sheetMatches.length) throw new Error("Không đọc được trang tính đầu tiên trong file Excel.");

  const firstSheetAttrs = sheetMatches[0][1];
  const sheetName = decodeXml(getAttribute(firstSheetAttrs, "name"));
  const relId = getAttribute(firstSheetAttrs, "r:id") || getAttribute(firstSheetAttrs, "id");

  const relsXml = strFromU8(files["xl/_rels/workbook.xml.rels"] || files["xl/_rels/Workbook.xml.rels"] || new Uint8Array());
  const relMatches = [...relsXml.matchAll(/<Relationship\b([^>]*)\/?>/gi)];

  let target = "";
  if (relId) {
    for (const rel of relMatches) {
      const id = getAttribute(rel[1], "Id") || getAttribute(rel[1], "id");
      if (id === relId) {
        target = getAttribute(rel[1], "Target") || getAttribute(rel[1], "target");
        break;
      }
    }
  }

  if (!target) {
    for (const rel of relMatches) {
      const type = getAttribute(rel[1], "Type") || getAttribute(rel[1], "type");
      if (type.toLowerCase().includes("worksheet")) {
        target = getAttribute(rel[1], "Target") || getAttribute(rel[1], "target");
        break;
      }
    }
  }

  if (!target) {
    const candidatePaths = ["xl/worksheets/sheet1.xml", "xl/worksheets/Sheet1.xml", "worksheets/sheet1.xml"];
    for (const path of candidatePaths) {
      if (files[path]) {
        target = path;
        break;
      }
    }
  }

  if (!target) throw new Error("Không tìm thấy dữ liệu trang tính trong file Excel.");

  let clean = String(target || "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (clean.startsWith("/")) clean = clean.slice(1);
  let worksheetPath = clean.startsWith("xl/") ? clean : `xl/${clean}`;

  if (!files[worksheetPath]) {
    const matchedKey = Object.keys(files).find(
      (key) => key.toLowerCase() === worksheetPath.toLowerCase() ||
               key.toLowerCase().endsWith(clean.toLowerCase())
    );
    if (matchedKey) worksheetPath = matchedKey;
  }

  return { sheetName: sheetName || "Trang tính 1", worksheetPath };
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function parseStudentRosterXlsx(file) {
  if (!file) throw new Error("Hãy chọn một file Excel.");
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Danh sách học sinh phải là file .xlsx.");
  if (file.size > MAX_ROSTER_BYTES) throw new Error("File Excel cần nhỏ hơn 2,5 MB.");

  let bytes;
  let files;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    files = unzipSync(bytes);
  } catch {
    throw new Error("Không mở được file Excel. Hãy dùng file .xlsx không đặt mật khẩu.");
  }

  const { sheetName, worksheetPath } = findWorksheet(files);
  const sheetBytes = files[worksheetPath];
  if (!sheetBytes) throw new Error("Trang tính đầu tiên không có dữ liệu.");
  const sharedStrings = parseSharedStrings(files);
  const rows = readRows(strFromU8(sheetBytes), sharedStrings);
  const nameHeaders = new Set([
    "ho va ten", "ho ten", "ten sinh vien", "sinh vien",
    "full name", "name", "ho ten hoc sinh", "ho va ten hoc sinh",
    "ten hoc sinh", "hoc sinh",
  ]);
  const classHeaders = new Set(["lop", "ten lop", "ma lop", "class", "lop hoc"]);
  let headerRow;
  let nameColumn = 0;
  let classColumn = 0;

  for (const row of rows.filter((item) => item.rowNumber <= 20)) {
    let candidateNameColumn = 0;
    let candidateClassColumn = 0;
    for (const [column, value] of row.cells) {
      const normalized = normalizeHeader(value);
      if (nameHeaders.has(normalized)) candidateNameColumn = column;
      if (classHeaders.has(normalized)) candidateClassColumn = column;
    }
    if (candidateNameColumn) {
      headerRow = row;
      nameColumn = candidateNameColumn;
      classColumn = candidateClassColumn;
      break;
    }
  }

  if (!headerRow || !nameColumn) {
    throw new Error('Không tìm thấy cột “Họ và tên”. Hãy đặt tiêu đề cột là “Họ và tên”.');
  }

  const students = rows
    .filter((row) => row.rowNumber > headerRow.rowNumber && row.cells.get(nameColumn))
    .map((row) => ({
      displayName: row.cells.get(nameColumn).slice(0, 120),
      className: (classColumn ? row.cells.get(classColumn) : "")?.slice(0, 80) || "",
      rowNumber: row.rowNumber,
    }));

  if (!students.length) throw new Error("File Excel chưa có học sinh bên dưới cột Họ và tên.");
  if (students.length > MAX_STUDENTS) throw new Error(`Mỗi lần chỉ nhập tối đa ${MAX_STUDENTS} học sinh.`);

  return {
    students,
    workbook: {
      originalFileName: file.name,
      originalFileBase64: bytesToBase64(bytes),
      sheetName,
      worksheetPath,
      headerRow: headerRow.rowNumber,
      nameColumn,
      classColumn: classColumn || null,
    },
  };
}

function inlineCell(reference, value, style = "") {
  const styleAttribute = style === "" ? "" : ` s="${style}"`;
  return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(reference, value, style = "") {
  const styleAttribute = style === "" ? "" : ` s="${style}"`;
  return `<c r="${reference}"${styleAttribute}><v>${Number(value)}</v></c>`;
}

function rowStyle(rowXml, preferredColumn) {
  const preferred = rowXml.match(new RegExp(`<c\\b[^>]*\\br="${columnLetters(preferredColumn)}\\d+"[^>]*>`, "i"))?.[0];
  const fallback = [...rowXml.matchAll(/<c\b[^>]*>/gi)].at(-1)?.[0];
  return getAttribute(preferred || fallback || "", "s");
}

function appendColumnsToWorkbook({ originalFileBase64, worksheetPath, headerRow, nameColumn, rows, columns }) {
  const files = unzipSync(base64ToBytes(originalFileBase64));
  const path = worksheetPath || findWorksheet(files).worksheetPath;
  let sheetXml = strFromU8(files[path] || new Uint8Array());
  if (!sheetXml) throw new Error("Không tìm thấy trang tính gốc để xuất kết quả.");

  const headerPattern = new RegExp(`<row\\b[^>]*\\br="${headerRow}"[^>]*>[\\s\\S]*?<\\/row>`);
  const headerMatch = sheetXml.match(headerPattern);
  if (!headerMatch) throw new Error("Không tìm thấy dòng tiêu đề trong file gốc.");
  const existingColumns = [...sheetXml.matchAll(/<c\b[^>]*\br="([A-Z]+)\d+"/gi)].map((match) => columnNumber(match[1]));
  const firstOutputColumn = Math.max(nameColumn || 1, ...existingColumns) + 1;
  const headerStyle = rowStyle(headerMatch[0], nameColumn);
  const headerCells = columns.map((column, index) => inlineCell(`${columnLetters(firstOutputColumn + index)}${headerRow}`, column.header, headerStyle)).join("");
  sheetXml = sheetXml.replace(headerPattern, headerMatch[0].replace("</row>", `${headerCells}</row>`));

  for (const rowData of rows) {
    const rowPattern = new RegExp(`<row\\b[^>]*\\br="${rowData.rowNumber}"[^>]*>[\\s\\S]*?<\\/row>`);
    const rowMatch = sheetXml.match(rowPattern);
    if (!rowMatch) continue;
    const style = rowStyle(rowMatch[0], nameColumn);
    const cells = columns.map((column, index) => {
      const value = rowData[column.key];
      const reference = `${columnLetters(firstOutputColumn + index)}${rowData.rowNumber}`;
      return column.type === "number" && typeof value === "number"
        ? numberCell(reference, value, style)
        : inlineCell(reference, value ?? "", style);
    }).join("");
    sheetXml = sheetXml.replace(rowPattern, rowMatch[0].replace("</row>", `${cells}</row>`));
  }

  const finalColumn = firstOutputColumn + columns.length - 1;
  const maxRow = Math.max(headerRow, ...rows.map((row) => row.rowNumber));
  sheetXml = sheetXml.replace(/<dimension\b[^>]*\bref="([^"]+)"[^>]*\/?\s*>/, (dimension, reference) => {
    const start = reference.includes(":") ? reference.split(":")[0] : "A1";
    const end = reference.includes(":") ? reference.split(":")[1] : reference;
    const existingLastColumn = columnNumber(end);
    const existingLastRow = Number(end.match(/\d+/)?.[0] || 1);
    return dimension.replace(reference, `${start}:${columnLetters(Math.max(finalColumn, existingLastColumn))}${Math.max(maxRow, existingLastRow)}`);
  });
  const columnDefinitions = columns.map((column, index) => {
    const columnIndex = firstOutputColumn + index;
    return `<col min="${columnIndex}" max="${columnIndex}" width="${column.width || 18}" customWidth="1"/>`;
  }).join("");
  if (/<cols\b[^>]*>/.test(sheetXml)) sheetXml = sheetXml.replace("</cols>", `${columnDefinitions}</cols>`);
  else sheetXml = sheetXml.replace(/<sheetData\b/, `<cols>${columnDefinitions}</cols><sheetData`);

  files[path] = strToU8(sheetXml);
  return zipSync(files, { level: 6 });
}

export function buildRosterCredentialsXlsx(workbook, accounts) {
  return appendColumnsToWorkbook({
    ...workbook,
    rows: accounts.map((account) => ({
      rowNumber: account.rosterRow,
      username: account.username,
      password: account.password || account.initialPassword,
      currentPassword: account.hasChangedPassword && account.currentPassword ? account.currentPassword : "(Chưa đổi)",
    })),
    columns: [
      { key: "username", header: "Tên đăng nhập", width: 24 },
      { key: "password", header: "Mật khẩu ban đầu (1 lần)", width: 22 },
      { key: "currentPassword", header: "Mật khẩu hiện tại (học sinh đổi)", width: 26 },
    ],
  });
}

export function buildRosterResultsXlsx(workbook, resultRows, columns = null) {
  const defaultColumns = [
    { key: "score", header: "Điểm", width: 12, type: "number" },
    { key: "practiceCount", header: "Số lần luyện", width: 14, type: "number" },
    { key: "issue", header: "Lỗi trong quá trình làm bài", width: 30 },
  ];
  return appendColumnsToWorkbook({
    ...workbook,
    rows: resultRows,
    columns: Array.isArray(columns) && columns.length ? columns : defaultColumns,
  });
}

function downloadBytes(bytes, fileName) {
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function outputFileName(originalFileName, suffix) {
  const base = String(originalFileName || "danh-sach-hoc-sinh").replace(/\.xlsx$/i, "");
  return `${base}-${suffix}.xlsx`;
}

export function downloadRosterCredentialsXlsx(workbook, accounts) {
  downloadBytes(buildRosterCredentialsXlsx(workbook, accounts), outputFileName(workbook.originalFileName, "tai-khoan"));
}

export function downloadRosterResultsXlsx(workbook, resultRows, columns = null) {
  downloadBytes(buildRosterResultsXlsx(workbook, resultRows, columns), outputFileName(workbook.originalFileName, "ket-qua"));
}
