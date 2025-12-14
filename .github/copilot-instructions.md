# Framez Social App 
## Project Overview
Instagram-style social media app built with **Expo Router v6**, **React Native 0.81**, **Supabase**, and **NativeWind/TailwindCSS**. Dark theme (#000000 background) throughout.

## Architecture

### File Structure
```
app/                    # Expo Router file-based routing
├── _layout.tsx         # Root layout with auth state management
├── index.tsx           # Welcome screen (unauthenticated landing)
├── (auth)/             # Auth group (login, signup)
├── (tabs)/             # Main tab navigation (feed, explore, create, notifications, profile)
├── post/[id].tsx       # Dynamic post detail route
└── user/[id].tsx       # Dynamic user profile route
lib/supabase.ts         # Supabase client singleton
types/database.ts       # TypeScript interfaces for all DB tables
```

### Data Flow
1. **Auth**: `supabase.auth` → session check in `_layout.tsx` → redirect to `/(tabs)/feed` or `/`
2. **Posts**: Supabase `posts` table with `profiles` join via `user_id`
3. **Media**: Images → `Images` bucket, Videos → `Videos` bucket in Supabase Storage
4. **Real-time**: Supabase channels for notifications and follows

### Key Supabase Tables
- `profiles` (id, username, full_name, avatar_url, bio)
- `posts` (id, user_id, caption, image_url, video_url, likes_count, comments_count)
- `likes`, `comments`, `follows`, `notifications`

## Conventions

### Styling
- Use `StyleSheet.create()` at bottom of each file (not NativeWind classes in JSX)
- Dark theme constants: background `#000000`, text `#FFFFFF`, accent `#6366f1`
- Platform-specific: `Platform.OS === 'ios' ? value : value`

### Components
- Use `React.memo()` for list item components (see `MediaCarousel`, `VideoPlayer` in feed.tsx)
- Icons: `@expo/vector-icons` → `Ionicons` only
- Video: `expo-video` with `useVideoPlayer` hook (NOT expo-av for video playback)
- Images: `expo-image` or React Native `Image`

### Navigation
```tsx
import { router } from 'expo-router';
router.push('/(tabs)/feed');      // Navigate
router.replace('/');               // Replace (no back)
router.back();                     // Go back
```

### Supabase Patterns
```tsx
// Fetch with profile join
const { data } = await supabase
  .from('posts')
  .select('*, profiles(*)')
  .order('created_at', { ascending: false });

// Upload media
const { data, error } = await supabase.storage
  .from('Images')  // or 'Videos'
  .upload(`${userId}/posts/${Date.now()}.jpg`, arrayBuffer, {
    contentType: 'image/jpeg'
  });
```

### State Management
- Local state with `useState` (no Redux/Zustand)
- Auth state via `supabase.auth.onAuthStateChange()`
- Optimistic UI updates for likes/follows

## Build & Development

### Commands
```bash
npx expo start              # Dev server (requires Expo Go or dev client)
npx expo start --tunnel     # Dev with ngrok tunnel
eas build --platform android --profile preview  # Build APK
eas build --platform android --profile production  # Production AAB
```

### EAS Build Profiles
- `development`: Dev client with hot reload
- `preview`: Internal APK for testing
- `production`: Play Store ready (auto-increment version)

### Environment Variables
Supabase credentials are in `lib/supabase.ts` (hardcoded). For EAS builds, they're also in EAS Secrets as `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

## Common Tasks

### Add a New Screen
1. Create file in appropriate route group (`app/(tabs)/newscreen.tsx`)
2. Add to tab bar in `app/(tabs)/_layout.tsx` if needed
3. Follow existing screen patterns (container style, header, etc.)

### Add Supabase Table
1. Add SQL to Supabase dashboard (see README.md for examples)
2. Add TypeScript interface to `types/database.ts`
3. Enable RLS policies

### Media Upload Flow
See `create.tsx`: pick media → convert to ArrayBuffer → upload to Supabase Storage → get public URL → save URL to posts table
