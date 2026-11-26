import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

type Notice = {
  id: string;
  user_id: string;
  actor_id: string | null;
  notification_type: string;
  content: string | null;
  is_read: boolean;
  created_at: string | null;
  destination_type: string | null;
  destination_id: string | null;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError('Please sign in again to view your notifications.');
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from('notifications')
      .select('id,user_id,actor_id,notification_type,content,is_read,created_at,destination_type,destination_id')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (queryError) {
      setError(queryError.message);
      setItems([]);
    } else {
      setItems((data || []) as Notice[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (notice: Notice) => {
    if (notice.is_read) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user || auth.user.id !== notice.user_id) return;
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notice.id)
      .eq('user_id', auth.user.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) => current.map((item) => item.id === notice.id ? { ...item, is_read: true } : item));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.brand}>Notifications</Text>
        <Pressable onPress={() => { setRefreshing(true); load(); }}><Text style={styles.refresh}>Refresh</Text></Pressable>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#2449c7" /></View> :
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => markRead(item)} style={[styles.notice, !item.is_read && styles.unread]}>
              <View style={styles.dotColumn}><View style={[styles.dot, item.is_read && styles.readDot]} /></View>
              <View style={styles.noticeBody}>
                <Text style={styles.type}>{item.notification_type.replace(/[_-]/g, ' ')}</Text>
                {!!item.content && <Text style={styles.content}>{item.content}</Text>}
                <Text style={styles.time}>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Recently'}</Text>
                {!item.is_read && <Text style={styles.action}>Tap to mark as read</Text>}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<View style={styles.empty}>
            <Text style={styles.emptyTitle}>{error ? 'Notifications unavailable' : 'You are all caught up'}</Text>
            <Text style={styles.emptyText}>{error || 'New DANEGRAM activity will appear here.'}</Text>
          </View>}
        />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f6fb' },
  header: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e7eaf2' },
  back: { color: '#2449c7', fontWeight: '700', fontSize: 15 },
  brand: { color: '#17213b', fontWeight: '900', fontSize: 17 },
  refresh: { color: '#2449c7', fontWeight: '700', fontSize: 14 },
  list: { padding: 14, gap: 9, flexGrow: 1 },
  notice: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 11 },
  unread: { backgroundColor: '#f0f3ff' },
  dotColumn: { paddingTop: 5 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#3157d5' },
  readDot: { backgroundColor: '#d4d9e4' },
  noticeBody: { flex: 1, gap: 5 },
  type: { color: '#17213b', fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  content: { color: '#414b61', fontSize: 14, lineHeight: 20 },
  time: { color: '#8991a2', fontSize: 11 },
  action: { color: '#3157d5', fontSize: 11, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 28, marginTop: 50, backgroundColor: '#fff', borderRadius: 18, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#17213b', fontSize: 18, fontWeight: '800' },
  emptyText: { color: '#687188', textAlign: 'center', fontSize: 13, lineHeight: 20 }
});
