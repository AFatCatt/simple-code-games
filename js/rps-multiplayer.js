/* Room browsing and moves go through authenticated server functions. */
window.rpsMultiplayerReady = (async () => {
  await window.arcadeAppReady;
  const profile = Profiles.active(), root = document.querySelector("#rps-online");
  if (!profile) {
    root.innerHTML = '<h2>Sign in to play together</h2><p>Each player needs a different online profile. Use the Profile button to sign in or create one.</p>';
    return;
  }
  root.innerHTML = `<div id="rps-lobby"><h2>Find someone to play</h2>
    <p>Join an open room, find a random opponent, or host your own.</p>
    <form id="rps-host-form" class="rps-host-form">
      <label for="rps-host-password">Room password <span class="small">(optional)</span></label>
      <input id="rps-host-password" type="password" minlength="4" maxlength="64" autocomplete="new-password" aria-describedby="rps-password-help">
      <p id="rps-password-help" class="small">Leave blank so anyone can join. Otherwise use 4 to 64 characters.</p>
      <button id="rps-host" class="button primary" type="submit">Host room</button>
    </form>
    <div class="rps-room-actions"><button id="rps-random" class="button primary" type="button">Join random</button>
      <button id="rps-list-refresh" class="button" type="button">Refresh list</button></div>
    <p class="small">Join random chooses an available room without a password.</p>
    <h3>Available rooms</h3><p id="rps-empty" role="status">Loading rooms...</p>
    <ul id="rps-room-list" class="rps-room-list" aria-label="Available rooms"></ul>
    <form id="rps-password-form" class="rps-password-form" hidden>
      <h3 id="rps-join-title"></h3><label for="rps-join-password">Room password</label>
      <input id="rps-join-password" type="password" minlength="4" maxlength="64" autocomplete="off" required>
      <div class="rps-room-actions"><button id="rps-join" class="button primary" type="submit">Join room</button>
        <button id="rps-cancel-join" class="button" type="button">Cancel</button></div>
    </form></div>
    <section id="rps-room" hidden><h2 id="rps-room-title"></h2><p id="rps-room-access"></p>
      <p id="rps-players"></p><p id="rps-round"></p><p id="rps-readiness"></p>
      <div id="online-rps-choices" class="online-rps-choices"></div>
      <p id="rps-room-result" class="rps-room-result" role="status"></p><p id="rps-room-score"></p>
      <div class="rps-room-actions"><button id="rps-next" class="button primary" type="button" hidden>Next round</button>
        <button id="rps-refresh" class="button" type="button">Refresh room</button>
        <button id="rps-leave" class="button" type="button">Leave room</button></div></section>
    <p id="rps-network" class="small" role="status"></p>
    <p class="small muted">Both picks stay hidden until locked in. The host starts the next round. Room wins are separate from singleplayer rankings. Rooms expire after two hours without a game action.</p>`;
  const find = id => root.querySelector("#" + id), network = find("rps-network");
  const choices = { Sword: "⚔️", Archer: "🏹", Shield: "🛡️", Catapult: "🪨", Dragon: "🐉" };
  const key = "simple-code-games:rps-room:" + profile.id;
  let room = null, resumeId = null, pending = null, pendingKind = null, queuedAction = null, timer = null, stopped = false;
  let selectedRoom = null, listed = null;
  const buttons = Object.keys(choices).map(choice => {
    const b = document.createElement("button"); b.type = "button"; b.className = "button";
    b.innerHTML = `<span class="rps-symbol" aria-hidden="true">${choices[choice]}</span><span>${choice}</span>`;
    b.addEventListener("click", () => action("pick", { p_choice: choice, p_round: room.round }));
    find("online-rps-choices").append(b); return b;
  });
  const active = () => Boolean((room && !room.closed) || resumeId);
  function remember(id) {
    try { if (id) localStorage.setItem(key, id); else localStorage.removeItem(key); } catch { /* Optional resume hint. */ }
  }
  function showList(rooms) {
    if (!Array.isArray(rooms) || rooms.some(r => !r || typeof r.id !== "string" || typeof r.host !== "string" || typeof r.protected !== "boolean")) throw new Error("Invalid room list. Try Refresh list.");
    const signature = JSON.stringify(rooms);
    if (signature === listed) return; // Preserve focus when polling returns the same list.
    listed = signature;
    find("rps-empty").textContent = rooms.length ? "Rooms update automatically. Choose a host below." : "No waiting rooms yet. Host one for another player to join.";
    find("rps-room-list").replaceChildren();
    rooms.forEach(r => {
      const row = document.createElement("li"), label = document.createElement("div");
      const name = document.createElement("strong"), detail = document.createElement("span"), join = document.createElement("button");
      name.textContent = r.host + "'s room"; detail.textContent = r.protected ? "Password required · 1 / 2 players" : "Public · 1 / 2 players";
      detail.className = "small"; label.append(name, detail);
      join.type = "button"; join.className = "button"; join.textContent = "Join";
      join.setAttribute("aria-label", "Join " + r.host + "'s room" );
      join.addEventListener("click", () => {
        if (!r.protected) { action("join", { p_room: r.id }); return; }
        selectedRoom = r.id; find("rps-join-title").textContent = "Join " + r.host + "'s room";
        find("rps-password-form").hidden = false; find("rps-join-password").value = ""; find("rps-join-password").focus();
      });
      row.append(label, join); find("rps-room-list").append(row);
    });
  }
  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  function setDisabled(node, value) { if (node.disabled !== Boolean(value)) node.disabled = Boolean(value); }
  function setHidden(node, value) { if (node.hidden !== Boolean(value)) node.hidden = Boolean(value); }
  function render() {
    const busy = Boolean(queuedAction || (pending && !["state", "list"].includes(pendingKind)));
    find("rps-lobby").querySelectorAll("button").forEach(b => setDisabled(b, busy));
    setDisabled(find("rps-host-password"), busy);
    setHidden(find("rps-lobby"), active()); setHidden(find("rps-room"), !room);
    if (!room) return;
    setText(find("rps-room-title"), room.host + "'s room");
    setText(find("rps-room-access"), room.protected ? "Password protected" : "Public room");
    setText(find("rps-players"), `Host: ${room.host} | Guest: ${room.guest || "Waiting for a player"}`);
    setText(find("rps-round"), `Round ${room.round} · You are ${profile.username} (${room.role})`);
    setText(find("rps-readiness"), `Host: ${room.hostReady ? "choice locked" : "choosing"} | Guest: ${room.guestReady ? "choice locked" : "choosing"}`);
    setText(find("rps-room-score"), `${room.host}: ${room.hostWins} wins | ${room.guest || "Guest"}: ${room.guestWins} wins | Ties: ${room.ties}`);
    const result = find("rps-room-result");
    if (room.closed) setText(result, "This room was closed or expired. Host a new room or join another.");
    else if (room.outcome) setText(result, `${room.host} chose ${room.hostPick}. ${room.guest} chose ${room.guestPick}. ${room.outcome === "tie" ? "It is a tie!" : room[room.outcome] + " wins!"}`);
    else if (!room.guest) setText(result, "Waiting for someone to join. Your room is in the list under your username.");
    else if (room.yourPick) setText(result, `Your ${room.yourPick} is locked. Waiting for the other player.`);
    else setText(result, "Choose your champion. Your choice locks immediately.");
    buttons.forEach(b => setDisabled(b, busy || room.closed || !room.guest || Boolean(room.yourPick) || Boolean(room.outcome)));
    setHidden(find("rps-next"), room.role !== "host" || !room.outcome || room.closed);
    setDisabled(find("rps-next"), busy); setDisabled(find("rps-refresh"), busy);
    setDisabled(find("rps-leave"), busy || room.closed);
    setText(find("rps-leave"), room.role === "host" ? "Close room" : "Leave room");
  }
  function validate(data) {
    if (!data || typeof data.id !== "string" || typeof data.protected !== "boolean" || !["host", "guest"].includes(data.role) || !Number.isInteger(data.round) || typeof data.host !== "string" || !(data.guest === null || typeof data.guest === "string")) throw new Error("Invalid room response. Try Refresh room.");
    return data;
  }
  function schedule() {
    clearTimeout(timer);
    if (!stopped && !document.hidden) timer = setTimeout(() => action(active() ? "state" : "list"), active() ? 2000 : 5000);
  }
  function action(kind, extra = {}) {
    if (stopped) return Promise.resolve();
    if (pending) {
      if (["state", "list"].includes(kind) || !["state", "list"].includes(pendingKind)) return pending;
      // A click during a background read must be applied once, not dropped.
      if (!queuedAction) {
        queuedAction = pending.then(() => { queuedAction = null; return action(kind, extra); });
        render();
      }
      return queuedAction;
    }
    clearTimeout(timer);
    if (Profiles.active()?.id !== profile.id) { stopped = true; network.textContent = "Your profile changed. Reload the page."; return Promise.resolve(); }
    pendingKind = kind;
    pending = (async () => {
      await Promise.resolve(); let resume = false;
      try {
        const { data, error } = await ArcadeOnline.requireClient().rpc("arcade_rps_room", {
          p_action: kind, p_expected_profile: profile.id, p_room: room?.id || resumeId || null, ...extra
        });
        if (error) throw error;
        if (stopped || Profiles.active()?.id !== profile.id) return;
        if (kind === "list") {
          showList(data.rooms);
          if (typeof data.currentRoomId === "string") { resumeId = data.currentRoomId; resume = true; }
        } else {
          room = validate(data); resumeId = null; remember(room.closed ? null : room.id);
          setHidden(find("rps-password-form"), true); selectedRoom = null;
          setText(network, "Connected. Updates appear automatically.");
        }
      } catch (e) {
        if (stopped) return;
        setText(network, /PGRST202|42883|42703/.test(e.code || "")
          ? "Room-list setup is missing. The site owner must run the updated supabase/02-rps-multiplayer.sql."
          : (e.message || "Connection lost. Automatic updates will retry."));
        if (kind === "state" && (e.code === "42501" || /closed|expired|not available/i.test(e.message || ""))) { room = null; resumeId = null; remember(null); }
      } finally { pending = null; pendingKind = null; if (!stopped) { render(); schedule(); } }
      if (resume && !stopped) await action("state");
    })();
    if (!["state", "list"].includes(kind)) render();
    return pending;
  }
  find("rps-host-form").addEventListener("submit", e => {
    e.preventDefault(); const password = find("rps-host-password").value;
    find("rps-host-password").value = ""; action("host", { p_password: password || null });
  });
  find("rps-password-form").addEventListener("submit", e => {
    e.preventDefault(); if (!selectedRoom) return;
    const password = find("rps-join-password").value; find("rps-join-password").value = "";
    action("join", { p_room: selectedRoom, p_password: password });
  });
  find("rps-cancel-join").addEventListener("click", () => { selectedRoom = null; find("rps-password-form").hidden = true; find("rps-join-password").value = ""; });
  find("rps-random").addEventListener("click", () => action("random"));
  find("rps-list-refresh").addEventListener("click", () => action("list"));
  find("rps-next").addEventListener("click", () => action("next", { p_round: room.round }));
  find("rps-refresh").addEventListener("click", () => action("state"));
  find("rps-leave").addEventListener("click", () => { if (confirm("Close this room for both players?")) action("leave"); });
  function visibility() { if (document.hidden) clearTimeout(timer); else action(active() ? "state" : "list"); }
  document.addEventListener("visibilitychange", visibility); window.addEventListener("online", visibility);
  function stop() { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("online", visibility); }
  window.addEventListener("arcadeauthlost", stop); window.addEventListener("pagehide", stop, { once: true });
  window.currentGame = { beforeLeave: async () => { if (queuedAction || pending) await (queuedAction || pending); }, pause() {}, destroy: stop };
  let saved = null; try { saved = localStorage.getItem(key); } catch { /* Optional resume hint. */ }
  if (saved && /^[0-9a-f-]{36}$/i.test(saved)) { resumeId = saved; await action("state"); }
  else await action("list");
})();
