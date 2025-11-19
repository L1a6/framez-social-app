// app/(tabs)/notifications.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from  '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser();
    fetchNotifications();
    setupRealtimeSubscription();
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('notifications_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setCurrentUserId(data.user.id);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:sender_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          post:post_id (
            id,
            image_url,
            caption
          )
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

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

  const getNotificationText = (notification: any) => {
    switch (notification.type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'started following you';
      default:
        return '';
    }
  };

  const handleNotificationPress = (notification: any) => {
    if (notification.type === 'follow') {
      router.push(`/(tabs)/user-profile?userId=${notification.sender_id}`);
    } else if (notification.post_id) {
      router.push(`/post/${notification.post_id}`);
    }
  };

  const renderNotification = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.is_read && styles.unreadNotification]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <Image
        source={{
          uri: item.sender?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.sender?.full_name || 'User')}&background=6366f1&color=fff`,
        }}
        style={styles.avatar}
      />
      
      <View style={styles.notificationContent}>
        <Text style={styles.notificationText}>
          <Text style={styles.username}>{item.sender?.full_name}</Text>
          {' '}
          {getNotificationText(item)}
        </Text>
        <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
      </View>

      {item.post?.image_url && (
        <Image
          source={{ uri: item.post.image_url }}
          style={styles.postThumbnail}
        />
      )}

      {item.type === 'like' && !item.post?.image_url && (
        <View style={styles.iconContainer}>
          <Ionicons name="heart" size={24} color="#FF3B30" />
        </View>
      )}

      {item.type === 'comment' && !item.post?.image_url && (
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubble" size={24} color="#6366f1" />
        </View>
      )}

      {item.type === 'follow' && (
        <View style={styles.iconContainer}>
          <Ionicons name="person-add" size={24} color="#10B981" />
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            When someone likes, comments, or follows you, you'll see it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loadingContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFFFFF', marginTop: 16, fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  listContent: { paddingBottom: 20 },
  notificationItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  unreadNotification: { backgroundColor: 'rgba(99,102,241,0.1)' },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  notificationContent: { flex: 1, gap: 4 },
  notificationText: { color: '#FFFFFF', fontSize: 15, lineHeight: 20 },
  username: { fontWeight: '700' },
  timestamp: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  postThumbnail: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#111' },
  iconContainer: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  emptySubtext: { color: 'rgba(255,255,255,0.5)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});