import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookOpen, BrainCircuit, Check, ChevronRight, CircleAlert, Clock, FileText,
  Download, Eye, EyeOff, FileSpreadsheet, FileUp, Flame, GraduationCap, Keyboard, KeyRound, Layers3,
  LoaderCircle, Lock, LogOut, Maximize2, Minimize2, Plus,
  RotateCcw, ShieldCheck, Sparkles, Trash2, Trophy, Unlock, UserPlus, Users, X,
} from "lucide-react";
import { DEMO_WORDS, POS_LABELS, makeQuizChoices, normalizeAnswer, shuffle } from "./lib/vocabulary";
import {
  createDeck, createStudentAccounts, deleteDeck, deleteRoster, deleteOrphanedRosters, getCurrentAccount, isSupabaseConfigured,
  loadLibrary, loadRosterWorkbook, loadRosters, loadStudentResults, loadStudents,
  resetStudentPasswords, saveStudySession, signIn, signOut,
  updateDeckPracticeMode, updateDeckClassAccess, updateDeckLockAt,
} from "./lib/supabase";
import {
  createDemoStudentAccounts, downloadRosterCredentialsXlsx, downloadRosterResultsXlsx,
  parseStudentRosterXlsx,
} from "./lib/studentAccounts";
import { BookBackground } from "./components/BookBackground";
import { LoginCat } from "./components/LoginCat";

const DEMO_DECK = {
  id: "demo",
  title: "Bộ từ học thử",
  sourceFileName: "Mẫu new(adj): mới",
  wordCount: DEMO_WORDS.length,
  practiceMode: "typing",
  unlockedClasses: null,
  lockAt: null,
  isDemo: true,
  words: DEMO_WORDS,
};

const PRACTICE_MODES = [
  { id: "typing", title: "Điền từ", description: "Nhìn nghĩa và gõ lại từ tiếng Anh", icon: Keyboard, accent: "lime" },
  { id: "quiz", title: "Trắc nghiệm", description: "Chọn đáp án đúng từ 4 lựa chọn", icon: BrainCircuit, accent: "blue" },
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
    displayName: "Giảng viên demo",
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
    const result = {
      deckTitle: finalStudy.deckTitle,
      mode: finalStudy.mode,
      score: finalStudy.score,
      correct: finalStudy.correct,
      total: finalStudy.items.length,
      completed,
      violationReason: resolvedViolationReason,
    };
    setLastResult(result);
    if (completed) setView("results");
    setStudy(null);

    saveStudySession({
      deckId: finalStudy.deckId,
      mode: finalStudy.mode,
      score: finalStudy.score,
      correct: finalStudy.correct,
      total: finalStudy.items.length,
      completed,
      violationReason: resolvedViolationReason,
    }).then(() => {
      if (finalStudy.deckId !== "demo") {
        setSessions((current) => [{
          id: crypto.randomUUID(),
          deck_id: finalStudy.deckId,
          score: finalStudy.score,
          correct_count: finalStudy.correct,
          total_count: finalStudy.items.length,
          completed,
          violation_reason: resolvedViolationReason,
          created_at: new Date().toISOString(),
        }, ...current]);
      }
    }).catch((error) => {
      console.error("Không thể lưu phiên học", error);
      showToast("Lỗi khi lưu kết quả lên máy chủ: " + (error.message || error));
    });
  }, [showToast]);

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

  const startStudy = useCallback(() => {
    if (account?.role !== "student") {
      showToast("Giảng viên chỉ thiết lập bài; tài khoản sinh viên mới có thể làm bài.");
      return;
    }
    if (!selectedDeck?.words.length) {
      showToast("Bộ từ này chưa có từ để học.");
      return;
    }
    if (isDeckLockedForStudent(selectedDeck, account)) {
      const studentLockAt = getDeckLockAtForStudent(selectedDeck, account);
      if (studentLockAt && Date.now() > new Date(studentLockAt).getTime()) {
        showToast("Bộ từ này đã hết hạn làm bài đối với lớp của bạn.");
      } else {
        showToast(`Bộ từ này đang khóa đối với lớp ${account.className || "của bạn"}.`);
      }
      return;
    }
    const mode = PRACTICE_MODES.some((item) => item.id === selectedDeck.practiceMode)
      ? selectedDeck.practiceMode
      : "typing";
    suppressFullscreenPenaltyRef.current = false;
    fullscreenSeenRef.current = Boolean(document.fullscreenElement);
    if (!document.fullscreenElement) {
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
      deckTitle: selectedDeck.title,
      items: shuffle(selectedDeck.words),
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
    });
    setView("study");
    setLastResult(null);
  }, [account?.role, selectedDeck, showToast]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool || account?.role !== "student") return undefined;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "start_vocabulary_practice",
        title: "Bắt đầu luyện từ vựng",
        description: "Bắt đầu bài từ vựng theo thể loại mà giảng viên đã giao.",
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
    if (view !== "study" || !study || account?.role !== "student") return undefined;
    if (document.fullscreenElement) fullscreenSeenRef.current = true;

    const penalizeViolation = (type) => {
      if (suppressFullscreenPenaltyRef.current) return;
      fullscreenSeenRef.current = false;
      const nextViolation = (study.violationCount || 0) + 1;
      const typeLabel = type === "fullscreen_exit" ? "Thoát toàn màn hình" : "Chuyển ứng dụng / tab";
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

    document.addEventListener("fullscreenchange", penalizeFullscreenExit);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("fullscreenchange", penalizeFullscreenExit);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [account?.role, finishStudy, showToast, study, view]);

  const answerCurrent = useCallback((isCorrect, chosenChoice = null) => {
    if (!study || (study.feedback && study.feedback === "correct")) return;
    if (account?.role === "student" && !document.fullscreenElement) {
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

      if (nextMistakes === 1) {
        const nextStudy = {
          ...study,
          feedback: "wrong-1",
          feedbackMessage: "Chưa đúng (Phạm lỗi lần 1: Trừ 25% điểm). Hãy thử lại!",
          wordMistakes: 1,
          disabledChoices: nextDisabledChoices,
          input: "",
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
        };
        setStudy(nextStudy);
        window.clearTimeout(answerTimerRef.current);
        answerTimerRef.current = window.setTimeout(() => {
          setStudy((curr) => curr ? { ...curr, feedback: null, feedbackMessage: "" } : null);
          typingInputRef.current?.focus();
        }, 1100);
      } else {
        const currentItem = study.items[study.index];
        const nextStudy = {
          ...study,
          feedback: "wrong-final",
          feedbackMessage: `Chưa chính xác (0 điểm). Đáp án: ${currentItem?.term || ""}`,
          wordMistakes: 3,
          answered: study.answered + 1,
          disabledChoices: nextDisabledChoices,
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
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [answerCurrent, currentWord?.term, quizChoices, study, view]);

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
      showToast(`Sinh viên sẽ làm bài theo dạng ${formatMode(mode)}.`);
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

  async function confirmDeleteDeck() {
    if (!deckToDelete || deckToDelete.isDemo) return;
    setIsDeletingDeck(true);
    try {
      if (isSupabaseConfigured && !deckToDelete.isTemporary && connection === "connected") {
        await deleteDeck(deckToDelete.id);
      }
      const remainingDecks = decks.filter((d) => d.id !== deckToDelete.id);
      setDecks(remainingDecks);
      if (selectedDeckId === deckToDelete.id) {
        setSelectedDeckId(remainingDecks[0]?.id || "demo");
      }
      if (view === "study" && study?.deckId === deckToDelete.id) {
        setStudy(null);
        setView(canManage ? "create-deck" : "deck");
      }
      showToast(`Đã xóa bộ từ "${deckToDelete.title}".`);
      setDeckToDelete(null);
    } catch (error) {
      console.error("Không thể xóa bộ từ", error);
      showToast(error.message || "Chưa xóa được bộ từ. Vui lòng thử lại.");
    } finally {
      setIsDeletingDeck(false);
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
          initialPassword: student.password,
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
        current.map((s) => (updatedMap.has(s.id) ? { ...s, initialPassword: updatedMap.get(s.id) } : s))
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
      const latestByStudent = new Map();
      for (const result of latestResults) {
        if (!latestByStudent.has(result.studentId)) latestByStudent.set(result.studentId, result);
      }
      const resultRows = students
        .filter((student) => student.rosterId === rosterId && student.rosterRow)
        .map((student) => {
          const result = latestByStudent.get(student.id);
          const issue = result ? formatViolationText(result) : "Chưa làm";
          return { rowNumber: student.rosterRow, score: result?.score ?? "", issue };
        });
      if (!resultRows.length) throw new Error("Không tìm thấy sinh viên thuộc danh sách này.");
      downloadRosterResultsXlsx(workbook, resultRows);
      showToast("Đã xuất file gốc với cột Điểm và Lỗi trong quá trình làm bài.");
    } catch (error) {
      console.error("Không thể xuất kết quả vào file gốc", error);
      showToast(error.message || "Chưa xuất được file kết quả.");
    } finally {
      setIsExportingResults(false);
    }
  }

  async function handleRefreshStudentResults() {
    if (account.demo) {
      showToast("Bản xem thử chưa có điểm sinh viên trên Supabase.");
      return;
    }
    setIsRefreshingResults(true);
    try {
      const results = await loadStudentResults();
      setStudentResults(results);
      showToast(results.length ? "Đã cập nhật điểm mới nhất của sinh viên." : "Chưa có sinh viên hoàn thành bài học.");
    } catch (error) {
      console.error("Không thể cập nhật điểm sinh viên", error);
      showToast("Chưa cập nhật được điểm. Vui lòng thử lại.");
    } finally {
      setIsRefreshingResults(false);
    }
  }

  async function handleDeleteRoster(rosterId) {
    if (!window.confirm("Bạn có chắc chắn muốn xóa file danh sách này khỏi hệ thống?")) return;
    setIsDeletingRoster(true);
    try {
      await deleteRoster(rosterId);
      setRosters((current) => current.filter((r) => r.id !== rosterId));
      setStudents((current) => current.filter((s) => s.rosterId !== rosterId));
      showToast("Đã xóa file danh sách thành công.");
    } catch (error) {
      console.error("Không thể xóa file danh sách", error);
      showToast(error.message || "Chưa xóa được file danh sách. Vui lòng thử lại.");
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
              <small>{canManage ? "Giảng viên quản trị" : account.className ? `Lớp ${account.className}` : "Sinh viên"}</small>
            </span>
          </span>
          {canManage && view !== "study" && <button className="icon-button student-manage-shortcut" type="button" onClick={() => setView((current) => current === "students" ? "create-deck" : "students")} aria-label={view === "students" ? "Mở tạo bộ từ" : "Quản lý sinh viên"} title="Quản lý sinh viên"><Users size={18} /></button>}
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
              <p>{totalWords ? `${totalWords} từ đã sẵn sàng giao cho sinh viên.` : "Nhập PDF đầu tiên để tạo bài cho lớp."}</p>
            </div> : <div className="score-card">
              <div><Flame size={22} /> Điểm phiên</div>
              <strong>{lastSession?.score ?? 0} <small>điểm</small></strong>
              <div className="score-track"><span style={{ width: `${Math.min(100, Math.max(8, lastSession?.score || 8))}%` }} /></div>
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
                            if (lockCount > 1) return `⏳ Hạn: ${lockCount} lớp`;
                            if (deck.lockAt) return `⏳ Hạn: ${formatLockDateTime(deck.lockAt)}`;
                            return deckMeta(deck);
                          }
                          const studentDeadline = getDeckLockAtForStudent(deck, account);
                          return studentDeadline ? `⏳ Hạn: ${formatLockDateTime(studentDeadline)}` : deckMeta(deck);
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

        <section className={`content-stage ${view === "study" ? "study-content-stage" : ""}`}>
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
              account={account}
              canManage={canManage}
              availableClasses={availableClasses}
              isImporting={isImporting}
              isUpdatingMode={isUpdatingMode}
              isUpdatingAccess={isUpdatingAccess}
              isUpdatingLockAt={isUpdatingLockAt}
              isDeletingDeck={isDeletingDeck}
              importProgress={importProgress}
              onPickPdf={() => fileInputRef.current?.click()}
              onStart={startStudy}
              onModeChange={handleDeckPracticeMode}
              onClassAccessChange={handleDeckClassAccess}
              onLockAtChange={handleDeckLockAt}
              onDeleteDeck={(deck) => setDeckToDelete(deck)}
              onNavigateCreateDeck={() => setView("create-deck")}
            />
          )}
          {view === "students" && canManage && (
            <InstructorView
              students={students}
              rosters={rosters}
              studentResults={studentResults}
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
              onRemoveWord={removeDraftWord}
              onSave={saveImport}
            />
          )}
          {view === "study" && study && currentWord && (
            <StudyView
              study={study}
              currentWord={currentWord}
              quizChoices={quizChoices}
              typingInputRef={typingInputRef}
              isFullscreen={isFullscreen}
              onBack={() => setLeaveDialog(true)}
              onFullscreen={toggleFullscreen}
              onAnswer={answerCurrent}
              onInput={(input) => setStudy((current) => ({ ...current, input }))}
              onTypingSubmit={submitTyping}
            />
          )}
          {view === "results" && lastResult && (
            <ResultView
              result={lastResult}
              onAgain={startStudy}
              onHome={() => setView(canManage ? "create-deck" : "deck")}
            />
          )}
        </section>
      </main>

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
            <p>Bạn có chắc chắn muốn xóa bộ từ <strong>"{deckToDelete.title}"</strong> ({deckToDelete.words?.length || 0} từ)? Tất cả từ vựng và kết quả làm bài của sinh viên trong bộ từ này sẽ bị xóa vĩnh viễn.</p>
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
              <span>Giảng viên</span>
            </button>
            <button
              className={role === "student" ? "active" : ""}
              type="button"
              onClick={() => { setRole("student"); setIdentifier(""); setError(""); }}
            >
              <GraduationCap size={18} />
              <span>Sinh viên</span>
            </button>
          </div>

          <div className="form-group">
            <label className="field-label" htmlFor="login-identifier">
              {role === "instructor" ? "Email giảng viên" : "Tên đăng nhập sinh viên"}
            </label>
            <input
              id="login-identifier"
              className="auth-input"
              type={role === "instructor" ? "email" : "text"}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={role === "instructor" ? "giangvien@truong.edu.vn" : "12a1-k7m4p2"}
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
            <span>{isSubmitting ? "Đang đăng nhập…" : `Vào khu vực ${role === "instructor" ? "giảng viên" : "sinh viên"}`}</span>
          </button>

          <p className="login-note">
            {role === "student"
              ? "Sinh viên dùng đúng tên đăng nhập và mật khẩu trong file Excel được cấp."
              : "Giảng viên quản trị có thể tạo bài tập và theo dõi điểm từng lớp."}
          </p>
        </form>
      </div>
      )}
    </div>
  );
}

function InstructorView({ students, rosters, studentResults, generatedAccounts, isGenerating, isRefreshingResults, isExportingResults, isResettingPasswords, isDeletingRoster, isDemo, onGenerate, onExport, onExportResults, onRefreshResults, onResetPasswords, onDeleteRoster }) {
  const rosterInputRef = useRef(null);
  const [rosterDraft, setRosterDraft] = useState(null);
  const [classNameInput, setClassNameInput] = useState("");
  const [isReadingRoster, setIsReadingRoster] = useState(false);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [selectedClassTab, setSelectedClassTab] = useState("all");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");

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
      setError(readError.message || "Không đọc được danh sách sinh viên.");
    } finally {
      setIsReadingRoster(false);
      if (rosterInputRef.current) rosterInputRef.current.value = "";
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!rosterDraft) {
      setError("Hãy chọn file Excel danh sách sinh viên.");
      return;
    }
    const chosenClass = classNameInput.trim();
    if (!chosenClass) {
      setError("Vui lòng nhập tên lớp cho danh sách sinh viên.");
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
          <div className="eyebrow">Khu vực giảng viên</div>
          <h1>Nhập danh sách lớp</h1>
          <p>Tải Excel lên để tạo tài khoản, đặt tên lớp và lọc điểm theo từng lớp.</p>
        </div>
        <div className="instructor-summary">
          <div className="student-count">
            <span className="count-icon-wrap users-icon"><Users size={20} /></span>
            <div>
              <strong>{selectedClassTab === "all" ? students.length : filteredStudents.length}</strong>
              <small>sinh viên {selectedClassTab !== "all" ? `lớp ${selectedClassTab}` : "đã nạp"}</small>
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
              <h2>File danh sách sinh viên</h2>
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
              <small>{rosterDraft ? `${rosterDraft.students.length} sinh viên · Trang ${rosterDraft.workbook.sheetName}` : "Tối đa 100 sinh viên, dung lượng dưới 2,5 MB"}</small>
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
              <span>Đã nhận diện {rosterDraft.students.length} sinh viên</span>
              <b>{rosterDraft.students.slice(0, 3).map((student) => student.displayName).join(", ")}{rosterDraft.students.length > 3 ? ` và ${rosterDraft.students.length - 3} sinh viên khác` : ""}</b>
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
          <div className="eyebrow">File cấp cho sinh viên</div>
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
                  <th>Mật khẩu</th>
                  <th>Lớp</th>
                </tr>
              </thead>
              <tbody>
                {generatedAccounts.map((student, index) => (
                  <tr key={student.id}>
                    <td>{index + 1}</td>
                    <td>{student.displayName}</td>
                    <td><code>{student.username}</code></td>
                    <td><code>{showPasswords ? student.password : "••••••••••"}</code></td>
                    <td><span className="class-name-tag">{student.className}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="student-directory">
        <div className="table-title">
          <div>
            <div className="eyebrow">Điểm học tập</div>
            <h2>Kết quả mới nhất của sinh viên</h2>
            <p>Chọn danh sách để xuất chính file đã nhập, có thêm cột Điểm và Lỗi trong quá trình làm bài.</p>
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
                title={!selectedRosterId ? "Vui lòng chọn file trong ô 'Danh sách'" : "Xuất kết quả của file đã chọn"}
              >
                {isExportingResults ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}
                <span>{isExportingResults ? "Đang xuất…" : "Xuất kết quả"}</span>
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
              <button className="secondary-button password-toggle" type="button" onClick={() => setShowPasswords((shown) => !shown)}>
                {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                <span>{showPasswords ? "Ẩn mật khẩu" : "Hiện mật khẩu"}</span>
              </button>
              <button className="secondary-button password-toggle" type="button" onClick={() => onResetPasswords()} disabled={isResettingPasswords || !students.length} title="Đặt lại mật khẩu ngẫu nhiên cho tất cả sinh viên và lưu vào hệ thống">
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

        {/* Thanh danh sách các lớp - Chỉ hiện khi đã có lớp học/sinh viên */}
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
          <div className="student-table-wrap">
            <table className="student-table result-table">
              <thead>
                <tr>
                  <th>Sinh viên</th>
                  <th>Tên đăng nhập</th>
                  <th>Mật khẩu</th>
                  <th>Lớp</th>
                  <th>Điểm gần nhất</th>
                  <th>Kết quả</th>
                  <th>Lỗi/vi phạm</th>
                  <th>Hoàn thành</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const result = latestResultByStudent.get(student.id);
                  const issue = formatViolationText(result);
                  const badgeClass = getViolationBadgeClass(result);
                  const rawPassword = student.initialPassword || generatedAccountMap.get(student.username) || generatedAccountMap.get(student.id);
                  return (
                    <tr key={student.id}>
                      <td>{student.displayName}</td>
                      <td><code>{student.username}</code></td>
                      <td>
                        {showPasswords ? (
                           rawPassword ? <code>{rawPassword}</code> : <span className="no-result" title="Mật khẩu tạo ở đợt trước khi có tính năng lưu. Bấm 'Cấp lại MK' ở trên để tạo mật khẩu mới.">Chưa lưu MK</span>
                        ) : (
                          <code>••••••••••</code>
                        )}
                      </td>
                      <td><span className="class-name-tag">{student.className}</span></td>
                      <td>
                        {result ? (
                          <span className={`score-badge ${result.completed ? "" : "left-early"}`}>
                            {result.score} điểm
                          </span>
                        ) : (
                          <span className="no-result">Chưa làm</span>
                        )}
                      </td>
                      <td>
                        {result ? (
                          <>
                            <strong>{result.completed ? `${result.correct}/${result.total}` : "Chưa hoàn thành"}</strong>
                            <small>{result.completed ? `${result.deckTitle || "Bộ từ"} · ${formatMode(result.mode)}` : (result.violationReason ? "Đã bị trừ điểm vi phạm" : "Chưa hoàn thành")}</small>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td><span className={`issue-badge ${badgeClass}`}>{issue}</span></td>
                      <td>
                        {result?.completedAt
                          ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(result.completedAt))
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-students">
            <GraduationCap size={28} />
            <strong>{students.length ? `Chưa có sinh viên nào trong lớp "${selectedClassTab}"` : "Chưa có tài khoản sinh viên"}</strong>
            <span>{students.length ? "Chọn tab khác hoặc tải thêm file danh sách cho lớp này." : "Tải file Excel danh sách ở trên để tạo đợt đầu tiên."}</span>
          </div>
        )}
      </section>
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
          <p>Chọn mở hoặc khóa cho từng lớp học. Sinh viên lớp bị khóa sẽ không thể vào làm bài.</p>
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
          <span>Chưa có lớp nào trong danh sách. Bộ từ này mặc định sẽ mở cho tất cả các lớp khi bạn tạo sinh viên.</span>
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
          <div className="eyebrow">Khu vực giảng viên</div>
          <h1>Tạo bộ từ mới từ PDF</h1>
          <p>Tải file PDF danh sách từ vựng lên hệ thống để tạo bài tập cho sinh viên. Xem quy cách định dạng file chuẩn bên dưới.</p>
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
            <span className="syntax-tag">Cú pháp từng dòng</span>
            <code className="syntax-code">từ_vựng(loại_từ): nghĩa_tiếng_việt</code>
          </div>
          <div className="syntax-rules">
            <div className="syntax-rule-item">
              <span className="rule-num">1</span>
              <div>
                <strong>Mỗi từ trên 1 dòng riêng biệt</strong>
                <p>Không ghép nhiều từ trên cùng một dòng văn bản. Nhấn Enter xuống dòng sau mỗi từ.</p>
              </div>
            </div>
            <div className="syntax-rule-item">
              <span className="rule-num">2</span>
              <div>
                <strong>Loại từ đặt trong ngoặc đơn ( )</strong>
                <p>Nằm ngay sau từ vựng: <code>(v)</code>, <code>(n)</code>, <code>(adj)</code>, <code>(adv)</code>...</p>
              </div>
            </div>
            <div className="syntax-rule-item">
              <span className="rule-num">3</span>
              <div>
                <strong>Dấu hai chấm : ngăn cách</strong>
                <p>Bắt buộc có dấu hai chấm <code>:</code> giữa loại từ và phần giải nghĩa tiếng Việt.</p>
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
            <p className="format-card-desc">Bạn có thể sao chép văn bản bên dưới vào Word rồi xuất (Export/Save as) ra file PDF:</p>
            <div className="code-example-box">
              <pre>
{`new(adj): mới, mới mẻ
quiet(adj): yên tĩnh, thanh bình
journey(n): chuyến đi, hành trình
habit(n): thói quen
improve(v): cải thiện, trau dồi
prepare(v): chuẩn bị
carefully(adv): một cách cẩn thận
in spite of(prep): mặc dù, bất chấp
break down(phrase): bị hỏng, suy sụp`}
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

function HomeView({
  deck,
  account,
  canManage,
  availableClasses = [],
  isImporting,
  isUpdatingMode,
  isUpdatingAccess,
  isUpdatingLockAt,
  isDeletingDeck,
  importProgress,
  onPickPdf,
  onStart,
  onModeChange,
  onClassAccessChange,
  onLockAtChange,
  onDeleteDeck,
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

  return (
    <div className="home-view">
      <div className="mobile-deck-label">Bộ từ đang chọn</div>
      <div className="home-head">
        <div>
          <div className="eyebrow">{canManage ? "Thiết lập bài tập" : "Bài giảng viên đã giao"}</div>
          <h1>{deck.title}</h1>
          <p>{deck.sourceFileName || "Bộ từ vựng của lớp"}</p>
        </div>
        <div className="home-head-actions">
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
        <div className="pos-cloud">{posCounts.map(([pos, count]) => <span key={pos}>{POS_LABELS[pos]} <b>{count}</b></span>)}</div>
      </div>

      {canManage ? (
        <>
          <section className="assignment-panel">
            <div className="section-title-row">
              <div><span className="eyebrow">Thể loại làm bài</span><h2>Giảng viên chọn cho sinh viên</h2></div>
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
                ? "Giảng viên đã cài đặt thời hạn cho bài tập này đối với lớp của bạn và hiện tại bài đã bị khóa. Vui lòng liên hệ giảng viên nếu bạn cần gia hạn làm bù."
                : "Giảng viên đang khóa bộ từ này đối với lớp của bạn. Hãy liên hệ với giảng viên để được mở quyền vào làm bài."}
            </p>
          </div>
        </div>
      ) : (
        <>
          {studentDeadline && (
            <div className="deadline-notice-banner">
              <Clock size={16} />
              <span>
                Hạn chót nộp bài {account?.className ? `(Lớp ${account.className})` : ""}: <b>{formatLockDateTime(studentDeadline)}</b>. Vui lòng hoàn thành trước thời gian này.
              </span>
            </div>
          )}
          <div className="section-title-row">
            <div><span className="eyebrow">Thể loại được giao</span><h2>{assignedMode.title}</h2></div>
            <span className="points-rule">Đúng +10 · Sai lần 1: −25% · Sai lần 2: −75% · Thoát/vi phạm: −25% / −75%</span>
          </div>
          <button className={`mode-card assigned-mode-card ${assignedMode.accent}`} type="button" onClick={onStart}>
            <span className="mode-icon"><AssignedIcon size={25} /></span>
            <span className="mode-copy"><b>Bắt đầu {assignedMode.title.toLowerCase()}</b><small>{assignedMode.description}. Bài sẽ tự chuyển sang toàn màn hình.</small></span>
            <ChevronRight className="mode-arrow" size={21} />
          </button>
        </>
      )}
    </div>
  );
}

function ImportView({ draft, availableClasses = [], isSaving, connection, onBack, onChangeTitle, onChangePracticeMode, onChangeUnlockedClasses, onRemoveWord, onSave }) {
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
        <div><span className="field-label">Thể loại giao cho sinh viên</span><p>Sinh viên sẽ làm bài theo thể loại giảng viên chọn (vẫn chọn 2 chế độ như thường).</p></div>
        <div className="mode-selector compact" role="group" aria-label="Thể loại giao cho sinh viên">
          {PRACTICE_MODES.map((mode) => {
            const Icon = mode.icon;
            const selected = draft.practiceMode === mode.id;
            return <button key={mode.id} className={selected ? "active" : ""} type="button" aria-pressed={selected} onClick={() => onChangePracticeMode(mode.id)}><span><Icon size={19} /></span><span><b>{mode.title}</b></span>{selected && <Check size={17} />}</button>;
          })}
        </div>
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

function StudyView({ study, currentWord, quizChoices, typingInputRef, isFullscreen, onBack, onFullscreen, onAnswer, onInput, onTypingSubmit }) {
  const progress = ((study.index + 1) / study.items.length) * 100;
  const resultClass = study.feedback ? `feedback-${study.feedback}` : "";
  const assignedMode = PRACTICE_MODES.find((mode) => mode.id === study.mode) || PRACTICE_MODES[0];
  const AssignedIcon = assignedMode.icon;

  return (
    <div className={`study-view ${resultClass}`}>
      <div className="study-head">
        <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={18} /> Rời phiên</button>
        <div className="study-title">
          <div className="eyebrow">{String(study.index + 1).padStart(2, "0")} / {String(study.items.length).padStart(2, "0")}</div>
          <h1>{study.deckTitle}</h1>
        </div>
        <div className="session-points"><Sparkles size={18} /><span>Điểm phiên</span><strong>{study.score}</strong></div>
      </div>
      <div className="progress-line"><span style={{ width: `${progress}%` }} /></div>
      <div className="assigned-study-mode"><AssignedIcon size={18} /><span>Giảng viên đã giao</span><strong>{assignedMode.title}</strong></div>
      {!isFullscreen && (
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
            <button type="submit" disabled={!study.input.trim() || Boolean(study.feedback)}>Kiểm tra <kbd>Enter</kbd></button>
          </form>
          {study.feedback === "wrong-final" && <div className="correct-answer">Đáp án: <strong>{currentWord.term}</strong></div>}
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
        </div>
      )}

      <p className="penalty-reminder-note">
        * Quy tắc tính điểm & phạm lỗi: Lần đầu phạm lỗi trừ 25% số điểm, lần hai trừ 75% số điểm, lần ba 0 điểm. Rời bài sớm hoặc thoát toàn màn hình cũng bị trừ theo quy tắc này.
      </p>
    </div>
  );
}

function ResultView({ result, onAgain, onHome }) {
  const percentage = Math.round((result.correct / result.total) * 100);
  const violationText = formatViolationText(result);
  const hasViolation = Boolean(result.violationReason);

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
      <div className="result-stats"><div><strong>{result.correct}/{result.total}</strong><span>câu đúng</span></div><div><strong>{percentage}%</strong><span>độ chính xác</span></div></div>
      <div className="result-actions"><button className="secondary-button" type="button" onClick={onHome}>Về bộ từ</button><button className="primary-button" type="button" onClick={onAgain}><RotateCcw size={18} /> Học lại</button></div>
    </div>
  );
}
