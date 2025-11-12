import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yjtrvgubcudbrvumwwon.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqdHJ2Z3ViY3VkYnJ2dW13d29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3ODA5NzYsImV4cCI6MjA3ODM1Njk3Nn0.9dgasrrGhqy-Btz715X2_7oxgGini_8H3g2U0d4Rjkk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});