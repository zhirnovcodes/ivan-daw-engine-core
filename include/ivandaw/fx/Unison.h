#pragma once

#include "Sample.h"

#include <cstdint>
#include <memory>

namespace ivandaw::fx {

// How the copies of the input differ. `UnisonParams::param` means something different for each.
enum class UnisonType : std::uint8_t {
    // Supersaw-style: every voice is pitch-shifted by a fixed amount, spread evenly from -param to +param
    // cents. param = 0..100 cents. Latency ~16 ms (the pitch shifter's window).
    Detune,
    // Ensemble: every voice is delayed by a slow LFO, each at its own rate and phase, so the copies drift
    // around the original pitch. param = LFO depth, 0..10 ms.
    Chorus,
    // Doubler: every voice is a fixed time offset, spread evenly from 0 to param milliseconds.
    // param = 0..50 ms. Small values widen, large values sound like a slap or a flam.
    Spread,
};

struct UnisonParams {
    UnisonType type = UnisonType::Detune;
    int voices = 4;     // 1..Unison::kMaxVoices. Voices are panned evenly from hard left to hard right.
    float param = 15.0f; // see UnisonType. Glides over 20 ms.
    // 0 dry .. 1 voices only. Detune voices lag the dry signal by ~16 ms, so a Detune mix in between
    // also adds a short comb/flam; Spread and Chorus blend cleanly.
    float mix = 1.0f;
};

// Plays the input `voices` times and stacks the copies. Output gain is 1/sqrt(voices) so the level holds
// when the count changes. One input line per channel is shared by every voice; it is allocated in the
// constructor (60 ms) and Reset() zeroes it.
class Unison {
public:
    static constexpr int kMaxVoices = 8;

    explicit Unison(double sampleRate);

    Sample Apply(const UnisonParams& params, Sample sample, float deltaTime);
    void Reset();

private:
    float read(const float* line, float age) const;
    void restart(UnisonType type, int voices);

    std::unique_ptr<float[]> left_;
    std::unique_ptr<float[]> right_;
    int capacity_ = 0;
    int write_ = 0;
    double phase_[kMaxVoices]{}; // Detune: window phase. Chorus: LFO phase.
    float param_ = -1.0f;        // smoothed; < 0 until the first Apply after Reset()
    UnisonType type_ = UnisonType::Detune;
    int voices_ = 0;
};

} // namespace ivandaw::fx
