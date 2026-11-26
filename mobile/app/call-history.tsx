import {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,FlatList,Pressable,RefreshControl,SafeAreaView,StyleSheet,Text,View} from 'react-native';
import {useRouter} from 'expo-router';
import {supabase} from '../src/lib/supabase';
type Call={id:string;caller_id:string;callee_id:string;call_type:string;status:string;created_at:string|null;deleted_for_everyone_at:string|null};
type Voicemail={id:string;caller_id:string;recipient_id:string;duration_seconds:number|null;created_at:string|null};
export default function CallHistoryScreen(){
 const router=useRouter();const [calls,setCalls]=useState<Call[]>([]);const [voicemails,setVoicemails]=useState<Voicemail[]>([]);const [userId,setUserId]=useState('');const [loading,setLoading]=useState(true);const [refreshing,setRefreshing]=useState(false);const [error,setError]=useState('');
 const load=useCallback(async()=>{
  setError('');const {data:auth}=await supabase.auth.getUser();if(!auth.user){setError('Please sign in again.');setLoading(false);setRefreshing(false);return;}setUserId(auth.user.id);
  const [c,v]=await Promise.all([
   supabase.from('danegram_calls').select('id,caller_id,callee_id,call_type,status,created_at,deleted_for_everyone_at').or('caller_id.eq.'+auth.user.id+',callee_id.eq.'+auth.user.id).is('deleted_for_everyone_at',null).order('created_at',{ascending:false}).limit(100),
   supabase.from('danegram_voicemails').select('id,caller_id,recipient_id,duration_seconds,created_at').or('caller_id.eq.'+auth.user.id+',recipient_id.eq.'+auth.user.id).is('deleted_for_everyone_at',null).order('created_at',{ascending:false}).limit(100)
  ]);
  if(c.error)setError(c.error.message);else setCalls((c.data||[]) as Call[]);
  if(v.error)setError(x=>x?x+' · '+v.error.message:v.error.message);else setVoicemails((v.data||[]) as Voicemail[]);
  setLoading(false);setRefreshing(false);
 },[]);
 useEffect(()=>{load();},[load]);
 const callAction=(item:Call)=>Alert.alert('Delete call record','Choose where to remove this call from.',[
  {text:'Delete for me',onPress:async()=>{const {error}=await supabase.rpc('danegram_delete_call_for_self',{p_call_id:item.id});if(error)Alert.alert('Could not delete',error.message);else load();}},
  {text:'Delete for both sides',style:'destructive',onPress:async()=>{const {error}=await supabase.rpc('danegram_delete_call_for_everyone',{p_call_id:item.id});if(error)Alert.alert('Could not delete',error.message);else load();}},
  {text:'Cancel',style:'cancel'}
 ]);
 const voicemailAction=(item:Voicemail)=>Alert.alert('Delete voice message','Remove this voicemail from your history?',[
  {text:'Delete for me',onPress:async()=>{const {error}=await supabase.rpc('danegram_delete_voicemail_for_self',{p_voicemail_id:item.id});if(error)Alert.alert('Could not delete',error.message);else load();}},
  {text:'Delete for both sides',style:'destructive',onPress:async()=>{const {data,error}=await supabase.functions.invoke('danegram-delete-chat-media',{body:{kind:'voicemail',id:item.id}});if(error)Alert.alert('Could not delete',error.message);else if(data?.error)Alert.alert('Could not delete',data.error);else {if(data?.storageDeleted===false)Alert.alert('Voice message deleted','The recording needs administrator cleanup.');load();}}},
  {text:'Cancel',style:'cancel'}
 ]);
 return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ Back</Text></Pressable><Text style={styles.title}>Calls & voice messages</Text><Pressable onPress={()=>{setRefreshing(true);load();}}><Text style={styles.link}>Refresh</Text></Pressable></View>
 {loading?<View style={styles.center}><ActivityIndicator size="large" color="#2449c7"/></View>:<FlatList data={[...calls.map(x=>({kind:'call' as const,item:x})),...voicemails.map(x=>({kind:'voice' as const,item:x}))].sort((a,b)=>new Date(b.item.created_at||0).getTime()-new Date(a.item.created_at||0).getTime())} keyExtractor={x=>x.kind+x.item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}}/>} renderItem={({item:x})=><Pressable style={styles.row} onLongPress={()=>x.kind==='call'?callAction(x.item as Call):voicemailAction(x.item as Voicemail)}><Text style={styles.icon}>{x.kind==='call'?'📞':'🎤'}</Text><View style={{flex:1}}><Text style={styles.name}>{x.kind==='call'?'Call · '+(x.item as Call).call_type:'Voice message · '+((x.item as Voicemail).duration_seconds||0)+' sec'}</Text><Text style={styles.sub}>{x.item.created_at?new Date(x.item.created_at).toLocaleString():'Recent'}</Text><Text style={styles.hint}>Hold to delete</Text></View></Pressable>} ListEmptyComponent={<View style={styles.empty}><Text style={styles.name}>{error?'Call history unavailable':'No calls or voice messages'}</Text><Text style={styles.sub}>{error||'Your call history will appear here.'}</Text></View>}/>}
 </SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#f4f6fb'},header:{height:58,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#fff'},link:{color:'#2449c7',fontWeight:'700'},title:{fontSize:16,fontWeight:'900',color:'#17213b'},list:{padding:14,gap:9,flexGrow:1},row:{backgroundColor:'#fff',padding:14,borderRadius:14,flexDirection:'row',alignItems:'center',gap:12},icon:{fontSize:24},name:{fontWeight:'800',color:'#17213b'},sub:{fontSize:12,color:'#7b8498',marginTop:4},hint:{fontSize:10,color:'#3157c7',marginTop:4},empty:{alignItems:'center',padding:25,gap:8},center:{flex:1,alignItems:'center',justifyContent:'center'}});
