import { describe, expect, it } from "vitest";
import { makeQuizChoices, normalizePos, parseVocabularyText } from "./vocabulary";

describe("parseVocabularyText", () => {
  it("parses the requested vocabulary syntax and common POS aliases", () => {
    const result = parseVocabularyText("new(adj): mới\njourney (noun): hành trình\nimprove(v.): cải thiện");
    expect(result.entries).toHaveLength(3);
    expect(result.entries.map((entry) => entry.partOfSpeech)).toEqual(["adj", "n", "v"]);
  });

  it("parses textbook format with numbering, IPA phonetics, and no colons like UNIT 1.pdf", () => {
    const sampleText = `
UNIT 1: PERFECT FOR THE JOB
I. READING
1. diving (n)  /ˈdaɪvɪŋ/ Sự lặn
5. creative (adj)  /kriˈeɪtɪv/ Sáng tạo
6. honest (adj)  /ˈɒnɪst/ Trung thực, thật thà
32. look out for sth/sb  (phr v) /lʊk aʊt fə ˈsʌmθɪŋ/ Cố gắng chú ý điều gì
36. in trouble (phr)  /ɪn ˈtrʌbl/ Gặp vấn đề, trong tinhg thế
khó khăn
122. go out (with sb) (phr
v)
/ɡəʊ aʊt (wɪθ ˈsʌmbədi)/ Đi hẹn hò với ai đó
135. a number of (det)  /ə ˈnʌmbə(r) əv/ Một vài, một số
    `;
    const result = parseVocabularyText(sampleText);
    expect(result.entries).toHaveLength(7);
    expect(result.rejected).toHaveLength(0);

    const diving = result.entries.find((e) => e.term === "diving");
    expect(diving).toBeDefined();
    expect(diving.partOfSpeech).toBe("n");
    expect(diving.phonetics).toBe("ˈdaɪvɪŋ");
    expect(diving.meaning).toBe("Sự lặn");

    const inTrouble = result.entries.find((e) => e.term === "in trouble");
    expect(inTrouble).toBeDefined();
    expect(inTrouble.meaning).toContain("khó khăn");

    const goOut = result.entries.find((e) => e.term === "go out (with sb)");
    expect(goOut).toBeDefined();
    expect(goOut.meaning).toBe("Đi hẹn hò với ai đó");
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
