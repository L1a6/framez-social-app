import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  TextInput,
  KeyboardAvoidingView,
  Animated,
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
  const [commentsModal, setCommentsModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [commentLikes, setCommentLikes] = useState<Set<string>>(new Set());
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());
  const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

  useEffect(() => {
    getCurrentUser();
    fetchPosts();
    setupRealtimeSubscription();
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('all_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => fetchPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
        fetchPosts();
        if (selectedPost) fetchComments(selectedPost.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_likes' }, () => {
        if (selectedPost) fetchComments(selectedPost.id);
      })
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

  const markNotificationsRead = async () => {
    if (!currentUser) return;
    await supabase.rpc('mark_notifications_read', { user_uuid: currentUser.id });
    setUnreadCount(0);
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

      setHasMorePosts(data.length >= 50);

      if (currentUser) {
        const postsWithData = await Promise.all(
          data.map(async (post) => {
            const { data: likeData } = await supabase
              .from('likes')
              .select('id, profiles:user_id(full_name)')
              .eq('post_id', post.id)
              .order('created_at', { ascending: true })
              .limit(1);

            const { data: myLike } = await supabase
              .from('likes')
              .select('id')
              .eq('post_id', post.id)
              .eq('user_id', currentUser.id)
              .maybeSingle();

            const { count: totalLikes } = await supabase
              .from('likes')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id);

            return {
              ...post,
              is_liked: !!myLike,
              first_liker: likeData && likeData.length > 0 ? (likeData[0] as any).profiles?.full_name : null,
              total_likes: totalLikes || 0,
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, []);

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks}w`;
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
              total_likes: isLiked ? p.total_likes - 1 : p.total_likes + 1,
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
        
        await supabase
          .from('notification_tracking')
          .delete()
          .eq('actor_id', currentUser.id)
          .eq('entity_id', postId)
          .eq('action_type', 'like');
      } else {
        await supabase.from('likes').insert({
          post_id: postId,
          user_id: currentUser.id,
        });

        if (post.user_id !== currentUser.id) {
          await supabase.rpc('create_notification_safe', {
            p_recipient_id: post.user_id,
            p_actor_id: currentUser.id,
            p_type: 'like',
            p_entity_id: postId,
            p_message: 'liked your post'
          });
        }
      }
      await fetchPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId
            ? {
                ...p,
                is_liked: isLiked,
                total_likes: isLiked ? p.total_likes + 1 : p.total_likes - 1,
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

    if (followingInProgress.has(userId)) return;

    const isFollowing = following.has(userId);
    setFollowingInProgress(prev => new Set(prev).add(userId));

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

        await supabase
          .from('notification_tracking')
          .delete()
          .eq('actor_id', currentUser.id)
          .eq('recipient_id', userId)
          .eq('action_type', 'follow');
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: currentUser.id,
          following_id: userId,
        });

        if (!error) {
          setFollowing(prev => new Set(prev).add(userId));

          await supabase.rpc('create_notification_safe', {
            p_recipient_id: userId,
            p_actor_id: currentUser.id,
            p_type: 'follow',
            p_entity_id: null,
            p_message: 'started following you'
          });
        }
      }
    } catch (error) {
      console.error('Error following:', error);
    } finally {
      setFollowingInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const openMenu = (post: any) => {
    setSelectedPost(post);
    setMenuModal(true);
  };

  const openComments = (post: any) => {
    setSelectedPost(post);
    setCommentsModal(true);
    fetchComments(post.id);
  };

  const fetchComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (currentUser) {
        const { data: likedComments } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', currentUser.id);

        if (likedComments) {
          setCommentLikes(new Set(likedComments.map(l => l.comment_id)));
        }
      }

      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to comment');
      return;
    }

    if (!commentText.trim()) return;

    setPostingComment(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: selectedPost.id,
        user_id: currentUser.id,
        parent_id: replyTo?.id || null,
        text: commentText.trim(),
      });

      if (error) throw error;

      if (selectedPost.user_id !== currentUser.id) {
        await supabase.rpc('create_notification_safe', {
          p_recipient_id: selectedPost.user_id,
          p_actor_id: currentUser.id,
          p_type: 'comment',
          p_entity_id: selectedPost.id,
          p_message: replyTo ? 'replied to your comment' : 'commented on your post'
        });
      }

      setCommentText('');
      setReplyTo(null);
      await fetchComments(selectedPost.id);
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to like comments');
      return;
    }

    const isLiked = commentLikes.has(commentId);

    setCommentLikes(prev => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });

    try {
      if (isLiked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUser.id);
      } else {
        await supabase.from('comment_likes').insert({
          comment_id: commentId,
          user_id: currentUser.id,
        });

        const comment = comments.find(c => c.id === commentId);
        if (comment && comment.user_id !== currentUser.id) {
          await supabase.rpc('create_notification_safe', {
            p_recipient_id: comment.user_id,
            p_actor_id: currentUser.id,
            p_type: 'comment_like',
            p_entity_id: commentId,
            p_message: 'liked your comment'
          });
        }
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const handleProfileClick = (userId: string) => {
    if (userId === currentUser?.id) {
      router.push('/(tabs)/profile');
    } else {
      router.push(`/(tabs)/user-profile?userId=${userId}`);
    }
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: any) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        const delta = currentScrollY - lastScrollY.current;

        if (delta > 5 && currentScrollY > 50) {
          Animated.timing(headerTranslateY, {
            toValue: -100,
            duration: 200,
            useNativeDriver: true,
          }).start();
        } else if (delta < -5) {
          Animated.timing(headerTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }

        lastScrollY.current = currentScrollY;
      },
    }
  );

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
            onPress={() => openComments(item)}
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
        {item.total_likes > 0 && (
          <Text style={styles.likesText}>
            Liked by <Text style={styles.boldText}>{item.first_liker || 'someone'}</Text>
            {item.total_likes > 1 && ` and ${item.total_likes - 1} others`}
          </Text>
        )}
        {item.caption && (item.image_url || item.video_url) && (
          <Text style={styles.caption}>
            <Text style={styles.captionDisplayName}>{item.profiles?.full_name} </Text>
            {item.caption}
          </Text>
        )}
        {item.comments_count > 0 && (
          <TouchableOpacity onPress={() => openComments(item)}>
            <Text style={styles.viewComments}>View all {item.comments_count} comments</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
      </View>
    </View>
  );

  const renderComment = ({ item }: { item: any }) => (
    <View style={[styles.commentItem, item.parent_id && styles.replyItem]}>
      <TouchableOpacity onPress={() => handleProfileClick(item.user_id)}>
        <Image
          source={{
            uri: item.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.profiles?.full_name || 'User')}&background=6366f1&color=fff`,
          }}
          style={styles.commentAvatar}
        />
      </TouchableOpacity>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>{item.profiles?.full_name}</Text>
          <Text style={styles.commentTime}>{getTimeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity onPress={() => handleCommentLike(item.id)}>
            <Text style={styles.commentActionText}>
              {commentLikes.has(item.id) ? 'Unlike' : 'Like'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setReplyTo(item)}>
            <Text style={styles.commentActionText}>Reply</Text>
          </TouchableOpacity>
          {item.likes_count > 0 && (
            <Text style={styles.commentLikes}>{item.likes_count} likes</Text>
          )}
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
      <Animated.View style={[styles.header, { transform: [{ translateY: headerTranslateY }] }]}>
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
            onPress={() => {
              markNotificationsRead();
              router.push('/(tabs)/notifications');
            }}
          >
            <Ionicons name="notifications-outline" size={28} color="#FFFFFF" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
</Animated.View>

      <AnimatedFlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item: any) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListFooterComponent={
          !hasMorePosts && posts.length > 0 ? (
            <View style={styles.endMessage}>
              <Text style={styles.endMessageText}>No more posts</Text>
            </View>
          ) : null
        }
      />

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
                disabled={followingInProgress.has(selectedPost.user_id)}
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

      <Modal visible={commentsModal} animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.commentsModalContainer}
        >
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>Comments</Text>
            <TouchableOpacity onPress={() => {
              setCommentsModal(false);
              setReplyTo(null);
              setCommentText('');
            }}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {loadingComments ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : (
            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.commentsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <Ionicons name="chatbubble-outline" size={48} color="#666" />
                  <Text style={styles.emptyCommentsText}>No comments yet</Text>
                </View>
              }
            />
          )}

          <View style={styles.commentInputContainer}>
            {replyTo && (
              <View style={styles.replyBanner}>
                <Text style={styles.replyBannerText}>
                  Replying to {replyTo.profiles?.full_name}
                </Text>
                <TouchableOpacity onPress={() => setReplyTo(null)}>
                  <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="#666"
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                onPress={handleAddComment}
                disabled={!commentText.trim() || postingComment}
                style={styles.sendButton}
              >
                {postingComment ? (
                  <ActivityIndicator size="small" color="#6366f1" />
                ) : (
                  <Ionicons
                    name="send"
                    size={24}
                    color={commentText.trim() ? '#6366f1' : '#666'}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loadingContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: '#000', zIndex: 1000 },
  logo: { fontSize: 32, fontWeight: '400', color: '#FFFFFF', letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive' },
  headerActions: { flexDirection: 'row', gap: 16 },
  headerButton: { padding: 4, position: 'relative' },
  notificationBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  listContent: { paddingTop: 80, paddingBottom: 20 },
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
  likesText: { color: '#FFFFFF', fontSize: 14 },
  boldText: { fontWeight: '700' },
  caption: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  captionDisplayName: { fontWeight: '700' },
  viewComments: { color: 'rgba(255, 255, 255, 0.5)', fontSize: 14, marginTop: 2 },
  timestamp: { color: 'rgba(255, 255, 255, 0.4)', fontSize: 12, marginTop: 4 },
  endMessage: { paddingVertical: 20, alignItems: 'center' },
  endMessageText: { color: 'rgba(255, 255, 255, 0.4)', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  comingSoonCard: { backgroundColor: '#1a1a1a', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', maxWidth: 300, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  comingSoonTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginTop: 16, marginBottom: 8 },
  comingSoonMessage: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  comingSoonButton: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, width: '100%' },
  comingSoonButtonText: { color: '#000000', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  menuCard: { backgroundColor: '#1a1a1a', borderRadius: 20, width: '100%', maxWidth: 300, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  menuItemText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  menuItemCancel: { borderBottomWidth: 0, justifyContent: 'center' },
  menuItemCancelText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '600', textAlign: 'center', width: '100%' },
  commentsModalContainer: { flex: 1, backgroundColor: '#000' },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  commentsTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  commentsList: { padding: 16 },
  commentItem: { flexDirection: 'row', marginBottom: 16, gap: 12 },
  replyItem: { marginLeft: 40 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentUsername: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  commentTime: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  commentText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, marginBottom: 6 },
  commentActions: { flexDirection: 'row', gap: 16 },
  commentActionText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  commentLikes: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  emptyComments: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyCommentsText: { color: '#666', fontSize: 16, marginTop: 12 },
  commentInputContainer: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', backgroundColor: '#000' },
  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(99,102,241,0.2)' },
  replyBannerText: { color: '#FFFFFF', fontSize: 13 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  commentInput: { flex: 1, color: '#FFFFFF', fontSize: 15, maxHeight: 100 },
  sendButton: { padding: 8 },
});
 