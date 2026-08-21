-- =============================================================================
-- Chat identity alignment (Phase 2)
-- =============================================================================
-- The chat tables were created against `auth.users(id)`, but every JWT this API
-- issues carries `sub = public.users.id` (see AuthService.resolveTenantUser) and
-- the rest of the schema — `notice_reads`, `students`, `teachers` — references
-- `public.users(id)`. The two only coincide in seed data, where the ids were
-- inserted by hand; provisioned users get a fresh `public.users.id`, so every
-- real participant/message/receipt insert failed its foreign key.
--
-- Repointing the chat foreign keys at `public.users(id)` makes chat agree with
-- the token and with the rest of the schema.
-- =============================================================================

SET search_path TO public;

-- 1. Drop rows that cannot be re-pointed, then move the constraints.
--    Orphans can only exist in hand-seeded data; a fresh install has none.
DELETE FROM public.chat_read_receipts r
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = r.user_id);

DELETE FROM public.chat_messages m
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = m.sender_id);

DELETE FROM public.chat_participants p
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p.user_id);

ALTER TABLE public.chat_participants
    DROP CONSTRAINT IF EXISTS chat_participants_user_id_fkey,
    ADD  CONSTRAINT chat_participants_user_id_fkey
         FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.chat_messages
    DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey,
    ADD  CONSTRAINT chat_messages_sender_id_fkey
         FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.chat_read_receipts
    DROP CONSTRAINT IF EXISTS chat_read_receipts_user_id_fkey,
    ADD  CONSTRAINT chat_read_receipts_user_id_fkey
         FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 2. Indexes for the two hot read paths: a conversation's history, and the
--    caller's inbox (participant rows by user).
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
    ON public.chat_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user
    ON public.chat_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_user
    ON public.chat_read_receipts (user_id, message_id);

-- 3. Back-fill participants for class groups that were provisioned before the
--    roster sync existed, so existing classes are not left with empty threads.
INSERT INTO public.chat_participants (tenant_id, conversation_id, user_id, role)
SELECT c.tenant_id, c.id, s.user_id, 'MEMBER'
FROM public.chat_conversations c
JOIN public.students s ON s.class_id = c.class_id
WHERE c.type = 'CLASS' AND c.class_id IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

INSERT INTO public.chat_participants (tenant_id, conversation_id, user_id, role)
SELECT c.tenant_id, c.id, t.user_id, 'MODERATOR'
FROM public.chat_conversations c
JOIN public.class_teachers ct ON ct.class_id = c.class_id
JOIN public.teachers t ON t.id = ct.teacher_id
WHERE c.type = 'CLASS' AND c.class_id IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
