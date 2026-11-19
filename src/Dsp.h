#pragma once

// Small helpers shared by the effects. Private to the library.

namespace ivandaw::fx::dsp {

constexpr float kPi = 3.14159265358979323846f;

// NaN-safe: a NaN lands on lo.
inline float clamp(float x, float lo, float hi) {
    if (!(x > lo)) {
        return lo;
    }
    return x < hi ? x : hi;
}

inline float clamp01(float x) { return clamp(x, 0.0f, 1.0f); }

// Denormals cost a lot on x86 and show up in every decaying tail.
inline float flush(float x) { return (x > -1.0e-15f && x < 1.0e-15f) ? 0.0f : x; }

// One-pole smoothing step for a time constant of `seconds`.
inline float smoothStep(float deltaTime, float seconds) { return deltaTime / (seconds + deltaTime); }

} // namespace ivandaw::fx::dsp
