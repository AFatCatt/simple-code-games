/* Two more cards per stage, up to 10 x 10. Each stage gives up to 60 seconds to memorize, with an optional early start. */
const MemoryMatch = (() => {
  // Keep the original eight IDs first so existing saved boards still work.
  const symbols = [
    ["🌞", "Sun"], ["🌙", "Moon"], ["⭐", "Star"], ["🌈", "Rainbow"],
    ["🍀", "Clover"], ["🔥", "Fire"], ["💎", "Gem"], ["🌸", "Flower"],
    ["🍎", "Apple"], ["🍌", "Banana"], ["🍇", "Grapes"], ["🍉", "Watermelon"],
    ["🍓", "Strawberry"], ["🍍", "Pineapple"], ["🥕", "Carrot"], ["🌽", "Corn"],
    ["🍄", "Mushroom"], ["🍒", "Cherries"], ["🍊", "Orange"], ["🍋", "Lemon"],
    ["🍑", "Peach"], ["🍐", "Pear"], ["🥥", "Coconut"], ["🥝", "Kiwi"],
    ["🐱", "Cat"], ["🐶", "Dog"], ["🐭", "Mouse"], ["🐰", "Rabbit"],
    ["🦊", "Fox"], ["🐻", "Bear"], ["🐼", "Panda"], ["🐸", "Frog"],
    ["🐵", "Monkey"], ["🦁", "Lion"], ["🚗", "Car"], ["🚌", "Bus"],
    ["🚆", "Train"], ["🚀", "Rocket"], ["✈️", "Airplane"], ["⛵", "Sailboat"],
    ["⚽", "Soccer ball"], ["🏀", "Basketball"], ["🔔", "Bell"], ["👑", "Crown"],
    ["🔑", "Key"], ["🎁", "Gift"], ["🎈", "Balloon"], ["📖", "Book"],
    ["🎵", "Music note"], ["⏰", "Alarm clock"]
  ];
  const faces = symbols.map(s => s[0]), names = symbols.map(s => s[1]);
  const PREVIEW = 60000, MAX_SCORE = 1000000000;
  const integer = (n, lo, hi) => Number.isSafeInteger(n) && n >= lo && n <= hi;
  function structure(s, maxCards, maxFaces) {
    if (!s || !integer(s.stage, 1, MAX_SCORE) || !Array.isArray(s.deck) ||
        s.deck.length < 2 || s.deck.length > maxCards || s.deck.length % 2 ||
        !s.deck.every(v => integer(v, 0, maxFaces - 1)) ||
        !faces.slice(0, maxFaces).every((_, v) => [0, 2].includes(s.deck.filter(x => x === v).length)) ||
        !["preview", "matching", "cleared", "failed"].includes(s.phase) ||
        !integer(s.revealUntil, 0, Number.MAX_SAFE_INTEGER)) return false;
    const indices = a => Array.isArray(a) && a.every(v => integer(v, 0, s.deck.length - 1)) && new Set(a).size === a.length;
    return indices(s.matched) && indices(s.faceUp) && !s.faceUp.some(i => s.matched.includes(i)) &&
      faces.slice(0, maxFaces).every((_, v) => [0, 2].includes(s.matched.filter(i => s.deck[i] === v).length));
  }
  function legacy(s) {
    if (!s || s.version !== 2 || !structure(s, 16, 8) || s.stage > 100000000 ||
        !integer(s.score, 0, MAX_SCORE) || s.deck.length !== Math.min(s.stage, 8) * 2) return false;
    const before = s.stage <= 8 ? s.stage * (s.stage - 1) / 2 : 36 + (s.stage - 9) * 8;
    if (s.score !== before + s.matched.length / 2) return false;
    if (s.phase === "preview") return !s.matched.length && !s.faceUp.length;
    if (s.phase === "cleared") return s.matched.length === s.deck.length && !s.faceUp.length;
    if (s.phase === "failed") return s.faceUp.length === 2 && s.deck[s.faceUp[0]] !== s.deck[s.faceUp[1]];
    return s.faceUp.length <= 1 && s.matched.length < s.deck.length;
  }
  function current(s) {
    if (!s || s.version !== 3 || !structure(s, 100, 50) || !integer(s.stageStartScore, 0, MAX_SCORE) ||
        s.score !== Math.min(MAX_SCORE, s.stageStartScore + s.matched.length / 2)) return false;
    if (s.phase === "preview") return s.failureReason === null && !s.matched.length && !s.faceUp.length;
    if (s.phase === "failed") {
      return s.failureReason === "mistake" && s.faceUp.length === 2 && s.deck[s.faceUp[0]] !== s.deck[s.faceUp[1]];
    }
    if (s.failureReason !== null) return false;
    if (s.phase === "cleared") return s.matched.length === s.deck.length && !s.faceUp.length;
    return s.faceUp.length <= 1 && s.matched.length < s.deck.length;
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function fresh(stage = 1, score = 0, cardCount = Math.min(stage, 50) * 2) {
    const selected = shuffle([...faces.keys()]).slice(0, cardCount / 2);
    return { version: 3, stage, deck: shuffle([...selected, ...selected]), matched: [], faceUp: [],
      phase: "preview", score, stageStartScore: score, revealUntil: Date.now() + PREVIEW,
      failureReason: null };
  }
  function upgrade(saved) {
    if (current(saved)) return structuredClone(saved);
    if (!legacy(saved)) throw new Error("This Memory Match save is incompatible. Choose New game to replace it.");
    const s = structuredClone(saved); s.version = 3; s.stageStartScore = s.score - s.matched.length / 2;
    // Existing preview saves get the new full minute once during this upgrade.
    if (s.phase === "preview") s.revealUntil = Date.now() + PREVIEW;
    s.failureReason = s.phase === "failed" ? "mistake" : null;
    return s;
  }
  return { faces, names, PREVIEW, MAX_SCORE, valid: s => current(s) || legacy(s), fresh, upgrade, points: s => s.score || null };
})();

function loadMemoryMatch(container, options = {}) {
  const profile = Profiles.active(), record = profile ? ArcadeStorage.getRecord(profile.id, "memory") : null;
  let replace = Boolean(options.newGame);
  if (replace && record && !confirm("Start a new Memory Match run? Your best score will stay.")) replace = false;
  let state = record && !replace ? MemoryMatch.upgrade(record.state) : MemoryMatch.fresh();
  let revision = record?.revision || 0, dirty = !record || replace || record.state.version !== 3;
  let pending = null, clockTimer = null, blocked = false, disposed = false, buttons = [];
  container.className = "memory-stage";
  container.innerHTML = `<h2>Memorize. Match. Keep going.</h2>
    <div class="memory-hud"><p id="memory-stats" class="memory-stats"></p>
      <p id="memory-clock" class="memory-clock" role="timer" aria-live="off" aria-label="Memorization time remaining">Memorize: 1:00</p></div>
    <div class="memory-board-scroll" role="region" aria-label="Memory board. Scroll sideways on small screens." tabindex="0">
      <div class="memory-grid" aria-label="Memory Match cards"></div></div>
    <p id="memory-scroll-hint" class="small" hidden>Large boards can be scrolled sideways on smaller screens.</p>
    <p id="memory-result" role="status"></p>
    <button id="memory-start" class="button" type="button">Start matching</button>
    <button id="memory-continue" class="button primary" type="button" hidden>Continue</button>
    <p id="memory-save" class="small" role="status"></p>
    <button id="memory-retry" class="button" type="button" hidden>Retry save</button>`;
  const find = id => container.querySelector("#" + id);
  const grid = container.querySelector(".memory-grid"), status = find("memory-save"), retry = find("memory-retry");
  const start = find("memory-start"), next = find("memory-continue"), clock = find("memory-clock");
  const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  function build() {
    const columns = Math.ceil(Math.sqrt(state.deck.length));
    grid.replaceChildren(); grid.style.setProperty("--memory-columns", columns);
    container.querySelector(".memory-board-scroll").scrollLeft = 0;
    find("memory-scroll-hint").hidden = columns < 7;
    buttons = state.deck.map((_, i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "memory-card";
      b.addEventListener("click", () => pick(i)); grid.append(b); return b;
    });
  }
  function renderClock() {
    const seconds = Math.max(0, Math.ceil((state.revealUntil - Date.now()) / 1000));
    const label = state.phase === "preview" ? `Memorize: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
      : state.phase === "cleared" ? "Stage complete" : state.phase === "failed" ? "Run ended" : "Matching";
    text(clock, label); clock.classList.toggle("is-low", state.phase === "preview" && seconds <= 10);
  }
  function render() {
    text(find("memory-stats"), `Stage ${state.stage} · ${state.deck.length} cards | Score: ${state.score} pairs`);
    buttons.forEach((b, i) => {
      const matched = state.matched.includes(i), open = matched || state.faceUp.includes(i) || state.phase === "preview" || state.phase === "failed";
      text(b, open ? MemoryMatch.faces[state.deck[i]] : "?");
      b.setAttribute("aria-label", open ? `${MemoryMatch.names[state.deck[i]]}${matched ? ", matched" : ""}` : `Card ${i + 1}, face down`);
      b.classList.toggle("is-open", open); b.classList.toggle("is-matched", matched);
      b.classList.toggle("is-wrong", state.phase === "failed" && state.failureReason === "mistake" && state.faceUp.includes(i));
      b.disabled = state.phase !== "matching" || matched || state.faceUp.includes(i) || Boolean(pending) || blocked || disposed;
    });
    const messages = {
      preview: `Memorize these ${state.deck.length} cards for up to one minute. Click Start matching when you are ready, or wait for the timer.`,
      matching: "Match two cards at a time. One wrong pair ends your run.",
      cleared: state.deck.length < 100 ? `Stage cleared! Continue with ${state.deck.length + 2} cards and a fresh minute to memorize. Your score keeps going.` : "10 × 10 cleared! Continue to a shuffled 10 × 10 board and a fresh minute to memorize. Your score keeps going.",
      failed: `Run over: those cards do not match. Final score: ${state.score} pairs. Choose New game to start a new run.`
    };
    text(find("memory-result"), messages[state.phase]); renderClock();
    start.hidden = state.phase !== "preview"; next.hidden = state.phase !== "cleared";
    start.disabled = next.disabled = Boolean(pending) || blocked || disposed;
  }
  // Save the preview deadline so refreshing cannot restart the same minute.
  function reconcile() {
    if (state.phase !== "preview" || Date.now() < state.revealUntil) return false;
    state.phase = "matching"; dirty = true; return true;
  }
  function persist() {
    if (!profile) { dirty = false; text(status, "Guest run: sign in before playing to save and join the leaderboard."); return Promise.resolve(); }
    if (pending) return pending;
    pending = (async () => {
      await Promise.resolve(); retry.hidden = true;
      try {
        while (dirty) {
          if (Profiles.active()?.id !== profile.id) throw new Error("Your profile changed. Reload before playing again.");
          const snapshot = structuredClone(state); dirty = false; text(status, "Saving...");
          revision = await ArcadeStorage.saveGame(profile.id, "memory", snapshot, MemoryMatch.points(snapshot), revision);
        }
        blocked = false; text(status, "Run saved for " + profile.username + ".");
      } catch (e) { dirty = true; blocked = true; retry.hidden = false; text(status, e.message); throw e; }
      finally { pending = null; render(); }
    })();
    render(); return pending;
  }
  function tick() {
    if (disposed) return;
    if (reconcile()) { render(); persist().catch(() => {}); }
    else renderClock();
  }
  function endPreview() {
    if (disposed || pending || blocked) return;
    tick(); if (state.phase !== "preview") return;
    state.phase = "matching"; dirty = true;
    render(); persist().catch(() => {});
  }
  function pick(i) {
    if (disposed) return;
    tick();
    if (pending || blocked || state.phase !== "matching" || state.matched.includes(i) || state.faceUp.includes(i)) return;
    state.faceUp.push(i);
    if (state.faceUp.length === 2) {
      if (state.deck[state.faceUp[0]] !== state.deck[state.faceUp[1]]) { state.phase = "failed"; state.failureReason = "mistake"; }
      else {
        state.matched.push(...state.faceUp); state.faceUp = [];
        state.score = Math.min(MemoryMatch.MAX_SCORE, state.score + 1);
        if (state.matched.length === state.deck.length) state.phase = "cleared";
      }
    }
    dirty = true; render(); persist().catch(() => {});
  }
  async function beforeLeave() { tick(); if (pending) await pending; if (dirty) await persist(); }
  async function reset() {
    await beforeLeave();
    if (!confirm("Start a new run from two cards? Your best score will stay.")) return;
    state = MemoryMatch.fresh(); dirty = true; blocked = false; build(); render(); await persist();
  }
  function pause() { tick(); if (dirty) persist().catch(() => {}); }
  function visibility() { tick(); }
  document.addEventListener("visibilitychange", visibility);
  start.addEventListener("click", endPreview);
  next.addEventListener("click", () => {
    if (pending || blocked || disposed || state.phase !== "cleared" || state.stage >= MemoryMatch.MAX_SCORE) return;
    state = MemoryMatch.fresh(state.stage + 1, state.score, Math.min(state.deck.length + 2, 100));
    dirty = true; build(); render(); persist().catch(() => {});
  });
  retry.addEventListener("click", () => { reconcile(); persist().catch(() => {}); });
  reconcile(); build(); render();
  text(status, profile ? "Saved run restored for " + profile.username + "." : "Guest run: progress is not saved.");
  if (dirty) persist().catch(() => {});
  clockTimer = setInterval(tick, 250);
  return { beforeLeave, reset, pause, getState: () => structuredClone(state), destroy() { disposed = true; clearInterval(clockTimer); document.removeEventListener("visibilitychange", visibility); } };
}
