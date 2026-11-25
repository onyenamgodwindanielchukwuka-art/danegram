import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const anonKey = Deno.env.get(publishableKeys.default) || Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get(secretKeys.default) || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@danegram.com';
  if (!url || !anonKey || !serviceKey || !publicKey || !privateKey) return json({ error: 'Push service is not configured.' }, 503);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sign-in required.' }, 401);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const senderId = authData.user?.id;
  if (authError || !senderId) return json({ error: 'Invalid session.' }, 401);

  let body: { conversation_id?: string; kind?: string; body?: string; call_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  const conversationId = body.conversation_id;
  const kind = body.kind === 'call' ? 'call' : 'message';
  if (!conversationId) return json({ error: 'conversation_id is required.' }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: members, error: membersError } = await admin.from('conversation_members').select('user_id').eq('conversation_id', conversationId);
  if (membersError) return json({ error: 'Could not verify conversation members.' }, 500);
  const memberIds = (members || []).map((m: { user_id: string }) => m.user_id);
  if (!memberIds.includes(senderId)) return json({ error: 'You are not a member of this conversation.' }, 403);

  let recipients = memberIds.filter((id: string) => id !== senderId);
  if (kind === 'call') {
    if (!body.call_id) return json({ error: 'call_id is required for call alerts.' }, 400);
    const { data: call, error: callError } = await admin.from('danegram_calls').select('id,conversation_id,caller_id,callee_id,status,call_type').eq('id', body.call_id).maybeSingle();
    if (callError || !call || call.conversation_id !== conversationId || call.caller_id !== senderId || call.status !== 'ringing' || !memberIds.includes(call.callee_id)) return json({ error: 'Call alert is not valid.' }, 403);
    recipients = [call.callee_id];
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const { data: subscriptions, error: subError } = await admin.from('danegram_push_subscriptions').select('id,endpoint,p256dh,auth,user_id').in('user_id', recipients);
  if (subError) return json({ error: 'Could not load push subscriptions.' }, 500);

  const title = kind === 'call' ? (body.body || 'Incoming DANEGRAM call') : 'New DANEGRAM message';
  const payload = JSON.stringify({
    kind, title,
    body: kind === 'call' ? (body.body || 'Someone is calling you on DANEGRAM.') : (body.body || 'You received a new message.'),
    conversation_id: conversationId,
    call_id: body.call_id || null,
    url: kind === 'call' ? `/?openCall=${encodeURIComponent(body.call_id || '')}` : `/?openConversation=${encodeURIComponent(conversationId)}`,
  });

  let sent = 0;
  const stale: string[] = [];
  await Promise.all((subscriptions || []).map(async (sub: any) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: kind === 'call' ? 35 : 3600, urgency: kind === 'call' ? 'high' : 'normal' });
      sent++;
    } catch (e) {
      const status = (e as any)?.statusCode;
      if (status === 404 || status === 410) stale.push(sub.id);
      console.warn('Push delivery failed:', status || (e as Error).message);
    }
  }));
  if (stale.length) await admin.from('danegram_push_subscriptions').delete().in('id', stale);
  return json({ ok: true, sent, recipients: recipients.length });
});
