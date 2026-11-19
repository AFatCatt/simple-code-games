/* Simple Code Games Doom adapter, 2026-11-19. GPL-2.0-or-later. */
const DoomSave = {
  format: "doomgeneric-profile-v1",
  settingFields: {
    mouse_sensitivity: [8, 0, 9], sfx_volume: [9, 0, 15], music_volume: [10, 0, 15],
    show_messages: [11, 0, 1], screenblocks: [12, 3, 11], detaillevel: [13, 0, 1], usegamma: [14, 0, 4]
  },
  readSettings(engine) {
    return Object.fromEntries(Object.entries(this.settingFields).map(([name, [field]]) => [name, engine._arcade_stat(field)]));
  },
  settingsConfig(values) {
    return Object.entries(this.settingFields).filter(([name, [, min, max]]) =>
      Number.isInteger(values?.[name]) && values[name] >= min && values[name] <= max)
      .map(([name]) => name + " " + values[name]).join("\n");
  },
  valid(s) { return Boolean(s && s.format === this.format && s.wad === "doom1-1.9" &&
    typeof s.data === "string" && s.data.length > 64 && s.data.length <= 400000 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(s.data) && s.data.length % 4 === 0 &&
    typeof s.sha256 === "string" && /^[a-f0-9]{64}$/.test(s.sha256)); },
  encode(bytes) {
    let text = "";
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(text);
  },
  decode(text) { return Uint8Array.from(atob(text), c => c.charCodeAt(0)); },
  async digest(bytes) {
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
  }
};

function loadDoomGame(container, options = {}) {
  const profile = Profiles.active(); // Capture ownership for the whole session.
  const record = profile ? ArcadeStorage.getRecord(profile.id, "doom") : null;
  let fresh = Boolean(options.newGame);
  if (fresh && record && !confirm("Replace this profile's Doom save? Its leaderboard best will stay.")) fresh = false;
  if (record && !fresh && !DoomSave.valid(record.state)) throw new Error("This Doom save is incompatible. Use Games > Original Doom > New game to replace it.");
  const restoring = Boolean(record && !fresh);
  let revision = record?.revision || 0;
  let engine, started = false, paused = true, failed = false;
  let dirty = false, pending = null, queued = null;
  let lastSnapshot = restoring ? record.state : null, lastSavedScore = record?.best ?? 0;
  let lastAutoSave = performance.now(), lastFrame = 0, frameId = 0, generation = 0;
  const held = new Map();
  let pointerLocked = false, deliberateUnlock = false, lastBrowserEscape = -Infinity, menuWasOpen = false;
  container.className = "doom-stage";
  container.innerHTML = `<div class="doom-screen">
    <canvas id="doom-canvas" width="640" height="400" tabindex="0" aria-label="Original Doom game"></canvas>
    <div class="doom-start"><h2>Original Doom</h2><p>Episode 1 · Hurt Me Plenty</p>
    <button id="doom-start" type="button" class="button primary" disabled>Loading game...</button></div></div>
    <div class="doom-actions"><button id="doom-pause" class="button compact" type="button" disabled>Pause</button>
    <button id="doom-menu" class="button compact" type="button" disabled aria-expanded="false">Menu</button>
    <button id="doom-save" class="button compact" type="button" disabled>Save game</button>
    <button id="doom-fullscreen" class="button compact" type="button" disabled>Fullscreen</button>
    <button id="doom-retry" class="button compact" type="button" hidden>Retry save</button></div>
    <p id="doom-save-status" role="status">Loading the game, music and sound effects...</p>
    <p class="doom-controls">WASD or arrows to move, mouse or Ctrl to fire, Space to use doors and switches. Esc opens/closes the menu and releases the mouse. In menus: arrows to choose or adjust settings, Enter to select, Backspace to go back. Click the game after closing the menu to use the mouse.</p>`;
  const canvas = container.querySelector("canvas"), context = canvas.getContext("2d", { alpha: false });
  const pixels = context.createImageData(640, 400);
  const startButton = container.querySelector("#doom-start"), pauseButton = container.querySelector("#doom-pause");
  const saveButton = container.querySelector("#doom-save"), retryButton = container.querySelector("#doom-retry");
  const menuButton = container.querySelector("#doom-menu");
  const status = container.querySelector("#doom-save-status");
  function report(error) { status.textContent = error.message || String(error); status.classList.add("save-error"); }
  function releaseKeys() {
    if (!engine || !started) return;
    for (const key of new Set(held.values())) engine._arcade_key(key, 0);
    held.clear(); engine._arcade_mouse(0, 0, 0);
  }
  function setPaused(value) {
    if (!started || failed) return;
    if (value) { releaseKeys(); unlockPointer(); }
    paused = value; engine._arcade_pause(value ? 1 : 0);
    pauseButton.textContent = value ? "Resume" : "Pause";
  }
  const menuOpen = () => Boolean(started && engine._arcade_stat(7));
  function unlockPointer() {
    if (document.pointerLockElement === canvas) {
      deliberateUnlock = true;
      document.exitPointerLock();
    }
  }
  function syncMenu() {
    const open = menuOpen();
    menuButton.textContent = open ? "Close menu" : "Menu";
    menuButton.setAttribute("aria-expanded", String(open));
    if (open && !menuWasOpen) { releaseKeys(); unlockPointer(); canvas.focus(); }
    menuWasOpen = open;
  }
  function setMenu(open) {
    if (!started || failed) return;
    releaseKeys();
    // The engine must keep ticking to render and navigate the menu. Doom itself pauses the level.
    engine._arcade_menu(open ? 1 : 0);
    setPaused(false);
    syncMenu();
    canvas.focus();
  }
  // Serialize writes. A failed snapshot stays queued for Retry save.
  function flush() {
    if (!profile) { queued = null; dirty = false; return Promise.resolve(); }
    if (pending) return pending;
    if (!queued) return Promise.resolve();
    pending = (async () => {
      await Promise.resolve(); saveButton.disabled = true; retryButton.hidden = true;
      try {
        while (queued) {
          const snapshot = queued;
          status.textContent = "Saving for " + profile.username + "...";
          if (Profiles.active()?.id !== profile.id) throw new Error("The active profile changed. Reload before playing.");
          const state = snapshot.state || { format: DoomSave.format, wad: "doom1-1.9",
            data: DoomSave.encode(snapshot.bytes), sha256: await DoomSave.digest(snapshot.bytes), settings: snapshot.settings };
          revision = await ArcadeStorage.saveGame(profile.id, "doom", state, snapshot.score, revision);
          lastSnapshot = state; lastSavedScore = Math.max(lastSavedScore, snapshot.score);
          if (queued === snapshot) queued = null;
          dirty = generation !== snapshot.generation;
        }
        status.classList.remove("save-error");
        status.textContent = "Saved for " + profile.username + ". Continue will restore this game.";
      } catch (error) { retryButton.hidden = false; report(error); throw error; }
      finally { pending = null; saveButton.disabled = !started || failed || !profile; }
    })();
    return pending;
  }
  function engineSaved(score) {
    if (!profile) return;
    queued = { bytes: engine.FS.readFile("/profile/doom.dsg").slice(), settings: DoomSave.readSettings(engine), score, generation };
    dirty = true; flush().catch(() => {});
  }
  async function save(manual = false) {
    if (!started || failed || !profile) return;
    if (pending) await pending;
    if (queued) await flush();
    const score = engine._arcade_stat(5);
    if (engine._arcade_can_save()) engine._arcade_save();
    else if (lastSnapshot && score > lastSavedScore) {
      // A dead player or intermission never replaces a playable checkpoint.
      queued = { state: lastSnapshot, score, generation }; flush().catch(() => {});
    } else if (manual) status.textContent = "Your last checkpoint is kept. Save while alive in a level to replace it.";
    if (pending) await pending;
  }
  async function beforeLeave() { setPaused(true); if (pending) await pending; await save(); dirty = false; }
  async function reset() { await beforeLeave(); location.assign("game.html?game=doom&new=1"); }
  function frame(now) {
    if (!started || failed) return;
    frameId = requestAnimationFrame(frame);
    if (paused || now - lastFrame < 1000 / 35) return;
    lastFrame = now;
    try {
      engine._arcade_tick();
      syncMenu();
      if (engine._arcade_can_save()) { dirty = true; generation++; }
      if (profile && now - lastAutoSave >= 10000 && !pending) {
        lastAutoSave = now; save().catch(() => setPaused(true));
      }
    } catch (error) {
      failed = true; cancelAnimationFrame(frameId); saveButton.disabled = true;
      report(new Error("Doom stopped. Reload to restore your last checkpoint. " + error.message));
    }
  }
  function addScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script"); script.src = src + "?v=controls-20261119"; script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load " + src + ". Check the copied update files.")); document.head.append(script);
    });
  }
  async function getBytes(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error("Could not load Doom's files. Use Live Server and check the copied folders.");
    return new Uint8Array(await response.arrayBuffer());
  }
  const ready = (async () => {
    if (location.protocol === "file:") throw new Error("Use Live Server or GitHub Pages to play Doom.");
    let savedBytes = null;
    if (restoring) {
      savedBytes = DoomSave.decode(record.state.data);
      if (await DoomSave.digest(savedBytes) !== record.state.sha256) throw new Error("This Doom save is damaged. It has been left untouched. Use New game to replace it.");
    }
    await Promise.all([typeof createDoomModule === "function" ? Promise.resolve() : addScript("assets/vendor/doom/doom.js"),
      window.fflate ? Promise.resolve() : addScript("assets/vendor/doom/fflate.js")]);
    const [wasm, archive] = await Promise.all([getBytes("assets/vendor/doom/doom.wasm"), getBytes("assets/vendor/doom/doom-resources.zip")]);
    const resources = fflate.unzipSync(archive);
    engine = await createDoomModule({ wasmBinary: wasm, noInitialRun: true,
      print: text => console.debug("Doom:", text), printErr: text => console.warn("Doom:", text),
      onAbort: () => report(new Error("The Doom engine could not start. Reload and try again.")),
      preRun: [module => {
        for (const [name, bytes] of Object.entries(resources)) {
          if (name.includes("..") || name.startsWith("/")) throw new Error("Invalid game resource path.");
          if (name.includes("/")) module.FS.mkdirTree("/" + name.slice(0, name.lastIndexOf("/")));
          module.FS.writeFile("/" + name, bytes);
        }
        module.FS.mkdirTree("/profile"); if (savedBytes) module.FS.writeFile("/profile/doom.dsg", savedBytes);
        // Older saves have no settings object and keep the original defaults.
        const settings = DoomSave.settingsConfig(record?.state?.settings);
        if (settings) module.FS.writeFile("/doom.cfg", module.FS.readFile("/doom.cfg", { encoding: "utf8" }) + "\n" + settings + "\n");
      }],
      drawDoomFrame: (pointer, width, height) => {
        if (!engine) return;
        const source = engine.HEAPU8.subarray(pointer, pointer + width * height * 4);
        for (let i = 0; i < source.length; i += 4) {
          pixels.data[i] = source[i + 2]; pixels.data[i + 1] = source[i + 1];
          pixels.data[i + 2] = source[i]; pixels.data[i + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
      },
      onDoomSave: engineSaved,
      onDoomNewGame: () => setTimeout(() => reset().catch(report), 0),
      onDoomQuit: () => setTimeout(() => beforeLeave().then(() => location.assign("index.html")).catch(report), 0)
    });
    startButton.disabled = false; startButton.textContent = restoring ? "Continue saved game" : "Start Doom";
    status.textContent = profile ? "Ready for " + profile.username + ". Autosaves every 10 seconds, or use Save game."
      : "Guest game: sign in before starting to save progress and join leaderboards.";
  })();
  ready.catch(error => { report(error); startButton.textContent = "Reload to try again"; });
  startButton.addEventListener("click", () => {
    if (started || !engine) return;
    startButton.disabled = true;
    try {
      const args = ["-iwad", "/doom1.wad", "-config", "/doom.cfg"];
      args.push(...(restoring ? ["-loadgame", "0"] : ["-skill", "3", "-warp", "1", "1"]));
      engine.callMain(args); started = true; paused = false;
      container.querySelector(".doom-start").hidden = true;
      pauseButton.disabled = false; saveButton.disabled = !profile;
      menuButton.disabled = false;
      container.querySelector("#doom-fullscreen").disabled = false;
      canvas.focus(); lastAutoSave = performance.now() - 10000; frameId = requestAnimationFrame(frame);
    } catch (error) { failed = true; report(error); }
  });
  pauseButton.addEventListener("click", () => { setPaused(!paused); if (!paused) canvas.focus(); });
  menuButton.addEventListener("click", () => setMenu(!menuOpen()));
  saveButton.addEventListener("click", () => { setPaused(true); save(true).catch(report); });
  retryButton.addEventListener("click", () => flush().catch(report));
  container.querySelector("#doom-fullscreen").addEventListener("click", () => {
    container.requestFullscreen?.().then(() => canvas.focus()).catch(report);
  });
  // Match this port's doomkeys.h: Use=0xa2, Fire=0xa3, strafe=0xa0/0xa1.
  const keys = { ArrowUp: 173, ArrowDown: 175, ArrowLeft: 172, ArrowRight: 174, KeyW: 173, KeyS: 175, KeyA: 160, KeyD: 161,
    ControlLeft: 163, ControlRight: 163, ShiftLeft: 182, ShiftRight: 182, AltLeft: 184, AltRight: 184,
    Space: 162, Enter: 13, NumpadEnter: 13, Tab: 9, Backspace: 127,
    F1: 187, F2: 188, F3: 189, F4: 190, F5: 191, F6: 192, F9: 195, F11: 215, Minus: 45, Equal: 61 };
  window.addEventListener("keydown", event => {
    if (!started || failed || document.querySelector("dialog[open]") ||
        event.target.closest?.("input, textarea, select, [contenteditable=true]")) return;
    if (event.code === "Escape") {
      event.preventDefault();
      if (event.repeat || performance.now() - lastBrowserEscape < 100) return;
      // If pointer lock is active, this Escape opens the menu, even if its browser event arrives first.
      setMenu(document.pointerLockElement === canvas ? true : !menuOpen());
      return;
    }
    if (paused && menuOpen()) setPaused(false);
    if (paused || (document.activeElement !== canvas && document.pointerLockElement !== canvas && !menuOpen())) return;
    const character = menuOpen() && event.key.length === 1 ? event.key.toLowerCase().charCodeAt(0) : null;
    const key = character ?? keys[event.code] ?? (/^[1-7]$/.test(event.key) ? event.key.charCodeAt(0) : null);
    if (key === null) return; event.preventDefault();
    if (!held.has(event.code) || (event.repeat && menuOpen())) { held.set(event.code, key); engine._arcade_key(key, 1); }
  });
  window.addEventListener("keyup", event => {
    if (!held.has(event.code)) return;
    const key = held.get(event.code); held.delete(event.code);
    if (![...held.values()].includes(key)) engine._arcade_key(key, 0); event.preventDefault();
  });
  canvas.addEventListener("click", () => {
    if (!started || failed) return;
    canvas.focus();
    if (menuOpen()) { if (paused) setPaused(false); return; }
    if (paused) setPaused(false);
    if (document.pointerLockElement !== canvas) { const request = canvas.requestPointerLock?.(); request?.catch?.(() => {}); }
  });
  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    if (pointerLocked && !locked) {
      releaseKeys();
      if (!deliberateUnlock && started && !failed && !document.hidden && !document.querySelector("dialog[open]")) {
        // Browsers may consume Escape without sending a keydown event to the page.
        lastBrowserEscape = performance.now();
        setMenu(true);
      }
      deliberateUnlock = false;
    }
    pointerLocked = locked;
  });
  canvas.addEventListener("mousedown", event => {
    if (started && !paused && document.pointerLockElement === canvas && event.button === 0) engine._arcade_mouse(1, 0, 0);
  });
  window.addEventListener("mouseup", () => { if (started && !failed) engine._arcade_mouse(0, 0, 0); });
  document.addEventListener("mousemove", event => {
    if (started && !paused && !failed && document.pointerLockElement === canvas)
      engine._arcade_mouse(event.buttons & 1, Math.round(event.movementX * 3), 0);
  });
  canvas.addEventListener("contextmenu", event => event.preventDefault());
  window.addEventListener("blur", () => { setPaused(true); save().catch(report); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { setPaused(true); save().catch(report); } });
  window.addEventListener("beforeunload", event => {
    if (profile && started && (dirty || queued || pending)) { event.preventDefault(); event.returnValue = ""; }
  });
  return { ready, pause: () => setPaused(true), beforeLeave, reset };
}
