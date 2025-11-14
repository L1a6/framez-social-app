// app/(tabs)/profile.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const ITEM_SIZE = Math.floor((width - 4) / 3);

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPronouns, setEditPronouns] = useState('');
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in to view your profile');
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
      }

      if (!profileData) {
        const defaultProfile = {
          id: user.id,
          username: user.user_metadata?.username || user.email?.split('@')[0].toLowerCase() || 'user',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          bio: '',
          pronouns: '',
          avatar_url: null,
        };

        const { error: createError } = await supabase
          .from('profiles')
          .insert([defaultProfile]);

        if (createError) {
          console.error('Failed to create profile:', createError);
        } else {
          profileData = defaultProfile;
        }
      }

      setProfile(profileData);
      setEditFullName(profileData?.full_name || '');
      setEditUsername(profileData?.username || '');
      setEditBio(profileData?.bio || '');
      setEditPronouns(profileData?.pronouns || '');

      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setPosts(postsData || []);

      const { count: followersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      const { count: followingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      setFollowersCount(followersCount || 0);
      setFollowingCount(followingCount || 0);

    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleUpdateProfile = async () => {
    if (!editUsername || editUsername.length < 3) {
      Alert.alert('Invalid username', 'Username must be at least 3 characters');
      return;
    }

    try {
      if (!currentUserId) return;
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName,
          username: editUsername.toLowerCase(),
          bio: editBio,
          pronouns: editPronouns,
        })
        .eq('id', currentUserId);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated!');
      setEditModalVisible(false);
      fetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo library access');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadAvatar = async (uri: string) => {
    try {
      if (!currentUserId) return;
      setUploading(true);

      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const fileName = `${currentUserId}/${Date.now()}.jpg`;

      console.log('Uploading avatar to bucket: avatars, File:', fileName);

      const { data: uploadData, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('Avatar upload error:', error);
        throw error;
      }

      console.log('Avatar upload successful:', uploadData);

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrlData.publicUrl })
        .eq('id', currentUserId);

      Alert.alert('Success', 'Profile picture updated!');
      fetchProfile();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', 'Failed to upload avatar. Check storage policies.');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const renderPostItem = (post: any) => {
    if (post.image_url) {
      return <Image source={{ uri: post.image_url }} style={styles.gridMedia} />;
    } else if (post.caption) {
      return (
        <View style={[styles.gridMedia, styles.textOnlyPost]}>
          <Text style={styles.textOnlyCaption} numberOfLines={5}>{post.caption}</Text>
        </View>
      );
    }
    return <View style={[styles.gridMedia, styles.emptyPost]} />;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#666" />
        <Text style={styles.errorText}>Unable to load profile</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = currentUserId === profile.id;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerUsername}>@{profile.username}</Text>
        <View style={styles.headerActions}>
          {isOwner && (
            <TouchableOpacity onPress={() => setEditModalVisible(true)}>
              <Ionicons name="create-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFF" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={isOwner ? handlePickImage : undefined} style={styles.avatarContainer}>
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#FFF" />
              </View>
            )}
            <Image
              source={{
                uri: profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=6366f1&color=fff`,
              }}
              style={styles.avatar}
            />
            {isOwner && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={16} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        <View style={styles.bioSection}>
          <Text style={styles.displayName}>{profile.full_name}</Text>
          {profile.pronouns && <Text style={styles.pronouns}>{profile.pronouns}</Text>}
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <Text style={styles.noBio}>No bio yet</Text>
          )}
        </View>

        <View style={styles.divider} />

        {posts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Share your first post!</Text>
          </View>
        ) : (
          <View style={styles.postsGrid}>
            {posts.map((post) => (
              <TouchableOpacity key={post.id} style={styles.gridItem}>
                {renderPostItem(post)}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={handleUpdateProfile}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Display Name</Text>
                <TextInput style={styles.input} value={editFullName} onChangeText={setEditFullName} placeholder="Full Name" placeholderTextColor="#666" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput style={styles.input} value={editUsername} onChangeText={setEditUsername} placeholder="Username" placeholderTextColor="#666" autoCapitalize="none" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pronouns</Text>
                <TextInput style={styles.input} value={editPronouns} onChangeText={setEditPronouns} placeholder="Pronouns" placeholderTextColor="#666" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput style={[styles.input, styles.textArea]} value={editBio} onChangeText={setEditBio} placeholder="Bio" placeholderTextColor="#666" multiline numberOfLines={4} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  loadingText: { color: '#FFF', marginTop: 16, fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 24 },
  errorText: { color: '#666', fontSize: 18, marginTop: 16, marginBottom: 24 },
  retryButton: { backgroundColor: '#6366f1', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 },
  retryText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerUsername: { fontSize: 18, fontWeight: '600', color: '#888' },
  headerActions: { flexDirection: 'row', gap: 16 },
  profileSection: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 20 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: '#333' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#6366f1', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
  uploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 44, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  statsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  statLabel: { fontSize: 13, color: '#888', marginTop: 2 },
  bioSection: { paddingHorizontal: 20, paddingBottom: 16 },
  displayName: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  pronouns: { fontSize: 14, color: '#888', marginBottom: 8 },
  bio: { fontSize: 14, color: '#DDD', lineHeight: 20 },
  noBio: { fontSize: 14, color: '#666', fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 8 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyText: { color: '#888', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: '#666', fontSize: 14, marginTop: 8 },
  postsGrid: { flexDirection: 'row', flexWrap: 'wrap', margin: -1 },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, margin: 1 },
  gridMedia: { width: '100%', height: '100%', backgroundColor: '#111' },
  textOnlyPost: { justifyContent: 'center', alignItems: 'center', padding: 8, backgroundColor: '#1a1a1a' },
  textOnlyCaption: { color: '#FFF', fontSize: 12, textAlign: 'center' },
  emptyPost: { backgroundColor: '#0a0a0a' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  modalCancel: { color: '#888', fontSize: 16 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  modalSave: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  modalScroll: { padding: 20 },
  inputGroup: { marginBottom: 24 },
  inputLabel: { color: '#AAA', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#0a0a0a', color: '#FFF', padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  textArea: { height: 100, textAlignVertical: 'top' },
});