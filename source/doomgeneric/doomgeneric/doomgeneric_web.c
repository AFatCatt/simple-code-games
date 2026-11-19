/* Simple Code Games browser bridge. Added 2026-11-19. GPL-2.0-or-later.
 * The engine writes one vanilla save file; JavaScript persists it per profile. */
#include <stdio.h>
#include <string.h>
#include <emscripten.h>
#include <SDL_mixer.h>
#include "doomgeneric.h"
#include "doomstat.h"
#include "d_event.h"
#include "g_game.h"
#include "m_menu.h"
#include "p_saveg.h"
#include "doomkeys.h"
#include "i_video.h"

extern void arcade_write_save(void);
extern int showMessages;
extern gameaction_t gameaction;
static int best_level_kills = 0;
static double stopped_at = 0, stopped_time = 0;
static int stopped = 0;

EM_JS(double, web_now, (), {
    return Module.testClock ? Module.testClock() : performance.now();
});

void DG_Init(void) {}
void DG_DrawFrame(void) {
    EM_ASM({ if (Module.drawDoomFrame) Module.drawDoomFrame($0, $1, $2); },
           DG_ScreenBuffer, DOOMGENERIC_RESX, DOOMGENERIC_RESY);
}
void DG_SleepMs(uint32_t ms) { /* The browser schedules frames. */ }
uint32_t DG_GetTicksMs(void) {
    return (uint32_t)((stopped ? stopped_at : web_now()) - stopped_time);
}
int DG_GetKey(int *pressed, unsigned char *key) { return 0; }
void DG_SetWindowTitle(const char *title) {}

EMSCRIPTEN_KEEPALIVE void arcade_key(int key, int down) {
    event_t event = {0};
    event.type = down ? ev_keydown : ev_keyup;
    event.data1 = key; event.data2 = key; event.data3 = key;
    D_PostEvent(&event);
}
EMSCRIPTEN_KEEPALIVE void arcade_mouse(int buttons, int dx, int dy) {
    event_t event = {0}; event.type = ev_mouse;
    event.data1 = buttons; event.data2 = dx; event.data3 = dy;
    D_PostEvent(&event);
}
/* Added 2026-11-19: open/close menus even when the browser consumes Escape. */
EMSCRIPTEN_KEEPALIVE void arcade_menu(int open) {
    if (open) M_StartControlPanel();
    else if (menuactive) {
        event_t event = {0};
        event.type = ev_keydown;
        event.data1 = event.data2 = event.data3 = KEY_ESCAPE;
        M_Responder(&event);
    }
}
EMSCRIPTEN_KEEPALIVE void arcade_pause(int value) {
    if (value && !stopped) { stopped_at = web_now(); stopped = 1; Mix_Pause(-1); Mix_PauseMusic(); }
    else if (!value && stopped) { stopped_time += web_now() - stopped_at; stopped = 0; Mix_Resume(-1); Mix_ResumeMusic(); }
}
EMSCRIPTEN_KEEPALIVE void arcade_tick(void) {
    if (stopped) return;
    doomgeneric_Tick();
    if (usergame && !demoplayback && players[consoleplayer].killcount > best_level_kills)
        best_level_kills = players[consoleplayer].killcount;
}
EMSCRIPTEN_KEEPALIVE int arcade_can_save(void) {
    return usergame && !demoplayback && gamestate == GS_LEVEL &&
           players[consoleplayer].health > 0 && gameaction == ga_nothing;
}
EMSCRIPTEN_KEEPALIVE int arcade_save(void) {
    if (!arcade_can_save()) return 0;
    arcade_write_save();
    return !savegame_error;
}
EMSCRIPTEN_KEEPALIVE int arcade_stat(int field) {
    switch (field) {
        case 0: return gamestate;
        case 1: return gameepisode;
        case 2: return gamemap;
        case 3: return players[consoleplayer].health;
        case 4: return players[consoleplayer].killcount;
        case 5: return best_level_kills;
        case 6: return leveltime;
        case 7: return menuactive;
        /* Options saved alongside the profile's single checkpoint. */
        case 8: return mouseSensitivity;
        case 9: return sfxVolume;
        case 10: return musicVolume;
        case 11: return showMessages;
        case 12: return screenblocks;
        case 13: return detailLevel;
        case 14: return usegamma;
        /* Read-only input diagnostics used by the native engine checks. */
        case 15: return players[consoleplayer].cmd.buttons;
        case 16: return players[consoleplayer].cmd.sidemove;
        default: return 0;
    }
}

void arcade_saved(void) {
    if (players[consoleplayer].killcount > best_level_kills)
        best_level_kills = players[consoleplayer].killcount;
    EM_ASM({ if (Module.onDoomSave) Module.onDoomSave($0); }, best_level_kills);
}

int main(int argc, char **argv) {
    doomgeneric_Create(argc, argv);
    /* The website owns requestAnimationFrame, pause, and profile switching. */
    return 0;
}
