/* Reveal, remember, and survive: 2, 4, 6 ... 16 cards, then more full boards. */
const MemoryMatch = (() => {
  const faces = ["🌞", "🌙", "⭐", "🌈", "🍀", "🔥", "💎", "🌸"];
  const names = ["Sun", "Moon", "Star", "Rainbow", "Clover", "Fire", "Gem", "Flower"];
  const size = stage => Math.min(stage, 8) * 2;
  const before = stage => stage <= 8 ? stage * (stage - 1) / 2 : 36 + (stage - 9) * 8;
  function valid(s) {
    if (!s || s.version !== 2 || !Number.isSafeInteger(s.stage) || s.stage < 1 || s.stage > 100000000 ||
        !Array.isArray(s.deck) || s.deck.length !== size(s.stage) ||
        !s.deck.every(v => Number.isInteger(v) && v >= 0 && v < 8) ||
        !faces.every((_, v) => [0, 2].includes(s.deck.filter(x => x === v).length)) ||
        !["preview", "matching", "cleared", "failed"].includes(s.phase) ||
        !Number.isSafeInteger(s.revealUntil) || s.revealUntil < 0) return false;
    const indices = a => Array.isArray(a) && a.every(v => Number.isInteger(v) && v >= 0 && v < s.deck.length) && new Set(a).size === a.length;
    if (!indices(s.matched) || !indices(s.faceUp) || s.faceUp.some(i => s.matched.includes(i)) ||
        !faces.every((_, v) => [0, 2].includes(s.matched.filter(i => s.deck[i] === v).length)) ||
        s.score !== before(s.stage) + s.matched.length / 2) return false;
    if (s.phase === "preview") return !s.matched.length && !s.faceUp.length;
    if (s.phase === "cleared") return s.matched.length === s.deck.length && !s.faceUp.length;
    if (s.phase === "failed") return s.faceUp.length === 2 && s.deck[s.faceUp[0]] !== s.deck[s.faceUp[1]];
    return s.faceUp.length <= 1 && s.matched.length < s.deck.length;
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function fresh(stage = 1) {
    const selected = shuffle([...faces.keys()]).slice(0, size(stage) / 2);
    return { version: 2, stage, deck: shuffle([...selected, ...selected]), matched: [], faceUp: [], phase: "preview", score: before(stage), revealUntil: Date.now() + 4000 };
  }
  return { faces, names, valid, fresh, points: s => s.score || null };
})();

function loadMemoryMatch(container, options = {}) {
  const profile = Profiles.active();
  const record = profile ? ArcadeStorage.getRecord(profile.id, "memory") : null;
  let replace = Boolean(options.newGame);
  if (replace && record && !confirm("Start a new Memory Match run? Your best score will stay.")) replace = false;
  if (record && !replace && !MemoryMatch.valid(record.state)) throw new Error("This Memory Match save is incompatible. Choose New game to replace it.");
  let state = record && !replace ? structuredClone(record.state) : MemoryMatch.fresh();
  let revision = record?.revision || 0, dirty = !record || replace, pending = null, timer = null, blocked = false, disposed = false;
  if (state.phase === "preview" && state.revealUntil <= Date.now()) { state.phase = "matching"; dirty = true; }
  container.className = "memory-stage";
  container.innerHTML = `<h2>Memorize. Match. Keep going.</h2><p id="memory-stats" class="memory-stats"></p>
    <div class="memory-grid" aria-label="Memory Match cards"></div>
    <p id="memory-result" role="status"></p>
    <button id="memory-start" class="button" type="button">Hide cards and start</button>
    <button id="memory-continue" class="button primary" type="button" hidden>Continue</button>
    <p id="memory-save" class="small" role="status"></p>
    <button id="memory-retry" class="button" type="button" hidden>Retry save</button>`;
  const grid = container.querySelector(".memory-grid"), status = container.querySelector("#memory-save"), retry = container.querySelector("#memory-retry");
  const start = container.querySelector("#memory-start"), next = container.querySelector("#memory-continue");
  let buttons = [];
  function build() {
    grid.replaceChildren(); grid.style.setProperty("--memory-columns", Math.min(4, state.deck.length));
    buttons = state.deck.map((_, i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "memory-card";
      b.addEventListener("click", () => pick(i)); grid.append(b); return b;
    });
  }
  function render() {
    container.querySelector("#memory-stats").textContent = `Stage ${state.stage} · ${state.deck.length} cards | Score: ${state.score} pairs`;
    buttons.forEach((b, i) => {
      const matched = state.matched.includes(i), open = matched || state.faceUp.includes(i) || state.phase === "preview" || state.phase === "failed";
      b.textContent = open ? MemoryMatch.faces[state.deck[i]] : "?";
      b.setAttribute("aria-label", open ? `${MemoryMatch.names[state.deck[i]]}${matched ? ", matched" : ""}` : `Card ${i + 1}, face down`);
      b.classList.toggle("is-open", open); b.classList.toggle("is-matched", matched);
      b.classList.toggle("is-wrong", state.phase === "failed" && state.faceUp.includes(i));
      b.disabled = state.phase !== "matching" || matched || state.faceUp.includes(i) || Boolean(pending) || blocked || disposed;
    });
    const messages = {
      preview: `Memorize these ${state.deck.length} cards. They turn over after 4 seconds.`,
      matching: "Choose two matching cards. One wrong pair ends your run.",
      cleared: state.deck.length < 16 ? `Stage cleared! Continue with ${state.deck.length + 2} cards. Your score keeps going.` : "Full board cleared! Continue to a shuffled full board. Your score keeps going.",
      failed: `Run over: those cards do not match. Final score: ${state.score} pairs. Choose New game to start a new run.`
    };
    container.querySelector("#memory-result").textContent = messages[state.phase];
    start.hidden = state.phase !== "preview"; next.hidden = state.phase !== "cleared";
    start.disabled = next.disabled = Boolean(pending) || blocked || disposed;
  }
  function schedule() {
    clearTimeout(timer); timer = null;
    if (state.phase === "preview" && !pending && !blocked && !disposed) timer = setTimeout(endPreview, Math.max(0, state.revealUntil - Date.now()));
  }
  function persist() {
    if (!profile) { dirty = false; status.textContent = "Guest run: sign in before playing to save and join the leaderboard."; schedule(); return Promise.resolve(); }
    if (pending) return pending;
    pending = (async () => {
      await Promise.resolve(); retry.hidden = true;
      try {
        while (dirty) {
          if (Profiles.active()?.id !== profile.id) throw new Error("Your profile changed. Reload before playing again.");
          const snapshot = structuredClone(state); dirty = false;
          status.textContent = "Saving...";
          revision = await ArcadeStorage.saveGame(profile.id, "memory", snapshot, MemoryMatch.points(snapshot), revision);
        }
        blocked = false; status.textContent = "Run saved for " + profile.username + ".";
      } catch (e) { dirty = true; blocked = true; retry.hidden = false; status.textContent = e.message; throw e; }
      finally { pending = null; render(); schedule(); }
    })();
    render(); return pending;
  }
  function endPreview() {
    if (state.phase !== "preview" || disposed || blocked) return;
    clearTimeout(timer); timer = null; state.phase = "matching"; dirty = true;
    render(); persist().catch(() => {});
  }
  function pick(i) {
    if (pending || blocked || disposed || state.phase !== "matching" || state.matched.includes(i) || state.faceUp.includes(i)) return;
    state.faceUp.push(i);
    if (state.faceUp.length === 2) {
      if (state.deck[state.faceUp[0]] !== state.deck[state.faceUp[1]]) state.phase = "failed";
      else {
        state.matched.push(...state.faceUp); state.faceUp = []; state.score++;
        if (state.matched.length === state.deck.length) state.phase = "cleared";
      }
    }
    dirty = true; render(); persist().catch(() => {});
  }
  async function beforeLeave() { if (pending) await pending; if (dirty) await persist(); }
  async function reset() {
    await beforeLeave();
    if (!confirm("Start a new run from two cards? Your best score will stay.")) return;
    clearTimeout(timer); state = MemoryMatch.fresh(); dirty = true; blocked = false;
    build(); render(); await persist();
  }
  function pause() { if (state.phase === "preview") endPreview(); else if (dirty) persist().catch(() => {}); }
  function visibility() { if (document.hidden) pause(); }
  document.addEventListener("visibilitychange", visibility);
  start.addEventListener("click", endPreview);
  next.addEventListener("click", () => {
    if (pending || blocked || disposed || state.phase !== "cleared") return;
    if (state.stage >= 100000000) return;
    state = MemoryMatch.fresh(state.stage + 1); dirty = true; build(); render(); persist().catch(() => {});
  });
  retry.addEventListener("click", () => persist().catch(() => {}));
  build(); render(); schedule();
  status.textContent = profile ? "Saved run restored for " + profile.username + "." : "Guest run: progress is not saved.";
  if (dirty) persist().catch(() => {});
  return { beforeLeave, reset, pause, getState: () => structuredClone(state), destroy() { disposed = true; clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); } };
}
