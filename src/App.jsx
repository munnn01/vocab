import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookOpen, BrainCircuit, Check, ChevronRight, CircleAlert, Clock, FileText,
  Download, Eye, EyeOff, FileSpreadsheet, FileUp, Flame, GraduationCap, Keyboard, KeyRound, Layers3,
  LoaderCircle, Lock, LogOut, Maximize2, Minimize2, Plus,
  RotateCcw, ShieldCheck, Sparkles, Trash2, Trophy, Unlock, UserPlus, Users, X,
  Volume2, Shuffle, Pencil, BarChart3, Medal, Timer, AlertTriangle, BookMarked, Headphones,
} from "lucide-react";
import { DEMO_WORDS, POS_LABELS, makeQuizChoices, normalizeAnswer, shuffle, speakWord } from "./lib/vocabulary";
import { makeWordFamilyChoices } from "./lib/wordFamilies";
import {
  createDeck, createStudentAccounts, deleteDeck, deleteRoster, deleteOrphanedRosters, getCurrentAccount, isSupabaseConfigured,
  loadLibrary, loadRosterWorkbook, loadRosters, loadStudentResults, loadStudents,
  resetStudentPasswords, saveStudySession, signIn, signOut, changeStudentPassword,
  updateDeckPracticeMode, updateDeckClassAccess, updateDeckLockAt, updateDeckMaxAttempts,
  updateDeckExamMode, updateDeckTimeLimit, updateDeckWords, updateDeckShuffle,
} from "./lib/supabase";
import {
  createDemoStudentAccounts, downloadRosterCredentialsXlsx, downloadRosterResultsXlsx,
  parseStudentRosterXlsx,
} from "./lib/studentAccounts";
import { BookBackground } from "./components/BookBackground";
import { LoginCat } from "./components/LoginCat";
import {
  FlashcardView,
  LeaderboardModal,
  StudentProgressModal,
  EditDeckModal,
  DeckExamModeSettings,
  DeckShuffleSettings,
  DeckTimeLimitSettings,
} from "./components/StudyFeatures";
import { FirstLoginPasswordModal } from "./components/FirstLoginPasswordModal";
import { MostMissedWordsModal } from "./components/MostMissedWordsModal";

const DEMO_DECK = {
  id: "demo",
  title: "Bộ từ học thử",
  sourceFileName: "Mẫu new(adj): mới",
  wordCount: DEMO_WORDS.length,
  practiceMode: "typing",
  unlockedClasses: null,
  lockAt: null,
  timeLimitMinutes: null,
  isExamMode: true,
  isDemo: true,
  words: DEMO_WORDS,
};

export const PRACTICE_MODES = [
  { id: "typing", title: "Điền từ", description: "Nhìn nghĩa và gõ lại từ tiếng Anh", icon: Keyboard, accent: "lime" },
  { id: "quiz", title: "Trắc nghiệm", description: "Chọn đáp án đúng từ 4 lựa chọn", icon: BrainCircuit, accent: "blue" },
  { id: "listening", title: "Luyện nghe chính tả", description: "Nghe phát âm tiếng Anh và gõ lại từ vựng", icon: Volume2, accent: "amber" },
  { id: "listening_pos", title: "Nghe & Chọn từ loại", description: "Nghe phát âm và chọn đúng biến thể từ loại (N, V, Adj, Adv)", icon: Headphones, accent: "emerald" },
];

function formatMode(mode) {
  if (mode === "flashcard") return "Flashcard";
  return PRACTICE_MODES.find((item) => item.id === mode)?.title || "Luyện tập";
}

function deckMeta(deck) {
  return `${deck.words.length} từ${deck.isDemo ? " · Học thử ngay" : " · Từ PDF"}`;
}

export function isDeckUnlockedForClass(deck, className) {
  if (!deck || !Array.isArray(deck.unlockedClasses)) return true;
  if (deck.unlockedClasses.includes("*")) return true;
  if (!className) return true;
  return deck.unlockedClasses.includes(className);
}

export function formatLockDateTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

export function getDeckLockAtForStudent(deck, account) {
  if (!deck) return null;
  const className = account?.className?.trim();
  if (deck.lockAtByClass && typeof deck.lockAtByClass === "object" && className && deck.lockAtByClass[className] !== undefined) {
    return deck.lockAtByClass[className];
  }
  return deck.lockAtByClass?.all || deck.lockAt || null;
}

export function isDeckLockedForStudent(deck, account) {
  if (!deck || account?.role !== "student") return false;
  if (!isDeckUnlockedForClass(deck, account.className)) return true;
  const lockAt = getDeckLockAtForStudent(deck, account);
  if (lockAt) {
    const lockTime = new Date(lockAt).getTime();
    if (!isNaN(lockTime) && Date.now() > lockTime) {
      return true;
    }
  }
  return false;
}

export function getDeckStudentAttempts(deckId, sessions = []) {
  if (!deckId || !Array.isArray(sessions)) return 0;
  return sessions.filter((s) => s.deck_id === deckId).length;
}

export function isDeckAttemptsExhausted(deck, account, sessions = []) {
  if (!deck || account?.role !== "student") return false;
  const max = Number(deck.maxAttempts);
  if (!max || max <= 0) return false;
  const attempts = getDeckStudentAttempts(deck.id, sessions);
  return attempts >= max;
}

export function formatViolationText(result) {
  if (!result) return "—";
  if (result.violationReason) {
    const vr = result.violationReason;
    if (vr === "fullscreen_exit") {
      return "Vi phạm lần 1: Thoát toàn màn hình (Trừ 25% điểm)";
    }
    if (vr === "visibility_hidden") {
      return "Vi phạm lần 1: Chuyển ứng dụng / tab (Trừ 25% điểm)";
    }
    if (vr === "window_blur") {
      return "Vi phạm lần 1: Mất tiêu điểm cửa sổ thi / Click ra ngoài (Trừ 25% điểm)";
    }
    if (vr === "left_early") {
      return "Rời bài thi sớm (Phạm lỗi lần 1: Trừ 25% điểm)";
    }
    if (vr === "violation_limit") {
      return "Bị hủy bài thi (0 điểm): Vi phạm quy chế quá 2 lần";
    }
    return vr;
  }
  if (!result.completed) {
    return "Rời bài thi sớm (Chưa hoàn thành)";
  }
  return "Không vi phạm quy chế";
}

export function getViolationBadgeClass(result) {
  if (!result) return "badge-empty";
  if (!result.completed && !result.violationReason) return "badge-violation-warning";
  if (result.violationReason) {
    const vr = result.violationReason;
    if (vr.includes("Hủy bài") || vr.includes("0 điểm") || vr.includes("lần 2") || vr.includes("75%")) {
      return "badge-violation-severe";
    }
    return "badge-violation-warning";
  }
  return "badge-clean";
}

export function getRosterDisplayLabel(roster, students = []) {
  if (!roster) return "";
  let classLabel = "";
  if (roster.className && roster.className.trim()) {
    classLabel = roster.className.trim();
  } else {
    const fromStudents = students
      .filter((s) => s.rosterId === roster.id && s.className)
      .map((s) => s.className.trim());
    if (fromStudents.length) {
      classLabel = [...new Set(fromStudents)].join(", ");
    } else if (roster.sheetName) {
      const m = roster.sheetName.match(/1[0-2][A-Z]\d*/i) || roster.sheetName.match(/l[oớ]p\s*([^\s]+)/i);
      if (m) classLabel = (m[1] || m[0]).trim();
    } else if (roster.originalFileName) {
      const m = roster.originalFileName.match(/1[0-2][A-Z]\d*/i) || roster.originalFileName.match(/l[oớ]p[_-]?([^\._-]+)/i);
      if (m) classLabel = (m[1] || m[0]).trim();
    }
  }

  if (classLabel) {
    return `${roster.originalFileName} - ${classLabel}`;
  }
  return roster.originalFileName;
}

export function App() {
  const fileInputRef = useRef(null);
  const typingInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const answerTimerRef = useRef(null);
  const fullscreenSeenRef = useRef(false);
  const suppressFullscreenPenaltyRef = useRef(false);
  const [view, setView] = useState(!isSupabaseConfigured ? "create-deck" : "deck");
  const [account, setAccount] = useState(isSupabaseConfigured ? null : {
    id: "demo-instructor",
    role: "instructor",
    displayName: "Giáo viên demo",
    demo: true,
  });
  const [authStatus, setAuthStatus] = useState(isSupabaseConfigured ? "loading" : "ready");
  const [decks, setDecks] = useState([DEMO_DECK]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [studentResults, setStudentResults] = useState([]);
  const [generatedAccounts, setGeneratedAccounts] = useState([]);
  const [generatedRoster, setGeneratedRoster] = useState(null);
  const [isGeneratingAccounts, setIsGeneratingAccounts] = useState(false);
  const [isRefreshingResults, setIsRefreshingResults] = useState(false);
  const [isExportingResults, setIsExportingResults] = useState(false);
  const [isResettingPasswords, setIsResettingPasswords] = useState(false);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
  const [isUpdatingLockAt, setIsUpdatingLockAt] = useState(false);
  const [isUpdatingMaxAttempts, setIsUpdatingMaxAttempts] = useState(false);
  const [isUpdatingTimeLimit, setIsUpdatingTimeLimit] = useState(false);
  const [isUpdatingExamMode, setIsUpdatingExamMode] = useState(false);
  const [isUpdatingShuffle, setIsUpdatingShuffle] = useState(false);
  const [deckToEdit, setDeckToEdit] = useState(null);
  const [isSavingDeckEdit, setIsSavingDeckEdit] = useState(false);
  const [isSavingFirstPassword, setIsSavingFirstPassword] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [progressStudent, setProgressStudent] = useState(null);
  const [selectedDeckId, setSelectedDeckId] = useState("demo");
  const [connection, setConnection] = useState(isSupabaseConfigured ? "connecting" : "demo");
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [importDraft, setImportDraft] = useState(null);
  const [study, setStudy] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState(null);
  const [isDeletingDeck, setIsDeletingDeck] = useState(false);
  const [isDeletingRoster, setIsDeletingRoster] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [toast, setToast] = useState("");

  const availableClasses = useMemo(() => {
    const set = new Set();
    for (const student of students) {
      if (student.className) {
        const trimmed = student.className.trim();
        if (trimmed) set.add(trimmed);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));
  }, [students]);

  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) || decks[0];
  const currentWord = study?.items[study.index] || null;
  const lastSession = sessions[0];
  const uploadedDecks = decks.filter((deck) => !deck.isDemo);
  const totalWords = uploadedDecks.reduce((sum, deck) => sum + deck.words.length, 0);

  const quizChoices = useMemo(() => {
    if (!study || !currentWord || study.mode !== "quiz") return [];
    return makeQuizChoices(currentWord, study.items);
  }, [currentWord, study?.mode, study?.items]);

  const wordFamilyChoices = useMemo(() => {
    if (!study || !currentWord || study.mode !== "listening_pos") return [];
    return makeWordFamilyChoices(currentWord, study.items);
  }, [currentWord, study?.mode, study?.items]);

  useEffect(() => {
    if (view === "study" && (study?.mode === "listening" || study?.mode === "listening_pos") && currentWord?.term) {
      const timer = window.setTimeout(() => {
        speakWord(currentWord.term);
      }, 350);
      return () => window.clearTimeout(timer);
    }
  }, [view, study?.mode, study?.index, currentWord?.term]);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 3400);
  }, []);

  const finishStudy = useCallback((finalStudy, completed = true, violationReason = null) => {
    suppressFullscreenPenaltyRef.current = true;
    fullscreenSeenRef.current = false;
    if (typeof document !== "undefined" && document.fullscreenElement) {
      void document.exitFullscreen().finally(() => { suppressFullscreenPenaltyRef.current = false; });
    } else {
      suppressFullscreenPenaltyRef.current = false;
    }
    const resolvedViolationReason = violationReason !== null ? violationReason : (finalStudy?.violationReason || null);
    const mistakeWords = finalStudy?.mistakeWords || [];
    const result = {
      deckId: finalStudy.deckId,
      deckTitle: finalStudy.deckTitle,
      mode: finalStudy.mode,
      score: finalStudy.score,
      correct: finalStudy.correct,
      total: finalStudy.items.length,
      completed,
      violationReason: resolvedViolationReason,
      mistakeWords,
    };
    setLastResult(result);
    if (completed) setView("results");
    setStudy(null);

    if (account?.id && finalStudy.deckId && typeof localStorage !== "undefined") {
      try {
        if (finalStudy.isMistakePractice) {
          localStorage.setItem(`vocab_mistakes_${account.id}_${finalStudy.deckId}`, JSON.stringify(mistakeWords));
        } else if (mistakeWords.length > 0) {
          localStorage.setItem(`vocab_mistakes_${account.id}_${finalStudy.deckId}`, JSON.stringify(mistakeWords));
        }
      } catch { /* ignore */ }
    }

    if (account?.demo) {
      setStudentResults((prev) => [
        {
          id: crypto.randomUUID(),
          studentId: account.id,
          deckId: finalStudy.deckId,
          deckTitle: finalStudy.deckTitle,
          mode: finalStudy.mode,
          score: finalStudy.score,
          correct: finalStudy.correct,
          total: finalStudy.items.length,
          completed,
          violationReason: resolvedViolationReason,
          mistakeWords,
          completedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    saveStudySession({
      deckId: finalStudy.deckId,
      mode: finalStudy.mode,
      score: finalStudy.score,
      correct: finalStudy.correct,
      total: finalStudy.items.length,
      completed,
      violationReason: resolvedViolationReason,
      mistakeWords,
    }).then(() => {
      setSessions((current) => [{
        id: crypto.randomUUID(),
        deck_id: finalStudy.deckId,
        score: finalStudy.score,
        correct_count: finalStudy.correct,
        total_count: finalStudy.items.length,
        completed,
        violation_reason: resolvedViolationReason,
        mistake_words: mistakeWords,
        created_at: new Date().toISOString(),
      }, ...current]);
    }).catch((error) => {
      console.error("Không thể lưu phiên học", error);
      showToast("Lỗi khi lưu kết quả lên máy chủ: " + (error.message || error));
    });
  }, [account?.id, account?.demo, showToast]);

  const getSavedMistakes = useCallback((deckId) => {
    if (!account?.id || !deckId || typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(`vocab_mistakes_${account.id}_${deckId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  }, [account?.id]);

  const handleDeckTimeLimit = useCallback(async (deckId, minutes) => {
    setIsUpdatingTimeLimit(true);
    try {
      await updateDeckTimeLimit(deckId, minutes);
      setDecks((current) => current.map((d) => (d.id === deckId ? { ...d, timeLimitMinutes: minutes } : d)));
      showToast(minutes ? `Đã đặt thời gian làm bài: ${minutes} phút` : "Đã chuyển sang không giới hạn thời gian");
    } catch (err) {
      showToast(err.message || "Không thể cập nhật thời gian làm bài");
    } finally {
      setIsUpdatingTimeLimit(false);
    }
  }, [showToast]);

  const handleDeckExamMode = useCallback(async (deckId, isExamMode) => {
    setIsUpdatingExamMode(true);
    try {
      await updateDeckExamMode(deckId, isExamMode);
      setDecks((current) => current.map((d) => (d.id === deckId ? { ...d, isExamMode } : d)));
      showToast(isExamMode ? "Đã bật chế độ kiểm tra nghiêm ngặt (Toàn màn hình & Chống gian lận)" : "Đã chuyển sang chế độ luyện tập tự do");
    } catch (err) {
      showToast(err.message || "Không thể cập nhật chế độ kiểm tra");
    } finally {
      setIsUpdatingExamMode(false);
    }
  }, [showToast]);

  const handleDeckShuffle = useCallback(async (deckId, shuffleQuestions) => {
    setIsUpdatingShuffle(true);
    try {
      await updateDeckShuffle(deckId, shuffleQuestions);
      setDecks((current) => current.map((d) => (d.id === deckId ? { ...d, shuffleQuestions } : d)));
      showToast(shuffleQuestions ? "Đã bật xáo trộn ngẫu nhiên thứ tự câu hỏi" : "Đã tắt xáo trộn (làm bài theo thứ tự gốc)");
    } catch (err) {
      showToast(err.message || "Không thể cập nhật cấu hình xáo trộn câu hỏi");
    } finally {
      setIsUpdatingShuffle(false);
    }
  }, [showToast]);

  const handleSaveDeckWords = useCallback(async (deckId, newTitle, newWords) => {
    setIsSavingDeckEdit(true);
    try {
      await updateDeckWords(deckId, newTitle, newWords);
      setDecks((current) => current.map((d) => (d.id === deckId ? { ...d, title: newTitle, wordCount: newWords.length, words: newWords } : d)));
      setDeckToEdit(null);
      showToast(`Đã lưu cập nhật cho bộ từ "${newTitle}" (${newWords.length} từ)`);
    } catch (err) {
      showToast(err.message || "Không thể lưu cập nhật bộ từ");
    } finally {
      setIsSavingDeckEdit(false);
    }
  }, [showToast]);

  const handleSaveFirstPassword = useCallback(async (newPassword) => {
    setIsSavingFirstPassword(true);
    try {
      await changeStudentPassword(newPassword);
      setAccount((current) => (current ? { ...current, currentPassword: newPassword, hasChangedPassword: true } : current));
      setStudents((current) =>
        current.map((s) => (s.id === account?.id ? { ...s, currentPassword: newPassword, hasChangedPassword: true } : s))
      );
      showToast("Đã đổi mật khẩu thành công! Bạn có thể bắt đầu học.");
    } catch (err) {
      console.error("Lỗi đổi mật khẩu lần đầu:", err);
      showToast(err.message || "Không thể lưu mật khẩu mới. Vui lòng thử lại.");
    } finally {
      setIsSavingFirstPassword(false);
    }
  }, [account?.id, showToast]);

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
    window.clearTimeout(answerTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    getCurrentAccount()
      .then((currentAccount) => {
        if (active) {
          setAccount(currentAccount);
          if (currentAccount?.role === "instructor") {
            setView("create-deck");
          } else {
            setView("deck");
          }
        }
      })
      .catch((error) => {
        console.error("Không thể kiểm tra phiên đăng nhập", error);
        if (active) setAccount(null);
      })
      .finally(() => { if (active) setAuthStatus("ready"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!account || account.demo) return undefined;
    let active = true;
    setConnection("connecting");
    Promise.all([
      loadLibrary(),
      account.role === "instructor" ? loadStudents() : Promise.resolve([]),
      account.role === "instructor" ? loadStudentResults() : Promise.resolve([]),
      account.role === "instructor" ? loadRosters() : Promise.resolve([]),
    ]).then(async ([library, studentList, resultList, rosterList]) => {
      if (!active) return;
      if (account.role === "instructor") {
        const studentRosterIds = new Set(studentList.map((s) => s.rosterId).filter(Boolean));
        const hasOrphaned = rosterList.some((r) => !studentRosterIds.has(r.id));
        if (hasOrphaned) {
          void deleteOrphanedRosters();
          rosterList = rosterList.filter((r) => studentRosterIds.has(r.id));
        }
      }
      setDecks([DEMO_DECK, ...library.decks]);
      setSessions(library.sessions);
      setStudents(studentList);
      setStudentResults(resultList);
      setRosters(rosterList);
      if (library.decks[0]) setSelectedDeckId(library.decks[0].id);
      setConnection("connected");
    }).catch((error) => {
      console.error("Không thể kết nối Supabase", error);
      if (active) setConnection("error");
    });
    return () => { active = false; };
  }, [account?.id, account?.role]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (view !== "study" || !study) return undefined;
    window.history.pushState({ vocabStudyGuard: true }, "", window.location.href);
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handlePopState = () => {
      if (account?.role === "student") {
        if (suppressFullscreenPenaltyRef.current) return;
        window.clearTimeout(answerTimerRef.current);
        const nextVio = (study.violationCount || 0) + 1;
        const newScore = nextVio === 1 ? Math.max(0, Math.round(study.score * 0.75)) : Math.max(0, Math.round(study.score * 0.25));
        const leaveDetail = `Rời bài thi sớm (Touchpad/Back - Phạm lỗi lần ${nextVio}: Trừ ${nextVio === 1 ? "25%" : "75%"} điểm)`;
        finishStudy({ ...study, score: newScore, violationCount: nextVio, violationReason: leaveDetail }, false, leaveDetail);
        setLeaveDialog(false);
        setView("deck");
        showToast(`Phát hiện thao tác quay lại: trừ ${nextVio === 1 ? "25%" : "75%"} điểm và kết thúc bài.`);
      } else {
        setLeaveDialog(true);
        window.history.pushState({ vocabStudyGuard: true }, "", window.location.href);
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [account?.role, finishStudy, showToast, study, view]);

  useEffect(() => {
    if (view === "study" && study?.mode === "typing" && !study.feedback) typingInputRef.current?.focus();
  }, [view, study?.mode, study?.index, study?.feedback]);

  const startStudy = useCallback((overrideWords = null, isMistakePractice = false) => {
    if (account?.role !== "student") {
      showToast("Giáo viên chỉ thiết lập bài; tài khoản học sinh mới có thể làm bài.");
      return;
    }
    const wordsToStudy = overrideWords || selectedDeck?.words || [];
    if (!wordsToStudy.length) {
      showToast("Bộ từ này chưa có từ để học.");
      return;
    }
    if (!isMistakePractice) {
      if (isDeckLockedForStudent(selectedDeck, account)) {
        const studentLockAt = getDeckLockAtForStudent(selectedDeck, account);
        if (studentLockAt && Date.now() > new Date(studentLockAt).getTime()) {
          showToast("Bộ từ này đã hết hạn làm bài đối với lớp của bạn.");
        } else {
          showToast(`Bộ từ này đang khóa đối với lớp ${account.className || "của bạn"}.`);
        }
        return;
      }
      if (isDeckAttemptsExhausted(selectedDeck, account, sessions)) {
        showToast(`Bạn đã sử dụng hết số lần làm bài cho phép của bài kiểm tra này (${selectedDeck.maxAttempts} lần).`);
        return;
      }
    }

    const isExam = !isMistakePractice && (selectedDeck?.isExamMode !== false);
    const timeLimitSeconds = !isMistakePractice && selectedDeck?.timeLimitMinutes ? selectedDeck.timeLimitMinutes * 60 : null;

    const mode = PRACTICE_MODES.some((item) => item.id === selectedDeck.practiceMode)
      ? selectedDeck.practiceMode
      : "typing";
    suppressFullscreenPenaltyRef.current = false;
    fullscreenSeenRef.current = Boolean(document.fullscreenElement);
    if (isExam && !document.fullscreenElement) {
      try {
        void document.documentElement.requestFullscreen().catch(() => {
          showToast("Hãy bấm ‘Vào toàn màn hình’ trước khi tiếp tục làm bài.");
        });
      } catch {
        showToast("Hãy bấm ‘Vào toàn màn hình’ trước khi tiếp tục làm bài.");
      }
    }
    setStudy({
      deckId: selectedDeck.id,
      deckTitle: isMistakePractice ? `${selectedDeck.title} (Ôn từ sai)` : selectedDeck.title,
      items: selectedDeck?.shuffleQuestions !== false ? shuffle(wordsToStudy) : [...wordsToStudy],
      index: 0,
      mode,
      score: 0,
      correct: 0,
      answered: 0,
      feedback: null,
      feedbackMessage: "",
      input: "",
      wordMistakes: 0,
      violationCount: 0,
      disabledChoices: [],
      isExamMode: isExam,
      timeLimitSeconds,
      isMistakePractice,
      mistakeWords: [],
    });
    setView("study");
    setLastResult(null);
  }, [account, selectedDeck, sessions, showToast]);

  const handlePracticeMistakes = useCallback((wordsToPractice = null) => {
    const list = wordsToPractice || getSavedMistakes(selectedDeck?.id);
    if (!list || !list.length) {
      showToast("Không có từ sai nào để ôn lại.");
      return;
    }
    startStudy(list, true);
  }, [getSavedMistakes, selectedDeck?.id, showToast, startStudy]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool || account?.role !== "student") return undefined;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "start_vocabulary_practice",
        title: "Bắt đầu luyện từ vựng",
        description: "Bắt đầu bài từ vựng theo thể loại mà giáo viên đã giao.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() {
          startStudy();
          return { deck: selectedDeck.title, mode: selectedDeck.practiceMode || "typing", status: "started" };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch {
      return undefined;
    }
    return () => lifecycle.abort();
  }, [account?.role, selectedDeck, startStudy]);

  useEffect(() => {
    if (view !== "study" || !study || account?.role !== "student" || study.isExamMode === false) return undefined;
    if (document.fullscreenElement) fullscreenSeenRef.current = true;

    const penalizeViolation = (type) => {
      if (suppressFullscreenPenaltyRef.current) return;
      fullscreenSeenRef.current = false;
      const nextViolation = (study.violationCount || 0) + 1;
      const typeLabel =
        type === "fullscreen_exit"
          ? "Thoát toàn màn hình"
          : type === "window_blur"
          ? "Mất tiêu điểm / Bấm ra ngoài cửa sổ thi"
          : "Chuyển ứng dụng / tab";
      if (nextViolation === 1) {
        const penalty = Math.max(2, Math.round(study.score * 0.25));
        const newScore = Math.max(0, study.score - penalty);
        const reason = `Vi phạm lần 1: ${typeLabel} (Trừ 25% điểm)`;
        showToast(`⚠️ ${reason}! Hãy bấm vào lại toàn màn hình.`);
        setStudy((prev) => prev ? { ...prev, score: newScore, violationCount: 1, violationReason: reason } : null);
      } else if (nextViolation === 2) {
        const penalty = Math.max(5, Math.round(study.score * 0.75));
        const newScore = Math.max(0, study.score - penalty);
        const reason = `Vi phạm lần 2: ${typeLabel} (Trừ 75% điểm)`;
        showToast(`⚠️ ${reason}! Nếu vi phạm lần 3 bài thi sẽ bị hủy lập tức (0 điểm).`);
        setStudy((prev) => prev ? { ...prev, score: newScore, violationCount: 2, violationReason: reason } : null);
      } else {
        window.clearTimeout(answerTimerRef.current);
        const reason = `Bị hủy bài thi (0 điểm): Vi phạm quy chế quá 2 lần (${typeLabel})`;
        showToast(`⛔ ${reason}`);
        finishStudy({ ...study, score: 0, violationReason: reason }, false, reason);
        setLeaveDialog(false);
        setView("deck");
      }
    };

    const penalizeFullscreenExit = () => {
      if (document.fullscreenElement) {
        fullscreenSeenRef.current = true;
        return;
      }
      penalizeViolation("fullscreen_exit");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        penalizeViolation("visibility_hidden");
      }
    };

    let blurTimer = null;
    const handleWindowBlur = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (suppressFullscreenPenaltyRef.current) return;
        if (typeof document !== "undefined" && !document.hasFocus()) {
          penalizeViolation("window_blur");
        }
      }, 250);
    };

    document.addEventListener("fullscreenchange", penalizeFullscreenExit);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.clearTimeout(blurTimer);
      document.removeEventListener("fullscreenchange", penalizeFullscreenExit);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [account?.role, finishStudy, showToast, study, view]);

  useEffect(() => {
    if (view !== "study" || !study || study.isExamMode === false) return undefined;

    const handleExamKeyDown = (event) => {
      const isF12 = event.key === "F12" || event.keyCode === 123;
      const isDevToolsCombo =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        ["I", "J", "C", "i", "j", "c"].includes(event.key);
      const isViewSource =
        (event.ctrlKey || event.metaKey) && ["u", "U"].includes(event.key);

      if (isF12 || isDevToolsCombo || isViewSource) {
        event.preventDefault();
        event.stopPropagation();
        showToast("⛔ Phím tắt kiểm tra mã nguồn (DevTools) bị vô hiệu hóa trong giờ thi!");
        return false;
      }
    };

    const handleContextMenu = (event) => {
      event.preventDefault();
      showToast("⛔ Thao tác chuột phải bị khóa trong giờ thi!");
      return false;
    };

    const handleCopyCut = (event) => {
      event.preventDefault();
      showToast("⛔ Không được phép sao chép nội dung bài thi!");
      return false;
    };

    window.addEventListener("keydown", handleExamKeyDown, true);
    window.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("copy", handleCopyCut, true);
    document.addEventListener("cut", handleCopyCut, true);

    return () => {
      window.removeEventListener("keydown", handleExamKeyDown, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("copy", handleCopyCut, true);
      document.removeEventListener("cut", handleCopyCut, true);
    };
  }, [showToast, study, view]);

  const answerCurrent = useCallback((isCorrect, chosenChoice = null) => {
    if (!study || (study.feedback && study.feedback === "correct")) return;
    if (account?.role === "student" && study.isExamMode !== false && !document.fullscreenElement) {
      showToast("Vui lòng bấm 'Bật toàn màn hình' ở ô thông báo phía trên để tiếp tục làm bài.");
      return;
    }

    const currentMistakes = study.wordMistakes || 0;

    if (isCorrect) {
      let pointsEarned = 10;
      let msg = "Chính xác! +10 điểm";
      if (currentMistakes === 1) {
        pointsEarned = 7.5;
        msg = "Chính xác! +7.5 điểm (Trừ 25% do sai lần 1)";
      } else if (currentMistakes >= 2) {
        pointsEarned = 2.5;
        msg = "Chính xác! +2.5 điểm (Trừ 75% do sai lần 2)";
      }

      const nextStudy = {
        ...study,
        feedback: "correct",
        feedbackMessage: msg,
        score: Math.round((study.score + pointsEarned) * 10) / 10,
        correct: study.correct + 1,
        answered: study.answered + 1,
      };
      setStudy(nextStudy);
      window.clearTimeout(answerTimerRef.current);
      answerTimerRef.current = window.setTimeout(() => {
        if (nextStudy.index >= nextStudy.items.length - 1) {
          finishStudy(nextStudy, true);
          return;
        }
        setStudy({
          ...nextStudy,
          index: nextStudy.index + 1,
          feedback: null,
          feedbackMessage: "",
          input: "",
          wordMistakes: 0,
          disabledChoices: [],
        });
      }, 750);
    } else {
      const nextMistakes = currentMistakes + 1;
      const nextDisabledChoices = chosenChoice
        ? [...(study.disabledChoices || []), chosenChoice]
        : (study.disabledChoices || []);

      const currentItem = study.items[study.index];
      const mistakesList = [...(study.mistakeWords || [])];
      if (currentItem && !mistakesList.some((w) => w.id === currentItem.id)) {
        mistakesList.push(currentItem);
      }

      if (nextMistakes === 1) {
        const nextStudy = {
          ...study,
          feedback: "wrong-1",
          feedbackMessage: "Chưa đúng (Phạm lỗi lần 1: Trừ 25% điểm). Hãy thử lại!",
          wordMistakes: 1,
          disabledChoices: nextDisabledChoices,
          input: "",
          mistakeWords: mistakesList,
        };
        setStudy(nextStudy);
        window.clearTimeout(answerTimerRef.current);
        answerTimerRef.current = window.setTimeout(() => {
          setStudy((curr) => curr ? { ...curr, feedback: null, feedbackMessage: "" } : null);
          typingInputRef.current?.focus();
        }, 1100);
      } else if (nextMistakes === 2) {
        const nextStudy = {
          ...study,
          feedback: "wrong-2",
          feedbackMessage: "Chưa đúng (Phạm lỗi lần 2: Trừ 75% điểm). Hãy thử lần cuối!",
          wordMistakes: 2,
          disabledChoices: nextDisabledChoices,
          input: "",
          mistakeWords: mistakesList,
        };
        setStudy(nextStudy);
        window.clearTimeout(answerTimerRef.current);
        answerTimerRef.current = window.setTimeout(() => {
          setStudy((curr) => curr ? { ...curr, feedback: null, feedbackMessage: "" } : null);
          typingInputRef.current?.focus();
        }, 1100);
      } else {
        const nextStudy = {
          ...study,
          feedback: "wrong-final",
          feedbackMessage: `Chưa chính xác (0 điểm). Đáp án: ${currentItem?.term || ""}`,
          wordMistakes: 3,
          answered: study.answered + 1,
          disabledChoices: nextDisabledChoices,
          mistakeWords: mistakesList,
        };
        setStudy(nextStudy);
        window.clearTimeout(answerTimerRef.current);
        answerTimerRef.current = window.setTimeout(() => {
          if (nextStudy.index >= nextStudy.items.length - 1) {
            finishStudy(nextStudy, true);
            return;
          }
          setStudy({
            ...nextStudy,
            index: nextStudy.index + 1,
            feedback: null,
            feedbackMessage: "",
            input: "",
            wordMistakes: 0,
            disabledChoices: [],
          });
        }, 1800);
      }
    }
  }, [account?.role, finishStudy, showToast, study]);

  useEffect(() => {
    if (view !== "study" || !study) return undefined;
    const handleKey = (event) => {
      const isTyping = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
      if (study.mode === "quiz" && !isTyping && /^[1-4]$/.test(event.key)) {
        const choice = quizChoices[Number(event.key) - 1];
        if (choice && !study.disabledChoices?.includes(choice)) {
          answerCurrent(choice === currentWord.term, choice);
        }
      } else if (study.mode === "listening_pos" && !isTyping && /^[1-4]$/.test(event.key)) {
        const choice = wordFamilyChoices[Number(event.key) - 1];
        if (choice && !study.disabledChoices?.includes(choice.term)) {
          answerCurrent(choice.isCorrect, choice.term);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [answerCurrent, currentWord?.term, quizChoices, wordFamilyChoices, study, view]);

  async function handlePdf(file) {
    if (!file) return;
    setIsImporting(true);
    setImportProgress(0);
    try {
      const { extractVocabularyFromPdf } = await import("./lib/pdf");
      const parsed = await extractVocabularyFromPdf(file, setImportProgress);
      if (!parsed.entries.length) throw new Error("Không tìm thấy dòng nào theo mẫu new(adj): mới.");
      setImportDraft({
        title: file.name.replace(/\.pdf$/i, ""),
        fileName: file.name,
        words: parsed.entries,
        rejected: parsed.rejected,
        pageCount: parsed.pageCount,
        practiceMode: "typing",
        unlockedClasses: null,
        maxAttempts: null,
      });
      setView("import");
    } catch (error) {
      showToast(error.message || "Không thể đọc file PDF này.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveImport() {
    if (!importDraft?.words.length || !importDraft.title.trim()) return;
    setIsSaving(true);
    try {
      let savedDeck;
      if (isSupabaseConfigured && connection === "connected") {
        savedDeck = await createDeck({
          title: importDraft.title.trim(),
          sourceFileName: importDraft.fileName,
          practiceMode: importDraft.practiceMode,
          words: importDraft.words,
          unlockedClasses: importDraft.unlockedClasses,
          maxAttempts: importDraft.maxAttempts,
        });
      } else {
        savedDeck = {
          id: `local-${crypto.randomUUID()}`,
          title: importDraft.title.trim(),
          sourceFileName: importDraft.fileName,
          wordCount: importDraft.words.length,
          words: importDraft.words,
          practiceMode: importDraft.practiceMode,
          unlockedClasses: importDraft.unlockedClasses,
          maxAttempts: importDraft.maxAttempts,
          isTemporary: true,
        };
      }
      setDecks((current) => [current[0], savedDeck, ...current.slice(1)]);
      setSelectedDeckId(savedDeck.id);
      setImportDraft(null);
      setView("deck");
      showToast(savedDeck.isTemporary
        ? "Đã nhập để học thử. Kết nối Supabase để lưu lâu dài."
        : `Đã lưu ${savedDeck.words.length} từ vào Supabase.`);
    } catch (error) {
      console.error("Không thể lưu bộ từ", error);
      showToast("Chưa lưu được bộ từ. Hãy kiểm tra cấu hình Supabase.");
    } finally {
      setIsSaving(false);
    }
  }

  function removeDraftWord(id) {
    setImportDraft((draft) => ({ ...draft, words: draft.words.filter((word) => word.id !== id) }));
  }

  function submitTyping(event) {
    event.preventDefault();
    if (!study?.input.trim()) return;
    answerCurrent(normalizeAnswer(study.input) === normalizeAnswer(currentWord.term));
  }

  function confirmLeaveStudy() {
    if (!study) return;
    window.clearTimeout(answerTimerRef.current);
    const nextVio = (study.violationCount || 0) + 1;
    let newScore = study.score;
    if (nextVio === 1) {
      newScore = Math.max(0, Math.round(study.score * 0.75));
    } else {
      newScore = Math.max(0, Math.round(study.score * 0.25));
    }
    const leaveDetail = `Rời bài thi sớm (Phạm lỗi lần ${nextVio}: Trừ ${nextVio === 1 ? "25%" : "75%"} điểm)`;
    const penalized = { ...study, score: newScore, violationCount: nextVio, violationReason: leaveDetail };
    finishStudy(penalized, false, leaveDetail);
    setLeaveDialog(false);
    setView(canManage ? "create-deck" : "deck");
    showToast(`Đã rời phiên sớm (phạm lỗi lần ${nextVio}): trừ ${nextVio === 1 ? "25%" : "75%"} số điểm.`);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      showToast("Trình duyệt này chưa cho phép chế độ toàn màn hình.");
    }
  }

  async function handleDeckPracticeMode(mode) {
    if (!PRACTICE_MODES.some((item) => item.id === mode) || !selectedDeck) return;
    const previousMode = selectedDeck.practiceMode || "typing";
    setDecks((current) => current.map((deck) => deck.id === selectedDeck.id ? { ...deck, practiceMode: mode } : deck));
    if (selectedDeck.isDemo || selectedDeck.isTemporary) {
      showToast(`Đã chọn ${formatMode(mode)} cho bộ từ này.`);
      return;
    }
    setIsUpdatingMode(true);
    try {
      await updateDeckPracticeMode(selectedDeck.id, mode);
      showToast(`Học sinh sẽ làm bài theo dạng ${formatMode(mode)}.`);
    } catch (error) {
      console.error("Không thể cập nhật thể loại làm bài", error);
      setDecks((current) => current.map((deck) => deck.id === selectedDeck.id ? { ...deck, practiceMode: previousMode } : deck));
      showToast("Chưa cập nhật được thể loại làm bài.");
    } finally {
      setIsUpdatingMode(false);
    }
  }

  async function handleDeckClassAccess(unlockedClasses) {
    if (!selectedDeck || selectedDeck.isDemo) return;
    const previous = selectedDeck.unlockedClasses;
    setDecks((current) =>
      current.map((deck) =>
        deck.id === selectedDeck.id ? { ...deck, unlockedClasses } : deck
      )
    );
    if (selectedDeck.isTemporary) {
      showToast("Đã cập nhật quyền truy cập lớp.");
      return;
    }
    setIsUpdatingAccess(true);
    try {
      await updateDeckClassAccess(selectedDeck.id, unlockedClasses);
      showToast("Đã lưu quyền truy cập lớp thành công.");
    } catch (error) {
      console.error("Không thể cập nhật quyền truy cập lớp", error);
      setDecks((current) =>
        current.map((deck) =>
          deck.id === selectedDeck.id ? { ...deck, unlockedClasses: previous } : deck
        )
      );
      showToast(error.message || "Chưa cập nhật được quyền truy cập lớp.");
    } finally {
      setIsUpdatingAccess(false);
    }
  }

  async function handleDeckLockAt(newLockAtOrMap) {
    if (!selectedDeck) return;
    const previousLockAt = selectedDeck.lockAt;
    const previousLockAtByClass = selectedDeck.lockAtByClass;

    let newLockAt = null;
    let newLockAtByClass = null;

    if (typeof newLockAtOrMap === "string" || newLockAtOrMap === null) {
      newLockAt = newLockAtOrMap;
      newLockAtByClass = newLockAtOrMap ? { all: newLockAtOrMap } : null;
    } else if (typeof newLockAtOrMap === "object") {
      newLockAtByClass = newLockAtOrMap;
      newLockAt = newLockAtByClass?.all || Object.values(newLockAtByClass || {})[0] || null;
    }

    setDecks((current) =>
      current.map((deck) =>
        deck.id === selectedDeck.id ? { ...deck, lockAt: newLockAt, lockAtByClass: newLockAtByClass } : deck
      )
    );
    if (selectedDeck.isDemo || selectedDeck.isTemporary) {
      showToast("Đã lưu cài đặt thời hạn khóa bài.");
      return;
    }
    setIsUpdatingLockAt(true);
    try {
      await updateDeckLockAt(selectedDeck.id, newLockAtByClass || newLockAt);
      showToast("Đã lưu cài đặt thời hạn khóa bài thành công.");
    } catch (error) {
      console.error("Không thể cập nhật thời hạn khóa bài", error);
      setDecks((current) =>
        current.map((deck) =>
          deck.id === selectedDeck.id ? { ...deck, lockAt: previousLockAt, lockAtByClass: previousLockAtByClass } : deck
        )
      );
      showToast("Chưa cập nhật được thời hạn khóa bài.");
    } finally {
      setIsUpdatingLockAt(false);
    }
  }

  async function handleDeckMaxAttempts(maxAttempts) {
    if (!selectedDeck) return;
    const previousMax = selectedDeck.maxAttempts ?? null;
    const newMax = maxAttempts && Number(maxAttempts) > 0 ? Number(maxAttempts) : null;

    setDecks((current) =>
      current.map((deck) =>
        deck.id === selectedDeck.id ? { ...deck, maxAttempts: newMax } : deck
      )
    );
    if (selectedDeck.isDemo || selectedDeck.isTemporary) {
      showToast(newMax ? `Đã lưu giới hạn: ${newMax} lần làm bài.` : "Đã lưu: Không giới hạn số lần làm bài.");
      return;
    }
    setIsUpdatingMaxAttempts(true);
    try {
      await updateDeckMaxAttempts(selectedDeck.id, newMax);
      showToast(newMax ? `Đã lưu giới hạn: ${newMax} lần làm bài.` : "Đã lưu: Không giới hạn số lần làm bài.");
    } catch (error) {
      console.error("Không thể cập nhật số lần làm bài", error);
      setDecks((current) =>
        current.map((deck) =>
          deck.id === selectedDeck.id ? { ...deck, maxAttempts: previousMax } : deck
        )
      );
      showToast("Chưa cập nhật được số lần làm bài.");
    } finally {
      setIsUpdatingMaxAttempts(false);
    }
  }

  async function confirmDeleteDeck() {
    if (!deckToDelete || deckToDelete.isDemo) return;
    const target = deckToDelete;
    const previousDecks = decks;
    const remainingDecks = decks.filter((d) => d.id !== target.id);

    // Cập nhật giao diện ngay lập tức (Optimistic UI) giúp thao tác xóa phản hồi tức thì
    setDecks(remainingDecks);
    if (selectedDeckId === target.id) {
      setSelectedDeckId(remainingDecks[0]?.id || "demo");
    }
    if (view === "study" && study?.deckId === target.id) {
      setStudy(null);
      setView(canManage ? "create-deck" : "deck");
    }
    setDeckToDelete(null);
    showToast(`Đã xóa bộ từ "${target.title}".`);

    try {
      if (isSupabaseConfigured && !target.isTemporary && connection === "connected") {
        await deleteDeck(target.id);
      }
    } catch (error) {
      console.error("Không thể xóa bộ từ", error);
      setDecks(previousDecks);
      showToast(error.message || `Chưa xóa được bộ từ "${target.title}". Đã khôi phục.`);
    }
  }

  async function handleLogin(credentials) {
    const loggedInAccount = await signIn(credentials);
    setAccount(loggedInAccount);
    setView(loggedInAccount?.role === "instructor" ? "create-deck" : "deck");
    setGeneratedAccounts([]);
    setGeneratedRoster(null);
  }

  async function handleSignOut() {
    if (view === "study") {
      setLeaveDialog(true);
      return;
    }
    await signOut();
    setAccount(null);
    setDecks([DEMO_DECK]);
    setSessions([]);
    setStudents([]);
    setRosters([]);
    setStudentResults([]);
    setGeneratedAccounts([]);
    setGeneratedRoster(null);
    setSelectedDeckId("demo");
    setView("deck");
  }

  async function handleGenerateStudents(values) {
    setIsGeneratingAccounts(true);
    try {
      const result = account.demo
        ? {
            accounts: createDemoStudentAccounts(values),
            roster: {
              id: "demo-roster",
              className: [...new Set(values.students.map((student) => student.className))].join(", "),
              originalFileName: values.workbook.originalFileName,
              sheetName: values.workbook.sheetName,
              studentCount: values.students.length,
              createdAt: new Date().toISOString(),
            },
          }
        : await createStudentAccounts(values);
      const { accounts, roster } = result;
      setGeneratedAccounts(accounts);
      setGeneratedRoster({ ...values.workbook, id: roster.id });
      setRosters((current) => [roster, ...current.filter((item) => item.id !== roster.id)]);
      setStudents((current) => {
        const next = accounts.map((student) => ({
          ...student,
          initialPassword: student.password || student.initialPassword,
          currentPassword: null,
          hasChangedPassword: false,
        }));
        const ids = new Set(next.map((student) => student.id));
        return [...next, ...current.filter((student) => !ids.has(student.id))];
      });
      showToast(`Đã tạo ${accounts.length} tài khoản. Mật khẩu đã được lưu vào hệ thống.`);
      return accounts;
    } finally {
      setIsGeneratingAccounts(false);
    }
  }

  async function handleResetPasswords(studentIds = null) {
    setIsResettingPasswords(true);
    try {
      const res = await resetStudentPasswords(studentIds);
      const updatedMap = new Map((res.updated || []).map((u) => [u.studentId, u.password]));
      setStudents((current) =>
        current.map((s) => (updatedMap.has(s.id) ? {
          ...s,
          initialPassword: updatedMap.get(s.id),
          currentPassword: null,
          hasChangedPassword: false,
        } : s))
      );
      showToast(res.message || "Đã đặt lại mật khẩu thành công.");
    } catch (err) {
      console.error("Không thể đặt lại mật khẩu", err);
      showToast(err.message || "Không thể đặt lại mật khẩu.");
    } finally {
      setIsResettingPasswords(false);
    }
  }

  function handleExportStudents() {
    if (!generatedAccounts.length || !generatedRoster) {
      showToast("Hãy tạo một đợt tài khoản mới trước khi xuất Excel.");
      return;
    }
    downloadRosterCredentialsXlsx(generatedRoster, generatedAccounts);
    showToast("Đã tải chính file danh sách với cột tên đăng nhập và mật khẩu.");
  }

  async function handleExportRosterResults(rosterId) {
    if (!rosterId) {
      showToast("Hãy chọn danh sách cần xuất kết quả.");
      return;
    }
    setIsExportingResults(true);
    try {
      const workbook = account.demo && generatedRoster?.id === rosterId
        ? generatedRoster
        : await loadRosterWorkbook(rosterId);
      const latestResults = account.demo ? studentResults : await loadStudentResults();
      if (!account.demo) setStudentResults(latestResults);

      // Các file từ vựng đã tạo (loại trừ bài demo nếu đã có bài thực tế)
      const customDecks = (decks || []).filter((d) => !d.isDemo);
      const targetDecks = customDecks.length > 0 ? customDecks : (decks || []);
      // Sắp xếp theo thứ tự tạo để cột xuất hiện tuần tự theo bài học
      const sortedDecks = [...targetDecks].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      });

      const studentDeckResults = new Map();
      const latestByStudent = new Map();
      const practiceCountByStudent = new Map();

      for (const result of latestResults) {
        if (!latestByStudent.has(result.studentId)) latestByStudent.set(result.studentId, result);
        if (result.studentId && result.deckId) {
          const deckKey = `${result.studentId}_${result.deckId}`;
          if (!studentDeckResults.has(deckKey)) {
            studentDeckResults.set(deckKey, result);
          }
        }
        if (result.studentId) {
          practiceCountByStudent.set(result.studentId, (practiceCountByStudent.get(result.studentId) || 0) + 1);
        }
      }

      // Mỗi file từ vựng tạo thêm một cột là tên file lúc mình đặt tên (deck.title)
      const deckColumns = sortedDecks.map((deck) => ({
        key: `deck_${deck.id}`,
        header: deck.title || "Bộ từ",
        width: Math.max(16, Math.min(40, (deck.title || "").length + 5)),
        type: "number",
      }));

      // Khi in ra file điểm chỉ có tên, lớp, điểm các chương và cột cuối là điểm trung bình
      const exportColumns = [
        ...(deckColumns.length > 0 ? deckColumns : [{ key: "score", header: "Điểm", width: 12, type: "number" }]),
        { key: "avgScore", header: "Điểm trung bình", width: 16, type: "number" },
      ];

      const resultRows = students
        .filter((student) => student.rosterId === rosterId && student.rosterRow)
        .map((student) => {
          const rowData = {
            rowNumber: student.rosterRow,
          };

          const scores = [];
          // Ở dưới là số điểm của từng học sinh tương ứng với mỗi bài
          for (const deck of sortedDecks) {
            const deckRes = studentDeckResults.get(`${student.id}_${deck.id}`);
            if (deckRes && typeof deckRes.score === "number") {
              rowData[`deck_${deck.id}`] = deckRes.score;
              scores.push(deckRes.score);
            } else {
              rowData[`deck_${deck.id}`] = "";
            }
          }

          // Cột cuối là điểm trung bình
          if (scores.length > 0) {
            const avg = Math.round((scores.reduce((sum, val) => sum + val, 0) / scores.length) * 10) / 10;
            rowData.avgScore = avg;
          } else {
            rowData.avgScore = "";
          }

          return rowData;
        });

      if (!resultRows.length) throw new Error("Không tìm thấy học sinh thuộc danh sách này.");
      downloadRosterResultsXlsx(workbook, resultRows, exportColumns);
      showToast("Đã xuất file bảng điểm (Họ và tên, Lớp, Điểm các chương và Điểm trung bình).");
    } catch (error) {
      console.error("Không thể xuất kết quả vào file gốc", error);
      showToast(error.message || "Chưa xuất được file kết quả.");
    } finally {
      setIsExportingResults(false);
    }
  }

  async function handleRefreshStudentResults() {
    if (account.demo) {
      showToast("Bản xem thử chưa có điểm học sinh trên Supabase.");
      return;
    }
    setIsRefreshingResults(true);
    try {
      const results = await loadStudentResults();
      setStudentResults(results);
      showToast(results.length ? "Đã cập nhật điểm mới nhất của học sinh." : "Chưa có học sinh hoàn thành bài học.");
    } catch (error) {
      console.error("Không thể cập nhật điểm học sinh", error);
      showToast("Chưa cập nhật được điểm. Vui lòng thử lại.");
    } finally {
      setIsRefreshingResults(false);
    }
  }

  async function handleDeleteRoster(rosterId) {
    if (!window.confirm("Bạn có chắc chắn muốn xóa file danh sách này khỏi hệ thống?")) return;
    const previousRosters = rosters;
    const previousStudents = students;
    // Cập nhật giao diện ngay lập tức (Optimistic UI) giúp file danh sách biến mất tức thì
    setRosters((current) => current.filter((r) => r.id !== rosterId));
    setStudents((current) => current.filter((s) => s.rosterId !== rosterId));
    setIsDeletingRoster(true);
    try {
      await deleteRoster(rosterId);
      showToast("Đã xóa file danh sách thành công.");
    } catch (error) {
      console.error("Không thể xóa file danh sách", error);
      setRosters(previousRosters);
      setStudents(previousStudents);
      showToast(error.message || "Chưa xóa được file danh sách. Đã khôi phục.");
    } finally {
      setIsDeletingRoster(false);
    }
  }

  if (authStatus === "loading") return <LoadingScreen />;
  if (isSupabaseConfigured && !account) return <LoginView onLogin={handleLogin} />;

  const canManage = account?.role === "instructor";

  const connectionLabel = {
    connecting: "Đang kết nối",
    connected: "Đã lưu Supabase",
    demo: "Chế độ xem thử",
    error: "Supabase gián đoạn",
  }[connection];

  return (
    <div className="app-shell">
      {canManage && <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => handlePdf(event.target.files?.[0])} />}

      <header className={`topbar ${view === "study" ? "study-topbar" : ""}`}>
        {view !== "study" ? (
          <button className="brand" type="button" onClick={() => (view === "study" ? setLeaveDialog(true) : setView(canManage ? "create-deck" : "deck"))} aria-label="Về trang chủ">
            <span className="brand-mark"><Layers3 size={20} /></span>
            <span>Vocab <b>with me</b></span>
          </button>
        ) : (
          <div className="study-topbar-placeholder" />
        )}
        <div className="topbar-actions">
          <span className="account-pill">
            <span className="account-avatar-circle">{account.displayName ? account.displayName.trim().charAt(0).toUpperCase() : (canManage ? "G" : "S")}</span>
            <span className="account-pill-text">
              <b>{account.displayName}</b>
              <small>{canManage ? "Giáo viên quản trị" : account.className ? `Lớp ${account.className}` : "Học sinh"}</small>
            </span>
          </span>
          {view !== "study" && (
            <button className="icon-text-button leaderboard-nav-btn" type="button" onClick={() => setShowLeaderboard(true)} title="Xem bảng xếp hạng thành tích">
              <Trophy size={17} />
              <span>Xếp hạng</span>
            </button>
          )}
          {canManage && view !== "study" && <button className="icon-button student-manage-shortcut" type="button" onClick={() => setView((current) => current === "students" ? "create-deck" : "students")} aria-label={view === "students" ? "Mở tạo bộ từ" : "Quản lý học sinh"} title="Quản lý học sinh"><Users size={18} /></button>}
          {!canManage && view !== "study" && <button className="icon-text-button" type="button" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            {isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
          </button>}
          {!account.demo && <button className="icon-button" type="button" onClick={handleSignOut} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={18} /></button>}
        </div>
      </header>

      <main className={`workspace ${view === "study" ? "study-workspace" : ""}`}>
        {view !== "study" && (
          <aside className="sidebar">
            <div className="eyebrow">{canManage ? "Quản lý lớp học" : "Tiến độ gần nhất"}</div>
            {canManage ? <div className="score-card teacher-sidebar-card">
              <div><FileText size={22} /> Bộ từ đã tạo</div>
              <strong>{uploadedDecks.length} <small>bộ từ</small></strong>
              <p>{totalWords ? `${totalWords} từ đã sẵn sàng giao cho học sinh.` : "Nhập PDF đầu tiên để tạo bài cho lớp."}</p>
            </div> : <div className="score-card">
              <div><Flame size={22} /> Điểm phiên</div>
              <strong>{lastSession?.score ?? 0} <small>điểm</small></strong>
              <div className="score-track"><span style={{ width: `${Math.min(100, Math.max(8, lastSession?.score || 8))}%` }} /></div>
              <div className="sidebar-practice-count">
                <RotateCcw size={14} />
                <span>Số lần luyện từ vựng:</span>
                <b>{sessions.length} lần</b>
              </div>
              <p>{lastSession ? "Kết quả của lần làm bài gần nhất." : "Hoàn thành bài đầu tiên để lưu điểm."}</p>
            </div>}

            <nav className="sidebar-nav" aria-label="Khu vực ứng dụng">
              {canManage ? (
                <button
                  className={view === "create-deck" ? "active" : ""}
                  type="button"
                  onClick={() => {
                    if (view === "study") setLeaveDialog(true);
                    else setView("create-deck");
                  }}
                >
                  <BookOpen size={17} /> Tạo bộ từ
                </button>
              ) : (
                <button
                  className={view === "deck" || view === "home" ? "active" : ""}
                  type="button"
                  onClick={() => {
                    if (view === "study") setLeaveDialog(true);
                    else setView("deck");
                  }}
                >
                  <BookOpen size={17} /> Bài tập của tôi
                </button>
              )}
              {canManage && (
                <button
                  className={view === "students" ? "active" : ""}
                  type="button"
                  onClick={() => {
                    if (view === "study") setLeaveDialog(true);
                    else setView("students");
                  }}
                >
                  <Users size={17} /> Tài khoản & điểm <span>{students.length}</span>
                </button>
              )}
            </nav>

            <div className="section-heading">
              <span>{canManage ? "Bộ từ của bạn" : "Bộ từ của lớp"}</span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setView("create-deck")}
                  aria-label="Tạo bộ từ mới"
                  title="Tạo bộ từ mới từ PDF"
                >
                  <Plus size={15} />
                </button>
              )}
            </div>
            <div className="deck-list">
              {decks.map((deck, index) => (
                <div key={deck.id} className="deck-item-wrap">
                  <button
                    className={`deck-row ${view === "deck" && selectedDeckId === deck.id ? "active" : ""}`}
                    type="button"
                    onClick={() => {
                      if (view === "study") setLeaveDialog(true);
                      else { setSelectedDeckId(deck.id); setView("deck"); }
                    }}
                  >
                    <span className={`deck-icon ${isDeckLockedForStudent(deck, account) ? "locked" : (index % 2 ? "blue" : "coral")}`}>{isDeckLockedForStudent(deck, account) ? <Lock size={16} /> : deck.isDemo ? <Sparkles size={18} /> : <BookOpen size={18} />}</span>
                    <span>
                      <b>{deck.title}</b>
                      <small>
                        {(() => {
                          if (isDeckLockedForStudent(deck, account)) {
                            const studentDeadline = getDeckLockAtForStudent(deck, account);
                            return studentDeadline && Date.now() > new Date(studentDeadline).getTime()
                              ? "🔒 Đã hết hạn làm bài"
                              : "🔒 Đã khóa cho lớp bạn";
                          }
                          if (canManage) {
                            const lockCount = Object.keys(deck.lockAtByClass || {}).length;
                            const attemptsText = deck.maxAttempts ? ` · Tối đa ${deck.maxAttempts} lần` : "";
                            if (lockCount > 1) return `⏳ Hạn: ${lockCount} lớp${attemptsText}`;
                            if (deck.lockAt) return `⏳ Hạn: ${formatLockDateTime(deck.lockAt)}${attemptsText}`;
                            return `${deckMeta(deck)}${attemptsText}`;
                          }
                          const studentDeadline = getDeckLockAtForStudent(deck, account);
                          const deckCount = (sessions || []).filter((s) => s.deck_id === deck.id).length;
                          if (deck.maxAttempts) {
                            if (deckCount >= deck.maxAttempts) {
                              return `🔒 Đã hết lượt (${deckCount}/${deck.maxAttempts} lần)`;
                            }
                            const countText = ` · Đã luyện ${deckCount}/${deck.maxAttempts} lần`;
                            return studentDeadline ? `⏳ Hạn: ${formatLockDateTime(studentDeadline)}${countText}` : `${deckMeta(deck)}${countText}`;
                          }
                          const countText = deckCount > 0 ? ` · Đã luyện ${deckCount} lần` : "";
                          return studentDeadline ? `⏳ Hạn: ${formatLockDateTime(studentDeadline)}${countText}` : `${deckMeta(deck)}${countText}`;
                        })()}
                      </small>
                    </span>
                  </button>
                  {canManage && !deck.isDemo && (
                    <button
                      className="deck-delete-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeckToDelete(deck);
                      }}
                      title={`Xóa bộ từ "${deck.title}"`}
                      aria-label={`Xóa bộ từ "${deck.title}"`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canManage && (
              <>
                <button className="upload-mini" type="button" onClick={() => setView("create-deck")}>
                  <FileUp size={18} /> Nhập PDF mới
                </button>
                <p className="format-tip">Mỗi dòng theo mẫu<br /><code>new(adj): mới</code></p>
              </>
            )}
          </aside>
        )}

        <section className={`content-stage ${view === "study" ? "study-content-stage" : ""} ${view === "students" ? "instructor-content-stage" : ""}`}>
          {((view === "create-deck" && canManage) || (view === "home" && canManage)) && (
            <CreateDeckView
              isImporting={isImporting}
              importProgress={importProgress}
              onPickPdf={() => fileInputRef.current?.click()}
              onFileDrop={handlePdf}
              onSelectDemoDeck={() => {
                setSelectedDeckId("demo");
                setView("deck");
              }}
            />
          )}
          {(view === "deck" || (!canManage && (view === "create-deck" || view === "home"))) && (
            <HomeView
              deck={selectedDeck}
              sessions={sessions}
              account={account}
              canManage={canManage}
              availableClasses={availableClasses}
              isImporting={isImporting}
              isUpdatingMode={isUpdatingMode}
              isUpdatingAccess={isUpdatingAccess}
              isUpdatingLockAt={isUpdatingLockAt}
              isUpdatingMaxAttempts={isUpdatingMaxAttempts}
              isUpdatingTimeLimit={isUpdatingTimeLimit}
              isUpdatingExamMode={isUpdatingExamMode}
              isUpdatingShuffle={isUpdatingShuffle}
              isDeletingDeck={isDeletingDeck}
              importProgress={importProgress}
              onPickPdf={() => fileInputRef.current?.click()}
              onStart={startStudy}
              onModeChange={handleDeckPracticeMode}
              onClassAccessChange={handleDeckClassAccess}
              onLockAtChange={handleDeckLockAt}
              onMaxAttemptsChange={handleDeckMaxAttempts}
              onTimeLimitChange={handleDeckTimeLimit}
              onExamModeChange={handleDeckExamMode}
              onShuffleChange={handleDeckShuffle}
              onDeleteDeck={(deck) => setDeckToDelete(deck)}
              onEditDeck={(deck) => setDeckToEdit(deck)}
              onFlashcard={() => setView("flashcard")}
              onPracticeMistakes={handlePracticeMistakes}
              savedMistakesCount={getSavedMistakes(selectedDeck?.id).length}
              onNavigateCreateDeck={() => setView("create-deck")}
            />
          )}
          {view === "flashcard" && selectedDeck && (
            <FlashcardView
              deck={selectedDeck}
              onBack={() => setView("deck")}
              onStartQuiz={() => {
                setView("deck");
                startStudy();
              }}
            />
          )}
          {view === "students" && canManage && (
            <InstructorView
              students={students}
              rosters={rosters}
              studentResults={studentResults}
              decks={decks}
              generatedAccounts={generatedAccounts}
              isGenerating={isGeneratingAccounts}
              isRefreshingResults={isRefreshingResults}
              isExportingResults={isExportingResults}
              isResettingPasswords={isResettingPasswords}
              isDemo={Boolean(account.demo)}
              onGenerate={handleGenerateStudents}
              onExport={handleExportStudents}
              onExportResults={handleExportRosterResults}
              onRefreshResults={handleRefreshStudentResults}
              onResetPasswords={handleResetPasswords}
              isDeletingRoster={isDeletingRoster}
              onDeleteRoster={handleDeleteRoster}
              onViewStudentProgress={(student) => setProgressStudent(student)}
            />
          )}
          {view === "import" && importDraft && (
            <ImportView
              draft={importDraft}
              availableClasses={availableClasses}
              isSaving={isSaving}
              connection={connection}
              onBack={() => setView(canManage ? "create-deck" : "deck")}
              onChangeTitle={(title) => setImportDraft((draft) => ({ ...draft, title }))}
              onChangePracticeMode={(practiceMode) => setImportDraft((draft) => ({ ...draft, practiceMode }))}
              onChangeUnlockedClasses={(unlockedClasses) => setImportDraft((draft) => ({ ...draft, unlockedClasses }))}
              onChangeMaxAttempts={(maxAttempts) => setImportDraft((draft) => ({ ...draft, maxAttempts }))}
              onRemoveWord={removeDraftWord}
              onSave={saveImport}
            />
          )}
          {view === "study" && study && currentWord && (
            <StudyView
              study={study}
              currentWord={currentWord}
              quizChoices={quizChoices}
              wordFamilyChoices={wordFamilyChoices}
              typingInputRef={typingInputRef}
              isFullscreen={isFullscreen}
              onBack={() => setLeaveDialog(true)}
              onFullscreen={toggleFullscreen}
              onAnswer={answerCurrent}
              onInput={(input) => setStudy((current) => ({ ...current, input }))}
              onTypingSubmit={submitTyping}
              onTimeUp={() => finishStudy(study, false, "Hết giờ làm bài")}
            />
          )}
          {view === "results" && lastResult && (
            <ResultView
              result={lastResult}
              maxAttempts={selectedDeck?.maxAttempts}
              practiceCount={(sessions || []).filter((s) => s.deck_id === selectedDeck?.id).length}
              onAgain={startStudy}
              onHome={() => setView(canManage ? "create-deck" : "deck")}
              onPracticeMistakes={handlePracticeMistakes}
            />
          )}
        </section>
      </main>

      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        decks={decks}
        students={students}
        studentResults={studentResults}
        currentAccount={account}
      />
      <StudentProgressModal
        isOpen={Boolean(progressStudent)}
        onClose={() => setProgressStudent(null)}
        student={progressStudent}
        studentResults={studentResults}
        decks={decks}
      />
      <EditDeckModal
        isOpen={Boolean(deckToEdit)}
        onClose={() => setDeckToEdit(null)}
        deck={deckToEdit}
        onSave={handleSaveDeckWords}
        isSaving={isSavingDeckEdit}
      />
      <FirstLoginPasswordModal
        isOpen={Boolean(account && account.role === "student" && !account.hasChangedPassword)}
        student={account}
        onSave={handleSaveFirstPassword}
        onSignOut={handleSignOut}
        isSaving={isSavingFirstPassword}
      />

      {leaveDialog && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setLeaveDialog(false)}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" onClick={() => setLeaveDialog(false)} aria-label="Đóng"><X size={18} /></button>
            <div className="warning-icon"><CircleAlert size={25} /></div>
            <h2 id="leave-title">Rời phiên học?</h2>
            <p>Phiên chưa hoàn thành. Nếu rời bây giờ, bạn sẽ bị trừ <strong>5 điểm</strong> và tiến độ dở dang được ghi lại.</p>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setLeaveDialog(false)}>Học tiếp</button>
              <button className="danger-button" type="button" onClick={confirmLeaveStudy}>Rời và trừ điểm</button>
            </div>
          </div>
        </div>
      )}

      {deckToDelete && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !isDeletingDeck && setDeckToDelete(null)}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-deck-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" onClick={() => !isDeletingDeck && setDeckToDelete(null)} aria-label="Đóng" disabled={isDeletingDeck}><X size={18} /></button>
            <div className="warning-icon"><Trash2 size={25} /></div>
            <h2 id="delete-deck-title">Xóa bộ từ?</h2>
            <p>Bạn có chắc chắn muốn xóa bộ từ <strong>"{deckToDelete.title}"</strong> ({deckToDelete.words?.length || 0} từ)? Tất cả từ vựng và kết quả làm bài của học sinh trong bộ từ này sẽ bị xóa vĩnh viễn.</p>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setDeckToDelete(null)} disabled={isDeletingDeck}>Hủy</button>
              <button className="danger-button" type="button" onClick={confirmDeleteDeck} disabled={isDeletingDeck}>
                {isDeletingDeck ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}
                {isDeletingDeck ? "Đang xóa…" : "Xóa bộ từ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isImporting && <div className="processing-banner" role="status"><LoaderCircle size={19} className="spin" /><span>Đang đọc PDF… <b>{importProgress}%</b></span></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function LoadingScreen() {
  return <div className="auth-screen"><div className="auth-loading"><span className="brand-mark"><Layers3 size={21} /></span><LoaderCircle className="spin" size={24} /><span>Đang mở lớp học…</span></div></div>;
}

function LoginView({ onLogin }) {
  const [role, setRole] = useState("instructor");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const handleWheel = (event) => {
      event.preventDefault();
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await onLogin({ role, identifier, password });
    } catch (loginError) {
      setError(loginError.message || "Không thể đăng nhập.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-screen centered-auth" onWheel={(e) => e.preventDefault()}>
      <BookBackground />

      {isMinimized ? (
        <button
          className="login-minimized-badge"
          type="button"
          onClick={() => setIsMinimized(false)}
          title="Mở cổng đăng nhập"
        >
          <Layers3 size={18} />
          <span>Mở cổng đăng nhập</span>
        </button>
      ) : (
        <div className="login-centered-container">
          <LoginCat />
          <form className="login-card centered-card" onSubmit={submit}>
            <div className="login-card-top-bar" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="toggle-book-view-btn"
                onClick={() => setIsMinimized(true)}
                title="Thu gọn để xem toàn bộ cuốn sách 3D"
              >
                <span>📖 Xem sách 3D</span>
              </button>
            </div>

            <div className="login-card-brand">
              <span className="brand-mark"><Layers3 size={24} /></span>
              <div className="brand-title">
                <h1>Vocab <b>with me</b></h1>
              </div>
            </div>

          <div className="role-switch" role="tablist" aria-label="Vai trò đăng nhập">
            <button
              className={role === "instructor" ? "active" : ""}
              type="button"
              onClick={() => { setRole("instructor"); setIdentifier(""); setError(""); }}
            >
              <ShieldCheck size={18} />
              <span>Giáo viên</span>
            </button>
            <button
              className={role === "student" ? "active" : ""}
              type="button"
              onClick={() => { setRole("student"); setIdentifier(""); setError(""); }}
            >
              <GraduationCap size={18} />
              <span>Học sinh</span>
            </button>
          </div>

          <div className="form-group">
            <label className="field-label" htmlFor="login-identifier">
              {role === "instructor" ? "Email giáo viên" : "Tên đăng nhập học sinh"}
            </label>
            <input
              id="login-identifier"
              className="auth-input"
              type={role === "instructor" ? "email" : "text"}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={role === "instructor" ? "giaovien@truong.edu.vn" : "12a1-k7m4p2"}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label className="field-label" htmlFor="login-password">Mật khẩu</label>
            <div className="password-field">
              <input
                id="login-password"
                className="auth-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <CircleAlert size={17} />
              <span>{error}</span>
            </div>
          )}

          <button
            className="primary-button login-submit"
            type="submit"
            disabled={isSubmitting || !identifier.trim() || !password}
          >
            {isSubmitting ? <LoaderCircle className="spin" size={18} /> : <ChevronRight size={18} />}
            <span>{isSubmitting ? "Đang đăng nhập…" : `Vào khu vực ${role === "instructor" ? "giáo viên" : "học sinh"}`}</span>
          </button>

          <p className="login-note">
            {role === "student"
              ? "Học sinh dùng đúng tên đăng nhập và mật khẩu trong file Excel được cấp."
              : "Giáo viên quản trị có thể tạo bài tập và theo dõi điểm từng lớp."}
          </p>
        </form>
      </div>
      )}
    </div>
  );
}

export function InstructorView({ students, rosters, studentResults, decks = [], generatedAccounts, isGenerating, isRefreshingResults, isExportingResults, isResettingPasswords, isDeletingRoster, isDemo, onGenerate, onExport, onExportResults, onRefreshResults, onResetPasswords, onDeleteRoster, onViewStudentProgress }) {
  const rosterInputRef = useRef(null);
  const [rosterDraft, setRosterDraft] = useState(null);
  const [classNameInput, setClassNameInput] = useState("");
  const [isReadingRoster, setIsReadingRoster] = useState(false);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [selectedClassTab, setSelectedClassTab] = useState("all");
  const [showPasswords, setShowPasswords] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedNewAccountId, setSelectedNewAccountId] = useState(null);
  const [isMissedWordsOpen, setIsMissedWordsOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedStudentId(null);
  }, [selectedClassTab]);

  const customDecks = useMemo(() => (decks || []).filter((d) => !d.isDemo), [decks]);
  const targetDecks = useMemo(() => customDecks.length > 0 ? customDecks : (decks || []), [customDecks, decks]);
  const sortedDecks = useMemo(() => {
    return [...targetDecks].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    });
  }, [targetDecks]);

  const studentDeckResults = useMemo(() => {
    const map = new Map();
    for (const res of studentResults) {
      if (res.studentId && res.deckId) {
        const key = `${res.studentId}_${res.deckId}`;
        if (!map.has(key)) map.set(key, res);
      }
    }
    return map;
  }, [studentResults]);

  const generatedAccountMap = useMemo(() => {
    const map = new Map();
    for (const acc of generatedAccounts) {
      if (acc.username) map.set(acc.username, acc.password);
      if (acc.id) map.set(acc.id, acc.password);
    }
    return map;
  }, [generatedAccounts]);

  const latestResultByStudent = useMemo(() => {
    const latest = new Map();
    for (const result of studentResults) {
      if (!latest.has(result.studentId)) latest.set(result.studentId, result);
    }
    return latest;
  }, [studentResults]);

  const practiceCountByStudent = useMemo(() => {
    const counts = new Map();
    for (const result of studentResults) {
      if (result.studentId) {
        counts.set(result.studentId, (counts.get(result.studentId) || 0) + 1);
      }
    }
    return counts;
  }, [studentResults]);

  const classList = useMemo(() => {
    const set = new Set();
    for (const s of students) {
      if (s.className) {
        const trimmed = s.className.trim();
        if (trimmed) set.add(trimmed);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));
  }, [students]);

  const studentCountByClass = useMemo(() => {
    const counts = new Map();
    for (const student of students) {
      const cls = student.className || "Chưa phân lớp";
      counts.set(cls, (counts.get(cls) || 0) + 1);
    }
    return counts;
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (selectedClassTab === "all") return students;
    return students.filter((student) => student.className === selectedClassTab);
  }, [students, selectedClassTab]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return filteredStudents.find((student) => student.id === selectedStudentId) || null;
  }, [filteredStudents, selectedStudentId]);

  const filteredResultCount = useMemo(() => {
    let count = 0;
    for (const student of filteredStudents) {
      if (latestResultByStudent.has(student.id)) count += 1;
    }
    return count;
  }, [filteredStudents, latestResultByStudent]);

  async function readRoster(file) {
    if (!file) return;
    setError("");
    setIsReadingRoster(true);
    try {
      const parsed = await parseStudentRosterXlsx(file);
      setRosterDraft(parsed);
      const detected = parsed.students.find((s) => s.className)?.className
        || parsed.workbook.sheetName
        || "";
      setClassNameInput(detected);
    } catch (readError) {
      setRosterDraft(null);
      setError(readError.message || "Không đọc được danh sách học sinh.");
    } finally {
      setIsReadingRoster(false);
      if (rosterInputRef.current) rosterInputRef.current.value = "";
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!rosterDraft) {
      setError("Hãy chọn file Excel danh sách học sinh.");
      return;
    }
    const chosenClass = classNameInput.trim();
    if (!chosenClass) {
      setError("Vui lòng nhập tên lớp cho danh sách học sinh.");
      return;
    }
    try {
      const studentsWithClass = rosterDraft.students.map((student) => ({
        ...student,
        className: chosenClass,
      }));
      await onGenerate({ students: studentsWithClass, workbook: rosterDraft.workbook });
      setRosterDraft(null);
      setClassNameInput("");
      setSelectedClassTab(chosenClass);
    } catch (generationError) {
      setError(generationError.message || "Không thể tạo tài khoản.");
    }
  }

  return (
    <div className="instructor-view">
      <div className="instructor-head">
        <div>
          <div className="eyebrow">Khu vực giáo viên</div>
          <h1>Nhập danh sách lớp</h1>
          <p>Tải Excel lên để tạo tài khoản, đặt tên lớp và lọc điểm theo từng lớp.</p>
        </div>
        <div className="instructor-summary">
          <div className="student-count">
            <span className="count-icon-wrap users-icon"><Users size={20} /></span>
            <div>
              <strong>{selectedClassTab === "all" ? students.length : filteredStudents.length}</strong>
              <small>học sinh {selectedClassTab !== "all" ? `lớp ${selectedClassTab}` : "đã nạp"}</small>
            </div>
          </div>
          <div className="student-count score-count">
            <span className="count-icon-wrap trophy-icon"><Trophy size={20} /></span>
            <div>
              <strong>{filteredResultCount}</strong>
              <small>đã hoàn thành bài</small>
            </div>
          </div>
          {classList.length > 0 && (
            <div className="student-count class-count">
              <span className="count-icon-wrap grad-icon"><GraduationCap size={20} /></span>
              <div>
                <strong>{classList.length}</strong>
                <small>lớp học</small>
              </div>
            </div>
          )}
        </div>
      </div>

      {isDemo && (
        <div className="demo-banner">
          <CircleAlert size={18} />
          <span>Đây là bản xem thử. Tài khoản tạo ở đây chỉ để kiểm tra giao diện và file Excel.</span>
        </div>
      )}

      <div className="teacher-grid">
        <form className="account-generator" onSubmit={submit}>
          <div className="generator-title">
            <span><FileSpreadsheet size={20} /></span>
            <div>
              <h2>File danh sách học sinh</h2>
              <p>Chọn file Excel (.xlsx). Bạn có thể đặt tên lớp cho danh sách này bên dưới.</p>
            </div>
          </div>
          <input
            ref={rosterInputRef}
            className="visually-hidden"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => readRoster(event.target.files?.[0])}
          />
          <button
            className={`roster-drop ${rosterDraft ? "ready" : ""}`}
            type="button"
            onClick={() => rosterInputRef.current?.click()}
            disabled={isReadingRoster || isGenerating}
          >
            {isReadingRoster ? <LoaderCircle className="spin" size={24} /> : rosterDraft ? <Check size={24} /> : <FileUp size={24} />}
            <span>
              <b>{isReadingRoster ? "Đang đọc file…" : rosterDraft ? rosterDraft.workbook.originalFileName : "Chọn file Excel (.xlsx)"}</b>
              <small>{rosterDraft ? `${rosterDraft.students.length} học sinh · Trang ${rosterDraft.workbook.sheetName}` : "Tối đa 100 học sinh, dung lượng dưới 2,5 MB"}</small>
            </span>
          </button>

          {rosterDraft && (
            <div className="class-name-box">
              <label className="field-label" htmlFor="roster-class-name">
                <span>Đặt tên lớp cho danh sách này</span>
                <small>Tên lớp dùng để quản lý điểm và mở/khóa bộ từ vựng (ví dụ: 12A1, 12A2, CNTT-K15...)</small>
              </label>
              <input
                id="roster-class-name"
                className="auth-input class-input"
                value={classNameInput}
                onChange={(event) => setClassNameInput(event.target.value)}
                maxLength={80}
                placeholder="Nhập tên lớp, ví dụ: 12A1"
                required
                autoFocus
              />
            </div>
          )}

          {rosterDraft && (
            <div className="roster-preview">
              <span>Đã nhận diện {rosterDraft.students.length} học sinh</span>
              <b>{rosterDraft.students.slice(0, 3).map((student) => student.displayName).join(", ")}{rosterDraft.students.length > 3 ? ` và ${rosterDraft.students.length - 3} học sinh khác` : ""}</b>
            </div>
          )}

          {error && <div className="login-error" role="alert"><CircleAlert size={17} /> {error}</div>}

          <button
            className="primary-button generator-submit"
            type="submit"
            disabled={isGenerating || isReadingRoster || !rosterDraft || !classNameInput.trim()}
          >
            {isGenerating ? <LoaderCircle className="spin" size={18} /> : <UserPlus size={18} />}
            {isGenerating ? "Đang tạo tài khoản…" : `Tạo ${rosterDraft?.students.length || 0} tài khoản`}
          </button>
        </form>

        <section className="export-panel">
          <span className="export-icon"><Download size={23} /></span>
          <div className="eyebrow">File cấp cho học sinh</div>
          <h2>{generatedAccounts.length ? `${generatedAccounts.length} tài khoản sẵn sàng` : "Chưa có đợt mới"}</h2>
          <p>File gốc được thêm cột Tên đăng nhập và Mật khẩu. Mật khẩu chỉ hiện ở lần tạo này.</p>
          <button className="secondary-button" type="button" onClick={onExport} disabled={!generatedAccounts.length}>
            <Download size={18} /> Tải file cấp tài khoản
          </button>
        </section>
      </div>

      {generatedAccounts.length > 0 && (
        <section className="new-accounts">
          <div className="table-title">
            <div>
              <div className="eyebrow">Đợt vừa tạo</div>
              <h2>Tài khoản và mật khẩu</h2>
            </div>
            <button className="secondary-button password-toggle" type="button" onClick={() => setShowPasswords((shown) => !shown)}>
              {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
              {showPasswords ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            </button>
          </div>
          <div className="student-table-wrap">
            <table className="student-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Tên hiển thị</th>
                  <th>Tên đăng nhập</th>
                  <th>Mật khẩu ban đầu (1 lần)</th>
                  <th>Lớp</th>
                </tr>
              </thead>
              <tbody>
                {generatedAccounts.map((student, index) => {
                  const isSelected = selectedNewAccountId === student.id;
                  return (
                    <tr
                      key={student.id}
                      className={isSelected ? "is-selected" : ""}
                      onClick={() => setSelectedNewAccountId((prev) => (prev === student.id ? null : student.id))}
                      title={isSelected ? "Bấm để bỏ bôi màu dòng này" : "Bấm để bôi màu theo dõi dòng này"}
                    >
                      <td>{index + 1}</td>
                      <td>{student.displayName}</td>
                      <td><code>{student.username}</code></td>
                      <td><code>{showPasswords ? student.password : "••••••••••"}</code></td>
                      <td><span className="class-name-tag">{student.className}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="student-directory">
        <div className="table-title">
          <div>
            <div className="eyebrow">Điểm học tập</div>
            <h2>Kết quả mới nhất của học sinh</h2>
            <p>Chọn danh sách để xuất chính file đã nhập, có thêm cột cho từng bài từ vựng và số lần luyện.</p>
          </div>
          <div className="result-tools">
            <div className="tools-group file-tools-group">
              <select
                className="roster-select"
                value={selectedRosterId}
                onChange={(event) => setSelectedRosterId(event.target.value)}
                disabled={!rosters.length}
              >
                <option value="">{rosters.length ? "Danh sách" : "Chưa có file danh sách"}</option>
                {rosters.map((roster) => (
                  <option key={roster.id} value={roster.id}>
                    {getRosterDisplayLabel(roster, students)}
                  </option>
                ))}
              </select>
              <button
                className="secondary-button export-result-btn"
                type="button"
                onClick={() => {
                  if (!selectedRosterId) {
                    setError("Vui lòng chọn một file trong ô 'Danh sách' trước khi xuất kết quả.");
                    return;
                  }
                  onExportResults(selectedRosterId);
                }}
                disabled={!selectedRosterId || isExportingResults}
                title={!selectedRosterId ? "Vui lòng chọn file trong ô 'Danh sách'" : "Xuất file bảng điểm gồm họ tên, lớp, điểm các chương và điểm trung bình"}
              >
                {isExportingResults ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}
                <span>{isExportingResults ? "Đang xuất…" : "Xuất file điểm"}</span>
              </button>
              {selectedRosterId && (
                <button
                  className="secondary-button delete-roster-btn"
                  type="button"
                  onClick={async () => {
                    const target = rosters.find((r) => r.id === selectedRosterId);
                    if (target) {
                      await onDeleteRoster(target.id);
                      setSelectedRosterId("");
                    }
                  }}
                  disabled={isDeletingRoster}
                  title="Xóa file danh sách này khỏi hệ thống"
                >
                  {isDeletingRoster ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}
                  <span>Xóa file</span>
                </button>
              )}
            </div>
            <div className="tools-group action-tools-group">
              <button
                className="secondary-button password-toggle"
                type="button"
                onClick={() => setIsMissedWordsOpen(true)}
                title="Xem danh sách những từ vựng học sinh hay làm sai nhất"
              >
                <AlertTriangle size={17} />
                <span>Từ hay làm sai</span>
              </button>
              <button className="secondary-button password-toggle" type="button" onClick={() => setShowPasswords((shown) => !shown)}>
                {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                <span>{showPasswords ? "Ẩn mật khẩu" : "Hiện mật khẩu"}</span>
              </button>
              <button className="secondary-button password-toggle" type="button" onClick={() => onResetPasswords()} disabled={isResettingPasswords || !students.length} title="Đặt lại mật khẩu ngẫu nhiên cho tất cả học sinh và lưu vào hệ thống">
                {isResettingPasswords ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />}
                <span>{isResettingPasswords ? "Đang cấp lại…" : "Cấp lại MK"}</span>
              </button>
              <button className="secondary-button password-toggle" type="button" onClick={onRefreshResults} disabled={isRefreshingResults}>
                {isRefreshingResults ? <LoaderCircle className="spin" size={17} /> : <RotateCcw size={17} />}
                <span>{isRefreshingResults ? "Đang cập nhật…" : "Cập nhật điểm"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Thanh danh sách các lớp - Chỉ hiện khi đã có lớp học/học sinh */}
        {classList.length > 0 && (
          <div className="class-filter-bar">
            <div className="class-filter-title">
              <Users size={15} />
              <span>Lớp:</span>
            </div>
            <div className="class-tabs-list" role="tablist" aria-label="Lọc theo lớp học">
              <button
                type="button"
                role="tab"
                aria-selected={selectedClassTab === "all"}
                className={`class-tab-btn ${selectedClassTab === "all" ? "active" : ""}`}
                onClick={() => setSelectedClassTab("all")}
              >
                <span>Tất cả các lớp</span>
                <span className="class-badge">{classList.length}</span>
              </button>
              {classList.map((cls) => {
                const count = studentCountByClass.get(cls) || 0;
                return (
                  <button
                    key={cls}
                    type="button"
                    role="tab"
                    aria-selected={selectedClassTab === cls}
                    className={`class-tab-btn ${selectedClassTab === cls ? "active" : ""}`}
                    onClick={() => setSelectedClassTab(cls)}
                  >
                    <span>Lớp {cls}</span>
                    <span className="class-badge">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {filteredStudents.length ? (
          <>
            {selectedStudent && (
              <div className="table-highlight-notice">
                <span>
                  Đang bôi màu dòng: <strong>{selectedStudent.displayName}</strong> ({selectedStudent.className ? `Lớp ${selectedStudent.className}` : "Chưa phân lớp"})
                </span>
                <button
                  type="button"
                  className="clear-highlight-btn"
                  onClick={() => setSelectedStudentId(null)}
                  title="Bỏ bôi màu dòng này"
                >
                  <X size={14} />
                  <span>Bỏ chọn dòng</span>
                </button>
              </div>
            )}
            <div className="student-table-wrap">
              <table className="student-table result-table">
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th>Tên đăng nhập</th>
                    <th>Mật khẩu cũ</th>
                    <th>Mật khẩu mới</th>
                    <th>Lớp</th>
                    {sortedDecks.map((deck) => (
                      <th key={deck.id} title={`Điểm bài: ${deck.title}`}>
                        {deck.title}
                      </th>
                    ))}
                    <th title="Điểm trung bình của các bài đã làm">Điểm trung bình</th>
                    <th>Số lần luyện</th>
                    <th>Lỗi/vi phạm</th>
                    <th>Lần thi gần nhất</th>
                    <th>Tiến trình</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const result = latestResultByStudent.get(student.id);
                    const practiceCount = practiceCountByStudent.get(student.id) || 0;
                    const issue = formatViolationText(result);
                    const badgeClass = getViolationBadgeClass(result);
                    const rawPassword = student.initialPassword || generatedAccountMap.get(student.username) || generatedAccountMap.get(student.id);
                    const currentPassword = student.currentPassword;
                    const hasChanged = Boolean(student.hasChangedPassword && currentPassword);
                    const isSelected = selectedStudentId === student.id;

                    const studentScores = [];
                    for (const deck of sortedDecks) {
                      const deckRes = studentDeckResults.get(`${student.id}_${deck.id}`);
                      if (deckRes && typeof deckRes.score === "number") {
                        studentScores.push(deckRes.score);
                      }
                    }
                    const avgScore = studentScores.length > 0
                      ? Math.round((studentScores.reduce((sum, val) => sum + val, 0) / studentScores.length) * 10) / 10
                      : null;

                    return (
                      <tr
                        key={student.id}
                        className={isSelected ? "is-selected" : ""}
                        onClick={() => setSelectedStudentId((prev) => (prev === student.id ? null : student.id))}
                        title={isSelected ? "Bấm để bỏ bôi màu dòng này" : "Bấm để bôi màu theo dõi học sinh này"}
                      >
                      <td>{student.displayName}</td>
                      <td><code>{student.username}</code></td>
                      <td>
                        <div className="pwd-cell old-pwd">
                          {rawPassword ? (
                            <code>{showPasswords ? rawPassword : "••••••••••"}</code>
                          ) : (
                            <span className="no-result" title="Mật khẩu tạo ở đợt trước khi có tính năng lưu. Bấm 'Cấp lại MK' ở trên để tạo mật khẩu mới.">Chưa lưu</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="pwd-cell new-pwd">
                          {hasChanged ? (
                            <code>{showPasswords ? currentPassword : "••••••••••"}</code>
                          ) : (
                            <span className="pwd-badge unshifted" title="Học sinh chưa đổi mật khẩu lần đầu (đang dùng mật khẩu 1 lần)">
                              Chưa đổi
                            </span>
                          )}
                        </div>
                      </td>
                      <td><span className="class-name-tag">{student.className}</span></td>
                      {sortedDecks.map((deck) => {
                        const deckRes = studentDeckResults.get(`${student.id}_${deck.id}`);
                        return (
                          <td key={deck.id}>
                            {deckRes && typeof deckRes.score === "number" ? (
                              <span className={`score-badge ${deckRes.completed ? "" : "left-early"}`}>
                                {deckRes.score} điểm
                              </span>
                            ) : (
                              <span className="no-result">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td>
                        {avgScore !== null ? (
                          <span className="score-badge avg-score-badge" title={`Điểm trung bình của ${studentScores.length} bài đã làm`}>
                            {avgScore} điểm
                          </span>
                        ) : (
                          <span className="no-result">—</span>
                        )}
                      </td>
                      <td>
                        {practiceCount > 0 ? (
                          <span className="practice-count-badge">
                            <RotateCcw size={12} /> {practiceCount} lần
                          </span>
                        ) : (
                          <span className="no-result">Chưa luyện</span>
                        )}
                      </td>
                      <td><span className={`issue-badge ${badgeClass}`}>{issue}</span></td>
                      <td>
                        {result?.completedAt
                          ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(result.completedAt))
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-action-btn progress-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onViewStudentProgress) onViewStudentProgress(student);
                          }}
                          title={`Xem biểu đồ tiến trình của ${student.displayName}`}
                        >
                          <BarChart3 size={14} />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
          <div className="empty-students">
            <GraduationCap size={28} />
            <strong>{students.length ? `Chưa có học sinh nào trong lớp "${selectedClassTab}"` : "Chưa có tài khoản học sinh"}</strong>
            <span>{students.length ? "Chọn tab khác hoặc tải thêm file danh sách cho lớp này." : "Tải file Excel danh sách ở trên để tạo đợt đầu tiên."}</span>
          </div>
        )}
      </section>

      <MostMissedWordsModal
        isOpen={isMissedWordsOpen}
        onClose={() => setIsMissedWordsOpen(false)}
        decks={decks}
        students={students}
        studentResults={studentResults}
        initialDeckId=""
        initialClass={selectedClassTab}
      />
    </div>
  );
}

function ClassAccessControl({ availableClasses = [], unlockedClasses = null, onChange, disabled }) {
  const isAllUnlocked = unlockedClasses === null;
  const isAllLocked = Array.isArray(unlockedClasses) && unlockedClasses.length === 0;

  function toggleClass(className) {
    if (disabled) return;
    if (unlockedClasses === null) {
      const next = availableClasses.filter((c) => c !== className);
      onChange(next);
    } else {
      const set = new Set(unlockedClasses);
      if (set.has(className)) {
        set.delete(className);
        onChange(Array.from(set));
      } else {
        set.add(className);
        if (availableClasses.length > 0 && availableClasses.every((c) => set.has(c))) {
          onChange(null);
        } else {
          onChange(Array.from(set));
        }
      }
    }
  }

  return (
    <div className="class-access-control">
      <div className="class-access-header">
        <div>
          <span className="field-label">Mở / Khóa bài tập theo từng lớp</span>
          <p>Chọn mở hoặc khóa cho từng lớp học. Học sinh lớp bị khóa sẽ không thể vào làm bài.</p>
        </div>
        {availableClasses.length > 0 && (
          <div className="class-access-quick-actions">
            <button
              type="button"
              className={`quick-action-btn unlock-all-btn ${isAllUnlocked ? "active" : ""}`}
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              Mở tất cả
            </button>
            <button
              type="button"
              className={`quick-action-btn lock-all-btn ${isAllLocked ? "active" : ""}`}
              onClick={() => onChange([])}
              disabled={disabled}
            >
              Khóa tất cả
            </button>
          </div>
        )}
      </div>

      {availableClasses.length === 0 ? (
        <div className="class-access-empty">
          <span>Chưa có lớp nào trong danh sách. Bộ từ này mặc định sẽ mở cho tất cả các lớp khi bạn tạo học sinh.</span>
        </div>
      ) : (
        <div className="class-access-list">
          {availableClasses.map((cls) => {
            const unlocked = unlockedClasses === null || unlockedClasses.includes(cls);
            return (
              <button
                key={cls}
                type="button"
                className={`class-access-card ${unlocked ? "unlocked" : "locked"}`}
                onClick={() => toggleClass(cls)}
                disabled={disabled}
                title={unlocked ? `Lớp ${cls} đang mở - bấm để khóa` : `Lớp ${cls} đang khóa - bấm để mở`}
              >
                <div className="class-access-info">
                  <span className="class-name-text">Lớp {cls}</span>
                </div>
                <span className={`class-lock-badge ${unlocked ? "badge-open" : "badge-locked"}`}>
                  {unlocked ? <Unlock size={13} /> : <Lock size={13} />}
                  <span>{unlocked ? "Mở" : "Khóa"}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateDeckView({
  isImporting,
  importProgress,
  onPickPdf,
  onFileDrop,
  onSelectDemoDeck,
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        onFileDrop(file);
      }
    }
  };

  const POS_GUIDE_ITEMS = [
    { code: "v", name: "Động từ", aliases: "verb, động từ", example: "achieve(v): đạt được" },
    { code: "n", name: "Danh từ", aliases: "noun, danh từ", example: "challenge(n): thử thách" },
    { code: "adj", name: "Tính từ", aliases: "adjective, tính từ", example: "brilliant(adj): rực rỡ" },
    { code: "adv", name: "Trạng từ", aliases: "adverb, trạng từ", example: "confidently(adv): tự tin" },
    { code: "prep", name: "Giới từ", aliases: "preposition, giới từ", example: "in spite of(prep): mặc dù" },
    { code: "pron", name: "Đại từ", aliases: "pronoun, đại từ", example: "someone(pron): ai đó" },
    { code: "conj", name: "Liên từ", aliases: "conjunction, liên từ", example: "although(conj): mặc dù" },
    { code: "phrase", name: "Cụm từ / Thành ngữ", aliases: "phrase, idiom, cụm từ", example: "break down(phrase): bị hỏng" },
  ];

  return (
    <div className="create-deck-view">
      <div className="create-deck-head">
        <div>
          <div className="eyebrow">Khu vực giáo viên</div>
          <h1>Tạo bộ từ mới từ PDF</h1>
          <p>Tải file PDF danh sách từ vựng lên hệ thống để tạo bài tập cho học sinh. Xem quy cách định dạng file chuẩn bên dưới.</p>
        </div>
      </div>

      {/* Hero Drag & Drop Area */}
      <div
        className={`create-upload-card ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="create-upload-icon">
          {isImporting ? <LoaderCircle className="spin" size={36} /> : <FileUp size={36} />}
        </div>
        <h2>Kéo thả file PDF vào đây hoặc chọn từ máy tính</h2>
        <p>Hệ thống tự động quét và nhận diện các dòng theo đúng định dạng mẫu trên toàn bộ các trang.</p>

        {isImporting ? (
          <div className="create-upload-progress">
            <div className="create-progress-bar">
              <span style={{ width: `${Math.max(5, importProgress)}%` }} />
            </div>
            <span>Đang đọc và phân tích file PDF… <b>{importProgress}%</b></span>
          </div>
        ) : (
          <div className="create-upload-actions">
            <button
              className="primary-button create-pick-btn"
              type="button"
              onClick={onPickPdf}
            >
              <FileUp size={19} />
              <span>Chọn file PDF từ máy</span>
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={onSelectDemoDeck}
              title="Xem trước bộ từ mẫu để hình dung cách hoạt động"
            >
              <Sparkles size={16} />
              <span>Xem bộ từ học thử mẫu</span>
            </button>
          </div>
        )}
      </div>

      {/* PDF Format Guidelines */}
      <div className="format-guide-section">
        <div className="format-guide-header">
          <span className="format-guide-icon"><FileText size={22} /></span>
          <div>
            <h2>Quy cách định dạng file PDF chuẩn</h2>
            <p>Để hệ thống trích xuất từ vựng chính xác, file PDF cần được soạn thảo theo cấu trúc sau:</p>
          </div>
        </div>

        {/* Syntax Banner */}
        <div className="syntax-banner">
          <div className="syntax-code-wrap">
            <span className="syntax-tag">Cú pháp hỗ trợ linh hoạt</span>
            <code className="syntax-code">1. từ_vựng (loại_từ) /phiên_âm/ nghĩa_tiếng_việt</code>
          </div>
          <div className="syntax-rules">
            <div className="syntax-rule-item">
              <span className="rule-num">1</span>
              <div>
                <strong>Hỗ trợ giáo trình chuẩn (như Close-Up, Global...)</strong>
                <p>Nhận diện tự động danh sách có số thứ tự <code>1. 2. 3.</code>, phiên âm IPA <code>/ˈɒnɪst/</code>, cụm động từ <code>(phr v)</code> và nghĩa tiếng Việt.</p>
              </div>
            </div>
            <div className="syntax-rule-item">
              <span className="rule-num">2</span>
              <div>
                <strong>Loại từ đặt trong ngoặc đơn ( )</strong>
                <p>Nằm cạnh từ vựng: <code>(v)</code>, <code>(n)</code>, <code>(adj)</code>, <code>(adv)</code>, <code>(phr v)</code>...</p>
              </div>
            </div>
            <div className="syntax-rule-item">
              <span className="rule-num">3</span>
              <div>
                <strong>Không bắt buộc dấu hai chấm</strong>
                <p>Hệ thống tự động nhận diện cả dạng có dấu hai chấm <code>:</code>, dấu gạch ngang <code>-</code> hoặc khoảng cách cột giữa từ và nghĩa.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="format-guide-grid">
          {/* Real Examples */}
          <div className="format-card">
            <div className="format-card-title">
              <Sparkles size={18} />
              <span>Ví dụ văn bản chuẩn trong PDF</span>
            </div>
            <p className="format-card-desc">Hệ thống hỗ trợ cả định dạng giáo trình có phiên âm và định dạng rút gọn:</p>
            <div className="code-example-box">
              <pre>
{`// Dạng 1: Giáo trình tiếng Anh chuẩn (như New Close Up)
1. diving (n) /ˈdaɪvɪŋ/ Sự lặn
2. festival (n) /ˈfestɪvl/ Lễ hội, ngày hội
3. creative (adj) /kriˈeɪtɪv/ Sáng tạo
4. look out for (phr v) /lʊk aʊt fə/ Chú ý, để mắt
5. honest (adj) /ˈɒnɪst/ Trung thực, thật thà

// Dạng 2: Soạn thảo nhanh (có dấu hai chấm hoặc gạch ngang)
new (adj): mới, mới mẻ
quiet (adj) - yên tĩnh, thanh bình
journey (n): chuyến đi, hành trình
improve (v): cải thiện, trau dồi
carefully (adv): một cách cẩn thận`}
              </pre>
            </div>
          </div>

          {/* Supported POS */}
          <div className="format-card">
            <div className="format-card-title">
              <Layers3 size={18} />
              <span>Bảng loại từ hỗ trợ trong ngoặc (...)</span>
            </div>
            <p className="format-card-desc">Hệ thống hỗ trợ cả ký hiệu quốc tế viết tắt và tên đầy đủ:</p>
            <div className="pos-reference-table-wrap">
              <table className="pos-reference-table">
                <thead>
                  <tr>
                    <th>Ký hiệu</th>
                    <th>Loại từ</th>
                    <th>Tên viết tắt khác</th>
                  </tr>
                </thead>
                <tbody>
                  {POS_GUIDE_ITEMS.map((item) => (
                    <tr key={item.code}>
                      <td><span className="pos-chip">{`(${item.code})`}</span></td>
                      <td><b>{item.name}</b></td>
                      <td><code>{item.aliases}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="format-notes-card">
          <div className="format-card-title">
            <CircleAlert size={18} />
            <span>Lưu ý quan trọng khi chuẩn bị file PDF</span>
          </div>
          <ul className="format-notes-list">
            <li><strong>PDF dạng văn bản (text-based):</strong> File phải được xuất trực tiếp từ Word, Google Docs hoặc LibreOffice. <em>Không dùng file chụp ảnh hoặc file scan hình ảnh</em> vì hệ thống đọc văn bản trực tiếp.</li>
            <li><strong>Hỗ trợ nhiều trang:</strong> Bạn có thể đưa file PDF 1 trang hoặc nhiều trang, hệ thống sẽ tự động lọc bỏ các dòng thừa (tiêu đề, số trang) và chỉ lấy các dòng khớp mẫu.</li>
            <li><strong>Nhiều nghĩa tiếng Việt:</strong> Nếu một từ có nhiều nghĩa, hãy ngăn cách bằng dấu phẩy, ví dụ: <code>brilliant(adj): thông minh, sáng dạ, rực rỡ</code>.</li>
            <li><strong>Kiểm tra trước khi lưu:</strong> Sau khi tải file lên, bạn sẽ được xem lại toàn bộ từ vựng đã nhận diện, sửa tên bộ từ, chọn thể loại kiểm tra (Điền từ / Trắc nghiệm) và mở/khóa quyền cho từng lớp trước khi lưu vào hệ thống.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function DeckLockSettings({
  lockAt,
  lockAtByClass,
  availableClasses = [],
  unlockedClasses = null,
  onChangeLockAt,
  disabled,
}) {
  const lockMap = useMemo(() => {
    if (lockAtByClass && typeof lockAtByClass === "object") {
      return { ...lockAtByClass };
    }
    if (lockAt) {
      return { all: lockAt };
    }
    return {};
  }, [lockAt, lockAtByClass]);

  const allClassOptions = useMemo(() => {
    const set = new Set(availableClasses);
    if (Array.isArray(unlockedClasses)) {
      for (const c of unlockedClasses) {
        if (c && c !== "*") set.add(c);
      }
    }
    for (const k of Object.keys(lockMap)) {
      if (k !== "all" && k) set.add(k);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));
  }, [availableClasses, unlockedClasses, lockMap]);

  const [selectedClass, setSelectedClass] = useState("all");

  const currentClassLockAt = selectedClass === "all" ? (lockMap.all || null) : (lockMap[selectedClass] || null);

  const [inputValue, setInputValue] = useState(() => {
    if (!currentClassLockAt) return "";
    try {
      const d = new Date(currentClassLockAt);
      if (isNaN(d.getTime())) return "";
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const val = selectedClass === "all" ? (lockMap.all || null) : (lockMap[selectedClass] || null);
    if (!val) {
      setInputValue("");
      return;
    }
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        setInputValue("");
        return;
      }
      const pad = (n) => String(n).padStart(2, "0");
      setInputValue(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } catch {
      setInputValue("");
    }
  }, [selectedClass, lockMap]);

  const isLocked = Boolean(currentClassLockAt && Date.now() > new Date(currentClassLockAt).getTime());
  const hasLock = Boolean(currentClassLockAt);

  function handleApply() {
    const nextMap = { ...lockMap };
    if (!inputValue) {
      if (selectedClass === "all") delete nextMap.all;
      else delete nextMap[selectedClass];
      onChangeLockAt(Object.keys(nextMap).length > 0 ? nextMap : null);
      return;
    }
    const d = new Date(inputValue);
    if (!isNaN(d.getTime())) {
      if (selectedClass === "all") nextMap.all = d.toISOString();
      else nextMap[selectedClass] = d.toISOString();
      onChangeLockAt(nextMap);
    }
  }

  function handleClear() {
    setInputValue("");
    const nextMap = { ...lockMap };
    if (selectedClass === "all") delete nextMap.all;
    else delete nextMap[selectedClass];
    onChangeLockAt(Object.keys(nextMap).length > 0 ? nextMap : null);
  }

  function handlePreset(type) {
    const now = new Date();
    const target = new Date();
    if (type === "tonight") {
      target.setHours(23, 59, 0, 0);
    } else if (type === "plus1day") {
      target.setDate(now.getDate() + 1);
      target.setHours(23, 59, 0, 0);
    } else if (type === "plus3days") {
      target.setDate(now.getDate() + 3);
      target.setHours(23, 59, 0, 0);
    } else if (type === "plus1week") {
      target.setDate(now.getDate() + 7);
      target.setHours(23, 59, 0, 0);
    }
    const pad = (n) => String(n).padStart(2, "0");
    const formatted = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
    setInputValue(formatted);
    const nextMap = { ...lockMap };
    if (selectedClass === "all") nextMap.all = target.toISOString();
    else nextMap[selectedClass] = target.toISOString();
    onChangeLockAt(nextMap);
  }

  return (
    <div className="deck-lock-settings-card">
      <div className="lock-status-row">
        <span className={`lock-badge-pill ${!hasLock ? "open" : isLocked ? "expired" : "active"}`}>
          {isLocked ? <Lock size={15} /> : <Clock size={15} />}
          <span>
            {selectedClass === "all" ? "Tất cả các lớp: " : `Lớp ${selectedClass}: `}
            {!hasLock
              ? selectedClass !== "all" && lockMap.all
                ? `Không đặt riêng (dùng hạn chung: ${formatLockDateTime(lockMap.all)})`
                : "Không giới hạn thời gian (luôn mở)"
              : isLocked
              ? `Đã hết hạn khóa bài (${formatLockDateTime(currentClassLockAt)})`
              : `Đang mở - Sẽ khóa lúc: ${formatLockDateTime(currentClassLockAt)}`}
          </span>
        </span>
      </div>

      <div className="lock-input-group">
        <label htmlFor="deck-lock-datetime">
          Chọn ngày & giờ tự động khóa bài cho {selectedClass === "all" ? "tất cả các lớp" : `lớp ${selectedClass}`}:
        </label>
        <div className="lock-input-row">
          <div className="lock-datetime-controls">
            <input
              id="deck-lock-datetime"
              type="datetime-local"
              className="datetime-picker-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={disabled}
            />
            <button
              type="button"
              className="primary-button compact"
              onClick={handleApply}
              disabled={disabled || (!inputValue && !currentClassLockAt)}
            >
              <Check size={16} /> Lưu giờ khóa
            </button>
            {hasLock && (
              <button
                type="button"
                className="secondary-button compact"
                onClick={handleClear}
                disabled={disabled}
                title={selectedClass === "all" ? "Xóa hạn chung cho tất cả lớp" : `Xóa hạn riêng cho lớp ${selectedClass}`}
              >
                Mở vĩnh viễn
              </button>
            )}
          </div>

          {/* Ô Lớp ở khoảng trống bên phải theo đúng yêu cầu */}
          <div className="lock-class-field">
            <label htmlFor="deck-lock-class-select" className="lock-class-label">
              <Users size={16} />
              <span>Lớp:</span>
            </label>
            <select
              id="deck-lock-class-select"
              className="lock-class-select"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={disabled}
            >
              <option value="all">Tất cả các lớp (Chung)</option>
              {allClassOptions.map((cls) => {
                const hasCustom = Boolean(lockMap[cls]);
                return (
                  <option key={cls} value={cls}>
                    Lớp {cls} {hasCustom ? "⏳ (Đã hẹn)" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      <div className="lock-presets-row">
        <span className="preset-label">
          Hẹn giờ nhanh cho {selectedClass === "all" ? "Tất cả các lớp" : `Lớp ${selectedClass}`}:
        </span>
        <button
          type="button"
          className="preset-btn"
          onClick={() => handlePreset("tonight")}
          disabled={disabled}
        >
          23:59 hôm nay
        </button>
        <button
          type="button"
          className="preset-btn"
          onClick={() => handlePreset("plus1day")}
          disabled={disabled}
        >
          +1 ngày (23:59)
        </button>
        <button
          type="button"
          className="preset-btn"
          onClick={() => handlePreset("plus3days")}
          disabled={disabled}
        >
          +3 ngày
        </button>
        <button
          type="button"
          className="preset-btn"
          onClick={() => handlePreset("plus1week")}
          disabled={disabled}
        >
          +1 tuần
        </button>
      </div>

      {Object.keys(lockMap).length > 0 && (
        <div className="lock-classes-summary-row">
          <span className="summary-label">Danh sách hẹn giờ theo lớp:</span>
          <div className="summary-chips">
            {lockMap.all && (
              <button
                type="button"
                className={`summary-chip ${selectedClass === "all" ? "active" : ""}`}
                onClick={() => setSelectedClass("all")}
                title="Bấm để chỉnh sửa hạn chung"
              >
                <span>Tất cả:</span>
                <b>{formatLockDateTime(lockMap.all)}</b>
              </button>
            )}
            {allClassOptions.map((cls) => {
              if (!lockMap[cls]) return null;
              return (
                <button
                  key={cls}
                  type="button"
                  className={`summary-chip ${selectedClass === cls ? "active" : ""}`}
                  onClick={() => setSelectedClass(cls)}
                  title={`Bấm để chỉnh sửa hạn lớp ${cls}`}
                >
                  <span>Lớp {cls}:</span>
                  <b>{formatLockDateTime(lockMap[cls])}</b>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DeckMaxAttemptsSettings({ maxAttempts, onChange, disabled }) {
  const [customValue, setCustomValue] = useState("");

  const options = [
    { value: null, title: "Không giới hạn", desc: "Học sinh có thể luyện tự do nhiều lần" },
    { value: 1, title: "1 lần duy nhất", desc: "Kiểm tra nghiêm ngặt (chỉ làm 1 lần)" },
    { value: 2, title: "2 lần", desc: "Tối đa 2 lượt làm bài" },
    { value: 3, title: "3 lần", desc: "Tối đa 3 lượt làm bài" },
    { value: 5, title: "5 lần", desc: "Tối đa 5 lượt làm bài" },
  ];

  const currentVal = maxAttempts && Number(maxAttempts) > 0 ? Number(maxAttempts) : null;
  const isCustom = currentVal !== null && !options.some((opt) => opt.value === currentVal);

  return (
    <div className="max-attempts-settings">
      <div className="attempts-quick-grid">
        {options.map((opt) => {
          const isSelected = opt.value === currentVal;
          return (
            <button
              key={String(opt.value)}
              type="button"
              className={`attempt-opt-card ${isSelected ? "active" : ""}`}
              onClick={() => {
                setCustomValue("");
                onChange(opt.value);
              }}
              disabled={disabled}
            >
              <div className="opt-card-header">
                <b>{opt.title}</b>
                {isSelected && <Check size={16} />}
              </div>
              <small>{opt.desc}</small>
            </button>
          );
        })}
      </div>
      <div className="custom-attempts-inline">
        <label htmlFor="custom-attempt-input">Hoặc số lần khác:</label>
        <div className="custom-input-group">
          <input
            id="custom-attempt-input"
            type="number"
            min="1"
            max="100"
            className="title-input custom-attempts-input"
            placeholder="Nhập số lần (VD: 4, 10...)"
            value={customValue || (isCustom ? String(currentVal) : "")}
            onChange={(e) => setCustomValue(e.target.value)}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const n = parseInt(customValue, 10);
                if (n > 0) onChange(n);
              }
            }}
          />
          <button
            type="button"
            className="secondary-button compact"
            onClick={() => {
              const n = parseInt(customValue, 10);
              if (n > 0) onChange(n);
            }}
            disabled={disabled || !customValue || parseInt(customValue, 10) <= 0}
          >
            Lưu số lần
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeView({
  deck,
  sessions = [],
  account,
  canManage,
  availableClasses = [],
  isImporting,
  isUpdatingMode,
  isUpdatingAccess,
  isUpdatingLockAt,
  isUpdatingMaxAttempts,
  isUpdatingTimeLimit,
  isUpdatingExamMode,
  isUpdatingShuffle,
  isDeletingDeck,
  importProgress,
  onPickPdf,
  onStart,
  onModeChange,
  onClassAccessChange,
  onLockAtChange,
  onMaxAttemptsChange,
  onTimeLimitChange,
  onExamModeChange,
  onShuffleChange,
  onDeleteDeck,
  onEditDeck,
  onFlashcard,
  onPracticeMistakes,
  savedMistakesCount = 0,
  onNavigateCreateDeck,
}) {
  const posCounts = useMemo(() => {
    const counts = {};
    for (const word of deck.words) counts[word.partOfSpeech] = (counts[word.partOfSpeech] || 0) + 1;
    return Object.entries(counts);
  }, [deck]);
  const assignedMode = PRACTICE_MODES.find((mode) => mode.id === deck.practiceMode) || PRACTICE_MODES[0];
  const AssignedIcon = assignedMode.icon;
  const isLockedForMe = isDeckLockedForStudent(deck, account);
  const studentDeadline = getDeckLockAtForStudent(deck, account);
  const isExpired = Boolean(studentDeadline && Date.now() > new Date(studentDeadline).getTime());
  const studentAttempts = (sessions || []).filter((s) => s.deck_id === deck.id).length;
  const isAttemptsExhausted = isDeckAttemptsExhausted(deck, account, sessions);

  return (
    <div className="home-view">
      <div className="mobile-deck-label">Bộ từ đang chọn</div>
      <div className="home-head">
        <div>
          <div className="eyebrow">{canManage ? "Thiết lập bài tập" : "Bài giáo viên đã giao"}</div>
          <h1>{deck.title}</h1>
          <p>{deck.sourceFileName || "Bộ từ vựng của lớp"}</p>
        </div>
        <div className="home-head-actions">
          {canManage && !deck.isDemo && (
            <button
              className="secondary-button compact edit-deck-action"
              type="button"
              onClick={() => onEditDeck && onEditDeck(deck)}
              title="Chỉnh sửa nội dung bộ từ (sửa tên, sửa/thêm/xóa từ)"
            >
              <Pencil size={17} />
              <span>Sửa bộ từ</span>
            </button>
          )}
          {canManage && !deck.isDemo && (
            <button className="danger-button compact delete-deck-action" type="button" onClick={() => onDeleteDeck(deck)} disabled={isDeletingDeck} title="Xóa bộ từ này">
              {isDeletingDeck ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}
              <span>Xóa bộ từ</span>
            </button>
          )}
          {canManage && (
            <button className="primary-button compact" type="button" onClick={onNavigateCreateDeck || onPickPdf} disabled={isImporting}>
              <Plus size={18} />
              <span>Tạo bộ từ mới</span>
            </button>
          )}
        </div>
      </div>

      <div className="deck-overview">
        <div className="overview-main">
          <span className="overview-icon"><BookOpen size={28} /></span>
          <div>
            <strong>{deck.words.length}</strong>
            <span>{canManage ? "từ trong bộ này" : "từ cần hoàn thành"}</span>
          </div>
        </div>
        {!canManage && (
          <div className="overview-practice-stat">
            <span className="overview-icon practice-icon"><RotateCcw size={22} /></span>
            <div>
              <strong>
                {studentAttempts}{deck.maxAttempts ? ` / ${deck.maxAttempts}` : ""} <small>lần</small>
              </strong>
              <span>{deck.maxAttempts ? "lượt làm bài đã dùng" : "số lần đã luyện"}</span>
            </div>
          </div>
        )}
        <div className="pos-cloud">{posCounts.map(([pos, count]) => <span key={pos}>{POS_LABELS[pos]} <b>{count}</b></span>)}</div>
      </div>

      {canManage ? (
        <>
          <section className="assignment-panel">
            <div className="section-title-row">
              <div><span className="eyebrow">Thể loại làm bài</span><h2>Giáo viên chọn cho học sinh</h2></div>
              {isUpdatingMode && <span className="points-rule"><LoaderCircle className="spin" size={15} /> Đang lưu…</span>}
            </div>
            <div className="mode-selector" role="group" aria-label="Chọn thể loại làm bài">
              {PRACTICE_MODES.map((mode) => {
                const Icon = mode.icon;
                const selected = assignedMode.id === mode.id;
                return (
                  <button key={mode.id} className={selected ? "active" : ""} type="button" aria-pressed={selected} onClick={() => onModeChange(mode.id)} disabled={isUpdatingMode}>
                    <span><Icon size={21} /></span>
                    <span><b>{mode.title}</b><small>{mode.description}</small></span>
                    {selected && <Check size={19} />}
                  </button>
                );
              })}
            </div>
          </section>

          {!deck.isDemo && (
            <>
              <section className="assignment-panel">
                <div className="section-title-row">
                  <div>
                    <span className="eyebrow">Thời hạn làm bài</span>
                    <h2>Cài đặt ngày & giờ khóa bài tự động</h2>
                  </div>
                  {isUpdatingLockAt && <span className="points-rule"><LoaderCircle className="spin" size={15} /> Đang lưu…</span>}
                </div>
                <DeckLockSettings
                  lockAt={deck.lockAt}
                  lockAtByClass={deck.lockAtByClass}
                  availableClasses={availableClasses}
                  unlockedClasses={deck.unlockedClasses}
                  onChangeLockAt={onLockAtChange}
                  disabled={isUpdatingLockAt}
                />
              </section>

              <section className="assignment-panel">
                <div className="section-title-row">
                  <div>
                    <span className="eyebrow">Số lần làm bài</span>
                    <h2>Cài đặt số lần luyện cho bài kiểm tra</h2>
                  </div>
                  {isUpdatingMaxAttempts && <span className="points-rule"><LoaderCircle className="spin" size={15} /> Đang lưu…</span>}
                </div>
                <DeckMaxAttemptsSettings
                  maxAttempts={deck.maxAttempts}
                  onChange={onMaxAttemptsChange}
                  disabled={isUpdatingMaxAttempts}
                />
              </section>

              <section className="assignment-panel">
                <DeckExamModeSettings
                  isExamMode={deck.isExamMode}
                  onChange={(val) => onExamModeChange(deck.id, val)}
                  disabled={isUpdatingExamMode}
                />
              </section>

              <section className="assignment-panel">
                <DeckTimeLimitSettings
                  timeLimitMinutes={deck.timeLimitMinutes}
                  onChange={(val) => onTimeLimitChange(deck.id, val)}
                  disabled={isUpdatingTimeLimit}
                />
              </section>

              <section className="assignment-panel">
                <DeckShuffleSettings
                  shuffleQuestions={deck.shuffleQuestions}
                  onChange={(val) => onShuffleChange && onShuffleChange(deck.id, val)}
                  disabled={isUpdatingShuffle}
                />
              </section>

              <section className="assignment-panel">
                <div className="section-title-row">
                  <div><span className="eyebrow">Quyền học theo lớp</span><h2>Mở / Khóa bài tập cho từng lớp</h2></div>
                  {isUpdatingAccess && <span className="points-rule"><LoaderCircle className="spin" size={15} /> Đang lưu…</span>}
                </div>
                <ClassAccessControl
                  availableClasses={availableClasses}
                  unlockedClasses={deck.unlockedClasses ?? null}
                  onChange={onClassAccessChange}
                  disabled={isUpdatingAccess}
                />
              </section>
            </>
          )}

          <button className="drop-zone" type="button" onClick={onNavigateCreateDeck || onPickPdf}>
            <span><FileText size={21} /></span>
            <span><b>Tạo bộ từ mới từ PDF</b><small>Chuyển sang tab Tạo bộ từ để xem hướng dẫn định dạng file và tải lên</small></span>
            <span className="drop-action">Tạo bộ từ →</span>
          </button>
        </>
      ) : isLockedForMe ? (
        <div className="deck-locked-container">
          <div className="deck-locked-badge"><Lock size={28} /></div>
          <div className="deck-locked-content">
            <div className="eyebrow">{isExpired ? "Bài tập đã hết hạn" : "Bộ từ đang tạm khóa"}</div>
            <h2>
              {isExpired
                ? `Thời hạn làm bài đã kết thúc (${formatLockDateTime(studentDeadline)})`
                : `Bài tập chưa mở cho lớp ${account?.className || "của bạn"}`}
            </h2>
            <p>
              {isExpired
                ? "Giáo viên đã cài đặt thời hạn cho bài tập này đối với lớp của bạn và hiện tại bài đã bị khóa. Vui lòng liên hệ giáo viên nếu bạn cần gia hạn làm bù."
                : "Giáo viên đang khóa bộ từ này đối với lớp của bạn. Hãy liên hệ với giáo viên để được mở quyền vào làm bài."}
            </p>
          </div>
        </div>
      ) : isAttemptsExhausted ? (
        <div className="deck-locked-container attempts-exhausted">
          <div className="deck-locked-badge"><Lock size={28} /></div>
          <div className="deck-locked-content">
            <div className="eyebrow">Đã hoàn thành bài kiểm tra</div>
            <h2>Bạn đã hết số lần làm bài cho phép ({studentAttempts}/{deck.maxAttempts} lần)</h2>
            <p>
              Giáo viên đã cài đặt giới hạn số lần làm bài cho bài kiểm tra này là {deck.maxAttempts} lần. Bạn đã hoàn thành bài thi và điểm số của bạn đã được ghi nhận vào hệ thống.
            </p>
          </div>
        </div>
      ) : (
        <>
          {deck.maxAttempts && (
            <div className="attempts-notice-banner">
              <RotateCcw size={16} />
              <span>
                Bài kiểm tra này giới hạn: <b>{deck.maxAttempts} lần</b> làm bài (Bạn đã làm <b>{studentAttempts}/{deck.maxAttempts}</b> lần, còn <b>{Math.max(0, deck.maxAttempts - studentAttempts)}</b> lượt).
              </span>
            </div>
          )}
          {studentDeadline && (
            <div className="deadline-notice-banner">
              <Clock size={16} />
              <span>
                Hạn chót nộp bài {account?.className ? `(Lớp ${account.className})` : ""}: <b>{formatLockDateTime(studentDeadline)}</b>. Vui lòng hoàn thành trước thời gian này.
              </span>
            </div>
          )}

          <div className="study-prep-box">
            <button className="prep-action-card flashcard-prep" type="button" onClick={onFlashcard}>
              <div className="prep-icon"><Layers3 size={24} /></div>
              <div className="prep-text">
                <strong>Lật thẻ Flashcard (Ôn tập)</strong>
                <span>Lướt qua từ vựng & nghe phát âm trước khi thi (Tự do, không trừ điểm)</span>
              </div>
              <ChevronRight size={18} />
            </button>
            {savedMistakesCount > 0 && (
              <button className="prep-action-card mistakes-prep" type="button" onClick={onPracticeMistakes}>
                <div className="prep-icon"><AlertTriangle size={24} /></div>
                <div className="prep-text">
                  <strong>Ôn lại {savedMistakesCount} từ hay sai</strong>
                  <span>Luyện tập riêng các từ bạn từng làm chưa đúng ở bài kiểm tra này</span>
                </div>
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          <div className="section-title-row">
            <div>
              <span className="eyebrow">{deck.isExamMode !== false ? "Bài kiểm tra chính thức" : "Bài luyện tập"}</span>
              <h2>{assignedMode.title}</h2>
            </div>
            <span className="points-rule">
              {deck.isExamMode !== false
                ? "Đúng +10 · Sai lần 1: −25% · Sai lần 2: −75% · Thoát màn hình: −25% / −75%"
                : "Luyện tập tự do · Không trừ điểm vi phạm"}
            </span>
          </div>
          <button className={`mode-card assigned-mode-card ${assignedMode.accent}`} type="button" onClick={onStart}>
            <span className="mode-icon"><AssignedIcon size={25} /></span>
            <span className="mode-copy">
              <b>{deck.isExamMode !== false ? `Bắt đầu ${assignedMode.title.toLowerCase()} (Kiểm tra)` : `Bắt đầu ${assignedMode.title.toLowerCase()} (Luyện tập)`}</b>
              <small>
                {deck.isExamMode !== false
                  ? `${assignedMode.description}. Bài sẽ tự chuyển sang toàn màn hình${deck.timeLimitMinutes ? ` · Giới hạn ${deck.timeLimitMinutes} phút` : ""}.`
                  : `${assignedMode.description}. Chế độ luyện tập tự do không tính vi phạm.`}
              </small>
            </span>
            <ChevronRight className="mode-arrow" size={21} />
          </button>
        </>
      )}
    </div>
  );
}

function ImportView({ draft, availableClasses = [], isSaving, connection, onBack, onChangeTitle, onChangePracticeMode, onChangeUnlockedClasses, onChangeMaxAttempts, onRemoveWord, onSave }) {
  return (
    <div className="import-view">
      <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={18} /> Quay lại</button>
      <div className="import-head">
        <div><div className="eyebrow">Xem lại trước khi lưu</div><h1>Đã nhận diện {draft.words.length} từ</h1><p>{draft.fileName} · {draft.pageCount} trang</p></div>
        <div className="parse-badge"><Check size={18} /> Đọc PDF thành công</div>
      </div>
      <label className="field-label" htmlFor="deck-title">Tên bộ từ</label>
      <input id="deck-title" className="title-input" value={draft.title} maxLength={120} onChange={(event) => onChangeTitle(event.target.value)} />

      <div className="import-mode-section">
        <div><span className="field-label">Thể loại giao cho học sinh</span><p>Học sinh sẽ làm bài theo thể loại giáo viên chọn (vẫn chọn 2 chế độ như thường).</p></div>
        <div className="mode-selector compact" role="group" aria-label="Thể loại giao cho học sinh">
          {PRACTICE_MODES.map((mode) => {
            const Icon = mode.icon;
            const selected = draft.practiceMode === mode.id;
            return <button key={mode.id} className={selected ? "active" : ""} type="button" aria-pressed={selected} onClick={() => onChangePracticeMode(mode.id)}><span><Icon size={19} /></span><span><b>{mode.title}</b></span>{selected && <Check size={17} />}</button>;
          })}
        </div>
      </div>

      <div className="import-attempts-section">
        <div><span className="field-label">Số lần luyện / làm bài cho phép</span><p>Cài đặt số lần làm bài tối đa cho mỗi học sinh ở bài kiểm tra này.</p></div>
        <DeckMaxAttemptsSettings
          maxAttempts={draft.maxAttempts}
          onChange={onChangeMaxAttempts}
          disabled={isSaving}
        />
      </div>

      <ClassAccessControl
        availableClasses={availableClasses}
        unlockedClasses={draft.unlockedClasses ?? null}
        onChange={onChangeUnlockedClasses}
        disabled={isSaving}
      />

      <div className="word-table-head"><span>Từ</span><span>Loại từ</span><span>Nghĩa</span><span /></div>
      <div className="word-table">
        {draft.words.map((word) => (
          <div className="word-row" key={word.id}>
            <strong>{word.term}</strong><span className="pos-chip">{word.partOfSpeech.toUpperCase()}</span><span>{word.meaning}</span>
            <button type="button" onClick={() => onRemoveWord(word.id)} aria-label={`Xóa từ ${word.term}`}><Trash2 size={17} /></button>
          </div>
        ))}
      </div>
      {draft.rejected.length > 0 && <p className="parse-note"><CircleAlert size={16} /> Có {draft.rejected.length} dòng gần giống nhưng chưa đúng định dạng nên được bỏ qua.</p>}
      <div className="import-actions">
        <p>{connection === "connected" ? "Bộ từ sẽ được lưu vào Supabase." : "Bạn đang xem thử; thêm biến môi trường Supabase để lưu lâu dài."}</p>
        <div><button className="secondary-button" type="button" onClick={onBack}>Hủy</button><button className="primary-button" type="button" onClick={onSave} disabled={isSaving || !draft.words.length || !draft.title.trim()}>{isSaving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{isSaving ? "Đang lưu…" : `Lưu ${draft.words.length} từ`}</button></div>
      </div>
    </div>
  );
}

export function StudyView({ study, currentWord, quizChoices, wordFamilyChoices, typingInputRef, isFullscreen, onBack, onFullscreen, onAnswer, onInput, onTypingSubmit, onTimeUp }) {
  const [secondsLeft, setSecondsLeft] = useState(study.timeLimitSeconds || null);
  const [showMeaningHint, setShowMeaningHint] = useState(false);
  const [replaysLeft, setReplaysLeft] = useState(2);

  useEffect(() => {
    setShowMeaningHint(false);
    setReplaysLeft(2);
  }, [study.index]);

  const handleReplay = (options = { rate: 0.9 }) => {
    if (replaysLeft <= 0) return;
    setReplaysLeft((prev) => Math.max(0, prev - 1));
    speakWord(currentWord.term, options);
  };

  useEffect(() => {
    if (!study.timeLimitSeconds) return undefined;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          if (onTimeUp) onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [study.timeLimitSeconds, onTimeUp]);

  const formatTimer = (secs) => {
    if (secs === null) return "";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const progress = ((study.index + 1) / study.items.length) * 100;
  const resultClass = study.feedback ? `feedback-${study.feedback}` : "";
  const assignedMode = PRACTICE_MODES.find((mode) => mode.id === study.mode) || PRACTICE_MODES[0];
  const AssignedIcon = assignedMode.icon;

  return (
    <div className={`study-view ${resultClass} ${study.isExamMode !== false ? "is-exam-lockdown" : ""}`}>
      <div className="study-head">
        <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={18} /> Rời phiên</button>
        <div className="study-title">
          <div className="eyebrow">{String(study.index + 1).padStart(2, "0")} / {String(study.items.length).padStart(2, "0")}</div>
          <h1>{study.deckTitle}</h1>
        </div>
        <div className="study-head-metrics">
          {secondsLeft !== null && (
            <div className={`countdown-timer ${secondsLeft < 60 ? "is-urgent" : ""}`} title="Thời gian làm bài còn lại">
              <Timer size={17} />
              <span>{formatTimer(secondsLeft)}</span>
            </div>
          )}
          <div className="session-points"><Sparkles size={18} /><span>Điểm phiên</span><strong>{study.score}</strong></div>
        </div>
      </div>
      <div className="progress-line"><span style={{ width: `${progress}%` }} /></div>
      <div className="assigned-study-mode"><AssignedIcon size={18} /><span>Giáo viên đã giao</span><strong>{assignedMode.title}</strong></div>

      {study.isExamMode !== false ? (
        !isFullscreen && (
          <div className={`fullscreen-violation-alert ${study.violationCount > 0 ? "is-violated" : ""}`}>
            <div className="alert-content">
              <div className="alert-icon-wrap">
                <CircleAlert size={22} />
              </div>
              <div className="alert-text">
                <strong>
                  {study.violationCount > 0
                    ? `⚠️ Cảnh báo vi phạm: Đã phạm lỗi ${study.violationCount} lần!`
                    : "⚠️ Yêu cầu bật toàn màn hình khi làm bài"}
                </strong>
                <p>
                  {study.violationCount > 0
                    ? `Bạn đã bị trừ ${study.violationCount === 1 ? "25%" : "75%"} điểm. Hãy bấm ô bên cạnh để bật lại toàn màn hình ngay.`
                    : "Thoát toàn màn hình khi làm bài: lần đầu trừ 25% điểm, lần hai trừ 75% điểm, lần ba hủy bài thi (0 điểm)."}
                </p>
              </div>
            </div>
            <button className="enable-fullscreen-btn" type="button" onClick={onFullscreen}>
              <Maximize2 size={18} />
              <span>Bật toàn màn hình</span>
            </button>
          </div>
        )
      ) : (
        <div className="practice-mode-indicator">
          <BookOpen size={16} />
          <span>🌿 Chế độ luyện tập tự do (Không bắt buộc toàn màn hình, không trừ điểm vi phạm)</span>
        </div>
      )}

      {study.mode === "typing" && (
        <div className="exercise-card">
          <div className="card-meta">
            <span className="pos-chip">{POS_LABELS[currentWord.partOfSpeech]}</span>
            <span>Gõ từ tiếng Anh</span>
            {study.wordMistakes === 1 && (
              <span className="attempt-badge">⚠️ Sai lần 1 (−25% điểm câu này)</span>
            )}
            {study.wordMistakes === 2 && (
              <span className="attempt-badge">⚠️ Sai lần 2 (−75% điểm câu này)</span>
            )}
          </div>
          <div className="prompt-label">Từ nào có nghĩa là</div>
          <div className="meaning-prompt">{currentWord.meaning}</div>
          <form className="typing-form" onSubmit={onTypingSubmit}>
            <input
              ref={typingInputRef}
              value={study.input}
              onChange={(event) => onInput(event.target.value)}
              placeholder="Nhập từ vựng…"
              autoComplete="off"
              spellCheck="false"
              disabled={Boolean(study.feedback === "correct" || study.feedback === "wrong-final")}
              aria-label="Nhập từ tiếng Anh"
            />
            <button type="submit" disabled={!study.input?.trim() || Boolean(study.feedback)}>Kiểm tra <kbd>Enter</kbd></button>
          </form>
          {study.feedback === "wrong-final" && (
            <div className="correct-answer">
              <span>Đáp án: <strong>{currentWord.term}</strong></span>
              <button type="button" className="speak-answer-btn" onClick={() => speakWord(currentWord.term)} title="Nghe phát âm">
                <Volume2 size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {study.mode === "quiz" && (
        <div className="exercise-card quiz-card">
          <div className="card-meta">
            <span className="pos-chip">{POS_LABELS[currentWord.partOfSpeech]}</span>
            <span>Chọn từ đúng</span>
            {study.wordMistakes === 1 && (
              <span className="attempt-badge">⚠️ Sai lần 1 (−25% điểm câu này)</span>
            )}
            {study.wordMistakes === 2 && (
              <span className="attempt-badge">⚠️ Sai lần 2 (−75% điểm câu này)</span>
            )}
          </div>
          <div className="prompt-label">Từ nào có nghĩa là</div>
          <div className="meaning-prompt">{currentWord.meaning}</div>
          <div className="quiz-grid">
            {quizChoices.map((choice, index) => {
              const isCorrect = choice === currentWord.term;
              const isEliminated = (study.disabledChoices || []).includes(choice);
              let className = "";
              if (study.feedback === "correct" && isCorrect) {
                className = "correct-choice";
              } else if (study.feedback === "wrong-final") {
                className = isCorrect ? "correct-choice" : "muted-choice";
              } else if (isEliminated) {
                className = "muted-choice disabled-choice";
              }
              return (
                <button
                  key={choice}
                  className={className}
                  type="button"
                  onClick={() => onAnswer(isCorrect, choice)}
                  disabled={Boolean(study.feedback) || isEliminated}
                >
                  <kbd>{index + 1}</kbd>
                  <span>{choice}</span>
                  {study.feedback && isCorrect && <Check size={18} />}
                  {isEliminated && <X size={16} />}
                </button>
              );
            })}
          </div>
          <p className="same-pos-note">Các đáp án nhiễu được chọn ngẫu nhiên từ cùng loại từ <b>{currentWord.partOfSpeech}</b>.</p>
        </div>
      )}

      {study.mode === "listening" && (
        <div className="exercise-card listening-card">
          <div className="card-meta">
            <span className="pos-chip">{POS_LABELS[currentWord.partOfSpeech]}</span>
            <span>Luyện nghe phát âm & Gõ chính tả</span>
            {study.wordMistakes === 1 && (
              <span className="attempt-badge">⚠️ Sai lần 1 (−25% điểm câu này)</span>
            )}
            {study.wordMistakes === 2 && (
              <span className="attempt-badge">⚠️ Sai lần 2 (−75% điểm câu này)</span>
            )}
          </div>

          <div className="audio-control-cluster">
            <button
              type="button"
              className="big-speaker-btn"
              onClick={() => speakWord(currentWord.term, { rate: 0.9 })}
              title="Bấm để nghe phát âm từ vựng chuẩn"
            >
              <Volume2 size={38} />
              <span>Nghe phát âm chuẩn</span>
            </button>
            <div className="audio-sub-actions">
              <button
                type="button"
                className="slow-speaker-btn"
                onClick={() => speakWord(currentWord.term, { rate: 0.72 })}
                title="Bấm để nghe chậm hơn (tốc độ 0.75x)"
              >
                <Volume2 size={16} />
                <span>Nghe chậm (0.75x)</span>
              </button>
              <button
                type="button"
                className={`hint-toggle-btn ${showMeaningHint ? "active" : ""}`}
                onClick={() => setShowMeaningHint((prev) => !prev)}
                title="Bấm để xem hoặc ẩn gợi ý nghĩa tiếng Việt"
              >
                <span>{showMeaningHint ? "Ẩn gợi ý nghĩa" : "Xem gợi ý nghĩa"}</span>
              </button>
            </div>
          </div>

          {showMeaningHint && (
            <div className="listening-hint-box">
              <span className="hint-label">Gợi ý nghĩa:</span>
              <strong>{currentWord.meaning}</strong>
            </div>
          )}

          <form className="typing-form" onSubmit={onTypingSubmit}>
            <input
              ref={typingInputRef}
              value={study.input}
              onChange={(event) => onInput(event.target.value)}
              placeholder="Nghe và gõ lại từ tiếng Anh…"
              autoComplete="off"
              spellCheck="false"
              disabled={Boolean(study.feedback === "correct" || study.feedback === "wrong-final")}
              aria-label="Nghe và gõ lại từ tiếng Anh"
            />
            <button type="submit" disabled={!study.input?.trim() || Boolean(study.feedback)}>Kiểm tra <kbd>Enter</kbd></button>
          </form>
          {study.feedback === "wrong-final" && (
            <div className="correct-answer">
              <span>Đáp án đúng: <strong>{currentWord.term}</strong> ({currentWord.meaning})</span>
              <button type="button" className="speak-answer-btn" onClick={() => speakWord(currentWord.term)} title="Nghe phát âm">
                <Volume2 size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {study.mode === "listening_pos" && (
        <div className="exercise-card listening-pos-card">
          <div className="card-meta">
            <span className="pos-chip pos-chip-family">Họ từ & Biến thể</span>
            <span>Nghe & Chọn đúng dạng từ loại</span>
            <span className={`replay-limit-badge ${replaysLeft === 0 ? "depleted" : ""}`}>
              {replaysLeft > 0 ? `🎧 Còn ${replaysLeft} lượt nghe lại` : "🚫 Hết lượt nghe lại (tối đa 2)"}
            </span>
            {study.wordMistakes === 1 && (
              <span className="attempt-badge">⚠️ Sai lần 1 (−25% điểm câu này)</span>
            )}
            {study.wordMistakes === 2 && (
              <span className="attempt-badge">⚠️ Sai lần 2 (−75% điểm câu này)</span>
            )}
          </div>

          <div className="audio-control-cluster">
            <button
              type="button"
              className="big-speaker-btn"
              onClick={() => handleReplay({ rate: 0.9 })}
              disabled={replaysLeft <= 0 || Boolean(study.feedback === "correct" || study.feedback === "wrong-final")}
              title={replaysLeft > 0 ? `Bấm để nghe phát âm từ vựng chuẩn (còn ${replaysLeft} lượt)` : "Đã hết lượt nghe lại cho câu này"}
            >
              <Volume2 size={38} />
              <span>{replaysLeft > 0 ? "Nghe lại phát âm" : "Hết lượt nghe"}</span>
            </button>
            <div className="audio-sub-actions">
              <button
                type="button"
                className="slow-speaker-btn"
                onClick={() => handleReplay({ rate: 0.72 })}
                disabled={replaysLeft <= 0 || Boolean(study.feedback === "correct" || study.feedback === "wrong-final")}
                title={replaysLeft > 0 ? `Bấm để nghe chậm hơn 0.75x (còn ${replaysLeft} lượt)` : "Đã hết lượt nghe lại cho câu này"}
              >
                <Volume2 size={16} />
                <span>Nghe chậm (0.75x)</span>
              </button>
              <button
                type="button"
                className={`hint-toggle-btn ${showMeaningHint ? "active" : ""}`}
                onClick={() => setShowMeaningHint((prev) => !prev)}
                title="Bấm để xem hoặc ẩn gợi ý nghĩa tiếng Việt"
              >
                <span>{showMeaningHint ? "Ẩn gợi ý nghĩa" : "Xem gợi ý nghĩa"}</span>
              </button>
            </div>
          </div>

          {showMeaningHint && (
            <div className="listening-hint-box">
              <span className="hint-label">Gợi ý nghĩa gốc:</span>
              <strong>{currentWord.meaning}</strong>
            </div>
          )}

          <div className="word-family-grid">
            {(wordFamilyChoices || []).map((choice, index) => {
              const isCorrect = choice.isCorrect;
              const isEliminated = (study.disabledChoices || []).includes(choice.term);
              let className = "family-choice-btn";
              if (study.feedback === "correct" && isCorrect) {
                className += " correct-choice";
              } else if (study.feedback === "wrong-final") {
                className += isCorrect ? " correct-choice" : " muted-choice";
              } else if (isEliminated) {
                className += " muted-choice disabled-choice";
              }
              return (
                <button
                  key={`${choice.term}-${choice.partOfSpeech}`}
                  className={className}
                  type="button"
                  onClick={() => onAnswer(isCorrect, choice.term)}
                  disabled={Boolean(study.feedback) || isEliminated}
                >
                  <div className="family-choice-header">
                    <kbd>{index + 1}</kbd>
                    <span className="family-pos-tag">{choice.posLabel} ({choice.partOfSpeech})</span>
                  </div>
                  <div className="family-choice-body">
                    <span className="family-choice-term">{choice.term}</span>
                    {study.feedback && isCorrect && <Check size={20} className="choice-status-icon" />}
                    {isEliminated && <X size={18} className="choice-status-icon" />}
                  </div>
                </button>
              );
            })}
          </div>

          {study.feedback === "wrong-final" && (
            <div className="correct-answer">
              <span>Đáp án đúng: <strong>{currentWord.term}</strong> ({POS_LABELS[currentWord.partOfSpeech] || currentWord.partOfSpeech}: {currentWord.meaning})</span>
              <button type="button" className="speak-answer-btn" onClick={() => speakWord(currentWord.term)} title="Nghe phát âm">
                <Volume2 size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {study.feedback && (
        <div
          className={`feedback-banner ${
            study.feedback === "correct"
              ? "correct"
              : study.feedback === "wrong-1"
              ? "warning"
              : study.feedback === "wrong-2"
              ? "warning-strong"
              : "wrong"
          }`}
          role="status"
        >
          {study.feedback === "correct" ? (
            <Check size={19} />
          ) : study.feedback === "wrong-final" ? (
            <X size={19} />
          ) : (
            <CircleAlert size={19} />
          )}
          <span>{study.feedbackMessage || (study.feedback === "correct" ? "Chính xác! +10 điểm" : "Chưa đúng")}</span>
          {study.feedback === "correct" && (
            <button
              type="button"
              className="feedback-audio-btn"
              onClick={() => speakWord(currentWord.term)}
              title="Nghe phát âm từ này"
            >
              <Volume2 size={16} />
            </button>
          )}
        </div>
      )}

      <p className="penalty-reminder-note">
        {study.isExamMode !== false
          ? "* Quy tắc tính điểm & phạm lỗi: Lần đầu phạm lỗi trừ 25% số điểm, lần hai trừ 75% số điểm, lần ba 0 điểm. Rời bài sớm hoặc thoát toàn màn hình cũng bị trừ theo quy tắc này."
          : "* Chế độ luyện tập: Bạn có thể vừa làm vừa ôn bài thoải mái mà không bị trừ điểm vi phạm toàn màn hình."}
      </p>
    </div>
  );
}

function ResultView({ result, practiceCount, maxAttempts, onAgain, onHome, onPracticeMistakes }) {
  const percentage = Math.round((result.correct / result.total) * 100);
  const violationText = formatViolationText(result);
  const hasViolation = Boolean(result.violationReason);
  const isAttemptsExhausted = Boolean(maxAttempts && practiceCount >= maxAttempts);
  const mistakeCount = result.mistakeWords?.length || 0;

  return (
    <div className="result-view">
      <div className="trophy-wrap"><Trophy size={42} /></div><div className="eyebrow">Hoàn thành phiên học</div>
      <h1>{percentage >= 80 ? "Một vòng học rất chắc!" : "Bạn đang nhớ tốt hơn rồi."}</h1><p>{result.deckTitle} · {formatMode(result.mode)}</p>
      <div className="result-score"><span>Điểm phiên</span><strong>{result.score}</strong></div>
      {hasViolation && (
        <div className="result-violation-notice">
          <CircleAlert size={20} />
          <div>
            <strong>Ghi nhận vi phạm quy chế làm bài:</strong>
            <p>{violationText}</p>
          </div>
        </div>
      )}
      <div className="result-stats">
        <div><strong>{result.correct}/{result.total}</strong><span>câu đúng</span></div>
        <div><strong>{percentage}%</strong><span>độ chính xác</span></div>
        {typeof practiceCount === "number" && (
          <div>
            <strong>
              {practiceCount || 1}{maxAttempts ? ` / ${maxAttempts}` : ""}
            </strong>
            <span>{maxAttempts ? "lượt đã làm" : "lần luyện"}</span>
          </div>
        )}
      </div>

      {mistakeCount > 0 && (
        <div className="result-mistakes-section">
          <div className="mistakes-section-title">
            <AlertTriangle size={18} />
            <span>Bạn đã làm chưa đúng <b>{mistakeCount}</b> từ trong bài kiểm tra này:</span>
          </div>
          <div className="mistakes-word-chips">
            {result.mistakeWords.map((w) => (
              <div key={w.id} className="mistake-chip">
                <div className="mistake-term">
                  <b>{w.term}</b>
                  <small>({POS_LABELS[w.partOfSpeech] || w.partOfSpeech})</small>
                  <button
                    type="button"
                    className="chip-speak-btn"
                    onClick={() => speakWord(w.term)}
                    title="Nghe phát âm"
                  >
                    <Volume2 size={13} />
                  </button>
                </div>
                <span className="mistake-meaning">{w.meaning}</span>
              </div>
            ))}
          </div>
          <button
            className="accent-button practice-mistakes-btn"
            type="button"
            onClick={() => onPracticeMistakes && onPracticeMistakes(result.mistakeWords)}
          >
            <AlertTriangle size={17} />
            <span>Ôn lại ngay {mistakeCount} từ sai này</span>
          </button>
        </div>
      )}

      {isAttemptsExhausted ? (
        <div className="attempts-exhausted-result-banner">
          <Lock size={18} />
          <span>Bạn đã hoàn thành đủ số lần làm bài cho phép ({practiceCount}/{maxAttempts} lần). Kết quả thi đã được ghi nhận.</span>
        </div>
      ) : maxAttempts ? (
        <div className="attempts-remaining-result-banner">
          <RotateCcw size={16} />
          <span>Bạn còn <b>{Math.max(0, maxAttempts - practiceCount)}</b> lượt làm lại bài kiểm tra này (Đã làm {practiceCount}/{maxAttempts} lần).</span>
        </div>
      ) : null}

      <div className="result-actions">
        <button className="secondary-button" type="button" onClick={onHome}>Về bộ từ</button>
        {!isAttemptsExhausted && (
          <button className="primary-button" type="button" onClick={onAgain}><RotateCcw size={18} /> Học lại</button>
        )}
      </div>
    </div>
  );
}
