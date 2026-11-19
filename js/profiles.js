/* Supabase Auth owns passwords and sessions; usernames are globally unique. */
const Profiles = (() => {
  let current = null, initialError = "";
  const identifier = name => name.trim().toLowerCase() + "@simple-code-games.invalid";
  function checkName(name) {
    name = name.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw new Error("Use 3 to 20 letters, numbers, or underscores for the username.");
    return name;
  }
  async function loadProfile(user) {
    if (!user) { current = null; return null; }
    const { data, error } = await ArcadeOnline.requireClient().from("arcade_profiles").select("id,username").eq("id",user.id).single();
    if (error || !data) throw new Error("Could not load your online profile. Check your connection and try again.");
    current = { id: data.id, username: data.username };
    return current;
  }
  const ready = (async () => {
    try {
      const client = ArcadeOnline.requireClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await loadProfile(data.session?.user);
      client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" && current) {
          current = null;
          window.currentGame?.pause?.();
          window.dispatchEvent(new Event("arcadeauthlost"));
        } else if (current && session?.user?.id && current.id !== session.user.id) {
          current = null;
          window.currentGame?.pause?.();
          window.dispatchEvent(new Event("arcadeauthlost"));
        }
      });
    } catch (error) { initialError = error.message; }
  })();
  async function register(username, password) {
    username = checkName(username);
    if (password.length < 8 || password.length > 128) throw new Error("Use a password with 8 to 128 characters.");
    const { data, error } = await ArcadeOnline.requireClient().auth.signUp({
      email: identifier(username), password, options: { data: { username } }
    });
    if (error) {
      if (/already|registered|duplicate/i.test(error.message)) throw new Error("That username is already taken. Choose another or sign in.");
      throw new Error("Could not create the profile: " + error.message);
    }
    if (!data.session) throw new Error("Online registration setup is incomplete. Contact the site owner before trying again.");
    return loadProfile(data.user);
  }
  async function authenticate(username, password) {
    username = checkName(username);
    if (password.length > 128) throw new Error("Username or password is incorrect.");
    const { data, error } = await ArcadeOnline.requireClient().auth.signInWithPassword({ email: identifier(username), password });
    if (error) throw new Error(/invalid.*credentials/i.test(error.message) ? "Username or password is incorrect." : "Sign-in failed: " + error.message);
    return loadProfile(data.user);
  }
  async function setActive(profile) {
    if (!profile) {
      const { error } = await ArcadeOnline.requireClient().auth.signOut({ scope: "local" });
      if (error) throw new Error("Could not sign out. Try again.");
      current = null;
    } else if (profile.id !== current?.id) throw new Error("Please sign in to switch profiles.");
  }
  return { ready, active: () => current ? { ...current } : null, get error() { return initialError; }, register, authenticate, setActive };
})();
