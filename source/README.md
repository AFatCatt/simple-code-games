# Building and understanding the Doom integration

The update already contains a compiled engine. You can run the website without compiling C or installing Emscripten. Use VS Code Live Server or GitHub Pages.

## What each part does

- `assets/vendor/doom/doom.js` and `doom.wasm`: the compiled engine.
- `assets/vendor/doom/doom-resources.zip`: the unmodified shareware WAD, FreePats samples, and configuration files.
- `js/games/doom.js`: the website adapter. It loads the engine, handles keyboard/mouse controls, and saves through `ArcadeStorage.saveGame`.
- `source/doomgeneric/doomgeneric/doomgeneric_web.c`: the browser platform implementation and the functions called by JavaScript.
- `source/doomgeneric/doomgeneric/Makefile.web`: the reproducible build recipe.
- `licenses/`: original notices and provenance.

Upstream: `ozkl/doomgeneric` commit `e257a09527062bfb986b6e5e0780839b6cbd5b71`. Engine changes and the adapter are GPL-2.0-or-later. Modified engine files carry dated change notices. The commercial game data is not GPL source code. This distribution includes only the freely distributable original shareware WAD.

## Engine edits, 2026-11-19

1. `doomgeneric_web.c`: browser timing, frame rendering, input, pause handling, SDL audio, and exported save/stat functions. JavaScript owns the animation loop so the browser remains responsive.
2. `g_game.c`: one save slot, a synchronous checkpoint entry point, and a callback after a save finishes writing.
3. `p_saveg.c`: the current engine instance uses `/profile/doom.dsg`. The website imports only the signed-in profile's bytes into that instance.
4. `m_menu.c`: one visible save/load slot. Save uses a fixed name. New Game and Quit return through the website's save/navigation flow.
5. `d_main.c`: skips the blocking screen-melt transition in the web build.
6. `Makefile.web`: Emscripten build with SDL2 sound and SDL2_mixer MIDI support.

## Controls and settings correction, 2026-11-19

The browser adapter now uses the key codes defined by this port's `doomkeys.h`: Space sends `KEY_USE` (0xa2), Ctrl sends `KEY_FIRE` (0xa3), and A/D send the two strafe codes (0xa0 and 0xa1).

The web bridge exports `arcade_menu` and exposes menu state. Escape opens or closes the native menu. A `pointerlockchange` listener opens the menu when the browser consumes Escape to release the mouse. An explicit Menu button works as a fallback. Menu navigation keeps the engine running while Doom pauses its level simulation. Clicking the menu canvas does not capture the mouse. Use arrows, Enter, and Backspace to navigate; Left/Right adjust sliders.

`m_menu.c` now contains exactly one save entry and one load entry. Native menu saves and quicksaves use the same alive-player checkpoint function as the website Save game button.

`m_config.c` enables reading the configuration in the web build, and `i_video.c` binds the saved gamma value. The adapter stores validated mouse sensitivity, sound/music volume, messages, screen size, detail, and gamma settings alongside the single profile checkpoint. Older checkpoints without these optional settings still load. The save format ID, profile database, and checkpoint byte format are unchanged.

## Saves and scores

Each profile's existing database record for `doom` stores one base64-encoded native Doom save plus a SHA-256 checksum. The checksum detects accidental damage, not cheating. The adapter checks the checksum before loading bytes into the engine. It uses the existing revision check to prevent an older tab from overwriting a newer save.

Autosave runs every 10 seconds while the player is alive in a level. Save game, normal site navigation, and profile switching also save. Death/intermission do not replace the last living checkpoint. New game replaces the checkpoint after confirmation, and the database keeps the best leaderboard score. Wait for Saved before closing the tab.

Doom's leaderboard score is the most monsters defeated in one level. New runs use Hurt Me Plenty, with the original Episode 1 maps. Profiles and best scores are now shared online through Supabase. Doom checkpoints remain local to the browser and site address. Scores are reported by the browser; this is not a cheat-proof competitive ranking.

## Rebuild the engine

Use Linux, macOS, or WSL with Git, Python, Make, and the Emscripten SDK installed. These are optional developer tools, not requirements for playing.

1. Get the official [Emscripten SDK](https://github.com/emscripten-core/emsdk).
2. In the SDK directory run:

   ```bash
   ./emsdk install 3.1.74
   ./emsdk activate 3.1.74
   source ./emsdk_env.sh
   ```

3. In the website's project directory run:

   ```bash
   make -C source/doomgeneric/doomgeneric -f Makefile.web -j4
   ```

This writes `assets/vendor/doom/doom.js` and `doom.wasm`. The first build downloads Emscripten's SDL2 2.30.9 and SDL2_mixer 2.8.0 ports. Their exact upstream source archives are included in `source/dependencies/`. Emscripten's compiler/runtime source is available at the pinned 3.1.74 link in the license index.

After editing C code, rebuild both files together, then refresh the browser. To force a complete rebuild, run `make -C source/doomgeneric/doomgeneric -f Makefile.web clean` before the build command. Do not commit the `build-web/` object files.

`doom-source.zip` contains the engine source, web adapter, license notices, and this guide using project-relative paths. Extract it into a project directory. The larger SDL dependency source archives are provided alongside it under `source/dependencies/`, rather than duplicated inside it. The source directories are also committed directly so edits are easy to inspect.

## Validation performed for this update

The actual compiled WASM engine booted Episode 1, moved the player, wrote a native save, paused/resumed, and restored that save in a fresh engine instance. The real SDL2_mixer/FreePats audio pipeline generated nonzero PCM samples. DOM integration checks exercised separate profiles, one slot, saved-game continuation, keeping leaderboard bests, stale-tab rejection, quota errors, and damaged-save rejection.

These checks ran in a Node/DOM harness. A full interactive browser playthrough, audible output, mouse capture, and fullscreen still need the short browser checks in the installation guide.
