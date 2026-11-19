#include "ivandaw/fx/Unison.h"

#include "Dsp.h"

#include <cmath>
#include <cstddef>
#include <new>

namespace ivandaw::fx {

namespace {

constexpr float kLineSec = 0.06f;
constexpr float kParamGlideSec = 0.02f;

// Detune: a two-tap delay pitch shifter. Each tap's delay ramps through a window and jumps back;
// the taps are half a window apart and cross-fade (sin^2 + cos^2 = 1) so the jump is never heard.
constexpr float kMaxCents = 100.0f;
constexpr float kShiftMinSec = 0.001f;
constexpr float kShiftWindowSec = 0.03f;

// Chorus: the LFO swings the delay from kChorusBaseSec up by `depth`.
constexpr float kMaxChorusMs = 10.0f;
constexpr float kChorusBaseSec = 0.005f;
constexpr double kChorusRateMinHz = 0.25;
constexpr double kChorusRateMaxHz = 0.9;

constexpr float kMaxSpreadMs = 50.0f;

// Voice i of n sits at -1 .. +1: its share of the detune or offset, and its pan.
float spreadOf(int i, int n) {
    return n > 1 ? -1.0f + 2.0f * static_cast<float>(i) / static_cast<float>(n - 1) : 0.0f;
}

float paramMax(UnisonType type) {
    switch (type) {
    case UnisonType::Detune:
        return kMaxCents;
    case UnisonType::Chorus:
        return kMaxChorusMs;
    case UnisonType::Spread:
        return kMaxSpreadMs;
    }
    return 0.0f;
}

double wrap(double phase) { return phase - std::floor(phase); }

} // namespace

Unison::Unison(double sampleRate) {
    const long long frames = std::llround(sampleRate * kLineSec) + 4;
    const int capacity = frames > 8 ? static_cast<int>(frames) : 8;
    left_.reset(new (std::nothrow) float[static_cast<std::size_t>(capacity)]());
    right_.reset(new (std::nothrow) float[static_cast<std::size_t>(capacity)]());
    capacity_ = (left_ && right_) ? capacity : 0;
}

// age 0 = the frame written this call. Linear interpolation between whole frames.
float Unison::read(const float* line, float age) const {
    const float a = dsp::clamp(age, 0.0f, static_cast<float>(capacity_ - 2));
    const int whole = static_cast<int>(a);
    const float frac = a - static_cast<float>(whole);
    int i0 = write_ - 1 - whole;
    if (i0 < 0) {
        i0 += capacity_;
    }
    int i1 = i0 - 1;
    if (i1 < 0) {
        i1 += capacity_;
    }
    const float s0 = line[static_cast<std::size_t>(i0)];
    return s0 + (line[static_cast<std::size_t>(i1)] - s0) * frac;
}

void Unison::restart(UnisonType type, int voices) {
    type_ = type;
    voices_ = voices;
    // param is cents for one type and milliseconds for another: never glide from one into the other.
    param_ = -1.0f;
    for (int i = 0; i < kMaxVoices; ++i) {
        // Detune starts every window at 0, so a voice at 0 cents is one clean tap, not two.
        // Chorus spreads the LFOs around the circle so the voices never move together.
        phase_[i] = type == UnisonType::Chorus ? static_cast<double>(i) / static_cast<double>(kMaxVoices) : 0.0;
    }
}

Sample Unison::Apply(const UnisonParams& params, Sample sample, float deltaTime) {
    if (capacity_ == 0 || !(deltaTime > 0.0f)) {
        return sample;
    }
    const int voices = params.voices < 1 ? 1 : (params.voices > kMaxVoices ? kMaxVoices : params.voices);
    if (params.type != type_ || voices != voices_) {
        restart(params.type, voices);
    }
    const float target = dsp::clamp(params.param, 0.0f, paramMax(params.type));
    if (param_ < 0.0f) {
        param_ = target;
    } else {
        param_ += (target - param_) * dsp::smoothStep(deltaTime, kParamGlideSec);
    }

    left_[static_cast<std::size_t>(write_)] = sample.l;
    right_[static_cast<std::size_t>(write_)] = sample.r;
    if (++write_ >= capacity_) {
        write_ = 0;
    }

    const float framesPerSec = 1.0f / deltaTime;
    float outL = 0.0f;
    float outR = 0.0f;
    for (int i = 0; i < voices; ++i) {
        const float spread = spreadOf(i, voices);
        float l = 0.0f;
        float r = 0.0f;
        switch (type_) {
        case UnisonType::Detune: {
            const float window = kShiftWindowSec * framesPerSec;
            const float ratio = std::exp2(param_ * spread / 1200.0f);
            // The delay changes by (1 - ratio) frames per frame: shrinking reads faster, so the pitch rises.
            phase_[i] = wrap(phase_[i] + static_cast<double>((1.0f - ratio) / window));
            const float pa = static_cast<float>(phase_[i]);
            const float pb = static_cast<float>(wrap(phase_[i] + 0.5));
            const float base = kShiftMinSec * framesPerSec;
            const float sa = std::sin(dsp::kPi * pa);
            const float wa = sa * sa;
            const float wb = 1.0f - wa;
            l = read(left_.get(), base + pa * window) * wa + read(left_.get(), base + pb * window) * wb;
            r = read(right_.get(), base + pa * window) * wa + read(right_.get(), base + pb * window) * wb;
            break;
        }
        case UnisonType::Chorus: {
            const double t = voices > 1 ? static_cast<double>(i) / static_cast<double>(voices - 1) : 0.0;
            const double rate = kChorusRateMinHz + (kChorusRateMaxHz - kChorusRateMinHz) * t;
            phase_[i] = wrap(phase_[i] + rate * static_cast<double>(deltaTime));
            const float swing = 0.5f + 0.5f * std::sin(2.0f * dsp::kPi * static_cast<float>(phase_[i]));
            const float age = (kChorusBaseSec + param_ * 0.001f * swing) * framesPerSec;
            l = read(left_.get(), age);
            r = read(right_.get(), age);
            break;
        }
        case UnisonType::Spread: {
            // Voice 0 is the original, the last voice is the full offset.
            const float share = voices > 1 ? static_cast<float>(i) / static_cast<float>(voices - 1) : 0.0f;
            const float age = param_ * 0.001f * share * framesPerSec;
            l = read(left_.get(), age);
            r = read(right_.get(), age);
            break;
        }
        }
        // Balance pan: centre keeps both sides, hard left keeps only the left.
        outL += l * (spread > 0.0f ? 1.0f - spread : 1.0f);
        outR += r * (spread < 0.0f ? 1.0f + spread : 1.0f);
    }
    const float gain = 1.0f / std::sqrt(static_cast<float>(voices));
    const float mix = dsp::clamp01(params.mix);
    return {sample.l + (outL * gain - sample.l) * mix, sample.r + (outR * gain - sample.r) * mix};
}

void Unison::Reset() {
    for (int i = 0; i < capacity_; ++i) {
        left_[static_cast<std::size_t>(i)] = 0.0f;
        right_[static_cast<std::size_t>(i)] = 0.0f;
    }
    write_ = 0;
    restart(type_, voices_);
}

} // namespace ivandaw::fx
