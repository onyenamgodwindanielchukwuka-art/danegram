DANEGRAM COMMUNICATIONS REBUILD — WEB/PWA DELIVERY
Build: 2026.11.25-push1

WHAT IS INCLUDED
- index.html: existing DANEGRAM page, updated with PWA push registration, secure push requests for new messages/calls, and call-state refresh.
- manifest.webmanifest and sw.js: installable PWA metadata and background notification handling.
- danegram-push-config.js: public VAPID key placeholder only.
- supabase/migration_danegram_push_subscriptions.sql: RLS-protected push-subscription table.
- supabase/functions/danegram-send-push: authenticated Edge Function; checks conversation membership and validates call ownership before sending push.

IMPORTANT LIMITATIONS
- Web Push can show a system notification while the browser is backgrounded or closed, but browser notification sound/vibration is controlled by Android/browser/device settings. It is not a guaranteed full-screen native incoming-call experience or a guaranteed custom ringtone.
- Reliable WhatsApp-style full-screen incoming call UI and native ringtone on Android/iPhone require the Expo/native app phase (Android call notification/foreground service integration and iOS CallKit/push handling).
- Audio quality cannot be certified from static code. It needs a two-phone test on real networks, ideally with headphones first. The TURN function must return reachable TURN/TLS credentials; the call flow also needs WebRTC stats review for jitter, packet loss and selected relay candidate.

DEPLOY ORDER
1. Upload index.html, manifest.webmanifest, sw.js, danegram-push-config.js and icons (if available) to the website root on Cloudflare Pages/Netlify. Keep all paths at the root.
2. Run migration_danegram_push_subscriptions.sql in Supabase SQL Editor.
3. Generate VAPID keys in a trusted local terminal: `npx web-push generate-vapid-keys`.
4. Put ONLY the public key in danegram-push-config.js as window.DG_VAPID_PUBLIC_KEY.
5. Set these Supabase Edge Function secrets (never commit them): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (for example mailto:your-real-support-email).
6. Deploy `supabase/functions/danegram-send-push` to the existing Supabase project. Keep JWT verification enabled.
7. Sign into DANEGRAM on each phone, open Settings, and enable alerts. The browser must grant notification permission. This creates one push subscription per device.
8. Test: send a message with the recipient app in foreground, background, and closed; then test incoming calls under the same three conditions. Record device/browser and delivery timing.

SECURITY
- Never put VAPID_PRIVATE_KEY, Supabase secret/service key, or payment secrets in HTML/JS or GitHub.
- Push payloads intentionally contain only a short message preview or call alert; do not send private media or credentials.
- The Edge Function checks that the signed-in sender and target recipient belong to the same conversation. Call alerts additionally require a matching ringing call row owned by the sender.

CURRENT STATUS
This package is prepared but not deployed to GitHub, Cloudflare Pages, or Supabase. The GitHub connection was not available in this session, so deployment and live delivery remain unverified.

The package includes DANEGRAM PWA icons in /icons. The web app should be served over HTTPS (Cloudflare Pages provides this when the site domain is configured).
