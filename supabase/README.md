# Supabase setup for Simple Code Games

Profiles and best scores are shared across devices. Each online account has one local checkpoint per game on each browser/site address. Doom checkpoints are not uploaded to Supabase.

If this project already has working online profiles and leaderboards, no new database setup is needed for the cleanup update. Keep the existing values in `js/online-config.js`.

## Set up a new Supabase project

1. Create a dedicated project at https://supabase.com/dashboard.
2. Open SQL Editor and paste the contents of this folder's `setup.sql` into a new query.
3. Run the query in Supabase. It creates the tables, username uniqueness, access rules and leaderboard functions.
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

The SQL is intended for a dedicated game project. It can be rerun on the matching schema without deleting scores. Do not apply it to a project with unrelated applications or accounts.

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

Existing projects: run the revised `01-memory-match.sql`, even if you ran the earlier version. New projects get the new score support from `setup.sql`.

Memory Match shows 2, 4, 6 and eventually 16 cards for four seconds before hiding them. Match pairs without a mistake. One wrong pair ends the run. Clearing all 16 offers Continue: another full board shuffles and the same score continues. Each matched pair adds one point. Stage and picks save locally; the best run syncs online.

The new rules use the `memory-run` score/save key. The public Memory Match leaderboard maps to that key. Earlier fixed-board records under `memory` are retained but excluded from current rankings and Overall. This prevents the old 1000-point scale from mixing with matched-pair totals. Other games are unchanged.

## RPS room-list update

Run the revised `02-rps-multiplayer.sql`, including when upgrading the earlier room-code version. It can also install multiplayer from scratch. No API key or Realtime configuration changes are required.

Choose Singleplayer or Multiplayer. Multiplayer lists available rooms by host username. Host with an optional password, Join a listed room, or Join random to find a public room without a password. Each profile may occupy one active room. Old rooms retain members and scores and become public; host a new room to add a password.

Passwords use pgcrypto bcrypt with a random salt and cost 10. The SQL detects the extension's installed schema. Passwords must be 4 to 64 characters and at most 72 UTF-8 bytes. Password hashes and unopposed picks are never included in room lists or snapshots. Direct room-table access is denied. Authenticated functions validate membership, lock rows, accept each pick once and compute the result. Random matching skips locked/full/expired/password-protected rooms.

Room lists refresh every five seconds and active rooms every two seconds while visible. Active rooms can be resumed across devices using the same profile. Closing or leaving ends the room for both players; switching modes or closing the tab does not. Rooms expire two hours after the last game action. Expired records older than one day are cleaned when hosting. Room wins do not affect singleplayer streak rankings.

New projects: run `setup.sql`, then `02-rps-multiplayer.sql`.

## Memory leaderboard repair

If the logs show `22023 Invalid game or score` for Memory uploads, run `03-memory-leaderboard-repair.sql` in Supabase SQL Editor. This brings score validation and Memory leaderboard mapping up to date without deleting data. Copying SQL files to GitHub does not execute them in the database.

After applying the website patch, close old site tabs, reload and use Leaderboards > Memory Match > Refresh scores in the browser where you played. The saved best can then upload without a new high score. Setup-related upload rejections are paused until an explicit retry or page reload, and errors for one game no longer prevent other games from syncing.
