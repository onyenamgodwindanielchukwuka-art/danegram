import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function CreatePostScreen(){
 const router=useRouter();
 const [content,setContent]=useState('');
 const [visibility,setVisibility]=useState<'public'|'followers'|'private'>('public');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const publish=async()=>{
  const text=content.trim();
  if(!text){setMessage('Write something before publishing.');return;}
  setBusy(true);setMessage('');
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user){setMessage('Please sign in again.');setBusy(false);return;}
  const {error}=await supabase.from('posts').insert({user_id:auth.user.id,content:text,media_type:'text',visibility});
  if(error){setMessage(error.message);setBusy(false);return;}
  setBusy(false);router.replace('/feed');
 };
 return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable onPress={()=>router.back()}><Text style={styles.link}>Cancel</Text></Pressable><Text style={styles.title}>Create post</Text><View/></View><View style={styles.card}>
  <Text style={styles.prompt}>Share something with your world.</Text>
  <TextInput style={styles.editor} multiline autoFocus value={content} onChangeText={setContent} maxLength={5000} placeholder="What's happening?"/>
  <Text style={styles.count}>{content.length}/5000</Text>
  <Text style={styles.label}>Who can see this post?</Text>
  <View style={styles.choices}>{(['public','followers','private'] as const).map(v=><Pressable key={v} onPress={()=>setVisibility(v)} style={[styles.choice,visibility===v&&styles.selected]}><Text style={[styles.choiceText,visibility===v&&styles.selectedText]}>{v[0].toUpperCase()+v.slice(1)}</Text></Pressable>)}</View>
  {!!message&&<Text style={styles.message}>{message}</Text>}
  <Pressable style={styles.button} onPress={publish} disabled={busy}><Text style={styles.buttonText}>{busy?'Publishing…':'Publish post'}</Text></Pressable>
 </View></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#f4f6fb'},header:{height:58,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#fff'},link:{color:'#2449c7',fontWeight:'700'},title:{fontSize:18,fontWeight:'900',color:'#17213b'},card:{margin:14,padding:18,backgroundColor:'#fff',borderRadius:18,gap:14},prompt:{fontSize:16,fontWeight:'800',color:'#17213b'},editor:{minHeight:190,textAlignVertical:'top',fontSize:16,color:'#17213b',padding:12,backgroundColor:'#f8f9fc',borderRadius:12},count:{textAlign:'right',fontSize:11,color:'#8991a2'},label:{fontWeight:'700',color:'#29344c'},choices:{flexDirection:'row',gap:8},choice:{paddingVertical:10,paddingHorizontal:14,borderRadius:20,backgroundColor:'#f0f2f8'},selected:{backgroundColor:'#2449c7'},choiceText:{color:'#4d5870',fontWeight:'700'},selectedText:{color:'#fff'},button:{backgroundColor:'#2449c7',padding:15,borderRadius:12,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'800'},message:{color:'#a23a28',fontSize:13}});
