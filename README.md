# Crystal Lake: Nightfall

Node.js 24+, npm install, npm start. PORT is supplied by the hosting provider.

Render: Web Service, Frankfurt, Free plan, build `npm ci --omit=dev`, start `npm start`, health `/health`. WebSocket endpoint is `/ws`; HTTP remains available as fallback.

Rooms and matches are held in server memory. A server restart clears rooms. Render Free sleeps after 15 minutes without incoming traffic; its next startup may take about one minute. No paid database, disk or plan is needed.

Audio authors and CC0 source links: public/audio/CREDITS.md.

The forest map uses winding roads, campgrounds, a hilltop radio station, a cemetery, and nine different interiors. Survivor bots remember danger, share nearby warnings, use exits and shelters, cover retreats with weapons and traps, and resume escape work after danger passes. Nine scarce repair parts are distributed between buildings and outdoor caches; destroyed parts return after a delay at a different cache. Role cards retain their DOM nodes; flashlight visibility uses a smoothed light origin and obstacle tangents.
