// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // Check session on mount
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          router.replace('/(tabs)/feed'); // redirect if logged in
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setSessionChecked(true); // allow children to render
      }
    };

    checkAuth();

    // Listen to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/(tabs)/feed');
      } else if (event === 'SIGNED_OUT') {
        router.replace('/');
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  if (!sessionChecked) {
    return null; 
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
        animation: 'fade',
      }}
    >
      {children}
    </Stack>
  );
}