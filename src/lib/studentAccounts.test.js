import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import {
  buildStudentAccountsXlsx,
  createDemoStudentAccounts,
  normalizeStudentPrefix,
} from "./studentAccounts";

describe("student account helpers", () => {
  it("creates safe prefixes from Vietnamese class names", () => {
    expect(normalizeStudentPrefix("Lớp 12A1")).toBe("lop-12a1");
    expect(normalizeStudentPrefix("***")).toBe("sv");
  });

  it("creates unique readable credentials", () => {
    const accounts = createDemoStudentAccounts({ className: "Lớp 8A", prefix: "8A", count: 20 });
    expect(accounts).toHaveLength(20);
    expect(new Set(accounts.map((account) => account.username)).size).toBe(20);
    for (const account of accounts) {
      expect(account.username).toMatch(/^8a-[a-z2-9]{6}$/);
      expect(account.password).toMatch(/[a-z]/);
      expect(account.password).toMatch(/[A-Z]/);
      expect(account.password).toMatch(/[2-9]/);
    }
  });

  it("exports a valid xlsx package with text credentials", () => {
    const bytes = buildStudentAccountsXlsx([{
      id: "student-1",
      displayName: "Sinh viên 01",
      username: "12a1-k7m4p2",
      password: "Abc234Xyz",
      className: "Lớp 12A1",
    }], { className: "Lớp 12A1", loginUrl: "https://vocab.example" });
    expect([...bytes.slice(0, 2)]).toEqual([80, 75]);
    const files = unzipSync(bytes);
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain("12a1-k7m4p2");
    expect(sheet).toContain("Abc234Xyz");
    expect(sheet).toContain("state=\"frozen\"");
    expect(sheet).toContain("autoFilter");
  });
});
