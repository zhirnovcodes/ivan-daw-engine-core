# ivan-daw-engine-core: development and test plan

Status on 2026-11-19: phases 1–3 done. `v0.1.0` is tagged; the playground runs locally; CI is set up.

## Answers to the open questions

**Q: What is the parameter for the curvature of the filter slope?**
The *slope* (also called the filter *order*), measured in dB per octave: how fast the response falls past the
cutoff. Each 2-pole stage gives 12 dB/oct; two stages in a row give 24 dB/oct. It is `FilterParams::slope`
(`Db12`, `Db24`). Resonance (`res`) is a different thing: it shapes the knee *at* the cutoff (flat → peak),
not the steepness after it. A continuous "slope" knob is possible later (cross-fade the 12 and 24 dB outputs),
but the stepped choice is what most synths expose.

**Q: Give me 3 types of unison.** (`UnisonType`, `param` means something different per type)

| Type | What each voice is | `param` | Sound |
| --- | --- | --- | --- |
| `Detune` | The input pitch-shifted by a fixed amount, spread from −param to +param cents | 0..100 cents | Supersaw-style thickness on any sound. ~16 ms latency |
| `Chorus` | The input through a delay swung by a slow LFO, each voice at its own rate and phase | 0..10 ms depth | Ensemble / drifting, moving width |
| `Spread` | The input at a fixed time offset, spread from 0 to param ms | 0..50 ms | Doubler at small values, flam / slap at large ones |

In every type voices are panned evenly from hard left to hard right, and the sum is scaled by 1/√voices so the
level holds when the count changes.

**Q: Pack this repo as a library that plugin repos read.**
It is a CMake static library, target `ivandaw::engine_core`. A plugin repo adds it with `FetchContent` pinned to
a git tag (see README), exactly like ivan-daw pins `ivandaw-core` by tag. Header-only was rejected: separate
`.cpp` files keep plugin build times down and let the core flags stay private to this library. Versioning:
semver tags (`v0.1.0`…); while on 0.x a changed params struct or signature bumps the minor version.

**Q: A localhost test page per effect, but plugin repos take only the library.**
`apps/playground/` (planned, phase 2): a Vite multi-page app (`index.html`, `delay.html`, `reverb.html`,
`filter.html`, `unison.html`) over a dedicated wasm build of this library. It is isolated three ways:
1. CMake builds the playground wasm and the tests only when this repo is the top-level project
   (`PROJECT_IS_TOP_LEVEL`), so `FetchContent_MakeAvailable` in a plugin builds the library and nothing else.
2. The playground is its own pnpm package, not a workspace member of any plugin.
3. Plugins depend on a CMake target, never on anything under `apps/`.

**Q: When does FetchContent run?**
At **CMake configure time of the plugin** (`cmake -S . -B build`, or `emcmake cmake …` for wasm), not at
build time and never at runtime. It clones the pinned tag into `build/_deps/ivandaw_engine_core-src` and
then builds the library as part of the plugin's build.
- Once per build folder: later configures and builds reuse the clone, with no network.
- Changing `GIT_TAG` re-fetches on the next configure. A fresh CI runner fetches every run (seconds; the
  repo is public, so no token is needed).
- It works for plugins only after this repo is **pushed and tagged** (`v0.1.0`). Until then nothing can fetch it.
- Working on both repos at once: configure the plugin with
  `-DFETCHCONTENT_SOURCE_DIR_IVANDAW_ENGINE_CORE=C:/Work/IvanDAW/ivan-daw-engine-core` to use the local
  checkout instead of the tag. No push or tag needed, and edits here rebuild in the plugin immediately.

## Decisions (agreed with Ivan on 2026-11-19)

1. **Every effect has `mix`** (0 dry … 1 effect only): Delay, Reverb, Filter, Unison. Unison note: Detune voices
   lag ~16 ms, so a Detune mix between 0 and 1 also adds a short comb/flam.
2. **Reverb `decay` is seconds (RT60)** and each comb gets the exact gain for that tail time at its own length.
   `feedback` (0..1) scales that gain, as Beatality's wet mix scales its feedback: 0 = only first reflections.
3. **Delay `feedback` is capped at 0.95** (Beatality's value) so a tail always dies.
4. **Delay `Reset()` is O(1)**, Beatality's trick: it rewinds a fill counter instead of zeroing 4 s of audio,
   and reads older than the frames written since Reset return silence.
5. **No tempo sync in this library.** `delayTime` is seconds; a plugin converts beats with `beats * 60 / bpm`.
6. **No echo fade-in after Reset** (Beatality's 4–10 ms attack). Left out on purpose; not planned.
7. **Filter is a TPT state-variable filter**, not Beatality's per-sample biquad: one structure yields low,
   band and high together (Morph is free) and it stays stable when the cutoff moves every sample.
8. **Morph semantics**: `filterPosition` is both the cutoff and the morph axis. Below `morphLow` it is a
   low-pass, it cross-fades to band-pass by the midpoint, then to high-pass by `morphHigh`. So one knob sweeps
   "dark low-pass → resonant band → thin high-pass". `MorphMix()` is public so a UI can draw it.
9. **Band-pass is normalised** to 0 dB at its peak so Morph doesn't jump in level between modes.
10. **Smoothing**: delay time 50 ms (glides, bends pitch like tape), filter position 5 ms, unison param 20 ms.
   Changing the unison type or voice count restarts the voices (may click; it's a preset-level change).

## Phases

### Phase 1: effects + native tests (done)

- [x] `Delay`, `Reverb`, `Filter`, `Unison` with `Apply` / `Reset`
- [x] CMake library target + alias, core flags private
- [x] 4 test executables under CTest (33 test cases)
- [x] `mix` on every effect
- [x] Test sample: `apps/playground/public/samples/breakbeat-115bpm.wav`
- [x] Compiles clean with `em++ -fno-exceptions -fno-rtti -Wall -Wextra`

### Phase 2: playground (done)

```
apps/playground/
  package.json            @ivandaw-engine-core/playground: build:wasm, dev, typecheck, build, test
  vite.config.ts          multi-page: index + one page per effect
  index.html, delay.html, reverb.html, filter.html, unison.html
  public/fx-worklet.js    AudioWorkletProcessor: owns the wasm instance (plain JS, served as-is)
  public/samples/         breakbeat-115bpm.wav
  src/fields.ts           param schema per effect; field indices match playground/abi.cpp
  src/rig.ts              shared: nav, input picker, play, bypass, Reset(), fire click, params table, scope, spectrum
  src/plot.ts             fixed canvas colours (the pages have no stylesheet)
  src/filterResponse.ts   SVF magnitude response + MorphMix, same formulas as src/Filter.cpp
  src/pages/<effect>.ts   per-page extras (filter response + morph weights, unison voice map)
  scripts/build-wasm.mjs  emcmake + ninja → public/engine_core_playground.wasm (git-ignored)
  scripts/wasm-smoke.mjs  Node: every effect through the wasm ABI, delay echo timing, mix 0 is dry
playground/abi.cpp        C ABI: fxp_create/destroy/set/bypass/reset/process/alloc/free
```

- Served at http://127.0.0.1:5290 (own port; 5173/5180 belong to IvanDAW and Beatality). Default browser
  look, no stylesheet; every params property is a number field or an enum dropdown, defaults = the C++ defaults.
- Inputs: breakbeat sample, saw chord, clicks, white noise, audio file, microphone, silence (hear the tail).
- Checked: `pnpm build` green, wasm smoke test green, pages render in headless Chrome, and an offline render
  through the real worklet puts delay echoes at 100/200/300 ms with gains 1/0.5/0.25.

### Phase 3: CI + first tag

- [x] Tag `v0.1.0` (library only; playground and CI are outside the library).
- [x] `.github/workflows/ci.yml`: gcc, clang, MSVC build + `ctest`; emscripten job builds the playground wasm,
  runs the smoke test, builds the site and uploads it as an artifact.
- [ ] Optional: publish the built playground to GitHub Pages so it can be tried without cloning.

### Phase 4: first consumer

- Wire one plugin (the next new plugin, or Beatality as a refactor) to `ivandaw::engine_core` via FetchContent.
- Add its params to the plugin's `params.json` and map them onto the structs in `Engine::setParam`.
- Check the plugin's block-size-independence test still passes with the effects in the chain.

### Phase 5: improvements (backlog, by value)

- Delay: ping-pong and stereo-offset modes.
- Reverb: `damp` and `width` params; pre-delay; cheaper Reset (fill counter like Delay).
- Filter: continuous slope morph 12↔24; drive/saturation inside the loop.
- Unison: cheaper window (lookup table instead of `sin`) if the perf bench asks for it.
- Perf bench executable (no core flags, like Beatality's `perf_bench`): frames/second per effect, 8 voices.

## Test plan

### Native unit tests (`tests/`, CTest) — exist now

| Effect | What is checked |
| --- | --- |
| Delay | Echo lands at exactly `delayTime`; each repeat is ×`feedback`; mix 0 is bit-exact dry; after `Reset()` stale audio is never read; feedback above the cap still dies in 10 s; a time jump glides with no step; NaN params and a 100 s request stay finite; deltaTime 0 passes through |
| Reverb | Tail drops 22–45 dB per second at RT60 = 2 s; 4 s rings > 100× louder than 0.5 s after 1 s; feedback 0 leaves only early reflections; mix 0 is dry; `Reset()` gives exact silence; decay 1e9 and NaN stay bounded; L and R differ (stereo spread) |
| Filter | `mix` 0 is dry, 0.5 is the exact average; cutoff mapping 20 Hz / 1 kHz / 20 kHz; LP passes 100 Hz, −3 dB at cutoff, kills 10 kHz; HP mirror; BP 0 dB at peak, low a decade away; 24 dB slope ≈ double the 12 dB attenuation; res 1 peaks > 15×; `MorphMix` endpoints, midpoints, swapped and collapsed bounds, always sums to 1; Morph below `morphLow` is bit-identical to Low; full-resonance sweep across every type and slope stays finite; `Reset()` clears state |
| Unison | `mix` 0 is dry, 0.5 blends exactly; one Spread voice is the input; Spread offsets and pans land on the right frames and channels; Detune shifts a 440 Hz sine by ±100 cents within 1.5 %; one Detune voice is a pure 16 ms delay; Chorus is bounded and keeps level; voice count and param are clamped; `Reset()` clears the line |

### To add

- **Block / chain determinism**: run each effect frame-by-frame vs. in blocks of 1, 64, 128, 512, 4096 inside a
  dummy Engine and compare bit-for-bit (the plugin rule from `01-architecture.md`).
- **Sample rates**: rerun the timing tests at 44.1 k, 48 k, 96 k.
- **Denormals**: feed silence after a loud tail for 60 s; time per frame must not rise.
- **No allocation**: on Linux CI, override `operator new` in a test to abort if called after construction.
- **wasm parity**: run the same inputs through the native build and the playground wasm, compare within 1e-6.
- **Listening checklist** in the playground before each tag: no clicks on param jumps, on Reset, on bypass;
  no runaway at extreme settings; level roughly constant across Morph and voice counts.
