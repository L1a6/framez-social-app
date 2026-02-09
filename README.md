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
