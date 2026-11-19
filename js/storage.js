/* One local database. Each profile/game pair has ONE save and a separate best. */
const ArcadeStorage = (() => {
  const KEY = "simple-code-games:database:v1";
  const LOCK = "simple-code-games:database-lock";
  const empty = () => ({ version: 1, profiles: [], games: {} });

  function read() {
    let text;
    try { text = localStorage.getItem(KEY); }
    catch { throw new Error("Browser storage is blocked. Allow site storage to use profiles and saves."); }
    if (!text) return empty();
    try {
      const db = JSON.parse(text);
      const hex = (value, size) => typeof value === "string" && new RegExp(`^[a-f0-9]{${size}}$`).test(value);
      if (!db || db.version !== 1 || !Array.isArray(db.profiles) ||
          !db.games || typeof db.games !== "object" || Array.isArray(db.games) ||
          !db.profiles.every(p => p && typeof p.id === "string" && /^[a-zA-Z0-9-]+$/.test(p.id) &&
            typeof p.username === "string" && /^[A-Za-z0-9_]{3,20}$/.test(p.username) &&
            p.usernameKey === p.username.toLowerCase() && p.iterations === 600000 &&
            hex(p.salt, 32) && hex(p.hash, 64)) ||
          new Set(db.profiles.map(p => p.id)).size !== db.profiles.length ||
          new Set(db.profiles.map(p => p.usernameKey)).size !== db.profiles.length) throw new Error();
      return db;
    } catch { throw new Error("Saved arcade data is damaged or incompatible. It has been left untouched."); }
  }

  async function update(change) {
    if (location.protocol === "file:" || !navigator.locks) {
      throw new Error("Open the site with Live Server or GitHub Pages to use profiles and saves.");
    }
    // A browser lock prevents two tabs from creating the same username together.
    return navigator.locks.request(LOCK, () => {
      const db = read();
      const result = change(db);
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch { throw new Error("Saving failed because browser storage is blocked or full. Keep this page open."); }
      window.dispatchEvent(new Event("arcadedatachange"));
      return result;
    });
  }

  function gameKey(profileId, gameId) {
    if (!Object.hasOwn(gameCatalog, gameId)) throw new Error("Unknown game.");
    return profileId + ":" + gameId;
  }
  function getRecord(profileId, gameId) {
    const record = read().games[gameKey(profileId, gameId)];
    if (!record) return null;
    if (record.version !== 1 || !Number.isSafeInteger(record.revision) || record.revision < 1 ||
        !(record.best === null || (Number.isFinite(record.best) && record.best >= 0))) {
      throw new Error("This game's saved record is damaged. It has been left untouched.");
    }
    return record;
  }

  async function saveGame(profileId, gameId, state, score, expectedRevision) {
    const key = gameKey(profileId, gameId);
    return update(db => {
      if (!db.profiles.some(p => p.id === profileId)) throw new Error("Profile not found. Sign in again.");
      const old = db.games[key];
      if ((old?.revision || 0) !== expectedRevision) {
        throw new Error("This save changed in another tab. Reload this page before playing again.");
      }
      let best = old?.best ?? null;
      if (score !== null && Number.isFinite(score) && score >= 0) {
        const lowerWins = gameCatalog[gameId].leaderboardOrder === "asc";
        best = best === null ? score : (lowerWins ? Math.min(best, score) : Math.max(best, score));
      }
      db.games[key] = { version: 1, revision: expectedRevision + 1,
        updatedAt: new Date().toISOString(), state, best };
      return db.games[key].revision;
    });
  }
  return { KEY, read, update, getRecord, saveGame };
})();
