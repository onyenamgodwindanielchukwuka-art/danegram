-- DANEGRAM WhatsApp-style message replies.
-- Additive only: preserves existing messages and makes reply targets optional.
begin;

alter table public.messages
  add column if not exists reply_to_message_id uuid;

do $function$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_reply_to_message_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_reply_to_message_id_fkey
      foreign key (reply_to_message_id)
      references public.messages(id)
      on delete set null;
  end if;
end
$function$;

create or replace function public.danegram_validate_message_reply()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_parent_conversation uuid;
begin
  if new.reply_to_message_id is null then
    return new;
  end if;

  select m.conversation_id
    into v_parent_conversation
  from public.messages as m
  where m.id = new.reply_to_message_id;

  if not found or v_parent_conversation is distinct from new.conversation_id then
    raise exception 'Reply target must belong to the same conversation';
  end if;

  return new;
end;
$function$;

drop trigger if exists messages_validate_reply_target on public.messages;

create trigger messages_validate_reply_target
before insert or update of reply_to_message_id, conversation_id
on public.messages
for each row
execute function public.danegram_validate_message_reply();

create index if not exists messages_reply_to_message_id_idx
  on public.messages (reply_to_message_id)
  where reply_to_message_id is not null;

commit;
