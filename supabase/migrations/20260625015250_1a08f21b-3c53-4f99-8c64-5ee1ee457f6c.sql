
-- Conversations
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_preview TEXT,
  unread_admin INTEGER NOT NULL DEFAULT 0,
  unread_student INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id)
);

GRANT SELECT, INSERT, UPDATE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_conv_student_own"
ON public.chat_conversations FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "chat_conv_student_insert"
ON public.chat_conversations FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "chat_conv_student_update"
ON public.chat_conversations FOR UPDATE TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "chat_conv_tenant_staff_select"
ON public.chat_conversations FOR SELECT TO authenticated
USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','instructor']::tenant_role[]));

CREATE POLICY "chat_conv_tenant_staff_update"
ON public.chat_conversations FOR UPDATE TO authenticated
USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','instructor']::tenant_role[]));

CREATE POLICY "chat_conv_super_admin"
ON public.chat_conversations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_chat_conv_tenant ON public.chat_conversations(tenant_id, last_message_at DESC);
CREATE INDEX idx_chat_conv_student ON public.chat_conversations(student_id, last_message_at DESC);

-- Messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('student','admin')),
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_msg_student_own"
ON public.chat_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.student_id = auth.uid()));

CREATE POLICY "chat_msg_student_insert"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND sender_role = 'student'
  AND EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.student_id = auth.uid())
);

CREATE POLICY "chat_msg_tenant_staff_select"
ON public.chat_messages FOR SELECT TO authenticated
USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','instructor']::tenant_role[]));

CREATE POLICY "chat_msg_tenant_staff_insert"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND sender_role = 'admin'
  AND public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','instructor']::tenant_role[])
);

CREATE POLICY "chat_msg_super_admin"
ON public.chat_messages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_chat_msg_conv ON public.chat_messages(conversation_id, created_at);

-- Trigger: bump conversation on new message
CREATE OR REPLACE FUNCTION public.trg_chat_message_bump()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.body, 120),
      unread_admin = CASE WHEN NEW.sender_role = 'student' THEN unread_admin + 1 ELSE unread_admin END,
      unread_student = CASE WHEN NEW.sender_role = 'admin' THEN unread_student + 1 ELSE unread_student END,
      updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.trg_chat_message_bump() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chat_message_bump
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_chat_message_bump();

-- Realtime publication
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
