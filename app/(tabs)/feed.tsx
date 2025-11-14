// app/(tabs)/feed.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function FeedScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messagingModal, setMessagingModal] = useState(false);
  const [menuModal, setMenuModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getCurrentUser();
    fetchPosts();
    setupRealtimeSubscription();
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('all_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => fetchPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => fetchPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
        if (currentUser) fetchFollowing(currentUser.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        if (currentUser) fetchUnreadCount();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    setCurrentUser(data.user);
    if (data.user) {
      await fetchFollowing(data.user.id);
      await fetchUnreadCount();
    }
  };

  const fetchUnreadCount = async () => {
    if (!currentUser) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', currentUser.id)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  };

  const fetchFollowing = async (userId: string) => {
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);
    
    if (data) {
      setFollowing(new Set(data.map(f => f.following_id)));
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (currentUser) {
        const postsWithData = await Promise.all(
          data.map(async (post) => {
            const { data: likeData } = await supabase
              .from('likes')
              .select('id')
              .eq('post_id', post.id)
              .eq('user_id', currentUser.id)
              .maybeSingle();

            await trackView(post.id);

            return {
              ...post,
              is_liked: !!likeData,
            };
          })
        );

        setPosts(postsWithData);
      } else {
        setPosts(data);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const trackView = async (postId: string) => {
    if (!currentUser) return;
    try {
      await supabase.from('post_views').insert({
        post_id: postId,
        user_id: currentUser.id,
      }).select().single();
    } catch (error) {
      console.log('View already tracked');
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, []);

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
  };

  const handleLike = async (postId: string) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to like posts');
      return;
    }

    const post = posts.find((p) => p.id === postId);
    const isLiked = post?.is_liked;

    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              is_liked: !isLiked,
              likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1,
            }
          : p
      )
    );

    try {
      if (isLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
      } else {
        await supabase.from('likes').insert({
          post_id: postId,
          user_id: currentUser.id,
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId
            ? {
                ...p,
                is_liked: isLiked,
                likes_count: isLiked ? p.likes_count + 1 : p.likes_count - 1,
              }
            : p
        )
      );
    }
  };

  const handleFollow = async (userId: string) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to follow users');
      return;
    }

    const isFollowing = following.has(userId);

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId);
        
        setFollowing(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      } else {
        await supabase.from('follows').insert({
          follower_id: currentUser.id,
          following_id: userId,
        });
        
        setFollowing(prev => new Set(prev).add(userId));
      }
    } catch (error) {
      console.error('Error following:', error);
    }
  };

  const openMenu = (post: any) => {
    setSelectedPost(post);
    setMenuModal(true);
  };

  const handleProfileClick = (userId: string) => {
    if (userId === currentUser?.id) {
      router.push('/(tabs)/profile');
    } else {
      router.push(`/(tabs)/user-profile?userId=${userId}`);
    }
  };

  const renderPost = ({ item }: { item: any }) => (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => handleProfileClick(item.user_id)}
        >
          <Image
            source={{
              uri: item.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.profiles?.full_name || 'User')}&background=6366f1&color=fff`,
            }}
            style={styles.avatar}
          />
          <Text style={styles.displayName}>{item.profiles?.full_name}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openMenu(item)}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {item.image_url && (
        <TouchableOpacity
          onPress={() => router.push(`/post/${item.id}`)}
          activeOpacity={0.95}
        >
          <Image source={{ uri: item.image_url }} style={styles.postImage} />
        </TouchableOpacity>
      )}

      {item.caption && !item.image_url && !item.video_url && (
        <View style={styles.textOnlyPost}>
          <Text style={styles.textOnlyCaption}>{item.caption}</Text>
        </View>
      )}

      <View style={styles.postActions}>
        <View style={styles.leftActions}>
          <TouchableOpacity
            onPress={() => handleLike(item.id)}
            style={styles.actionButton}
          >
            <Ionicons
              name={item.is_liked ? 'heart' : 'heart-outline'}
              size={28}
              color={item.is_liked ? '#FF3B30' : '#FFFFFF'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/post/${item.id}`)}
            style={styles.actionButton}
          >
            <Ionicons name="chatbubble-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setMessagingModal(true)}
          >
            <Ionicons name="paper-plane-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.postInfo}>
        <Text style={styles.likesCount}>{item.likes_count} likes</Text>
        {item.caption && (item.image_url || item.video_url) && (
          <Text style={styles.caption}>
            <Text style={styles.captionDisplayName}>{item.profiles?.full_name} </Text>
            {item.caption}
          </Text>
        )}
        {item.comments_count > 0 && (
          <TouchableOpacity onPress={() => router.push(`/post/${item.id}`)}>
            <Text style={styles.viewComments}>View all {item.comments_count} comments</Text>
          </TouchableOpacity>
        )}
        <View style={styles.metaInfo}>
          <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
          <Text style={styles.views}>{item.views_count} views</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Framez</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setMessagingModal(true)}
          >
            <Ionicons name="chatbubbles-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <Ionicons name="notifications-outline" size={28} color="#FFFFFF" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />

      <Modal visible={messagingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.comingSoonCard}>
            <Ionicons name="chatbubbles" size={64} color="#6366f1" />
            <Text style={styles.comingSoonTitle}>Messaging</Text>
            <Text style={styles.comingSoonMessage}>Direct messaging coming soon!</Text>
            <TouchableOpacity style={styles.comingSoonButton} onPress={() => setMessagingModal(false)}>
              <Text style={styles.comingSoonButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={menuModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuModal(false);
                if (selectedPost) handleProfileClick(selectedPost.user_id);
              }}
            >
              <Ionicons name="person-outline" size={24} color="#FFFFFF" />
              <Text style={styles.menuItemText}>View Profile</Text>
            </TouchableOpacity>
            
            {selectedPost && selectedPost.user_id !== currentUser?.id && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  if (selectedPost) {
                    handleFollow(selectedPost.user_id);
                    setMenuModal(false);
                  }
                }}
              >
                <Ionicons 
                  name={following.has(selectedPost.user_id) ? "person-remove-outline" : "person-add-outline"} 
                  size={24} 
                  color="#FFFFFF" 
                />
                <Text style={styles.menuItemText}>
                  {following.has(selectedPost.user_id) ? 'Unfollow' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={[styles.menuItem, styles.menuItemCancel]} onPress={() => setMenuModal(false)}>
              <Text style={styles.menuItemCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loadingContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  logo: { fontSize: 32, fontWeight: '400', color: '#FFFFFF', letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive' },
  headerActions: { flexDirection: 'row', gap: 16 },
  headerButton: { padding: 4, position: 'relative' },
  notificationBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  listContent: { paddingBottom: 20 },
  postContainer: { marginBottom: 24 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  displayName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  postImage: { width: width, height: width, backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  textOnlyPost: { paddingHorizontal: 16, paddingVertical: 32, backgroundColor: '#0a0a0a', marginHorizontal: 16, borderRadius: 12, marginTop: 8 },
  textOnlyCaption: { color: '#FFFFFF', fontSize: 16, lineHeight: 24 },
  postActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  leftActions: { flexDirection: 'row', gap: 16 },
  actionButton: { padding: 2 },
  postInfo: { paddingHorizontal: 16, gap: 6 },
  likesCount: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  caption: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  captionDisplayName: { fontWeight: '700' },
  viewComments: { color: 'rgba(255, 255, 255, 0.5)', fontSize: 14, marginTop: 2 },
  metaInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  timestamp: { color: 'rgba(255, 255, 255, 0.4)', fontSize: 12 },
  views: { color: 'rgba(255, 255, 255, 0.4)', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  comingSoonCard: { backgroundColor: '#1a1a1a', borderRadius: 24, padding: 40, alignItems: 'center', width: '100%', maxWidth: 340, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  comingSoonTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginTop: 20, marginBottom: 12 },
  comingSoonMessage: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  comingSoonButton: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, width: '100%' },
  comingSoonButtonText: { color: '#000000', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  menuCard: { backgroundColor: '#1a1a1a', borderRadius: 24, width: '100%', maxWidth: 340, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  menuItemText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  menuItemCancel: { borderBottomWidth: 0, justifyContent: 'center' },
  menuItemCancelText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '600', textAlign: 'center', width: '100%' },
});