-- Pong goal streaks and ranked multiplayer for Pong and RPS. Run after 04-pong.sql.
-- Run once in SQL Editor. Safe to rerun; profiles, scores, saves and RPS rooms are preserved.
begin;
alter table public.arcade_scores drop constraint if exists arcade_scores_game_id_check;
alter table public.arcade_scores add constraint arcade_scores_game_id_check
  check (game_id in ('doom','snake','circle-hop','medieval-rps','memory','memory-run','pong','pong-streak'));

create or replace function public.arcade_submit_score(p_game text, p_score bigint, p_expected_profile uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare player_id uuid := auth.uid(); saved_best bigint;
begin
  if player_id is null or p_expected_profile is distinct from player_id then raise exception 'Sign in before submitting scores.' using errcode = '42501'; end if;
  if p_game is null or p_game not in ('doom','snake','circle-hop','medieval-rps','memory-run','pong-streak')
     or p_score is null or p_score < 0 or p_score > 1000000000
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
      from public.arcade_scores s where s.game_id not in ('memory','pong')
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
      from public.arcade_scores s join public.arcade_profiles p on p.id=s.profile_id where s.game_id = case when p_game = 'memory' then 'memory-run' when p_game = 'pong' then 'pong-streak' else p_game end
    )
    select r.player_id,r.player_name,r.best,r.place,1::bigint from ranked r
      order by r.best desc,lower(r.player_name),r.player_id limit 50;
  end if;
end;
$$;
revoke all on function public.arcade_leaderboard(text) from public, anon, authenticated;
grant execute on function public.arcade_leaderboard(text) to anon, authenticated;

-- Keep multiplayer streaks across matches and rooms. Solo checkpoints have their
-- own active streak; the public board takes the best from either mode.
create table if not exists public.arcade_online_streaks (
 profile_id uuid not null references public.arcade_profiles(id) on delete cascade,
 game_id text not null check(game_id in ('medieval-rps','pong-streak')),
 current_streak bigint not null default 0 check(current_streak between 0 and 1000000000),
 best bigint not null default 0 check(best between 0 and 1000000000),
 primary key(profile_id,game_id)
);
alter table public.arcade_online_streaks enable row level security;
revoke all on public.arcade_online_streaks from public,anon,authenticated;
create or replace function public.arcade_record_online_streak(p_player uuid,p_game text,p_win boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare next_best bigint;
begin
 insert into public.arcade_online_streaks(profile_id,game_id,current_streak,best)
 values(p_player,p_game,case when p_win then 1 else 0 end,case when p_win then 1 else 0 end)
 on conflict(profile_id,game_id) do update set
 current_streak = case when p_win then least(1000000000,public.arcade_online_streaks.current_streak+1) else 0 end,
 best = greatest(public.arcade_online_streaks.best,case when p_win then least(1000000000,public.arcade_online_streaks.current_streak+1) else 0 end)
 returning best into next_best;
 insert into public.arcade_scores(profile_id,game_id,best) values(p_player,p_game,next_best)
 on conflict(profile_id,game_id) do update set best=greatest(public.arcade_scores.best,excluded.best),
 updated_at=case when excluded.best>public.arcade_scores.best then now() else public.arcade_scores.updated_at end;
end;
$$;
revoke all on function public.arcade_record_online_streak(uuid,text,boolean) from public,anon,authenticated;

alter table public.arcade_pong_rooms add column if not exists match_no integer not null default 0;
alter table public.arcade_pong_rooms add column if not exists host_points integer not null default 0;
alter table public.arcade_pong_rooms add column if not exists guest_points integer not null default 0;
create table if not exists public.arcade_pong_goals (
 room_id uuid not null references public.arcade_pong_rooms(id) on delete cascade,
 match_no integer not null,goal_no integer not null,winner text not null check(winner in ('host','guest')),
 primary key(room_id,match_no,goal_no)
);
alter table public.arcade_pong_goals enable row level security;
revoke all on public.arcade_pong_goals from public,anon,authenticated;

create or replace function public.arcade_pong_match(p_action text,p_expected_profile uuid,p_room uuid,
 p_match integer default null,p_goal integer default null,p_winner text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 player uuid:=auth.uid();r public.arcade_pong_rooms%rowtype;old_winner text;
 hs bigint:=0;gs bigint:=0;hb bigint:=0;gb bigint:=0;
begin
 if player is null or p_expected_profile is distinct from player then raise exception 'Sign in to this profile first.' using errcode='42501';end if;
 if p_action is null or p_action not in ('state','start','goal') then raise exception 'Unknown match action.' using errcode='22023';end if;
 select * into r from public.arcade_pong_rooms where id=p_room for update;
 if not found or (player<>r.host_id and player is distinct from r.guest_id) then raise exception 'Room is not available to this profile.' using errcode='42501';end if;
 if r.closed or r.expires_at<=now() then raise exception 'This room is closed or expired.';end if;
 if p_action<>'state' then
  if player<>r.host_id then raise exception 'Only the host can report match events.' using errcode='42501';end if;
  if r.guest_id is null then raise exception 'Wait for the other player.';end if;
 end if;
 if p_action='start' then
  if p_match is null or p_match<1 or p_match>1000000 then raise exception 'Invalid match number.';end if;
  if p_match=r.match_no then null; -- Retry of an already accepted start.
  elsif p_match=r.match_no+1 and (r.match_no=0 or r.host_points=10 or r.guest_points=10) then
   update public.arcade_pong_rooms set match_no=p_match,host_points=0,guest_points=0 where id=r.id returning * into r;
  else raise exception 'Finish this match before starting the next one.';end if;
 elsif p_action='goal' then
  if p_match is distinct from r.match_no or p_match<1 or p_goal is null or p_goal<1 or p_goal>19 or p_winner is null or p_winner not in ('host','guest') then raise exception 'Invalid goal event.' using errcode='22023';end if;
  select winner into old_winner from public.arcade_pong_goals where room_id=r.id and match_no=p_match and goal_no=p_goal;
  if found then
   if old_winner<>p_winner then raise exception 'This goal was already recorded for the other player.';end if;
  else
   if r.host_points=10 or r.guest_points=10 or p_goal<>r.host_points+r.guest_points+1 then raise exception 'Goals must be recorded once and in order.';end if;
   insert into public.arcade_pong_goals values(r.id,p_match,p_goal,p_winner);
   update public.arcade_pong_rooms set host_points=host_points+case when p_winner='host' then 1 else 0 end,
    guest_points=guest_points+case when p_winner='guest' then 1 else 0 end where id=r.id returning * into r;
   perform public.arcade_record_online_streak(r.host_id,'pong-streak',p_winner='host');
   perform public.arcade_record_online_streak(r.guest_id,'pong-streak',p_winner='guest');
  end if;
 end if;
 select current_streak,best into hs,hb from public.arcade_online_streaks where profile_id=r.host_id and game_id='pong-streak';
 select current_streak,best into gs,gb from public.arcade_online_streaks where profile_id=r.guest_id and game_id='pong-streak';
 return jsonb_build_object('match',r.match_no,'hostPoints',r.host_points,'guestPoints',r.guest_points,
  'hostStreak',coalesce(hs,0),'guestStreak',coalesce(gs,0),'hostBest',coalesce(hb,0),'guestBest',coalesce(gb,0));
end;
$$;
revoke all on function public.arcade_pong_match(text,uuid,uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function public.arcade_pong_match(text,uuid,uuid,integer,integer,text) to authenticated;

create or replace function public.arcade_rps_room(
  p_action text, p_expected_profile uuid, p_room uuid default null,
  p_password text default null, p_choice text default null, p_round integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player uuid := auth.uid();
  room public.arcade_rps_rooms%rowtype;
  host_name text; guest_name text; crypto_schema text; new_hash text;
  hs bigint; gs bigint; hb bigint; gb bigint;
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
        -- This block runs once, only when both picks first resolve the round.
        perform public.arcade_record_online_streak(room.host_id,'medieval-rps',room.outcome='host');
        perform public.arcade_record_online_streak(room.guest_id,'medieval-rps',room.outcome='guest');
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
  select current_streak,best into hs,hb from public.arcade_online_streaks where profile_id=room.host_id and game_id='medieval-rps';
  select current_streak,best into gs,gb from public.arcade_online_streaks where profile_id=room.guest_id and game_id='medieval-rps';
  return jsonb_build_object(
    'hostStreak',coalesce(hs,0),'guestStreak',coalesce(gs,0),'hostBest',coalesce(hb,0),'guestBest',coalesce(gb,0),
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
