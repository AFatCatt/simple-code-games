/* Online adapter for Victoria Mason's Pong. The host runs the shared game engine.
   Private, role-specific channels carry state and input; no frame writes to SQL. */
function createPongLive(container, room, profile) {
  const client = ArcadeOnline.requireClient(), host = room.role === 'host';
  container.innerHTML = `<p id="pong-connection" role="status">Connecting both players...</p>
    <div class="canvas-controls"><strong id="score-display"></strong>
      <button id="pause-button" class="button compact" type="button" disabled>Pause</button>
      <button id="new-game-button" class="button compact" type="button" disabled>Start match</button></div>
    <p id="pong-streak" class="small"></p>
    <p id="pong-score-sync" class="small" role="status">Loading saved online streaks...</p>
    <button id="pong-score-retry" class="button compact" type="button" hidden>Retry score sync</button>
    <canvas id="game-canvas" width="640" height="360" tabindex="0" aria-label="Pong online game board"></canvas>
    <div class="pong-touch"><button class="button" type="button" data-pong-direction="-1" aria-label="Move paddle up">Up</button><button class="button" type="button" data-pong-direction="1" aria-label="Move paddle down">Down</button></div>
    <div id="stage-message" class="canvas-message" role="status"><strong id="announcement"></strong><p id="stage-copy"></p></div>
    <p id="game-state" class="small"></p>`;
  const status = container.querySelector('#pong-connection'), start = container.querySelector('#new-game-button');
  let engine, channels = [], subscribed = new Set(), generation = 0, stopped = false;
  let input = 0, peerSeen = 0, peerVisible = false, lastSent = 0, sequence = 0, received = -1;
  let peerSession = null, retiredSessions = new Set(), sendPending = false, queuedSend = false;
  const session = crypto.randomUUID();
  const syncStatus = container.querySelector('#pong-score-sync'), retry = container.querySelector('#pong-score-retry');
  const outboxKey = 'simple-code-games:pong-pending:' + profile.id + ':' + room.id;
  let dbReady = false, busyScore = false, scoreOperation = null, pendingEvent = null;
  if (host) {
    try {
      const saved = JSON.parse(localStorage.getItem(outboxKey));
      if (saved && ['start','goal'].includes(saved.p_action) && Number.isInteger(saved.p_match)) pendingEvent = saved;
    } catch { /* Invalid optional recovery data is not submitted. */ }
  }
  function rememberEvent() {
    try { if (pendingEvent) localStorage.setItem(outboxKey, JSON.stringify(pendingEvent)); else localStorage.removeItem(outboxKey); }
    catch { /* The goal still syncs immediately; only reload recovery is unavailable. */ }
  }
  function validMatch(data) {
    const integer = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
    return data && integer(data.match, 1000000) && integer(data.hostPoints, 10) && integer(data.guestPoints, 10) &&
      !(data.hostPoints === 10 && data.guestPoints === 10) &&
      ['hostStreak','guestStreak','hostBest','guestBest'].every(key => integer(data[key], 1e9)) &&
      data.hostBest >= data.hostStreak && data.guestBest >= data.guestStreak;
  }
  async function matchRPC(event) {
    let timeout;
    try {
      const response = await Promise.race([
        client.rpc('arcade_pong_match', { ...event, p_expected_profile: profile.id, p_room: room.id }),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Score sync timed out. Retry safely.')), 12000); })
      ]);
      if (response.error) throw response.error;
      if (!validMatch(response.data)) throw new Error('Invalid match response. Refresh the page.');
      return response.data;
    } finally { clearTimeout(timeout); }
  }
  function scoreError(error) {
    if (stopped) return;
    engine.pause();
    syncStatus.textContent = ['PGRST202','42883','42703'].includes(error.code)
      ? 'Leaderboard setup needs supabase/05-ranked-multiplayer.sql. Keep this tab open, then Retry score sync.'
      : (error.message || 'Score sync failed.') + ' Play is paused. Retry score sync before continuing.';
    retry.hidden = false; checkConnection();
  }
  function syncMatch() {
    if (scoreOperation) return scoreOperation;
    const event = pendingEvent;
    busyScore = true; retry.hidden = true;
    scoreOperation = (async () => {
      try {
        const data = await matchRPC(event || { p_action: 'state' });
        if (stopped || Profiles.active()?.id !== profile.id) return;
        const recovering = !dbReady;
        dbReady = true; busyScore = false;
        if (event) { pendingEvent = null; rememberEvent(); }
        engine.acceptMatch(data, { fresh: event?.p_action === 'start', restore: !event || (recovering && event.p_action === 'goal') });
        syncStatus.textContent = 'Online streaks synced. Your best counts on the Pong and Overall leaderboards.';
        send(true);
      } catch (error) { busyScore = false; scoreError(error); throw error; }
      finally { scoreOperation = null; checkConnection(); }
    })();
    checkConnection(); return scoreOperation;
  }
  function queueEvent(event) {
    if (pendingEvent || busyScore) return;
    pendingEvent = event; rememberEvent();
    syncStatus.textContent = event.p_action === 'goal' ? 'Saving goal for both players...' : 'Starting next match...';
    syncMatch().catch(() => {});
  }
  retry.addEventListener('click', () => syncMatch().catch(() => {}));
  const text = message => { if (status.textContent !== message) status.textContent = message; };
  function ready() { return !stopped && subscribed.size === 2 && peerSeen > 0 && Date.now() - peerSeen < 3000 && peerVisible && !document.hidden && Profiles.active()?.id === profile.id; }
  function checkConnection() {
    const connected = ready();
    start.disabled = !host || !connected || !dbReady || busyScore || Boolean(pendingEvent) || !['ready','over'].includes(engine?.getState().phase);
    if (!connected) engine?.pause();
    text(connected ? (host ? 'Both players connected. You control the left paddle.' : 'Both players connected. You control the right paddle.')
      : subscribed.size === 2 ? 'Waiting for the other player’s game tab. Play pauses when either player disconnects or hides the tab.'
      : 'Connecting to live play. If this persists, use Refresh connection and check the Pong Supabase setup.');
    return connected;
  }
  async function send(force = false) {
    if (stopped || subscribed.size !== 2 || !engine || Profiles.active()?.id !== profile.id) return;
    if (sendPending) { if (force) queuedSend = true; return; }
    const now = Date.now(), playing = engine.getState().phase === 'playing';
    if (!force && now - lastSent < (host && playing ? 50 : 750)) return;
    lastSent = now; sendPending = true; const epoch = generation;
    const payload = { session, seq: ++sequence, visible: !document.hidden };
    if (host) payload.state = engine.getState();
    else { payload.direction = document.hidden ? 0 : input; payload.pause = pauseRequested; }
    try {
      const result = await channels[host ? 0 : 1].send({ type: 'broadcast', event: 'frame', payload });
      if (epoch !== generation || stopped) return;
      if (result !== 'ok') { peerSeen = 0; checkConnection(); }
      else if (!host && payload.pause) pauseRequested = false;
    } catch { if (epoch === generation && !stopped) { peerSeen = 0; checkConnection(); } }
    finally { if (epoch === generation) { sendPending = false; if (queuedSend && !stopped) { queuedSend = false; send(true); } } }
  }
  let pauseRequested = false;
  engine = loadPongGame(container, false, {
    multiplayer: room.role, playerName: room.host, opponentName: room.guest,
    canPlay: () => checkConnection() && dbReady && !busyScore && !pendingEvent,
    onInput(value) { if (input !== value) { input = value; send(true); } },
    onPauseRequest() { pauseRequested = true; send(true); },
    onChange(urgent) { if (urgent) send(true); },
    onGoal(event) { queueEvent({ p_action: 'goal', p_match: event.match, p_goal: event.number, p_winner: event.winner }); },
    onRequestNewGame() {
      if (!checkConnection() || !dbReady || busyScore || pendingEvent || !['ready','over'].includes(engine.getState().phase)) return;
      queueEvent({ p_action: 'start', p_match: engine.getState().matchNumber + 1 });
    }
  });
  function receive(payload) {
    if (stopped || Profiles.active()?.id !== profile.id || !payload || typeof payload.session !== 'string' || payload.session.length > 64 ||
        !Number.isSafeInteger(payload.seq) || payload.seq < 1 || typeof payload.visible !== 'boolean') return;
    if (host ? ![-1, 0, 1].includes(payload.direction) || typeof payload.pause !== 'boolean' : !CanvasSaves.valid('pong', payload.state)) return;
    if (payload.session !== peerSession) {
      if (retiredSessions.has(payload.session)) return;
      if (peerSession) retiredSessions.add(peerSession);
      peerSession = payload.session; received = -1; engine.pause();
    }
    if (payload.seq <= received) return;
    received = payload.seq; peerSeen = Date.now(); peerVisible = payload.visible;
    if (host) {
      engine.setRemoteInput(peerVisible ? payload.direction : 0);
      if (payload.pause || !peerVisible) engine.pause();
    } else engine.applyState(payload.state, true);
    checkConnection();
  }
  async function connect() {
    const epoch = ++generation; const old = channels;
    channels = []; subscribed.clear(); peerSeen = 0; peerVisible = false; sendPending = false; queuedSend = false;
    engine.pause(); text('Connecting to live play...'); start.disabled = true;
    await Promise.allSettled(old.map(channel => client.removeChannel(channel)));
    if (stopped || epoch !== generation) return;
    try {
      // The client uses the active online profile's JWT for private channel RLS.
      await client.realtime.setAuth();
      if (stopped || epoch !== generation) return;
      for (const [index, role] of ['host', 'guest'].entries()) {
        const channel = client.channel('arcade:pong:' + room.id + ':' + role, { config: { private: true, broadcast: { self: false, ack: true } } });
        channels[index] = channel;
        if (role !== room.role) channel.on('broadcast', { event: 'frame' }, ({ payload }) => { if (epoch === generation) receive(payload); });
        channel.subscribe(state => {
          if (stopped || epoch !== generation) return;
          if (state === 'SUBSCRIBED') { subscribed.add(index); send(true); }
          else { subscribed.delete(index); peerSeen = 0; }
          checkConnection();
        });
      }
    } catch { if (!stopped && epoch === generation) text('Live connection failed. Use Refresh connection after checking the Pong setup.'); }
  }
  const tick = setInterval(() => {
    if (stopped) return;
    if (Profiles.active()?.id !== profile.id || Date.now() >= Date.parse(room.expiresAt)) { destroy(); text('This room or profile session ended. Refresh the room.'); return; }
    checkConnection(); send();
  }, 50);
  function visibility() { if (document.hidden) { input = 0; pauseRequested = true; engine.pause(); } send(true); checkConnection(); }
  function blur() { input = 0; engine.pause(); send(true); }
  function pause() { engine.pause(); send(true); }
  function destroy() {
    if (stopped) return;
    stopped = true; generation++; clearInterval(tick); engine.destroy();
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', blur);
    const old = channels; channels = []; subscribed.clear();
    Promise.allSettled(old.map(channel => client.removeChannel(channel)));
  }
  document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', blur);
  connect(); syncMatch().catch(() => {});
  async function beforeLeave() {
    pause();
    if (scoreOperation) await scoreOperation;
    if (pendingEvent) await syncMatch();
  }
  return { pause, destroy, beforeLeave, reconnect() { connect(); if (!dbReady || pendingEvent) syncMatch().catch(() => {}); } };
}
