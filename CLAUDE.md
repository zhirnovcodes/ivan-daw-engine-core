# ivan-daw-engine-core: rules for agents

Audio-thread effects (Delay, Reverb, Filter, Unison) shared by IvanDAW plugin cores. Plugin repos pull it with
CMake FetchContent pinned to a git tag and link `ivandaw::engine_core`. Plan and decisions: `docs/plan.md`.

## Layout

| Path | Holds |
| --- | --- |
| `include/ivandaw/fx/*.h` | Public API: one header per effect, `Sample.h`, umbrella `include/ivandaw/fx.h` |
| `src/*.cpp`, `src/Dsp.h` | Implementations; `Dsp.h` is private helpers |
| `tests/*_tests.cpp` | One plain executable per effect, Beatality style (`FAIL file:line` + non-zero exit), run by CTest |
| `playground/abi.cpp` | C ABI for the playground wasm; field numbers match `apps/playground/src/fields.ts` |
| `apps/playground/` | Vite page per effect over the wasm build; its own pnpm package, never part of the library |

## Rules

- Same layer rules as a plugin `core/`: C++20 std only, `-fno-exceptions -fno-rtti`, no JUCE, no emscripten,
  no files, threads, clocks or logging.
- Allocate only in constructors. `Apply()` and `Reset()` never allocate, lock or throw.
- Every effect: `Sample Apply(const XParams&, Sample, float deltaTime)` and `void Reset()`.
- Params are plain structs with defaults; clamp every field inside `Apply()` (NaN included).
- Smooth any param whose jump would click (delay time, filter position, unison param).
- Every public function gets tests. Build and run `ctest` before every push.
- The library must also compile with `em++` and the core flags (plugins ship as wasm).
- Changing a params struct or a signature is a breaking change: bump the minor version while on 0.x and tag it.
  Plugins pin tags, so nothing changes for them until they bump.

## Commands

```sh
cmake -S . -B build && cmake --build build --config Release && ctest --test-dir build -C Release --output-on-failure
cd apps/playground && pnpm i && pnpm build:wasm && pnpm test && pnpm dev   # needs emsdk + ninja
```

- A new params field: add it to the struct, to `playground/abi.cpp` and to `apps/playground/src/fields.ts`.
- Commit straight to `main`. Tag `vX.Y.Z` for every library change plugins need; CI must be green first.
