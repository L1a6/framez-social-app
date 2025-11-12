// app/(tabs)/explore.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import type { Post, Profile } from '../../types/database';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 4) / 3;

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'users'>('posts');

  useEffect(() => {
    fetchExplorePosts();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      searchContent();
    } else {
      fetchExplorePosts();
    }
  }, [searchQuery]);

  const fetchExplorePosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('likes_count', { ascending: false })
        .limit(30);

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchContent = async () => {
    try {
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .ilike('caption', `%${searchQuery}%`)
        .limit(30);

      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(20);

      setPosts(postsData || []);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity
      onPress={() => router.push(`/post/${item.id}`)}
      style={styles.gridItem}
    >
<Image
  source={{ uri: item.image_url ?? 'https://via.placeholder.com/150' }}
  style={styles.gridImage}
/>
      <View style={styles.gridOverlay}>
        <View style={styles.gridStat}>
          <Ionicons name="heart" size={20} color="#FFFFFF" />
          <Text style={styles.gridStatText}>{item.likes_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderUser = ({ item }: { item: Profile }) => (
    <TouchableOpacity
      onPress={() => router.push(`/user/${item.id}`)}
      style={styles.userItem}
    >
      <Image
        source={{
          uri: item.avatar_url || `https://ui-avatars.com/api/?name=${item.username}`,
        }}
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userUsername}>{item.username}</Text>
        <Text style={styles.userFullName}>{item.full_name}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.4)" />
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
        <Text style={styles.headerTitle}>Explore</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="rgba(255, 255, 255, 0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.4)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {searchQuery.length > 0 && (
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            onPress={() => setActiveTab('posts')}
            style={[
              styles.tab,
              activeTab === 'posts' && styles.tabActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'posts' && styles.tabTextActive,
              ]}
            >
              Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('users')}
            style={[
              styles.tab,
              activeTab === 'users' && styles.tabActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'users' && styles.tabTextActive,
              ]}
            >
              People
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'posts' ? (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
        />
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.usersContent}
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  gridContent: {
    paddingTop: 2,
  },
  gridRow: {
    gap: 2,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gridStatText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  usersContent: {
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  userInfo: {
    flex: 1,
  },
  userUsername: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  userFullName: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
});