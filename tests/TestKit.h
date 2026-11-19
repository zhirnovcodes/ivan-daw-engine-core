#pragma once

// Beatality-style test kit: CHECK prints FAIL lines, main returns the failure count.

#include "ivandaw/fx.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <vector>

namespace kit {

inline int g_failed = 0;
inline const char* g_file = "";

inline void check(bool ok, const char* text, int line) {
    if (!ok) {
        std::printf("FAIL %s:%d  %s\n", g_file, line, text);
        ++g_failed;
    }
}

#define CHECK(cond) kit::check(static_cast<bool>(cond), #cond, __LINE__)
#define CHECK_NEAR(a, b, tol) kit::check(std::fabs(static_cast<double>(a) - static_cast<double>(b)) <= (tol), #a " ~ " #b, __LINE__)

constexpr double kRate = 48000.0;
constexpr float kDt = static_cast<float>(1.0 / kRate);
constexpr float kPi = 3.14159265358979323846f;

inline int frames(double seconds) { return static_cast<int>(seconds * kRate); }

using Signal = std::vector<ivandaw::fx::Sample>;

inline Signal silence(int n) { return Signal(static_cast<std::size_t>(n)); }

inline Signal impulse(int n) {
    Signal s = silence(n);
    s[0] = {1.0f, 1.0f};
    return s;
}

inline Signal sine(float hz, int n, float amp = 0.5f) {
    Signal s(static_cast<std::size_t>(n));
    for (int i = 0; i < n; ++i) {
        const float v = amp * std::sin(2.0f * kPi * hz * static_cast<float>(i) * kDt);
        s[static_cast<std::size_t>(i)] = {v, v};
    }
    return s;
}

// Deterministic white noise in -amp..amp (xorshift).
inline Signal noise(int n, float amp = 0.5f) {
    Signal s(static_cast<std::size_t>(n));
    std::uint32_t x = 0x9E3779B9u;
    auto next = [&] {
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        return static_cast<float>(x) / 4294967295.0f * 2.0f - 1.0f;
    };
    for (auto& f : s) {
        f = {amp * next(), amp * next()};
    }
    return s;
}

// Runs every frame of `in` through `fx` with the same params.
template <class Fx, class Params>
Signal run(Fx& fx, const Params& params, const Signal& in) {
    Signal out(in.size());
    for (std::size_t i = 0; i < in.size(); ++i) {
        out[i] = fx.Apply(params, in[i], kDt);
    }
    return out;
}

inline double rmsL(const Signal& s, int from, int to) {
    double sum = 0.0;
    for (int i = from; i < to; ++i) {
        sum += static_cast<double>(s[static_cast<std::size_t>(i)].l) * s[static_cast<std::size_t>(i)].l;
    }
    return std::sqrt(sum / (to - from));
}

inline double rmsR(const Signal& s, int from, int to) {
    double sum = 0.0;
    for (int i = from; i < to; ++i) {
        sum += static_cast<double>(s[static_cast<std::size_t>(i)].r) * s[static_cast<std::size_t>(i)].r;
    }
    return std::sqrt(sum / (to - from));
}

inline double db(double ratio) { return 20.0 * std::log10(ratio); }

inline bool allFinite(const Signal& s, float limit) {
    for (const auto& f : s) {
        if (!std::isfinite(f.l) || !std::isfinite(f.r) || std::fabs(f.l) > limit || std::fabs(f.r) > limit) {
            return false;
        }
    }
    return true;
}

// Frequency from rising zero crossings of one channel.
inline double frequency(const Signal& s, bool left, int from, int to) {
    int first = -1;
    int last = -1;
    int count = 0;
    for (int i = from + 1; i < to; ++i) {
        const float a = left ? s[static_cast<std::size_t>(i - 1)].l : s[static_cast<std::size_t>(i - 1)].r;
        const float b = left ? s[static_cast<std::size_t>(i)].l : s[static_cast<std::size_t>(i)].r;
        if (a <= 0.0f && b > 0.0f) {
            if (first < 0) {
                first = i;
            } else {
                ++count;
            }
            last = i;
        }
    }
    return count > 0 ? count / ((last - first) / kRate) : 0.0;
}

inline int finish(const char* name) {
    if (g_failed == 0) {
        std::printf("ok %s\n", name);
    }
    return g_failed;
}

} // namespace kit
