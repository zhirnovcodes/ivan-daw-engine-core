#include "TestKit.h"

#include <cmath>
#include <limits>

using namespace ivandaw::fx;
using namespace kit;

namespace {

void testEchoesAtDelayTimeAndDecayByFeedback() {
    Delay delay(kRate);
    const DelayParams p{0.01f, 0.5f, 1.0f}; // 480 frames
    const Signal out = run(delay, p, impulse(2000));
    CHECK_NEAR(out[0].l, 0.0, 1e-6);           // mix 1: echoes only
    CHECK_NEAR(out[480].l, 1.0, 1e-3);
    CHECK_NEAR(out[960].l, 0.5, 1e-3);
    CHECK_NEAR(out[1440].r, 0.25, 1e-3);
    CHECK_NEAR(rmsL(out, 1, 470), 0.0, 1e-6);  // nothing between the impulse and the first echo
}

void testMixZeroIsDry() {
    Delay delay(kRate);
    const Signal in = noise(4800);
    const Signal out = run(delay, DelayParams{0.01f, 0.9f, 0.0f}, in);
    bool same = true;
    for (std::size_t i = 0; i < in.size(); ++i) {
        same = same && out[i].l == in[i].l && out[i].r == in[i].r;
    }
    CHECK(same);
}

void testResetForgetsOldAudio() {
    Delay delay(kRate);
    const DelayParams p{0.01f, 0.9f, 1.0f};
    run(delay, p, noise(frames(1.0)));
    delay.Reset();
    const Signal out = run(delay, p, impulse(600));
    CHECK_NEAR(rmsL(out, 0, 470), 0.0, 1e-9); // the line was not zeroed, but none of it is read
    CHECK_NEAR(out[480].l, 1.0, 1e-3);
}

void testFeedbackIsClampedSoTheTailDies() {
    Delay delay(kRate);
    const Signal out = run(delay, DelayParams{0.01f, 5.0f, 1.0f}, impulse(frames(10.0)));
    CHECK(allFinite(out, 1.5f));
    CHECK(rmsL(out, frames(9.5), frames(10.0)) < 1e-4);
}

void testTimeChangeGlidesWithoutAClick() {
    Delay delay(kRate);
    const Signal in = sine(440.0f, frames(1.0));
    float worst = 0.0f;
    Sample prev{};
    for (int i = 0; i < frames(1.0); ++i) {
        const DelayParams p{i < frames(0.5) ? 0.1f : 0.2f, 0.0f, 1.0f};
        const Sample s = delay.Apply(p, in[static_cast<std::size_t>(i)], kDt);
        if (i > frames(0.2)) {
            worst = std::fmax(worst, std::fabs(s.l - prev.l));
        }
        prev = s;
    }
    // A 0.5 sine at 440 Hz moves at most 0.029 per frame; the glide bends the pitch but never jumps.
    CHECK(worst < 0.15f);
}

void testBadInputIsSafe() {
    Delay delay(kRate, 1.0f);
    const float nan = std::numeric_limits<float>::quiet_NaN();
    const Signal out = run(delay, DelayParams{100.0f, nan, nan}, noise(frames(0.5)));
    CHECK(allFinite(out, 1.0f));
    const Sample same = delay.Apply(DelayParams{}, Sample{0.3f, -0.2f}, 0.0f); // bad deltaTime: pass through
    CHECK(same.l == 0.3f && same.r == -0.2f);
}

} // namespace

int main() {
    g_file = "delay_tests.cpp";
    testEchoesAtDelayTimeAndDecayByFeedback();
    testMixZeroIsDry();
    testResetForgetsOldAudio();
    testFeedbackIsClampedSoTheTailDies();
    testTimeChangeGlidesWithoutAClick();
    testBadInputIsSafe();
    return finish("delay");
}
