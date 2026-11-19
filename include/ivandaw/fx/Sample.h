#pragma once

namespace ivandaw::fx {

// One stereo frame. Every effect takes one and returns one, so a plugin can chain them per sample.
struct Sample {
    float l = 0.0f;
    float r = 0.0f;
};

} // namespace ivandaw::fx
