-- Add Victoria Mason’s Pong: solo leaderboard and authenticated online rooms.
-- Run once in SQL Editor. Safe to rerun; profiles, scores, saves and RPS rooms are preserved.
begin;
alter table public.arcade_scores drop constraint if exists arcade_scores_game_id_check;
alter table public.arcade_scores add constraint arcade_scores_game_id_check
  check (game_id in ('doom','snake','circle-hop','medieval-rps','memory','memory-run','pong'));

create or replace function public.arcade_submit_score(p_game text, p_score bigint, p_expected_profile uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare player_id uuid := auth.uid(); saved_best bigint;
begin
  if player_id is null or p_expected_profile is distinct from player_id then raise exception 'Sign in before submitting scores.' using errcode = '42501'; end if;
  if p_game is null or p_game not in ('doom','snake','circle-hop','medieval-rps','memory-run','pong')
     or p_score is null or p_score < 0 or p_score > 1000000000
     or (p_game = 'pong' and p_score > 10)
     or (p_game = 'memory-run' and p_score < 1) then
    raise exception 'Invalid game or score.' using errcode = '22023';
  end if;
  insert into public.arcade_scores(profile_id, game_id, best)
    values (player_id, p_game, p_score)
    on conflict (profile_id, game_id) do update
      set best = greatest(public.arcade_scores.best, excluded.best),
          updated_at = case when excluded.best > public.arcade_scores.best then now() else public.arcade_scores.updated_at end
    returning best into saved_best;
  return saved_best;
end;
$$;
revoke all on function public.arcade_submit_score(text,bigint,uuid) from public, anon, authenticated;
grant execute on function public.arcade_submit_score(text,bigint,uuid) to authenticated;

-- At most 50 rows per board. Keep one best per player/game so a score falling
-- outside the top 50 is retained for personal bests and consistent overall ranks.
create or replace function public.arcade_leaderboard(p_game text default 'overall')
returns table(profile_id uuid, username text, score bigint, rank bigint, games bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_game is null or p_game not in ('overall','doom','snake','circle-hop','medieval-rps','pong','memory') then
    raise exception 'Unknown leaderboard.' using errcode = '22023';
  end if;
  if p_game = 'overall' then
    return query
    with per_game as (
      select s.profile_id as player_id, rank() over(partition by s.game_id order by s.best desc) as place
      from public.arcade_scores s where s.game_id <> 'memory'
    ), totals as (
      select g.player_id, sum(greatest(0::bigint,11-g.place))::bigint as points, count(*)::bigint as game_count
      from per_game g group by g.player_id
    ), ranked as (
      select t.player_id, p.username as player_name, t.points, rank() over(order by t.points desc) as place, t.game_count
      from totals t join public.arcade_profiles p on p.id=t.player_id
    )
    select r.player_id,r.player_name,r.points,r.place,r.game_count from ranked r
      order by r.points desc,lower(r.player_name),r.player_id limit 50;
  else
    return query
    with ranked as (
      select s.profile_id as player_id,p.username as player_name,s.best,rank() over(order by s.best desc) as place
      from public.arcade_scores s join public.arcade_profiles p on p.id=s.profile_id where s.game_id = case when p_game = 'memory' then 'memory-run' else p_game end
    )
    select r.player_id,r.player_name,r.best,r.place,1::bigint from ranked r
      order by r.best desc,lower(r.player_name),r.player_id limit 50;
  end if;
end;
$$;
revoke all on function public.arcade_leaderboard(text) from public, anon, authenticated;
grant execute on function public.arcade_leaderboard(text) to anon, authenticated;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.arcade_pong_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.arcade_profiles(id) on delete cascade,
  guest_id uuid references public.arcade_profiles(id) on delete cascade,
  password_hash text,
  closed boolean not null default false,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  check (guest_id is distinct from host_id)
);
create index if not exists arcade_pong_waiting on public.arcade_pong_rooms(expires_at) where not closed and guest_id is null;
create index if not exists arcade_pong_host on public.arcade_pong_rooms(host_id);
create index if not exists arcade_pong_guest on public.arcade_pong_rooms(guest_id);
alter table public.arcade_pong_rooms enable row level security;
revoke all on public.arcade_pong_rooms from public, anon, authenticated;
create or replace function public.arcade_pong_room(
  p_action text, p_expected_profile uuid, p_room uuid default null,
  p_password text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player uuid := auth.uid();
  room public.arcade_pong_rooms%rowtype;
  host_name text; guest_name text; crypto_schema text; new_hash text;
  active_room uuid; room_list jsonb; password_matches boolean;
begin
  if player is null or p_expected_profile is distinct from player then
    raise exception 'Sign in with your game profile first.' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('list','host','join','random','state','leave') then
    raise exception 'Unknown room action.' using errcode = '22023';
  end if;
  if not exists(select 1 from public.arcade_profiles where id = player) then
    raise exception 'Online profile not found.' using errcode = '42501';
  end if;
  if p_action = 'list' then
    select id into active_room from public.arcade_pong_rooms
      where (host_id = player or guest_id = player) and not closed and expires_at > now()
      order by expires_at desc limit 1;
    select coalesce(jsonb_agg(entry order by expires_at desc), '[]'::jsonb) into room_list
    from (
      select jsonb_build_object('id', r.id, 'host', p.username,
        'protected', r.password_hash is not null) as entry, r.expires_at
      from public.arcade_pong_rooms r join public.arcade_profiles p on p.id = r.host_id
      where not r.closed and r.expires_at > now() and r.guest_id is null and r.host_id <> player
      order by r.expires_at desc limit 50
    ) available;
    return jsonb_build_object('rooms', room_list, 'currentRoomId', active_room);
  end if;
  -- Serialize actions by this account across devices. Row locks protect each room.
  perform pg_advisory_xact_lock(hashtextextended(player::text, 0));
  if p_action in ('host','join','random') then
    select id into active_room from public.arcade_pong_rooms
      where (host_id = player or guest_id = player) and not closed and expires_at > now()
      order by expires_at desc limit 1;
    if active_room is not null then
      if p_action = 'join' and active_room is distinct from p_room then
        raise exception 'Leave your current room before joining another.';
      end if;
      -- Retried requests and other devices resume, never create duplicate rooms.
      select * into room from public.arcade_pong_rooms where id = active_room for update;
    elsif p_action = 'host' then
      delete from public.arcade_pong_rooms where expires_at < now() - interval '1 day';
      if coalesce(p_password, '') <> '' then
        if length(p_password) < 4 or length(p_password) > 64 or octet_length(p_password) > 72 then
          raise exception 'Use a room password of 4 to 64 characters (at most 72 bytes), or leave it blank.';
        end if;
        -- Locate the installed extension, including projects using another schema.
        select n.nspname into crypto_schema from pg_catalog.pg_extension e
          join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
        execute format('select %I.crypt($1, %I.gen_salt(''bf'', 10))', crypto_schema, crypto_schema)
          into new_hash using p_password;
      end if;
      insert into public.arcade_pong_rooms(host_id, password_hash)
        values (player, new_hash) returning * into room;
    else
      if p_action = 'random' then
        select * into room from public.arcade_pong_rooms
          where not closed and expires_at > now() and guest_id is null
            and host_id <> player and password_hash is null
          order by random() limit 1 for update skip locked;
        if not found then raise exception 'No public rooms are available. Host a room and wait for someone to join.'; end if;
      else
        select * into room from public.arcade_pong_rooms where id = p_room for update;
        if not found or room.closed or room.expires_at <= now() then raise exception 'That room is no longer available. Refresh the list.'; end if;
        if room.host_id = player then raise exception 'The other player must use a different profile.'; end if;
        if room.guest_id is not null then raise exception 'That room already has two players. Choose another room.'; end if;
        if room.password_hash is not null then
          if p_password is null or length(p_password) < 4 or length(p_password) > 64 or octet_length(p_password) > 72 then
            raise exception 'Incorrect room password.';
          end if;
          select n.nspname into crypto_schema from pg_catalog.pg_extension e
            join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
          execute format('select %I.crypt($1, $2) = $2', crypto_schema)
            into password_matches using p_password, room.password_hash;
          if password_matches is distinct from true then raise exception 'Incorrect room password.'; end if;
        end if;
      end if;
      update public.arcade_pong_rooms set guest_id = player, expires_at = now() + interval '2 hours'
        where id = room.id returning * into room;
    end if;
  else
    select * into room from public.arcade_pong_rooms where id = p_room for update;
    if not found or (player <> room.host_id and player is distinct from room.guest_id) then
      raise exception 'Room not available to this profile.' using errcode = '42501';
    end if;
    if p_action <> 'state' and (room.closed or room.expires_at <= now()) then raise exception 'This room is closed or expired.'; end if;
    if p_action = 'leave' then
      update public.arcade_pong_rooms set closed = true where id = room.id returning * into room;
    end if;
  end if;
  select username into host_name from public.arcade_profiles where id = room.host_id;
  select username into guest_name from public.arcade_profiles where id = room.guest_id;
  return jsonb_build_object('id',room.id,'host',host_name,'guest',guest_name,
    'role',case when player = room.host_id then 'host' else 'guest' end,
    'protected',room.password_hash is not null,'closed',room.closed or room.expires_at <= now(),
    'expiresAt',room.expires_at);
end;
$$;
revoke all on function public.arcade_pong_room(text,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.arcade_pong_room(text,uuid,uuid,text) to authenticated;

-- Separate send topics prevent a guest from broadcasting authoritative host state.
-- Topic example: arcade:pong:<room UUID>:host
create or replace function public.arcade_pong_channel(p_topic text, p_write boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.arcade_pong_rooms r
    where not r.closed and r.expires_at > now()
      and (r.host_id = auth.uid() or r.guest_id = auth.uid())
      and p_topic in ('arcade:pong:' || r.id::text || ':host', 'arcade:pong:' || r.id::text || ':guest')
      and (not p_write or p_topic = 'arcade:pong:' || r.id::text ||
        case when r.host_id = auth.uid() then ':host' else ':guest' end)
  );
$$;
revoke all on function public.arcade_pong_channel(text,boolean) from public, anon, authenticated;
grant execute on function public.arcade_pong_channel(text,boolean) to authenticated;
-- Supabase already owns and enables RLS on realtime.messages. Only add policies.
drop policy if exists arcade_pong_receive on realtime.messages;
create policy arcade_pong_receive on realtime.messages for select to authenticated
  using (extension = 'broadcast' and public.arcade_pong_channel((select realtime.topic()), false));
drop policy if exists arcade_pong_send on realtime.messages;
create policy arcade_pong_send on realtime.messages for insert to authenticated
  with check (extension = 'broadcast' and public.arcade_pong_channel((select realtime.topic()), true));
notify pgrst, 'reload schema';
commit;
