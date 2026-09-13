import { describe, expect, it } from "vitest";
import { makeQuizChoices, normalizePos, parseVocabularyText } from "./vocabulary";

describe("parseVocabularyText", () => {
  it("parses the requested vocabulary syntax and common POS aliases", () => {
    const result = parseVocabularyText("new(adj): mới\njourney (noun): hành trình\nimprove(v.): cải thiện");
    expect(result.entries).toHaveLength(3);
    expect(result.entries.map((entry) => entry.partOfSpeech)).toEqual(["adj", "n", "v"]);
  });

  it("deduplicates a word within the same part of speech", () => {
    const result = parseVocabularyText("new(adj): mới\nnew (adjective): mới tinh");
    expect(result.entries).toHaveLength(1);
  });
});

describe("quiz choices", () => {
  it("always returns the correct term and same-type distractors", () => {
    const current = { term: "new", partOfSpeech: "adj" };
    const choices = makeQuizChoices(current, [current, { term: "quiet", partOfSpeech: "adj" }]);
    expect(choices).toContain("new");
    expect(choices).toContain("quiet");
    expect(choices).toHaveLength(4);
  });
});

describe("normalizePos", () => {
  it("supports Vietnamese labels", () => {
    expect(normalizePos("Tính từ")).toBe("adj");
  });
});
