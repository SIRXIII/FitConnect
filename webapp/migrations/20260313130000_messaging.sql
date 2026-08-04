-- Phase 6: In-App Messaging
-- Creates conversations and messages tables with RLS and real-time support

BEGIN;

-- ─── conversations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_unique_pair UNIQUE (trainer_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_trainer ON public.conversations(trainer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_client  ON public.conversations(client_id,  updated_at DESC);

-- ─── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         text        NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  read            boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread       ON public.messages(conversation_id, read, sender_id);

-- ─── trigger: bump conversation.updated_at on new message ────────────────────
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_timestamp ON public.messages;
CREATE TRIGGER trg_update_conversation_timestamp
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

-- conversations: participants can see their own threads
CREATE POLICY "conversations_participant_select" ON public.conversations
  FOR SELECT TO authenticated
  USING (trainer_id = auth.uid() OR client_id = auth.uid());

-- conversations: either participant can create the thread
CREATE POLICY "conversations_participant_insert" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (trainer_id = auth.uid() OR client_id = auth.uid());

-- messages: participants can read messages in their conversations
CREATE POLICY "messages_participant_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE trainer_id = auth.uid() OR client_id = auth.uid()
    )
  );

-- messages: sender must be authenticated participant
CREATE POLICY "messages_sender_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM public.conversations
      WHERE trainer_id = auth.uid() OR client_id = auth.uid()
    )
  );

-- messages: only the recipient can mark messages as read
CREATE POLICY "messages_recipient_mark_read" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id != auth.uid()
    AND conversation_id IN (
      SELECT id FROM public.conversations
      WHERE trainer_id = auth.uid() OR client_id = auth.uid()
    )
  )
  WITH CHECK (read = true);

COMMIT;
