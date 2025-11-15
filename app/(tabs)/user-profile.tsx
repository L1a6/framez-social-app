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
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const ITEM_SIZE = Math.floor((width - 4) / 3);

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messagingModal, setMessagingModal] = useState(false);

  useEffect(() => {
    getCurrentUser();
    fetchProfile();
  }, [userId]);

  useEffect(() => {
    const channel = supabase
      .channel('user_profile_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
        fetchProfile();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchProfile();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setCurrentUserId(data.user.id);
    }
  };

  const fetchProfile = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);

      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const postsWithViews = await Promise.all(
        (postsData || []).map(async (post) => {
          const { count: viewsCount } = await supabase
            .from('post_views')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          return {
            ...post,
            views_count: viewsCount || 0,
          };
        })
      );

      setPosts(postsWithViews);

      const { count: followersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

      const { count: followingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

      setFollowersCount(followersCount || 0);
      setFollowingCount(followingCount || 0);

      if (currentUserId) {
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', userId)
          .maybeSingle();

        setIsFollowing(!!followData);
      }

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

  const handleFollow = async () => {
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please login to follow users');
      return;
    }

    if (followLoading) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', userId);
        
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));

        await supabase
          .from('notification_tracking')
          .delete()
          .eq('actor_id', currentUserId)
          .eq('recipient_id', userId)
          .eq('action_type', 'follow');
      } else {
        await supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: userId,
        });
        
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);

        await supabase.rpc('create_notification_safe', {
          p_recipient_id: userId,
          p_actor_id: currentUserId,
          p_type: 'follow',
          p_entity_id: null,
          p_message: 'started following you'
        });
      }
    } catch (error) {
      console.error('Error following:', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const renderPostItem = (post: any) => {
    if (post.image_url) {
      return (
        <View style={styles.gridMediaContainer}>
          <Image source={{ uri: post.image_url }} style={styles.gridMedia} />
          {post.views_count > 0 && (
            <View style={styles.viewsOverlay}>
              <Ionicons name="eye" size={12} color="#FFFFFF" />
              <Text style={styles.viewsText}>{post.views_count}</Text>
            </View>
          )}
        </View>
      );
    } else if (post.caption) {
      return (
        <View style={[styles.gridMedia, styles.textOnlyPost]}>
          <Text style={styles.textOnlyCaption} numberOfLines={5}>{post.caption}</Text>
          {post.views_count > 0 && (
            <View style={styles.viewsOverlay}>
              <Ionicons name="eye" size={12} color="#FFFFFF" />
              <Text style={styles.viewsText}>{post.views_count}</Text>
            </View>
          )}
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
        <Text style={styles.errorText}>Profile not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerUsername}>@{profile.username}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFF" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <Image
            source={{
              uri: profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=6366f1&color=fff`,
            }}
            style={styles.avatar}
          />

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

        {currentUserId !== userId && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator color={isFollowing ? "#FFFFFF" : "#000000"} size="small" />
              ) : (
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => setMessagingModal(true)}
            >
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.divider} />

        {posts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        ) : (
          <View style={styles.postsGrid}>
            {posts.map((post) => (
              <TouchableOpacity 
                key={post.id} 
                style={styles.gridItem}
                onPress={() => router.push(`/post/${post.id}`)}
              >
                {renderPostItem(post)}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={messagingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.comingSoonCard}>
            <Ionicons name="chatbubbles" size={48} color="#6366f1" />
            <Text style={styles.comingSoonTitle}>Messaging</Text>
            <Text style={styles.comingSoonMessage}>Direct messaging coming soon!</Text>
            <TouchableOpacity style={styles.comingSoonButton} onPress={() => setMessagingModal(false)}>
              <Text style={styles.comingSoonButtonText}>Got it</Text>
            </TouchableOpacity>
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
  backButton: { padding: 4 },
  headerUsername: { fontSize: 18, fontWeight: '600', color: '#888' },
  profileSection: { alignItems: 'center', padding: 20, gap: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: '#333' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', maxWidth: 400 },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  statLabel: { fontSize: 13, color: '#888', marginTop: 2 },
  bioSection: { paddingHorizontal: 20, paddingBottom: 16, alignItems: 'center' },
  displayName: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  pronouns: { fontSize: 14, color: '#888', marginBottom: 8 },
  bio: { fontSize: 14, color: '#DDD', lineHeight: 20, textAlign: 'center' },
  noBio: { fontSize: 14, color: '#666', fontStyle: 'italic' },
  actionsContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 12 },
  followButton: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, height: 36, justifyContent: 'center', alignItems: 'center' },
  followingButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FFFFFF' },
  followButtonText: { color: '#000000', fontSize: 15, fontWeight: '700' },
  followingButtonText: { color: '#FFFFFF' },
  messageButton: { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 10, height: 36, justifyContent: 'center', alignItems: 'center' },
  messageButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 8 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyText: { color: '#888', fontSize: 18, fontWeight: '600', marginTop: 16 },
  postsGrid: { flexDirection: 'row', flexWrap: 'wrap', margin: -1 },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, margin: 1 },
  gridMediaContainer: { width: '100%', height: '100%', position: 'relative' },
  gridMedia: { width: '100%', height: '100%', backgroundColor: '#111' },
  textOnlyPost: { justifyContent: 'center', alignItems: 'center', padding: 8, backgroundColor: '#1a1a1a' },
  textOnlyCaption: { color: '#FFF', fontSize: 12, textAlign: 'center' },
  emptyPost: { backgroundColor: '#0a0a0a' },
  viewsOverlay: { position: 'absolute', bottom: 4, right: 4, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  viewsText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  comingSoonCard: { backgroundColor: '#1a1a1a', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', maxWidth: 300, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  comingSoonTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginTop: 16, marginBottom: 8 },
  comingSoonMessage: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  comingSoonButton: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, width: '100%' },
  comingSoonButtonText: { color: '#000000', fontSize: 15, fontWeight: '700', textAlign: 'center' },
});