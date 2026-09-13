import { strToU8, zipSync } from "fflate";

const USERNAME_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const PASSWORD_LOWER = "abcdefghjkmnpqrstuvwxyz";
const PASSWORD_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const PASSWORD_DIGITS = "23456789";

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
  return value
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

export function createDemoStudentAccounts({ className, prefix, count }) {
  const normalizedPrefix = normalizeStudentPrefix(prefix || className);
  const usernames = new Set();
  const accounts = [];
  while (accounts.length < count) {
    let suffix = "";
    for (let index = 0; index < 6; index += 1) suffix += randomFrom(USERNAME_ALPHABET);
    const username = `${normalizedPrefix}-${suffix}`;
    if (usernames.has(username)) continue;
    usernames.add(username);
    accounts.push({
      id: `demo-${username}`,
      username,
      password: makeReadablePassword(),
      className,
      displayName: `Sinh viên ${String(accounts.length + 1).padStart(2, "0")}`,
    });
  }
  return accounts;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function inlineCell(reference, value, style = 0) {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(reference, value, style = 0) {
  return `<c r="${reference}" s="${style}"><v>${Number(value)}</v></c>`;
}

export function buildStudentAccountsXlsx(accounts, { className, loginUrl }) {
  const rows = accounts.map((account, index) => {
    const row = index + 4;
    return `<row r="${row}" ht="22" customHeight="1">${numberCell(`A${row}`, index + 1, 3)}${inlineCell(`B${row}`, account.displayName, 3)}${inlineCell(`C${row}`, account.username, 4)}${inlineCell(`D${row}`, account.password, 4)}${inlineCell(`E${row}`, account.className || className, 3)}${inlineCell(`F${row}`, loginUrl, 5)}</row>`;
  }).join("");
  const lastRow = Math.max(4, accounts.length + 3);
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="1" width="7" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/><col min="3" max="3" width="24" customWidth="1"/><col min="4" max="4" width="19" customWidth="1"/><col min="5" max="5" width="18" customWidth="1"/><col min="6" max="6" width="34" customWidth="1"/></cols>
  <sheetData>
    <row r="1" ht="28" customHeight="1">${inlineCell("A1", "TÀI KHOẢN SINH VIÊN", 1)}</row>
    <row r="2" ht="22" customHeight="1">${inlineCell("A2", `Lớp: ${className} · Giữ kín mật khẩu và cấp riêng cho từng sinh viên.`, 2)}</row>
    <row r="3" ht="24" customHeight="1">${inlineCell("A3", "STT", 2)}${inlineCell("B3", "Tên hiển thị", 2)}${inlineCell("C3", "Tên đăng nhập", 2)}${inlineCell("D3", "Mật khẩu", 2)}${inlineCell("E3", "Lớp", 2)}${inlineCell("F3", "Đường dẫn đăng nhập", 2)}</row>
    ${rows}
  </sheetData>
  <mergeCells count="2"><mergeCell ref="A1:F1"/><mergeCell ref="A2:F2"/></mergeCells>
  <autoFilter ref="A3:F${lastRow}"/>
  <pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
</worksheet>`;
  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tài khoản sinh viên" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Arial"/><color rgb="FF182039"/></font><font><b/><sz val="15"/><name val="Arial"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="10"/><name val="Arial"/><color rgb="FFFFFFFF"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF151D35"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF27536B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFDCE4EA"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml),
  };
  return zipSync(files, { level: 6 });
}

export function downloadStudentAccountsXlsx(accounts, options) {
  const bytes = buildStudentAccountsXlsx(accounts, options);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `tai-khoan-${normalizeStudentPrefix(options.className)}-${date}.xlsx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
