-- RPS room browser, optional passwords and random public matching.
-- Safe for first installation or upgrading the earlier room-code version.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
-- The old signature used p_code. Drop it before renaming that argument.
drop function if exists public.arcade_rps_room(text,uuid,uuid,text,text,integer);
create table if not exists public.arcade_rps_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.arcade_profiles(id) on delete cascade,
  guest_id uuid references public.arcade_profiles(id) on delete cascade,
  round_no integer not null default 1 check (round_no between 1 and 10000),
  host_pick text check (host_pick in ('Sword','Archer','Shield','Catapult','Dragon')),
  guest_pick text check (guest_pick in ('Sword','Archer','Shield','Catapult','Dragon')),
  outcome text check (outcome in ('host','guest','tie')),
  host_wins integer not null default 0,
  guest_wins integer not null default 0,
  ties integer not null default 0,
  closed boolean not null default false,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  check (guest_id is distinct from host_id)
);
alter table public.arcade_rps_rooms add column if not exists password_hash text;
-- Existing rooms keep their members and scores and become public rooms.
alter table public.arcade_rps_rooms drop column if exists code;
create index if not exists arcade_rps_waiting on public.arcade_rps_rooms(expires_at)
  where not closed and guest_id is null;
create index if not exists arcade_rps_host on public.arcade_rps_rooms(host_id);
create index if not exists arcade_rps_guest on public.arcade_rps_rooms(guest_id);
alter table public.arcade_rps_rooms enable row level security;
-- Never expose raw picks through SELECT, REST or a Realtime publication.
revoke all on public.arcade_rps_rooms from public, anon, authenticated;

create or replace function public.arcade_rps_room(
  p_action text, p_expected_profile uuid, p_room uuid default null,
  p_password text default null, p_choice text default null, p_round integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player uuid := auth.uid();
  room public.arcade_rps_rooms%rowtype;
  host_name text; guest_name text; crypto_schema text; new_hash text;
  active_room uuid; room_list jsonb; password_matches boolean;
begin
  if player is null or p_expected_profile is distinct from player then
    raise exception 'Sign in with your game profile first.' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('list','host','join','random','state','pick','next','leave') then
    raise exception 'Unknown room action.' using errcode = '22023';
  end if;
  if not exists(select 1 from public.arcade_profiles where id = player) then
    raise exception 'Online profile not found.' using errcode = '42501';
  end if;
  if p_action = 'list' then
    select id into active_room from public.arcade_rps_rooms
      where (host_id = player or guest_id = player) and not closed and expires_at > now()
      order by expires_at desc limit 1;
    select coalesce(jsonb_agg(entry order by expires_at desc), '[]'::jsonb) into room_list
    from (
      select jsonb_build_object('id', r.id, 'host', p.username,
        'protected', r.password_hash is not null) as entry, r.expires_at
      from public.arcade_rps_rooms r join public.arcade_profiles p on p.id = r.host_id
      where not r.closed and r.expires_at > now() and r.guest_id is null and r.host_id <> player
      order by r.expires_at desc limit 50
    ) available;
    return jsonb_build_object('rooms', room_list, 'currentRoomId', active_room);
  end if;
  -- Serialize actions by this account across devices. Row locks protect each room.
  perform pg_advisory_xact_lock(hashtextextended(player::text, 0));
  if p_action in ('host','join','random') then
    select id into active_room from public.arcade_rps_rooms
      where (host_id = player or guest_id = player) and not closed and expires_at > now()
      order by expires_at desc limit 1;
    if active_room is not null then
      if p_action = 'join' and active_room is distinct from p_room then
        raise exception 'Leave your current room before joining another.';
      end if;
      -- Retried requests and other devices resume, never create duplicate rooms.
      select * into room from public.arcade_rps_rooms where id = active_room for update;
    elsif p_action = 'host' then
      delete from public.arcade_rps_rooms where expires_at < now() - interval '1 day';
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
      insert into public.arcade_rps_rooms(host_id, password_hash)
        values (player, new_hash) returning * into room;
    else
      if p_action = 'random' then
        select * into room from public.arcade_rps_rooms
          where not closed and expires_at > now() and guest_id is null
            and host_id <> player and password_hash is null
          order by random() limit 1 for update skip locked;
        if not found then raise exception 'No public rooms are available. Host a room and wait for someone to join.'; end if;
      else
        select * into room from public.arcade_rps_rooms where id = p_room for update;
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
      update public.arcade_rps_rooms set guest_id = player, expires_at = now() + interval '2 hours'
        where id = room.id returning * into room;
    end if;
  else
    select * into room from public.arcade_rps_rooms where id = p_room for update;
    if not found or (player <> room.host_id and player is distinct from room.guest_id) then
      raise exception 'Room not available to this profile.' using errcode = '42501';
    end if;
    if p_action <> 'state' and (room.closed or room.expires_at <= now()) then raise exception 'This room is closed or expired.'; end if;
    if p_action in ('pick','next') and p_round is distinct from room.round_no then
      raise exception 'The round changed. Refresh the room before choosing again.';
    end if;
    if p_action = 'pick' then
      if room.guest_id is null then raise exception 'Wait for another profile to join.'; end if;
      if p_choice is null or p_choice not in ('Sword','Archer','Shield','Catapult','Dragon') then raise exception 'Unknown choice.'; end if;
      -- A retry of the same locked pick is safe; changing it is not allowed.
      if player = room.host_id then
        if room.host_pick is not null and room.host_pick <> p_choice then raise exception 'Your choice is already locked.'; end if;
        room.host_pick := p_choice;
      else
        if room.guest_pick is not null and room.guest_pick <> p_choice then raise exception 'Your choice is already locked.'; end if;
        room.guest_pick := p_choice;
      end if;
      if room.outcome is null and room.host_pick is not null and room.guest_pick is not null then
        if room.host_pick = room.guest_pick then room.outcome := 'tie'; room.ties := room.ties + 1;
        elsif (room.host_pick = 'Sword' and room.guest_pick in ('Archer','Catapult'))
           or (room.host_pick = 'Archer' and room.guest_pick in ('Catapult','Dragon'))
           or (room.host_pick = 'Shield' and room.guest_pick in ('Sword','Archer'))
           or (room.host_pick = 'Catapult' and room.guest_pick in ('Shield','Dragon'))
           or (room.host_pick = 'Dragon' and room.guest_pick in ('Sword','Shield')) then
          room.outcome := 'host'; room.host_wins := room.host_wins + 1;
        else room.outcome := 'guest'; room.guest_wins := room.guest_wins + 1;
        end if;
      end if;
      update public.arcade_rps_rooms set host_pick = room.host_pick, guest_pick = room.guest_pick,
        outcome = room.outcome, host_wins = room.host_wins, guest_wins = room.guest_wins, ties = room.ties,
        expires_at = now() + interval '2 hours' where id = room.id returning * into room;
    elsif p_action = 'next' then
      if player <> room.host_id then raise exception 'Only the host can start the next round.' using errcode = '42501'; end if;
      if room.outcome is null then raise exception 'Both players must finish this round first.'; end if;
      if room.round_no >= 10000 then raise exception 'Room limit reached. Close it and host a new room.'; end if;
      update public.arcade_rps_rooms set round_no = round_no + 1, host_pick = null, guest_pick = null,
        outcome = null, expires_at = now() + interval '2 hours' where id = room.id returning * into room;
    elsif p_action = 'leave' then
      update public.arcade_rps_rooms set closed = true where id = room.id returning * into room;
    end if;
  end if;
  select username into host_name from public.arcade_profiles where id = room.host_id;
  select username into guest_name from public.arcade_profiles where id = room.guest_id;
  return jsonb_build_object(
    'id', room.id, 'protected', room.password_hash is not null, 'role', case when player = room.host_id then 'host' else 'guest' end,
    'host', host_name, 'guest', guest_name, 'round', room.round_no,
    'hostReady', room.host_pick is not null, 'guestReady', room.guest_pick is not null,
    'yourPick', case when player = room.host_id then room.host_pick else room.guest_pick end,
    'hostPick', case when room.outcome is not null then room.host_pick else null end,
    'guestPick', case when room.outcome is not null then room.guest_pick else null end,
    'outcome', room.outcome, 'hostWins', room.host_wins, 'guestWins', room.guest_wins, 'ties', room.ties,
    'closed', room.closed or room.expires_at <= now(), 'expiresAt', room.expires_at
  );
end;
$$;
revoke all on function public.arcade_rps_room(text,uuid,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.arcade_rps_room(text,uuid,uuid,text,text,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
