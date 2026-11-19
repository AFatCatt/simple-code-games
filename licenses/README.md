# Doom sources and licenses

This website includes the original **Doom shareware Episode 1**, running in a modified open-source engine. The engine and the game data have separate licenses. The paid episodes are not included.

| Component | Version or source | License and local copy |
| --- | --- | --- |
| doomgeneric engine | [ozkl/doomgeneric](https://github.com/ozkl/doomgeneric/tree/e257a09527062bfb986b6e5e0780839b6cbd5b71), commit `e257a09527062bfb986b6e5e0780839b6cbd5b71` | GPL-2.0-or-later; [license](Doom-GPL-2.0.txt), [modified source](../source/doom-source.zip) |
| Original Doom game data | Unmodified `DOOM1.WAD`, shareware version 1.9; id Software | [Shareware license and John Carmack distribution clarification](Doom-shareware-license.txt) |
| SDL2 | [release-2.30.9](https://github.com/libsdl-org/SDL/tree/release-2.30.9) | zlib; [license](SDL2-zlib.txt), [source](../source/dependencies/SDL2-2.30.9.zip) |
| SDL2_mixer | [release-2.8.0](https://github.com/libsdl-org/SDL_mixer/tree/release-2.8.0) | zlib; [license](SDL2_mixer-zlib.txt), [source](../source/dependencies/SDL2_mixer-2.8.0.zip) |
| TiMidity MIDI decoder | The copy supplied with SDL2_mixer 2.8.0 | [Artistic license](Timidity-Artistic.txt); source also in `source/timidity/` |
| FreePats instrument samples | [FreePats](https://freepats.zenvoid.org/), 20060219 archive, subset for Doom Episode 1 | [COPYING](FreePats-COPYING.txt) and [README](FreePats-README.txt); sample files remain unmodified inside the runtime resource archive |
| fflate | [v0.8.2](https://github.com/101arrowz/fflate/tree/v0.8.2) | [MIT license](fflate-MIT.txt); the runtime uses the original UMD build |
| Emscripten build/runtime support | [3.1.74](https://github.com/emscripten-core/emscripten/tree/3.1.74) | [license notices](Emscripten-LICENSE.txt) |

The Doom engine derives from id Software's Doom source and Chocolate Doom. Original notices are retained in the source files. Simple Code Games changes to the engine and its Doom adapter are dated **2026-11-19** and licensed GPL-2.0-or-later. See [build instructions and change notes](../source/README.md).

The original shareware archive is available in the [idgames idstuff/doom mirror](https://www.gamers.org/pub/idgames/idstuff/doom/) as `doom19s.zip`. The included WAD SHA-256 is `1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771`. The WAD has not been edited or relicensed under the GPL.

The distribution clarification appended to the shareware license is John Carmack's 1999 statement, preserved in [this license copy](https://github.com/redox-os/freedoom/blob/master/LICENSE-DOOM1). Keep the license, credits, corresponding source, and third-party notices with redistributed copies of this update.

FreePats archive provenance: [20060219 archive mirror](https://distfiles.macports.org/freepats/freepats-20060219.tar.bz2), SHA-256 `0261ea1057b232183fa472432d5cedb0dca33698a5319328cdf193d4b2193c8a`. The smaller resource bundle contains the melodic patches referenced by the Episode 1 music, the drum bank, and a configuration mapping those samples. It is not a new sample recording.
