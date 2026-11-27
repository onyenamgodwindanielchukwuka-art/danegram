import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

type Post = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  visibility: string;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export default function FeedScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadFeed = useCallback(async () => {
    setError('');
    const { data, error: postsError } = await supabase
      .from('posts')
      .select('id,user_id,content,media_url,media_type,visibility,created_at')
      .order('created_at', { ascending: false })
      .limit(30);

    if (postsError) {
      setError(postsError.message);
      setPosts([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = (data || []) as Post[];
    setPosts(rows);
    const userIds = [...new Set(rows.map((post) => post.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .in('id', userIds);
      if (!profileError && profileRows) {
        const next: Record<string, Profile> = {};
        (profileRows as Profile[]).forEach((profile) => { next[profile.id] = profile; });
        setProfiles(next);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed();
  }, [loadFeed]);

  function renderPost({ item }: { item: Post }) {
    const profile = profiles[item.user_id];
    const name = profile?.display_name || (profile?.username ? '@' + profile.username : 'DANEGRAM member');
    return (
      <View style={styles.post}>
        <View style={styles.authorRow}>
          {profile?.avatar_url
            ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            : <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text></View>}
          <View style={styles.authorText}>
            <Text style={styles.author}>{name}</Text>
            <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        </View>
        {!!item.content && <Text style={styles.content}>{item.content}</Text>}
        {!!item.media_url && (item.media_type === 'image' || item.media_type === 'photo') &&
          <Image source={{ uri: item.media_url }} style={styles.media} resizeMode="cover" />}
        {!!item.media_url && item.media_type === 'video' &&
          <View style={styles.videoPlaceholder}><Text style={styles.videoText}>Video post · Open in the DANEGRAM web app for playback</Text></View>}
        <Text style={styles.visibility}>{item.visibility === 'public' ? 'Public post' : 'Restricted post'}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.brand}>DANEGRAM</Text>
        <Pressable onPress={onRefresh}><Text style={styles.refresh}>Refresh</Text></Pressable>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#2449c7" /></View> :
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          renderItem={renderPost}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<View style={styles.empty}>
            <Text style={styles.emptyTitle}>{error ? 'Feed could not load' : 'Your feed is ready'}</Text>
            <Text style={styles.emptyText}>{error || 'No posts are available to this account yet. Pull down to refresh.'}</Text>
          </View>}
        />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f6fb' },
  header: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e7eaf2' },
  back: { color: '#2449c7', fontWeight: '700', fontSize: 15 },
  brand: { color: '#2449c7', fontWeight: '900', letterSpacing: 1, fontSize: 18 },
  refresh: { color: '#2449c7', fontWeight: '700', fontSize: 14 },
  list: { padding: 14, gap: 12 },
  post: { backgroundColor: '#fff', borderRadius: 18, padding: 15, gap: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#e9edf8' },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#e5eaff', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#2449c7', fontWeight: '800', fontSize: 17 },
  authorText: { flex: 1, gap: 3 },
  author: { color: '#17213b', fontWeight: '800', fontSize: 14 },
  meta: { color: '#7b8498', fontSize: 11 },
  content: { color: '#273149', fontSize: 15, lineHeight: 22 },
  media: { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#eef0f6' },
  videoPlaceholder: { height: 150, borderRadius: 12, backgroundColor: '#202b45', alignItems: 'center', justifyContent: 'center', padding: 20 },
  videoText: { color: '#fff', textAlign: 'center', fontSize: 13 },
  visibility: { color: '#9299a8', fontSize: 11 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 28, marginTop: 50, backgroundColor: '#fff', borderRadius: 18, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#17213b', fontSize: 18, fontWeight: '800' },
  emptyText: { color: '#687188', textAlign: 'center', fontSize: 13, lineHeight: 20 }
});
