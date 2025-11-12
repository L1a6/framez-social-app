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
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow';
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  post_id?: string;
  created_at: string;
  is_read: boolean;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const likesPromise = supabase
        .from('likes')
        .select(`
          id,
          created_at,
          post_id,
          profiles:user_id (id, username, avatar_url)
        `)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const commentsPromise = supabase
        .from('comments')
        .select(`
          id,
          created_at,
          post_id,
          profiles:user_id (id, username, avatar_url)
        `)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const followsPromise = supabase
        .from('follows')
        .select(`
          id,
          created_at,
          profiles:follower_id (id, username, avatar_url)
        `)
        .eq('following_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const [likesRes, commentsRes, followsRes] = await Promise.all([
        likesPromise,
        commentsPromise,
        followsPromise,
      ]);

 const allNotifications: Notification[] = [
  ...(likesRes.data || []).map((like) => ({
    id: like.id,
    type: 'like' as const,
    user: {
      id: (like.profiles as any).id,
      username: (like.profiles as any).username,
      avatar_url: (like.profiles as any).avatar_url,
    },
    post_id: like.post_id,
    created_at: like.created_at,
    is_read: false,
  })),
  ...(commentsRes.data || []).map((comment) => ({
    id: comment.id,
    type: 'comment' as const,
    user: {
      id: (comment.profiles as any).id,
      username: (comment.profiles as any).username,
      avatar_url: (comment.profiles as any).avatar_url,
    },
    post_id: comment.post_id,
    created_at: comment.created_at,
    is_read: false,
  })),
  ...(followsRes.data || []).map((follow) => ({
    id: follow.id,
    type: 'follow' as const,
    user: {
      id: (follow.profiles as any).id,
      username: (follow.profiles as any).username,
      avatar_url: (follow.profiles as any).avatar_url,
    },
    created_at: follow.created_at,
    is_read: false,
  })),
];
      allNotifications.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications);
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

  const getNotificationText = (notification: Notification) => {
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Ionicons name="heart" size={20} color="#FF3B30" />;
      case 'comment':
        return <Ionicons name="chatbubble" size={20} color="#007AFF" />;
      case 'follow':
        return <Ionicons name="person-add" size={20} color="#34C759" />;
      default:
        return null;
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    if (notification.type === 'follow') {
      router.push(`/user/${notification.user.id}`);
    } else if (notification.post_id) {
      router.push(`/post/${notification.post_id}`);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      onPress={() => handleNotificationPress(item)}
      style={[
        styles.notificationItem,
        !item.is_read && styles.notificationUnread,
      ]}
    >
      <View style={styles.avatarContainer}>
        <Image
          source={{
            uri: item.user.avatar_url || `https://ui-avatars.com/api/?name=${item.user.username}`,
          }}
          style={styles.avatar}
        />
        <View style={styles.iconBadge}>{getNotificationIcon(item.type)}</View>
      </View>

      <View style={styles.notificationContent}>
        <Text style={styles.notificationText}>
          <Text style={styles.username}>{item.user.username} </Text>
          <Text style={styles.actionText}>{getNotificationText(item)}</Text>
        </Text>
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.3)" />
    </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={64} color="rgba(255, 255, 255, 0.2)" />
          <Text style={styles.emptyStateText}>No notifications yet</Text>
          <Text style={styles.emptyStateSubtext}>
            When someone likes or comments on your posts, you'll see it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: 'transparent',
  },
  notificationUnread: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  username: {
    fontWeight: '700',
  },
  actionText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyStateText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  emptyStateSubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});