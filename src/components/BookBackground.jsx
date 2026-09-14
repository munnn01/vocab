import React, { useState, useEffect, useRef } from "react";
import { Volume2, ChevronLeft, ChevronRight, BookMarked, Sparkles } from "lucide-react";

const BOOK_SPREADS = [
  {
    spreadNum: 1,
    leftPageNum: 42,
    rightPageNum: 43,
    headerLeft: "ENGLISH VOCABULARY & LEXICON • VOL. I",
    headerRight: "ACADEMIC & ESSENTIAL READINGS",
    leftSection: "SECTION A–C : CORE FOUNDATIONS",
    rightSection: "SECTION D–S : KNOWLEDGE & DISCOVERY",
    leftWords: [
      {
        word: "abandon",
        phonetic: "/əˈbændən/",
        pos: "verb",
        definition: "To cease to support or look after; give up completely or leave behind.",
        example: "Scholars refuse to abandon difficult problems until clarity emerges.",
      },
      {
        word: "achieve",
        phonetic: "/əˈtʃiːv/",
        pos: "verb",
        definition: "To successfully bring about or reach a desired objective through persistent effort.",
        example: "Diligent practice enables students to achieve academic distinction.",
      },
      {
        word: "ancient",
        phonetic: "/ˈeɪnʃənt/",
        pos: "adjective",
        definition: "Belonging to times long past, venerable and rich in historical significance.",
        example: "The ancient manuscript revealed wisdom preserved across millennia.",
      },
      {
        word: "beautiful",
        phonetic: "/ˈbjuːtɪfʊl/",
        pos: "adjective",
        definition: "Pleasing the senses or mind aesthetically; inspiring graceful admiration.",
        example: "A beautiful composition harmonizes sound, meaning, and emotion.",
      },
      {
        word: "challenge",
        phonetic: "/ˈtʃælɪndʒ/",
        pos: "noun",
        definition: "A demanding task or situation that tests powers of mind, character, and skill.",
        example: "Embrace each intellectual challenge as a doorway to growth.",
      },
    ],
    rightWords: [
      {
        word: "discover",
        phonetic: "/dɪˈskʌvər/",
        pos: "verb",
        definition: "To find unexpectedly or through systematic inquiry; uncover truth.",
        example: "Attentive readers discover profound insights in every chapter.",
      },
      {
        word: "improve",
        phonetic: "/ɪmˈpruːv/",
        pos: "verb",
        definition: "To enhance in value, proficiency, or excellence; become superior.",
        example: "Consistent vocabulary review will noticeably improve reading comprehension.",
      },
      {
        word: "knowledge",
        phonetic: "/ˈnɒlɪdʒ/",
        pos: "noun",
        definition: "Facts, information, and skills acquired through learning, study, or experience.",
        example: "Knowledge unlocks the potential to perceive the world with depth.",
      },
      {
        word: "successful",
        phonetic: "/səkˈsesfʊl/",
        pos: "adjective",
        definition: "Accomplishing an aim, objective, or intended purpose with distinction.",
        example: "A successful learner maintains daily curiosity and intellectual discipline.",
      },
    ],
  },
  {
    spreadNum: 2,
    leftPageNum: 44,
    rightPageNum: 45,
    headerLeft: "ENGLISH VOCABULARY & LEXICON • VOL. I",
    headerRight: "EXPRESSION & CREATIVITY",
    leftSection: "SECTION A–E : VIRTUE & EXPRESSION",
    rightSection: "SECTION F–M : TRANQUILITY & GRACE",
    leftWords: [
      {
        word: "adventure",
        phonetic: "/ədˈventʃər/",
        pos: "noun",
        definition: "An unusual and exciting, typically adventurous experience or activity.",
        example: "Learning a new language is a lifelong adventure of the mind.",
      },
      {
        word: "brilliant",
        phonetic: "/ˈbrɪljənt/",
        pos: "adjective",
        definition: "Exceptionally clever, talented, or radiant in appearance and intellect.",
        example: "Her brilliant explanation resolved the most intricate grammatical debate.",
      },
      {
        word: "courage",
        phonetic: "/ˈkʌrɪdʒ/",
        pos: "noun",
        definition: "Strength in the face of pain or grief; the ability to attempt what is difficult.",
        example: "Speaking with courage allows rapid mastery of foreign tongues.",
      },
      {
        word: "eloquent",
        phonetic: "/ˈeləkwənt/",
        pos: "adjective",
        definition: "Fluent or persuasive in speaking or writing; clearly expressive.",
        example: "The author provided an eloquent defense of classic literature.",
      },
    ],
    rightWords: [
      {
        word: "flourish",
        phonetic: "/ˈflʌrɪʃ/",
        pos: "verb",
        definition: "To grow or develop in a healthy or vigorous way, especially as a result of favorable environment.",
        example: "Given supportive instruction, any student can flourish.",
      },
      {
        word: "gratitude",
        phonetic: "/ˈɡrætɪtjuːd/",
        pos: "noun",
        definition: "The quality of being thankful; readiness to show appreciation and kindness.",
        example: "Express gratitude to mentors who illuminated the path to learning.",
      },
      {
        word: "harmony",
        phonetic: "/ˈhɑːməni/",
        pos: "noun",
        definition: "Agreement, concord, or pleasing arrangement of parts into a satisfying whole.",
        example: "Poetry achieves a delicate harmony between rhythm and sentiment.",
      },
      {
        word: "inspire",
        phonetic: "/ɪnˈspaɪər/",
        pos: "verb",
        definition: "Fill someone with the urge or ability to do or feel something creative.",
        example: "Great literature will forever inspire human compassion and thought.",
      },
    ],
  },
];

export function BookBackground() {
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [activeTag, setActiveTag] = useState("all");
  const bookRef = useRef(null);

  const currentSpread = BOOK_SPREADS[spreadIndex];

  // Mouse tilt parallax for realistic 3D perspective
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!bookRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 12;
      const y = (e.clientY / window.innerHeight - 0.5) * -10;
      bookRef.current.style.transform = `perspective(1600px) rotateX(${y}deg) rotateY(${x}deg)`;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const speakWord = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const prevPage = () => {
    setSpreadIndex((prev) => (prev > 0 ? prev - 1 : BOOK_SPREADS.length - 1));
  };

  const nextPage = () => {
    setSpreadIndex((prev) => (prev < BOOK_SPREADS.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="book-stage-wrapper" aria-hidden="false">
      {/* Warm ambient atmosphere & paper fiber overlay */}
      <div className="book-stage-backdrop" />
      <div className="book-stage-glow" />

      {/* Floating English Vocabulary Header Bar */}
      <div className="book-shelf-topbar">
        <div className="book-shelf-brand">
          <BookMarked size={17} className="gold-icon" />
          <span>CLASSICAL ENGLISH LEXICON & TEXTBOOK</span>
        </div>
        <div className="book-shelf-tabs" role="tablist">
          {["Vocabulary", "Pronunciation", "Definition", "Example", "Learn"].map((tag) => (
            <button
              key={tag}
              type="button"
              className={`shelf-tab-btn ${activeTag === tag.toLowerCase() ? "active" : ""}`}
              onClick={() => setActiveTag(tag.toLowerCase())}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* The 3D Open Textbook */}
      <div className="book-3d-scene">
        <div ref={bookRef} className="book-3d-binder">
          {/* Leather cover borders & depth layers */}
          <div className="book-cover-bottom" />
          <div className="book-pages-stack left-stack" />
          <div className="book-pages-stack right-stack" />
          <div className="book-bookmark-ribbon" />

          {/* Left Page */}
          <div className="book-page left-page">
            <div className="page-texture-overlay" />
            <div className="page-inner-content">
              <div className="page-header">
                <span className="page-header-title">{currentSpread.headerLeft}</span>
                <span className="page-number">p. {currentSpread.leftPageNum}</span>
              </div>
              <div className="page-section-rule">
                <span>{currentSpread.leftSection}</span>
              </div>

              <div className="page-entries-list">
                {currentSpread.leftWords.map((entry) => (
                  <div key={entry.word} className="page-entry-item">
                    <div className="entry-head">
                      <strong className="entry-term">{entry.word}</strong>
                      <span className="entry-phonetic">{entry.phonetic}</span>
                      <span className="entry-pos">({entry.pos}.)</span>
                      <button
                        type="button"
                        className="entry-speak-btn"
                        onClick={() => speakWord(entry.word)}
                        title={`Listen to pronunciation of "${entry.word}"`}
                        aria-label={`Pronounce ${entry.word}`}
                      >
                        <Volume2 size={13} />
                      </button>
                    </div>
                    <p className="entry-def">
                      <span className="def-tag">Definition:</span> {entry.definition}
                    </p>
                    <p className="entry-ex">
                      <span className="ex-tag">Example:</span> <em>"{entry.example}"</em>
                    </p>
                  </div>
                ))}
              </div>

              <div className="page-footer">
                <span className="page-footer-text">English Vocabulary Mastery • Volume I</span>
                <span className="page-number-bottom">{currentSpread.leftPageNum}</span>
              </div>
            </div>
            {/* Page curl gradient on outer edge */}
            <div className="page-edge-curl left-curl" />
          </div>

          {/* Central Gutter / Spine Fold */}
          <div className="book-spine-crease">
            <div className="crease-deep-shadow" />
            <div className="crease-highlight" />
          </div>

          {/* Right Page */}
          <div className="book-page right-page">
            <div className="page-texture-overlay" />
            <div className="page-inner-content">
              <div className="page-header">
                <span className="page-number">p. {currentSpread.rightPageNum}</span>
                <span className="page-header-title">{currentSpread.headerRight}</span>
              </div>
              <div className="page-section-rule">
                <span>{currentSpread.rightSection}</span>
              </div>

              <div className="page-entries-list">
                {currentSpread.rightWords.map((entry) => (
                  <div key={entry.word} className="page-entry-item">
                    <div className="entry-head">
                      <strong className="entry-term">{entry.word}</strong>
                      <span className="entry-phonetic">{entry.phonetic}</span>
                      <span className="entry-pos">({entry.pos}.)</span>
                      <button
                        type="button"
                        className="entry-speak-btn"
                        onClick={() => speakWord(entry.word)}
                        title={`Listen to pronunciation of "${entry.word}"`}
                        aria-label={`Pronounce ${entry.word}`}
                      >
                        <Volume2 size={13} />
                      </button>
                    </div>
                    <p className="entry-def">
                      <span className="def-tag">Definition:</span> {entry.definition}
                    </p>
                    <p className="entry-ex">
                      <span className="ex-tag">Example:</span> <em>"{entry.example}"</em>
                    </p>
                  </div>
                ))}
              </div>

              <div className="page-footer">
                <span className="page-number-bottom">{currentSpread.rightPageNum}</span>
                <span className="page-footer-text">Oxford & Cambridge Lexicon Standard</span>
              </div>
            </div>
            <div className="page-edge-curl right-curl" />
          </div>
        </div>
      </div>

      {/* Book Bottom Controls (Previous Page / Next Page) */}
      <div className="book-controls-bottom">
        <button
          type="button"
          className="book-page-nav-btn prev-btn"
          onClick={prevPage}
          title="Turn to previous page"
        >
          <ChevronLeft size={16} />
          <span>Previous Page</span>
        </button>

        <div className="book-page-indicator">
          <Sparkles size={14} className="gold-icon" />
          <span>
            Pages {currentSpread.leftPageNum}–{currentSpread.rightPageNum} of 250 • Daily English Book
          </span>
        </div>

        <button
          type="button"
          className="book-page-nav-btn next-btn"
          onClick={nextPage}
          title="Turn to next page"
        >
          <span>Next Page</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
