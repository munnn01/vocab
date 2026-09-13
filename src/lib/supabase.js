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

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
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
        .select("id,title,source_file_name,word_count,created_at,words(id,term,part_of_speech,meaning,position)")
        .eq("owner_id", user.id)
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
      createdAt: deck.created_at,
      words: [...(deck.words || [])]
        .sort((a, b) => a.position - b.position)
        .map(toClientWord),
    })),
    sessions: sessions || [],
  };
}

export async function createDeck({ title, sourceFileName, words }) {
  const user = await requireUser();
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({
      owner_id: user.id,
      title,
      source_file_name: sourceFileName,
      word_count: words.length,
    })
    .select("id,title,source_file_name,word_count,created_at")
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
    createdAt: deck.created_at,
    words: [...savedWords].sort((a, b) => a.position - b.position).map(toClientWord),
  };
}

export async function saveStudySession({ deckId, mode, score, correct, total, completed }) {
  if (!supabase || deckId === "demo") return;
  const user = await requireUser();
  const { error } = await supabase.from("study_sessions").insert({
    owner_id: user.id,
    deck_id: deckId,
    mode,
    score,
    correct_count: correct,
    total_count: total,
    completed,
  });
  if (error) throw error;
}
