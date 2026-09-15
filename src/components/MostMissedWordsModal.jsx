import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Volume2, X, Filter, BookOpen, Users, TrendingUp } from "lucide-react";
import { POS_LABELS, speakWord } from "../lib/vocabulary";

export function MostMissedWordsModal({
  isOpen,
  onClose,
  decks = [],
  students = [],
  studentResults = [],
  initialDeckId = "",
  initialClass = "all",
}) {
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId);
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [copied, setCopied] = useState(false);

  // Available classes
  const classList = useMemo(() => {
    const set = new Set();
    for (const s of students) {
      if (s.className && s.className.trim()) set.add(s.className.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));
  }, [students]);

  // Student map to lookup class
  const studentMap = useMemo(() => {
    const map = new Map();
    for (const s of students) {
      map.set(s.id, s);
    }
    return map;
  }, [students]);

  // Filter sessions by deck and class
  const filteredSessions = useMemo(() => {
    return (studentResults || []).filter((session) => {
      if (selectedDeckId && session.deckId !== selectedDeckId) return false;
      if (selectedClass !== "all") {
        const student = studentMap.get(session.studentId);
        if (!student || student.className !== selectedClass) return false;
      }
      return true;
    });
  }, [studentResults, selectedDeckId, selectedClass, studentMap]);

  // Aggregate missed words
  const missedWordsStats = useMemo(() => {
    const counts = new Map(); // key: term.toLowerCase(), value: { term, meaning, partOfSpeech, count, decks: Set }

    for (const session of filteredSessions) {
      const mistakes = Array.isArray(session.mistakeWords) ? session.mistakeWords : [];
      for (const item of mistakes) {
        if (!item || !item.term) continue;
        const key = item.term.trim().toLowerCase();
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
          if (session.deckTitle) existing.decks.add(session.deckTitle);
        } else {
          counts.set(key, {
            term: item.term.trim(),
            meaning: item.meaning || "",
            partOfSpeech: item.partOfSpeech || "other",
            count: 1,
            decks: new Set(session.deckTitle ? [session.deckTitle] : []),
          });
        }
      }
    }

    // Also look up full info from decks if meaning or partOfSpeech missing
    for (const deck of decks) {
      for (const word of deck.words || []) {
        const key = word.term.trim().toLowerCase();
        if (counts.has(key)) {
          const entry = counts.get(key);
          if (!entry.meaning && word.meaning) entry.meaning = word.meaning;
          if ((!entry.partOfSpeech || entry.partOfSpeech === "other") && word.partOfSpeech) {
            entry.partOfSpeech = word.partOfSpeech;
          }
        }
      }
    }

    const totalSessionsCount = filteredSessions.length;
    return Array.from(counts.values())
      .map((item) => {
        const percentage = totalSessionsCount > 0 ? Math.round((item.count / totalSessionsCount) * 100) : 0;
        return {
          ...item,
          percentage,
          deckNames: Array.from(item.decks).join(", "),
        };
      })
      .sort((a, b) => b.count - a.count || b.percentage - a.percentage);
  }, [filteredSessions, decks]);

  if (!isOpen) return null;

  function handleCopyList() {
    if (!missedWordsStats.length) return;
    const lines = missedWordsStats.map((item, idx) => {
      const pos = item.partOfSpeech && item.partOfSpeech !== "other" ? ` (${item.partOfSpeech})` : "";
      return `${idx + 1}. ${item.term}${pos}: ${item.meaning || "—"} [${item.count} lượt sai]`;
    });
    const content = `DANH SÁCH TỪ VỰNG HỌC SINH HAY LÀM SAI NHẤT:\n${lines.join("\n")}`;
    navigator.clipboard?.writeText?.(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-dialog missed-words-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="missed-modal-title">
            <span className="chart-badge-icon warning-badge-icon">
              <AlertTriangle size={24} />
            </span>
            <div>
              <div className="eyebrow">Phân tích kết quả học tập</div>
              <h2>Top từ vựng học sinh hay làm sai nhất</h2>
            </div>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        {/* Filter bar */}
        <div className="missed-filter-bar">
          <div className="filter-group">
            <label htmlFor="filter-deck"><BookOpen size={14} /> Bài học:</label>
            <select
              id="filter-deck"
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
            >
              <option value="">Tất cả bài học ({decks.length})</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>{deck.title}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-class"><Users size={14} /> Lớp:</label>
            <select
              id="filter-class"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="all">Tất cả các lớp</option>
              {classList.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary cards */}
        <div className="progress-summary-cards missed-summary-cards">
          <div className="progress-card">
            <span className="progress-card-label">Lượt thi phân tích</span>
            <strong className="progress-card-value text-blue">{filteredSessions.length} lượt</strong>
          </div>
          <div className="progress-card">
            <span className="progress-card-label">Tổng từ bị làm sai</span>
            <strong className="progress-card-value text-amber">{missedWordsStats.length} từ</strong>
          </div>
          <div className="progress-card">
            <span className="progress-card-label">Từ sai nhiều nhất</span>
            <strong className="progress-card-value text-danger" title={missedWordsStats[0]?.term || "—"}>
              {missedWordsStats[0]?.term || "—"}
            </strong>
          </div>
        </div>

        {/* Word list */}
        <div className="missed-list-wrap">
          {missedWordsStats.length > 0 ? (
            <div className="missed-words-list">
              {missedWordsStats.map((item, idx) => {
                const isHighRisk = item.percentage >= 50 || item.count >= 5;
                const isMedRisk = item.percentage >= 25 || item.count >= 3;
                const badgeClass = isHighRisk ? "badge-danger" : isMedRisk ? "badge-warning" : "badge-safe";
                const badgeText = isHighRisk ? "Rất khó" : isMedRisk ? "Cần lưu ý" : "Nắm khá";

                return (
                  <div key={item.term} className="missed-word-item">
                    <div className="missed-rank">#{idx + 1}</div>
                    <div className="missed-word-details">
                      <div className="missed-word-header">
                        <strong className="missed-term">{item.term}</strong>
                        {item.partOfSpeech && item.partOfSpeech !== "other" && (
                          <span className="pos-chip">{POS_LABELS[item.partOfSpeech] || item.partOfSpeech}</span>
                        )}
                        <button
                          type="button"
                          className="speak-inline-btn"
                          onClick={() => speakWord(item.term)}
                          title="Nghe phát âm"
                        >
                          <Volume2 size={15} />
                        </button>
                      </div>
                      <div className="missed-meaning">{item.meaning || "—"}</div>
                      {item.deckNames && <div className="missed-deck-source">{item.deckNames}</div>}
                    </div>

                    <div className="missed-stat-col">
                      <div className="missed-count-badge">
                        <span className={`missed-level-tag ${badgeClass}`}>{badgeText}</span>
                        <strong>{item.count} lượt sai</strong>
                        {item.percentage > 0 && <small>({item.percentage}%)</small>}
                      </div>
                      <div className="missed-progress-track">
                        <div
                          className={`missed-progress-bar ${isHighRisk ? "bar-danger" : isMedRisk ? "bar-warning" : "bar-safe"}`}
                          style={{ width: `${Math.min(100, Math.max(8, item.percentage || (item.count * 15)))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-missed-box">
              <Check size={40} className="text-green" />
              <h3>Chưa có dữ liệu từ vựng sai</h3>
              <p>Học sinh làm bài rất tốt hoặc chưa có lượt nộp bài nào phù hợp với bộ lọc đã chọn.</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="modal-actions missed-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleCopyList}
            disabled={!missedWordsStats.length}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? "Đã sao chép!" : "Sao chép danh sách từ khó"}</span>
          </button>
          <button type="button" className="primary-button" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
