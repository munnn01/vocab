export const POS_LABELS = {
  adj: "Tính từ",
  n: "Danh từ",
  v: "Động từ",
  adv: "Trạng từ",
  prep: "Giới từ",
  pron: "Đại từ",
  conj: "Liên từ",
  phrase: "Cụm từ",
  other: "Khác",
};

const POS_ALIASES = {
  adjective: "adj",
  adjectives: "adj",
  "tính từ": "adj",
  noun: "n",
  nouns: "n",
  "danh từ": "n",
  verb: "v",
  verbs: "v",
  "động từ": "v",
  adverb: "adv",
  adverbs: "adv",
  "trạng từ": "adv",
  preposition: "prep",
  "giới từ": "prep",
  pronoun: "pron",
  "đại từ": "pron",
  conjunction: "conj",
  "liên từ": "conj",
  idiom: "phrase",
  phrase: "phrase",
  "cụm từ": "phrase",
};

export const DISTRACTOR_BANK = {
  adj: ["bright", "quiet", "careful", "modern", "patient", "useful", "gentle", "narrow"],
  n: ["journey", "choice", "effort", "habit", "message", "corner", "purpose", "moment"],
  v: ["notice", "improve", "borrow", "decide", "prepare", "arrive", "protect", "follow"],
  adv: ["slowly", "nearly", "usually", "quietly", "clearly", "recently", "carefully", "rarely"],
  prep: ["above", "through", "beside", "within", "across", "toward", "behind", "beyond"],
  pron: ["someone", "nobody", "herself", "either", "whichever", "everyone", "nothing", "theirs"],
  conj: ["although", "because", "unless", "whereas", "while", "since", "yet", "therefore"],
  phrase: ["take part", "look after", "give up", "find out", "carry on", "turn down", "set up", "come across"],
  other: ["example", "context", "detail", "method", "result", "process", "feature", "pattern"],
};

export const DEMO_WORDS = [
  { id: "demo-1", term: "new", partOfSpeech: "adj", meaning: "mới" },
  { id: "demo-2", term: "quiet", partOfSpeech: "adj", meaning: "yên tĩnh" },
  { id: "demo-3", term: "patient", partOfSpeech: "adj", meaning: "kiên nhẫn" },
  { id: "demo-4", term: "journey", partOfSpeech: "n", meaning: "hành trình" },
  { id: "demo-5", term: "habit", partOfSpeech: "n", meaning: "thói quen" },
  { id: "demo-6", term: "improve", partOfSpeech: "v", meaning: "cải thiện" },
  { id: "demo-7", term: "prepare", partOfSpeech: "v", meaning: "chuẩn bị" },
  { id: "demo-8", term: "carefully", partOfSpeech: "adv", meaning: "một cách cẩn thận" },
];

export function normalizePos(rawPos = "") {
  const clean = rawPos
    .toLowerCase()
    .replaceAll(".", "")
    .replace(/\s+/g, " ")
    .trim();
  if (POS_LABELS[clean]) return clean;
  return POS_ALIASES[clean] || "other";
}

function cleanField(value = "") {
  return value.replace(/\s+/g, " ").replace(/^[•·\-–—\d.)\s]+/, "").trim();
}

export function parseVocabularyText(text = "") {
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/[：﹕]/g, ":")
    .replace(/\u00a0/g, " ");

  const candidates = normalized
    .split(/\n|(?<=\S)\s{3,}(?=[A-Za-zÀ-ỹ])/)
    .map(cleanField)
    .filter(Boolean);

  const entries = [];
  const rejected = [];
  const seen = new Set();
  const linePattern = /^(.{1,90}?)\s*\(\s*([^)]+?)\s*\)\s*:\s*(.{1,240})$/u;

  for (const line of candidates) {
    const match = line.match(linePattern);
    if (!match) {
      if (line.includes(":") || line.includes("(")) rejected.push(line);
      continue;
    }

    const term = cleanField(match[1]);
    const partOfSpeech = normalizePos(match[2]);
    const meaning = cleanField(match[3]);
    if (!term || !meaning) continue;

    const key = `${term.toLocaleLowerCase("en")}::${partOfSpeech}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      id: crypto.randomUUID(),
      term,
      partOfSpeech,
      meaning,
    });
  }

  return { entries, rejected };
}

export function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function makeQuizChoices(currentWord, allWords, choiceCount = 4) {
  const sameType = allWords
    .filter(
      (word) =>
        word.partOfSpeech === currentWord.partOfSpeech &&
        word.term.toLocaleLowerCase("en") !== currentWord.term.toLocaleLowerCase("en"),
    )
    .map((word) => word.term);

  const fallback = DISTRACTOR_BANK[currentWord.partOfSpeech] || DISTRACTOR_BANK.other;
  const unique = [...new Set([...shuffle(sameType), ...shuffle(fallback)])].filter(
    (term) => term.toLocaleLowerCase("en") !== currentWord.term.toLocaleLowerCase("en"),
  );

  return shuffle([currentWord.term, ...unique.slice(0, choiceCount - 1)]);
}

export function normalizeAnswer(value = "") {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
