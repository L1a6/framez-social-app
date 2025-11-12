# FRAMEZ - Ultra-Modern Social Media App

A production-ready Instagram-style social media application built with React Native, Expo Router, and Supabase.

## Features

- Beautiful welcome screen with image slideshow
- User authentication (signup/login)
- Create posts with images/videos
- Like and comment on posts
- Follow/unfollow users
- Explore and search functionality
- User profiles with edit capabilities
- Real-time notifications
- Image upload to Supabase storage
- Fully functional feed with Instagram-style UI

## Prerequisites

- Node.js 16+
- Expo CLI
- Supabase account
- iOS Simulator or Android Emulator (or physical device)

## Installation

1. Install dependencies:
bash
npm install


2. Create lib/supabase.ts file:
typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


3. Set up Supabase:

### Database Tables

Run these SQL commands in Supabase SQL Editor:

sql
-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  caption TEXT,
  image_url TEXT,
  video_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Likes table
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Comments table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Follows table
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;


### RLS Policies

sql
-- Profiles policies
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete their own profile" ON profiles FOR DELETE USING (auth.uid() = id);

-- Posts policies
CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON posts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Likes policies
CREATE POLICY "Likes are viewable by everyone" ON likes FOR SELECT USING (true);
CREATE POLICY "Users can like posts" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their comments" ON comments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Follows policies
CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);


### Auto-create Profile Trigger

sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://ui-avatars.com/api/?name=' || split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


### Storage Setup

1. Create images bucket (public)
2. Create videos bucket (public)
3. Add storage policies:

sql
-- Storage policies for images and videos
CREATE POLICY "Public files are viewable by everyone" ON storage.objects FOR SELECT USING (bucket_id = 'images' OR bucket_id = 'videos');
CREATE POLICY "Users can upload to their own folder" ON storage.objects FOR INSERT WITH CHECK ((bucket_id = 'images' OR bucket_id = 'videos') AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own files" ON storage.objects FOR UPDATE USING ((bucket_id = 'images' OR bucket_id = 'videos') AND (auth.uid())::text = (storage.foldername(name))[1]) WITH CHECK ((bucket_id = 'images' OR bucket_id = 'videos') AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own files" ON storage.objects FOR DELETE USING ((bucket_id = 'images' OR bucket_id = 'videos') AND (auth.uid())::text = (storage.foldername(name))[1]);


### Supabase Authentication Settings

1. Go to Authentication -> Providers -> Email
2. Enable email provider
3. Disable "Confirm email"
4. Enable "Enable email autoconfirm"

## Run the App

bash
# Start development server
npx expo start

# Run on iOS
npx expo start --ios

# Run on Android
npx expo start --android

# Clear cache
npx expo start -c


## Folder Structure


app/
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── signup.tsx
├── (tabs)/
│   ├── _layout.tsx
│   ├── feed.tsx
│   ├── explore.tsx
│   ├── create.tsx
│   ├── notifications.tsx
│   └── profile.tsx
├── post/
│   └── [id].tsx
├── user/
│   └── [id].tsx
├── _layout.tsx
└── index.tsx
lib/
└── supabase.ts
types/
└── database.ts


## Key Features Implementation

### Image Upload
Images are uploaded to Supabase Storage in folder structure: userId/posts/timestamp.jpg

### Real-time Updates
The app fetches fresh data on:
- Pull to refresh on feed
- Navigating back to feed
- After creating/deleting posts

### Follow System
Users can follow/unfollow other users, with follower counts updated in real-time.

### Comments
Full comment functionality with real-time updates and comment count tracking.

### Search
Search both posts (by caption) and users (by username or full name).

## Troubleshooting

### Images not uploading
- Check Supabase storage policies
- Verify bucket is public
- Ensure user is authenticated

### RLS errors
- Verify all policies are created
- Check user authentication status
- Ensure profile exists for user

### Navigation issues
- Clear Metro cache: npx expo start -c
- Reinstall dependencies: rm -rf node_modules && npm install

## License

MIT

## Credits

Built with React Native, Expo Router, Supabase, and lots of attention to detail.