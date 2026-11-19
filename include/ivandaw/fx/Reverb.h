#pragma once

#include "Sample.h"

#include <memory>

namespace ivandaw::fx {

struct ReverbParams {
    float decay = 2.0f;    // seconds: time for the tail to fall 60 dB (RT60) at feedback 1. Clamped to 0.05..30
    float feedback = 1.0f; // 0..1, scales the comb feedback. 0 = only the first reflections, 1 = the full decay
    float mix = 0.3f;      // 0 dry .. 1 wet only
};

// Freeverb tank (8 damped combs + 4 allpasses per channel), ported from Beatality's Reverb.
// Beatality derives the comb feedback from a beat length; here `decay` is in seconds and each comb gets
// the exact gain for that RT60 at its own length. The tank is allocated once in the constructor.
// The comb lengths are tuned for the constructor's sample rate; pass deltaTime = 1 / that rate.
class Reverb {
public:
    explicit Reverb(double sampleRate);

    Sample Apply(const ReverbParams& params, Sample sample, float deltaTime);
    void Reset(); // zeroes the tank (~25k floats at 48 kHz)

private:
    struct Stage {
        int length = 0;
        int index = 0;
        int offset = 0;
        float store = 0.0f; // comb damping state
        float gain = 0.0f;  // comb feedback
    };

    static constexpr int kCombCount = 8;
    static constexpr int kAllpassCount = 4;

    float comb(Stage& stage, float input);
    float allpass(Stage& stage, float input);
    float tank(Stage* combs, Stage* allpasses, float input);
    void updateGains(float decay, float feedback, float deltaTime);

    Stage combsL_[kCombCount]{};
    Stage combsR_[kCombCount]{};
    Stage allL_[kAllpassCount]{};
    Stage allR_[kAllpassCount]{};
    std::unique_ptr<float[]> buffer_;
    int bufferCount_ = 0;
    // The gains are recomputed only when one of these changes.
    float decay_ = -1.0f;
    float feedback_ = -1.0f;
    float deltaTime_ = -1.0f;
};

} // namespace ivandaw::fx
