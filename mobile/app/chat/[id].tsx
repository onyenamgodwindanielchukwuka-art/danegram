import { useCallback,useEffect,useState } from 'react';
import { ActivityIndicator,Alert,FlatList,Pressable,RefreshControl,SafeAreaView,StyleSheet,Text,View } from 'react-native';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
type Message={id:string;sender_id:string;content:string|null;media_url:string|null;media_type:string|null;created_at:string|null;deleted_for_everyone_at?:string|null};
export default function ChatScreen(){
 const {id}=useLocalSearchParams<{id:string}>();const router=useRouter();
 const [rows,setRows]=useState<Message[]>([]);const [userId,setUserId]=useState('');const [loading,setLoading]=useState(true);const [refreshing,setRefreshing]=useState(false);const [error,setError]=useState('');
 const load=useCallback(async()=>{
  setError('');const {data:auth}=await supabase.auth.getUser();if(!auth.user){setError('Please sign in again.');setLoading(false);setRefreshing(false);return;}setUserId(auth.user.id);
  const {data,error:qErr}=await supabase.from('messages').select('id,sender_id,content,media_url,media_type,created_at,deleted_for_everyone_at').eq('conversation_id',id).order('created_at',{ascending:true}).limit(100);
  if(qErr){setError(qErr.message);setRows([]);}else setRows((data||[]) as Message[]);
  setLoading(false);setRefreshing(false);
 },[id]);
 useEffect(()=>{load();},[load]);
 const act=(m:Message)=>{
  const own=m.sender_id===userId;
  const options=[{text:'Delete for me',onPress:async()=>{
   const {error}=await supabase.rpc('danegram_hide_message_for_self',{p_message_id:m.id});
   if(error)Alert.alert('Could not delete',error.message);else load();
  }}];
  if(own&&!m.deleted_for_everyone_at)options.push({text:'Delete for everyone',style:'destructive',onPress:async()=>{
   const {data,error}=await supabase.functions.invoke('danegram-delete-chat-media',{body:{kind:'message',id:m.id}});
   if(error)Alert.alert('Could not delete',error.message);
   else if(data?.error)Alert.alert('Could not delete',data.error);
   else {if(data?.storageDeleted===false)Alert.alert('Message deleted','The message was removed, but its attachment needs administrator cleanup.');load();}
  }} as any);
  options.push({text:'Cancel',style:'cancel'} as any);
  Alert.alert('Message options','Choose how to delete this message.',options as any);
 };
 const render=({item:m}:{item:Message})=>{
  const own=m.sender_id===userId;const deleted=!!m.deleted_for_everyone_at;
  return <Pressable onLongPress={()=>!deleted&&act(m)} delayLongPress={350} style={[styles.bubble,own?styles.mine:styles.theirs]}>
   <Text style={[styles.body,deleted&&styles.deleted]}>{deleted?'This message was deleted':m.content||(m.media_type==='audio'||m.media_type==='voice'?'🎤 Voice message':m.media_type==='video'?'🎬 Video':m.media_url?'📎 Attachment':'')}</Text>
   {!!m.media_url&&!deleted&&<Text style={styles.media}>Attachment · open in DANEGRAM web</Text>}
   <Text style={styles.time}>{m.created_at?new Date(m.created_at).toLocaleTimeString():''} · Hold to delete</Text>
  </Pressable>;
 };
 return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ Back</Text></Pressable><Text style={styles.title}>Conversation</Text><Pressable onPress={()=>{setRefreshing(true);load();}}><Text style={styles.link}>Refresh</Text></Pressable></View>
 {loading?<View style={styles.center}><ActivityIndicator size="large" color="#2449c7"/></View>:<FlatList data={rows} keyExtractor={m=>m.id} renderItem={render} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}}/>} ListEmptyComponent={<Text style={styles.empty}>{error||'No messages yet.'}</Text>}/>}
 </SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#f4f6fb'},header:{height:58,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#fff'},link:{color:'#2449c7',fontWeight:'700'},title:{fontSize:18,fontWeight:'900',color:'#17213b'},list:{padding:14,gap:9,flexGrow:1},bubble:{maxWidth:'84%',padding:12,borderRadius:15,gap:5},mine:{alignSelf:'flex-end',backgroundColor:'#dfe7ff'},theirs:{alignSelf:'flex-start',backgroundColor:'#fff'},body:{color:'#1e2941',fontSize:15},deleted:{color:'#858da0',fontStyle:'italic'},media:{color:'#3157c7',fontSize:12},time:{fontSize:10,color:'#7f899d',textAlign:'right'},empty:{textAlign:'center',color:'#778096',marginTop:50},center:{flex:1,alignItems:'center',justifyContent:'center'}});
