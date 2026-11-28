import { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Open this screen using the password-reset link sent to your email.');

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
        setMessage('Choose a new password for your DANEGRAM account.');
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function savePassword() {
    if (password.length < 8) { setMessage('Use a password with at least 8 characters.'); return; }
    if (password !== confirm) { setMessage('The passwords do not match.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setMessage('Your password has been updated. You can now sign in.');
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.brand}>DANEGRAM</Text>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.message}>{message}</Text>
        {ready ? <>
          <TextInput style={styles.input} placeholder="New password (at least 8 characters)" secureTextEntry value={password} onChangeText={setPassword} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Confirm new password" secureTextEntry value={confirm} onChangeText={setConfirm} autoCapitalize="none" />
          <Pressable style={styles.button} onPress={savePassword} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update password</Text>}
          </Pressable>
        </> : <Pressable style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>Back to sign in</Text>
        </Pressable>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7fb', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 24, gap: 16, elevation: 3 },
  brand: { color: '#2449c7', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  title: { color: '#17213b', fontSize: 22, fontWeight: '800' },
  message: { color: '#687188', fontSize: 14, lineHeight: 21 },
  input: { backgroundColor: '#f6f7fb', borderColor: '#e1e5ef', borderWidth: 1, borderRadius: 13, padding: 15, color: '#17213b' },
  button: { backgroundColor: '#2449c7', padding: 15, borderRadius: 13, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' }
});
