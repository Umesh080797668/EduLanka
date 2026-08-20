-- Support for Teacher/Admin moderation tools (Phase 2, Sprint 2)

SET search_path TO public;

-- 1. Add ability to pin a message in a conversation thread
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- 2. Add ability to mute a specific participant temporarily
ALTER TABLE public.chat_participants 
ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;

-- Notify postgrest to reload the schema
NOTIFY pgrst, 'reload schema';
