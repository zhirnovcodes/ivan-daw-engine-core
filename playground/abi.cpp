// C ABI over the effects for the playground pages (apps/playground). Not part of the library.
// One generic shape: create an effect by kind, set fields by index, process blocks in place.
// The field numbers must match apps/playground/src/fields.ts.

#include "ivandaw/fx.h"

#include <cstdlib>
#include <new>

#define FXP_EXPORT extern "C" __attribute__((used, visibility("default")))

using namespace ivandaw::fx;

namespace {

enum Kind : int { KDelay = 0, KReverb = 1, KFilter = 2, KUnison = 3 };

struct Instance {
    Instance(int k, double rate) : kind(k), delay(rate), reverb(rate), unison(rate), dt(static_cast<float>(1.0 / rate)) {}

    int kind;
    Delay delay;
    Reverb reverb;
    Filter filter;
    Unison unison;
    DelayParams delayParams;
    ReverbParams reverbParams;
    FilterParams filterParams;
    UnisonParams unisonParams;
    float dt;
    bool bypass = false;
};

void setDelay(DelayParams& p, int field, float v) {
    switch (field) {
    case 0: p.delayTime = v; break;
    case 1: p.feedback = v; break;
    case 2: p.mix = v; break;
    default: break;
    }
}

void setReverb(ReverbParams& p, int field, float v) {
    switch (field) {
    case 0: p.decay = v; break;
    case 1: p.feedback = v; break;
    case 2: p.mix = v; break;
    default: break;
    }
}

void setFilter(FilterParams& p, int field, float v) {
    switch (field) {
    case 0: p.type = static_cast<FilterType>(static_cast<int>(v) & 3); break;
    case 1: p.filterPosition = v; break;
    case 2: p.res = v; break;
    case 3: p.morphLow = v; break;
    case 4: p.morphHigh = v; break;
    case 5: p.slope = static_cast<int>(v) == 1 ? FilterSlope::Db24 : FilterSlope::Db12; break;
    case 6: p.mix = v; break;
    default: break;
    }
}

void setUnison(UnisonParams& p, int field, float v) {
    switch (field) {
    case 0: {
        const int t = static_cast<int>(v);
        p.type = t == 1 ? UnisonType::Chorus : (t == 2 ? UnisonType::Spread : UnisonType::Detune);
        break;
    }
    case 1: p.voices = static_cast<int>(v); break;
    case 2: p.param = v; break;
    case 3: p.mix = v; break;
    default: break;
    }
}

} // namespace

FXP_EXPORT void* fxp_alloc(int bytes) { return bytes > 0 ? std::malloc(static_cast<std::size_t>(bytes)) : nullptr; }
FXP_EXPORT void fxp_free(void* p) { std::free(p); }

FXP_EXPORT Instance* fxp_create(int kind, double rate) {
    if (!(rate > 0.0) || kind < KDelay || kind > KUnison) {
        return nullptr;
    }
    void* memory = std::malloc(sizeof(Instance));
    return memory ? new (memory) Instance(kind, rate) : nullptr;
}

FXP_EXPORT void fxp_destroy(Instance* i) {
    if (i) {
        i->~Instance();
        std::free(i);
    }
}

FXP_EXPORT void fxp_set(Instance* i, int field, float value) {
    if (!i) {
        return;
    }
    switch (i->kind) {
    case KDelay: setDelay(i->delayParams, field, value); break;
    case KReverb: setReverb(i->reverbParams, field, value); break;
    case KFilter: setFilter(i->filterParams, field, value); break;
    case KUnison: setUnison(i->unisonParams, field, value); break;
    default: break;
    }
}

FXP_EXPORT void fxp_bypass(Instance* i, int on) {
    if (i) {
        i->bypass = on != 0;
    }
}

FXP_EXPORT void fxp_reset(Instance* i) {
    if (!i) {
        return;
    }
    i->delay.Reset();
    i->reverb.Reset();
    i->filter.Reset();
    i->unison.Reset();
}

// Processes `frames` frames of left/right in place.
FXP_EXPORT void fxp_process(Instance* i, float* left, float* right, int frames) {
    if (!i || i->bypass) {
        return;
    }
    for (int f = 0; f < frames; ++f) {
        Sample s{left[f], right[f]};
        switch (i->kind) {
        case KDelay: s = i->delay.Apply(i->delayParams, s, i->dt); break;
        case KReverb: s = i->reverb.Apply(i->reverbParams, s, i->dt); break;
        case KFilter: s = i->filter.Apply(i->filterParams, s, i->dt); break;
        case KUnison: s = i->unison.Apply(i->unisonParams, s, i->dt); break;
        default: break;
        }
        left[f] = s.l;
        right[f] = s.r;
    }
}
