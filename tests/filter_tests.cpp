#include "TestKit.h"

#include <cmath>

using namespace ivandaw::fx;
using namespace kit;

namespace {

// Position for a cutoff in Hz (inverse of FilterCutoffHz).
float positionOf(float hz) { return std::log(hz / 20.0f) / std::log(1000.0f); }

// Steady-state gain of a sine at `hz` through a fresh filter.
double gainAt(FilterParams p, float hz) {
    Filter filter;
    const Signal in = sine(hz, frames(0.5));
    const Signal out = run(filter, p, in);
    return rmsL(out, frames(0.3), frames(0.5)) / rmsL(in, frames(0.3), frames(0.5));
}

FilterParams at1k(FilterType type, FilterSlope slope = FilterSlope::Db12, float res = 0.0f) {
    FilterParams p;
    p.type = type;
    p.filterPosition = positionOf(1000.0f);
    p.res = res;
    p.slope = slope;
    return p;
}

void testCutoffMapping() {
    CHECK_NEAR(FilterCutoffHz(0.0f), 20.0, 1e-3);
    CHECK_NEAR(FilterCutoffHz(1.0f), 20000.0, 1e-1);
    CHECK_NEAR(FilterCutoffHz(positionOf(1000.0f)), 1000.0, 1e-1);
}

void testLowPass() {
    CHECK_NEAR(gainAt(at1k(FilterType::Low), 100.0f), 1.0, 0.03);
    CHECK_NEAR(gainAt(at1k(FilterType::Low), 1000.0f), 0.7071, 0.03); // Butterworth: -3 dB at the cutoff
    CHECK(gainAt(at1k(FilterType::Low), 10000.0f) < 0.03);
}

void testHighPass() {
    CHECK_NEAR(gainAt(at1k(FilterType::High), 10000.0f), 1.0, 0.03);
    CHECK(gainAt(at1k(FilterType::High), 100.0f) < 0.03);
}

void testBandPass() {
    CHECK_NEAR(gainAt(at1k(FilterType::Band), 1000.0f), 1.0, 0.03); // normalised peak
    CHECK(gainAt(at1k(FilterType::Band), 100.0f) < 0.2);
    CHECK(gainAt(at1k(FilterType::Band), 10000.0f) < 0.2);
}

void testSteeperSlope() {
    const double g12 = gainAt(at1k(FilterType::Low, FilterSlope::Db12), 4000.0f);
    const double g24 = gainAt(at1k(FilterType::Low, FilterSlope::Db24), 4000.0f);
    // Two octaves past the cutoff: about -24 dB vs about -48 dB.
    CHECK(db(g12) < -20.0 && db(g12) > -28.0);
    CHECK(db(g24) < -44.0);
}

void testResonancePeaks() {
    CHECK(gainAt(at1k(FilterType::Low, FilterSlope::Db12, 1.0f), 1000.0f) > 15.0); // Q 25
    CHECK(gainAt(at1k(FilterType::Low, FilterSlope::Db12, 0.5f), 1000.0f) > 3.0);
}

void testMorphMix() {
    auto sumsToOne = [](FilterMix m) { return std::fabs(m.low + m.band + m.high - 1.0f) < 1e-6f; };
    FilterMix m = MorphMix(0.1f, 0.25f, 0.75f);
    CHECK(m.low == 1.0f && sumsToOne(m));
    m = MorphMix(0.5f, 0.25f, 0.75f);
    CHECK(m.band == 1.0f && sumsToOne(m));
    m = MorphMix(0.9f, 0.25f, 0.75f);
    CHECK(m.high == 1.0f && sumsToOne(m));
    m = MorphMix(0.375f, 0.25f, 0.75f);
    CHECK_NEAR(m.low, 0.5, 1e-6);
    CHECK_NEAR(m.band, 0.5, 1e-6);
    m = MorphMix(0.625f, 0.75f, 0.25f); // swapped bounds
    CHECK_NEAR(m.band, 0.5, 1e-6);
    CHECK_NEAR(m.high, 0.5, 1e-6);
    // Collapsed bounds: a hard switch, low up to and at the point, high past it.
    CHECK(MorphMix(0.5f, 0.5f, 0.5f).low == 1.0f);
    CHECK(MorphMix(0.51f, 0.5f, 0.5f).high == 1.0f);
    for (int i = 0; i <= 100; ++i) {
        CHECK(sumsToOne(MorphMix(static_cast<float>(i) / 100.0f, 0.2f, 0.9f)));
    }
}

void testMorphBelowLowIsTheLowPass() {
    Filter low;
    Filter morph;
    FilterParams pl = at1k(FilterType::Low, FilterSlope::Db24, 0.4f);
    FilterParams pm = pl;
    pm.type = FilterType::Morph;
    pm.morphLow = 0.9f;
    pm.morphHigh = 1.0f;
    const Signal in = noise(4800);
    const Signal a = run(low, pl, in);
    const Signal b = run(morph, pm, in);
    bool same = true;
    for (std::size_t i = 0; i < in.size(); ++i) {
        same = same && a[i].l == b[i].l && a[i].r == b[i].r;
    }
    CHECK(same);
}

void testSweepStaysStable() {
    Filter filter;
    const Signal in = noise(frames(2.0));
    float worst = 0.0f;
    bool finite = true;
    for (int i = 0; i < frames(2.0); ++i) {
        FilterParams p;
        p.type = static_cast<FilterType>((i / 4800) % 4);
        p.slope = (i / 9600) % 2 ? FilterSlope::Db24 : FilterSlope::Db12;
        p.res = 1.0f;
        p.filterPosition = 0.5f + 0.5f * std::sin(static_cast<float>(i) * 0.001f);
        const Sample s = filter.Apply(p, in[static_cast<std::size_t>(i)], kDt);
        finite = finite && std::isfinite(s.l) && std::isfinite(s.r);
        worst = std::fmax(worst, std::fabs(s.l));
    }
    CHECK(finite);
    CHECK(worst < 50.0f);
}

void testMixBlendsDryAndFiltered() {
    FilterParams dry = at1k(FilterType::Band, FilterSlope::Db24, 0.8f);
    dry.mix = 0.0f;
    FilterParams half = dry;
    half.mix = 0.5f;
    FilterParams full = dry;
    full.mix = 1.0f;
    Filter a;
    Filter b;
    Filter c;
    const Signal in = noise(4800);
    const Signal outDry = run(a, dry, in);
    const Signal outHalf = run(b, half, in);
    const Signal outFull = run(c, full, in);
    bool isDry = true;
    bool isHalf = true;
    for (std::size_t i = 0; i < in.size(); ++i) {
        isDry = isDry && outDry[i].l == in[i].l && outDry[i].r == in[i].r;
        isHalf = isHalf && std::fabs(outHalf[i].l - 0.5f * (in[i].l + outFull[i].l)) < 1e-5f;
    }
    CHECK(isDry);
    CHECK(isHalf);
}

void testResetClearsState() {
    Filter filter;
    const FilterParams p = at1k(FilterType::Band, FilterSlope::Db24, 1.0f);
    run(filter, p, noise(4800));
    filter.Reset();
    const Signal out = run(filter, p, silence(480));
    CHECK(rmsL(out, 0, 480) == 0.0);
}

} // namespace

int main() {
    g_file = "filter_tests.cpp";
    testCutoffMapping();
    testLowPass();
    testHighPass();
    testBandPass();
    testSteeperSlope();
    testResonancePeaks();
    testMorphMix();
    testMorphBelowLowIsTheLowPass();
    testSweepStaysStable();
    testMixBlendsDryAndFiltered();
    testResetClearsState();
    return finish("filter");
}
