#include "ivandaw/fx/Delay.h"

#include "Dsp.h"

#include <cmath>
#include <cstddef>
#include <new>

namespace ivandaw::fx {

namespace {

constexpr float kTimeGlideSec = 0.05f;

} // namespace

Delay::Delay(double sampleRate, float maxDelaySeconds) {
    const double seconds = maxDelaySeconds > 0.0f ? static_cast<double>(maxDelaySeconds) : 0.0;
    const long long frames = std::llround(sampleRate * seconds) + 2;
    const int capacity = frames > 4 ? static_cast<int>(frames) : 4;
    left_.reset(new (std::nothrow) float[static_cast<std::size_t>(capacity)]());
    right_.reset(new (std::nothrow) float[static_cast<std::size_t>(capacity)]());
    capacity_ = (left_ && right_) ? capacity : 0;
}

// age 1 = the frame written last.
float Delay::at(const float* line, int age) const {
    if (age > filled_) {
        return 0.0f;
    }
    int index = write_ - age;
    if (index < 0) {
        index += capacity_;
    }
    return line[static_cast<std::size_t>(index)];
}

Sample Delay::Apply(const DelayParams& params, Sample sample, float deltaTime) {
    if (capacity_ == 0 || !(deltaTime > 0.0f)) {
        return sample;
    }
    const float target = dsp::clamp(params.delayTime / deltaTime, 1.0f, static_cast<float>(capacity_ - 2));
    if (delay_ < 0.0f) {
        delay_ = target;
    } else {
        delay_ += (target - delay_) * dsp::smoothStep(deltaTime, kTimeGlideSec);
    }

    // Fractional read: a gliding delay time bends the pitch instead of stepping.
    const int whole = static_cast<int>(delay_);
    const float frac = delay_ - static_cast<float>(whole);
    const float l0 = at(left_.get(), whole);
    const float r0 = at(right_.get(), whole);
    const float echoL = l0 + (at(left_.get(), whole + 1) - l0) * frac;
    const float echoR = r0 + (at(right_.get(), whole + 1) - r0) * frac;

    const float feedback = dsp::clamp(params.feedback, 0.0f, kMaxFeedback);
    left_[static_cast<std::size_t>(write_)] = dsp::flush(sample.l + echoL * feedback);
    right_[static_cast<std::size_t>(write_)] = dsp::flush(sample.r + echoR * feedback);
    if (++write_ >= capacity_) {
        write_ = 0;
    }
    if (filled_ < capacity_) {
        ++filled_;
    }

    const float mix = dsp::clamp01(params.mix);
    return {sample.l + (echoL - sample.l) * mix, sample.r + (echoR - sample.r) * mix};
}

void Delay::Reset() {
    write_ = 0;
    filled_ = 0;
    delay_ = -1.0f;
}

} // namespace ivandaw::fx
