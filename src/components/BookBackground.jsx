import React from "react";
import { Volume2 } from "lucide-react";

const CORE_WORDS_ROW_1 = [
  { word: "abandon", phonetic: "/əˈbændən/", pos: "v.", def: "cease to support, give up completely" },
  { word: "achieve", phonetic: "/əˈtʃiːv/", pos: "v.", def: "reach or attain by effort" },
  { word: "ancient", phonetic: "/ˈeɪnʃənt/", pos: "adj.", def: "belonging to times long past" },
  { word: "beautiful", phonetic: "/ˈbjuːtɪfʊl/", pos: "adj.", def: "pleasing aesthetically to the senses" },
  { word: "challenge", phonetic: "/ˈtʃælɪndʒ/", pos: "n.", def: "a demanding task that tests ability" },
  { word: "discover", phonetic: "/dɪˈskʌvər/", pos: "v.", def: "find or uncover during search" },
  { word: "improve", phonetic: "/ɪmˈpruːv/", pos: "v.", def: "make or become higher in quality" },
  { word: "knowledge", phonetic: "/ˈnɒlɪdʒ/", pos: "n.", def: "facts and insights acquired by learning" },
  { word: "successful", phonetic: "/səkˈsesfʊl/", pos: "adj.", def: "attaining desired objectives" },
];

const CORE_WORDS_ROW_2 = [
  { word: "discover", phonetic: "/dɪˈskʌvər/", pos: "v.", def: "uncover truth through inquiry" },
  { word: "improve", phonetic: "/ɪmˈpruːv/", pos: "v.", def: "enhance in proficiency and skill" },
  { word: "knowledge", phonetic: "/ˈnɒlɪdʒ/", pos: "n.", def: "understanding gained through study" },
  { word: "successful", phonetic: "/səkˈsesfʊl/", pos: "adj.", def: "accomplishing intended aims" },
  { word: "abandon", phonetic: "/əˈbændən/", pos: "v.", def: "leave behind without returning" },
  { word: "achieve", phonetic: "/əˈtʃiːv/", pos: "v.", def: "fulfill goals with perseverance" },
  { word: "ancient", phonetic: "/ˈeɪnʃənt/", pos: "adj.", def: "venerable and historically rich" },
  { word: "beautiful", phonetic: "/ˈbjuːtɪfʊl/", pos: "adj.", def: "inspiring admiration and grace" },
  { word: "challenge", phonetic: "/ˈtʃælɪndʒ/", pos: "n.", def: "an invitation to test one's skill" },
];

const CORE_WORDS_ROW_3 = [
  { word: "adventure", phonetic: "/ədˈventʃər/", pos: "n.", def: "an exciting, daring experience" },
  { word: "brilliant", phonetic: "/ˈbrɪljənt/", pos: "adj.", def: "exceptionally clever and radiant" },
  { word: "courage", phonetic: "/ˈkʌrɪdʒ/", pos: "n.", def: "bravery in the face of difficulty" },
  { word: "elegant", phonetic: "/ˈelɪɡənt/", pos: "adj.", def: "graceful and refined in style" },
  { word: "freedom", phonetic: "/ˈfriːdəm/", pos: "n.", def: "the power to act and think freely" },
  { word: "harmony", phonetic: "/ˈhɑːməni/", pos: "n.", def: "pleasing arrangement of elements" },
  { word: "imagine", phonetic: "/ɪˈmædʒɪn/", pos: "v.", def: "form mental images of concepts" },
  { word: "journey", phonetic: "/ˈdʒɜːni/", pos: "n.", def: "an act of traveling through life" },
];

const CORE_WORDS_ROW_4 = [
  { word: "wisdom", phonetic: "/ˈwɪzdəm/", pos: "n.", def: "the soundness of judgment and action" },
  { word: "inspire", phonetic: "/ɪnˈspaɪər/", pos: "v.", def: "fill with the urge to create" },
  { word: "flourish", phonetic: "/ˈflʌrɪʃ/", pos: "v.", def: "grow and develop vigorously" },
  { word: "gratitude", phonetic: "/ˈɡrætɪtjuːd/", pos: "n.", def: "readiness to show appreciation" },
  { word: "luminous", phonetic: "/ˈluːmɪnəs/", pos: "adj.", def: "giving off light; glowing brightly" },
  { word: "resilient", phonetic: "/rɪˈzɪliənt/", pos: "adj.", def: "able to recover quickly from hardship" },
  { word: "curiosity", phonetic: "/ˌkjʊəriˈɒsəti/", pos: "n.", def: "a strong desire to know or learn" },
  { word: "persevere", phonetic: "/ˌpɜːsɪˈvɪər/", pos: "v.", def: "continue course in spite of difficulty" },
];

const CORE_WORDS_ROW_5 = [
  { word: "abandon", phonetic: "/əˈbændən/", pos: "v.", def: "to leave behind or give up" },
  { word: "achieve", phonetic: "/əˈtʃiːv/", pos: "v.", def: "to accomplish through effort" },
  { word: "ancient", phonetic: "/ˈeɪnʃənt/", pos: "adj.", def: "dating from a remote period" },
  { word: "beautiful", phonetic: "/ˈbjuːtɪfʊl/", pos: "adj.", def: "delighting the aesthetic senses" },
  { word: "challenge", phonetic: "/ˈtʃælɪndʒ/", pos: "n.", def: "a stimulating demand for effort" },
  { word: "discover", phonetic: "/dɪˈskʌvər/", pos: "v.", def: "to obtain sight or knowledge of" },
  { word: "improve", phonetic: "/ɪmˈpruːv/", pos: "v.", def: "to make greater or superior" },
  { word: "knowledge", phonetic: "/ˈnɒlɪdʒ/", pos: "n.", def: "the body of truth and principles" },
  { word: "successful", phonetic: "/səkˈsesfʊl/", pos: "adj.", def: "having achieved desired result" },
];

export function BookBackground() {
  const speakWord = (e, text) => {
    e.stopPropagation();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const renderDriftingStream = (words, speedClass) => {
    // Duplicate array to create a seamless infinite right-to-left drift
    const duplicated = [...words, ...words];

    return (
      <div className="book-stream-track">
        <div className={`book-stream-strip ${speedClass}`}>
          {duplicated.map((item, idx) => (
            <div
              key={`${item.word}-${idx}`}
              className="stream-word-capsule"
              onClick={(e) => speakWord(e, item.word)}
              title={`Click to listen to "${item.word}"`}
            >
              <strong className="stream-word-term">{item.word}</strong>
              <span className="stream-word-phonetic">{item.phonetic}</span>
              <span className="stream-word-pos">{item.pos}</span>
              <span className="stream-word-def">{item.def}</span>
              <span className="stream-speak-icon">
                <Volume2 size={12} />
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="book-stage-wrapper" aria-hidden="false">
      {/* Warm ambient atmosphere & paper fiber lighting */}
      <div className="book-stage-backdrop" />
      <div className="book-stage-glow" />

      {/* The 3D Open Textbook (Static in position, words moving slowly right to left) */}
      <div className="book-3d-scene">
        <div className="book-3d-binder steady-binder">
          {/* Leather cover backplate & 3D edge page stacks */}
          <div className="book-cover-bottom" />
          <div className="book-pages-stack left-stack" />
          <div className="book-pages-stack right-stack" />
          <div className="book-bookmark-ribbon" />

          {/* Central Gutter / Spine Crease */}
          <div className="book-spine-crease">
            <div className="crease-deep-shadow" />
            <div className="crease-highlight" />
          </div>

          {/* Left Page Header & Watermark */}
          <div className="book-page left-page">
            <div className="page-texture-overlay" />
            <div className="page-inner-content">
              <div className="page-header">
                <span className="page-header-title">ENGLISH VOCABULARY & LEXICON • VOL. I</span>
                <span className="page-number">p. 42</span>
              </div>
              <div className="page-section-rule">
                <span>SECTION A–C : CORE FOUNDATIONS & PRINCIPLES</span>
              </div>

              {/* Left Page Watermark / Seal */}
              <div className="page-seal-watermark">
                <span>VERITAS ET SCIENTIA</span>
              </div>

              <div className="page-footer">
                <span className="page-footer-text">Classical English Textbook Edition</span>
                <span className="page-number-bottom">42</span>
              </div>
            </div>
          </div>

          {/* Right Page Header & Watermark */}
          <div className="book-page right-page">
            <div className="page-texture-overlay" />
            <div className="page-inner-content">
              <div className="page-header">
                <span className="page-number">p. 43</span>
                <span className="page-header-title">ACADEMIC & ESSENTIAL READINGS</span>
              </div>
              <div className="page-section-rule">
                <span>SECTION D–S : KNOWLEDGE & DISCOVERY</span>
              </div>

              {/* Right Page Watermark / Seal */}
              <div className="page-seal-watermark right-seal">
                <span>OXFORD & CAMBRIDGE STANDARD</span>
              </div>

              <div className="page-footer">
                <span className="page-number-bottom">43</span>
                <span className="page-footer-text">Continuous English Lexicon Flow</span>
              </div>
            </div>
          </div>

          {/* Continuous Right-to-Left Drifting Streams of English Words across the Pages */}
          <div className="book-words-drifting-overlay">
            {renderDriftingStream(CORE_WORDS_ROW_1, "drift-slow-1")}
            {renderDriftingStream(CORE_WORDS_ROW_2, "drift-slow-2")}
            {renderDriftingStream(CORE_WORDS_ROW_3, "drift-slow-3")}
            {renderDriftingStream(CORE_WORDS_ROW_4, "drift-slow-4")}
            {renderDriftingStream(CORE_WORDS_ROW_5, "drift-slow-5")}
          </div>
        </div>
      </div>
    </div>
  );
}
