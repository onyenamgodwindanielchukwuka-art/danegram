import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../src/lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submitAuth() {
    if (!supabaseConfigured) {
      setMessage('Mobile setup is incomplete. Add the existing DANEGRAM Supabase publishable key to your local environment.');
      return;
    }
    if (!email.trim() || password.length < 8) {
      setMessage('Enter your email and a password with at least 8 characters.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) {
        setMessage('Check your email to confirm your account, then sign in.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setMessage(error?.message || '');
    setBusy(false);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3157d5" /></View>;
  }

  if (session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.home}>
          <Text style={styles.brand}>DANEGRAM</Text>
          <Text style={styles.tagline}>Connect with your world.</Text>
          <View style={styles.panel}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.body}>{session.user.email || 'Signed-in DANEGRAM member'}</Text>
            <Text style={styles.note}>Your account is connected to the existing DANEGRAM Supabase project.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/feed')}>
              <Text style={styles.primaryButtonText}>Open DANEGRAM Feed</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push('/profile')}>
              <Text style={styles.secondaryButtonText}>Edit My Profile</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push('/create-post')}>
              <Text style={styles.secondaryButtonText}>Create a Post</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push('/notifications')}>
              <Text style={styles.secondaryButtonText}>View Notifications</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push('/messages')}>
              <Text style={styles.secondaryButtonText}>Open Messages</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push('/call-history')}>
              <Text style={styles.secondaryButtonText}>Calls & Voice Messages</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={signOut} disabled={busy}>
              <Text style={styles.secondaryButtonText}>{busy ? 'Please wait…' : 'Sign out'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.authCard}>
          <Text style={styles.brand}>DANEGRAM</Text>
          <Text style={styles.tagline}>One World. Many Connections.</Text>
          <Text style={styles.heading}>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#858b9b"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (at least 8 characters)"
            placeholderTextColor="#858b9b"
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChangeText={setPassword}
          />
          {!!message && <Text style={styles.message}>{message}</Text>}
          <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={submitAuth} disabled={busy}>
            <Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
          </Pressable>
          <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>
            <Text style={styles.switchText}>{mode === 'signin' ? 'New to DANEGRAM? Create an account' : 'Already registered? Sign in'}</Text>
          </Pressable>
          {!supabaseConfigured && <Text style={styles.warning}>Configuration required before testing authentication.</Text>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  authCard: { width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 24, padding: 26, gap: 15, elevation: 3 },
  home: { flex: 1, justifyContent: 'center', padding: 24, gap: 18 },
  panel: { backgroundColor: '#fff', borderRadius: 22, padding: 24, gap: 14 },
  brand: { color: '#2449c7', fontSize: 30, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' },
  tagline: { color: '#626b80', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  heading: { color: '#17213b', fontSize: 22, fontWeight: '800' },
  body: { color: '#39435a', fontSize: 15 },
  note: { color: '#687188', fontSize: 13, lineHeight: 20 },
  input: { backgroundColor: '#f6f7fb', borderColor: '#e1e5ef', borderWidth: 1, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 14, color: '#17213b', fontSize: 15 },
  primaryButton: { backgroundColor: '#2449c7', paddingVertical: 15, borderRadius: 13, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryButton: { borderColor: '#d8deec', borderWidth: 1, paddingVertical: 13, borderRadius: 13, alignItems: 'center' },
  secondaryButtonText: { color: '#2449c7', fontWeight: '800' },
  disabled: { opacity: 0.6 },
  switchText: { color: '#2449c7', fontWeight: '700', textAlign: 'center', padding: 8 },
  message: { color: '#a23a28', fontSize: 13, lineHeight: 19 },
  warning: { color: '#8a6420', fontSize: 12, textAlign: 'center' }
});
