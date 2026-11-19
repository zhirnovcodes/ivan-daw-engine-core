#pragma once

#include "Sample.h"

#include <memory>

namespace ivandaw::fx {

struct DelayParams {
    float delayTime = 0.25f; // seconds, 0..maxDelaySeconds. Changes glide over ~50 ms (tape-style), no clicks.
    float feedback = 0.4f;   // 0..1, clamped to Delay::kMaxFeedback so the tail always dies
    float mix = 0.5f;        // 0 dry .. 1 echoes only
};

// Stereo feedback delay, ported from Beatality's Delay.
// The line is allocated once in the constructor (never on the audio thread) and kept until destruction.
// Reset() does not zero the line: like Beatality it rewinds a fill counter, and a read older than the
// frames written since Reset() returns silence. Zeroing seconds of audio on the audio thread costs a spike.
class Delay {
public:
    // Full feedback would ring forever.
    static constexpr float kMaxFeedback = 0.95f;

    explicit Delay(double sampleRate, float maxDelaySeconds = 4.0f);

    // deltaTime = 1 / sampleRate. Returns the dry/echo mix for this frame.
    Sample Apply(const DelayParams& params, Sample sample, float deltaTime);
    void Reset();

private:
    float at(const float* line, int age) const;

    std::unique_ptr<float[]> left_;
    std::unique_ptr<float[]> right_;
    int capacity_ = 0;
    int write_ = 0;
    int filled_ = 0;      // frames written since Reset()
    float delay_ = -1.0f; // smoothed delay in frames; < 0 until the first Apply after Reset()
};

} // namespace ivandaw::fx
