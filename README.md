# Crystal Lake: Nightfall — Nightwatch

Online 2D survival game. Node.js 24+, `npm ci --omit=dev`, `npm start`.
The hosting provider supplies `PORT`; WebSocket `/ws`, HTTP fallback `/api/rooms/:code`, health `/health`.

## Play

- Classic: one hunter and up to four survivors; bots fill the selected number of free survivor places. Hunt allows additional survivor bots, up to twelve.
- The lobby host chooses bot count, mode and AI difficulty. Appearances remain cosmetic.
- Esc opens saved audio/display settings, key remapping and the guide. Icons show abilities, ammunition and cooldowns; contextual prompts appear only near available interactions.
- Jason uses the machete, traps, sense (60-second cooldown), stealth and rage. Throwing knives, dash and protection were removed.
- Survivor supplies are limited and randomly scattered. Notes provide temporary approximate clues; supply kits may be locked and noisy. Destroyed parts respawn randomly in another location.
- Car: four seats; boat: two. Launch after the engine startup and steer with movement keys. Car exit is west; boat exit is north across the lake. The map marks the active transport exit.
- Radio calls rescue to the west entrance. At dawn a final 75-second exit opens. Reaching it is required; waiting in a shelter is not an automatic escape.
- A first lethal injury can leave a survivor downed for 32 seconds. An ally may revive them once. Death and escape allow spectator mode.
- Rain washes away trails. Decoys make false sounds. Power outages, storms and random supplies vary a round. A generator can restore nearby power temporarily.
- Safe practice teaches movement, pickup, hiding, windows, a timing check and a driven escape, with no attacking hunter or time limit.

## Runtime limits

The existing free Render instance sleeps after inactivity. Its next startup can take about a minute.
By default rooms use in-memory SQLite. A restart/deploy closes those matches; clients return to the lobby with an explanation.
`NIGHTFALL_DB_PATH` may point to a persistent SQLite file on a host that provides persistent storage. The free Render configuration does not include a paid disk/database. Do not claim that ongoing matches survive a Render restart.

Session tokens and room data belong only in the runtime database, never in source control. Audio attribution and CC0 sources: `public/audio/CREDITS.md`.
