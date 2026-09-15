-- Migration: Add mistake_words tracking to study_sessions and shuffle_questions to decks
-- Description: Supports "Top từ vựng học sinh hay làm sai nhất" (1.2) and "Đảo ngẫu nhiên câu hỏi & đáp án" (1.3)

-- 1. Add mistake_words to study_sessions table
alter table if exists public.study_sessions
add column if not exists mistake_words jsonb default '[]'::jsonb;

-- 2. Add shuffle_questions to decks table
alter table if exists public.decks
add column if not exists shuffle_questions boolean default true;
