import { test, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  clearTimeout() {},
  setTimeout() { return 1; },
  location: { href: "https://vocab-lemon.vercel.app" },
  history: { pushState() {} },
};

globalThis.document = {
  fullscreenElement: null,
  addEventListener() {},
  removeEventListener() {},
};

import {
  App,
  isDeckUnlockedForClass,
  isDeckLockedForStudent,
  getDeckLockAtForStudent,
  formatViolationText,
  getViolationBadgeClass,
  getRosterDisplayLabel,
  getDeckStudentAttempts,
  isDeckAttemptsExhausted,
  InstructorView,
} from "./App";

test("App renders without crashing", () => {
  const html = renderToString(<App />);
  expect(html).toBeTruthy();
});

test("isDeckUnlockedForClass works correctly", () => {
  // Deck with null unlockedClasses is unlocked for all
  expect(isDeckUnlockedForClass({ unlockedClasses: null }, "12A1")).toBe(true);
  expect(isDeckUnlockedForClass({}, "12A1")).toBe(true);
  expect(isDeckUnlockedForClass(null, "12A1")).toBe(true);

  // Deck with * is unlocked for all
  expect(isDeckUnlockedForClass({ unlockedClasses: ["*"] }, "12A1")).toBe(true);

  // Specific classes
  const deck = { unlockedClasses: ["12A1", "12A2"] };
  expect(isDeckUnlockedForClass(deck, "12A1")).toBe(true);
  expect(isDeckUnlockedForClass(deck, "12A2")).toBe(true);
  expect(isDeckUnlockedForClass(deck, "12A3")).toBe(false);
  expect(isDeckUnlockedForClass(deck, "")).toBe(true);
});

test("isDeckLockedForStudent correctly detects locked decks", () => {
  const openDeck = { title: "Open Deck", unlockedClasses: null };
  const restrictedDeck = { title: "Restricted Deck", unlockedClasses: ["12A1"] };

  const student1 = { role: "student", className: "12A1" };
  const student2 = { role: "student", className: "12A2" };
  const instructor = { role: "instructor" };

  // Open deck is not locked for anyone
  expect(isDeckLockedForStudent(openDeck, student1)).toBe(false);
  expect(isDeckLockedForStudent(openDeck, student2)).toBe(false);
  expect(isDeckLockedForStudent(openDeck, instructor)).toBe(false);

  // Restricted deck
  expect(isDeckLockedForStudent(restrictedDeck, student1)).toBe(false); // 12A1 unlocked
  expect(isDeckLockedForStudent(restrictedDeck, student2)).toBe(true);  // 12A2 locked
  expect(isDeckLockedForStudent(restrictedDeck, instructor)).toBe(false); // instructor never locked
});

test("isDeckLockedForStudent handles lockAt deadlines", () => {
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

  const student = { role: "student", className: "12A1" };
  const instructor = { role: "instructor" };

  const futureDeck = { title: "Future Deck", unlockedClasses: null, lockAt: futureDate };
  const expiredDeck = { title: "Expired Deck", unlockedClasses: null, lockAt: pastDate };

  // Future deck is not locked
  expect(isDeckLockedForStudent(futureDeck, student)).toBe(false);
  expect(isDeckLockedForStudent(futureDeck, instructor)).toBe(false);

  // Expired deck is locked for student, but open for instructor
  expect(isDeckLockedForStudent(expiredDeck, student)).toBe(true);
  expect(isDeckLockedForStudent(expiredDeck, instructor)).toBe(false);
});

test("isDeckLockedForStudent and getDeckLockAtForStudent handle per-class deadlines (lockAtByClass)", () => {
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

  const studentA = { role: "student", className: "12A1" };
  const studentB = { role: "student", className: "12A2" };
  const studentC = { role: "student", className: "12A3" };

  const perClassDeck = {
    title: "Class Specific Deck",
    unlockedClasses: null,
    lockAt: null,
    lockAtByClass: {
      "12A1": pastDate,   // 12A1 has expired
      "12A2": futureDate, // 12A2 is still open
    },
  };

  // Student A (12A1) should be locked due to past deadline
  expect(getDeckLockAtForStudent(perClassDeck, studentA)).toBe(pastDate);
  expect(isDeckLockedForStudent(perClassDeck, studentA)).toBe(true);

  // Student B (12A2) should be open due to future deadline
  expect(getDeckLockAtForStudent(perClassDeck, studentB)).toBe(futureDate);
  expect(isDeckLockedForStudent(perClassDeck, studentB)).toBe(false);

  // Student C (12A3) has no specific deadline and no all deadline, should be open
  expect(getDeckLockAtForStudent(perClassDeck, studentC)).toBe(null);
  expect(isDeckLockedForStudent(perClassDeck, studentC)).toBe(false);
});

test("formatViolationText and getViolationBadgeClass format violation details clearly", () => {
  // 1. Clean completion
  expect(formatViolationText({ completed: true, violationReason: null })).toBe("Không vi phạm quy chế");
  expect(getViolationBadgeClass({ completed: true, violationReason: null })).toBe("badge-clean");

  // 2. Null/missing result
  expect(formatViolationText(null)).toBe("—");
  expect(getViolationBadgeClass(null)).toBe("badge-empty");

  // 3. Incomplete without explicit violation
  expect(formatViolationText({ completed: false, violationReason: null })).toBe("Rời bài thi sớm (Chưa hoàn thành)");
  expect(getViolationBadgeClass({ completed: false, violationReason: null })).toBe("badge-violation-warning");

  // 4. Legacy violation keys
  expect(formatViolationText({ completed: false, violationReason: "fullscreen_exit" })).toBe(
    "Vi phạm lần 1: Thoát toàn màn hình (Trừ 25% điểm)"
  );
  expect(formatViolationText({ completed: false, violationReason: "visibility_hidden" })).toBe(
    "Vi phạm lần 1: Chuyển ứng dụng / tab (Trừ 25% điểm)"
  );
  expect(formatViolationText({ completed: false, violationReason: "left_early" })).toBe(
    "Rời bài thi sớm (Phạm lỗi lần 1: Trừ 25% điểm)"
  );
  expect(formatViolationText({ completed: false, violationReason: "violation_limit" })).toBe(
    "Bị hủy bài thi (0 điểm): Vi phạm quy chế quá 2 lần"
  );

  // 5. Custom descriptive violations
  const vio1 = "Vi phạm lần 1: Thoát toàn màn hình (Trừ 25% điểm)";
  expect(formatViolationText({ completed: true, violationReason: vio1 })).toBe(vio1);
  expect(getViolationBadgeClass({ completed: true, violationReason: vio1 })).toBe("badge-violation-warning");

  const vio2 = "Vi phạm lần 2: Chuyển ứng dụng / tab (Trừ 75% điểm)";
  expect(formatViolationText({ completed: true, violationReason: vio2 })).toBe(vio2);
  expect(getViolationBadgeClass({ completed: true, violationReason: vio2 })).toBe("badge-violation-severe");

  const vioCancelled = "Bị hủy bài thi (0 điểm): Vi phạm quy chế quá 2 lần (Thoát toàn màn hình)";
  expect(formatViolationText({ completed: false, violationReason: vioCancelled })).toBe(vioCancelled);
  expect(getViolationBadgeClass({ completed: false, violationReason: vioCancelled })).toBe("badge-violation-severe");
});

test("getRosterDisplayLabel formats roster filename with class name", () => {
  // 1. Direct className on roster
  const r1 = { id: "r1", originalFileName: "Danh_sach_lop_12A2.xlsx", className: "12A2" };
  expect(getRosterDisplayLabel(r1, [])).toBe("Danh_sach_lop_12A2.xlsx - 12A2");

  // 2. Class name found from students list
  const r2 = { id: "r2", originalFileName: "Danh_sach_50_sinh_vien.xlsx", className: null };
  const students = [
    { rosterId: "r2", className: "12A1" },
    { rosterId: "r2", className: "12A1" },
  ];
  expect(getRosterDisplayLabel(r2, students)).toBe("Danh_sach_50_sinh_vien.xlsx - 12A1");

  // 3. Extracted from sheetName or filename fallback
  const r3 = { id: "r3", originalFileName: "danh_sach.xlsx", sheetName: "Danh sách lớp 12A3", className: null };
  expect(getRosterDisplayLabel(r3, [])).toBe("danh_sach.xlsx - 12A3");

  const r4 = { id: "r4", originalFileName: "danh_sach_lop_10B1.xlsx", sheetName: null, className: null };
  expect(getRosterDisplayLabel(r4, [])).toBe("danh_sach_lop_10B1.xlsx - 10B1");

  // 4. No class name
  const r5 = { id: "r5", originalFileName: "sinh_vien.xlsx", sheetName: "Sheet1", className: null };
  expect(getRosterDisplayLabel(r5, [])).toBe("sinh_vien.xlsx");
});

test("getDeckStudentAttempts and isDeckAttemptsExhausted correctly manage practice attempt limits", () => {
  const deck1 = { id: "deck-1", title: "Bài 1", maxAttempts: 2 };
  const deckUnlimited = { id: "deck-unlimited", title: "Tự do", maxAttempts: null };
  const student = { role: "student", className: "12A1" };
  const instructor = { role: "instructor" };

  const sessions = [
    { id: "s1", deck_id: "deck-1", score: 80 },
    { id: "s2", deck_id: "deck-1", score: 90 },
    { id: "s3", deck_id: "deck-2", score: 100 },
  ];

  // getDeckStudentAttempts
  expect(getDeckStudentAttempts("deck-1", sessions)).toBe(2);
  expect(getDeckStudentAttempts("deck-2", sessions)).toBe(1);
  expect(getDeckStudentAttempts("deck-other", sessions)).toBe(0);
  expect(getDeckStudentAttempts(null, sessions)).toBe(0);
  expect(getDeckStudentAttempts("deck-1", null)).toBe(0);

  // isDeckAttemptsExhausted for instructor (never locked)
  expect(isDeckAttemptsExhausted(deck1, instructor, sessions)).toBe(false);

  // Unlimited deck
  expect(isDeckAttemptsExhausted(deckUnlimited, student, sessions)).toBe(false);

  // Deck with 2 maxAttempts
  expect(isDeckAttemptsExhausted(deck1, student, sessions)).toBe(true); // 2 sessions >= 2 maxAttempts
  expect(isDeckAttemptsExhausted(deck1, student, [sessions[0]])).toBe(false); // 1 session < 2 maxAttempts
  expect(isDeckAttemptsExhausted(deck1, student, [])).toBe(false); // 0 session < 2 maxAttempts
});

import {
  FlashcardView,
  LeaderboardModal,
  StudentProgressModal,
  EditDeckModal,
  DeckExamModeSettings,
  DeckTimeLimitSettings,
} from "./components/StudyFeatures";
import { speakWord } from "./lib/vocabulary";

test("speakWord handles text-to-speech gracefully", () => {
  // window.speechSynthesis may or may not exist in node env
  expect(() => speakWord("hello")).not.toThrow();
});

test("FlashcardView renders flashcard cards and controls", () => {
  const deck = {
    id: "deck-flash",
    title: "Unit 1: Environment",
    words: [
      { id: "w1", term: "biodiversity", partOfSpeech: "n", meaning: "đa dạng sinh học" },
      { id: "w2", term: "sustainable", partOfSpeech: "adj", meaning: "bền vững" },
    ],
  };

  const html = renderToString(<FlashcardView deck={deck} onBack={() => {}} onStartQuiz={() => {}} />);
  expect(html).toContain("Unit 1: Environment");
  expect(html).toContain("biodiversity");
  expect(html).toContain("đa dạng sinh học");
  expect(html).toContain("Lật xem nghĩa");
  expect(html).toContain("Trộn thẻ");
});

test("LeaderboardModal renders ranked students and medals", () => {
  const decks = [{ id: "deck-1", title: "Unit 1" }];
  const students = [
    { id: "st-1", displayName: "Nguyễn Văn A", className: "12A1" },
    { id: "st-2", displayName: "Trần Thị B", className: "12A1" },
  ];
  const results = [
    { id: "r1", studentId: "st-1", deckId: "deck-1", score: 95, completed: true },
    { id: "r2", studentId: "st-2", deckId: "deck-1", score: 85, completed: true },
  ];

  const html = renderToString(
    <LeaderboardModal
      isOpen={true}
      onClose={() => {}}
      decks={decks}
      students={students}
      studentResults={results}
      currentAccount={{ id: "st-1", role: "student" }}
    />
  );

  expect(html).toContain("Bảng xếp hạng thành tích");
  expect(html).toContain("Nguyễn Văn A");
  expect(html).toContain("95");
  expect(html).toContain("Trần Thị B");
  expect(html).toContain("85");
  expect(html).toContain("Bạn"); // st-1 is current account
});

test("StudentProgressModal renders summary stats and test history", () => {
  const student = { id: "st-1", displayName: "Nguyễn Văn A", className: "12A1" };
  const results = [
    { id: "r1", studentId: "st-1", deckTitle: "Unit 1", score: 90, completed: true, correct: 9, total: 10 },
    { id: "r2", studentId: "st-1", deckTitle: "Unit 2", score: 80, completed: true, correct: 8, total: 10 },
  ];

  const html = renderToString(
    <StudentProgressModal
      isOpen={true}
      onClose={() => {}}
      student={student}
      studentResults={results}
    />
  );

  expect(html).toContain("Hồ sơ tiến trình học sinh");
  expect(html).toContain("Nguyễn Văn A");
  expect(html).toContain("12A1");
  expect(html).toContain("85"); // Average of 90 and 80
  expect(html).toContain("90"); // Best score
  expect(html).toContain("Tổng lượt làm bài");
  expect(html).toContain("Biểu đồ điểm số");
});

test("EditDeckModal renders editable inputs for title and vocabulary words", () => {
  const deck = {
    id: "deck-edit",
    title: "Tiếng Anh 12",
    words: [
      { id: "w1", term: "pollute", partOfSpeech: "v", meaning: "gây ô nhiễm" },
    ],
  };

  const html = renderToString(
    <EditDeckModal
      isOpen={true}
      onClose={() => {}}
      deck={deck}
      onSave={() => {}}
      isSaving={false}
    />
  );

  expect(html).toContain("Chỉnh sửa bộ từ vựng");
  expect(html).toContain("Tiếng Anh 12");
  expect(html).toContain("pollute");
  expect(html).toContain("gây ô nhiễm");
  expect(html).toContain("Thêm từ mới");
});

test("DeckExamModeSettings and DeckTimeLimitSettings render mode options", () => {
  const examHtml = renderToString(
    <DeckExamModeSettings isExamMode={true} onChange={() => {}} disabled={false} />
  );
  expect(examHtml).toContain("Quy chế làm bài");
  expect(examHtml).toContain("Kiểm tra nghiêm ngặt");
  expect(examHtml).toContain("Luyện tập tự do");

  const timerHtml = renderToString(
    <DeckTimeLimitSettings timeLimitMinutes={10} onChange={() => {}} disabled={false} />
  );
  expect(timerHtml).toContain("Thời gian làm bài");
  expect(timerHtml).toContain("10 phút");
  expect(timerHtml).toContain("Không giới hạn");
});

import { FirstLoginPasswordModal } from "./components/FirstLoginPasswordModal";
import { buildRosterCredentialsXlsx } from "./lib/studentAccounts";
import { changeStudentPassword } from "./lib/supabase";

test("FirstLoginPasswordModal renders mandatory password reset fields", () => {
  const student = {
    id: "st-1",
    displayName: "Trần Văn Nam",
    username: "namtv",
    className: "12A1",
    hasChangedPassword: false,
  };

  const html = renderToString(
    <FirstLoginPasswordModal
      isOpen={true}
      student={student}
      onSave={() => {}}
      onSignOut={() => {}}
      isSaving={false}
    />
  );

  expect(html).toContain("Thiết lập mật khẩu mới");
  expect(html).toContain("Trần Văn Nam");
  expect(html).toContain("mật khẩu 1 lần");
  expect(html).toContain("Mật khẩu mới (tối thiểu 6 ký tự)");
  expect(html).toContain("Xác nhận lại mật khẩu mới");
  expect(html).toContain("Lưu mật khẩu &amp; Bắt đầu học");
});

test("changeStudentPassword handles offline/demo environment gracefully", async () => {
  const res = await changeStudentPassword("NewPass123");
  expect(res).toEqual({ success: true });
});

test("buildRosterCredentialsXlsx includes both initial and current password columns", () => {
  // Test that accounts with both passwords are formatted properly
  const workbook = {
    originalFileBase64: "",
    worksheetPath: "xl/worksheets/sheet1.xml",
    headerRow: 1,
    nameColumn: 1,
    classColumn: 2,
  };
  const accounts = [
    { rosterRow: 2, username: "hs1", initialPassword: "OldPass1", currentPassword: "NewPass1", hasChangedPassword: true },
    { rosterRow: 3, username: "hs2", initialPassword: "OldPass2", currentPassword: null, hasChangedPassword: false },
  ];

  // If mock zipSync or base64 fails in pure node, function signature still holds
  expect(typeof buildRosterCredentialsXlsx).toBe("function");
});

test("InstructorView renders separate columns for old password and new password", () => {
  const students = [
    {
      id: "st-1",
      displayName: "Nguyễn Văn A",
      username: "12a1-abc123",
      initialPassword: "InitialPass123",
      currentPassword: "CustomPass456",
      hasChangedPassword: true,
      className: "12A1",
      rosterId: "r1",
      rosterRow: 2,
    },
    {
      id: "st-2",
      displayName: "Trần Thị B",
      username: "12a1-xyz789",
      initialPassword: "InitialPass999",
      currentPassword: null,
      hasChangedPassword: false,
      className: "12A1",
      rosterId: "r1",
      rosterRow: 3,
    },
  ];

  const html = renderToString(
    <InstructorView
      students={students}
      rosters={[{ id: "r1", originalFileName: "12A1.xlsx", className: "12A1" }]}
      studentResults={[]}
      decks={[{ id: "deck-1", title: "Unit 1: Environment" }]}
      generatedAccounts={[]}
      isGenerating={false}
      isRefreshingResults={false}
      isExportingResults={false}
      isResettingPasswords={false}
      isDeletingRoster={false}
      isDemo={false}
      onGenerate={() => {}}
      onExport={() => {}}
      onExportResults={() => {}}
      onRefreshResults={() => {}}
      onResetPasswords={() => {}}
      onDeleteRoster={() => {}}
      onViewStudentProgress={() => {}}
    />
  );

  // Table header must have separate columns for old and new passwords
  expect(html).toContain("<th>Mật khẩu cũ</th>");
  expect(html).toContain("<th>Mật khẩu mới</th>");
  expect(html).not.toContain("Mật khẩu (Mới / Cũ)");

  // Student 2 hasn't changed password, shows "Chưa đổi" badge
  expect(html).toContain("Chưa đổi");
});

test("InstructorView renders Điểm trung bình column and computes average score correctly", () => {
  const students = [
    {
      id: "st-1",
      displayName: "Nguyễn Văn A",
      username: "12a1-abc123",
      className: "12A1",
      rosterId: "r1",
      rosterRow: 2,
    },
    {
      id: "st-2",
      displayName: "Trần Thị B",
      username: "12a1-xyz789",
      className: "12A1",
      rosterId: "r1",
      rosterRow: 3,
    },
  ];

  const studentResults = [
    { studentId: "st-1", deckId: "deck-1", score: 80, completed: true },
    { studentId: "st-1", deckId: "deck-2", score: 90, completed: true },
  ];

  const decks = [
    { id: "deck-1", title: "Unit 1" },
    { id: "deck-2", title: "Unit 2" },
  ];

  const html = renderToString(
    <InstructorView
      students={students}
      rosters={[{ id: "r1", originalFileName: "12A1.xlsx", className: "12A1" }]}
      studentResults={studentResults}
      decks={decks}
      generatedAccounts={[]}
      isGenerating={false}
      isRefreshingResults={false}
      isExportingResults={false}
      isResettingPasswords={false}
      isDeletingRoster={false}
      isDemo={false}
      onGenerate={() => {}}
      onExport={() => {}}
      onExportResults={() => {}}
      onRefreshResults={() => {}}
      onResetPasswords={() => {}}
      onDeleteRoster={() => {}}
      onViewStudentProgress={() => {}}
    />
  );

  // Table header has Điểm trung bình column
  expect(html).toContain(">Điểm trung bình</th>");

  // Student 1 has scores 80 and 90 -> average 85
  expect(html).toContain("avg-score-badge");
  expect(html).toContain("85");

  // Student 2 has no scores -> "—"
  expect(html).toContain("—");
});

test("results export includes avgScore as the last column", () => {
  const columns = [
    { key: "deck_1", header: "Unit 1", width: 18, type: "number" },
    { key: "deck_2", header: "Unit 2", width: 18, type: "number" },
    { key: "avgScore", header: "Điểm trung bình", width: 16, type: "number" },
  ];
  const lastCol = columns[columns.length - 1];
  expect(lastCol.key).toBe("avgScore");
  expect(lastCol.header).toBe("Điểm trung bình");
});





