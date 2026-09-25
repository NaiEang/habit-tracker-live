-- ==============================================================================
-- CAPSTONE SCHEMA: HABITS & DAILY_LOGS WITH ROW LEVEL SECURITY (RLS)
-- Run this in your Supabase project: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Create HABITS table
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  priority TEXT DEFAULT 'Medium',
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create DAILY_LOGS table with Foreign Key and ON DELETE CASCADE
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES public.habits(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  completed BOOLEAN DEFAULT false,
  logged_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable Row-Level Security (RLS) on both tables
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for HABITS (auth.uid() = user_id)
DROP POLICY IF EXISTS "Users can view their own habits" ON public.habits;
CREATE POLICY "Users can view their own habits"
  ON public.habits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own habits" ON public.habits;
CREATE POLICY "Users can insert their own habits"
  ON public.habits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own habits" ON public.habits;
CREATE POLICY "Users can update their own habits"
  ON public.habits FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own habits" ON public.habits;
CREATE POLICY "Users can delete their own habits"
  ON public.habits FOR DELETE
  USING (auth.uid() = user_id);

-- 5. RLS Policies for DAILY_LOGS (auth.uid() = user_id)
DROP POLICY IF EXISTS "Users can view their own daily logs" ON public.daily_logs;
CREATE POLICY "Users can view their own daily logs"
  ON public.daily_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own daily logs" ON public.daily_logs;
CREATE POLICY "Users can insert their own daily logs"
  ON public.daily_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own daily logs" ON public.daily_logs;
CREATE POLICY "Users can update their own daily logs"
  ON public.daily_logs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own daily logs" ON public.daily_logs;
CREATE POLICY "Users can delete their own daily logs"
  ON public.daily_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 6. PROFILES TABLE & RLS POLICIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ==============================================================================
-- 7. STORAGE BUCKET & POLICIES FOR AVATARS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone can view avatar images (since bucket is public)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can only upload into their own folder: avatars/<auth.uid()>/...
DROP POLICY IF EXISTS "Users can upload avatar into own folder" ON storage.objects;
CREATE POLICY "Users can upload avatar into own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only update their own avatar file
DROP POLICY IF EXISTS "Users can update avatar in own folder" ON storage.objects;
CREATE POLICY "Users can update avatar in own folder"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar file
DROP POLICY IF EXISTS "Users can delete avatar in own folder" ON storage.objects;
CREATE POLICY "Users can delete avatar in own folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

