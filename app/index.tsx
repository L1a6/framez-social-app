import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
  StatusBar,
  Animated,
  Platform,
} from 'react-native';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

const slides = [
  'https://tse1.mm.bing.net/th/id/OIP.gyLuDHffR240aIyvBg3nigHaHa?cb=ucfimg2ucfimg=1&rs=1&pid=ImgDetMain&o=7&rm=3',
  'https://media.istockphoto.com/id/2155004308/photo/two-gen-z-friends-using-a-smartphone-together-low-angle-shot-with-modern-buildings-in-the.jpg?s=612x612&w=0&k=20&c=jP0dgbY9leX84Y0mp7F-FIjhOxAcHFKUhdw4rAg1gDA=',
  'https://media.istockphoto.com/id/1356527683/photo/male-vlogger-or-social-influencer-in-city-using-mobile-phone-on-street-to-post-to-social-media.jpg?s=612x612&w=0&k=20&c=OAqb7FepDByIr11CWuIfUMfuah7DBJrmDnisjAFYcK4=',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80',
];

const subtitles = [
  'Capture life in frames',
  'Share your moments',
  'Tell your story',
  'Vibes, stories, memories',
];

export default function WelcomeScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(0);
  const fadeAnim = new Animated.Value(0);
  const logoScale = new Animated.Value(0.9);

  // Slide rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Subtitle rotation
  useEffect(() => {
    const subtitleInterval = setInterval(() => {
      setCurrentSubtitleIndex((prev) => (prev + 1) % subtitles.length);
    }, 4000);
    return () => clearInterval(subtitleInterval);
  }, []);

  // Fade animation for subtitle
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [currentSubtitleIndex]);

  // Logo entrance animation
  useEffect(() => {
    Animated.spring(logoScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Background Image */}
      <Image
        source={{ uri: slides[currentSlide] }}
        style={styles.backgroundImage}
        blurRadius={3}
      />

      {/* Gradient overlay for better readability */}
      <View style={styles.gradientOverlay} />

      {/* Slide dots */}
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, currentSlide === i && styles.dotActive]}
          />
        ))}
      </View>

      {/* Foreground Content */}
      <View style={styles.content}>
        <View style={styles.top}>
          {/* Billabong-style Logo */}
          <Animated.View style={{ transform: [{ scale: logoScale }] }}>
            <Text style={styles.logo}>Framez</Text>
            <View style={styles.logoUnderline} />
          </Animated.View>

          {/* Animated subtitle */}
          <Animated.Text style={[styles.subtitle, { opacity: fadeAnim }]}>
            {subtitles[currentSubtitleIndex]}
          </Animated.Text>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => router.push('/(auth)/signup')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnSecondaryText}>Create Account</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            Join millions sharing their moments
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundImage: {
    position: 'absolute',
    width,
    height,
  },
  gradientOverlay: {
    position: 'absolute',
    width,
    height,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  dots: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 140,
    paddingBottom: 60,
    paddingHorizontal: 32,
  },
  top: {
    alignItems: 'center',
    gap: 20,
  },
  logo: {
    fontSize: 72,
    fontWeight: '400',
    color: '#FFFFFF',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  logoUnderline: {
    width: 100,
    height: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    alignSelf: 'center',
    borderRadius: 2,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '500',
    letterSpacing: 1.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottom: {
    gap: 16,
    alignItems: 'center',
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  btnPrimaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
  btnSecondary: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  btnSecondaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  footer: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});