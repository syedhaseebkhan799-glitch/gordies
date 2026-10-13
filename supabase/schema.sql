-- =========================================================
-- Gordies chat app — database setup
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run again (it drops and recreates its own objects).
-- =========================================================

-- ---------- Tables ----------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique
               check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- One row per 1-to-1 chat. user_a is always the smaller id, so a pair
-- of friends can only ever have ONE chat.
create table if not exists public.chats (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references public.profiles(id) on delete cascade,
  user_b          uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.chats(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);

create index if not exists messages_chat_time_idx on public.messages (chat_id, created_at);

-- "# General": one group chat that every member is in (like a server channel).
create table if not exists public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists group_messages_time_idx on public.group_messages (created_at);

-- ---------- Helper: is the current user in this chat? ----------

create or replace function public.is_chat_member(p_chat uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from chats c
    where c.id = p_chat and auth.uid() in (c.user_a, c.user_b)
  );
$$;

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.chats    enable row level security;
alter table public.messages enable row level security;
alter table public.group_messages enable row level security;

drop policy if exists "profiles readable by logged-in users" on public.profiles;
create policy "profiles readable by logged-in users" on public.profiles
  for select to authenticated using (true);

drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "see own chats" on public.chats;
create policy "see own chats" on public.chats
  for select to authenticated using (auth.uid() in (user_a, user_b));

drop policy if exists "read messages in own chats" on public.messages;
create policy "read messages in own chats" on public.messages
  for select to authenticated using (public.is_chat_member(chat_id));

drop policy if exists "send messages in own chats" on public.messages;
create policy "send messages in own chats" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_chat_member(chat_id));

drop policy if exists "members read group" on public.group_messages;
create policy "members read group" on public.group_messages
  for select to authenticated using (true);

drop policy if exists "members send to group" on public.group_messages;
create policy "members send to group" on public.group_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid()));

-- Users cannot UPDATE messages directly; seen ticks go through mark_chat_seen().

-- ---------- Functions the app calls ----------

-- Find the chat with another user, or create it.
create or replace function public.get_or_create_chat(other_user uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  chat_id uuid;
begin
  if me is null then raise exception 'not logged in'; end if;
  if other_user = me then raise exception 'cannot chat with yourself'; end if;
  if not exists (select 1 from profiles where id = other_user) then
    raise exception 'user not found';
  end if;

  a := least(me, other_user);
  b := greatest(me, other_user);

  insert into chats (user_a, user_b) values (a, b)
  on conflict (user_a, user_b) do nothing;

  select id into chat_id from chats where user_a = a and user_b = b;
  return chat_id;
end;
$$;

-- Mark every message the OTHER person sent in this chat as seen.
create or replace function public.mark_chat_seen(p_chat uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_chat_member(p_chat) then raise exception 'not your chat'; end if;
  update messages
     set seen_at = now()
   where chat_id = p_chat
     and sender_id <> auth.uid()
     and seen_at is null;
end;
$$;

-- Chat list for the home screen: other person + last message + unread count.
drop function if exists public.my_chats();
create function public.my_chats()
returns table (
  chat_id           uuid,
  other_id          uuid,
  other_username    text,
  other_display     text,
  other_avatar      text,
  last_body         text,
  last_sender       uuid,
  last_seen_at      timestamptz,
  last_message_at   timestamptz,
  unread            bigint
)
language sql stable security invoker set search_path = public
as $$
  select
    c.id,
    p.id, p.username, p.display_name, p.avatar_url,
    lm.body, lm.sender_id, lm.seen_at,
    coalesce(lm.created_at, c.created_at),
    (select count(*) from messages m
      where m.chat_id = c.id and m.sender_id <> auth.uid() and m.seen_at is null)
  from chats c
  join profiles p
    on p.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  left join lateral (
    select body, sender_id, seen_at, created_at
    from messages m where m.chat_id = c.id
    order by created_at desc limit 1
  ) lm on true
  where auth.uid() in (c.user_a, c.user_b)
  order by coalesce(lm.created_at, c.created_at) desc;
$$;

-- Keep chats.last_message_at fresh.
create or replace function public.bump_chat_time()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update chats set last_message_at = new.created_at where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_chat on public.messages;
create trigger messages_bump_chat
  after insert on public.messages
  for each row execute function public.bump_chat_time();

grant execute on function public.get_or_create_chat(uuid) to authenticated;
grant execute on function public.mark_chat_seen(uuid)     to authenticated;
grant execute on function public.my_chats()               to authenticated;

-- ---------- Realtime (live messages + seen ticks) ----------

do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.chats;
  exception when duplicate_object then null;
  end;
  begin
    -- New members show up live in everyone's Members list.
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.group_messages;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------- Profile pictures (Storage) ----------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar upload own folder" on storage.objects;
create policy "avatar upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar update own folder" on storage.objects;
create policy "avatar update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar delete own folder" on storage.objects;
create policy "avatar delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
