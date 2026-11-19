// The magnitude response of ivandaw::fx::Filter, from the same formulas as src/Filter.cpp.
// The TPT SVF is the bilinear transform of the analog prototype, so with w = tan(pi f / sr) / tan(pi fc / sr):
//   low = 1 / D, band (normalised) = j k w / D, high = -w^2 / D, where D = 1 - w^2 + j k w.

import { cutoffHz } from './fields'

export interface Mix {
    low: number
    band: number
    high: number
}

// Mirror of MorphMix() in src/Filter.cpp.
export function morphMix(position: number, morphLow: number, morphHigh: number): Mix {
    const c = (x: number) => Math.min(1, Math.max(0, x))
    let lo = c(morphLow)
    let hi = c(morphHigh)
    if (lo > hi) [lo, hi] = [hi, lo]
    const p = c(position)
    const mid = 0.5 * (lo + hi)
    if (p <= lo) return { low: 1, band: 0, high: 0 }
    if (p >= hi) return { low: 0, band: 0, high: 1 }
    if (p < mid) {
        const t = (p - lo) / (mid - lo)
        return { low: 1 - t, band: t, high: 0 }
    }
    const t = (p - mid) / (hi - mid)
    return { low: 0, band: 1 - t, high: t }
}

export function mixFor(type: number, position: number, morphLow: number, morphHigh: number): Mix {
    if (type === 0) return { low: 1, band: 0, high: 0 }
    if (type === 1) return { low: 0, band: 0, high: 1 }
    if (type === 2) return { low: 0, band: 1, high: 0 }
    return morphMix(position, morphLow, morphHigh)
}

// |H(f)| for one stage with damping k.
function stage(w: number, k: number, m: Mix) {
    const dRe = 1 - w * w
    const dIm = k * w
    const nRe = m.low - m.high * w * w
    const nIm = m.band * k * w
    return Math.hypot(nRe, nIm) / Math.hypot(dRe, dIm)
}

export function responseDb(
    f: number,
    rate: number,
    v: { type: number; filterPosition: number; res: number; morphLow: number; morphHigh: number; slope: number; mix: number },
) {
    const fc = Math.min(cutoffHz(v.filterPosition), 0.45 * rate)
    const g = Math.tan((Math.PI * fc) / rate)
    const w = Math.tan((Math.PI * Math.min(f, 0.499 * rate)) / rate) / g
    const q = Math.SQRT1_2 * (25 / Math.SQRT1_2) ** Math.min(1, Math.max(0, v.res))
    const m = mixFor(v.type, v.filterPosition, v.morphLow, v.morphHigh)
    let mag = stage(w, 1 / q, m)
    if (v.slope === 1) mag *= stage(w, Math.SQRT2, m)
    // The dry blend is a phase-dependent sum; |dry + wet| is drawn as the magnitude blend, close enough for a plot.
    const blended = (1 - v.mix) + v.mix * mag
    return 20 * Math.log10(Math.max(1e-6, blended))
}
