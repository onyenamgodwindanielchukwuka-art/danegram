-- DANEGRAM message deletion support (review and apply separately after backup).
-- No production SQL is run by this file.
begin;

alter table public.messages
  add column if not exists deleted_for_everyone_at timestamptz,
  add column if not exists deleted_for_everyone_by uuid references auth.users(id);

create table if not exists public.message_hidden_for_users (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_hidden_for_users enable row level security;

drop policy if exists "Users can view their own hidden messages" on public.message_hidden_for_users;
create policy "Users can view their own hidden messages"
on public.message_hidden_for_users for select
to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can hide messages for themselves" on public.message_hidden_for_users;
create policy "Users can hide messages for themselves"
on public.message_hidden_for_users for insert
to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.messages m
    where m.id = message_id
      and public.is_conversation_member(m.conversation_id)
  )
);

create or replace function public.danegram_hide_message_for_self(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.messages m
    where m.id = p_message_id
      and public.is_conversation_member(m.conversation_id)
  ) then raise exception 'Message not found or access denied'; end if;

  insert into public.message_hidden_for_users(message_id, user_id)
  values (p_message_id, v_user)
  on conflict (message_id, user_id) do nothing;
end;
$$;

create or replace function public.danegram_delete_message_for_everyone(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_message public.messages%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select * into v_message
  from public.messages
  where id = p_message_id
  for update;

  if not found then raise exception 'Message not found'; end if;
  if v_message.sender_id <> v_user then raise exception 'Only the sender can delete this message for everyone'; end if;
  if not public.is_conversation_member(v_message.conversation_id) then raise exception 'Conversation access denied'; end if;
  if v_message.created_at < now() - interval '60 hours' then
    raise exception 'The delete-for-everyone time limit has passed';
  end if;
  if v_message.deleted_for_everyone_at is not null then return; end if;

  update public.messages
  set content = 'This message was deleted',
      media_url = null,
      deleted_for_everyone_at = now(),
      deleted_for_everyone_by = v_user
  where id = p_message_id;
end;
$$;

revoke all on function public.danegram_hide_message_for_self(uuid) from public, anon;
revoke all on function public.danegram_delete_message_for_everyone(uuid) from public, anon;
grant execute on function public.danegram_hide_message_for_self(uuid) to authenticated;
grant execute on function public.danegram_delete_message_for_everyone(uuid) to authenticated;


-- Ensure a user's "delete for me" choice is enforced by message SELECT queries.
drop policy if exists "Users cannot view messages hidden for themselves" on public.messages;
create policy "Users cannot view messages hidden for themselves"
on public.messages as restrictive for select
to authenticated using (
  not exists (
    select 1 from public.message_hidden_for_users h
    where h.message_id = messages.id
      and h.user_id = (select auth.uid())
  )
);

-- Call history supports hide-for-self and delete-for-both-participants.
alter table public.danegram_calls
  add column if not exists deleted_for_everyone_at timestamptz,
  add column if not exists deleted_for_everyone_by uuid references auth.users(id);

create table if not exists public.danegram_call_hidden_for_users (
  call_id uuid not null references public.danegram_calls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (call_id, user_id)
);
alter table public.danegram_call_hidden_for_users enable row level security;

drop policy if exists "Users view own hidden call history" on public.danegram_call_hidden_for_users;
create policy "Users view own hidden call history"
on public.danegram_call_hidden_for_users for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users hide own call history" on public.danegram_call_hidden_for_users;
create policy "Users hide own call history"
on public.danegram_call_hidden_for_users for insert to authenticated
with check (user_id = (select auth.uid()));

create or replace function public.danegram_delete_call_for_self(p_call_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.danegram_calls c
    where c.id=p_call_id and v_user in (c.caller_id,c.callee_id)) then
    raise exception 'Call not found or access denied';
  end if;
  insert into public.danegram_call_hidden_for_users(call_id,user_id)
  values(p_call_id,v_user) on conflict do nothing;
end; 
$$;

create or replace function public.danegram_delete_call_for_everyone(p_call_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_updated boolean := false;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  update public.danegram_calls c
  set deleted_for_everyone_at=now(), deleted_for_everyone_by=v_user
  where c.id=p_call_id and v_user in (c.caller_id,c.callee_id)
    and c.deleted_for_everyone_at is null;
  v_updated := found;
  if v_updated then
    delete from public.danegram_call_signals where call_id=p_call_id;
  end if;
  if not v_updated and not exists (select 1 from public.danegram_calls c
    where c.id=p_call_id and v_user in (c.caller_id,c.callee_id)
      and c.deleted_for_everyone_at is not null) then
    raise exception 'Call not found or access denied';
  end if;
end; 
$$;

revoke all on function public.danegram_delete_call_for_self(uuid) from public, anon;
revoke all on function public.danegram_delete_call_for_everyone(uuid) from public, anon;
grant execute on function public.danegram_delete_call_for_self(uuid) to authenticated;
grant execute on function public.danegram_delete_call_for_everyone(uuid) to authenticated;

-- Voice notes sent as messages use the message deletion RPCs above.
-- Voicemail records are kept separate from messages and need their own per-user history.
create table if not exists public.danegram_voicemail_hidden_for_users (
  voicemail_id uuid not null references public.danegram_voicemails(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (voicemail_id,user_id)
);
alter table public.danegram_voicemail_hidden_for_users enable row level security;

drop policy if exists "Users view own hidden voicemail" on public.danegram_voicemail_hidden_for_users;
create policy "Users view own hidden voicemail"
on public.danegram_voicemail_hidden_for_users for select to authenticated
using (user_id=(select auth.uid()));

drop policy if exists "Users hide own voicemail" on public.danegram_voicemail_hidden_for_users;
create policy "Users hide own voicemail"
on public.danegram_voicemail_hidden_for_users for insert to authenticated
with check (user_id=(select auth.uid()));

create or replace function public.danegram_delete_voicemail_for_self(p_voicemail_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.danegram_voicemails v
    where v.id=p_voicemail_id and v_user in (v.caller_id,v.recipient_id)) then
    raise exception 'Voicemail not found or access denied';
  end if;
  insert into public.danegram_voicemail_hidden_for_users(voicemail_id,user_id)
  values(p_voicemail_id,v_user) on conflict do nothing;
end; 
$$;

revoke all on function public.danegram_delete_voicemail_for_self(uuid) from public, anon;
grant execute on function public.danegram_delete_voicemail_for_self(uuid) to authenticated;


drop policy if exists "Users cannot view call history hidden for themselves" on public.danegram_calls;
create policy "Users cannot view call history hidden for themselves"
on public.danegram_calls as restrictive for select to authenticated
using (
  not exists (
    select 1 from public.danegram_call_hidden_for_users h
    where h.call_id=danegram_calls.id and h.user_id=(select auth.uid())
  )
);

drop policy if exists "Users cannot view calls deleted for everyone" on public.danegram_calls;
create policy "Users cannot view calls deleted for everyone"
on public.danegram_calls as restrictive for select to authenticated
using (deleted_for_everyone_at is null);
drop policy if exists "Users cannot view voicemail hidden for themselves" on public.danegram_voicemails;
create policy "Users cannot view voicemail hidden for themselves"
on public.danegram_voicemails as restrictive for select to authenticated
using (
  not exists (
    select 1 from public.danegram_voicemail_hidden_for_users h
    where h.voicemail_id=danegram_voicemails.id and h.user_id=(select auth.uid())
  )
);


alter table public.danegram_voicemails
  add column if not exists deleted_for_everyone_at timestamptz,
  add column if not exists deleted_for_everyone_by uuid references auth.users(id);

create or replace function public.danegram_delete_voicemail_for_everyone(p_voicemail_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  update public.danegram_voicemails v
  set deleted_for_everyone_at=now(), deleted_for_everyone_by=v_user, media_url=''
  where v.id=p_voicemail_id and v_user in (v.caller_id,v.recipient_id)
    and v.deleted_for_everyone_at is null;
  if not found and not exists(select 1 from public.danegram_voicemails v
    where v.id=p_voicemail_id and v_user in (v.caller_id,v.recipient_id)
      and v.deleted_for_everyone_at is not null) then
    raise exception 'Voice message not found or access denied';
  end if;
end; 
$$;
revoke all on function public.danegram_delete_voicemail_for_everyone(uuid) from public, anon;
grant execute on function public.danegram_delete_voicemail_for_everyone(uuid) to authenticated;

drop policy if exists "Users cannot view voicemail deleted for everyone" on public.danegram_voicemails;
create policy "Users cannot view voicemail deleted for everyone"
on public.danegram_voicemails as restrictive for select to authenticated
using (deleted_for_everyone_at is null);

commit;
