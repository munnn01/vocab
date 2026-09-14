import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  buildRosterCredentialsXlsx,
  buildRosterResultsXlsx,
  createDemoStudentAccounts,
  normalizeStudentPrefix,
  parseStudentRosterXlsx,
} from "./studentAccounts";

function createRosterBytes() {
  return zipSync({
    "xl/workbook.xml": strToU8('<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Danh sách 12A1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/sharedStrings.xml": strToU8('<?xml version="1.0"?><sst><si><t>STT</t></si><si><t>Họ và tên</t></si><si><t>Lớp</t></si><si><t>Nguyễn Thùy Tâm</t></si><si><t>12A1</t></si><si><t>Trần Minh An</t></si></sst>'),
    "xl/worksheets/sheet1.xml": strToU8('<?xml version="1.0"?><worksheet><dimension ref="A1:C3"/><sheetData><row r="1"><c r="A1" t="s" s="1"><v>0</v></c><c r="B1" t="s" s="1"><v>1</v></c><c r="C1" t="s" s="1"><v>2</v></c></row><row r="2"><c r="A2"><v>1</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" t="s"><v>4</v></c></row><row r="3"><c r="A3"><v>2</v></c><c r="B3" t="s"><v>5</v></c><c r="C3" t="s"><v>4</v></c></row></sheetData></worksheet>'),
    "docProps/custom.xml": strToU8("<preserved>yes</preserved>"),
  });
}

function workbookFrom(bytes) {
  return {
    originalFileName: "danh-sach-12a1.xlsx",
    originalFileBase64: Buffer.from(bytes).toString("base64"),
    sheetName: "Danh sách 12A1",
    worksheetPath: "xl/worksheets/sheet1.xml",
    headerRow: 1,
    nameColumn: 2,
    classColumn: 3,
  };
}

describe("student roster helpers", () => {
  it("creates safe prefixes from Vietnamese class names", () => {
    expect(normalizeStudentPrefix("Lớp 12A1")).toBe("lop-12a1");
    expect(normalizeStudentPrefix("***")).toBe("sv");
  });

  it("reads student names and classes from the first worksheet", async () => {
    const bytes = createRosterBytes();
    const file = new Blob([bytes]);
    Object.defineProperty(file, "name", { value: "danh-sach-12a1.xlsx" });
    const parsed = await parseStudentRosterXlsx(file);
    expect(parsed.workbook.sheetName).toBe("Danh sách 12A1");
    expect(parsed.students).toEqual([
      { displayName: "Nguyễn Thùy Tâm", className: "12A1", rowNumber: 2 },
      { displayName: "Trần Minh An", className: "12A1", rowNumber: 3 },
    ]);
  });

  it("creates unique credentials for the imported students", () => {
    const students = [
      { displayName: "Nguyễn Thùy Tâm", className: "12A1", rowNumber: 2 },
      { displayName: "Trần Minh An", className: "12A1", rowNumber: 3 },
    ];
    const accounts = createDemoStudentAccounts({ students });
    expect(accounts.map((account) => account.displayName)).toEqual(students.map((student) => student.displayName));
    expect(new Set(accounts.map((account) => account.username)).size).toBe(2);
    for (const account of accounts) {
      expect(account.username).toMatch(/^12a1-[a-z2-9]{6}$/);
      expect(account.password).toMatch(/[a-z]/);
      expect(account.password).toMatch(/[A-Z]/);
      expect(account.password).toMatch(/[2-9]/);
    }
  });

  it("preserves the source package and adds credential columns", () => {
    const bytes = createRosterBytes();
    const output = buildRosterCredentialsXlsx(workbookFrom(bytes), [{
      rosterRow: 2,
      username: "12a1-k7m4p2",
      password: "Abc234Xyz",
    }]);
    const files = unzipSync(output);
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(strFromU8(files["docProps/custom.xml"])).toContain("preserved");
    expect(sheet).toContain("Tên đăng nhập");
    expect(sheet).toContain("Mật khẩu");
    expect(sheet).toContain("12a1-k7m4p2");
    expect(sheet).toContain("Abc234Xyz");
  });

  it("adds numeric scores and plain-text violation status to the original roster", () => {
    const bytes = createRosterBytes();
    const output = buildRosterResultsXlsx(workbookFrom(bytes), [
      { rowNumber: 2, score: 87, practiceCount: 2, issue: "Không" },
      { rowNumber: 3, score: -5, practiceCount: 1, issue: "Có – thoát toàn màn hình" },
    ]);
    const sheet = strFromU8(unzipSync(output)["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain("Điểm");
    expect(sheet).toContain("Số lần luyện");
    expect(sheet).toContain("Lỗi trong quá trình làm bài");
    expect(sheet).toContain("<v>87</v>");
    expect(sheet).toContain("<v>2</v>");
    expect(sheet).toContain("Có – thoát toàn màn hình");
  });

  it("handles Target before Id in rels and numeric XML entities in inlineStr (e.g. 12A2 format)", async () => {
    const bytes = zipSync({
      "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="Danh s&#225;ch l&#7899;p 12A2" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml" Id="rId1"/></Relationships>'),
      "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>STT</t></is></c><c r="B1" t="inlineStr"><is><t>H&#7885; v&#224; T&#234;n</t></is></c><c r="C1" t="inlineStr"><is><t>L&#7899;p</t></is></c></row><row r="2"><c r="A2" t="n"><v>1</v></c><c r="B2" t="inlineStr"><is><t>L&#253; H&#7843;i Trang</t></is></c><c r="C2" t="inlineStr"><is><t>12A2</t></is></c></row></sheetData></worksheet>'),
    });
    const file = new Blob([bytes]);
    Object.defineProperty(file, "name", { value: "Danh_sach_lop_12A2.xlsx" });
    const parsed = await parseStudentRosterXlsx(file);
    expect(parsed.workbook.sheetName).toBe("Danh sách lớp 12A2");
    expect(parsed.students).toEqual([
      { displayName: "Lý Hải Trang", className: "12A2", rowNumber: 2 },
    ]);
  });
});
