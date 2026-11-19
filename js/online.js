/* Shared online connection. Access is enforced in supabase/setup.sql. */
const ArcadeOnline = (() => {
  const config = window.ARCADE_ONLINE_CONFIG || {};
  let client = null, setupError = "";
  try {
    if (!config.url || !config.publishableKey) throw new Error("Online profiles are not configured yet. The site owner needs to finish the Supabase setup.");
    if (!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(config.url) || !config.publishableKey.startsWith("sb_publishable_")) {
      throw new Error("Use the Supabase Project URL and publishable key in js/online-config.js.");
    }
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { storage: sessionStorage, storageKey: "simple-code-games:online-auth", persistSession: true,
        autoRefreshToken: true, detectSessionInUrl: false }
    });
  } catch (error) { setupError = error.message; }
  function requireClient() { if (!client) throw new Error(setupError || "Online service is unavailable."); return client; }
  function reportSync(message, failed = false) {
    window.dispatchEvent(new CustomEvent("arcadesyncchange", { detail: { message, failed } }));
  }
  return { get error() { return setupError; }, requireClient, reportSync };
})();
