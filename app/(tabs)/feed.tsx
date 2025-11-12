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
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import type { PostWithProfile } from '../../types/database';
import type { User } from '@supabase/supabase-js';

const { width } = Dimensions.get('window');

export default function FeedScreen() {
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    getCurrentUser();
    fetchPosts();
  }, []);

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    setCurrentUser(data.user);
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
        .limit(20);

      if (error) throw error;

      if (currentUser) {
        const postsWithLikes = await Promise.all(
          data.map(async (post) => {
            const { data: likeData } = await supabase
              .from('likes')
              .select('id')
              .eq('post_id', post.id)
              .eq('user_id', currentUser.id)
              .single();

            return {
              ...post,
              is_liked: !!likeData,
            };
          })
        );

        setPosts(postsWithLikes);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, []);

  const handleLike = async (postId: string) => {
    if (!currentUser) return;

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

  const renderPost = ({ item }: { item: PostWithProfile }) => (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => router.push(`/user/${item.user_id}`)}
        >
          <Image
            source={{
              uri: item.profiles?.avatar_url || 'https://ui-avatars.com/api/?name=' + item.profiles?.username,
            }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.username}>{item.profiles?.username}</Text>
            <Text style={styles.fullName}>{item.profiles?.full_name}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity>
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
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="paper-plane-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity>
          <Ionicons name="bookmark-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.postInfo}>
        <Text style={styles.likesCount}>
          {item.likes_count.toLocaleString()} likes
        </Text>
        {item.caption && (
          <Text style={styles.caption}>
            <Text style={styles.captionUsername}>{item.profiles?.username} </Text>
            {item.caption}
          </Text>
        )}
        {item.comments_count > 0 && (
          <TouchableOpacity onPress={() => router.push(`/post/${item.id}`)}>
            <Text style={styles.viewComments}>
              View all {item.comments_count} comments
            </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
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
        <Text style={styles.logo}>FRAMEZ</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="add-circle-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <Ionicons name="heart-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  postContainer: {
    marginBottom: 24,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  fullName: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  postImage: {
    width: width,
    height: width,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    padding: 2,
  },
  postInfo: {
    paddingHorizontal: 16,
    gap: 6,
  },
  likesCount: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  captionUsername: {
    fontWeight: '700',
  },
  viewComments: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    marginTop: 2,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    marginTop: 2,
  },
});