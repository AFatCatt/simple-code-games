/* One local checkpoint per ONLINE account/game. Best scores sync to Supabase. */
const ArcadeStorage = (() => {
 const KEY = "simple-code-games:online-saves:v2", LOCK = KEY + ":lock";
  const empty = () => ({ version: 1, games: {} });
  let pendingSync = null, syncTimer = null, lastSyncStatus = "";
  const syncFailures = new Map();
  function reportSync(message, failed = false) {
    const signature = String(failed) + message;
    if (signature !== lastSyncStatus) { lastSyncStatus = signature; ArcadeOnline.reportSync(message, failed); }
  }
  function getSyncError(gameId) {
    const profile = Profiles.active();
    return profile && Object.hasOwn(gameCatalog, gameId) ? syncFailures.get(gameKey(profile.id, gameId))?.message || "" : "";
  }
  function validRecord(r) {
    return r && r.version === 1 && Number.isSafeInteger(r.revision) && r.revision >= 1 &&
      (r.best === null || (Number.isSafeInteger(r.best) && r.best >= 0 && r.best <= 1e9));
  }
  function read() {
    let raw;
    try { raw = localStorage.getItem(KEY); }
    catch { throw new Error("Browser storage is blocked. Allow it to save game progress."); }
    if (!raw) return empty();
    try {
      const db = JSON.parse(raw);
      if (db.version !== 1 || !db.games || typeof db.games !== "object" || Array.isArray(db.games) || !Object.values(db.games).every(validRecord)) throw new Error();
      return db;
    } catch { throw new Error("Saved game data is damaged. It has been left untouched."); }
  }
  async function update(change) {
    if (location.protocol === "file:" || !navigator.locks) throw new Error("Use Live Server or the HTTPS website to save games.");
    return navigator.locks.request(LOCK, () => {
      const db = read(), result = change(db);
      try { localStorage.setItem(KEY,JSON.stringify(db)); }
      catch { throw new Error("Saving failed because browser storage is blocked or full. Keep this page open."); }
      window.dispatchEvent(new Event("arcadedatachange"));
      return result;
    });
  }
  function gameKey(profileId,gameId) {
    if (!Object.hasOwn(gameCatalog,gameId)) throw new Error("Unknown game.");
    return profileId + ":" + (gameCatalog[gameId].storageId || gameId);
  }
  function getRecord(profileId,gameId) { return read().games[gameKey(profileId,gameId)] || null; }
  // Read the old checkpoint without interpreting match points as streaks.
  function getLegacyPongRecord(profileId) { return read().games[profileId + ":pong"] || null; }
  function syncSoon() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => flushScores().catch(() => {}),1000);
  }
  async function saveGame(profileId,gameId,state,score,expectedRevision) {
    if (Profiles.active()?.id !== profileId) throw new Error("The active profile changed. Reload before playing again.");
    const key = gameKey(profileId,gameId);
    const revision = await update(db => {
      const old = db.games[key];
      if ((old?.revision || 0) !== expectedRevision) throw new Error("This save changed in another tab. Reload this page before playing again.");
      let best = old?.best ?? null;
      if (score !== null) {
        if (!Number.isSafeInteger(score) || score < 0 || score > 1e9) throw new Error("Invalid score.");
        best = best === null ? score : Math.max(best,score);
      }
      db.games[key] = { version:1, revision:expectedRevision+1, updatedAt:new Date().toISOString(), state, best, syncedBest:old?.syncedBest ?? null };
      return expectedRevision+1;
    });
    syncSoon();
    return revision;
  }
  async function flushScores({ force = false } = {}) {
    if (pendingSync) {
      if (!force) return pendingSync;
      await pendingSync.catch(() => {});
      return flushScores({ force: true });
    }
    const profile = Profiles.active();
    if (!profile) return;
    if (force) for (const key of syncFailures.keys()) if (key.startsWith(profile.id + ":")) syncFailures.delete(key);
    pendingSync = (async () => {
      await Promise.resolve();
      try {
        const db = read(), failures = [];
        for (const [id,game] of Object.entries(gameCatalog)) {
          if (!game.playable || !game.leaderboardMetric) continue;
          const key = gameKey(profile.id,id), record = db.games[key];
          if (record?.best == null || (record.syncedBest != null && record.best <= record.syncedBest)) continue;
          if (Profiles.active()?.id !== profile.id) break;
          const previousFailure = syncFailures.get(key);
          if (previousFailure && (previousFailure.setup || previousFailure.retryAfter > Date.now())) {
            failures.push(previousFailure); continue;
          }
          try {
            const { data, error } = await ArcadeOnline.requireClient().rpc("arcade_submit_score", { p_game: game.storageId || id, p_score: record.best, p_expected_profile: profile.id });
            if (error) throw error;
            if (!Number.isSafeInteger(data) || data < record.best) throw new Error("Invalid leaderboard response.");
            await update(latest => {
              const fresh = latest.games[key];
              if (!fresh) return;
              fresh.best = Math.max(fresh.best ?? 0, data);
              fresh.syncedBest = Math.max(fresh.syncedBest ?? 0, data);
            });
            syncFailures.delete(key);
          } catch (error) {
            const setup = ["22023", "23514", "PGRST202", "42883"].includes(error.code);
            const failure = Object.assign(new Error(setup
              ? game.title + " scores are saved on this device. The site's leaderboard setup needs an update."
              : game.title + " scores are saved on this device and waiting to sync. Check your connection, then use Refresh scores."),
              { setup, retryAfter: Date.now() + 30000 });
            syncFailures.set(key, failure); failures.push(failure);
            // A failed game upload must not block other games' scores.
          }
        }
        if (failures.length) throw failures[0];
        const latest = read();
        const stillPending = Object.entries(gameCatalog).some(([id, game]) => {
          if (!game.playable || !game.leaderboardMetric) return false;
          const r = latest.games[gameKey(profile.id, id)];
          return r?.best != null && (r.syncedBest == null || r.best > r.syncedBest);
        });
        if (stillPending) { reportSync("Game saved. Syncing the latest best score..."); syncSoon(); }
        else reportSync("Best scores synced online.");
      } catch (error) {
        reportSync(error.message || "Game saved on this device. Leaderboard sync is pending.", true);
        throw error;
      } finally { pendingSync = null; }
    })();
    return pendingSync;
  }
  window.addEventListener("online",() => flushScores({ force: true }).catch(() => {}));
  setInterval(() => flushScores().catch(() => {}),15000);
  return { getRecord,getLegacyPongRecord,saveGame,flushScores,getSyncError };
})();
