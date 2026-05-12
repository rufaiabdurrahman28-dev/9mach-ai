-- 9mach AI - Database Migration
-- Run this SQL in the Supabase SQL Editor (Dashboard > SQL Editor)

-- ============================================
-- 1. Add is_approved column to profiles if not exists
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_approved'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_approved BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Set existing users as approved by default
UPDATE profiles SET is_approved = true WHERE is_approved IS NULL;

-- ============================================
-- 2. Create workspaces table
-- ============================================
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Workspace',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. Create messages table
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. Enable Row Level Security
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Profiles policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Service role full access" ON profiles
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 6. Workspaces policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can create own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Service role full access" ON workspaces;

CREATE POLICY "Users can view own workspaces" ON workspaces
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own workspaces" ON workspaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workspaces" ON workspaces
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workspaces" ON workspaces
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON workspaces
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 7. Messages policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can create own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
DROP POLICY IF EXISTS "Service role full access" ON messages;

CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can create own messages" ON messages
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can delete own messages" ON messages
  FOR DELETE USING (
    workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid())
  );
CREATE POLICY "Service role full access" ON messages
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 8. Auto-create profile on signup via trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
