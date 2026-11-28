import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import WebView, { type WebViewNavigation } from 'react-native-webview';

const DANEGRAM_LIVE_URL = 'https://danegram.pages.dev/';

export default function HomeScreen() {
  const webView = useRef<WebView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const handleNavigation = useCallback((navigation: WebViewNavigation) => {
    setCanGoBack(navigation.canGoBack);
    setFailed(false);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webView.current?.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.safe}>
      <WebView
        ref={webView}
        source={{ uri: DANEGRAM_LIVE_URL }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        cacheEnabled
        originWhitelist={['https://*', 'http://*']}
        onLoadStart={() => { setLoading(true); setFailed(false); }}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavigation}
        onError={() => { setLoading(false); setFailed(true); }}
        onHttpError={(event: { nativeEvent: { statusCode: number } }) => {
          if (event.nativeEvent.statusCode >= 500) {
            setLoading(false);
            setFailed(true);
          }
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#2449c7" />
            <Text style={styles.loadingText}>Loading DANEGRAM…</Text>
          </View>
        )}
        startInLoadingState
      />
      {loading && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2449c7" />
          <Text style={styles.loadingText}>Loading DANEGRAM…</Text>
        </View>
      )}
      {failed && (
        <View style={styles.errorOverlay}>
          <Text style={styles.brand}>DANEGRAM</Text>
          <Text style={styles.errorText}>Unable to connect to the live DANEGRAM website. Check your internet connection and try again.</Text>
          <Text style={styles.retry} onPress={() => webView.current?.reload()}>Try again</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f6fa' },
  web: { flex: 1, backgroundColor: '#f5f6fa' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f5f6fa' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f5f6fa' },
  loadingText: { color: '#687188', fontSize: 14 },
  errorOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#f5f6fa' },
  brand: { color: '#2449c7', fontSize: 30, fontWeight: '900', marginBottom: 18 },
  errorText: { color: '#252b3b', textAlign: 'center', lineHeight: 23 },
  retry: { marginTop: 24, color: '#2449c7', fontWeight: '800', fontSize: 16, padding: 12 }
});
