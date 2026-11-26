import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [userId,setUserId]=useState('');
  const [username,setUsername]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [bio,setBio]=useState('');
  const [avatar,setAvatar]=useState('');
  const [isPrivate,setIsPrivate]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  const load=useCallback(async()=>{
    const {data:auth}=await supabase.auth.getUser();
    if(!auth.user){setMessage('Please sign in again.');setLoading(false);return;}
    setUserId(auth.user.id);
    const {data,error}=await supabase.from('profiles').select('username,display_name,bio,avatar_url,is_private').eq('id',auth.user.id).maybeSingle();
    if(error)setMessage(error.message);
    if(data){setUsername(data.username||'');setDisplayName(data.display_name||'');setBio(data.bio||'');setAvatar(data.avatar_url||'');setIsPrivate(!!data.is_private);}
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const save=async()=>{
    if(!userId)return;
    setSaving(true);setMessage('');
    const {error}=await supabase.from('profiles').update({
      username:username.trim()||null,
      display_name:displayName.trim()||null,
      bio:bio.trim()||null,
      avatar_url:avatar.trim()||null,
      is_private:isPrivate
    }).eq('id',userId);
    setMessage(error?error.message:'Profile saved.');
    setSaving(false);
  };
  if(loading)return <View style={styles.center}><ActivityIndicator size="large" color="#2449c7"/></View>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ Back</Text></Pressable><Text style={styles.title}>My profile</Text><View/></View>
    <View style={styles.card}>
      {avatar?<Image source={{uri:avatar}} style={styles.avatar}/>:<View style={styles.avatar}><Text style={styles.avatarText}>{(displayName||username||'D').charAt(0).toUpperCase()}</Text></View>}
      <Text style={styles.hint}>Edit your DANEGRAM profile details</Text>
      <Text style={styles.label}>Display name</Text><TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name"/>
      <Text style={styles.label}>Username</Text><TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="username"/>
      <Text style={styles.label}>Bio</Text><TextInput style={[styles.input,styles.bio]} value={bio} onChangeText={setBio} multiline maxLength={250} placeholder="Tell people about yourself"/>
      <Text style={styles.label}>Profile photo URL</Text><TextInput style={styles.input} value={avatar} onChangeText={setAvatar} autoCapitalize="none" placeholder="https://..."/>
      <View style={styles.switchRow}><Text style={styles.label}>Private profile</Text><Switch value={isPrivate} onValueChange={setIsPrivate}/></View>
      {!!message&&<Text style={styles.message}>{message}</Text>}
      <Pressable style={styles.button} onPress={save} disabled={saving}><Text style={styles.buttonText}>{saving?'Saving…':'Save profile'}</Text></Pressable>
    </View>
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#f4f6fb'},page:{padding:16,gap:16},header:{height:48,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},link:{color:'#2449c7',fontWeight:'700'},title:{fontSize:19,fontWeight:'900',color:'#17213b'},card:{backgroundColor:'#fff',borderRadius:18,padding:18,gap:10},avatar:{width:86,height:86,borderRadius:43,backgroundColor:'#e6ebff',alignItems:'center',justifyContent:'center',alignSelf:'center'},avatarText:{fontSize:28,color:'#2449c7',fontWeight:'900'},hint:{textAlign:'center',color:'#778096',marginBottom:8},label:{color:'#29344c',fontWeight:'700',fontSize:13},input:{borderWidth:1,borderColor:'#e0e5ef',borderRadius:11,padding:12,color:'#17213b',backgroundColor:'#fafbfe'},bio:{minHeight:90,textAlignVertical:'top'},switchRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},button:{backgroundColor:'#2449c7',padding:15,borderRadius:12,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'800'},message:{color:'#53617b',fontSize:13},center:{flex:1,justifyContent:'center',alignItems:'center'}});
