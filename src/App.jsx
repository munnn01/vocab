import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookOpen, BrainCircuit, Check, ChevronRight, CircleAlert, FileText,
  Download, Eye, EyeOff, FileUp, Flame, GraduationCap, Keyboard, Layers3,
  LoaderCircle, LogOut, Maximize2, Minimize2, MousePointerClick, Plus,
  RotateCcw, ShieldCheck, Sparkles, Trash2, Trophy, UserPlus, Users, X,
} from "lucide-react";
import { DEMO_WORDS, POS_LABELS, makeQuizChoices, normalizeAnswer, shuffle } from "./lib/vocabulary";
import {
  createDeck, createStudentAccounts, getCurrentAccount, isSupabaseConfigured,
  loadLibrary, loadStudents, saveStudySession, signIn, signOut,
} from "./lib/supabase";
import { createDemoStudentAccounts, downloadStudentAccountsXlsx } from "./lib/studentAccounts";

const DEMO_DECK = {
  id: "demo",
  title: "Bộ từ học thử",
  sourceFileName: "Mẫu new(adj): mới",
  wordCount: DEMO_WORDS.length,
  words: DEMO_WORDS,
  isDemo: true,
};

const MODES = [
  { id: "flashcard", title: "Flashcard", description: "Lật thẻ và tự đánh giá", icon: Layers3, accent: "lime" },
  { id: "typing", title: "Gõ từ", description: "Nhìn nghĩa, tự gõ đáp án", icon: Keyboard, accent: "blue" },
  { id: "quiz", title: "Trắc nghiệm", description: "Đáp án nhiễu cùng loại từ", icon: BrainCircuit, accent: "coral" },
];

function formatMode(mode) {
  return MODES.find((item) => item.id === mode)?.title || "Luyện tập";
}

function deckMeta(deck) {
  return `${deck.words.length} từ${deck.isDemo ? " · Học thử ngay" : " · Từ PDF"}`;
}

export function App() {
  const fileInputRef = useRef(null);
  const typingInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const answerTimerRef = useRef(null);
  const [view, setView] = useState("home");
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
  const [generatedAccounts, setGeneratedAccounts] = useState([]);
  const [isGeneratingAccounts, setIsGeneratingAccounts] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState("demo");
  const [connection, setConnection] = useState(isSupabaseConfigured ? "connecting" : "demo");
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [importDraft, setImportDraft] = useState(null);
  const [study, setStudy] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [toast, setToast] = useState("");

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

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
    window.clearTimeout(answerTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    getCurrentAccount()
      .then((currentAccount) => {
        if (active) setAccount(currentAccount);
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
    ]).then(([library, studentList]) => {
      if (!active) return;
      setDecks([DEMO_DECK, ...library.decks]);
      setSessions(library.sessions);
      setStudents(studentList);
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
    const warnOnBack = () => {
      setLeaveDialog(true);
      window.history.pushState({ vocabStudyGuard: true }, "", window.location.href);
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("popstate", warnOnBack);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("popstate", warnOnBack);
    };
  }, [view, Boolean(study)]);

  useEffect(() => {
    if (view === "study" && study?.mode === "typing" && !study.feedback) typingInputRef.current?.focus();
  }, [view, study?.mode, study?.index, study?.feedback]);

  const startStudy = useCallback((mode = "flashcard") => {
    if (!selectedDeck?.words.length) {
      showToast("Bộ từ này chưa có từ để học.");
      return;
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
      flipped: false,
      feedback: null,
      input: "",
    });
    setView("study");
    setLastResult(null);
  }, [selectedDeck, showToast]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return undefined;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "start_vocabulary_practice",
        title: "Bắt đầu luyện từ vựng",
        description: "Bắt đầu học bộ từ đang chọn bằng flashcard, gõ từ hoặc trắc nghiệm.",
        inputSchema: {
          type: "object",
          properties: { mode: { type: "string", enum: ["flashcard", "typing", "quiz"] } },
          required: ["mode"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!MODES.some((item) => item.id === input?.mode)) throw new Error("Chế độ học không hợp lệ.");
          startStudy(input.mode);
          return { deck: selectedDeck.title, mode: input.mode, status: "started" };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch {
      return undefined;
    }
    return () => lifecycle.abort();
  }, [selectedDeck, startStudy]);

  const finishStudy = useCallback((finalStudy, completed = true) => {
    const result = {
      deckTitle: finalStudy.deckTitle,
      mode: finalStudy.mode,
      score: finalStudy.score,
      correct: finalStudy.correct,
      total: finalStudy.items.length,
      completed,
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
    }).then(() => {
      if (finalStudy.deckId !== "demo") {
        setSessions((current) => [{
          id: crypto.randomUUID(),
          deck_id: finalStudy.deckId,
          score: finalStudy.score,
          correct_count: finalStudy.correct,
          total_count: finalStudy.items.length,
          completed,
          created_at: new Date().toISOString(),
        }, ...current]);
      }
    }).catch((error) => console.error("Không thể lưu phiên học", error));
  }, []);

  const answerCurrent = useCallback((isCorrect) => {
    if (!study || study.feedback) return;
    const nextStudy = {
      ...study,
      feedback: isCorrect ? "correct" : "wrong",
      score: study.score + (isCorrect ? 10 : -3),
      correct: study.correct + (isCorrect ? 1 : 0),
      answered: study.answered + 1,
    };
    setStudy(nextStudy);
    window.clearTimeout(answerTimerRef.current);
    answerTimerRef.current = window.setTimeout(() => {
      if (nextStudy.index >= nextStudy.items.length - 1) {
        finishStudy(nextStudy, true);
        return;
      }
      setStudy({ ...nextStudy, index: nextStudy.index + 1, flipped: false, feedback: null, input: "" });
    }, 720);
  }, [finishStudy, study]);

  useEffect(() => {
    if (view !== "study" || !study) return undefined;
    const handleKey = (event) => {
      const isTyping = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
      if (study.mode === "flashcard" && event.code === "Space") {
        event.preventDefault();
        setStudy((current) => ({ ...current, flipped: !current.flipped }));
      }
      if (study.mode === "flashcard" && study.flipped && !study.feedback) {
        if (event.key === "1") answerCurrent(false);
        if (event.key === "2") answerCurrent(true);
      }
      if (study.mode === "quiz" && !isTyping && /^[1-4]$/.test(event.key)) {
        const choice = quizChoices[Number(event.key) - 1];
        if (choice) answerCurrent(choice === currentWord.term);
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
        savedDeck = await createDeck({ title: importDraft.title.trim(), sourceFileName: importDraft.fileName, words: importDraft.words });
      } else {
        savedDeck = {
          id: `local-${crypto.randomUUID()}`,
          title: importDraft.title.trim(),
          sourceFileName: importDraft.fileName,
          wordCount: importDraft.words.length,
          words: importDraft.words,
          isTemporary: true,
        };
      }
      setDecks((current) => [current[0], savedDeck, ...current.slice(1)]);
      setSelectedDeckId(savedDeck.id);
      setImportDraft(null);
      setView("home");
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

  function changeStudyMode(mode) {
    setStudy((current) => ({ ...current, mode, flipped: false, feedback: null, input: "" }));
  }

  function submitTyping(event) {
    event.preventDefault();
    if (!study?.input.trim()) return;
    answerCurrent(normalizeAnswer(study.input) === normalizeAnswer(currentWord.term));
  }

  function confirmLeaveStudy() {
    if (!study) return;
    window.clearTimeout(answerTimerRef.current);
    const penalized = { ...study, score: study.score - 5 };
    finishStudy(penalized, false);
    setLeaveDialog(false);
    setView("home");
    showToast("Đã rời phiên sớm: trừ 5 điểm.");
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      showToast("Trình duyệt này chưa cho phép chế độ toàn màn hình.");
    }
  }

  async function handleLogin(credentials) {
    const loggedInAccount = await signIn(credentials);
    setAccount(loggedInAccount);
    setView("home");
    setGeneratedAccounts([]);
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
    setGeneratedAccounts([]);
    setSelectedDeckId("demo");
    setView("home");
  }

  async function handleGenerateStudents(values) {
    setIsGeneratingAccounts(true);
    try {
      const accounts = account.demo
        ? createDemoStudentAccounts(values)
        : await createStudentAccounts(values);
      setGeneratedAccounts(accounts);
      setStudents((current) => {
        const next = accounts.map(({ password: _password, ...student }) => student);
        const ids = new Set(next.map((student) => student.id));
        return [...next, ...current.filter((student) => !ids.has(student.id))];
      });
      showToast(`Đã tạo ${accounts.length} tài khoản. Hãy xuất Excel ngay để lưu mật khẩu.`);
      return accounts;
    } finally {
      setIsGeneratingAccounts(false);
    }
  }

  function handleExportStudents() {
    if (!generatedAccounts.length) {
      showToast("Hãy tạo một đợt tài khoản mới trước khi xuất Excel.");
      return;
    }
    downloadStudentAccountsXlsx(generatedAccounts, {
      className: generatedAccounts[0].className,
      loginUrl: window.location.origin,
    });
    showToast("Đã tải file Excel chứa tài khoản sinh viên.");
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

      <header className="topbar">
        <button className="brand" type="button" onClick={() => (view === "study" ? setLeaveDialog(true) : setView("home"))} aria-label="Về trang bộ từ">
          <span className="brand-mark"><Layers3 size={20} /></span>
          <span>Từ Vựng <b>Mỗi Ngày</b></span>
        </button>
        <div className="topbar-actions">
          <span className={`sync-pill ${connection}`}><span /> {connectionLabel}</span>
          <span className="account-pill">
            {canManage ? <ShieldCheck size={17} /> : <GraduationCap size={17} />}
            <span><b>{account.displayName}</b><small>{canManage ? "Giảng viên" : account.className || "Sinh viên"}</small></span>
          </span>
          {canManage && <button className="icon-button student-manage-shortcut" type="button" onClick={() => setView((current) => current === "students" ? "home" : "students")} aria-label={view === "students" ? "Mở khu vực học" : "Quản lý sinh viên"} title="Quản lý sinh viên"><Users size={18} /></button>}
          <button className="icon-text-button" type="button" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            {isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
          </button>
          {!account.demo && <button className="icon-button" type="button" onClick={handleSignOut} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={18} /></button>}
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="eyebrow">Tiến độ gần nhất</div>
          <div className="score-card">
            <div><Flame size={22} /> Điểm phiên</div>
            <strong>{lastSession?.score ?? 0} <small>điểm</small></strong>
            <div className="score-track"><span style={{ width: `${Math.min(100, Math.max(8, lastSession?.score || 8))}%` }} /></div>
            <p>{totalWords ? `${totalWords} từ đã lưu trong ${uploadedDecks.length} bộ từ.` : "Nhập PDF đầu tiên để bắt đầu lưu tiến độ."}</p>
          </div>

          <nav className="sidebar-nav" aria-label="Khu vực ứng dụng">
            <button className={view !== "students" ? "active" : ""} type="button" onClick={() => setView("home")}><BookOpen size={17} /> Học từ vựng</button>
            {canManage && <button className={view === "students" ? "active" : ""} type="button" onClick={() => setView("students")}><Users size={17} /> Tài khoản sinh viên <span>{students.length}</span></button>}
          </nav>

          <div className="section-heading">
            <span>{canManage ? "Bộ từ của bạn" : "Bộ từ của lớp"}</span>
            {canManage && <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Nhập PDF mới"><Plus size={15} /></button>}
          </div>
          <div className="deck-list">
            {decks.map((deck, index) => (
              <button key={deck.id} className={`deck-row ${selectedDeckId === deck.id ? "active" : ""}`} type="button" onClick={() => {
                if (view === "study") setLeaveDialog(true);
                else { setSelectedDeckId(deck.id); setView("home"); }
              }}>
                <span className={`deck-icon ${index % 2 ? "blue" : "coral"}`}>{deck.isDemo ? <Sparkles size={18} /> : <BookOpen size={18} />}</span>
                <span><b>{deck.title}</b><small>{deckMeta(deck)}</small></span>
              </button>
            ))}
          </div>
          {canManage && <><button className="upload-mini" type="button" onClick={() => fileInputRef.current?.click()}><FileUp size={18} /> Nhập PDF mới</button>
          <p className="format-tip">Mỗi dòng theo mẫu<br /><code>new(adj): mới</code></p></>}
        </aside>

        <section className="content-stage">
          {view === "home" && <HomeView deck={selectedDeck} canManage={canManage} isImporting={isImporting} importProgress={importProgress} onPickPdf={() => fileInputRef.current?.click()} onStart={startStudy} />}
          {view === "students" && canManage && <InstructorView students={students} generatedAccounts={generatedAccounts} isGenerating={isGeneratingAccounts} isDemo={Boolean(account.demo)} onGenerate={handleGenerateStudents} onExport={handleExportStudents} />}
          {view === "import" && importDraft && <ImportView draft={importDraft} isSaving={isSaving} connection={connection} onBack={() => setView("home")} onChangeTitle={(title) => setImportDraft((draft) => ({ ...draft, title }))} onRemoveWord={removeDraftWord} onSave={saveImport} />}
          {view === "study" && study && currentWord && <StudyView study={study} currentWord={currentWord} quizChoices={quizChoices} typingInputRef={typingInputRef} onBack={() => setLeaveDialog(true)} onModeChange={changeStudyMode} onFlip={() => setStudy((current) => ({ ...current, flipped: !current.flipped }))} onAnswer={answerCurrent} onInput={(input) => setStudy((current) => ({ ...current, input }))} onTypingSubmit={submitTyping} />}
          {view === "results" && lastResult && <ResultView result={lastResult} onAgain={() => startStudy(lastResult.mode)} onHome={() => setView("home")} />}
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
    <div className="auth-screen">
      <div className="login-layout">
        <section className="login-intro">
          <span className="brand-mark"><Layers3 size={23} /></span>
          <div className="eyebrow">Từ Vựng Mỗi Ngày</div>
          <h1>Một lớp học.<br /><span>Ba cách ghi nhớ.</span></h1>
          <p>Giảng viên đưa PDF lên, sinh viên đăng nhập bằng tài khoản được cấp và bắt đầu học ngay.</p>
          <div className="login-features"><span><Check size={16} /> Flashcard</span><span><Check size={16} /> Gõ từ</span><span><Check size={16} /> Trắc nghiệm</span></div>
        </section>
        <form className="login-card" onSubmit={submit}>
          <div className="eyebrow">Đăng nhập</div>
          <h2>Chọn đúng vai trò của bạn</h2>
          <div className="role-switch" role="tablist" aria-label="Vai trò đăng nhập">
            <button className={role === "instructor" ? "active" : ""} type="button" onClick={() => { setRole("instructor"); setIdentifier(""); setError(""); }}><ShieldCheck size={18} /> Giảng viên</button>
            <button className={role === "student" ? "active" : ""} type="button" onClick={() => { setRole("student"); setIdentifier(""); setError(""); }}><GraduationCap size={18} /> Sinh viên</button>
          </div>
          <label className="field-label" htmlFor="login-identifier">{role === "instructor" ? "Email giảng viên" : "Tên đăng nhập"}</label>
          <input id="login-identifier" className="auth-input" type={role === "instructor" ? "email" : "text"} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={role === "instructor" ? "giangvien@truong.edu.vn" : "12a1-k7m4p2"} autoComplete="username" required />
          <label className="field-label" htmlFor="login-password">Mật khẩu</label>
          <div className="password-field">
            <input id="login-password" className="auth-input" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" autoComplete="current-password" required />
            <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          {error && <div className="login-error" role="alert"><CircleAlert size={17} /> {error}</div>}
          <button className="primary-button login-submit" type="submit" disabled={isSubmitting || !identifier.trim() || !password}>{isSubmitting ? <LoaderCircle className="spin" size={18} /> : <ChevronRight size={18} />}{isSubmitting ? "Đang đăng nhập…" : `Vào khu vực ${role === "instructor" ? "giảng viên" : "sinh viên"}`}</button>
          <p className="login-note">Sinh viên dùng đúng tên đăng nhập và mật khẩu trong file được giảng viên cấp.</p>
        </form>
      </div>
    </div>
  );
}

function InstructorView({ students, generatedAccounts, isGenerating, isDemo, onGenerate, onExport }) {
  const [className, setClassName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [count, setCount] = useState(10);
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await onGenerate({ className: className.trim(), prefix: prefix.trim(), count: Number(count) });
    } catch (generationError) {
      setError(generationError.message || "Không thể tạo tài khoản.");
    }
  }

  return (
    <div className="instructor-view">
      <div className="instructor-head">
        <div><div className="eyebrow">Khu vực giảng viên</div><h1>Tài khoản sinh viên</h1><p>Tạo theo lớp, tải một file Excel rồi cấp riêng cho từng sinh viên.</p></div>
        <div className="student-count"><Users size={22} /><span><strong>{students.length}</strong> sinh viên đã tạo</span></div>
      </div>

      {isDemo && <div className="demo-banner"><CircleAlert size={18} /><span>Đây là bản xem thử. Tài khoản tạo ở đây chỉ để kiểm tra giao diện và file Excel.</span></div>}

      <div className="teacher-grid">
        <form className="account-generator" onSubmit={submit}>
          <div className="generator-title"><span><UserPlus size={20} /></span><div><h2>Tạo một đợt tài khoản</h2><p>Mỗi tài khoản có tên đăng nhập và mật khẩu ngẫu nhiên.</p></div></div>
          <label className="field-label" htmlFor="class-name">Tên lớp</label>
          <input id="class-name" className="auth-input" value={className} onChange={(event) => setClassName(event.target.value)} maxLength={80} placeholder="Ví dụ: Lớp 12A1" required />
          <div className="generator-fields">
            <label><span>Tiền tố tên đăng nhập</span><input className="auth-input" value={prefix} onChange={(event) => setPrefix(event.target.value)} maxLength={16} placeholder="Để trống = tên lớp" /></label>
            <label><span>Số lượng</span><input className="auth-input" type="number" min="1" max="50" value={count} onChange={(event) => setCount(event.target.value)} required /></label>
          </div>
          {error && <div className="login-error" role="alert"><CircleAlert size={17} /> {error}</div>}
          <button className="primary-button generator-submit" type="submit" disabled={isGenerating || !className.trim()}>{isGenerating ? <LoaderCircle className="spin" size={18} /> : <UserPlus size={18} />}{isGenerating ? "Đang tạo tài khoản…" : "Tạo tài khoản ngẫu nhiên"}</button>
        </form>

        <section className="export-panel">
          <span className="export-icon"><Download size={23} /></span>
          <div className="eyebrow">File cấp cho sinh viên</div>
          <h2>{generatedAccounts.length ? `${generatedAccounts.length} tài khoản sẵn sàng` : "Chưa có đợt mới"}</h2>
          <p>Mật khẩu chỉ được trả về ở lần tạo này. Hãy xuất Excel trước khi rời trang.</p>
          <button className="secondary-button" type="button" onClick={onExport} disabled={!generatedAccounts.length}><Download size={18} /> Xuất file Excel (.xlsx)</button>
        </section>
      </div>

      {generatedAccounts.length > 0 && <section className="new-accounts">
        <div className="table-title"><div><div className="eyebrow">Đợt vừa tạo</div><h2>Tài khoản và mật khẩu</h2></div><button className="secondary-button password-toggle" type="button" onClick={() => setShowPasswords((shown) => !shown)}>{showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}{showPasswords ? "Ẩn mật khẩu" : "Hiện mật khẩu"}</button></div>
        <div className="student-table-wrap"><table className="student-table"><thead><tr><th>STT</th><th>Tên hiển thị</th><th>Tên đăng nhập</th><th>Mật khẩu</th><th>Lớp</th></tr></thead><tbody>{generatedAccounts.map((student, index) => <tr key={student.id}><td>{index + 1}</td><td>{student.displayName}</td><td><code>{student.username}</code></td><td><code>{showPasswords ? student.password : "••••••••••"}</code></td><td>{student.className}</td></tr>)}</tbody></table></div>
      </section>}

      <section className="student-directory">
        <div className="table-title"><div><div className="eyebrow">Danh sách đã lưu</div><h2>Toàn bộ sinh viên</h2></div><span>{students.length} tài khoản</span></div>
        {students.length ? <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Tên hiển thị</th><th>Tên đăng nhập</th><th>Lớp</th><th>Ngày tạo</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td>{student.displayName}</td><td><code>{student.username}</code></td><td>{student.className}</td><td>{student.createdAt ? new Intl.DateTimeFormat("vi-VN").format(new Date(student.createdAt)) : "Vừa tạo"}</td></tr>)}</tbody></table></div> : <div className="empty-students"><GraduationCap size={28} /><strong>Chưa có tài khoản sinh viên</strong><span>Nhập tên lớp và số lượng ở trên để tạo đợt đầu tiên.</span></div>}
      </section>
    </div>
  );
}

function HomeView({ deck, canManage, isImporting, importProgress, onPickPdf, onStart }) {
  const posCounts = useMemo(() => {
    const counts = {};
    for (const word of deck.words) counts[word.partOfSpeech] = (counts[word.partOfSpeech] || 0) + 1;
    return Object.entries(counts);
  }, [deck]);

  return (
    <div className="home-view">
      <div className="mobile-deck-label">Bộ từ đang chọn</div>
      <div className="home-head">
        <div><div className="eyebrow">Sẵn sàng luyện tập</div><h1>{deck.title}</h1><p>{deck.sourceFileName || "Bộ từ vựng của bạn"}</p></div>
        {canManage && <button className="primary-button compact" type="button" onClick={onPickPdf} disabled={isImporting}>
          {isImporting ? <LoaderCircle className="spin" size={18} /> : <FileUp size={18} />}
          {isImporting ? `Đang đọc ${importProgress}%` : "Nhập PDF"}
        </button>}
      </div>

      <div className="deck-overview">
        <div className="overview-main"><span className="overview-icon"><BookOpen size={28} /></span><div><strong>{deck.words.length}</strong><span>từ sẵn sàng học</span></div></div>
        <div className="pos-cloud">{posCounts.map(([pos, count]) => <span key={pos}>{POS_LABELS[pos]} <b>{count}</b></span>)}</div>
      </div>

      <div className="section-title-row">
        <div><span className="eyebrow">Chọn cách học</span><h2>Bắt đầu một phiên mới</h2></div>
        <span className="points-rule">Đúng +10 · Sai −3 · Rời sớm −5</span>
      </div>
      <div className="mode-grid">
        {MODES.map((mode, index) => {
          const Icon = mode.icon;
          return (
            <button key={mode.id} className={`mode-card ${mode.accent}`} type="button" onClick={() => onStart(mode.id)}>
              <span className="mode-number">0{index + 1}</span><span className="mode-icon"><Icon size={24} /></span>
              <span className="mode-copy"><b>{mode.title}</b><small>{mode.description}</small></span><ChevronRight className="mode-arrow" size={20} />
            </button>
          );
        })}
      </div>
      {canManage && <button className="drop-zone" type="button" onClick={onPickPdf}>
        <span><FileText size={21} /></span><span><b>Có bộ từ mới?</b><small>Chọn PDF có định dạng: new(adj): mới</small></span><span className="drop-action">Chọn file PDF</span>
      </button>}
    </div>
  );
}

function ImportView({ draft, isSaving, connection, onBack, onChangeTitle, onRemoveWord, onSave }) {
  return (
    <div className="import-view">
      <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={18} /> Quay lại</button>
      <div className="import-head">
        <div><div className="eyebrow">Xem lại trước khi lưu</div><h1>Đã nhận diện {draft.words.length} từ</h1><p>{draft.fileName} · {draft.pageCount} trang</p></div>
        <div className="parse-badge"><Check size={18} /> Đọc PDF thành công</div>
      </div>
      <label className="field-label" htmlFor="deck-title">Tên bộ từ</label>
      <input id="deck-title" className="title-input" value={draft.title} maxLength={120} onChange={(event) => onChangeTitle(event.target.value)} />

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

function StudyView({ study, currentWord, quizChoices, typingInputRef, onBack, onModeChange, onFlip, onAnswer, onInput, onTypingSubmit }) {
  const progress = ((study.index + 1) / study.items.length) * 100;
  const resultClass = study.feedback ? `feedback-${study.feedback}` : "";

  return (
    <div className={`study-view ${resultClass}`}>
      <div className="study-head">
        <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={18} /> Rời phiên</button>
        <div className="study-title"><div className="eyebrow">{String(study.index + 1).padStart(2, "0")} / {String(study.items.length).padStart(2, "0")}</div><h1>{study.deckTitle}</h1></div>
        <div className="session-points"><Sparkles size={18} /><span>Điểm phiên</span><strong>{study.score}</strong></div>
      </div>
      <div className="progress-line"><span style={{ width: `${progress}%` }} /></div>
      <div className="mode-tabs" role="tablist" aria-label="Chế độ học">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          return <button key={mode.id} className={study.mode === mode.id ? "active" : ""} type="button" role="tab" aria-selected={study.mode === mode.id} onClick={() => onModeChange(mode.id)} disabled={Boolean(study.feedback)}><Icon size={17} /> {mode.title}</button>;
        })}
      </div>

      {study.mode === "flashcard" && <>
        <button className={`flashcard ${study.flipped ? "flipped" : ""}`} type="button" onClick={onFlip} aria-label={study.flipped ? "Mặt nghĩa của flashcard" : "Mặt từ của flashcard"}>
          <div className="card-meta"><span className="pos-chip">{POS_LABELS[currentWord.partOfSpeech]}</span><span><MousePointerClick size={14} /> Chạm để lật</span></div>
          <div className="card-content"><div className="card-side-label">{study.flipped ? "Nghĩa" : "Từ vựng"}</div><div className={study.flipped ? "card-meaning" : "card-word"}>{study.flipped ? currentWord.meaning : currentWord.term}</div></div>
          <div className="tap-hint"><span>?</span>{study.flipped ? "Bạn đã nhớ đúng chưa?" : "Bạn nhớ nghĩa của từ này chứ?"}</div>
        </button>
        <div className="answer-row">
          <button className="answer-button retry" type="button" onClick={() => onAnswer(false)} disabled={!study.flipped || Boolean(study.feedback)}>Chưa nhớ <kbd>1</kbd></button>
          <button className="answer-button reveal" type="button" onClick={onFlip} disabled={Boolean(study.feedback)}>{study.flipped ? "Xem lại từ" : "Lật thẻ"} <kbd>Space</kbd></button>
          <button className="answer-button know" type="button" onClick={() => onAnswer(true)} disabled={!study.flipped || Boolean(study.feedback)}>Đã nhớ <kbd>2</kbd></button>
        </div>
      </>}

      {study.mode === "typing" && <div className="exercise-card">
        <div className="card-meta"><span className="pos-chip">{POS_LABELS[currentWord.partOfSpeech]}</span><span>Gõ từ tiếng Anh</span></div>
        <div className="prompt-label">Từ nào có nghĩa là</div><div className="meaning-prompt">{currentWord.meaning}</div>
        <form className="typing-form" onSubmit={onTypingSubmit}>
          <input ref={typingInputRef} value={study.input} onChange={(event) => onInput(event.target.value)} placeholder="Nhập từ vựng…" autoComplete="off" spellCheck="false" disabled={Boolean(study.feedback)} aria-label="Nhập từ tiếng Anh" />
          <button type="submit" disabled={!study.input.trim() || Boolean(study.feedback)}>Kiểm tra <kbd>Enter</kbd></button>
        </form>
        {study.feedback === "wrong" && <div className="correct-answer">Đáp án: <strong>{currentWord.term}</strong></div>}
      </div>}

      {study.mode === "quiz" && <div className="exercise-card quiz-card">
        <div className="card-meta"><span className="pos-chip">{POS_LABELS[currentWord.partOfSpeech]}</span><span>Chọn từ đúng</span></div>
        <div className="prompt-label">Từ nào có nghĩa là</div><div className="meaning-prompt">{currentWord.meaning}</div>
        <div className="quiz-grid">{quizChoices.map((choice, index) => {
          const isCorrect = choice === currentWord.term;
          const className = study.feedback ? (isCorrect ? "correct-choice" : "muted-choice") : "";
          return <button key={choice} className={className} type="button" onClick={() => onAnswer(isCorrect)} disabled={Boolean(study.feedback)}><kbd>{index + 1}</kbd><span>{choice}</span>{study.feedback && isCorrect && <Check size={18} />}</button>;
        })}</div>
        <p className="same-pos-note">Các đáp án nhiễu được chọn ngẫu nhiên từ cùng loại từ <b>{currentWord.partOfSpeech}</b>.</p>
      </div>}

      {study.feedback && <div className={`feedback-banner ${study.feedback}`} role="status">{study.feedback === "correct" ? <><Check size={19} /> Chính xác! +10 điểm</> : <><X size={19} /> Chưa đúng. −3 điểm</>}</div>}
      <p className="leave-note">Rời phiên học trước khi hoàn thành sẽ bị trừ 5 điểm.</p>
    </div>
  );
}

function ResultView({ result, onAgain, onHome }) {
  const percentage = Math.round((result.correct / result.total) * 100);
  return (
    <div className="result-view">
      <div className="trophy-wrap"><Trophy size={42} /></div><div className="eyebrow">Hoàn thành phiên học</div>
      <h1>{percentage >= 80 ? "Một vòng học rất chắc!" : "Bạn đang nhớ tốt hơn rồi."}</h1><p>{result.deckTitle} · {formatMode(result.mode)}</p>
      <div className="result-score"><span>Điểm phiên</span><strong>{result.score}</strong></div>
      <div className="result-stats"><div><strong>{result.correct}/{result.total}</strong><span>câu đúng</span></div><div><strong>{percentage}%</strong><span>độ chính xác</span></div></div>
      <div className="result-actions"><button className="secondary-button" type="button" onClick={onHome}>Về bộ từ</button><button className="primary-button" type="button" onClick={onAgain}><RotateCcw size={18} /> Học lại</button></div>
    </div>
  );
}
