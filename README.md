# ivan-daw-engine-core

Audio-thread effects shared by IvanDAW plugins: **Delay, Reverb, Filter, Unison**.
C++20, no exceptions, no RTTI, no allocation after construction. The same code builds into a plugin's
wasm (IvanDAW) and its JUCE build (VST3 / AU).

## Use it from a plugin repo

Pin a tag with CMake `FetchContent` and link one target:

```cmake
include(FetchContent)
FetchContent_Declare(ivandaw_engine_core
    GIT_REPOSITORY https://github.com/zhirnovcodes/ivan-daw-engine-core.git
    GIT_TAG v0.1.0
    GIT_SHALLOW TRUE)
FetchContent_MakeAvailable(ivandaw_engine_core)

target_link_libraries(<pfx>_engine PRIVATE ivandaw::engine_core)
```

Only the library target is built. Tests and the playground are switched off when this repo is not the
top-level CMake project (`IVANDAW_ENGINE_CORE_TESTS` defaults to `PROJECT_IS_TOP_LEVEL`), and the playground
is a separate pnpm package under `apps/` that CMake never touches.

```cpp
#include <ivandaw/fx.h>
using namespace ivandaw::fx;

// Construct off the audio thread: Delay, Reverb and Unison allocate their lines here.
Delay delay(sampleRate);           // optional 2nd arg: max delay seconds (default 4)
Reverb reverb(sampleRate);
Filter filter;
Unison unison(sampleRate);

// Audio thread, per frame:
const float dt = 1.0f / sampleRate;
Sample s{left[i], right[i]};
s = unison.Apply(unisonParams, s, dt);
s = filter.Apply(filterParams, s, dt);
s = delay.Apply(delayParams, s, dt);
s = reverb.Apply(reverbParams, s, dt);

// On a new note / slice / transport jump:
delay.Reset();
```

## Effects

| Effect | Params | Notes |
| --- | --- | --- |
| `Delay` | `delayTime` s, `feedback` 0..1 (capped 0.95), `mix` | Port of Beatality's Delay. `Reset()` is O(1). Time changes glide (tape-style). |
| `Reverb` | `decay` s (RT60), `feedback` 0..1, `mix` | Freeverb tank, port of Beatality's Reverb. `Reset()` zeroes ~25k floats. |
| `Filter` | `type` Low/High/Band/Morph, `filterPosition` 0..1 (20 Hz..20 kHz log), `res` 0..1, `morphLow`, `morphHigh`, `slope` 12/24 dB, `mix` | TPT state-variable filter. `MorphMix()` and `FilterCutoffHz()` are public for UIs. |
| `Unison` | `type` Detune/Chorus/Spread, `voices` 1..8, `param` (cents or ms), `mix` | One shared input line, voices panned left→right, gain 1/√voices. |

## Develop

```sh
cmake -S . -B build
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

### Playground (localhost page per effect)

Needs emsdk (`emcmake` on PATH) and Ninja.

```sh
cd apps/playground
pnpm i
pnpm build:wasm   # → public/engine_core_playground.wasm
pnpm test         # wasm smoke test in Node
pnpm dev          # open the printed URL: index, delay, reverb, filter, unison
```

See [docs/plan.md](docs/plan.md) for the roadmap, the test plan and the design decisions.
