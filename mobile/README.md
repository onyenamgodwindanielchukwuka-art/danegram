# DANEGRAM Mobile (Expo)

This is a separate native Android/iOS foundation. It does not replace the live website or change the existing Supabase schema.

## Current scope

- Expo Router application shell for Android and iOS.
- Supabase client configured for the existing DANEGRAM project.
- Email/password sign-in and sign-up using Supabase Auth.
- Authenticated feed reading from the existing `posts` and `profiles` tables, governed by their current RLS policies.
- Personal notifications inbox with owner-scoped reads and mark-as-read updates.
- Native conversation list and chat history with long-press **Delete for me** and sender-only **Delete for everyone** (60-hour window).
- Call history and voicemail controls for **Delete for me** and participant-authorized **Delete for both sides**.
- No service-role key, Paystack secret, VAPID private key, or other server secret is bundled in the app.
- Existing website, database and Edge Functions remain the source of truth.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the existing project's **publishable/anon client key**. Do not use a Supabase secret/service-role key.
3. From this directory run `npm install`.
4. Run `npx expo install --fix` to align Expo native dependencies with the installed SDK.
5. Run `npx expo-doctor`, then `npx expo start`.

## Expo/EAS linking

This starter intentionally has no EAS project UUID yet. Once the Expo account/project is confirmed, run `eas init` from this directory and commit the generated `extra.eas.projectId`. Do not create a second Supabase project; link to the existing DANEGRAM project.

## Release profiles

- `development`: development client for device testing.
- `preview`: internal QA distribution.
- `production`: store build, only after device testing, security review, app identifiers and store metadata are approved.

The current application is an early foundation, not a completed social-network app. Feed reading, profile editing, text-post creation, personal notifications, chat-history deletion controls and call/voicemail-history deletion controls are present in the mobile branch. The shared chat-deletion database migration has been applied to the existing production Supabase project, and the authenticated `danegram-delete-chat-media` Edge Function is deployed with JWT verification to remove voicemail/message attachments from the `danegram-media` bucket. These deletion flows still require two-account and physical-device QA, including verification of actual object removal. Media uploads, story creation/viewing, sending new messages and voice notes, live call UI, groups, creator tools, marketplace, booking, wallet and verification still need staged integration and device testing.

## Before store release

- Confirm that `com.danegram.app` is available and reserve the final Android/iOS identifiers.
- Confirm existing Supabase Auth providers and email/phone verification requirements.
- Test account creation, sign-in, sign-out, session persistence and password recovery.
- Test permissions, deep links, push notifications, media upload and calls on physical devices.
- Verify store privacy disclosures, account deletion, moderation/reporting and payment-policy compliance.
- Never move private credentials into `EXPO_PUBLIC_*` variables.
