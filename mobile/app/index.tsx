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
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { supabase, supabaseConfigured } from '../src/lib/supabase';

const TURNSTILE_HTML = `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>
    html,body{margin:0;padding:0;width:100%;min-height:76px;background:transparent;overflow:hidden}
    body{display:flex;justify-content:center;align-items:flex-start}
    #turnstile{width:100%;min-height:65px;display:flex;justify-content:center}
  </style>
</head>
<body>
  <div id="turnstile"></div>
  <script>
    (function(){
      var sent=false;
      function send(data){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data));}
      window.onerror=function(message){send({type:'error',message:'Security check script error: '+String(message)});};
      var script=document.createElement('script');
      script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async=true;
      script.defer=true;
      script.onload=function(){
        try{
          if(!window.turnstile){send({type:'error',message:'Cloudflare loaded but its verification API did not initialize.'});return;}
          window.turnstile.render('#turnstile',{
            sitekey:'0x4AAAAAAGRmTIX3e4SwqYpR',
            theme:'light',
            size:'flexible',
            callback:function(token){sent=true;send({type:'token',token:token});},
            'expired-callback':function(){sent=false;send({type:'expired'});},
            'unsupported-callback':function(){send({type:'error',message:'This Android WebView is not supported for Cloudflare verification.'});},
            'error-callback':function(code){send({type:'error',message:'Cloudflare verification failed ('+String(code||'unknown')+'). Check network or retry.'});}
          });
          setTimeout(function(){if(!sent)send({type:'waiting',message:'Cloudflare loaded. Waiting for the security check to finish.'});},12000);
        }catch(error){send({type:'error',message:'Could not start Cloudflare verification: '+String(error&&error.message||error)});}
      };
      script.onerror=function(){send({type:'error',message:'Could not download Cloudflare verification script. Check connection, DNS, or content blockers.'});};
      document.head.appendChild(script);
      setTimeout(function(){if(!window.turnstile)send({type:'error',message:'Cloudflare verification did not load within 15 seconds.'});},15000);
    })();
  </script>
</body>
</html>`;

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaMessage, setCaptchaMessage] = useState('Complete the security check to continue.');
  const [captchaReload, setCaptchaReload] = useState(0);

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
    if (!captchaToken) {
      setMessage('Complete the Cloudflare security check before continuing.');
      return;
    }
    if (!email.trim() || password.length < 8) {
      setMessage('Enter your email and a password with at least 8 characters.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setMessage('Your passwords do not match. Please check both password fields.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken } })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { captchaToken } });
      if (result.error) throw result.error;
      setCaptchaToken('');
      setCaptchaMessage('Please complete the refreshed security check.');
      setCaptchaReload((value) => value + 1);
      if (mode === 'signup' && !result.data.session) {
        setMessage('Check your email to confirm your account, then sign in.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  function handleCaptchaMessage(event: WebViewMessageEvent) {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'token' && typeof payload.token === 'string') { setCaptchaToken(payload.token); setCaptchaMessage('Security check completed.'); setMessage(''); }
      else if (payload.type === 'expired') { setCaptchaToken(''); setCaptchaMessage('Security check expired. Complete it again.'); }
      else if (payload.type === 'waiting') { setCaptchaMessage(payload.message || 'Waiting for security verification…'); }
      else if (payload.type === 'error') { setCaptchaToken(''); setCaptchaMessage(payload.message || 'Security check unavailable. Retry.'); }
    } catch { setCaptchaToken(''); setCaptchaMessage('Could not read the security check response. Retry.'); }
  }

  async function sendPasswordReset() {
    if (!supabaseConfigured) {
      setMessage('Mobile setup is incomplete. Please try again later.');
      return;
    }
    if (!email.trim()) {
      setMessage('Enter your account email address first.');
      return;
    }
    if (!captchaToken) {
      setMessage('Complete the Cloudflare security check before requesting a password reset.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'danegram://reset-password',
        captchaToken
      });
      if (error) throw error;
      setMessage('Password reset instructions have been sent if this email belongs to a DANEGRAM account. Check your inbox.');
      setCaptchaToken('');
      setCaptchaMessage('Please complete the refreshed security check.');
      setCaptchaReload((value) => value + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send the password reset email.');
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
          <View style={styles.passwordInputWrap}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Password (at least 8 characters)"
              placeholderTextColor="#858b9b"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setShowPassword((visible) => !visible)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityState={{ selected: showPassword }}
              hitSlop={8}
            >
              <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          {mode === 'signup' && (
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Confirm password"
                placeholderTextColor="#858b9b"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Pressable
                style={styles.passwordToggle}
                onPress={() => setShowConfirmPassword((visible) => !visible)}
                accessibilityRole="button"
                accessibilityLabel={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                hitSlop={8}
              >
                <Text style={styles.passwordToggleText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.captchaBox}>
            <WebView key={captchaReload} originWhitelist={['*']} source={{ html: TURNSTILE_HTML, baseUrl: 'https://danegram.pages.dev' }} onMessage={handleCaptchaMessage} javaScriptEnabled domStorageEnabled scrollEnabled={false} cacheEnabled={false} setSupportMultipleWindows={false} style={styles.captchaWebView} thirdPartyCookiesEnabled sharedCookiesEnabled onError={() => { setCaptchaToken(''); setCaptchaMessage('Could not load Cloudflare security verification. Retry.'); }} onHttpError={(event) => { setCaptchaToken(''); setCaptchaMessage('Cloudflare security service returned HTTP ' + event.nativeEvent.statusCode + '. Check your connection or retry.'); }} />
            <Text style={captchaToken ? styles.captchaSuccess : styles.captchaStatus}>{captchaMessage}</Text>
            <Pressable style={styles.captchaRetry} onPress={() => { setCaptchaToken(''); setCaptchaMessage('Refreshing security check…'); setCaptchaReload((value) => value + 1); }}><Text style={styles.captchaRetryText}>Reload security check</Text></Pressable>
          </View>
          {!!message && <Text style={styles.message}>{message}</Text>}
          {mode === 'signin' && (
            <Pressable style={styles.forgotButton} onPress={sendPasswordReset} disabled={busy}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}
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
  passwordInputWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 68 },
  passwordToggle: { position: 'absolute', right: 8, minWidth: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  passwordToggleText: { color: '#2449c7', fontSize: 13, fontWeight: '800' },
  primaryButton: { backgroundColor: '#2449c7', paddingVertical: 15, borderRadius: 13, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryButton: { borderColor: '#d8deec', borderWidth: 1, paddingVertical: 13, borderRadius: 13, alignItems: 'center' },
  secondaryButtonText: { color: '#2449c7', fontWeight: '800' },
  disabled: { opacity: 0.6 },
  switchText: { color: '#2449c7', fontWeight: '700', textAlign: 'center', padding: 8 },
  forgotButton: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  forgotText: { color: '#2449c7', fontWeight: '700', fontSize: 14 },
  message: { color: '#a23a28', fontSize: 13, lineHeight: 19 },
  captchaBox: { borderWidth: 1, borderColor: '#e1e5ef', borderRadius: 12, padding: 8, backgroundColor: '#fff' },
  captchaWebView: { height: 100, backgroundColor: 'transparent' },
  captchaStatus: { color: '#687188', fontSize: 12, textAlign: 'center', paddingVertical: 4 },
  captchaSuccess: { color: '#217a45', fontSize: 12, textAlign: 'center', paddingVertical: 4 },
  captchaRetry: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  captchaRetryText: { color: '#2449c7', fontWeight: '700', fontSize: 12 },
  warning: { color: '#8a6420', fontSize: 12, textAlign: 'center' }
});
