import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

async function requireUser() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user) return sessionData.session.user;
  throw new Error("Phiên đăng nhập đã hết hạn.");
}

function toAccount(profile, user) {
  return {
    id: user.id,
    email: user.email,
    role: profile.role,
    username: profile.username,
    displayName: profile.display_name || (profile.role === "instructor" ? user.email : profile.username),
    className: profile.class_name,
    instructorId: profile.instructor_id,
    initialPassword: profile.initial_password,
    currentPassword: profile.current_password,
    hasChangedPassword: Boolean(profile.has_changed_password),
  };
}

async function loadProfile(user) {
  let { data, error } = await supabase
    .from("profiles")
    .select("user_id,role,username,display_name,class_name,instructor_id,initial_password,current_password,has_changed_password")
    .eq("user_id", user.id)
    .single();

  if (error && (error.message?.includes("current_password") || error.message?.includes("has_changed_password") || error.message?.includes("initial_password"))) {
    const retry = await supabase
      .from("profiles")
      .select("user_id,role,username,display_name,class_name,instructor_id")
      .eq("user_id", user.id)
      .single();
    if (retry.error) throw retry.error;
    data = retry.data;
  } else if (error) {
    throw error;
  }
  return toAccount(data, user);
}

export async function getCurrentAccount() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const user = data.session?.user;
  if (!user) return null;
  if (user.is_anonymous) {
    await supabase.auth.signOut();
    return null;
  }
  return loadProfile(user);
}

export async function signIn({ role, identifier, password }) {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  const cleanIdentifier = identifier.trim().toLowerCase();
  const email = role === "student"
    ? `${cleanIdentifier}@students.vocab.local`
    : cleanIdentifier;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Tên đăng nhập hoặc mật khẩu chưa đúng.");
  const account = await loadProfile(data.user);
  if (account.role !== role) {
    await supabase.auth.signOut();
    throw new Error(`Tài khoản này không phải tài khoản ${role === "instructor" ? "giáo viên" : "học sinh"}.`);
  }
  if (role === "student" && !account.instructorId) {
    await supabase.auth.signOut();
    throw new Error("Tài khoản học sinh chưa được gán cho giáo viên.");
  }
  return account;
}

export async function changeStudentPassword(newPassword) {
  if (!supabase) {
    return { success: true };
  }
  const user = await requireUser();

  const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
  if (authError) throw new Error(authError.message || "Không thể cập nhật mật khẩu đăng nhập.");

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      current_password: newPassword,
      has_changed_password: true,
    })
    .eq("user_id", user.id);

  if (profileError) {
    console.warn("Lưu mật khẩu mới vào profiles thất bại:", profileError);
  }

  return { success: true };
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export async function loadStudents() {
  const user = await requireUser();
  let { data, error } = await supabase
    .from("profiles")
    .select("user_id,username,display_name,class_name,roster_id,roster_row,initial_password,current_password,has_changed_password,created_at")
    .eq("instructor_id", user.id)
    .order("created_at", { ascending: false });

  if (error && (error.message?.includes("current_password") || error.message?.includes("has_changed_password"))) {
    const retry = await supabase
      .from("profiles")
      .select("user_id,username,display_name,class_name,roster_id,roster_row,initial_password,created_at")
      .eq("instructor_id", user.id)
      .order("created_at", { ascending: false });
    if (retry.error && retry.error.message?.includes("initial_password")) {
      const retry2 = await supabase
        .from("profiles")
        .select("user_id,username,display_name,class_name,roster_id,roster_row,created_at")
        .eq("instructor_id", user.id)
        .order("created_at", { ascending: false });
      if (retry2.error) throw retry2.error;
      data = retry2.data;
    } else if (retry.error) {
      throw retry.error;
    } else {
      data = retry.data;
    }
  } else if (error) {
    throw error;
  }

  return (data || []).map((student) => ({
    id: student.user_id,
    username: student.username,
    displayName: student.display_name,
    className: student.class_name,
    rosterId: student.roster_id,
    rosterRow: student.roster_row,
    initialPassword: student.initial_password,
    currentPassword: student.current_password,
    hasChangedPassword: Boolean(student.has_changed_password),
    createdAt: student.created_at,
  }));
}

export async function loadRosters() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("student_rosters")
    .select("id,class_name,original_file_name,sheet_name,student_count,created_at")
    .eq("instructor_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((roster) => ({
    id: roster.id,
    className: roster.class_name,
    originalFileName: roster.original_file_name,
    sheetName: roster.sheet_name,
    studentCount: roster.student_count,
    createdAt: roster.created_at,
  }));
}

export async function loadRosterWorkbook(rosterId) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("student_rosters")
    .select("id,original_file_name,original_file_base64,sheet_name,worksheet_path,header_row,name_column,class_column")
    .eq("id", rosterId)
    .eq("instructor_id", user.id)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    originalFileName: data.original_file_name,
    originalFileBase64: data.original_file_base64,
    sheetName: data.sheet_name,
    worksheetPath: data.worksheet_path,
    headerRow: data.header_row,
    nameColumn: data.name_column,
    classColumn: data.class_column,
  };
}

export async function deleteRoster(rosterId) {
  if (!supabase) return;
  const user = await requireUser();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (token) {
    try {
      const res = await fetch("/api/delete-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rosterId }),
      });
      if (res.ok) return;
    } catch {
      // Fallback nếu API không khả dụng
    }
  }

  const { error } = await supabase
    .from("student_rosters")
    .delete()
    .eq("id", rosterId)
    .eq("instructor_id", user.id);
  if (error) throw error;
}

export async function deleteOrphanedRosters() {
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return;
  try {
    await fetch("/api/delete-roster", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ deleteOrphaned: true }),
    });
  } catch (err) {
    console.warn("deleteOrphanedRosters error", err);
  }
}

export async function loadStudentResults() {
  const user = await requireUser();
  let { data, error } = await supabase
    .from("study_sessions")
    .select("id,owner_id,deck_id,mode,score,correct_count,total_count,completed,violation_reason,mistake_words,created_at,decks(title)")
    .neq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error && (error.message?.includes("mistake_words") || error.message?.includes("violation_reason"))) {
    const fallback = await supabase
      .from("study_sessions")
      .select("id,owner_id,deck_id,mode,score,correct_count,total_count,completed,violation_reason,created_at,decks(title)")
      .neq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!fallback.error) {
      data = fallback.data;
    } else {
      const basic = await supabase
        .from("study_sessions")
        .select("id,owner_id,deck_id,mode,score,correct_count,total_count,completed,created_at,decks(title)")
        .neq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (basic.error) throw basic.error;
      data = basic.data;
    }
  } else if (error) {
    throw error;
  }

  return (data || []).map((session) => ({
    id: session.id,
    studentId: session.owner_id,
    deckId: session.deck_id,
    deckTitle: Array.isArray(session.decks) ? session.decks[0]?.title : session.decks?.title,
    mode: session.mode,
    score: session.score,
    correct: session.correct_count,
    total: session.total_count,
    completed: session.completed,
    violationReason: session.violation_reason,
    mistakeWords: Array.isArray(session.mistake_words) ? session.mistake_words : [],
    completedAt: session.created_at,
  }));
}

export async function createStudentAccounts({ students, workbook }) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error("Phiên đăng nhập đã hết hạn.");
  const response = await fetch("/api/create-students", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify({ students, workbook }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Không thể tạo tài khoản học sinh.");
  return result;
}

function toClientWord(word) {
  return {
    id: word.id,
    term: word.term,
    partOfSpeech: word.part_of_speech,
    meaning: word.meaning,
  };
}

export async function loadLibrary() {
  const user = await requireUser();
  let deckRes = await supabase
    .from("decks")
    .select("id,title,source_file_name,word_count,practice_mode,unlocked_classes,max_attempts,created_at,words(id,term,part_of_speech,meaning,position)")
    .order("created_at", { ascending: false });

  if (deckRes.error && (deckRes.error.message?.includes("max_attempts") || deckRes.error.message?.includes("unlocked_classes"))) {
    deckRes = await supabase
      .from("decks")
      .select("id,title,source_file_name,word_count,practice_mode,unlocked_classes,created_at,words(id,term,part_of_speech,meaning,position)")
      .order("created_at", { ascending: false });
    if (deckRes.error && deckRes.error.message?.includes("unlocked_classes")) {
      deckRes = await supabase
        .from("decks")
        .select("id,title,source_file_name,word_count,practice_mode,created_at,words(id,term,part_of_speech,meaning,position)")
        .order("created_at", { ascending: false });
    }
  }

  const sessionRes = await supabase
    .from("study_sessions")
    .select("id,deck_id,score,correct_count,total_count,completed,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (deckRes.error) throw deckRes.error;
  if (sessionRes.error) throw sessionRes.error;

  return {
    decks: (deckRes.data || []).map((deck) => ({
      id: deck.id,
      title: deck.title,
      sourceFileName: deck.source_file_name,
      wordCount: deck.word_count,
      practiceMode: deck.practice_mode || "typing",
      unlockedClasses: Array.isArray(deck.unlocked_classes) ? deck.unlocked_classes : null,
      maxAttempts: deck.max_attempts ?? (() => {
        if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem(`vocab_deck_max_attempts_${deck.id}`);
          if (raw) return Number(raw);
        }
        return null;
      })(),
      timeLimitMinutes: deck.time_limit_minutes ?? (() => {
        if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem(`vocab_deck_time_limit_${deck.id}`);
          if (raw) return Number(raw);
        }
        return null;
      })(),
      isExamMode: deck.is_exam_mode ?? (() => {
        if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem(`vocab_deck_exam_mode_${deck.id}`);
          if (raw !== null) return raw === "true";
        }
        return true;
      })(),
      shuffleQuestions: deck.shuffle_questions ?? (() => {
        if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem(`vocab_deck_shuffle_${deck.id}`);
          if (raw !== null) return raw === "true";
        }
        return true;
      })(),
      lockAt: deck.lock_at || (typeof localStorage !== "undefined" ? localStorage.getItem(`vocab_deck_lock_${deck.id}`) : null) || null,
      lockAtByClass: (() => {
        if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem(`vocab_deck_lock_by_class_${deck.id}`);
          if (raw) {
            try { return JSON.parse(raw); } catch { /* ignore */ }
          }
        }
        if (deck.lock_at) return { all: deck.lock_at };
        return null;
      })(),
      createdAt: deck.created_at,
      words: [...(deck.words || [])]
        .sort((a, b) => a.position - b.position)
        .map(toClientWord),
    })),
    sessions: sessionRes.data || [],
  };
}

export async function createDeck({ title, sourceFileName, practiceMode, words, unlockedClasses = null, maxAttempts = null }) {
  const user = await requireUser();
  const payload = {
    owner_id: user.id,
    title,
    source_file_name: sourceFileName,
    word_count: words.length,
    practice_mode: practiceMode,
  };
  if (Array.isArray(unlockedClasses)) {
    payload.unlocked_classes = unlockedClasses;
  }
  if (maxAttempts && Number(maxAttempts) > 0) {
    payload.max_attempts = Number(maxAttempts);
  }

  let deckRes = await supabase
    .from("decks")
    .insert(payload)
    .select("id,title,source_file_name,word_count,practice_mode,unlocked_classes,max_attempts,created_at")
    .single();

  if (deckRes.error && deckRes.error.message?.includes("max_attempts")) {
    delete payload.max_attempts;
    deckRes = await supabase
      .from("decks")
      .insert(payload)
      .select("id,title,source_file_name,word_count,practice_mode,unlocked_classes,created_at")
      .single();
  }

  if (deckRes.error && deckRes.error.message?.includes("unlocked_classes")) {
    delete payload.unlocked_classes;
    deckRes = await supabase
      .from("decks")
      .insert(payload)
      .select("id,title,source_file_name,word_count,practice_mode,created_at")
      .single();
  }

  if (deckRes.error) throw deckRes.error;
  const deck = deckRes.data;

  if (maxAttempts && typeof localStorage !== "undefined") {
    localStorage.setItem(`vocab_deck_max_attempts_${deck.id}`, String(maxAttempts));
  }

  const rows = words.map((word, position) => ({
    deck_id: deck.id,
    owner_id: user.id,
    term: word.term,
    part_of_speech: word.partOfSpeech,
    meaning: word.meaning,
    position,
  }));

  const { data: savedWords, error: wordError } = await supabase
    .from("words")
    .insert(rows)
    .select("id,term,part_of_speech,meaning,position");

  if (wordError) {
    await supabase.from("decks").delete().eq("id", deck.id);
    throw wordError;
  }

  return {
    id: deck.id,
    title: deck.title,
    sourceFileName: deck.source_file_name,
    wordCount: deck.word_count,
    practiceMode: deck.practice_mode,
    unlockedClasses: Array.isArray(deck.unlocked_classes) ? deck.unlocked_classes : (Array.isArray(unlockedClasses) ? unlockedClasses : null),
    createdAt: deck.created_at,
    words: [...savedWords].sort((a, b) => a.position - b.position).map(toClientWord),
  };
}

export async function updateDeckPracticeMode(deckId, practiceMode) {
  await requireUser();
  if (!["typing", "quiz", "listening"].includes(practiceMode)) throw new Error("Thể loại làm bài không hợp lệ.");
  const { error } = await supabase
    .from("decks")
    .update({ practice_mode: practiceMode })
    .eq("id", deckId);
  if (error) throw error;
}

export async function updateDeckShuffle(deckId, shuffleQuestions) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(`vocab_deck_shuffle_${deckId}`, String(shuffleQuestions));
  }
  if (!supabase || deckId === "demo") return;
  try {
    await requireUser();
    const { error } = await supabase
      .from("decks")
      .update({ shuffle_questions: shuffleQuestions })
      .eq("id", deckId);
    if (error && error.message?.includes("shuffle_questions")) {
      console.warn("Column shuffle_questions not yet in decks table. Saved to localStorage.");
      return;
    }
    if (error) throw error;
  } catch (err) {
    console.warn("Could not sync shuffle_questions with Supabase:", err);
  }
}

export async function updateDeckClassAccess(deckId, unlockedClasses) {
  await requireUser();
  const value = Array.isArray(unlockedClasses) ? unlockedClasses : null;
  const { error } = await supabase
    .from("decks")
    .update({ unlocked_classes: value })
    .eq("id", deckId);
  if (error) {
    if (error.message?.includes("unlocked_classes")) {
      throw new Error("Cơ sở dữ liệu Supabase chưa có cột unlocked_classes. Vui lòng chạy file migration trong SQL Editor.");
    }
    throw error;
  }
}

export async function updateDeckMaxAttempts(deckId, maxAttempts) {
  const value = maxAttempts && Number(maxAttempts) > 0 ? Number(maxAttempts) : null;
  if (typeof localStorage !== "undefined") {
    if (value) {
      localStorage.setItem(`vocab_deck_max_attempts_${deckId}`, String(value));
    } else {
      localStorage.removeItem(`vocab_deck_max_attempts_${deckId}`);
    }
  }
  if (!supabase) return;
  try {
    await requireUser();
    const { error } = await supabase
      .from("decks")
      .update({ max_attempts: value })
      .eq("id", deckId);
    if (error && error.message?.includes("max_attempts")) {
      console.warn("Column max_attempts not yet in decks table. Saved to localStorage.");
      return;
    }
    if (error) throw error;
  } catch (err) {
    console.warn("Could not sync max_attempts with Supabase:", err);
  }
}

export async function updateDeckTimeLimit(deckId, minutes) {
  const value = minutes && Number(minutes) > 0 ? Number(minutes) : null;
  if (typeof localStorage !== "undefined") {
    if (value) {
      localStorage.setItem(`vocab_deck_time_limit_${deckId}`, String(value));
    } else {
      localStorage.removeItem(`vocab_deck_time_limit_${deckId}`);
    }
  }
  if (!supabase) return;
  try {
    await requireUser();
    const { error } = await supabase
      .from("decks")
      .update({ time_limit_minutes: value })
      .eq("id", deckId);
    if (error && error.message?.includes("time_limit_minutes")) {
      console.warn("Column time_limit_minutes not yet in decks table. Saved to localStorage.");
      return;
    }
    if (error) throw error;
  } catch (err) {
    console.warn("Could not sync time_limit_minutes with Supabase:", err);
  }
}

export async function updateDeckExamMode(deckId, isExamMode) {
  const value = Boolean(isExamMode);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(`vocab_deck_exam_mode_${deckId}`, String(value));
  }
  if (!supabase) return;
  try {
    await requireUser();
    const { error } = await supabase
      .from("decks")
      .update({ is_exam_mode: value })
      .eq("id", deckId);
    if (error && error.message?.includes("is_exam_mode")) {
      console.warn("Column is_exam_mode not yet in decks table. Saved to localStorage.");
      return;
    }
    if (error) throw error;
  } catch (err) {
    console.warn("Could not sync is_exam_mode with Supabase:", err);
  }
}

export async function updateDeckWords(deckId, title, words) {
  if (deckId === "demo" || !supabase) return;
  const user = await requireUser();

  // 1. Update deck title & word count
  const { error: deckErr } = await supabase
    .from("decks")
    .update({ title, word_count: words.length })
    .eq("id", deckId);
  if (deckErr) throw deckErr;

  // 2. Delete existing words and re-insert updated list
  const { error: delErr } = await supabase
    .from("words")
    .delete()
    .eq("deck_id", deckId);
  if (delErr) throw delErr;

  const wordPayload = words.map((word, index) => ({
    deck_id: deckId,
    owner_id: user.id,
    term: word.term.trim(),
    part_of_speech: word.partOfSpeech || "other",
    meaning: word.meaning.trim(),
    position: index,
  }));

  const { error: insErr } = await supabase
    .from("words")
    .insert(wordPayload);
  if (insErr) throw insErr;
}

export async function updateDeckLockAt(deckId, lockAtOrByClass) {
  let lockAtByClass = null;
  let legacyLockAt = null;

  if (typeof lockAtOrByClass === "string" || lockAtOrByClass === null) {
    legacyLockAt = lockAtOrByClass;
    lockAtByClass = lockAtOrByClass ? { all: lockAtOrByClass } : null;
  } else if (typeof lockAtOrByClass === "object") {
    lockAtByClass = lockAtOrByClass;
    legacyLockAt = lockAtByClass?.all || Object.values(lockAtByClass || {})[0] || null;
  }

  if (typeof localStorage !== "undefined") {
    if (lockAtByClass && Object.keys(lockAtByClass).length > 0) {
      localStorage.setItem(`vocab_deck_lock_by_class_${deckId}`, JSON.stringify(lockAtByClass));
    } else {
      localStorage.removeItem(`vocab_deck_lock_by_class_${deckId}`);
    }
    if (legacyLockAt) {
      localStorage.setItem(`vocab_deck_lock_${deckId}`, legacyLockAt);
    } else {
      localStorage.removeItem(`vocab_deck_lock_${deckId}`);
    }
  }
  if (!supabase) return;
  try {
    await requireUser();
    const value = legacyLockAt ? new Date(legacyLockAt).toISOString() : null;
    await supabase
      .from("decks")
      .update({ lock_at: value })
      .eq("id", deckId);
  } catch (err) {
    console.warn("Could not sync lock_at with Supabase:", err);
  }
}

export async function deleteDeck(deckId) {
  await requireUser();
  const { error } = await supabase
    .from("decks")
    .delete()
    .eq("id", deckId);
  if (error) throw error;
}

export async function saveStudySession({ deckId, mode, score, correct, total, completed, violationReason = null, mistakeWords = [] }) {
  if (!supabase || deckId === "demo") return;
  const user = await requireUser();
  const payload = {
    owner_id: user.id,
    deck_id: deckId,
    mode,
    score,
    correct_count: correct,
    total_count: total,
    completed,
  };
  if (violationReason) {
    payload.violation_reason = violationReason;
  }
  if (Array.isArray(mistakeWords) && mistakeWords.length > 0) {
    payload.mistake_words = mistakeWords;
  }
  let { error } = await supabase.from("study_sessions").insert(payload);
  if (error && (error.message?.includes("mistake_words") || error.message?.includes("violation_reason"))) {
    delete payload.mistake_words;
    let retry = await supabase.from("study_sessions").insert(payload);
    if (retry.error && retry.error.message?.includes("violation_reason")) {
      delete payload.violation_reason;
      retry = await supabase.from("study_sessions").insert(payload);
    }
    if (retry.error) throw retry.error;
    return;
  }
  if (error) throw error;
}

export async function resetStudentPasswords(studentIds = null) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session) throw new Error("Phiên đăng nhập đã hết hạn.");
  const response = await fetch("/api/reset-passwords", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify({ studentIds }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Không thể đặt lại mật khẩu.");
  return result;
}
