// app/(auth)/signup.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !username || !fullName) {
      alert('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    if (username.length < 3) {
      alert('Username must be at least 3 characters');
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            username: username.trim().toLowerCase(),
          },
          emailRedirectTo: undefined,
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const userId = authData.user.id;

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        username: username.trim().toLowerCase(),
        full_name: fullName.trim(),
        avatar_url: null,
        bio: '',
        pronouns: '',
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      });

      if (profileError) {
        console.error('Profile error:', profileError);
      }

      setLoading(false);

      await supabase.auth.signOut();

      setSuccessModal(true);

      setTimeout(() => {
        setSuccessModal(false);
        setEmail('');
        setPassword('');
        setUsername('');
        setFullName('');
        router.replace('/(auth)/login');
      }, 2000);

    } catch (error: any) {
      console.log('Signup error:', error);
      setLoading(false);
      
      await supabase.auth.signOut();
      
      if (error.code === '23505') {
        alert('Email or username already exists');
      } else {
        alert(error?.message || 'Signup failed. Try again.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.logo}>Framez</Text>
          <View style={styles.logoUnderline} />
          <Text style={styles.subtitle}>Create Your Account</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#8B9DC3" />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#6B7280"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="at-outline" size={20} color="#8B9DC3" />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#6B7280"
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#8B9DC3" />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#6B7280"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#8B9DC3" />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#6B7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#8B9DC3"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.termsText}>
            By signing up, you agree to our Terms of Service and Privacy Policy
          </Text>

          <TouchableOpacity
            onPress={handleSignUp}
            disabled={loading}
            style={styles.signupButton}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal 
        visible={successModal} 
        transparent 
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={50} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.successTitle}>Account Created!</Text>
            <Text style={styles.successMessage}>
              Welcome to Framez, {fullName}!
            </Text>
            <Text style={styles.successSubMessage}>
              Redirecting to login...
            </Text>
            <View style={styles.loadingDots}>
              <View style={[styles.dot, styles.dotAnimation1]} />
              <View style={[styles.dot, styles.dotAnimation2]} />
              <View style={[styles.dot, styles.dotAnimation3]} />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { 
    fontSize: 56, 
    fontWeight: '400',
    color: '#FFFFFF', 
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive',
    marginBottom: 8 
  },
  logoUnderline: { width: 80, height: 2, backgroundColor: '#FFFFFF', marginBottom: 16, borderRadius: 2 },
  subtitle: { fontSize: 18, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, fontWeight: '400' },
  formContainer: { gap: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, height: 56 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '400', marginLeft: 12 },
  eyeIcon: { padding: 8 },
  termsText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 4 },
  signupButton: { backgroundColor: '#FFFFFF', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  signupButtonText: { color: '#000000', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  loginContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  loginText: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },
  loginLink: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.97)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24 
  },
  successCard: { 
    backgroundColor: '#1a1a1a', 
    borderRadius: 32, 
    padding: 48, 
    alignItems: 'center', 
    width: '100%', 
    maxWidth: 360, 
    borderWidth: 2, 
    borderColor: 'rgba(16,185,129,0.3)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  successIconContainer: { 
    marginBottom: 28 
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: '#FFFFFF', 
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  successMessage: { 
    fontSize: 18, 
    color: 'rgba(255,255,255,0.9)', 
    textAlign: 'center', 
    lineHeight: 26,
    marginBottom: 8,
  },
  successSubMessage: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  dotAnimation1: {
    opacity: 0.3,
  },
  dotAnimation2: {
    opacity: 0.6,
  },
  dotAnimation3: {
    opacity: 1,
  },
});