-- Chat Schema Migration
-- Defines the foundation for dual-driver chat communications

-- Ensure we're working in public
SET search_path TO public;

-- Types
CREATE TYPE conversation_type AS ENUM ('CLASS', 'DIRECT', 'BROADCAST');
CREATE TYPE conversation_participant_role AS ENUM ('OWNER', 'MEMBER');

-- 1. Conversations
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    type conversation_type NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE, -- NULL if DIRECT or BROADCAST
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Participants
CREATE TABLE IF NOT EXISTS public.chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role conversation_participant_role NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (conversation_id, user_id)
);

-- 3. Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Read Receipts
CREATE TABLE IF NOT EXISTS public.chat_read_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY "tenant_chat_conversations" ON public.chat_conversations USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all_chat_conversations" ON public.chat_conversations USING (true) WITH CHECK (true);

CREATE POLICY "tenant_chat_participants" ON public.chat_participants USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all_chat_participants" ON public.chat_participants USING (true) WITH CHECK (true);

CREATE POLICY "tenant_chat_messages" ON public.chat_messages USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all_chat_messages" ON public.chat_messages USING (true) WITH CHECK (true);

CREATE POLICY "tenant_chat_read_receipts" ON public.chat_read_receipts USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all_chat_read_receipts" ON public.chat_read_receipts USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_chat_conversations_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_conversations_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION update_chat_conversations_modtime();

-- Enable Supabase Realtime for messages (secondary driver)
DO $$
BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Publication supabase_realtime might not exist or table is already added.';
END;
$$;
