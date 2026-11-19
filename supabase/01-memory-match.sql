-- Memory survival: 2, 4, 6 ... 16 cards, then continue on full boards.
-- Safe to rerun. Existing fixed-board scores are archived, not deleted.
begin;
alter table public.arcade_scores drop constraint if exists arcade_scores_game_id_check;
alter table public.arcade_scores add constraint arcade_scores_game_id_check
  check (game_id in ('doom','snake','circle-hop','medieval-rps','memory','memory-run'));

create or replace function public.arcade_submit_score(p_game text, p_score bigint, p_expected_profile uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare player_id uuid := auth.uid(); saved_best bigint;
begin
  if player_id is null or p_expected_profile is distinct from player_id then raise exception 'Sign in before submitting scores.' using errcode = '42501'; end if;
  if p_game is null or p_game not in ('doom','snake','circle-hop','medieval-rps','memory-run')
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
notify pgrst, 'reload schema';
commit;
