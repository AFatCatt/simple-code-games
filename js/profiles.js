/* Local password checks, not server authentication. Passwords are never stored. */
const Profiles = (() => {
  const SESSION = "simple-code-games:session:v1";
  const publicProfile = p => p ? { id: p.id, username: p.username } : null;
  const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const unhex = text => Uint8Array.from(text.match(/.{2}/g), pair => parseInt(pair, 16));

  function active() {
    let id;
    try { id = sessionStorage.getItem(SESSION); }
    catch { throw new Error("Session storage is blocked. Allow site storage to sign in."); }
    if (!id) return null;
    return publicProfile(ArcadeStorage.read().profiles.find(p => p.id === id));
  }
  function setActive(profile) {
    if (profile) sessionStorage.setItem(SESSION, profile.id);
    else sessionStorage.removeItem(SESSION);
  }
  async function passwordHash(password, salt, iterations) {
    if (!crypto.subtle) throw new Error("Password support needs Live Server or an HTTPS site.");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256",
      salt: unhex(salt), iterations }, key, 256);
    return hex(new Uint8Array(bits));
  }
  async function register(username, password) {
    username = username.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error("Use 3 to 20 letters, numbers, or underscores for the username.");
    if (password.length < 8 || password.length > 128) throw new Error("Use a password with 8 to 128 characters.");
    const usernameKey = username.toLowerCase();
    if (ArcadeStorage.read().profiles.some(p => p.usernameKey === usernameKey)) throw new Error("That username is already taken on this browser.");
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const iterations = 600000;
    const hash = await passwordHash(password, salt, iterations);
    return ArcadeStorage.update(db => {
      // Check again inside the lock in case another tab registered during hashing.
      if (db.profiles.some(p => p.usernameKey === usernameKey)) throw new Error("That username is already taken on this browser.");
      const profile = { id: crypto.randomUUID(), username, usernameKey, salt, hash, iterations };
      db.profiles.push(profile);
      return publicProfile(profile);
    });
  }
  async function authenticate(username, password) {
    const key = username.trim().toLowerCase();
    const profile = ArcadeStorage.read().profiles.find(p => p.usernameKey === key);
    if (!profile || password.length > 128) throw new Error("Username or password is incorrect.");
    const hash = await passwordHash(password, profile.salt, profile.iterations);
    if (hash !== profile.hash) throw new Error("Username or password is incorrect.");
    return publicProfile(profile);
  }
  return { active, setActive, register, authenticate };
})();
