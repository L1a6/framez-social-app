
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { VideoView, useVideoPlayer } from 'expo-video';
import BottomSheet, { BottomSheetFlatList, BottomSheetTextInput, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');

const VideoPlayer = React.memo(({ videoUrl }: { videoUrl: string }) => {
  const player = useVideoPlayer(videoUrl, player => {
    player.loop = false;
  });

  return (
    <VideoView
      style={styles.postVideo}
      player={player}
      contentFit="contain"
      nativeControls={true}
    />
  );
});

const MediaCarousel = React.memo(({ media }: { 
  media: Array<{ type: string; url: string }>;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!media || media.length === 0) return null;

  return (
    <View style={styles.mediaContainer}>
      <FlatList
        data={media}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={styles.mediaItem}>
            {item.type === 'video' ? (
              <VideoPlayer videoUrl={item.url} />
            ) : (
              <Image source={{ uri: item.url }} style={styles.postImage} />
            )}
          </View>
        )}
        keyExtractor={(item, index) => `media-${index}-${item.type}`}
      />
      {media.length > 1 && (
        <View style={styles.paginationDots}>
          {media.map((_, index) => (
            <View
              key={`dot-${index}`}
              style={[
                styles.dot,
                index === activeIndex && styles.activeDot
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

// Memoized Post Item Component - prevents re-render when parent state changes
const PostItem = React.memo(({ 
  item, 
  onLike, 
  onComment, 
  onMenu, 
  onProfileClick,
  onShare,
  getTimeAgo 
}: {
  item: any;
  onLike: (id: string) => void;
  onComment: (post: any) => void;
  onMenu: (post: any) => void;
  onProfileClick: (userId: string) => void;
  onShare: () => void;
  getTimeAgo: (date: string) => string;
}) => {
  return (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.userInfo} onPress={() => onProfileClick(item.user_id)}>
          <Image source={{ uri: item.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.profiles?.full_name || 'User')}&background=6366f1&color=fff` }} style={styles.avatar} />
          <Text style={styles.displayName}>{item.profiles?.full_name}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onMenu(item)}><Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" /></TouchableOpacity>
      </View>
      {item.media && item.media.length > 0 ? <MediaCarousel media={item.media} /> : item.caption ? <View style={styles.textOnlyPost}><Text style={styles.textOnlyCaption}>{item.caption}</Text></View> : null}
      <View style={styles.postActions}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={() => onLike(item.id)} style={styles.actionButton}><Ionicons name={item.is_liked ? 'heart' : 'heart-outline'} size={24} color={item.is_liked ? '#FF3B30' : '#FFFFFF'} /></TouchableOpacity>
          <TouchableOpacity onPress={() => onComment(item)} style={styles.actionButton}><Ionicons name="chatbubble-outline" size={22} color="#FFFFFF" /></TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onShare}><Ionicons name="paper-plane-outline" size={22} color="#FFFFFF" /></TouchableOpacity>
        </View>
      </View>
      <View style={styles.postInfo}>
        {item.total_likes > 0 && <Text style={styles.likesText}>Liked by <Text style={styles.boldText}>{item.first_liker || 'someone'}</Text>{item.total_likes > 1 && ` and ${item.total_likes - 1} others`}</Text>}
        {item.caption && item.media && item.media.length > 0 && <Text style={styles.caption}><Text style={styles.captionDisplayName}>{item.profiles?.full_name} </Text>{item.caption}</Text>}
        {item.comments_count > 0 && <TouchableOpacity onPress={() => onComment(item)}><Text style={styles.viewComments}>View all {item.comments_count} comments</Text></TouchableOpacity>}
        <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these specific props change
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.is_liked === nextProps.item.is_liked &&
    prevProps.item.total_likes === nextProps.item.total_likes &&
    prevProps.item.comments_count === nextProps.item.comments_count &&
    prevProps.item.caption === nextProps.item.caption
  );
});

export default function FeedScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messagingModal, setMessagingModal] = useState(false);
  const [menuModal, setMenuModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [updatingPost, setUpdatingPost] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [commentLikes, setCommentLikes] = useState<Set<string>>(new Set());
  const [commentDislikes, setCommentDislikes] = useState<Set<string>>(new Set());
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [deletingPost, setDeletingPost] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  
  // Use refs for modal data to prevent re-renders of the feed
  const selectedPostRef = useRef<any>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  
  // Bottom sheet ref for comments - Instagram style
  const commentsSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%', '90%'], []);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());
  const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

  // Get selected post from ref or posts array
  const selectedPost = useMemo(() => {
    if (!selectedPostId) return null;
    return posts.find(p => p.id === selectedPostId) || selectedPostRef.current;
  }, [selectedPostId, posts]);

  useEffect(() => {
    getCurrentUser();
    setupRealtimeSubscription();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchPosts();
      fetchUnreadCount();
    }
  }, [currentUser]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('notifications_only')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        if (currentUser) fetchUnreadCount();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
        if (currentUser) fetchFollowing(currentUser.id);
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
    
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', currentUser.id)
        .eq('is_read', false);
      
      if (error) {
        console.error('Error fetching unread count:', error);
        return;
      }
      
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error in fetchUnreadCount:', error);
    }
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

  const getMediaUrls = (post: any) => {
    const media: Array<{ type: 'image' | 'video'; url: string }> = [];
    
    if (post.media_urls && Array.isArray(post.media_urls)) {
      return post.media_urls;
    }
    
    if (post.video_url) {
      media.push({ type: 'video', url: post.video_url });
    }
    if (post.image_url) {
      media.push({ type: 'image', url: post.image_url });
    }
    
    return media;
  };

  const fetchPosts = async () => {
    if (!currentUser) return;
    
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

      const postIds = data.map(p => p.id);
      
      const { data: likesData } = await supabase
        .from('likes')
        .select('post_id, user_id, profiles:user_id(full_name)')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      const { data: myLikes } = await supabase
        .from('likes')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', currentUser.id);

      const myLikesSet = new Set(myLikes?.map(l => l.post_id) || []);
      const likesByPost = (likesData || []).reduce((acc: any, like: any) => {
        if (!acc[like.post_id]) acc[like.post_id] = [];
        acc[like.post_id].push(like);
        return acc;
      }, {});

      const postsWithData = data.map((post) => {
        const postLikes = likesByPost[post.id] || [];
        const firstLike = postLikes[0];
        
        return {
          ...post,
          is_liked: myLikesSet.has(post.id),
          first_liker: firstLike?.profiles?.full_name || null,
          total_likes: postLikes.length,
          media: getMediaUrls(post),
        };
      });

      // Feed Algorithm: Score posts based on engagement + recency + following
      const scoredPosts = postsWithData.map(post => {
        const ageInHours = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
        const isFromFollowing = following.has(post.user_id);
        const isOwnPost = post.user_id === currentUser.id;
        
        // Engagement score (likes + comments weighted)
        const engagementScore = (post.total_likes * 1) + ((post.comments_count || 0) * 2);
        
        // Recency decay - newer posts score higher
        const recencyScore = Math.max(0, 100 - (ageInHours * 2));
        
        // Boost posts from people you follow
        const followingBoost = isFromFollowing ? 50 : 0;
        
        // Slight boost for own posts so you see them
        const ownPostBoost = isOwnPost ? 30 : 0;
        
        // Final score
        const score = engagementScore + recencyScore + followingBoost + ownPostBoost;
        
        return { ...post, _feedScore: score };
      });
      
      // Sort by score (highest first), but keep some randomness for variety
      scoredPosts.sort((a, b) => {
        // Add small random factor to prevent exact same order every time
        const randomFactor = (Math.random() - 0.5) * 10;
        return (b._feedScore + randomFactor) - (a._feedScore + randomFactor);
      });

      setPosts(scoredPosts);
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
  }, [currentUser, following]);

  // Memoized callbacks for PostItem
  const handleLikeMemo = useCallback((postId: string) => handleLike(postId), [currentUser, posts]);
  const handleProfileClickMemo = useCallback((userId: string) => handleProfileClick(userId), [currentUser]);
  const handleShareMemo = useCallback(() => setMessagingModal(true), []);

  const getTimeAgo = useCallback((dateString: string) => {
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
  }, []);

  const handleLike = async (postId: string) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to like posts');
      return;
    }

    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const wasLiked = post.is_liked;
    const newLikeCount = wasLiked ? post.total_likes - 1 : post.total_likes + 1;

    setPosts(prevPosts => prevPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          is_liked: !wasLiked,
          total_likes: newLikeCount,
          first_liker: !wasLiked && newLikeCount === 1 ? (currentUser.user_metadata?.full_name || 'You') : (wasLiked && newLikeCount === 0 ? null : p.first_liker)
        };
      }
      return p;
    }));

    try {
      if (wasLiked) {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
        await supabase.from('notification_tracking').delete().eq('actor_id', currentUser.id).eq('entity_id', postId).eq('action_type', 'like');
      } else {
        await supabase.from('likes').insert({ post_id: postId, user_id: currentUser.id });
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
    } catch (error) {
      console.error('Error toggling like:', error);
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return { ...p, is_liked: wasLiked, total_likes: post.total_likes, first_liker: post.first_liker };
        }
        return p;
      }));
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
        await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', userId);
        setFollowing(prev => { const newSet = new Set(prev); newSet.delete(userId); return newSet; });
        await supabase.from('notification_tracking').delete().eq('actor_id', currentUser.id).eq('recipient_id', userId).eq('action_type', 'follow');
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: userId });
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
      setFollowingInProgress(prev => { const newSet = new Set(prev); newSet.delete(userId); return newSet; });
    }
  };

  const handleEditPost = () => {
    if (!selectedPost) return;
    setEditCaption(selectedPost.caption || '');
    setMenuModal(false);
    setEditModal(true);
  };

  const handleUpdatePost = async () => {
    if (!selectedPost || !currentUser) return;
    setUpdatingPost(true);
    try {
      const { error } = await supabase.from('posts').update({ caption: editCaption.trim() }).eq('id', selectedPost.id).eq('user_id', currentUser.id);
      if (error) throw error;
      setPosts(prevPosts => prevPosts.map(p => p.id === selectedPost.id ? { ...p, caption: editCaption.trim() } : p));
      setEditModal(false);
      selectedPostRef.current = null;
      setSelectedPostId(null);
      setEditCaption('');
      Alert.alert('Success', 'Post updated successfully');
    } catch (error) {
      console.error('Error updating post:', error);
      Alert.alert('Error', 'Failed to update post');
    } finally {
      setUpdatingPost(false);
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPost || !currentUser || selectedPost.user_id !== currentUser.id) return;
    Alert.alert('Delete Post', 'Are you sure you want to delete this post? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingPost(true);
          setMenuModal(false);
          const postToDelete = selectedPost;
          try {
            await supabase.from('notifications').delete().eq('entity_id', postToDelete.id);
            const { data: commentIds } = await supabase.from('comments').select('id').eq('post_id', postToDelete.id);
            if (commentIds && commentIds.length > 0) {
              const ids = commentIds.map(c => c.id);
              await supabase.from('comment_likes').delete().in('comment_id', ids);
              await supabase.from('notifications').delete().in('entity_id', ids);
            }
            await supabase.from('comments').delete().eq('post_id', postToDelete.id);
            await supabase.from('likes').delete().eq('post_id', postToDelete.id);
            await supabase.from('posts').delete().eq('id', postToDelete.id);
            setPosts(prevPosts => prevPosts.filter(p => p.id !== postToDelete.id));
            selectedPostRef.current = null;
            setSelectedPostId(null);
            Alert.alert('Success', 'Post deleted successfully');
          } catch (error) {
            console.error('Error deleting post:', error);
            Alert.alert('Error', 'Failed to delete post');
          } finally {
            setDeletingPost(false);
          }
        } 
      }
    ]);
  };

  const openMenu = useCallback((post: any) => { 
    selectedPostRef.current = post;
    setSelectedPostId(post.id);
    setMenuModal(true); 
  }, []);
  
  const openComments = useCallback((post: any) => { 
    selectedPostRef.current = post;
    setSelectedPostId(post.id);
    fetchComments(post.id);
    // Open bottom sheet instead of modal - doesn't trigger re-render
    commentsSheetRef.current?.snapToIndex(0);
  }, []);
  
  const closeComments = useCallback(() => {
    commentsSheetRef.current?.close();
    setReplyTo(null);
    setCommentText('');
    setExpandedComments(new Set());
    // Don't clear selectedPost immediately - let sheet animate out first
    setTimeout(() => {
      selectedPostRef.current = null;
      setSelectedPostId(null);
    }, 300);
  }, []);
  
  // Backdrop component for bottom sheet
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    []
  );

  const fetchComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase.from('comments').select(`*, profiles:user_id (id, username, full_name, avatar_url)`).eq('post_id', postId).order('created_at', { ascending: true });
      if (error) throw error;
      if (currentUser) {
        const { data: likedComments } = await supabase.from('comment_likes').select('comment_id, like_type').eq('user_id', currentUser.id);
        if (likedComments) {
          setCommentLikes(new Set(likedComments.filter(l => l.like_type === 'like').map(l => l.comment_id)));
          setCommentDislikes(new Set(likedComments.filter(l => l.like_type === 'dislike').map(l => l.comment_id)));
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
      const { data: newComment, error } = await supabase
        .from('comments')
        .insert({
          post_id: selectedPost.id,
          user_id: currentUser.id,
          parent_id: replyTo?.id || null,
          content: commentText.trim()
        })
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .single();
      
      if (error) throw error;
      
      setComments(prev => [...prev, newComment]);
      
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
      
      setPosts(prevPosts => prevPosts.map(p => 
        p.id === selectedPost.id 
          ? { ...p, comments_count: (p.comments_count || 0) + 1 }
          : p
      ));
      
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleCommentLike = async (commentId: string, type: 'like' | 'dislike') => {
    if (!currentUser) { Alert.alert('Login Required', 'Please login to like comments'); return; }
    
    const isLiked = commentLikes.has(commentId);
    const isDisliked = commentDislikes.has(commentId);
    
    if (type === 'like') {
      setCommentLikes(prev => { const newSet = new Set(prev); isLiked ? newSet.delete(commentId) : newSet.add(commentId); return newSet; });
      if (isDisliked) setCommentDislikes(prev => { const newSet = new Set(prev); newSet.delete(commentId); return newSet; });
    } else {
      setCommentDislikes(prev => { const newSet = new Set(prev); isDisliked ? newSet.delete(commentId) : newSet.add(commentId); return newSet; });
      if (isLiked) setCommentLikes(prev => { const newSet = new Set(prev); newSet.delete(commentId); return newSet; });
    }
    
    try {
      if ((type === 'like' && isLiked) || (type === 'dislike' && isDisliked)) {
        await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUser.id);
      } else {
        await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUser.id);
        await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUser.id, like_type: type });
        
        if (type === 'like') {
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
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const handleProfileClick = (userId: string) => {
    userId === currentUser?.id ? router.push('/(tabs)/profile') : router.push(`/(tabs)/user-profile?userId=${userId}`);
  };

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (event: any) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const delta = currentScrollY - lastScrollY.current;
      if (delta > 5 && currentScrollY > 50) {
        Animated.timing(headerTranslateY, { toValue: -100, duration: 200, useNativeDriver: true }).start();
      } else if (delta < -5) {
        Animated.timing(headerTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      }
      lastScrollY.current = currentScrollY;
    },
  });

  const organizeComments = (comments: any[]) => {
    const topLevel = comments.filter(c => !c.parent_id);
    const organized: any[] = [];
    
    topLevel.forEach(parent => {
      organized.push(parent);
      const replies = comments.filter(c => c.parent_id === parent.id);
      if (replies.length > 0) {
        const isExpanded = expandedComments.has(parent.id);
        const visibleReplies = isExpanded ? replies : replies.slice(0, 3);
        organized.push(...visibleReplies.map(r => ({ ...r, isReply: true })));
        if (replies.length > 3) {
          organized.push({ isViewMore: true, parentId: parent.id, remainingCount: replies.length - (isExpanded ? 0 : 3), isExpanded });
        }
      }
    });
    
    return organized;
  };

  const renderPost = useCallback(({ item }: { item: any }) => (
    <PostItem
      item={item}
      onLike={handleLikeMemo}
      onComment={openComments}
      onMenu={openMenu}
      onProfileClick={handleProfileClickMemo}
      onShare={handleShareMemo}
      getTimeAgo={getTimeAgo}
    />
  ), [handleLikeMemo, openComments, openMenu, handleProfileClickMemo, handleShareMemo, getTimeAgo]);

  const renderComment = ({ item }: { item: any }) => {
    if (item.isViewMore) {
      return (
        <TouchableOpacity 
          style={styles.viewMoreButton}
          onPress={() => {
            setExpandedComments(prev => {
              const newSet = new Set(prev);
              item.isExpanded ? newSet.delete(item.parentId) : newSet.add(item.parentId);
              return newSet;
            });
          }}
        >
          <Text style={styles.viewMoreText}>{item.isExpanded ? 'View less' : `View ${item.remainingCount} more replies`}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.commentItem, item.isReply && styles.replyItem]}>
        <TouchableOpacity onPress={() => handleProfileClick(item.user_id)}><Image source={{ uri: item.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.profiles?.full_name || 'User')}&background=6366f1&color=fff` }} style={styles.commentAvatar} /></TouchableOpacity>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUsername}>{item.profiles?.full_name}</Text>
            <Text style={styles.commentTime}>{getTimeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.commentText}>{item.content}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity onPress={() => handleCommentLike(item.id, 'like')} style={styles.commentLikeButton}><Ionicons name={commentLikes.has(item.id) ? 'thumbs-up' : 'thumbs-up-outline'} size={16} color={commentLikes.has(item.id) ? '#6366f1' : 'rgba(255,255,255,0.5)'} /></TouchableOpacity>
            <TouchableOpacity onPress={() => handleCommentLike(item.id, 'dislike')} style={styles.commentLikeButton}><Ionicons name={commentDislikes.has(item.id) ? 'thumbs-down' : 'thumbs-down-outline'} size={16} color={commentDislikes.has(item.id) ? '#FF3B30' : 'rgba(255,255,255,0.5)'} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setReplyTo(item)}><Text style={styles.commentActionText}>Reply</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FFFFFF" /></View>;

  return (
    <GestureHandlerRootView style={styles.container}>
      <Animated.View style={[styles.header, { transform: [{ translateY: headerTranslateY }] }]}>
        <Text style={styles.logo}>Framez</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setMessagingModal(true)}><Ionicons name="chatbubbles-outline" size={28} color="#FFFFFF" /></TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => { markNotificationsRead(); router.push('/(tabs)/notifications'); }}>
            <Ionicons name="notifications-outline" size={28} color="#FFFFFF" />
            {unreadCount > 0 && <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>}
          </TouchableOpacity>
        </View>
      </Animated.View>

      <AnimatedFlatList 
        data={posts} 
        renderItem={renderPost} 
        keyExtractor={(item: any) => `post-${item.id}`}
        removeClippedSubviews={true}
        windowSize={5}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={100}
        initialNumToRender={3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />} 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.listContent} 
        onScroll={handleScroll} 
        scrollEventThrottle={16}
        ListFooterComponent={
          !hasMorePosts && posts.length > 0 ? (
            <View style={styles.endOfFeed}>
              <Text style={styles.endOfFeedText}>No more posts</Text>
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
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuModal(false); if (selectedPost) handleProfileClick(selectedPost.user_id); }}>
              <Ionicons name="person-outline" size={24} color="#FFFFFF" />
              <Text style={styles.menuItemText}>View Profile</Text>
            </TouchableOpacity>
            {selectedPost && selectedPost.user_id === currentUser?.id ? (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={handleEditPost}>
                  <Ionicons name="create-outline" size={24} color="#FFFFFF" />
                  <Text style={styles.menuItemText}>Edit Post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleDeletePost} disabled={deletingPost}>
                  <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                  <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>{deletingPost ? 'Deleting...' : 'Delete Post'}</Text>
                </TouchableOpacity>
              </>
            ) : selectedPost && selectedPost.user_id !== currentUser?.id && (
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
                <Ionicons name={following.has(selectedPost.user_id) ? "person-remove-outline" : "person-add-outline"} size={24} color="#FFFFFF" />
                <Text style={styles.menuItemText}>{following.has(selectedPost.user_id) ? 'Unfollow' : 'Follow'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.menuItem, styles.menuItemCancel]} onPress={() => { 
              setMenuModal(false);
              setTimeout(() => {
                selectedPostRef.current = null;
                setSelectedPostId(null);
              }, 300);
            }}>
              <Text style={styles.menuItemCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={editModal} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={() => { setEditModal(false); setEditCaption(''); }}>
              <Text style={styles.editModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>Edit Post</Text>
            <TouchableOpacity onPress={handleUpdatePost} disabled={updatingPost || !editCaption.trim()}>
              {updatingPost ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <Text style={[styles.editModalSave, !editCaption.trim() && styles.editModalSaveDisabled]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.editModalContent}>
            <TextInput 
              style={styles.editModalInput} 
              placeholder="Write a caption..." 
              placeholderTextColor="#666" 
              value={editCaption} 
              onChangeText={setEditCaption} 
              multiline 
              autoFocus 
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comments Bottom Sheet - Instagram Style */}
      <BottomSheet
        ref={commentsSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={(index) => {
          if (index === -1) {
            // Sheet closed
            setReplyTo(null);
            setCommentText('');
            setExpandedComments(new Set());
            setTimeout(() => {
              selectedPostRef.current = null;
              setSelectedPostId(null);
            }, 100);
          }
        }}
      >
        <View style={styles.commentsSheetHeader}>
          <Text style={styles.commentsTitle}>Comments</Text>
          <TouchableOpacity onPress={closeComments}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        {loadingComments ? (
          <View style={styles.loadingComments}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : (
          <BottomSheetFlatList
            data={organizeComments(comments)}
            renderItem={renderComment}
            keyExtractor={(item, index) => item.id || `view-more-${index}`}
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
              <Text style={styles.replyBannerText}>Replying to {replyTo.profiles?.full_name}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Ionicons name="close-circle" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.commentInputRow}>
            <BottomSheetTextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor="#666"
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity onPress={handleAddComment} disabled={!commentText.trim() || postingComment} style={styles.sendButton}>
              {postingComment ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <Ionicons name="send" size={24} color={commentText.trim() ? '#6366f1' : '#666'} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loadingContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  bottomSheetBackground: { backgroundColor: '#1a1a1a' },
  bottomSheetIndicator: { backgroundColor: '#666', width: 40 },
  commentsSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  loadingComments: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: '#000', zIndex: 1000 },
  logo: { fontSize: 32, fontWeight: '400', color: '#FFFFFF', letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive' },
  headerActions: { flexDirection: 'row', gap: 16 },
  headerButton: { padding: 4, position: 'relative' },
  notificationBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#6366f1', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, borderWidth: 2, borderColor: '#000', zIndex: 10 },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  listContent: { paddingTop: 80, paddingBottom: 20 },
  postContainer: { marginBottom: 24 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  displayName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  mediaContainer: { width: width, height: width, position: 'relative' },
  mediaItem: { width: width, height: width },
  postImage: { width: width, height: width, backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  postVideo: { width: width, height: width, backgroundColor: '#000' },
  paginationDots: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  activeDot: { backgroundColor: '#FFFFFF', width: 8, height: 8, borderRadius: 4 },
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
  endOfFeed: { paddingVertical: 20, alignItems: 'center', marginTop: 10 },
  endOfFeedText: { color: '#666', fontSize: 13, fontWeight: '500' },
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
  editModalContainer: { flex: 1, backgroundColor: '#000' },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  editModalCancel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  editModalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  editModalSave: { color: '#6366f1', fontSize: 16, fontWeight: '700' },
  editModalSaveDisabled: { color: '#666' },
  editModalContent: { flex: 1, padding: 16 },
  editModalInput: { color: '#FFFFFF', fontSize: 16, lineHeight: 24, textAlignVertical: 'top' },
  commentsTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  commentsList: { padding: 16, paddingBottom: 100 },
  commentItem: { flexDirection: 'row', marginBottom: 16, gap: 12 },
  replyItem: { marginLeft: 48, marginTop: 8 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentUsername: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  commentTime: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  commentText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, marginBottom: 6 },
  commentActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  commentLikeButton: { padding: 4 },
  commentActionText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  viewMoreButton: { marginLeft: 48, marginVertical: 8 },
  viewMoreText: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
  emptyComments: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyCommentsText: { color: '#666', fontSize: 16, marginTop: 12 },
  commentInputContainer: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', backgroundColor: '#000' },
  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(99,102,241,0.2)' },
  replyBannerText: { color: '#FFFFFF', fontSize: 13 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  commentInput: { flex: 1, color: '#FFFFFF', fontSize: 15, maxHeight: 100 },
  sendButton: { padding: 8 },
});

