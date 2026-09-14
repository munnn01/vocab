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


