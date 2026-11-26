# Canyon Run — a chase-view canyon flight game

![Rank](https://make.fun/badge/best-flight-game-20261126-0057/phm2468/flight-game-canyon-run/rank.svg)
![Prize](https://make.fun/badge/best-flight-game-20261126-0057/phm2468/flight-game-canyon-run/prize.svg)
![Entries](https://make.fun/badge/best-flight-game-20261126-0057/phm2468/flight-game-canyon-run/entries.svg)

**Canyon Run** is a browser flight game: a chase-view, pseudo-3D run through a
winding canyon. Thread the glowing rings in order, skim the walls for speed,
and do not kiss the rock — one touch ends the run. A synthesized engine hum and
ring chimes come from the Web Audio API; there are no audio files.

## Play it

The game itself is the static bundle in `game/` — open `game/index.html` in a
browser, or serve the folder with any static file server. To run the entry
exactly as submitted (copies the game into `out/` and writes the dossier):

```
node main.ts        # Node 22+, no dependencies
```

## Controls

- **Arrow keys / WASD** — pitch and roll
- **Shift / Space** — boost
- **P** — pause, **M** — mute

## How it is built

- `game/` — the game: `index.html` + `src/` (world generation, flight model,
  renderer, audio, screenshot hooks) in dependency-free JavaScript.
- `screenshots/` — four real frames captured from the running game
  (title, flight, rings, end).
- `main.ts` — the competition entry point: stages the game into `out/` and
  writes `dossier.json` via the vendored kit helper in `vendor/`.
- Deterministic: the same input always produces the same `out/` tree and the
  same dossier, byte for byte.

## License

MIT — see `LICENSE`.
