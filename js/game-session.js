/* Connect Victoria's canvas games to the shared profile database. */
const CanvasSaves = {
  valid(id, s) {
    if (!s || s.version !== 1 || s.game !== id) return false;
    const number = (v, low, high) => Number.isFinite(v) && v >= low && v <= high;
    if (id === "snake") {
      const cell = p => p && Number.isInteger(p.x) && Number.isInteger(p.y) &&
        p.x >= 0 && p.x < 400 && p.y >= 0 && p.y < 400 && p.x % 20 === 0 && p.y % 20 === 0;
      if (!["ready", "playing", "paused", "over", "won"].includes(s.phase) ||
          !Array.isArray(s.snake) || s.snake.length < 3 || s.snake.length > 400 || !s.snake.every(cell) ||
          !Number.isInteger(s.score) || s.score !== s.snake.length - 3 ||
          ![[20,0],[-20,0],[0,20],[0,-20]].some(([x,y]) => s.dx === x && s.dy === y)) return false;
      const occupied = new Set(s.snake.map(p => p.x + ":" + p.y));
      return occupied.size === s.snake.length && (s.food === null ? s.snake.length === 400 : cell(s.food) && !occupied.has(s.food.x + ":" + s.food.y));
    }
    if (id === "circle-hop") {
      return ["ready", "playing", "paused", "over"].includes(s.phase) && number(s.score, 0, 1e9) &&
        number(s.speed, 220, 360) && number(s.spawnCountdown, -0.1, 1.81) &&
        number(s.playerY, 0, 308) && number(s.velocityY, -520, 1000) &&
        Array.isArray(s.obstacles) && s.obstacles.length <= 16 && s.obstacles.every(o => o &&
          number(o.width, 18, 32) && number(o.height, 24, 56) && number(o.x, -32, 640) &&
          number(o.y, 269, 301) && Math.abs(o.y + o.height - 325) < 0.001);
    }
    return false;
  }
};

function loadCanvasGame(container, id, options = {}) {
  const profile = Profiles.active(), record = profile ? ArcadeStorage.getRecord(profile.id, id) : null;
  let fresh = Boolean(options.newGame);
  if (fresh && record && !confirm("Replace this profile's saved " + gameCatalog[id].title + " game? Its leaderboard best will stay.")) fresh = false;
  if (record && !fresh && !CanvasSaves.valid(id, record.state)) throw new Error("This saved game is incompatible. Use New game to replace it.");
  let revision = record?.revision || 0, engine = null, pending = null, dirty = fresh, generation = 0, blocked = false;
  const snake = id === "snake";
  container.className = "canvas-stage";
  container.innerHTML = `<div class="canvas-controls"><strong id="score-display">Score: 0</strong>
    <button id="pause-button" class="button compact" type="button" disabled>Pause</button>
    <button id="new-game-button" class="button compact" type="button">Start game</button></div>
    <canvas id="game-canvas" width="${snake ? 400 : 640}" height="${snake ? 400 : 360}" tabindex="0" aria-label="${gameCatalog[id].title} game board"></canvas>
    <div id="stage-message" class="canvas-message" role="status"><strong id="announcement"></strong><p id="stage-copy"></p></div>
    <p id="game-state" class="small">Game state: ready</p>
    <p id="canvas-save-status" class="small" role="status"></p>
    <button id="canvas-retry" class="button compact" type="button" hidden>Retry save</button>`;
  const status = container.querySelector("#canvas-save-status"), retry = container.querySelector("#canvas-retry");
  function report(error) { status.textContent = error.message; status.classList.add("save-error"); }
  function persist() {
    if (!profile || !engine) { dirty = false; return Promise.resolve(); }
    if (pending) return pending;
    if (!dirty) return Promise.resolve();
    const snapshot = engine.getState(), snapshotGeneration = generation;
    if (!CanvasSaves.valid(id, snapshot)) return Promise.reject(new Error("The current game state could not be saved."));
    pending = (async () => {
      await Promise.resolve(); retry.hidden = true;
      try {
        if (Profiles.active()?.id !== profile.id) throw new Error("The active profile changed. Reload before playing.");
        const score = snapshot.phase === "ready" ? null : Math.floor(snapshot.score);
        revision = await ArcadeStorage.saveGame(profile.id, id, snapshot, score, revision);
        dirty = generation !== snapshotGeneration; blocked = false;
        status.classList.remove("save-error"); status.textContent = "Saved for " + profile.username + ". One save for this game.";
      } catch (error) {
        blocked = true; report(error); retry.hidden = false; engine.pause(); throw error;
      } finally { pending = null; }
    })();
    return pending;
  }
  function changed(urgent) {
    generation++; dirty = true;
    if (urgent && !blocked && engine) persist().catch(report);
  }
  async function beforeLeave() {
    engine.pause();
    if (pending) await pending;
    if (dirty) await persist();
  }
  async function reset() {
    await beforeLeave();
    if (engine.getState().phase !== "ready" && !confirm("Start a new game and replace this save? Your leaderboard best will stay.")) return;
    blocked = false; engine.reset();
    container.querySelector("canvas").focus();
    await persist();
  }
  const create = snake ? loadSnakeGame : loadCircleHopGame;
  engine = create(container, false, {
    initialState: record && !fresh ? record.state : null,
    onChange: changed, onRequestNewGame: () => reset().catch(report)
  });
  status.textContent = profile ? (record && !fresh ? "Save restored for " + profile.username + "." : "Progress saves automatically for " + profile.username + ".")
    : "Guest game: progress and scores are not saved. Sign in before playing to save.";
  if (fresh) persist().catch(report);
  const autosave = setInterval(() => { if (dirty && !blocked) persist().catch(report); }, 1000);
  const pause = () => { engine.pause(); if (dirty && !blocked) persist().catch(report); };
  const visibility = () => { if (document.hidden) pause(); };
  window.addEventListener("blur", pause); document.addEventListener("visibilitychange", visibility);
  retry.addEventListener("click", () => { blocked = false; persist().catch(report); });
  return { beforeLeave, reset, pause, getState: () => engine.getState(), destroy() {
    clearInterval(autosave); engine.destroy(); window.removeEventListener("blur", pause); document.removeEventListener("visibilitychange", visibility);
  }};
}
