import { useCallback,useEffect,useState } from 'react';
import { ActivityIndicator,FlatList,Pressable,RefreshControl,SafeAreaView,StyleSheet,Text,View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
type Conversation={id:string;title:string|null;is_group:boolean;created_at:string|null};
export default function MessagesScreen(){
 const router=useRouter();const [rows,setRows]=useState<Conversation[]>([]);const [busy,setBusy]=useState(true);const [refreshing,setRefreshing]=useState(false);const [error,setError]=useState('');
 const load=useCallback(async()=>{
  setError('');const {data:auth}=await supabase.auth.getUser();
  if(!auth.user){setError('Please sign in again.');setBusy(false);setRefreshing(false);return;}
  const {data:members,error:mErr}=await supabase.from('conversation_members').select('conversation_id').eq('user_id',auth.user.id);
  if(mErr){setError(mErr.message);setRows([]);setBusy(false);setRefreshing(false);return;}
  const ids=(members||[]).map(x=>x.conversation_id);
  if(!ids.length){setRows([]);setBusy(false);setRefreshing(false);return;}
  const {data,error:cErr}=await supabase.from('conversations').select('id,title,is_group,created_at').in('id',ids).order('created_at',{ascending:false});
  if(cErr){setError(cErr.message);setRows([]);}else setRows((data||[]) as Conversation[]);
  setBusy(false);setRefreshing(false);
 },[]);
 useEffect(()=>{load();},[load]);
 return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ Back</Text></Pressable><Text style={styles.title}>Messages</Text><Pressable onPress={()=>{setRefreshing(true);load();}}><Text style={styles.link}>Refresh</Text></Pressable></View>
 {busy?<View style={styles.center}><ActivityIndicator size="large" color="#2449c7"/></View>:<FlatList data={rows} keyExtractor={x=>x.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}}/>} renderItem={({item})=><Pressable style={styles.item} onPress={()=>router.push({pathname:'/chat/[id]',params:{id:item.id}})}><View style={styles.avatar}><Text style={styles.avatarText}>{item.is_group?'G':'D'}</Text></View><View style={{flex:1}}><Text style={styles.name}>{item.title|| (item.is_group?'DANEGRAM group':'Conversation')}</Text><Text style={styles.sub}>Open conversation</Text></View><Text style={styles.arrow}>›</Text></Pressable>} ListEmptyComponent={<View style={styles.empty}><Text style={styles.name}>{error?'Messages unavailable':'No conversations yet'}</Text><Text style={styles.sub}>{error||'Your conversations will appear here.'}</Text></View>}/>}
 </SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#f4f6fb'},header:{height:58,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#fff'},link:{color:'#2449c7',fontWeight:'700'},title:{fontSize:18,fontWeight:'900',color:'#17213b'},list:{padding:14,gap:9,flexGrow:1},item:{backgroundColor:'#fff',borderRadius:14,padding:14,flexDirection:'row',alignItems:'center',gap:12},avatar:{width:44,height:44,borderRadius:22,backgroundColor:'#e7ecff',alignItems:'center',justifyContent:'center'},avatarText:{fontWeight:'900',color:'#2449c7'},name:{fontSize:15,fontWeight:'800',color:'#17213b'},sub:{fontSize:12,color:'#7c8598',marginTop:3},arrow:{fontSize:24,color:'#8b94a7'},empty:{padding:25,alignItems:'center',gap:8},center:{flex:1,alignItems:'center',justifyContent:'center'}});
