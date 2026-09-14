import React from "react";

const STREAM_1 = [
  "abandon", "achieve", "ancient", "beautiful", "challenge", "discover", "improve",
  "knowledge", "successful", "adventure", "brilliant", "courage", "elegant", "freedom",
  "harmony", "imagine", "journey", "wisdom", "inspire", "flourish", "gratitude",
  "luminous", "resilient", "curiosity", "persevere", "accomplish", "magnificent"
];

const STREAM_2 = [
  "discover", "improve", "knowledge", "successful", "abandon", "achieve", "ancient",
  "beautiful", "challenge", "tranquil", "serenity", "blossom", "abundant", "cherish",
  "eloquent", "melody", "nature", "paradise", "question", "remember", "together",
  "understand", "welcome", "wonder", "education", "learning", "wisdom"
];

const STREAM_3 = [
  "achieve", "abandon", "successful", "knowledge", "improve", "discover", "challenge",
  "beautiful", "ancient", "adventure", "courage", "freedom", "harmony", "inspire",
  "gratitude", "resilient", "accomplish", "curiosity", "flourish", "luminous",
  "persevere", "magnificent", "wisdom", "imagine", "journey", "brilliant"
];

const STREAM_4 = [
  "ancient", "beautiful", "challenge", "discover", "improve", "knowledge", "successful",
  "abandon", "achieve", "eloquent", "abundant", "serenity", "blossom", "tranquil",
  "cherish", "melody", "paradise", "wonder", "education", "adventure", "courage",
  "harmony", "inspire", "gratitude", "resilient", "wisdom"
];

const STREAM_5 = [
  "knowledge", "successful", "improve", "discover", "challenge", "beautiful", "ancient",
  "achieve", "abandon", "brilliant", "elegant", "freedom", "journey", "flourish",
  "luminous", "persevere", "magnificent", "curiosity", "accomplish", "imagine",
  "serenity", "abundant", "tranquil", "eloquent", "gratitude"
];

const STREAM_6 = [
  "challenge", "ancient", "beautiful", "abandon", "achieve", "discover", "improve",
  "knowledge", "successful", "wonder", "wisdom", "inspire", "adventure", "courage",
  "freedom", "harmony", "flourish", "gratitude", "resilient", "luminous",
  "persevere", "accomplish", "magnificent", "curiosity", "education"
];

const STREAM_7 = [
  "beautiful", "challenge", "discover", "improve", "knowledge", "successful", "abandon",
  "achieve", "ancient", "blossom", "abundant", "cherish", "serenity", "tranquil",
  "eloquent", "melody", "nature", "paradise", "understand", "welcome", "learning"
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

  const renderDenseStream = (words, speedClass) => {
    // Duplicate array 3 times for a seamless dense infinite flow
    const duplicated = [...words, ...words, ...words];

    return (
      <div className="book-dense-stream-track">
        <div className={`book-dense-stream-strip ${speedClass}`}>
          {duplicated.map((word, idx) => (
            <span
              key={`${word}-${idx}`}
              className="dense-flowing-word"
              onClick={(e) => speakWord(e, word)}
              title={`Listen to "${word}"`}
            >
              {word}
              <span className="dense-word-separator">•</span>
            </span>
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

      {/* The 3D Open Textbook (Static, no red ribbon, no frames, dense right-to-left flowing text) */}
      <div className="book-3d-scene">
        <div className="book-3d-binder steady-binder">
          {/* Leather cover backplate & 3D edge page stacks */}
          <div className="book-cover-bottom" />
          <div className="book-pages-stack left-stack" />
          <div className="book-pages-stack right-stack" />

          {/* Central Gutter / Spine Crease (Red bookmark ribbon removed as requested) */}
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

          {/* Dense, Frameless Right-to-Left Drifting Streams of English Words across the Pages */}
          <div className="book-words-drifting-overlay dense-flow">
            {renderDenseStream(STREAM_1, "drift-dense-1")}
            {renderDenseStream(STREAM_2, "drift-dense-2")}
            {renderDenseStream(STREAM_3, "drift-dense-3")}
            {renderDenseStream(STREAM_4, "drift-dense-4")}
            {renderDenseStream(STREAM_5, "drift-dense-5")}
            {renderDenseStream(STREAM_6, "drift-dense-6")}
            {renderDenseStream(STREAM_7, "drift-dense-7")}
          </div>
        </div>
      </div>
    </div>
  );
}
