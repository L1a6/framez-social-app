// app/post/_layout.tsx
import { Stack } from 'expo-router';

export default function PostLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        animation: 'slide_from_bottom',
        headerShown: false,
      }}
    />
  );
}