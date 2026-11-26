import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { error: "Server environment is not configured" });
  }
  if (!authorization?.startsWith("Bearer ")) {
    return json(401, { error: "Authentication required" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json(401, { error: "Your session is invalid or expired" });

    const body = await req.json().catch(() => ({}));
    const kind = body?.kind;
    const id = body?.id;
    if (!["message", "voicemail"].includes(kind) || typeof id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return json(400, { error: "Invalid deletion request" });
    }

    let mediaPath = "";
    if (kind === "message") {
      const { data: row, error } = await userClient
        .from("messages")
        .select("id,sender_id,media_url,created_at,deleted_for_everyone_at")
        .eq("id", id)
        .maybeSingle();
      if (error) return json(400, { error: error.message });
      if (!row) return json(404, { error: "Message not found or not accessible" });
      if (row.sender_id !== authData.user.id) return json(403, { error: "Only the sender can delete this message for everyone" });
      if (row.created_at && new Date(row.created_at).getTime() < Date.now() - 60 * 60 * 60 * 1000) {
        return json(400, { error: "The delete-for-everyone time limit has passed" });
      }
      mediaPath = row.media_url || "";
      const { error: deleteError } = await userClient.rpc("danegram_delete_message_for_everyone", { p_message_id: id });
      if (deleteError) return json(400, { error: deleteError.message });
    } else {
      const { data: row, error } = await userClient
        .from("danegram_voicemails")
        .select("id,caller_id,recipient_id,media_url,deleted_for_everyone_at")
        .eq("id", id)
        .maybeSingle();
      if (error) return json(400, { error: error.message });
      if (!row) return json(404, { error: "Voice message not found or not accessible" });
      if (![row.caller_id, row.recipient_id].includes(authData.user.id)) {
        return json(403, { error: "Only call participants can delete this voice message" });
      }
      mediaPath = row.media_url || "";
      const { error: deleteError } = await userClient.rpc("danegram_delete_voicemail_for_everyone", { p_voicemail_id: id });
      if (deleteError) return json(400, { error: deleteError.message });
    }

    if (!mediaPath) return json(200, { success: true, storageDeleted: true });
    const { error: storageError } = await adminClient.storage.from("danegram-media").remove([mediaPath]);
    if (storageError) {
      console.error("DANEGRAM media cleanup failed", { kind, id, message: storageError.message });
      return json(200, { success: true, storageDeleted: false });
    }
    return json(200, { success: true, storageDeleted: true });
  } catch (error) {
    console.error("DANEGRAM chat deletion failed", error);
    return json(500, { error: error instanceof Error ? error.message : "Unexpected server error" });
  }
});
