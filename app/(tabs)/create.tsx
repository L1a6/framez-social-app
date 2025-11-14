// app/(tabs)/create.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';

export default function CreateScreen() {
  const [caption, setCaption] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const file = result.assets[0];
      setMediaUri(file.uri);
      setMediaType(file.type === 'video' ? 'video' : 'image');
    }
  };

  const takeMedia = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const file = result.assets[0];
      setMediaUri(file.uri);
      setMediaType(file.type === 'video' ? 'video' : 'image');
    }
  };

  const uploadMedia = async (uri: string, userId: string) => {
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      
      const fileExt = uri.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg');
      const fileName = `${userId}/posts/${Date.now()}.${fileExt}`;
      const bucketName = mediaType === 'video' ? 'Videos' : 'Images';

      console.log('Uploading to bucket:', bucketName, 'File:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, arrayBuffer, {
          contentType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handlePost = async () => {
    if (!mediaUri && !caption.trim()) {
      Alert.alert('Error', 'Please add an image, video, or caption');
      return;
    }

    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      let imageUrl = null;
      let videoUrl = null;

      if (mediaUri && mediaType) {
        const uploadedUrl = await uploadMedia(mediaUri, user.id);
        if (mediaType === 'image') imageUrl = uploadedUrl;
        if (mediaType === 'video') videoUrl = uploadedUrl;
      }

      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        caption: caption.trim() || null,
        image_url: imageUrl,
        video_url: videoUrl,
        likes_count: 0,
        comments_count: 0,
      });

      if (error) throw error;

      setSuccessModal(true);
      setTimeout(() => {
        setSuccessModal(false);
        setCaption('');
        setMediaUri(null);
        setMediaType(null);
        router.push('/(tabs)/feed');
      }, 1500);
    } catch (error: any) {
      console.error('Post error:', error);
      Alert.alert('Error', error.message || 'Failed to create post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={loading || (!mediaUri && !caption)}
        >
          <Text
            style={[
              styles.postButton,
              (!mediaUri && !caption) && styles.postButtonDisabled,
            ]}
          >
            {loading ? 'Posting...' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {mediaUri ? (
          <View style={styles.previewContainer}>
            {mediaType === 'image' ? (
              <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
            ) : (
              <Video
                source={{ uri: mediaUri }}
                style={styles.mediaPreview}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay
                isLooping
              />
            )}
            <TouchableOpacity
              onPress={() => {
                setMediaUri(null);
                setMediaType(null);
              }}
              style={styles.removeButton}
            >
              <Ionicons name="close-circle" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <TouchableOpacity onPress={pickMedia} style={styles.uploadButton}>
              <Ionicons name="images-outline" size={48} color="#FFFFFF" />
              <Text style={styles.uploadText}>Choose from Library</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity onPress={takeMedia} style={styles.uploadButton}>
              <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
              <Text style={styles.uploadText}>Take Photo or Video</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.captionBox}>
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={caption}
            onChangeText={setCaption}
            multiline
          />
        </View>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Creating post...</Text>
        </View>
      )}

      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
            <Text style={styles.successTitle}>Post Created!</Text>
            <Text style={styles.successMessage}>Your post is now live</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  postButton: { fontSize: 16, fontWeight: '700', color: '#fff' },
  postButtonDisabled: { color: 'rgba(255,255,255,0.3)' },
  previewContainer: { position: 'relative' },
  mediaPreview: { width: '100%', height: 400, backgroundColor: '#111' },
  removeButton: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16 },
  placeholder: { height: 400, justifyContent: 'center', alignItems: 'center' },
  uploadButton: { alignItems: 'center', gap: 12 },
  uploadText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { width: 60, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 24 },
  captionBox: { padding: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' },
  captionInput: { color: '#fff', fontSize: 16, minHeight: 100 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  successCard: { backgroundColor: '#1a1a1a', borderRadius: 24, padding: 40, alignItems: 'center', width: '100%', maxWidth: 320, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  successTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginTop: 20, marginBottom: 8 },
  successMessage: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
});