#include "TestKit.h"

#include <limits>

using namespace ivandaw::fx;
using namespace kit;

namespace {

void testTailFallsAtRoughlyTheDecayRate() {
    Reverb reverb(kRate);
    const Signal out = run(reverb, ReverbParams{2.0f, 1.0f, 1.0f}, impulse(frames(3.0)));
    const double early = rmsL(out, frames(0.2), frames(0.3));
    const double late = rmsL(out, frames(1.2), frames(1.3));
    CHECK(early > 1e-4);
    // RT60 = 2 s is 30 dB per second. The comb damping takes the highs down a little faster.
    const double drop = db(early / late);
    if (!(drop > 22.0 && drop < 45.0)) {
        std::printf("  drop over 1 s = %.1f dB\n", drop);
    }
    CHECK(drop > 22.0 && drop < 45.0);
}

void testLongerDecayRingsLonger() {
    Reverb shortRoom(kRate);
    Reverb longRoom(kRate);
    const Signal a = run(shortRoom, ReverbParams{0.5f, 1.0f, 1.0f}, impulse(frames(2.0)));
    const Signal b = run(longRoom, ReverbParams{4.0f, 1.0f, 1.0f}, impulse(frames(2.0)));
    CHECK(rmsL(b, frames(1.0), frames(1.5)) > 100.0 * rmsL(a, frames(1.0), frames(1.5)));
}

void testFeedbackZeroLeavesOnlyFirstReflections() {
    Reverb reverb(kRate);
    const Signal out = run(reverb, ReverbParams{4.0f, 0.0f, 1.0f}, impulse(frames(0.5)));
    CHECK(rmsL(out, 0, frames(0.05)) > 1e-4);
    CHECK(rmsL(out, frames(0.3), frames(0.5)) < 1e-6);
}

void testMixZeroIsDry() {
    Reverb reverb(kRate);
    const Signal in = noise(4800);
    const Signal out = run(reverb, ReverbParams{2.0f, 1.0f, 0.0f}, in);
    bool same = true;
    for (std::size_t i = 0; i < in.size(); ++i) {
        same = same && out[i].l == in[i].l && out[i].r == in[i].r;
    }
    CHECK(same);
}

void testResetSilencesTheTail() {
    Reverb reverb(kRate);
    const ReverbParams p{10.0f, 1.0f, 1.0f};
    run(reverb, p, noise(frames(1.0)));
    reverb.Reset();
    const Signal out = run(reverb, p, silence(frames(0.5)));
    CHECK(rmsL(out, 0, frames(0.5)) == 0.0 && rmsR(out, 0, frames(0.5)) == 0.0);
}

void testExtremeParamsStayStable() {
    Reverb reverb(kRate);
    const float nan = std::numeric_limits<float>::quiet_NaN();
    CHECK(allFinite(run(reverb, ReverbParams{1.0e9f, 1.0f, 1.0f}, noise(frames(5.0))), 20.0f));
    CHECK(allFinite(run(reverb, ReverbParams{nan, nan, nan}, noise(frames(0.5))), 20.0f));
}

void testChannelsDiffer() {
    // The right tank is 23 frames longer per stage, so a mono input comes out wide.
    Reverb reverb(kRate);
    const Signal out = run(reverb, ReverbParams{2.0f, 1.0f, 1.0f}, impulse(frames(0.5)));
    double diff = 0.0;
    for (const auto& s : out) {
        diff += std::fabs(s.l - s.r);
    }
    CHECK(diff > 1e-2);
}

} // namespace

int main() {
    g_file = "reverb_tests.cpp";
    testTailFallsAtRoughlyTheDecayRate();
    testLongerDecayRingsLonger();
    testFeedbackZeroLeavesOnlyFirstReflections();
    testMixZeroIsDry();
    testResetSilencesTheTail();
    testExtremeParamsStayStable();
    testChannelsDiffer();
    return finish("reverb");
}
