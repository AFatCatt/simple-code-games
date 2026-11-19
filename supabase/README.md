# Supabase setup for Simple Code Games

Profiles and best scores are shared across devices. Each online account has one local checkpoint per game on each browser/site address. Doom checkpoints are not uploaded to Supabase.

For this update, run `05-ranked-multiplayer.sql` after `04-pong.sql`. Keep the existing values in `js/online-config.js`. The latest setup instructions and scoring rules are below.

## Set up a new Supabase project

1. Create a dedicated project at https://supabase.com/dashboard.
2. Open SQL Editor and paste the contents of this folder's `setup.sql` into a new query.
3. Run that query first, then run `02-rps-multiplayer.sql`, `04-pong.sql`, and `05-ranked-multiplayer.sql` in that order. They create profiles, scores, rooms and access rules.
4. Open Authentication > Sign In / Providers. Under User Signups, leave Allow new users to sign up ON and turn Confirm email OFF. Save.
5. Open the Email provider settings, leave the provider enabled, and set the minimum password length to 8. Save.
6. Copy the Project URL and publishable key from the project's Connect panel or Settings > API Keys into `js/online-config.js`:

```javascript
window.ARCADE_ONLINE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  publishableKey: "sb_publishable_YOUR_KEY"
};
```

Use the browser publishable key beginning `sb_publishable_`. Do not put a secret key, service-role key, database password or account token in website files.

The SQL is intended for a dedicated game project. For an existing project, apply the latest migration instead of rerunning old setup scripts. Do not apply it to a project with unrelated applications or accounts.

## How username sign-in works

The website converts each username to an internal identifier ending in `@simple-code-games.invalid`. It is not a real email address, so Confirm email must be OFF before creating profiles. Secure email change is a different setting.

Supabase Auth handles passwords and sessions. Players register directly on the game website; they do not need a GitHub or Supabase account. Usernames contain 3 to 20 letters, digits or underscores and are unique regardless of capitalization. Passwords contain 8 to 128 characters. Username changes and password recovery are not implemented.

## Test and publish

1. Save all edited files. Open `index.html` with VS Code Live Server and press Ctrl+Shift+R.
2. Create an online profile. Sign out and sign back in.
3. Try registering the same username with different capitalization. It should be rejected.
4. Play RPS, Snake or Circle Hop and wait for "Best scores synced online."
5. Open Leaderboards and click Refresh scores.
6. Commit and push the website changes with GitHub Desktop, including `js/online-config.js`, the bundled Supabase client and this folder.
7. After GitHub Pages deploys, open the public site on two devices. Both should display the same leaderboard. Signing in to the same account should work on either device.

Use the same Supabase URL and publishable key locally and on GitHub Pages to share accounts and scores. Local checkpoints belong to the browser and site address; Live Server and GitHub Pages have separate checkpoints. Clearing browser storage removes those checkpoints.

## Behavior and troubleshooting

- One best score is stored per account/game. Each leaderboard displays at most 50 rows.
- Overall awards 10 points for first place down to 1 for tenth in each game. Ties share ranks and points.
- Rankings refresh every 30 seconds while visible, or immediately with Refresh scores.
- Starting a new game replaces the local checkpoint and keeps the best score.
- Failed score uploads stay queued locally. They retry while signed in and when the connection returns.
- "Online profiles are not configured" means the configuration file needs its URL and publishable key.
- Registration failures can mean Confirm email is still enabled, database setup is missing, or the username is taken.
- A failed leaderboard request displays an error instead of substituting local scores.
- Accounts cannot overwrite another account's score. Scores are reported by the browser, so the leaderboard is not cheat-proof.
- If the Supabase dashboard reports a paused project, resume it before testing.

## Files to keep

- `setup.sql`: documents and recreates the database schema and permissions.
- `js/online-config.js`: supplies the browser connection settings.
- `js/online.js`, `js/profiles.js`, `js/storage.js`, `js/leaderboards.js`: connect profiles, checkpoints and scores.
- `assets/vendor/supabase/`: contains the browser client and its license.

## Documentation

- https://supabase.com/docs/guides/auth/general-configuration
- https://supabase.com/docs/guides/auth/managing-user-data
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/getting-started/api-keys

## Memory Match survival update

Current projects get Memory score support from `05-ranked-multiplayer.sql`. `01-memory-match.sql` is retained as historical setup; do not run it after 05.

Memory Match shows the cards for up to 60 seconds, with Start matching available for an optional early start. Matching has no time limit. The board grows by two cards per stage from 2 cards to 10 by 10, with 100 cards and 50 distinct pairs. One wrong pair ends the run. Clearing all 100 offers Continue: another full board shuffles and the same score continues. Each matched pair adds one point. The stage, picks and preview deadline save locally; the best run syncs online. The timer and larger board use the existing memory-run category and need no additional SQL migration after the leaderboard repair.

The new rules use the `memory-run` score/save key. The public Memory Match leaderboard maps to that key. Earlier fixed-board records under `memory` are retained but excluded from current rankings and Overall. This prevents the old 1000-point scale from mixing with matched-pair totals. Other games are unchanged.

## RPS room-list update

For a fresh installation, run `02-rps-multiplayer.sql` before 04/05. Existing room-list installations need only 05 for ranked multiplayer. Do not rerun 02 after 05: it would replace the ranked room function. No API key or Realtime configuration changes are required for RPS.

Choose Singleplayer or Multiplayer. Multiplayer lists available rooms by host username. Host with an optional password, Join a listed room, or Join random to find a public room without a password. Each profile may occupy one active room. Old rooms retain members and scores and become public; host a new room to add a password.

Passwords use pgcrypto bcrypt with a random salt and cost 10. The SQL detects the extension's installed schema. Passwords must be 4 to 64 characters and at most 72 UTF-8 bytes. Password hashes and unopposed picks are never included in room lists or snapshots. Direct room-table access is denied. Authenticated functions validate membership, lock rows, accept each pick once and compute the result. Random matching skips locked/full/expired/password-protected rooms.

Room lists refresh every five seconds and active rooms every two seconds while visible. Active rooms can be resumed across devices using the same profile. Closing or leaving ends the room for both players; switching modes or closing the tab does not. Rooms expire two hours after the last game action. Expired records older than one day are cleaned when hosting. Both modes now contribute their best winning streaks to the shared RPS board, using separate active streaks.

New projects must finish with `04-pong.sql` and then `05-ranked-multiplayer.sql`.

## Memory leaderboard repair

The earlier `03-memory-leaderboard-repair.sql` fixed Memory uploads. The current `05-ranked-multiplayer.sql` includes that repair; use 05 instead. This brings score validation and Memory leaderboard mapping up to date without deleting data. Copying SQL files to GitHub does not execute them in the database.

After applying the website patch, close old site tabs, reload and use Leaderboards > Memory Match > Refresh scores in the browser where you played. The saved best can then upload without a new high score. Setup-related upload rejections are paused until an explicit retry or page reload, and errors for one game no longer prevent other games from syncing.

## Pong and RPS: ranked multiplayer and consecutive-goal streaks

Existing projects that already ran `04-pong.sql`: run **`05-ranked-multiplayer.sql`** once in SQL Editor. A successful run says “Success. No rows returned.” This file is safe to rerun and preserves profiles, existing scores, room data and singleplayer checkpoints.

If Pong is not installed in Supabase yet, run `04-pong.sql` first and `05-ranked-multiplayer.sql` second. For a fresh database: `setup.sql`, `02-rps-multiplayer.sql`, `04-pong.sql`, `05-ranked-multiplayer.sql`, in that order. `03-memory-leaderboard-repair.sql` is superseded by 04/05. Keep the files for history; do not rerun older score migrations after 05 because they restore old score rules.

Pong still uses private Realtime channels. Keep the previously configured **Allow public access** setting off. RPS uses database functions and polling and does not depend on that setting. No new keys, publications or Realtime settings are needed for 05.

### Gameplay and scoring

- Pong goals cover the centered 50% of each end wall. The ball must fit through the opening. The remaining end wall rebounds it.
- Base ball velocity is 220 horizontally and 120 vertically in pixels per second (about 251 total, down from 305). Each paddle hit multiplies both components by 1.5. Wall bounces only reverse direction. A goal resets the serve speed. Swept horizontal collisions prevent a fast ball skipping paddles; vertical rebounds are folded mathematically. A maximum of 64 horizontal collision events is processed in one simulation step to keep the page responsive during extreme rallies; excess time in that step is dropped without changing velocity.
- Pong matches end at 10. Ranking uses **best consecutive goals**, not match points or total wins. Conceding resets the current streak; the best stays. A 10–0 win followed by three goals in the next match gives a streak of 13. Next match preserves it. Restarting an unfinished solo match resets the current streak. Online matches cannot restart halfway through; pause/resume or finish the match.
- RPS ranks best consecutive round wins. A loss or tie resets the current online streak. Exactly one score update happens when both picks first resolve a round.
- Solo and online modes maintain separate current streaks. Each profile/game has one shared leaderboard entry containing the better of the two bests, never their sum. Online streaks persist across rooms. Other games' scoring and Overall placement points remain unchanged.
- Online bests displayed inside multiplayer rooms are the bests earned in online play. The leaderboard can show a higher best earned in solo play.

### Storage and compatibility

`pong-streak` is the new internal Pong leaderboard/checkpoint key; the public game ID remains `pong`. Previous match-point scores remain archived under `pong` and are excluded from the new Pong and Overall boards. They cannot be accurately converted into streaks. A valid old solo checkpoint is copied into the new format, retaining match points and positions, but starting streaks at zero and using the new serve speed. The old checkpoint is left untouched.

Singleplayer checkpoints stay local, one per profile/game, with revision checks. They are not cross-device cloud saves. Signed-in bests sync to Supabase. Confirmed online streaks, match numbers and point totals are stored server-side; host reload restores them paused with a new serve. Guest reload rejoins the host's current state. Guest play without a profile is not ranked.

`arcade_online_streaks` stores online current/best values. `arcade_pong_goals` records unique room/match/goal events. The authenticated `arcade_pong_match` function validates membership, host authority, sequence and match completion. The same goal event can be retried without awarding it twice. Only SQL functions may read or write these private tables. Pong's host still runs physics and reports goals; this is casual client-hosted scoring, not cheat-proof server simulation.

Pong submits one database write per goal/start, not per frame. Play waits for a goal acknowledgement before the next rally. On network failure it pauses and shows Retry score sync. A small per-profile/room pending-event record allows host reload to retry a lost acknowledgement safely. Keep the room open until pending scores sync; closing/expiring a room before a goal reaches the server can prevent that goal being recorded. Confirmed scores remain. Realtime still sends up to 20 host snapshots per second and slower paused heartbeats.

Victoria Mason independently created the original Pong, Snake and Circle Hop gameplay. Her credits are retained.
