#include "TestKit.h"

#include <cmath>

using namespace ivandaw::fx;
using namespace kit;

namespace {

void testOneSpreadVoiceIsTheInput() {
    Unison unison(kRate);
    const Signal in = noise(4800);
    const Signal out = run(unison, UnisonParams{UnisonType::Spread, 1, 20.0f}, in);
    bool same = true;
    for (std::size_t i = 0; i < in.size(); ++i) {
        same = same && std::fabs(out[i].l - in[i].l) < 1e-6f && std::fabs(out[i].r - in[i].r) < 1e-6f;
    }
    CHECK(same);
}

void testSpreadOffsetsAndPans() {
    Unison unison(kRate);
    // 3 voices over 10 ms: 0 ms hard left, 5 ms centre, 10 ms hard right.
    const Signal out = run(unison, UnisonParams{UnisonType::Spread, 3, 10.0f}, impulse(1000));
    const double g = 1.0 / std::sqrt(3.0);
    CHECK_NEAR(out[0].l, g, 1e-4);
    CHECK_NEAR(out[0].r, 0.0, 1e-6);
    CHECK_NEAR(out[240].l, g, 1e-3);
    CHECK_NEAR(out[240].r, g, 1e-3);
    CHECK_NEAR(out[480].l, 0.0, 1e-3);
    CHECK_NEAR(out[480].r, g, 1e-3);
}

void testDetuneShiftsPitch() {
    Unison unison(kRate);
    // 2 voices: -100 cents hard left, +100 cents hard right.
    const Signal out = run(unison, UnisonParams{UnisonType::Detune, 2, 100.0f}, sine(440.0f, frames(3.0)));
    const double down = frequency(out, true, frames(0.1), frames(3.0));
    const double up = frequency(out, false, frames(0.1), frames(3.0));
    const double wantDown = 440.0 * std::pow(2.0, -100.0 / 1200.0);
    const double wantUp = 440.0 * std::pow(2.0, 100.0 / 1200.0);
    if (std::fabs(down / wantDown - 1.0) > 0.015 || std::fabs(up / wantUp - 1.0) > 0.015) {
        std::printf("  detune: left %.1f Hz (want %.1f), right %.1f Hz (want %.1f)\n", down, wantDown, up, wantUp);
    }
    CHECK(std::fabs(down / wantDown - 1.0) < 0.015);
    CHECK(std::fabs(up / wantUp - 1.0) < 0.015);
}

void testDetuneOneVoiceIsAPureDelay() {
    Unison unison(kRate);
    // 0 cents: one tap at 1 ms + half the 30 ms window = 16 ms = 768 frames.
    const Signal out = run(unison, UnisonParams{UnisonType::Detune, 1, 50.0f}, impulse(1000));
    CHECK_NEAR(out[768].l, 1.0, 1e-3);
    CHECK_NEAR(rmsL(out, 0, 760), 0.0, 1e-9);
}

void testChorusIsBoundedAndKeepsLevel() {
    Unison unison(kRate);
    const Signal in = noise(frames(2.0));
    const Signal out = run(unison, UnisonParams{UnisonType::Chorus, 8, 10.0f}, in);
    CHECK(allFinite(out, 4.0f));
    const double ratio = rmsL(out, frames(0.1), frames(2.0)) / rmsL(in, frames(0.1), frames(2.0));
    CHECK(ratio > 0.5 && ratio < 1.5);
}

void testVoiceCountIsClamped() {
    Unison unison(kRate);
    CHECK(allFinite(run(unison, UnisonParams{UnisonType::Detune, 100, 1000.0f}, noise(4800)), 4.0f));
    CHECK(allFinite(run(unison, UnisonParams{UnisonType::Chorus, -3, -1.0f}, noise(4800)), 4.0f));
}

void testMixZeroIsDry() {
    Unison unison(kRate);
    const Signal in = noise(4800);
    const Signal out = run(unison, UnisonParams{UnisonType::Detune, 8, 50.0f, 0.0f}, in);
    bool same = true;
    for (std::size_t i = 0; i < in.size(); ++i) {
        same = same && out[i].l == in[i].l && out[i].r == in[i].r;
    }
    CHECK(same);
}

void testMixHalfBlends() {
    // 3 Spread voices over 10 ms at mix 0.5: frame 0 = half dry (1) + half the hard-left voice (1/sqrt 3).
    Unison unison(kRate);
    const Signal out = run(unison, UnisonParams{UnisonType::Spread, 3, 10.0f, 0.5f}, impulse(1000));
    CHECK_NEAR(out[0].l, 0.5 + 0.5 / std::sqrt(3.0), 1e-4);
    CHECK_NEAR(out[0].r, 0.5, 1e-4);
    CHECK_NEAR(out[480].r, 0.5 / std::sqrt(3.0), 1e-3);
}

void testResetClearsTheLine() {
    Unison unison(kRate);
    const UnisonParams p{UnisonType::Chorus, 4, 5.0f};
    run(unison, p, noise(4800));
    unison.Reset();
    const Signal out = run(unison, p, silence(4800));
    CHECK(rmsL(out, 0, 4800) == 0.0 && rmsR(out, 0, 4800) == 0.0);
}

} // namespace

int main() {
    g_file = "unison_tests.cpp";
    testOneSpreadVoiceIsTheInput();
    testSpreadOffsetsAndPans();
    testDetuneShiftsPitch();
    testDetuneOneVoiceIsAPureDelay();
    testChorusIsBoundedAndKeepsLevel();
    testVoiceCountIsClamped();
    testMixZeroIsDry();
    testMixHalfBlends();
    testResetClearsTheLine();
    return finish("unison");
}
