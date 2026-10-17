-- Study Booth schema. Paste into Supabase: SQL Editor -> New query -> Run.
-- Safe to re-run: it drops and recreates policies and functions.
--
-- Security model:
--   * Every table has Row Level Security. Users only see rows for groups they belong to.
--   * Groups are created/joined only through create_group / join_group (security definer).
--   * Clients insert their own posts as 'pending'. Only the server (service role key,
--     used by /api/moderate) can approve or hold a post, so moderation fails closed:
--     if moderation never runs, friends never see the post.
--   * Photos live in the private 'posts' bucket under {group_id}/{user_id}/{post_id}.jpg.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  created_by uuid references auth.users (id) on delete set null,
  last_checkin_at timestamptz,
  last_checkin_eval_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('fog', 'photo', 'note')),
  image_path text not null,
  caption text check (char_length(caption) <= 140),
  note_text text check (char_length(note_text) <= 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'held')),
  moderation_reason text,
  created_at timestamptz not null default now()
);
create index if not exists posts_group_created_idx on public.posts (group_id, created_at desc);

create table if not exists public.post_reveals (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  revealed_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_seen_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index if not exists study_sessions_group_idx on public.study_sessions (group_id, started_at desc);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  message text not null check (char_length(message) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists checkins_group_idx on public.checkins (group_id, created_at desc);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create table if not exists public.weekly_stories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  story text not null,
  stats jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers

-- True if the signed-in user belongs to the group. Security definer so policies
-- on group_members can use it without recursing into themselves.
create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;

-- Same, for a storage folder name (text). Never errors on a malformed name.
create or replace function public.is_group_member_text(gid text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when gid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.is_group_member(gid::uuid)
    else false
  end;
$$;

-- Create a profile for every new auth user (name defaults to the email's first part).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'friend'), 30))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who signed up before this migration.
insert into public.profiles (id, display_name)
select id, left(coalesce(nullif(split_part(email, '@', 1), ''), 'friend'), 30) from auth.users
on conflict (id) do nothing;

-- Create a group with a fresh 6-character invite code and join it.
create or replace function public.create_group(p_name text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  code text;
  g public.groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  insert into public.groups (name, invite_code, created_by)
  values (trim(p_name), code, auth.uid()) returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end;
$$;

-- Join a group by invite code (case-insensitive). Returns the group, or errors.
create or replace function public.join_group(p_code text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.groups where invite_code = upper(trim(p_code));
  if not found then raise exception 'No group with that invite code'; end if;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid())
  on conflict do nothing;
  return g;
end;
$$;

-- Weekly stats, computed in SQL so the AI only ever sees real numbers.
-- tz is the group's IANA time zone (e.g. 'Asia/Singapore') for "late night" and streaks.
create or replace function public.group_week_stats(gid uuid, tz text default 'UTC')
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select user_id, started_at at time zone tz as started_local,
           extract(epoch from (coalesce(ended_at, least(last_seen_at, started_at + interval '6 hours')) - started_at)) / 3600.0 as hours
    from public.study_sessions
    where group_id = gid and started_at >= now() - interval '7 days'
  ),
  days as (select distinct started_local::date as d from s where hours > 0.05),
  runs as (select d, d - (row_number() over (order by d))::int as grp from days),
  p as (
    select kind from public.posts
    where group_id = gid and status = 'approved' and created_at >= now() - interval '7 days'
  )
  select jsonb_build_object(
    'members', (select count(*) from public.group_members where group_id = gid),
    'active_members', (select count(distinct user_id) from s where hours > 0.05),
    'total_hours', (select round(coalesce(sum(hours), 0)::numeric, 1) from s),
    'study_sessions', (select count(*) from s where hours > 0.05),
    'longest_session_minutes', (select round(coalesce(max(hours), 0)::numeric * 60) from s),
    'late_night_sessions', (select count(*) from s where extract(hour from started_local) < 4),
    'days_studied', (select count(*) from days),
    'longest_streak_days', (select coalesce(max(c), 0) from (select count(*) as c from runs group by grp) x),
    'posts', (select count(*) from p),
    'fog_posts', (select count(*) from p where kind = 'fog'),
    'photo_posts', (select count(*) from p where kind = 'photo'),
    'notes', (select count(*) from p where kind = 'note')
  );
$$;

-- Claims the right to evaluate a check-in for this group. At most one evaluation
-- every 4 minutes and one posted check-in every 45 minutes (force skips both, for the demo button).
create or replace function public.claim_checkin_slot(gid uuid, force boolean default false)
returns boolean language sql volatile security definer set search_path = public as $$
  with claimed as (
    update public.groups set last_checkin_eval_at = now()
    where id = gid and (
      force or (
        (last_checkin_eval_at is null or last_checkin_eval_at < now() - interval '4 minutes')
        and (last_checkin_at is null or last_checkin_at < now() - interval '45 minutes')
      )
    )
    returning 1
  )
  select exists (select 1 from claimed);
$$;

-- Server-only functions: called by API routes with the service role key.
revoke execute on function public.group_week_stats(uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_checkin_slot(uuid, boolean) from public, anon, authenticated;
grant execute on function public.group_week_stats(uuid, text) to service_role;
grant execute on function public.claim_checkin_slot(uuid, boolean) to service_role;
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;

-- ---------------------------------------------------------------- row level security

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.posts enable row level security;
alter table public.post_reveals enable row level security;
alter table public.study_sessions enable row level security;
alter table public.checkins enable row level security;
alter table public.reports enable row level security;
alter table public.weekly_stories enable row level security;

drop policy if exists "profiles: read self and groupmates" on public.profiles;
create policy "profiles: read self and groupmates" on public.profiles for select to authenticated
  using (
    id = auth.uid() or exists (
      select 1 from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
drop policy if exists "profiles: update self" on public.profiles;
create policy "profiles: update self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "groups: members read" on public.groups;
create policy "groups: members read" on public.groups for select to authenticated
  using (public.is_group_member(id));

drop policy if exists "group_members: members read" on public.group_members;
create policy "group_members: members read" on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists "group_members: leave" on public.group_members;
create policy "group_members: leave" on public.group_members for delete to authenticated
  using (user_id = auth.uid());

-- Friends see approved posts; authors also see their own pending/held posts.
drop policy if exists "posts: members read approved, authors read own" on public.posts;
create policy "posts: members read approved, authors read own" on public.posts for select to authenticated
  using (public.is_group_member(group_id) and (status = 'approved' or user_id = auth.uid()));
drop policy if exists "posts: insert own as pending" on public.posts;
create policy "posts: insert own as pending" on public.posts for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'pending' and moderation_reason is null
    and public.is_group_member(group_id)
    and image_path like group_id::text || '/' || auth.uid()::text || '/%'
  );
drop policy if exists "posts: delete own" on public.posts;
create policy "posts: delete own" on public.posts for delete to authenticated
  using (user_id = auth.uid());
-- No update policy: only the server (service role) changes status.

drop policy if exists "post_reveals: members read" on public.post_reveals;
create policy "post_reveals: members read" on public.post_reveals for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and public.is_group_member(p.group_id)));
drop policy if exists "post_reveals: insert own" on public.post_reveals;
create policy "post_reveals: insert own" on public.post_reveals for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id and public.is_group_member(p.group_id))
  );

drop policy if exists "study_sessions: members read" on public.study_sessions;
create policy "study_sessions: members read" on public.study_sessions for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists "study_sessions: insert own" on public.study_sessions;
create policy "study_sessions: insert own" on public.study_sessions for insert to authenticated
  with check (user_id = auth.uid() and public.is_group_member(group_id));
drop policy if exists "study_sessions: update own" on public.study_sessions;
create policy "study_sessions: update own" on public.study_sessions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_group_member(group_id));

drop policy if exists "checkins: members read" on public.checkins;
create policy "checkins: members read" on public.checkins for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "reports: read own" on public.reports;
create policy "reports: read own" on public.reports for select to authenticated
  using (reporter_id = auth.uid());
drop policy if exists "reports: insert own" on public.reports;
create policy "reports: insert own" on public.reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id and public.is_group_member(p.group_id))
  );

drop policy if exists "weekly_stories: members read" on public.weekly_stories;
create policy "weekly_stories: members read" on public.weekly_stories for select to authenticated
  using (public.is_group_member(group_id));

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public)
values ('posts', 'posts', false)
on conflict (id) do update set public = false;

drop policy if exists "posts bucket: members read" on storage.objects;
create policy "posts bucket: members read" on storage.objects for select to authenticated
  using (bucket_id = 'posts' and public.is_group_member_text((storage.foldername(name))[1]));
drop policy if exists "posts bucket: upload to own folder" on storage.objects;
create policy "posts bucket: upload to own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'posts'
    and public.is_group_member_text((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = auth.uid()::text
  );
drop policy if exists "posts bucket: delete own" on storage.objects;
create policy "posts bucket: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[2] = auth.uid()::text);

-- ---------------------------------------------------------------- realtime

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.posts; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.checkins; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.post_reveals; exception when duplicate_object then null; end;
  end if;
end $$;
