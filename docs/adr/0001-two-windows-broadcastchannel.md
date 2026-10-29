# Host Console and Stage are two browser windows synced over BroadcastChannel

The Stage (TV, extended display) and the Host Console (laptop screen) are two windows of the same static Vite app on the same machine. The Host Console owns the game state, autosaves it to `localStorage`, and broadcasts every new state over a `BroadcastChannel`; the Stage only renders what it receives. We chose this over a local server with WebSockets (needed only if Contestants used phones as buzzers or the Host controlled from a phone) because buzzing is handled by a physical lockout buzzer set and the Host sits at the laptop, so a backend would add moving parts — network, process to keep alive, latency — for no benefit.

## Consequences

- Both windows must be open in the same browser profile and origin; a second laptop or phone cannot join.
- If phone buzzers or a phone Host Console are ever wanted, the sync layer (`src/sync/`) is the seam to replace with a WebSocket server; the engine stays unchanged.
