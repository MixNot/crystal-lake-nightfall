# Recorded audio credits

Prepared for Crystal Lake: Nightfall on 2026-10-28. All supplied source recordings and music are offered under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Creators are credited voluntarily. No audio was extracted from a commercial game.

## Rain

- **Ylmir — Rain (loopable)**. [Author's source page](https://opengameart.org/content/rain-loopable), [original Rain OGG archive](https://opengameart.org/sites/default/files/Rain%20OGG.zip). CC0. The author describes recordings made with a microphone at their window, then processed to stereo.
- `rain-outdoor.mp3`, `rain-indoor.mp3`: take `4.ogg` (37.5 seconds). A 0.75-second cyclic self-crossfade produces a seamless 36.75-second loop. A high-pass removes rumble; the outdoor version rolls off above 5.2 kHz, while the indoor version rolls off above 1.25 kHz. Outdoor RMS is approximately -32 dBFS, indoor RMS -41 dBFS; peaks are limited to approximately -14 / -22 dBFS. This is an actual field recording, not white-noise synthesis.

## Music

- **Cleyton Kauffman — Ambient Horror Track 01**. [Author's source page](https://opengameart.org/content/ambient-horror-track-01), [original archive](https://opengameart.org/sites/default/files/ambient_horror_track_01_0.zip). CC0. Original credit: Music by Cleyton Kauffman — https://soundcloud.com/cleytonkauffman. `music-tension.mp3`: complete 48-second seamless string/horror loop; low-cut, gentle treble roll-off, level adjustment, MP3 conversion.
- **congusbongus — Lost in a bad place (horror ambience loop)**. [Author's source page](https://opengameart.org/content/lost-in-a-bad-place-horror-ambience-loop), [original recording](https://opengameart.org/sites/default/files/lost_2.ogg). CC0. `music-dark.mp3`: complete 134.722-second seamless dark string pad loop; low-cut, gentle treble roll-off, level adjustment, MP3 conversion.

## Foley and effects

| Creator and source | Supplied files | Original source files |
| --- | --- | --- |
| **Kenney**, [50 RPG sound effects](https://opengameart.org/content/50-rpg-sound-effects), [official RPG Audio page](https://kenney.nl/assets/rpg-audio), CC0 | `window.mp3`, `hide.mp3`, `unhide.mp3`, `search-1.mp3`, `search-2.mp3`, `pickup.mp3`, `heal.mp3`, `latch.mp3` | `creak2.ogg`, `cloth3.ogg`, `cloth4.ogg`, `bookOpen.ogg`, `handleSmallLeather2.ogg`, `beltHandle2.ogg`, `clothBelt2.ogg`, `metalLatch.ogg` |
| **TinyWorlds**, [Different steps on wood, stone, leaves, gravel and mud](https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud), CC0 | `step-wood-1.mp3` through `step-wood-3.mp3`, `step-leaf-1.mp3`, `step-leaf-2.mp3` | `wood01.ogg` through `wood03.ogg`, `leaves01.ogg`, `leaves02.ogg`. TinyWorlds describes them as recordings from pdsounds.org edited for Minetest. |
| **rubberduck**, [100 CC0 SFX #2](https://opengameart.org/content/100-cc0-sfx-2), CC0 | `step-wet-1.mp3` through `step-wet-3.mp3`, `impact.mp3`, `glass.mp3`, `switch.mp3`, `heartbeat.mp3` | `sfx100v2_footstep_wet_01.ogg` through `_03.ogg`, `sfx100v2_hit_01.ogg`, `sfx100v2_glass_01.ogg`, `sfx100v2_switch_01.ogg`. Heartbeat is derived from the recorded impact by slowing and low-pass filtering it; it is not a new human heartbeat recording. |
| **rubberduck**, [100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx), CC0 | `repair-1.mp3`, `repair-2.mp3`, `install.mp3`, `break.mp3` | `tools_01.ogg`, `tools_03.ogg`, `lock_open_01.ogg`, `wood_breaking_01.ogg` |
| **qubodup**, [Door Open, Door Close Set](https://opengameart.org/content/door-open-door-close-set), CC0 | `door-open.mp3`, `door-close.mp3` | `qubodup-DoorOpen01.ogg`, `qubodup-DoorClose01.ogg` |
| **artisticdude**, [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack), CC0 | `swing-1.mp3`, `swing-2.mp3` | `swish-1.wav`, `swish-4.wav`. Author describes physically recording a clothes hanger and wooden sticks swung past a camcorder microphone. |
| **michorvath**, [20 gauge shotgun gunshot](https://freesound.org/people/michorvath/sounds/427595/), CC0 | `shot.mp3` | Author's public [HQ MP3 preview](https://cdn.freesound.org/previews/427/427595_3094998-hq.mp3), a real shotgun recording. |

Unless explicitly described otherwise, effects were high-passed at 55 Hz, low-passed at 8.5 kHz, trimmed at leading silence, levelled conservatively and converted to MP3 VBR quality 2 at 44.1 kHz. Original texture and variation were retained. Individual processing chains, file hashes, measured RMS/peak levels and decoded durations are in `manifest.json`.

The recordings were checked for successful decoding, duration, non-silence and level headroom. No subjective listening claim is implied by those technical checks.
