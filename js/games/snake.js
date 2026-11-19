/* Bombs / obstacle variety and milestone speed update, 2026-11-19. */
/* Gameplay by Victoria Mason. Profile/save integration and edge-case fixes added 2026-11-19. */

function loadSnakeGame(container, startImmediately = false, options = {}) {
  // The shared page provides the canvas and controls; this function owns Snake state.
  const canvas = container.querySelector("#game-canvas");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  const box = 20;
  const stepMilliseconds = 140; // Slightly slower than the original 120 ms step.
  const size = canvas.width;
  const scoreDisplay = container.querySelector("#score-display");
  const message = container.querySelector("#announcement");
  const newGameButton = container.querySelector("#new-game-button");
  const pauseButton = container.querySelector("#pause-button");
  const stageMessage = container.querySelector("#stage-message");
  const gameState = container.querySelector("#game-state");

  let snake = [];
  let food = null;
  let bomb = null;
  let dx = box;
  let dy = 0;
  let score = 0;
  let running = false;
  let paused = false;
  let timer = null;
  let outcome = null;
  let turnPending = false;

  // Keep the text labels synchronized with the game's internal state.
  function setGameState(state) {
    if (gameState) {
      gameState.textContent = "Game state: " + state;
    }
  }

  function updateScore(note = "") {
    if (scoreDisplay) {
      scoreDisplay.textContent = "Score: " + score + " | Length: " + snake.length;
    }
    const bombNote = container.querySelector("#snake-bomb-note");
    if (bombNote) bombNote.textContent = note + (bomb
      ? "Black bomb active: trims 1–5 tail squares. Eat the apple first to clear it."
      : "Next bomb after apple " + ((Math.floor(score / 10) + 1) * 10) + ".");
  }

  function createFood() {
    // Select from free cells, including the full-board win case.
    const free = [];
    for (let y = 0; y < size; y += box) for (let x = 0; x < size; x += box) {
      if (!snake.some(segment => segment.x === x && segment.y === y)) free.push({ x, y });
    }
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function createBomb() {
    const free = [];
    for (let y = 0; y < size; y += box) for (let x = 0; x < size; x += box) {
      if (!snake.some(segment => segment.x === x && segment.y === y) &&
          !(food && food.x === x && food.y === y)) free.push({ x, y });
    }
    // A nearly full board can leave only the apple cell. Never replace it with a bomb.
    bomb = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function drawBoard() {
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, size, size);

    context.strokeStyle = "rgba(148, 163, 184, 0.18)";
    context.lineWidth = 1;

    for (let x = 0; x <= size; x += box) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, size);
      context.stroke();
    }

    for (let y = 0; y <= size; y += box) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(size, y);
      context.stroke();
    }
  }

  function draw() {
    drawBoard();

    if (food) {
      const x = food.x + 10, y = food.y + 11;
      context.fillStyle = "#ef4444";
      context.beginPath(); context.arc(x - 2, y, 6, 0, Math.PI * 2);
      context.arc(x + 2, y, 6, 0, Math.PI * 2); context.fill();
      context.strokeStyle = "#86efac"; context.lineWidth = 2;
      context.beginPath(); context.moveTo(x, y - 5); context.lineTo(x + 3, y - 9); context.stroke();
    }
    if (bomb) {
      const x = bomb.x + 10, y = bomb.y + 11;
      context.fillStyle = "#050505"; context.strokeStyle = "#cbd5e1"; context.lineWidth = 1.5;
      context.beginPath(); context.arc(x, y, 7, 0, Math.PI * 2); context.fill(); context.stroke();
      context.strokeStyle = "#fbbf24"; context.lineWidth = 2;
      context.beginPath(); context.moveTo(x + 2, y - 7); context.lineTo(x + 5, y - 10); context.stroke();
    }
    context.lineWidth = 1;

    snake.forEach((segment, index) => {
      context.fillStyle = index === 0 ? "#34d399" : "#a7f3d0";
      context.fillRect(segment.x, segment.y, box, box);

      context.strokeStyle = "#0f172a";
      context.strokeRect(segment.x, segment.y, box, box);
    });
  }

  function endGame(won = false) {
    outcome = won ? "won" : "over";
    running = false;
    paused = false;
    clearInterval(timer);
    timer = null;

    if (message) {
      message.textContent = (won ? "Board complete! Final score: " : "Game over! Final score: ") + score + ". Press New game to play again.";
    }

    if (stageMessage) stageMessage.hidden = false;
    if (pauseButton) {
      pauseButton.disabled = true;
      pauseButton.textContent = "Pause";
    }
    if (newGameButton) {
      newGameButton.textContent = "New game";
    }
    setGameState(won ? "won" : "game over");
    options.onChange?.(true);
  }

  function update() {
    if (!running || paused) return;
    turnPending = false;

    const head = {
      x: (snake[0].x + dx + size) % size,
      y: (snake[0].y + dy + size) % size,
    };

    const ateFood = food && head.x === food.x && head.y === food.y;
    const body = ateFood ? snake : snake.slice(0, -1);

    // Wrap first, then check the destination for body contact.
    if (
      body.some((segment) => segment.x === head.x && segment.y === head.y)
    ) {
      endGame();
      return;
    }

    snake.unshift(head);

    if (ateFood) {
      score += 1;
      bomb = null; // Taking the apple clears any uneaten bomb.
      createFood();
      if (score % 10 === 0 && food) createBomb();
      updateScore();
      if (!food) { draw(); endGame(true); return; }
    } else {
      snake.pop();
      if (bomb && head.x === bomb.x && head.y === bomb.y) {
        const removed = Math.min(1 + Math.floor(Math.random() * 5), snake.length - 3);
        snake.splice(snake.length - removed, removed);
        bomb = null;
        // Score counts apples, so shortening the tail never subtracts earned points.
        updateScore("Bomb trimmed " + removed + " tail square" + (removed === 1 ? "" : "s") + ". ");
      }
    }

    draw();
    options.onChange?.(false);
  }

  function startGame() {
    // Clear any previous tick before resetting the board, preventing duplicate loops.
    clearInterval(timer);

    snake = [
      { x: 5 * box, y: 5 * box },
      { x: 4 * box, y: 5 * box },
      { x: 3 * box, y: 5 * box },
    ];

    dx = box;
    dy = 0;
    score = 0;
    bomb = null;
    outcome = null; turnPending = false;
    updateScore();
    running = true;
    paused = false;

    if (message) {
      message.textContent = "Use the arrow keys to control the snake.";
    }
    if (stageMessage) stageMessage.hidden = true;
    if (pauseButton) {
      pauseButton.disabled = false;
      pauseButton.textContent = "Pause";
    }

    if (newGameButton) {
      newGameButton.textContent = "New game";
    }

    setGameState("playing");
    createFood();
    draw();
    timer = setInterval(update, stepMilliseconds);
    options.onChange?.(true);
  }

  function togglePause() {
    if (!running) return;

    paused = !paused;
    if (paused) {
      clearInterval(timer);
      timer = null;
      if (message) message.textContent = "Game paused.";
      if (stageMessage) stageMessage.hidden = false;
      if (pauseButton) pauseButton.textContent = "Resume";
      setGameState("paused");
      options.onChange?.(true);
      return;
    }

    if (stageMessage) stageMessage.hidden = true;
    if (message) message.textContent = "Use the arrow keys to control the snake.";
    if (pauseButton) pauseButton.textContent = "Pause";
    setGameState("playing");
    timer = setInterval(update, stepMilliseconds);
    options.onChange?.(true);
  }

  function handleKey(event) {
    if (document.querySelector("dialog[open]") || event.target.closest?.("input, textarea, select, [contenteditable=true]")) return;
    // Ignore reverse turns so the snake cannot immediately collide with its own neck.
    const nextDir = {
      ArrowUp: { x: 0, y: -box },
      ArrowDown: { x: 0, y: box },
      ArrowLeft: { x: -box, y: 0 },
      ArrowRight: { x: box, y: 0 },
    }[event.key];

    if (!nextDir) {
      return;
    }

    if (running && !paused) event.preventDefault();
    if (!running || paused || turnPending || (nextDir.x === -dx && nextDir.y === -dy)) {
      return;
    }

    event.preventDefault();
    dx = nextDir.x;
    dy = nextDir.y;
    turnPending = true;
    options.onChange?.(false);
  }

  const requestNewGame = () => options.onRequestNewGame ? options.onRequestNewGame() : startGame();
  if (newGameButton) {
    newGameButton.addEventListener("click", requestNewGame);
  }

  if (pauseButton) {
    pauseButton.addEventListener("click", togglePause);
  }

  document.addEventListener("keydown", handleKey);

  snake = [
    { x: 5 * box, y: 5 * box },
    { x: 4 * box, y: 5 * box },
    { x: 3 * box, y: 5 * box },
  ];
  updateScore();
  createFood();
  draw();
  if (options.initialState) {
    const saved = options.initialState;
    snake = saved.snake.map(segment => ({ ...segment }));
    food = saved.food ? { ...saved.food } : null;
    bomb = saved.version >= 2 && saved.bomb ? { ...saved.bomb } : null;
    dx = saved.dx; dy = saved.dy; score = saved.score; turnPending = Boolean(saved.turnPending);
    outcome = ["over", "won"].includes(saved.phase) ? saved.phase : null;
    running = ["playing", "paused"].includes(saved.phase); paused = running;
    updateScore(); draw();
    if (message) message.textContent = outcome ? "Saved game finished. Press New game to play again." : (running ? "Saved game restored. Click Resume when ready." : "Press Start game to begin.");
    if (stageMessage) stageMessage.hidden = false;
    if (pauseButton) { pauseButton.disabled = !running; pauseButton.textContent = running ? "Resume" : "Pause"; }
    if (newGameButton) newGameButton.textContent = saved.phase === "ready" ? "Start game" : "New game";
    setGameState(outcome || (running ? "paused" : "ready"));
  } else if (startImmediately) startGame();
  else { if (message) message.textContent = "Press Start game to begin. Use the arrow keys to move."; setGameState("ready"); }

  function getState() {
    return { version: 2, game: "snake", snake: snake.map(segment => ({ ...segment })), food: food ? { ...food } : null,
      bomb: bomb ? { ...bomb } : null,
      dx, dy, score, turnPending, phase: outcome || (running ? (paused ? "paused" : "playing") : "ready") };
  }

  function cleanup() {
    // Stop the timer and detach listeners if the game page is disposed.
    clearInterval(timer);
    if (newGameButton) {
      newGameButton.removeEventListener("click", requestNewGame);
    }
    if (pauseButton) {
      pauseButton.removeEventListener("click", togglePause);
    }
    document.removeEventListener("keydown", handleKey);
  }
  return { getState, reset: startGame, pause: () => { if (running && !paused) togglePause(); },
    resume: () => { if (running && paused) togglePause(); }, destroy: cleanup };
}

