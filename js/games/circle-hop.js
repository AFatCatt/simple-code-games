/* Gameplay by Victoria Mason. Profile/save integration added 2026-11-19. */
window.loadCircleHopGame = function (container, startImmediately = false, options = {}) {
  // Resolve the shared page elements once so the animation loop can update them.
  const canvas = container.querySelector("#game-canvas");
  if (!canvas) {
    throw new Error("Circle Hop canvas element not found");
  }

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Circle Hop could not get a 2D canvas context");
  }

  const scoreDisplay = container.querySelector("#score-display");
  const pauseButton = container.querySelector("#pause-button");
  const newGameButton = container.querySelector("#new-game-button");
  const stateDisplay = container.querySelector("#game-state");
  const stageMessage = container.querySelector("#stage-message");
  const announcement = container.querySelector("#announcement");
  const stageCopy = container.querySelector("#stage-copy");
  const groundY = canvas.height - 35;
  const player = { x: 72, y: groundY - 17, radius: 17, velocityY: 0 };

  let state = "ready";
  let score = 0;
  let speed = 220;
  let obstacles = [];
  let spawnCountdown = 0;
  let previousTime = 0;
  let animationId = null;

  // Update the visible state and make Pause available only while it can be used.
  function setState(nextState) {
    state = nextState;
    if (stateDisplay) stateDisplay.textContent = "Game state: " + nextState;
    if (pauseButton) {
      pauseButton.textContent = state === "paused" ? "Resume" : "Pause";
      pauseButton.disabled = state !== "playing" && state !== "paused";
    }
  }

  function draw() {
    context.fillStyle = "#162333";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#dce6ee";
    context.fillRect(0, groundY, canvas.width, 3);

    context.fillStyle = "#f59e0b";
    obstacles.forEach((obstacle) => {
      context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });

    context.beginPath();
    context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    context.fillStyle = "#34d399";
    context.fill();
  }

  function showMessage(title, copy) {
    if (announcement) announcement.textContent = title;
    if (stageCopy) stageCopy.textContent = copy;
    if (stageMessage) stageMessage.hidden = false;
  }

  function startGame() {
    // A restart replaces the old frame loop and resets the run's physics and score.
    if (animationId !== null) cancelAnimationFrame(animationId);
    score = 0;
    speed = 220;
    obstacles = [];
    spawnCountdown = 0.9;
    previousTime = 0;
    player.y = groundY - player.radius;
    player.velocityY = 0;
    if (scoreDisplay) scoreDisplay.textContent = "Score: 0";
    if (stageMessage) stageMessage.hidden = true;
    setState("playing");
    animationId = requestAnimationFrame(loop);
    if (newGameButton) newGameButton.textContent = "New game";
    options.onChange?.(true);
  }

  function endGame() {
    if (animationId !== null) cancelAnimationFrame(animationId);
    animationId = null;
    setState("over");
    showMessage("Game over!", "Score: " + Math.floor(score) + ". Press New game to try again.");
    options.onChange?.(true);
  }

  function jump() {
    if (state === "ready") { requestNewGame(); return; }
    if (state !== "playing" || player.y < groundY - player.radius) return;
    player.velocityY = -520;
    options.onChange?.(false);
  }

  function collides(obstacle) {
    // Find the closest point on the obstacle rectangle to the circle's center.
    const closestX = Math.max(obstacle.x, Math.min(player.x, obstacle.x + obstacle.width));
    const closestY = Math.max(obstacle.y, Math.min(player.y, groundY));
    const offsetX = player.x - closestX;
    const offsetY = player.y - closestY;
    return offsetX * offsetX + offsetY * offsetY < player.radius * player.radius;
  }

  function loop(timestamp) {
    if (state !== "playing") return;
    // Time-based movement keeps the game speed consistent across display refresh rates.
    const delta = previousTime ? Math.min((timestamp - previousTime) / 1000, 0.05) : 0;
    previousTime = timestamp;

    player.velocityY += 1500 * delta;
    player.y = Math.min(player.y + player.velocityY * delta, groundY - player.radius);
    if (player.y === groundY - player.radius) player.velocityY = 0;

    spawnCountdown -= delta;
    if (spawnCountdown <= 0) {
      const height = 24 + Math.random() * 32;
      const width = 18 + Math.random() * 14;
      obstacles.push({
        x: canvas.width,
        y: groundY - height,
        width,
        height,
      });
      spawnCountdown = 1 + Math.random() * 0.8;
    }

    obstacles.forEach((obstacle) => {
      obstacle.x -= speed * delta;
    });
    obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > 0);

    score += delta * 10;
    speed = Math.min(360, 220 + score * 1.5);
    if (scoreDisplay) scoreDisplay.textContent = "Score: " + Math.floor(score);

    if (obstacles.some(collides)) {
      endGame();
    }

    draw();
    options.onChange?.(false);
    if (state === "playing") animationId = requestAnimationFrame(loop);
  }

  function togglePause() {
    if (state === "playing") {
      if (animationId !== null) cancelAnimationFrame(animationId);
      animationId = null;
      setState("paused");
      showMessage("Paused", "Click Resume or press Escape to continue.");
    } else if (state === "paused") {
      if (stageMessage) stageMessage.hidden = true;
      previousTime = 0;
      setState("playing");
      animationId = requestAnimationFrame(loop);
    }
    options.onChange?.(true);
  }

  function handleKeyDown(event) {
    if (document.querySelector("dialog[open]") || event.target.closest?.("input, textarea, select, [contenteditable=true]")) return;
    // Space and Up jump; Escape pauses or resumes without requiring a button click.
    if (event.code === "Space" || event.key === "ArrowUp") {
      if (state === "ready" || state === "playing") {
        event.preventDefault();
        jump();
      }
    } else if (event.key === "Escape" && (state === "playing" || state === "paused")) {
      togglePause();
    }
  }

  function handleCanvasClick() {
    jump();
  }

  const requestNewGame = () => options.onRequestNewGame ? options.onRequestNewGame() : startGame();
  newGameButton?.addEventListener("click", requestNewGame);
  pauseButton?.addEventListener("click", togglePause);
  canvas.addEventListener("click", handleCanvasClick);
  document.addEventListener("keydown", handleKeyDown);

  if (scoreDisplay) scoreDisplay.textContent = "Score: 0";
  showMessage("Press New game to start.", "Jump with Space, Up arrow, or a click/tap on the game board.");
  setState("ready");
  draw();
  if (options.initialState) {
    const saved = options.initialState;
    score = saved.score; speed = saved.speed; spawnCountdown = saved.spawnCountdown;
    player.y = saved.playerY; player.velocityY = saved.velocityY;
    obstacles = saved.obstacles.map(obstacle => ({ ...obstacle }));
    if (scoreDisplay) scoreDisplay.textContent = "Score: " + Math.floor(score);
    setState(["playing", "paused"].includes(saved.phase) ? "paused" : saved.phase);
    showMessage(state === "over" ? "Saved game finished" : "Saved game restored",
      state === "paused" ? "Click Resume when ready." : "Press New game to play.");
    if (newGameButton) newGameButton.textContent = state === "ready" ? "Start game" : "New game";
    draw();
  } else if (startImmediately) startGame();

  function getState() {
    return { version: 1, game: "circle-hop", phase: state, score, speed, spawnCountdown,
      playerY: player.y, velocityY: player.velocityY, obstacles: obstacles.map(obstacle => ({ ...obstacle })) };
  }

  function cleanup() {
    // Remove the animation and listeners if this game view is ever unloaded.
    if (animationId !== null) cancelAnimationFrame(animationId);
    newGameButton?.removeEventListener("click", requestNewGame);
    pauseButton?.removeEventListener("click", togglePause);
    canvas.removeEventListener("click", handleCanvasClick);
    document.removeEventListener("keydown", handleKeyDown);
  }
  return { getState, reset: startGame, pause: () => { if (state === "playing") togglePause(); },
    resume: () => { if (state === "paused") togglePause(); }, destroy: cleanup };
};

