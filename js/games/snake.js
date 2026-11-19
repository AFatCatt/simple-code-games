
function loadSnakeGame(container, startImmediately = false) {
  // The shared page provides the canvas and controls; this function owns Snake state.
  const canvas = container.querySelector("#game-canvas");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  const box = 20;
  const size = canvas.width;
  const scoreDisplay = container.querySelector("#score-display");
  const message = container.querySelector("#announcement");
  const newGameButton = container.querySelector("#new-game-button");
  const pauseButton = container.querySelector("#pause-button");
  const stageMessage = container.querySelector("#stage-message");
  const gameState = container.querySelector("#game-state");

  let snake = [];
  let food = null;
  let dx = box;
  let dy = 0;
  let score = 0;
  let running = false;
  let paused = false;
  let timer = null;

  // Keep the text labels synchronized with the game's internal state.
  function setGameState(state) {
    if (gameState) {
      gameState.textContent = "Game state: " + state;
    }
  }

  function updateScore() {
    if (scoreDisplay) {
      scoreDisplay.textContent = "Score: " + score;
    }
  }

  function createFood() {
    // Food is placed on the movement grid and rerolled if it overlaps the snake.
    const maxIndex = size / box;
    do {
      food = {
        x: Math.floor(Math.random() * maxIndex) * box,
        y: Math.floor(Math.random() * maxIndex) * box,
      };
    } while (snake.some((segment) => segment.x === food.x && segment.y === food.y));
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

    context.fillStyle = "#f59e0b";
    context.fillRect(food.x, food.y, box, box);

    snake.forEach((segment, index) => {
      context.fillStyle = index === 0 ? "#34d399" : "#a7f3d0";
      context.fillRect(segment.x, segment.y, box, box);

      context.strokeStyle = "#0f172a";
      context.strokeRect(segment.x, segment.y, box, box);
    });
  }

  function endGame() {
    running = false;
    paused = false;
    clearInterval(timer);
    timer = null;

    if (message) {
      message.textContent = "Game over! Final score: " + score + ". Press New game to play again.";
    }

    if (stageMessage) stageMessage.hidden = false;
    if (pauseButton) {
      pauseButton.disabled = true;
      pauseButton.textContent = "Pause";
    }
    if (newGameButton) {
      newGameButton.textContent = "New game";
    }
    setGameState("game over");
  }

  function update() {
    if (!running) return;

    const head = {
      x: snake[0].x + dx,
      y: snake[0].y + dy,
    };

    const ateFood = head.x === food.x && head.y === food.y;

    // Check bounds and body contact before moving the head or changing the tail.
    if (
      head.x < 0 ||
      head.y < 0 ||
      head.x >= size ||
      head.y >= size ||
      snake.some((segment) => segment.x === head.x && segment.y === head.y)
    ) {
      endGame();
      return;
    }

    snake.unshift(head);

    if (ateFood) {
      score += 1;
      updateScore();
      createFood();
    } else {
      snake.pop();
    }

    draw();
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
    timer = setInterval(update, 120);
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
      return;
    }

    if (stageMessage) stageMessage.hidden = true;
    if (message) message.textContent = "Use the arrow keys to control the snake.";
    if (pauseButton) pauseButton.textContent = "Pause";
    setGameState("playing");
    timer = setInterval(update, 120);
  }

  function handleKey(event) {
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

    if (!running || paused || (nextDir.x === -dx && nextDir.y === -dy)) {
      return;
    }

    event.preventDefault();
    dx = nextDir.x;
    dy = nextDir.y;
  }

  if (newGameButton) {
    newGameButton.addEventListener("click", startGame);
  }

  if (pauseButton) {
    pauseButton.addEventListener("click", togglePause);
  }

  document.addEventListener("keydown", handleKey);

  updateScore();
  snake = [
    { x: 5 * box, y: 5 * box },
    { x: 4 * box, y: 5 * box },
    { x: 3 * box, y: 5 * box },
  ];
  createFood();
  draw();
  if (startImmediately) startGame();

  return function cleanup() {
    // Stop the timer and detach listeners if the game page is disposed.
    clearInterval(timer);
    if (newGameButton) {
      newGameButton.removeEventListener("click", startGame);
    }
    if (pauseButton) {
      pauseButton.removeEventListener("click", togglePause);
    }
    document.removeEventListener("keydown", handleKey);
  };
}
