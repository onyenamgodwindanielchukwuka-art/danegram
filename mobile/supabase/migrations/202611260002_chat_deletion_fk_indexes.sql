-- Cover the new foreign keys introduced by chat deletion support.
create index if not exists message_hidden_for_users_user_id_idx
  on public.message_hidden_for_users(user_id);
create index if not exists danegram_call_hidden_for_users_user_id_idx
  on public.danegram_call_hidden_for_users(user_id);
create index if not exists danegram_voicemail_hidden_for_users_user_id_idx
  on public.danegram_voicemail_hidden_for_users(user_id);

create index if not exists messages_deleted_for_everyone_by_idx
  on public.messages(deleted_for_everyone_by)
  where deleted_for_everyone_by is not null;
create index if not exists danegram_calls_deleted_for_everyone_by_idx
  on public.danegram_calls(deleted_for_everyone_by)
  where deleted_for_everyone_by is not null;
create index if not exists danegram_voicemails_deleted_for_everyone_by_idx
  on public.danegram_voicemails(deleted_for_everyone_by)
  where deleted_for_everyone_by is not null;
