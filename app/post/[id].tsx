
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import type { PostWithProfile, Comment } from '../../types/database';
import type { User } from '@supabase/supabase-js';

const { width } = Dimensions.get('window');

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const [post, setPost] = useState<PostWithProfile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchPostAndComments();
    getCurrentUser();
  }, [id]);

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    setCurrentUser(data.user);
  };

  const fetchPostAndComments = async () => {
    try {
      const { data: postData, error: postError } = await supabase
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
        .eq('id', id)
        .single();

      if (postError) throw postError;

      if (currentUser) {
        const { data: likeData } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', id)
          .eq('user_id', currentUser.id)
          .single();

        setPost({ ...postData, is_liked: !!likeData });
      } else {
        setPost(postData);
      }

      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            avatar_url
          )
        `)
        .eq('post_id', id)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (error) {
      console.error('Error fetching post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!currentUser || !post) return;

    const isLiked = post.is_liked;

    setPost({
      ...post,
      is_liked: !isLiked,
      likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
    });

    try {
      if (isLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', id)
          .eq('user_id', currentUser.id);
      } else {
        await supabase.from('likes').insert({
          post_id: id as string,
          user_id: currentUser.id,
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setPost({
        ...post,
        is_liked: isLiked,
        likes_count: isLiked ? post.likes_count + 1 : post.likes_count - 1,
      });
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !currentUser || !post) return;

    try {
      const { data: newComment, error } = await supabase
        .from('comments')
        .insert({
          post_id: id as string,
          user_id: currentUser.id,
          text: commentText.trim(),
        })
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      setComments([...comments, newComment]);
      setCommentText('');

      await supabase
        .from('posts')
        .update({ comments_count: post.comments_count + 1 })
        .eq('id', id);

      setPost({ ...post, comments_count: post.comments_count + 1 });

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => router.push(`/user/${post.user_id}`)}
          >
            <Image
              source={{
                uri: post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${post.profiles?.username}`,
              }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.username}>{post.profiles?.username}</Text>
              <Text style={styles.fullName}>{post.profiles?.full_name}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {post.image_url && (
          <Image source={{ uri: post.image_url }} style={styles.postImage} />
        )}

        <View style={styles.postActions}>
          <View style={styles.leftActions}>
            <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
              <Ionicons
                name={post.is_liked ? 'heart' : 'heart-outline'}
                size={28}
                color={post.is_liked ? '#FF3B30' : '#FFFFFF'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
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
            {post.likes_count.toLocaleString()} likes
          </Text>
          {post.caption && (
            <Text style={styles.caption}>
              <Text style={styles.captionUsername}>{post.profiles?.username} </Text>
              {post.caption}
            </Text>
          )}
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Comments</Text>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <Image
                source={{
                  uri: comment.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${comment.profiles?.username}`,
                }}
                style={styles.commentAvatar}
              />
              <View style={styles.commentContent}>
                <Text style={styles.commentText}>
                  <Text style={styles.commentUsername}>
                    {comment.profiles?.username}{' '}
                  </Text>
                  {comment.text}
                </Text>
                <Text style={styles.commentTime}>
                  {new Date(comment.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.commentInputContainer}>
        <Image
          source={{
            uri: currentUser?.user_metadata?.avatar_url || 'https://ui-avatars.com/api/?name=User',
          }}
          style={styles.commentInputAvatar}
        />
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          value={commentText}
          onChangeText={setCommentText}
        />
        <TouchableOpacity
          onPress={handleAddComment}
          disabled={!commentText.trim()}
        >
          <Ionicons
            name="send"
            size={24}
            color={commentText.trim() ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  postHeader: {
    padding: 16,
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
  commentsSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 16,
  },
  commentsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  comment: {
    flexDirection: 'row',
    gap: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  commentContent: {
    flex: 1,
    gap: 4,
  },
  commentText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
  },
  commentUsername: {
    fontWeight: '700',
  },
  commentTime: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  commentInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
});