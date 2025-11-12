// app/index.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, {
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  useSharedValue,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

const slides = [
  {
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80",
    caption: "Capture Moments",
  },
  {
    image: "https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?w=800&q=80",
    caption: "Share Stories",
  },
  {
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
    caption: "Connect Lives",
  },
];

export default function WelcomeScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);
  const translateY = useSharedValue(30);

  useEffect(() => {
    opacity.value = withDelay(300, withTiming(1, { duration: 1000 }));
    scale.value = withDelay(
      300,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      300,
      withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <View style={styles.container}>
      {/* Background Slideshow */}
      {slides.map((slide, index) => (
        <Animated.View
          key={index}
          style={[
            styles.slide,
            {
              opacity: currentSlide === index ? 1 : 0,
            },
          ]}
        >
          <Image source={{ uri: slide.image }} style={styles.image} resizeMode="cover" />
          <LinearGradient
            colors={["rgba(0,30,70,0.7)", "rgba(0,10,20,0.2)", "rgba(5,7,10,0.95)"]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ))}

      {/* Navigation Arrows */}
      <TouchableOpacity style={[styles.arrow, styles.leftArrow]} onPress={prevSlide}>
        <Text style={styles.arrowText}>‹</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.arrow, styles.rightArrow]} onPress={nextSlide}>
        <Text style={styles.arrowText}>›</Text>
      </TouchableOpacity>

      {/* Slide Indicators */}
      <View style={styles.dotsContainer}>
        {slides.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setCurrentSlide(index)}
            style={[
              styles.dot,
              currentSlide === index ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Animated Content */}
      <Animated.View style={[animatedStyle, styles.content]}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>FRAMEZ</Text>
          <Text style={styles.subtitle}>CAPTURE YOUR WORLD</Text>
        </View>

        <Text style={styles.tagline}>
          Share moments that matter.{"\n"}Connect with people who inspire you.
        </Text>

        <TouchableOpacity onPress={() => router.push("/(auth)/login")} activeOpacity={0.9}>
          <LinearGradient
            colors={["#3b82f6", "#06b6d4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>GET STARTED</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>New to Framez? </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
            <Text style={styles.signUpLink}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Slide Caption */}
      <View style={styles.captionContainer}>
        <Text style={styles.caption}>{slides[currentSlide].caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05070a" },
  slide: { ...StyleSheet.absoluteFillObject, width, height },
  image: { width: "100%", height: "100%", transform: [{ scale: 1.1 }] },
  arrow: {
    position: "absolute",
    top: height / 2 - 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  leftArrow: { left: 16 },
  rightArrow: { right: 16 },
  arrowText: { color: "#b0d4ff", fontSize: 24 },
  dotsContainer: {
    position: "absolute",
    bottom: 16,
    width,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
  dotActive: { backgroundColor: "rgba(255,255,255,0.8)" },
  dotInactive: { backgroundColor: "rgba(255,255,255,0.3)" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 },
  logoContainer: { alignItems: "center", marginBottom: 32 },
  logo: {
    fontSize: 48,
    fontWeight: "900",
    color: "#e6f0ff",
    letterSpacing: 2,
    textShadowColor: "rgba(0, 120, 255, 0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: { color: "#b0d4ff", fontSize: 16, letterSpacing: 2, opacity: 0.8 },
  tagline: {
    color: "#e6f0ff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 48,
    lineHeight: 24,
    opacity: 0.9,
  },
  ctaButton: {
    paddingHorizontal: 64,
    paddingVertical: 16,
    borderRadius: 999,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  ctaText: { color: "#fff", fontSize: 18, fontWeight: "bold", letterSpacing: 1 },
  signUpContainer: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  signUpText: { color: "#b0d4ff", fontSize: 14 },
  signUpLink: { color: "#3b82f6", fontSize: 14, fontWeight: "bold" },
  captionContainer: { position: "absolute", bottom: 80, left: 16 },
  caption: {
    color: "#e6f0ff",
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 8, 49, 0.7)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
});