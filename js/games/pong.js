/* Original Pong gameplay created independently by Victoria Mason.
   Adapted for shared saves, completed paddle/ball wiring, and online play. */
function loadPongGame(container, startImmediately = false, options = {}) {
  const canvas = container.querySelector('#game-canvas');
  const context = canvas?.getContext('2d');
  if (!context) throw new Error('Pong could not open its canvas.');
  const find = id => container.querySelector('#' + id);
  const scoreDisplay = find('score-display'), stateDisplay = find('game-state');
  const newGameButton = find('new-game-button'), pauseButton = find('pause-button');
  const stageMessage = find('stage-message'), announcement = find('announcement'), stageCopy = find('stage-copy');
  const paddleWidth = 14, paddleHeight = 82, paddleSpeed = 320, keys = new Set();
  const multiplayer = Boolean(options.multiplayer), guest = options.multiplayer === 'guest';
  const player = { x: 20, y: canvas.height / 2 - paddleHeight / 2 };
  const computer = { x: canvas.width - 20 - paddleWidth, y: player.y };
  let playerScore = 0, computerScore = 0, phase = 'ready';
  let playerStreak = options.initialStreak || 0, computerStreak = 0;
  let bestStreak = Math.max(playerStreak, options.initialBest || 0), opponentBestStreak = 0;
  let goalPending = false, matchNumber = 0;
  let ball = makeBall(1), animationId = null, previousTime = null, destroyed = false;
  let remoteDirection = 0, touchDirection = 0, viewAnimationId = null;
  let viewFrom = null, viewCurrent = null, viewAt = 0;
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const listeners = [];
  function listen(node, type, fn, settings) { node.addEventListener(type, fn, settings); listeners.push(() => node.removeEventListener(type, fn, settings)); }
  function makeBall(direction) {
    return { x: canvas.width / 2 - 5, y: canvas.height / 2 - 5, size: 10,
      dx: direction * 220, dy: (Math.random() > 0.5 ? 1 : -1) * 120, hits: 0 };
  }
  function resetBall(direction) { ball = makeBall(direction); }
  function setPhase(nextPhase) {
    phase = nextPhase;
    setText(stateDisplay, 'Game state: ' + phase);
    pauseButton.disabled = !['playing', 'paused'].includes(phase) || (guest && phase === 'paused');
    setText(pauseButton, phase === 'paused' ? (guest ? 'Host resumes' : 'Resume') : 'Pause');
  }
  const streakDisplay = find('pong-streak');
  function updateScore() {
    if (streakDisplay) setText(streakDisplay, multiplayer
      ? `Goal streaks: ${options.playerName}: ${playerStreak} | ${options.opponentName}: ${computerStreak} · Best: ${bestStreak} / ${opponentBestStreak}`
      : `Goal streak: ${playerStreak} | Best streak: ${bestStreak}`);
    setText(scoreDisplay, `${options.playerName || 'Player'}: ${playerScore} | ${options.opponentName || 'Computer'}: ${computerScore}`);
  }
  function showMessage(title, copy) { setText(announcement, title); setText(stageCopy, copy); stageMessage.hidden = false; }
  function draw() {
    let picture = { playerY: player.y, computerY: computer.y, x: ball.x, y: ball.y };
    if (guest && viewFrom && phase === 'playing') {
      const fraction = Math.min(1, Math.max(0, (performance.now() - viewAt) / 50));
      for (const key of Object.keys(picture)) picture[key] = viewFrom[key] + (picture[key] - viewFrom[key]) * fraction;
    }
    viewCurrent = picture;
    context.fillStyle = '#0b1220'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(255,255,255,.35)';
    for (let y = 10; y < canvas.height; y += 30) context.fillRect(canvas.width / 2 - 2, y, 4, 16);
    context.fillStyle = '#ffffff';
    context.fillRect(0, canvas.height / 4, 4, canvas.height / 2);
    context.fillRect(canvas.width - 4, canvas.height / 4, 4, canvas.height / 2);
    context.fillStyle = '#34d399'; context.fillRect(player.x, picture.playerY, paddleWidth, paddleHeight);
    context.fillStyle = '#ffffff'; context.fillRect(computer.x, picture.computerY, paddleWidth, paddleHeight);
    context.fillStyle = '#fbbf24'; context.fillRect(picture.x, picture.y, ball.size, ball.size);
  }
  function direction() { return touchDirection || (Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'))); }
  function sendInput() { if (guest) options.onInput?.(direction()); }
  function clearInput() { keys.clear(); touchDirection = 0; sendInput(); }
  const clampPaddle = y => Math.max(0, Math.min(canvas.height - paddleHeight, y));
  function advance(delta) {
    player.y = clampPaddle(player.y + direction() * paddleSpeed * delta);
    if (multiplayer) computer.y = clampPaddle(computer.y + remoteDirection * paddleSpeed * delta);
    else {
      const gap = ball.y + ball.size / 2 - (computer.y + paddleHeight / 2);
      computer.y = clampPaddle(computer.y + Math.sign(gap) * Math.min(Math.abs(gap), paddleSpeed * 0.7 * delta));
    }
    moveBall(delta);
  }
  function moveVertical(seconds) {
    const limit = canvas.height - ball.size, speed = Math.abs(ball.dy);
    const position = ((ball.dy >= 0 ? ball.y : 2 * limit - ball.y) + speed * seconds) % (2 * limit);
    ball.y = position <= limit ? position : 2 * limit - position;
    ball.dy = position < limit ? speed : -speed;
  }
  function paddleHit(paddle, direction) {
    ball.dx = direction * Math.abs(ball.dx) * PONG_SPEED_MULTIPLIER;
ball.dy *= PONG_SPEED_MULTIPLIER;
ball.hits++;
  }
  function moveBall(seconds) {
    // Swept collisions find the next horizontal boundary instead of stepping
    // past a paddle. Vertical wall bounces are folded mathematically.
    let remaining = seconds;
    for (let events = 0; remaining > 0 && phase === 'playing' && events < 64; events++) {
      const right = ball.dx > 0, wall = right ? canvas.width - ball.size : 0;
      let paddle = null, boundary = wall;
      for (const candidate of [player, computer]) {
        const face = right ? candidate.x - ball.size : candidate.x + paddleWidth;
        if (right ? ball.x <= face && face < boundary : ball.x >= face && face > boundary) {
          paddle = candidate; boundary = face;
        }
      }
      const until = Math.max(0, (boundary - ball.x) / ball.dx);
      if (until > remaining) { ball.x += ball.dx * remaining; moveVertical(remaining); return; }
      ball.x = boundary; moveVertical(until); remaining -= until;
      if (paddle) {
        if (ball.y < paddle.y + paddleHeight && ball.y + ball.size > paddle.y) paddleHit(paddle, right ? -1 : 1);
        else ball.x += right ? 1e-7 : -1e-7;
      } else if (ball.y >= canvas.height / 4 && ball.y + ball.size <= canvas.height * 3 / 4) {
        goal(right); return;
      } else {
  ball.dx = -ball.dx;

  // A back-wall bounce removes one paddle hit's speed increase.
  if (ball.hits > 0) {
    ball.dx /= PONG_SPEED_MULTIPLIER;
    ball.dy /= PONG_SPEED_MULTIPLIER;
    ball.hits--;
  }
}
    }
  }
  function goal(playerPoint) {
    if (playerPoint) {
      playerScore++; playerStreak = Math.min(1e9, playerStreak + 1); computerStreak = 0;
      bestStreak = Math.max(bestStreak, playerStreak);
    } else {
      computerScore++; computerStreak = Math.min(1e9, computerStreak + 1); playerStreak = 0;
      opponentBestStreak = Math.max(opponentBestStreak, computerStreak);
    }
    resetBall(playerPoint ? -1 : 1); updateScore();
    if (playerScore >= 10 || computerScore >= 10) endGame();
    if (options.onGoal) {
      goalPending = true;
      if (phase !== 'over') { setPhase('scoring'); showMessage('Goal!', 'Saving this goal to both players’ streaks...'); }
      options.onGoal({ match: matchNumber, number: playerScore + computerScore, winner: playerPoint ? 'host' : 'guest' });
    }
    options.onChange?.(true);
  }

  function loop(timestamp) {
    animationId = null;
    if (destroyed || phase !== 'playing' || guest) return;
    let delta = previousTime === null ? 0 : Math.min((timestamp - previousTime) / 1000, 0.05);
    previousTime = timestamp;
    // Small steps keep a fast ball from passing through a paddle.
    while (delta > 0 && phase === 'playing') { const step = Math.min(delta, 1 / 120); advance(step); delta -= step; }
    draw(); options.onChange?.(false);
    if (phase === 'playing') animationId = requestAnimationFrame(loop);
  }
  function stopLoop() { if (animationId !== null) cancelAnimationFrame(animationId); animationId = null; previousTime = null; }
  function startGame() {
    if (destroyed || guest || goalPending || (options.canPlay && !options.canPlay())) return;
    if (phase !== 'over' && phase !== 'ready') playerStreak = computerStreak = 0;
    stopLoop(); clearInput(); remoteDirection = 0; matchNumber++;
    player.y = computer.y = canvas.height / 2 - paddleHeight / 2;
    playerScore = computerScore = 0; resetBall(Math.random() > 0.5 ? 1 : -1);
    updateScore(); stageMessage.hidden = true; newGameButton.textContent = 'Restart match'; setPhase('playing'); draw();
    animationId = requestAnimationFrame(loop); options.onChange?.(true);
  }
  function endGame() {
    stopLoop(); clearInput(); setPhase('over'); newGameButton.textContent = 'Next match';
    const winner = playerScore === 10 ? (options.playerName || 'You') : (options.opponentName || 'Computer');
    showMessage(winner + (winner === 'You' ? ' win!' : ' wins!'), `Final score: ${playerScore} to ${computerScore}. Next match keeps your consecutive-goal streak.`);
  }
  function pause() {
    clearInput();
    if (!['playing', 'scoring'].includes(phase)) return;
    if (guest) { setPhase('paused'); showMessage('Pause requested', 'Waiting for the host.'); options.onPauseRequest?.(); return; }
    stopLoop(); remoteDirection = 0; setPhase('paused'); showMessage('Paused', multiplayer ? 'The host can resume when both players are connected.' : 'Press Escape or Resume when ready.');
    options.onChange?.(true);
  }
  function resume() {
    if (guest || destroyed || goalPending || phase !== 'paused' || (options.canPlay && !options.canPlay())) return;
    stageMessage.hidden = true; previousTime = null; setPhase('playing'); animationId = requestAnimationFrame(loop); options.onChange?.(true);
  }
  function togglePause() { if (phase === 'playing') pause(); else resume(); }
  function handleKeyDown(event) {
    if (destroyed || document.querySelector('dialog[open]') || event.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); keys.add(event.key); sendInput(); }
    else if (event.key === 'Escape' && !event.repeat) { event.preventDefault(); togglePause(); }
  }
  const requestNewGame = () => options.onRequestNewGame ? options.onRequestNewGame() : startGame();
  listen(newGameButton, 'click', requestNewGame); listen(pauseButton, 'click', togglePause);
  listen(document, 'keydown', handleKeyDown); listen(document, 'keyup', event => { keys.delete(event.key); sendInput(); });
  listen(window, 'blur', clearInput);
  // Optional touch controls share the same movement speed as the keyboard.
  container.querySelectorAll('[data-pong-direction]').forEach(button => {
    listen(button, 'pointerdown', event => { event.preventDefault(); touchDirection = Number(button.dataset.pongDirection); button.setPointerCapture?.(event.pointerId); sendInput(); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, event, () => { touchDirection = 0; sendInput(); });
    listen(button, 'keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); touchDirection = Number(button.dataset.pongDirection); sendInput(); } });
    listen(button, 'keyup', e => { if (e.key === ' ' || e.key === 'Enter') { touchDirection = 0; sendInput(); } });
  });
  function getState() { return { version: 2, game: 'pong', phase, score: bestStreak, playerStreak, computerStreak, bestStreak, opponentBestStreak, matchNumber, playerScore, computerScore, playerY: player.y, computerY: computer.y, ball: { ...ball } }; }
  function applyState(state, live = false) {
    if (!CanvasSaves.valid('pong', state)) throw new Error('This Pong save is incompatible.');
    if (state.version === 1) {
      state = { ...state, version: 2, score: 0, playerStreak: 0, computerStreak: 0, bestStreak: 0, opponentBestStreak: 0, matchNumber: 0,
        ball: { ...state.ball, dx: Math.sign(state.ball.dx) * 220, dy: Math.sign(state.ball.dy) * 120, hits: 0 } };
    }
    playerStreak = state.playerStreak; computerStreak = state.computerStreak;
    bestStreak = Math.max(state.bestStreak, options.initialBest || 0); opponentBestStreak = state.opponentBestStreak; matchNumber = state.matchNumber;
    // Only interpolate the guest's view, never authoritative physics or scores.
    const sameRally = playerScore === state.playerScore && computerScore === state.computerScore && phase === state.phase;
    viewFrom = live && guest && sameRally ? viewCurrent : null; viewAt = performance.now();
    stopLoop(); playerScore = state.playerScore; computerScore = state.computerScore;
    player.y = state.playerY; computer.y = state.computerY; ball = { ...state.ball };
    setPhase(!live && ['playing','scoring'].includes(state.phase) ? 'paused' : state.phase);
    updateScore(); stageMessage.hidden = phase === 'playing';
    if (phase === 'over') endGame();
    else if (phase === 'paused') showMessage('Paused', guest ? 'Waiting for the host to resume.' : 'Your match is restored. Press Resume when ready.');
    else if (phase === 'scoring') showMessage('Goal!', 'Saving the goal...');
    else if (phase === 'ready') showMessage(guest ? 'Waiting for the host' : 'Press Start game', 'First to 10 wins.');
    draw();
  }
  updateScore(); setPhase('ready'); showMessage(guest ? 'Waiting for the host' : 'Press Start game', 'Move your paddle with Up and Down arrows or the on-screen controls.'); draw();
  if (options.initialState) applyState(options.initialState);
  else if (startImmediately) startGame();
  if (guest) {
    newGameButton.hidden = true;
    const paint = () => { if (destroyed) return; draw(); viewAnimationId = requestAnimationFrame(paint); };
    viewAnimationId = requestAnimationFrame(paint);
  }
  function acceptMatch(data, { fresh = false, restore = false } = {}) {
    const previousPhase = phase;
    goalPending = false;
    playerStreak = data.hostStreak; computerStreak = data.guestStreak;
    bestStreak = data.hostBest; opponentBestStreak = data.guestBest;
    if (fresh) {
      stopLoop(); clearInput(); remoteDirection = 0;
      player.y = computer.y = canvas.height / 2 - paddleHeight / 2;
      resetBall(Math.random() > 0.5 ? 1 : -1);
      setPhase('paused'); showMessage('Ready', 'The host can resume when both players are connected.');
      newGameButton.textContent = 'Next match';
    }
    matchNumber = data.match;
    playerScore = data.hostPoints; computerScore = data.guestPoints;
    if (restore) {
      stopLoop(); resetBall(1); setPhase(data.match ? 'paused' : 'ready');
      showMessage(data.match ? 'Match restored' : guest ? 'Waiting for the host' : 'Ready to play',
        data.match ? 'The host can resume. Confirmed scores and streaks are kept.' : 'First to 10. The host selects Start match when both players are connected.');
    }
    if (playerScore === 10 || computerScore === 10) endGame();
    else if (fresh || (!restore && previousPhase === 'scoring')) { setPhase('paused'); resume(); }
    updateScore(); draw(); options.onChange?.(true);
  }
  return { getState, reset: startGame, pause, resume, applyState, acceptMatch,
    setRemoteInput(value) { remoteDirection = [-1, 0, 1].includes(value) ? value : 0; },
    destroy() { destroyed = true; stopLoop(); if (viewAnimationId !== null) cancelAnimationFrame(viewAnimationId); clearInput(); listeners.forEach(remove => remove()); }
  };
}
