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
  };
}

async function loadProfile(user) {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,role,username,display_name,class_name,instructor_id")
    .eq("user_id", user.id)
    .single();
  if (error) throw error;
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
    throw new Error(`Tài khoản này không phải tài khoản ${role === "instructor" ? "giảng viên" : "sinh viên"}.`);
  }
  if (role === "student" && !account.instructorId) {
    await supabase.auth.signOut();
    throw new Error("Tài khoản sinh viên chưa được gán cho giảng viên.");
  }
  return account;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export async function loadStudents() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,username,display_name,class_name,roster_id,roster_row,created_at")
    .eq("instructor_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((student) => ({
    id: student.user_id,
    username: student.username,
    displayName: student.display_name,
    className: student.class_name,
    rosterId: student.roster_id,
    rosterRow: student.roster_row,
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

export async function loadStudentResults() {
  const user = await requireUser();
  let { data, error } = await supabase
    .from("study_sessions")
    .select("id,owner_id,deck_id,mode,score,correct_count,total_count,completed,violation_reason,created_at,decks(title)")
    .neq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error && error.message?.includes("violation_reason")) {
    const fallback = await supabase
      .from("study_sessions")
      .select("id,owner_id,deck_id,mode,score,correct_count,total_count,completed,created_at,decks(title)")
      .neq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (fallback.error) throw fallback.error;
    data = fallback.data;
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
  if (!response.ok) throw new Error(result.error || "Không thể tạo tài khoản sinh viên.");
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
  const [{ data: decks, error: deckError }, { data: sessions, error: sessionError }] =
    await Promise.all([
      supabase
        .from("decks")
        .select("id,title,source_file_name,word_count,practice_mode,created_at,words(id,term,part_of_speech,meaning,position)")
        .order("created_at", { ascending: false }),
      supabase
        .from("study_sessions")
        .select("id,deck_id,score,correct_count,total_count,completed,created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  if (deckError) throw deckError;
  if (sessionError) throw sessionError;

  return {
    decks: (decks || []).map((deck) => ({
      id: deck.id,
      title: deck.title,
      sourceFileName: deck.source_file_name,
      wordCount: deck.word_count,
      practiceMode: deck.practice_mode || "typing",
      createdAt: deck.created_at,
      words: [...(deck.words || [])]
        .sort((a, b) => a.position - b.position)
        .map(toClientWord),
    })),
    sessions: sessions || [],
  };
}

export async function createDeck({ title, sourceFileName, practiceMode, words }) {
  const user = await requireUser();
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({
      owner_id: user.id,
      title,
      source_file_name: sourceFileName,
      word_count: words.length,
      practice_mode: practiceMode,
    })
    .select("id,title,source_file_name,word_count,practice_mode,created_at")
    .single();

  if (deckError) throw deckError;

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
    createdAt: deck.created_at,
    words: [...savedWords].sort((a, b) => a.position - b.position).map(toClientWord),
  };
}

export async function updateDeckPracticeMode(deckId, practiceMode) {
  await requireUser();
  if (!["typing", "quiz"].includes(practiceMode)) throw new Error("Thể loại làm bài không hợp lệ.");
  const { error } = await supabase
    .from("decks")
    .update({ practice_mode: practiceMode })
    .eq("id", deckId);
  if (error) throw error;
}

export async function deleteDeck(deckId) {
  await requireUser();
  const { error } = await supabase
    .from("decks")
    .delete()
    .eq("id", deckId);
  if (error) throw error;
}

export async function saveStudySession({ deckId, mode, score, correct, total, completed, violationReason = null }) {
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
  let { error } = await supabase.from("study_sessions").insert(payload);
  if (error && error.message?.includes("violation_reason")) {
    delete payload.violation_reason;
    const retry = await supabase.from("study_sessions").insert(payload);
    if (retry.error) throw retry.error;
    return;
  }
  if (error) throw error;
}
