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
  "phr v": "phrase",
  "phrasal verb": "phrase",
  phr: "phrase",
  det: "other",
  determiner: "other",
  "prefix, adj": "adj",
  prefix: "other",
  modal: "v",
  "modal verb": "v",
  interjection: "other",
  int: "other",
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
  if (POS_ALIASES[clean]) return POS_ALIASES[clean];
  if (clean.includes("adj")) return "adj";
  if (clean.includes("adv")) return "adv";
  if (clean.includes("verb") || clean.startsWith("v")) return "v";
  if (clean.includes("noun") || clean.startsWith("n")) return "n";
  if (clean.includes("phrase") || clean.includes("phr")) return "phrase";
  return "other";
}

function cleanField(value = "") {
  return value.replace(/\s+/g, " ").replace(/^[•·\-–—\d.)\s]+/, "").trim();
}

function isSectionHeader(line = "") {
  const trimmed = line.trim();
  const clean = trimmed.replace(/^[•·\-–—\d.)\s]+/, "").trim();
  if (/^(New Close Up|UNIT\s+\d+|[IVXLCDM]+\.|\d+$)/i.test(trimmed)) return true;
  if (/^(READING|VOCABULARY|GRAMMAR|LISTENING|SPEAKING|WRITING)$/i.test(clean)) return true;
  return false;
}

export function parseVocabularyText(text = "") {
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/[：﹕]/g, ":")
    .replace(/[–—]/g, "-")
    .replace(/\u00a0/g, " ");

  const rawLines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Step 1: Filter headers & stitch wrapped lines
  const stitchedLines = [];
  for (const line of rawLines) {
    if (isSectionHeader(line)) continue;

    const isNumbered = /^\d+[\.\)]\s+/.test(line);

    if (isNumbered || stitchedLines.length === 0) {
      stitchedLines.push(line);
    } else {
      const prev = stitchedLines[stitchedLines.length - 1];
      const prevOpenParen = (prev.match(/\(/g) || []).length;
      const prevCloseParen = (prev.match(/\)/g) || []).length;

      // Case A: Unclosed parenthesis on previous line, e.g. '(phr' and next line 'v)'
      if (prevOpenParen > prevCloseParen) {
        stitchedLines[stitchedLines.length - 1] = `${prev} ${line}`;
      }
      // Case B: Phonetics continuation
      else if (line.startsWith("/") && !prev.includes("/")) {
        stitchedLines[stitchedLines.length - 1] = `${prev} ${line}`;
      }
      // Case C: Wrapped meaning continuation (line has no '(', '/', ':', '-')
      else if (!line.includes("(") && !line.includes("/") && !line.includes(":") && !line.includes("-")) {
        stitchedLines[stitchedLines.length - 1] = `${prev} ${line}`;
      } else {
        stitchedLines.push(line);
      }
    }
  }

  const entries = [];
  const rejected = [];
  const seen = new Set();

  for (const line of stitchedLines) {
    const cleanLine = line.replace(/^\d+[\.\)]\s*/, "").trim();

    let term = "";
    let rawPos = "";
    let phonetics = "";
    let meaning = "";

    // Pattern 1: term ... (pos) ... /phonetics/ ... meaning
    const m1 = cleanLine.match(/^(.+?)\s*\(\s*([^)]+?)\s*\)\s*(?:\/([^\/]+)\/|\[([^\]]+)\])\s*(?::\s*|\s*-\s*|\s+)(.+)$/u);
    if (m1) {
      term = m1[1];
      rawPos = m1[2];
      phonetics = m1[3] || m1[4] || "";
      meaning = m1[5];
    } else {
      // Pattern 2: term ... /phonetics/ ... (pos) ... meaning
      const m2 = cleanLine.match(/^(.+?)\s*(?:\/([^\/]+)\/|\[([^\]]+)\])\s*\(\s*([^)]+?)\s*\)\s*(?::\s*|\s*-\s*|\s+)(.+)$/u);
      if (m2) {
        term = m2[1];
        rawPos = m2[4];
        phonetics = m2[2] || m2[3] || "";
        meaning = m2[5];
      } else {
        // Pattern 3: term ... (pos) ... meaning (colon, dash, or whitespace)
        const m3 = cleanLine.match(/^(.+?)\s*\(\s*([^)]+?)\s*\)\s*(?::\s*|\s*-\s*|\s{2,}|\s+)(.+)$/u);
        if (m3) {
          term = m3[1];
          rawPos = m3[2];
          meaning = m3[3];
        } else {
          // Pattern 4: term ... /phonetics/ ... meaning
          const m4 = cleanLine.match(/^(.+?)\s*(?:\/([^\/]+)\/|\[([^\]]+)\])\s*(?::\s*|\s*-\s*|\s+)(.+)$/u);
          if (m4) {
            term = m4[1];
            rawPos = "other";
            phonetics = m4[2] || m4[3] || "";
            meaning = m4[4];
          } else {
            // Pattern 5: term : meaning or term - meaning
            const m5 = cleanLine.match(/^(.+?)\s*(?::\s*|\s+-\s+)(.+)$/u);
            if (m5) {
              term = m5[1];
              rawPos = "other";
              meaning = m5[2];
            } else {
              if (line.includes(":") || line.includes("(") || line.includes("/")) {
                rejected.push(line);
              }
              continue;
            }
          }
        }
      }
    }

    const cleanTerm = cleanField(term);
    const partOfSpeech = normalizePos(rawPos);
    const cleanMeaning = cleanField(meaning);
    const cleanPhonetics = phonetics.trim();

    if (!cleanTerm || !cleanMeaning) continue;

    const key = `${cleanTerm.toLocaleLowerCase("en")}::${partOfSpeech}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = {
      id: crypto.randomUUID(),
      term: cleanTerm,
      partOfSpeech,
      meaning: cleanMeaning,
    };
    if (cleanPhonetics) {
      entry.phonetics = cleanPhonetics;
    }
    entries.push(entry);
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

export function makeQuizChoices(currentWord, allWords, choiceCount = 4, direction = "meaning-to-term") {
  if (direction === "term-to-meaning") {
    const sameTypeMeanings = allWords
      .filter(
        (word) =>
          word.partOfSpeech === currentWord.partOfSpeech &&
          word.meaning.toLocaleLowerCase("vi") !== currentWord.meaning.toLocaleLowerCase("vi"),
      )
      .map((word) => word.meaning);

    const otherMeanings = allWords
      .filter((word) => word.meaning.toLocaleLowerCase("vi") !== currentWord.meaning.toLocaleLowerCase("vi"))
      .map((word) => word.meaning);

    const unique = [...new Set([...shuffle(sameTypeMeanings), ...shuffle(otherMeanings)])].filter(
      (m) => m.toLocaleLowerCase("vi") !== currentWord.meaning.toLocaleLowerCase("vi"),
    );

    return shuffle([currentWord.meaning, ...unique.slice(0, choiceCount - 1)]);
  }

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

export function speakWord(term, options = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(term);
    utterance.lang = options.lang || "en-US";
    utterance.rate = typeof options.rate === "number" ? options.rate : 0.9;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Speech synthesis error", err);
  }
}

