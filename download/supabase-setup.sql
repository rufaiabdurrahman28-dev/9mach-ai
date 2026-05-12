-- =====================================================
-- 9mach AI - Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. Create nimarc_users table
CREATE TABLE IF NOT EXISTS public.nimarc_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  is_approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 2. Create nimarc_workspaces table
CREATE TABLE IF NOT EXISTS public.nimarc_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.nimarc_users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Workspace',
  created_at timestamptz DEFAULT now()
);

-- 3. Create nimarc_messages table
CREATE TABLE IF NOT EXISTS public.nimarc_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.nimarc_workspaces(id) ON DELETE CASCADE,
  role text CHECK (role IN ('user', 'ai')) NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. Enable Row Level Security
ALTER TABLE public.nimarc_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nimarc_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nimarc_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for nimarc_users
CREATE POLICY "Users can read own profile" ON public.nimarc_users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.nimarc_users
  FOR UPDATE USING (auth.uid() = id);

-- 6. RLS Policies for nimarc_workspaces
CREATE POLICY "User workspaces" ON public.nimarc_workspaces
  FOR ALL USING (auth.uid() = user_id);

-- 7. RLS Policies for nimarc_messages
CREATE POLICY "User messages" ON public.nimarc_messages
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM public.nimarc_workspaces WHERE user_id = auth.uid()
    )
  );

-- 8. Auto-approve existing admin/manager users from profiles table
-- This allows your existing account (rufaiabdurrahman28@gmail.com) to access 9mach AI
INSERT INTO public.nimarc_users (id, email, full_name, is_approved)
SELECT id, email, full_name, true
FROM public.profiles
WHERE role IN ('admin', 'manager')
ON CONFLICT (email) DO UPDATE SET is_approved = true;

-- 9. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON public.nimarc_workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON public.nimarc_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.nimarc_messages(workspace_id, created_at);

-- Done! ✅
