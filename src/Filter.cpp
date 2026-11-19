#include "ivandaw/fx/Filter.h"

#include "Dsp.h"

#include <cmath>

namespace ivandaw::fx {

namespace {

constexpr float kMinHz = 20.0f;
constexpr float kMaxHz = 20000.0f;
constexpr float kButterworthQ = 0.70710678f;
constexpr float kMaxQ = 25.0f;
constexpr float kPositionGlideSec = 0.005f;

} // namespace

float FilterCutoffHz(float position) {
    return kMinHz * std::pow(kMaxHz / kMinHz, dsp::clamp01(position));
}

FilterMix MorphMix(float position, float morphLow, float morphHigh) {
    float lo = dsp::clamp01(morphLow);
    float hi = dsp::clamp01(morphHigh);
    if (lo > hi) {
        const float t = lo;
        lo = hi;
        hi = t;
    }
    const float p = dsp::clamp01(position);
    const float mid = 0.5f * (lo + hi);
    FilterMix mix;
    if (p <= lo) {
        mix.low = 1.0f;
    } else if (p >= hi) {
        mix.high = 1.0f;
    } else if (p < mid) {
        // lo < p < mid, so mid > lo here.
        const float t = (p - lo) / (mid - lo);
        mix.low = 1.0f - t;
        mix.band = t;
    } else {
        const float t = (p - mid) / (hi - mid);
        mix.band = 1.0f - t;
        mix.high = t;
    }
    return mix;
}

void Filter::updateCoeffs(float position, float res, float deltaTime) {
    if (position == cachedPosition_ && res == cachedRes_ && deltaTime == cachedDeltaTime_) {
        return;
    }
    cachedPosition_ = position;
    cachedRes_ = res;
    cachedDeltaTime_ = deltaTime;

    // Keep the cutoff under Nyquist; tan() blows up at half the sample rate.
    const float nyquistSafe = 0.45f / deltaTime;
    float hz = FilterCutoffHz(position);
    if (hz > nyquistSafe) {
        hz = nyquistSafe;
    }
    const float g = std::tan(dsp::kPi * hz * deltaTime);
    auto make = [g](float q) {
        Coeffs c;
        c.k = 1.0f / q;
        c.a1 = 1.0f / (1.0f + g * (g + c.k));
        c.a2 = g * c.a1;
        c.a3 = g * c.a2;
        return c;
    };
    resonant_ = make(kButterworthQ * std::pow(kMaxQ / kButterworthQ, res));
    flat_ = make(kButterworthQ);
}

float Filter::tick(State& s, const Coeffs& c, float x, const FilterMix& mix) {
    const float v3 = x - s.ic2;
    const float v1 = c.a1 * s.ic1 + c.a2 * v3;
    const float v2 = s.ic2 + c.a2 * s.ic1 + c.a3 * v3;
    s.ic1 = dsp::flush(2.0f * v1 - s.ic1);
    s.ic2 = dsp::flush(2.0f * v2 - s.ic2);
    const float low = v2;
    const float band = c.k * v1; // normalised: 0 dB at the peak whatever the resonance
    const float high = x - c.k * v1 - v2;
    return mix.low * low + mix.band * band + mix.high * high;
}

Sample Filter::Apply(const FilterParams& params, Sample sample, float deltaTime) {
    if (!(deltaTime > 0.0f)) {
        return sample;
    }
    const float target = dsp::clamp01(params.filterPosition);
    if (position_ < 0.0f) {
        position_ = target;
    } else {
        position_ += (target - position_) * dsp::smoothStep(deltaTime, kPositionGlideSec);
    }
    updateCoeffs(position_, dsp::clamp01(params.res), deltaTime);

    FilterMix mix;
    switch (params.type) {
    case FilterType::Low:
        mix.low = 1.0f;
        break;
    case FilterType::High:
        mix.high = 1.0f;
        break;
    case FilterType::Band:
        mix.band = 1.0f;
        break;
    case FilterType::Morph:
        mix = MorphMix(position_, params.morphLow, params.morphHigh);
        break;
    }

    // Turning the second stage on starts it from silence, not from a state left over from long ago.
    if (params.slope != slope_) {
        slope_ = params.slope;
        stages_[1][0] = {};
        stages_[1][1] = {};
    }

    float l = tick(stages_[0][0], resonant_, sample.l, mix);
    float r = tick(stages_[0][1], resonant_, sample.r, mix);
    if (slope_ == FilterSlope::Db24) {
        l = tick(stages_[1][0], flat_, l, mix);
        r = tick(stages_[1][1], flat_, r, mix);
    }
    const float wet = dsp::clamp01(params.mix);
    return {sample.l + (l - sample.l) * wet, sample.r + (r - sample.r) * wet};
}

void Filter::Reset() {
    for (auto& stage : stages_) {
        stage[0] = {};
        stage[1] = {};
    }
    position_ = -1.0f;
}

} // namespace ivandaw::fx
