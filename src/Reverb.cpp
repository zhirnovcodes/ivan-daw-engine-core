#include "ivandaw/fx/Reverb.h"

#include "Dsp.h"

#include <cmath>
#include <cstddef>
#include <new>

namespace ivandaw::fx {

namespace {

// Freeverb constants, as in Beatality.
constexpr float kDamp = 0.2f;
constexpr float kAllpassGain = 0.5f;
constexpr float kInputGain = 0.015f;
constexpr float kWetGain = 3.0f;
constexpr int kCombs[8] = {1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617};
constexpr int kAllpasses[4] = {556, 441, 341, 225};
constexpr int kSpread = 23;

// Freeverb's largest room. Above this the damped combs ring for minutes.
constexpr float kMaxCombGain = 0.98f;
constexpr float kMinDecaySec = 0.05f;
constexpr float kMaxDecaySec = 30.0f;

int lengthOf(int tuning, double sampleRate) {
    const int length = static_cast<int>(std::lround(static_cast<double>(tuning) * sampleRate / 44100.0));
    return length > 0 ? length : 1;
}

} // namespace

Reverb::Reverb(double sampleRate) {
    int count = 0;
    auto place = [&](Stage& stage, int tuning) {
        stage.length = lengthOf(tuning, sampleRate);
        stage.offset = count;
        count += stage.length;
    };
    for (int i = 0; i < kCombCount; ++i) {
        place(combsL_[i], kCombs[i]);
        place(combsR_[i], kCombs[i] + kSpread);
    }
    for (int i = 0; i < kAllpassCount; ++i) {
        place(allL_[i], kAllpasses[i]);
        place(allR_[i], kAllpasses[i] + kSpread);
    }
    buffer_.reset(new (std::nothrow) float[static_cast<std::size_t>(count)]());
    bufferCount_ = buffer_ ? count : 0;
}

void Reverb::updateGains(float decay, float feedback, float deltaTime) {
    if (decay == decay_ && feedback == feedback_ && deltaTime == deltaTime_) {
        return;
    }
    decay_ = decay;
    feedback_ = feedback;
    deltaTime_ = deltaTime;
    // A comb of L frames loses 60 dB in `decay` seconds when its gain is 10^(-3 L dt / decay).
    auto gainOf = [&](const Stage& stage) {
        const float g = std::pow(10.0f, -3.0f * static_cast<float>(stage.length) * deltaTime / decay);
        return dsp::clamp(g * feedback, 0.0f, kMaxCombGain);
    };
    for (int i = 0; i < kCombCount; ++i) {
        combsL_[i].gain = gainOf(combsL_[i]);
        combsR_[i].gain = gainOf(combsR_[i]);
    }
}

float Reverb::comb(Stage& stage, float input) {
    float& cell = buffer_[static_cast<std::size_t>(stage.offset + stage.index)];
    const float output = cell;
    stage.store = dsp::flush(output * (1.0f - kDamp) + stage.store * kDamp);
    cell = dsp::flush(input + stage.store * stage.gain);
    if (++stage.index >= stage.length) {
        stage.index = 0;
    }
    return output;
}

float Reverb::allpass(Stage& stage, float input) {
    float& cell = buffer_[static_cast<std::size_t>(stage.offset + stage.index)];
    const float output = cell - input;
    cell = dsp::flush(input + cell * kAllpassGain);
    if (++stage.index >= stage.length) {
        stage.index = 0;
    }
    return output;
}

float Reverb::tank(Stage* combs, Stage* allpasses, float input) {
    const float scaled = input * kInputGain;
    float mixed = 0.0f;
    for (int i = 0; i < kCombCount; ++i) {
        mixed += comb(combs[i], scaled);
    }
    mixed *= kWetGain;
    for (int i = 0; i < kAllpassCount; ++i) {
        mixed = allpass(allpasses[i], mixed);
    }
    return mixed;
}

Sample Reverb::Apply(const ReverbParams& params, Sample sample, float deltaTime) {
    if (bufferCount_ == 0 || !(deltaTime > 0.0f)) {
        return sample;
    }
    updateGains(dsp::clamp(params.decay, kMinDecaySec, kMaxDecaySec), dsp::clamp01(params.feedback), deltaTime);
    const float wetL = tank(combsL_, allL_, sample.l);
    const float wetR = tank(combsR_, allR_, sample.r);
    const float mix = dsp::clamp01(params.mix);
    return {sample.l + (wetL - sample.l) * mix, sample.r + (wetR - sample.r) * mix};
}

void Reverb::Reset() {
    for (int i = 0; i < bufferCount_; ++i) {
        buffer_[static_cast<std::size_t>(i)] = 0.0f;
    }
    auto rewind = [](Stage* stages, int count) {
        for (int i = 0; i < count; ++i) {
            stages[i].index = 0;
            stages[i].store = 0.0f;
        }
    };
    rewind(combsL_, kCombCount);
    rewind(combsR_, kCombCount);
    rewind(allL_, kAllpassCount);
    rewind(allR_, kAllpassCount);
}

} // namespace ivandaw::fx
