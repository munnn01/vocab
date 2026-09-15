import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft, Check, ChevronRight, CircleAlert, Clock, Layers3,
  LoaderCircle, Lock, Plus, RotateCcw, ShieldCheck, Sparkles,
  Trash2, Trophy, Users, X, Volume2, Shuffle, Pencil, BarChart3,
  Medal, Timer, AlertTriangle, BookOpen, BrainCircuit
} from "lucide-react";
import { POS_LABELS, shuffle, speakWord } from "../lib/vocabulary";

export function FlashcardView({ deck, onBack, onStartQuiz }) {
  const [words, setWords] = useState(deck?.words || []);
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    setWords(deck?.words || []);
    setIndex(0);
    setIsFlipped(false);
  }, [deck]);

  const currentWord = words[index];

  const handleNext = useCallback(() => {
    if (index < words.length - 1) {
      setIndex((i) => i + 1);
      setIsFlipped(false);
    }
  }, [index, words.length]);

  const handlePrev = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setIsFlipped(false);
    }
  }, [index]);

  const handleShuffle = useCallback(() => {
    setWords(shuffle([...words]));
    setIndex(0);
    setIsFlipped(false);
  }, [words]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, handlePrev]);

  if (!currentWord) {
    return (
      <div className="flashcard-view empty">
        <p>Không có từ vựng nào trong bộ này.</p>
        <button className="secondary-button" type="button" onClick={onBack}>Quay lại</button>
      </div>
    );
  }

  const posLabel = POS_LABELS[currentWord.partOfSpeech] || currentWord.partOfSpeech || "Từ";

  return (
    <div className="flashcard-view">
      <div className="flashcard-head">
        <button className="back-link" type="button" onClick={onBack}>
          <ArrowLeft size={18} /> Về bộ từ
        </button>
        <div className="flashcard-title">
          <div className="eyebrow">Chế độ ôn tập lật thẻ</div>
          <h1>{deck.title}</h1>
        </div>
        <button className="secondary-button compact" type="button" onClick={handleShuffle} title="Trộn thứ tự thẻ">
          <Shuffle size={16} /> <span>Trộn thẻ</span>
        </button>
      </div>

      <div className="flashcard-progress">
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${((index + 1) / words.length) * 100}%` }} />
        </div>
        <div className="progress-text">
          <span>Thẻ <strong>{index + 1}</strong> / {words.length}</span>
          <span className="keyboard-tip">Mẹo: Bấm phím <b>Space</b> để lật thẻ, phím <b>← →</b> để chuyển thẻ</span>
        </div>
      </div>

      <div className="flashcard-container">
        <div
          className={`flashcard-card ${isFlipped ? "is-flipped" : ""}`}
          onClick={() => setIsFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          aria-label="Thẻ từ vựng. Bấm để lật xem nghĩa hoặc từ."
        >
          {/* Mặt trước: Từ tiếng Anh */}
          <div className="flashcard-face flashcard-front">
            <span className="flashcard-badge">{posLabel}</span>
            <div className="flashcard-term-wrap">
              <span className="flashcard-term">{currentWord.term}</span>
              <button
                type="button"
                className="flashcard-audio-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  speakWord(currentWord.term);
                }}
                title="Nghe phát âm tiếng Anh"
              >
                <Volume2 size={24} />
              </button>
            </div>
            <span className="flashcard-hint">Bấm vào thẻ để lật xem nghĩa 🔄</span>
          </div>

          {/* Mặt sau: Nghĩa tiếng Việt */}
          <div className="flashcard-face flashcard-back">
            <span className="flashcard-badge">{currentWord.term} ({posLabel})</span>
            <span className="flashcard-meaning">{currentWord.meaning}</span>
            <div className="flashcard-back-actions">
              <button
                type="button"
                className="flashcard-audio-btn mini"
                onClick={(e) => {
                  e.stopPropagation();
                  speakWord(currentWord.term);
                }}
                title="Nghe phát âm lại"
              >
                <Volume2 size={16} /> Nghe phát âm
              </button>
            </div>
            <span className="flashcard-hint">Bấm vào thẻ để xem lại từ tiếng Anh 🔄</span>
          </div>
        </div>
      </div>

      <div className="flashcard-controls">
        <button
          className="secondary-button flashcard-nav-btn"
          type="button"
          onClick={handlePrev}
          disabled={index === 0}
        >
          <ArrowLeft size={18} /> Trước
        </button>
        <button
          className="primary-button flashcard-flip-btn"
          type="button"
          onClick={() => setIsFlipped((f) => !f)}
        >
          <RotateCcw size={18} /> {isFlipped ? "Xem từ tiếng Anh" : "Lật xem nghĩa"}
        </button>
        <button
          className="secondary-button flashcard-nav-btn"
          type="button"
          onClick={handleNext}
          disabled={index === words.length - 1}
        >
          Tiếp theo <ChevronRight size={18} />
        </button>
      </div>

      {index === words.length - 1 && onStartQuiz && (
        <div className="flashcard-finish-box">
          <span>Bạn đã xem hết tất cả các từ trong bộ này! Đã sẵn sàng làm bài kiểm tra chưa?</span>
          <button className="primary-button" type="button" onClick={onStartQuiz}>
            <BrainCircuit size={18} /> Bắt đầu bài kiểm tra ngay
          </button>
        </div>
      )}
    </div>
  );
}

export function LeaderboardModal({ isOpen, onClose, decks = [], students = [], studentResults = [], currentAccount }) {
  const [selectedDeckId, setSelectedDeckId] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");

  const classList = useMemo(() => {
    const set = new Set();
    for (const s of students) if (s.className?.trim()) set.add(s.className.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [students]);

  const leaderboardEntries = useMemo(() => {
    const studentMap = new Map();
    for (const s of students) {
      studentMap.set(s.id, {
        id: s.id,
        name: s.displayName,
        className: s.className || "Chưa phân lớp",
        bestScore: 0,
        totalScore: 0,
        attempts: 0,
        hasResult: false,
      });
    }

    for (const res of studentResults) {
      if (!res.studentId || !studentMap.has(res.studentId)) continue;
      if (selectedDeckId !== "all" && res.deckId !== selectedDeckId) continue;
      const entry = studentMap.get(res.studentId);
      entry.hasResult = true;
      entry.attempts += 1;
      entry.totalScore += (res.score || 0);
      if (typeof res.score === "number" && res.score > entry.bestScore) {
        entry.bestScore = res.score;
      }
    }

    let entries = Array.from(studentMap.values()).filter((e) => e.hasResult);
    if (selectedClass !== "all") {
      entries = entries.filter((e) => e.className === selectedClass);
    }

    entries.sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      return b.attempts - a.attempts;
    });

    return entries;
  }, [students, studentResults, selectedDeckId, selectedClass]);

  if (!isOpen) return null;

  const myRankIndex = currentAccount?.role === "student"
    ? leaderboardEntries.findIndex((e) => e.id === currentAccount.id)
    : -1;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-dialog leaderboard-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="leaderboard-modal-title">
            <span className="trophy-badge-icon"><Trophy size={26} /></span>
            <div>
              <div className="eyebrow">Bảng vinh danh</div>
              <h2>Bảng xếp hạng thành tích</h2>
            </div>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </div>

        <div className="leaderboard-filters">
          <div className="filter-item">
            <label htmlFor="lb-filter-deck">Bộ từ vựng:</label>
            <select id="lb-filter-deck" value={selectedDeckId} onChange={(e) => setSelectedDeckId(e.target.value)} className="auth-input compact-select">
              <option value="all">Tất cả các bộ từ</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label htmlFor="lb-filter-class">Lớp học:</label>
            <select id="lb-filter-class" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="auth-input compact-select">
              <option value="all">Tất cả các lớp</option>
              {classList.map((cls) => (
                <option key={cls} value={cls}>Lớp {cls}</option>
              ))}
            </select>
          </div>
        </div>

        {myRankIndex >= 0 && (
          <div className="my-rank-banner">
            <Medal size={20} />
            <span>Vị trí của bạn: Hạng <strong>#{myRankIndex + 1}</strong> với điểm cao nhất <strong>{leaderboardEntries[myRankIndex].bestScore} điểm</strong>!</span>
          </div>
        )}

        <div className="leaderboard-list-wrap">
          {leaderboardEntries.length > 0 ? (
            <div className="leaderboard-list">
              {leaderboardEntries.map((entry, idx) => {
                const rank = idx + 1;
                const isMe = entry.id === currentAccount?.id;
                let rankClass = "rank-other";
                let rankBadge = rank;
                if (rank === 1) { rankClass = "rank-gold"; rankBadge = "🥇"; }
                else if (rank === 2) { rankClass = "rank-silver"; rankBadge = "🥈"; }
                else if (rank === 3) { rankClass = "rank-bronze"; rankBadge = "🥉"; }

                return (
                  <div key={entry.id} className={`leaderboard-item ${rankClass} ${isMe ? "is-me" : ""}`}>
                    <div className="leaderboard-rank">{rankBadge}</div>
                    <div className="leaderboard-info">
                      <div className="leaderboard-name">
                        <strong>{entry.name}</strong>
                        {isMe && <span className="you-pill">Bạn</span>}
                      </div>
                      <div className="leaderboard-meta">
                        <span className="class-name-tag">{entry.className}</span>
                        <span>Đã làm: {entry.attempts} lần</span>
                      </div>
                    </div>
                    <div className="leaderboard-score">
                      <strong>{entry.bestScore}</strong>
                      <small>điểm cao nhất</small>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-leaderboard">
              <Trophy size={36} />
              <p>Chưa có dữ liệu làm bài cho tiêu chí lọc này.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StudentProgressModal({ isOpen, onClose, student, studentResults = [] }) {
  if (!isOpen || !student) return null;

  const myResults = useMemo(() => {
    return (studentResults || [])
      .filter((r) => r.studentId === student.id)
      .sort((a, b) => new Date(a.completedAt || 0).getTime() - new Date(b.completedAt || 0).getTime());
  }, [studentResults, student.id]);

  const stats = useMemo(() => {
    if (!myResults.length) return { avg: 0, best: 0, total: 0, completedCount: 0 };
    const scores = myResults.map((r) => r.score || 0);
    const sum = scores.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round(sum / scores.length),
      best: Math.max(...scores),
      total: myResults.length,
      completedCount: myResults.filter((r) => r.completed).length,
    };
  }, [myResults]);

  const maxScore = Math.max(100, ...myResults.map((r) => r.score || 0));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-dialog progress-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="progress-modal-title">
            <span className="chart-badge-icon"><BarChart3 size={24} /></span>
            <div>
              <div className="eyebrow">Hồ sơ tiến trình học sinh</div>
              <h2>{student.displayName} <span className="class-badge-inline">Lớp {student.className || "—"}</span></h2>
            </div>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </div>

        <div className="progress-summary-cards">
          <div className="progress-card">
            <span className="progress-card-label">Điểm trung bình</span>
            <strong className="progress-card-value text-amber">{stats.avg} điểm</strong>
          </div>
          <div className="progress-card">
            <span className="progress-card-label">Điểm cao nhất</span>
            <strong className="progress-card-value text-green">{stats.best} điểm</strong>
          </div>
          <div className="progress-card">
            <span className="progress-card-label">Tổng lượt làm bài</span>
            <strong className="progress-card-value">{stats.total} lần</strong>
          </div>
          <div className="progress-card">
            <span className="progress-card-label">Hoàn thành đầy đủ</span>
            <strong className="progress-card-value text-blue">{stats.completedCount} / {stats.total}</strong>
          </div>
        </div>

        {myResults.length > 0 && (
          <div className="progress-chart-box">
            <div className="chart-header">
              <h3>Biểu đồ điểm số qua các lần làm bài</h3>
              <span>{myResults.length} lần làm</span>
            </div>
            <div className="svg-chart-container">
              <svg viewBox={`0 0 ${Math.max(400, myResults.length * 65)} 180`} className="progress-svg-chart">
                <line x1="30" y1="20" x2="100%" y2="20" stroke="rgba(139,115,85,0.15)" strokeDasharray="3 3" />
                <text x="5" y="24" fontSize="10" fill="#8b7355">100</text>
                <line x1="30" y1="80" x2="100%" y2="80" stroke="rgba(139,115,85,0.15)" strokeDasharray="3 3" />
                <text x="10" y="84" fontSize="10" fill="#8b7355">50</text>
                <line x1="30" y1="140" x2="100%" y2="140" stroke="rgba(139,115,85,0.15)" strokeDasharray="3 3" />
                <text x="15" y="144" fontSize="10" fill="#8b7355">0</text>

                {myResults.map((r, i) => {
                  const x = 55 + i * 60;
                  const barHeight = Math.max(4, Math.round(((r.score || 0) / maxScore) * 115));
                  const y = 140 - barHeight;
                  const isGood = (r.score || 0) >= 80;
                  const isMid = (r.score || 0) >= 50;
                  const color = isGood ? "#2e7d32" : isMid ? "#b8860b" : "#c0392b";
                  const dateStr = r.completedAt ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(r.completedAt)) : `#${i+1}`;

                  return (
                    <g key={r.id || i} className="chart-bar-group">
                      <rect x={x - 14} y={y} width="28" height={barHeight} rx="4" fill={color} opacity="0.88" />
                      <text x={x} y={y - 5} textAnchor="middle" fontSize="11" fontWeight="bold" fill={color}>{r.score}</text>
                      <text x={x} y="158" textAnchor="middle" fontSize="10" fill="#8b7355">{dateStr}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        <div className="progress-history-box">
          <h3>Lịch sử chi tiết các lần thi</h3>
          <div className="progress-table-wrap">
            <table className="progress-table">
              <thead>
                <tr>
                  <th>Lần</th>
                  <th>Thời gian</th>
                  <th>Bộ từ</th>
                  <th>Chế độ</th>
                  <th>Điểm</th>
                  <th>Đúng/Tổng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {myResults.length > 0 ? (
                  [...myResults].reverse().map((r, index) => (
                    <tr key={r.id || index}>
                      <td>#{myResults.length - index}</td>
                      <td>{r.completedAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(r.completedAt)) : "—"}</td>
                      <td><strong>{r.deckTitle || "Bộ từ"}</strong></td>
                      <td>{r.mode === "quiz" ? "Trắc nghiệm" : "Điền từ"}</td>
                      <td>
                        <span className={`score-badge ${r.completed ? "" : "left-early"}`}>
                          {r.score} điểm
                        </span>
                      </td>
                      <td>{r.correct || 0} / {r.total || 0}</td>
                      <td><span className={`issue-badge ${r.violationReason ? "badge-violation-warning" : "badge-clean"}`}>{r.violationReason || "Hoàn thành tốt"}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "20px" }}>
                      Học sinh chưa làm bài kiểm tra nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditDeckModal({ isOpen, onClose, deck, onSave, isSaving }) {
  const [title, setTitle] = useState(deck?.title || "");
  const [words, setWords] = useState(deck?.words || []);
  const [error, setError] = useState("");

  useEffect(() => {
    if (deck) {
      setTitle(deck.title || "");
      setWords([...(deck.words || [])]);
      setError("");
    }
  }, [deck]);

  if (!isOpen || !deck) return null;

  const handleWordChange = (index, field, value) => {
    setWords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddWord = () => {
    setWords((prev) => [
      ...prev,
      { id: crypto.randomUUID(), term: "", partOfSpeech: "n", meaning: "" },
    ]);
  };

  const handleRemoveWord = (index) => {
    if (words.length <= 1) {
      setError("Bộ từ vựng cần có ít nhất 1 từ.");
      return;
    }
    setError("");
    setWords((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Vui lòng nhập tên bộ từ.");
      return;
    }
    const cleanWords = words.map((w) => ({
      ...w,
      term: (w.term || "").trim(),
      meaning: (w.meaning || "").trim(),
    }));
    const invalidIndex = cleanWords.findIndex((w) => !w.term || !w.meaning);
    if (invalidIndex >= 0) {
      setError(`Dòng số ${invalidIndex + 1} đang thiếu từ tiếng Anh hoặc nghĩa tiếng Việt.`);
      return;
    }
    onSave(deck.id, title.trim(), cleanWords);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !isSaving && onClose()}>
      <div className="modal-dialog edit-deck-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <form onSubmit={handleFormSubmit}>
          <div className="modal-head">
            <div className="edit-deck-modal-title">
              <span className="pencil-badge-icon"><Pencil size={22} /></span>
              <div>
                <div className="eyebrow">Quản lý nội dung</div>
                <h2>Chỉnh sửa bộ từ vựng</h2>
              </div>
            </div>
            <button className="dialog-close" type="button" onClick={onClose} aria-label="Đóng" disabled={isSaving}><X size={18} /></button>
          </div>

          <div className="edit-deck-body">
            <div className="field-group">
              <label className="field-label" htmlFor="edit-deck-title">Tên bộ từ</label>
              <input
                id="edit-deck-title"
                className="auth-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tên bộ từ..."
                required
                disabled={isSaving}
              />
            </div>

            <div className="edit-words-section">
              <div className="edit-words-header">
                <h3>Danh sách từ ({words.length} từ)</h3>
                <button type="button" className="secondary-button compact" onClick={handleAddWord} disabled={isSaving}>
                  <Plus size={16} /> Thêm từ mới
                </button>
              </div>

              {error && (
                <div className="login-error" role="alert">
                  <CircleAlert size={16} /> {error}
                </div>
              )}

              <div className="edit-words-table-wrap">
                <table className="edit-words-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>STT</th>
                      <th>Từ tiếng Anh</th>
                      <th style={{ width: 135 }}>Loại từ</th>
                      <th>Nghĩa tiếng Việt</th>
                      <th style={{ width: 48 }}>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {words.map((word, index) => (
                      <tr key={word.id || index}>
                        <td className="text-muted">{index + 1}</td>
                        <td>
                          <input
                            className="inline-input"
                            value={word.term}
                            onChange={(e) => handleWordChange(index, "term", e.target.value)}
                            placeholder="Từ tiếng Anh..."
                            required
                            disabled={isSaving}
                          />
                        </td>
                        <td>
                          <select
                            className="inline-select"
                            value={word.partOfSpeech || "n"}
                            onChange={(e) => handleWordChange(index, "partOfSpeech", e.target.value)}
                            disabled={isSaving}
                          >
                            {Object.entries(POS_LABELS).map(([code, label]) => (
                              <option key={code} value={code}>{code} ({label})</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="inline-input"
                            value={word.meaning}
                            onChange={(e) => handleWordChange(index, "meaning", e.target.value)}
                            placeholder="Nghĩa tiếng Việt..."
                            required
                            disabled={isSaving}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="delete-word-btn"
                            onClick={() => handleRemoveWord(index)}
                            title="Xóa từ này"
                            disabled={isSaving}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="modal-foot">
            <button className="secondary-button" type="button" onClick={onClose} disabled={isSaving}>Hủy</button>
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
              <span>{isSaving ? "Đang lưu…" : "Lưu thay đổi"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DeckExamModeSettings({ isExamMode, onChange, disabled }) {
  const isExam = isExamMode !== false;
  return (
    <div className="setting-card exam-mode-setting">
      <div className="setting-card-head">
        <div className="setting-icon-title">
          <ShieldCheck size={18} className="setting-icon" />
          <strong>Quy chế làm bài</strong>
        </div>
        <span className={`status-pill ${isExam ? "strict" : "relaxed"}`}>
          {isExam ? "Kiểm tra nghiêm ngặt" : "Luyện tập tự do"}
        </span>
      </div>
      <p className="setting-description">
        {isExam
          ? "Đang bật chế độ kiểm tra: Bắt buộc toàn màn hình, chống chuyển tab, phạt trừ điểm khi gian lận (lần 1 trừ 25%, lần 2 trừ 75%, lần 3 hủy bài)."
          : "Đang bật chế độ tự do: Không bắt buộc toàn màn hình, không trừ điểm gian lận, học sinh có thể ôn luyện thoải mái trước kỳ thi."}
      </p>
      <div className="mode-toggle-group">
        <button
          type="button"
          className={`toggle-option-btn ${isExam ? "active" : ""}`}
          onClick={() => onChange(true)}
          disabled={disabled}
        >
          <ShieldCheck size={16} /> Kiểm tra nghiêm ngặt
        </button>
        <button
          type="button"
          className={`toggle-option-btn ${!isExam ? "active" : ""}`}
          onClick={() => onChange(false)}
          disabled={disabled}
        >
          <BookOpen size={16} /> Luyện tập tự do
        </button>
      </div>
    </div>
  );
}

export function DeckShuffleSettings({ shuffleQuestions, onChange, disabled }) {
  const isShuffle = shuffleQuestions !== false;
  return (
    <div className="setting-card shuffle-setting">
      <div className="setting-card-head">
        <div className="setting-icon-title">
          <Shuffle size={18} className="setting-icon" />
          <strong>Đảo thứ tự câu hỏi &amp; đáp án</strong>
        </div>
        <span className={`status-pill ${isShuffle ? "strict" : "relaxed"}`}>
          {isShuffle ? "Đang bật đảo ngẫu nhiên" : "Theo thứ tự danh sách"}
        </span>
      </div>
      <p className="setting-description">
        {isShuffle
          ? "Mỗi học sinh khi vào thi sẽ nhận được thứ tự câu hỏi và các phương án A, B, C, D được xáo ngẫu nhiên, giúp chống nhìn bài nhau."
          : "Câu hỏi sẽ xuất hiện tuần tự theo đúng thứ tự trong danh sách từ vựng gốc."}
      </p>
      <div className="mode-toggle-group">
        <button
          type="button"
          className={`toggle-option-btn ${isShuffle ? "active" : ""}`}
          onClick={() => onChange(true)}
          disabled={disabled}
        >
          <Shuffle size={16} /> Đảo ngẫu nhiên câu hỏi
        </button>
        <button
          type="button"
          className={`toggle-option-btn ${!isShuffle ? "active" : ""}`}
          onClick={() => onChange(false)}
          disabled={disabled}
        >
          <BookOpen size={16} /> Giữ nguyên thứ tự từ
        </button>
      </div>
    </div>
  );
}

export function DeckTimeLimitSettings({ timeLimitMinutes, onChange, disabled }) {
  const currentLimit = timeLimitMinutes || null;
  const options = [
    { value: null, title: "Không giới hạn", desc: "Làm bài tự do không áp lực thời gian" },
    { value: 5, title: "5 phút", desc: "Kiểm tra nhanh tốc độ" },
    { value: 10, title: "10 phút", desc: "Thời lượng tiêu chuẩn" },
    { value: 15, title: "15 phút", desc: "Bài kiểm tra vừa phải" },
    { value: 20, title: "20 phút", desc: "Bài thi chuyên sâu" },
  ];
  const isPreset = options.some((opt) => opt.value === currentLimit);
  const [isCustom, setIsCustom] = useState(!isPreset && currentLimit !== null);
  const [customVal, setCustomVal] = useState(!isPreset && currentLimit ? String(currentLimit) : "");

  return (
    <div className="time-limit-settings-card">
      <div className="time-limit-header">
        <div className="time-limit-title">
          <span className="time-icon-badge"><Timer size={20} /></span>
          <div>
            <strong>Thời gian làm bài</strong>
            <p>Đồng hồ đếm ngược trong lúc làm bài. Khi hết giờ bài thi tự động nộp.</p>
          </div>
        </div>
        <span className={`time-status-pill ${currentLimit ? "active" : ""}`}>
          {currentLimit ? `⏱️ ${currentLimit} phút` : "⏳ Không giới hạn"}
        </span>
      </div>

      <div className="time-options-grid">
        {options.map((opt) => {
          const isSelected = !isCustom && currentLimit === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              className={`time-opt-card ${isSelected ? "active" : ""}`}
              onClick={() => {
                setIsCustom(false);
                onChange(opt.value);
              }}
              disabled={disabled}
            >
              <div className="time-card-top">
                <span className="time-val">{opt.title}</span>
                {isSelected && <Check size={16} className="check-icon" />}
              </div>
              <small>{opt.desc}</small>
            </button>
          );
        })}
        <button
          type="button"
          className={`time-opt-card ${isCustom ? "active" : ""}`}
          onClick={() => setIsCustom(true)}
          disabled={disabled}
        >
          <div className="time-card-top">
            <span className="time-val">Tùy chỉnh…</span>
            {isCustom && <Check size={16} className="check-icon" />}
          </div>
          <small>Nhập số phút tự chọn</small>
        </button>
      </div>

      {isCustom && (
        <div className="custom-time-row">
          <label htmlFor="custom-time-input">Nhập thời gian đếm ngược (phút):</label>
          <div className="custom-time-inputs">
            <input
              id="custom-time-input"
              type="number"
              min="1"
              max="180"
              className="custom-time-field"
              value={customVal}
              onChange={(e) => setCustomVal(e.target.value)}
              placeholder="VD: 8, 25, 45..."
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const num = parseInt(customVal, 10);
                  if (num > 0) onChange(num);
                }
              }}
            />
            <button
              type="button"
              className="primary-button compact"
              onClick={() => {
                const num = parseInt(customVal, 10);
                if (num > 0) onChange(num);
              }}
              disabled={disabled || !customVal || parseInt(customVal, 10) <= 0}
            >
              <Check size={15} /> Lưu thời gian
            </button>
          </div>
        </div>
      )}
    </div>
  );
}