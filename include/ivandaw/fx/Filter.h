#pragma once

#include "Sample.h"

#include <cstdint>

namespace ivandaw::fx {

enum class FilterType : std::uint8_t { Low, High, Band, Morph };

// The steepness of the slope past the cutoff. 12 dB/oct is one 2-pole stage, 24 dB/oct is two in a row.
// Resonance shapes the knee at the cutoff; the slope sets how fast the response falls after it.
enum class FilterSlope : std::uint8_t { Db12, Db24 };

struct FilterParams {
    FilterType type = FilterType::Low;
    float filterPosition = 1.0f; // 0..1, the cutoff on a log scale: 0 = 20 Hz, 0.5 = 632 Hz, 1 = 20 kHz
    float res = 0.0f;            // 0..1: 0 = flat (Butterworth, Q 0.707), 1 = Q 25, a ringing peak
    // Morph only. Positions on the same 0..1 axis as filterPosition:
    //   position <= morphLow             -> low-pass
    //   morphLow .. middle               -> low-pass fades into band-pass
    //   middle .. morphHigh              -> band-pass fades into high-pass
    //   position >= morphHigh            -> high-pass
    // where middle = (morphLow + morphHigh) / 2. If morphLow > morphHigh they are swapped.
    float morphLow = 0.25f;
    float morphHigh = 0.75f;
    FilterSlope slope = FilterSlope::Db12;
    float mix = 1.0f; // 0 dry .. 1 filtered only
};

// How much of each output a filter at `position` mixes in. The three always sum to 1.
struct FilterMix {
    float low = 0.0f;
    float band = 0.0f;
    float high = 0.0f;
};

// The Morph weights. Exposed so a plugin UI can draw the same curve the audio uses.
FilterMix MorphMix(float position, float morphLow, float morphHigh);

// Cutoff in Hz for a 0..1 position.
float FilterCutoffHz(float position);

// Stereo TPT state-variable filter (Zavalishin / Cytomic SVF). One structure produces low, band and high
// at once, so Morph costs no more than a single type, and it stays stable while the cutoff moves every sample.
// filterPosition glides over 5 ms so automation never zippers. No allocation; Reset() is a few stores.
class Filter {
public:
    Sample Apply(const FilterParams& params, Sample sample, float deltaTime);
    void Reset();

private:
    struct State {
        float ic1 = 0.0f;
        float ic2 = 0.0f;
    };
    struct Coeffs {
        float k = 1.0f;
        float a1 = 0.0f;
        float a2 = 0.0f;
        float a3 = 0.0f;
    };

    static float tick(State& state, const Coeffs& c, float x, const FilterMix& mix);
    void updateCoeffs(float position, float res, float deltaTime);

    State stages_[2][2]{}; // [stage][channel]
    Coeffs resonant_{};    // stage 1: the user's resonance
    Coeffs flat_{};        // stage 2 at 24 dB/oct: Butterworth, so the peak does not double
    float position_ = -1.0f; // smoothed; < 0 until the first Apply after Reset()
    float cachedPosition_ = -1.0f;
    float cachedRes_ = -1.0f;
    float cachedDeltaTime_ = -1.0f;
    FilterSlope slope_ = FilterSlope::Db12;
};

} // namespace ivandaw::fx
