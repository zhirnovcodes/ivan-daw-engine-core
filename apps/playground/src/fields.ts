// The parameter schema of each effect. `index` is the field number in playground/abi.cpp: keep them in sync.

export interface RangeField {
    kind: 'range'
    id: string
    label: string
    index: number
    min: number
    max: number
    step: number
    value: number
    scale?: 'log'
    format?: (v: number) => string
}

export interface ChoiceField {
    kind: 'choice'
    id: string
    label: string
    index: number
    choices: string[]
    value: number
}

export type Field = RangeField | ChoiceField

export interface EffectDef {
    kind: number // 0 delay, 1 reverb, 2 filter, 3 unison
    title: string
    blurb: string
    fields: Field[]
}

const pct = (v: number) => `${Math.round(v * 100)} %`
const sec = (v: number) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`)

export const cutoffHz = (position: number) => 20 * 1000 ** Math.min(1, Math.max(0, position))
const hz = (p: number) => {
    const f = cutoffHz(p)
    return f < 1000 ? `${Math.round(f)} Hz` : `${(f / 1000).toFixed(2)} kHz`
}

export const DELAY: EffectDef = {
    kind: 0,
    title: 'Delay',
    blurb: 'Stereo feedback delay. Time changes glide like tape. Feedback is capped at 95 %.',
    fields: [
        { kind: 'range', id: 'delayTime', label: 'Time', index: 0, min: 0.01, max: 2, step: 0.001, value: 0.261, format: sec },
        { kind: 'range', id: 'feedback', label: 'Feedback', index: 1, min: 0, max: 0.95, step: 0.01, value: 0.45, format: pct },
        { kind: 'range', id: 'mix', label: 'Mix', index: 2, min: 0, max: 1, step: 0.01, value: 0.4, format: pct },
    ],
}

export const REVERB: EffectDef = {
    kind: 1,
    title: 'Reverb',
    blurb: 'Freeverb tank. Decay is the RT60 tail time; feedback 0 leaves only the first reflections.',
    fields: [
        { kind: 'range', id: 'decay', label: 'Decay', index: 0, min: 0.1, max: 20, step: 0.01, value: 2.5, scale: 'log', format: sec },
        { kind: 'range', id: 'feedback', label: 'Feedback', index: 1, min: 0, max: 1, step: 0.01, value: 1, format: pct },
        { kind: 'range', id: 'mix', label: 'Mix', index: 2, min: 0, max: 1, step: 0.01, value: 0.3, format: pct },
    ],
}

export const FILTER: EffectDef = {
    kind: 2,
    title: 'Filter',
    blurb: 'State-variable filter. Morph sweeps low-pass → band-pass → high-pass along the position axis.',
    fields: [
        { kind: 'choice', id: 'type', label: 'Type', index: 0, choices: ['Low', 'High', 'Band', 'Morph'], value: 3 },
        { kind: 'range', id: 'filterPosition', label: 'Position', index: 1, min: 0, max: 1, step: 0.001, value: 0.5, format: hz },
        { kind: 'range', id: 'res', label: 'Resonance', index: 2, min: 0, max: 1, step: 0.01, value: 0.3, format: pct },
        { kind: 'range', id: 'morphLow', label: 'Morph low', index: 3, min: 0, max: 1, step: 0.001, value: 0.25, format: hz },
        { kind: 'range', id: 'morphHigh', label: 'Morph high', index: 4, min: 0, max: 1, step: 0.001, value: 0.75, format: hz },
        { kind: 'choice', id: 'slope', label: 'Slope', index: 5, choices: ['12 dB/oct', '24 dB/oct'], value: 0 },
        { kind: 'range', id: 'mix', label: 'Mix', index: 6, min: 0, max: 1, step: 0.01, value: 1, format: pct },
    ],
}

export const UNISON_PARAM = [
    { label: 'Detune', max: 100, step: 0.1, value: 20, format: (v: number) => `±${v.toFixed(1)} cents` },
    { label: 'Depth', max: 10, step: 0.01, value: 3, format: (v: number) => `${v.toFixed(2)} ms` },
    { label: 'Offset', max: 50, step: 0.1, value: 20, format: (v: number) => `0 – ${v.toFixed(1)} ms` },
]

export const UNISON: EffectDef = {
    kind: 3,
    title: 'Unison',
    blurb: 'Plays the input several times, panned left to right. The third slider changes meaning with the type.',
    fields: [
        { kind: 'choice', id: 'type', label: 'Type', index: 0, choices: ['Detune', 'Chorus', 'Spread'], value: 0 },
        { kind: 'range', id: 'voices', label: 'Voices', index: 1, min: 1, max: 8, step: 1, value: 5, format: (v) => `${v}` },
        { kind: 'range', id: 'param', label: UNISON_PARAM[0].label, index: 2, min: 0, max: 100, step: 0.1, value: 20, format: UNISON_PARAM[0].format },
        { kind: 'range', id: 'mix', label: 'Mix', index: 3, min: 0, max: 1, step: 0.01, value: 1, format: pct },
    ],
}

export const EFFECTS = [
    { def: DELAY, href: 'delay.html' },
    { def: REVERB, href: 'reverb.html' },
    { def: FILTER, href: 'filter.html' },
    { def: UNISON, href: 'unison.html' },
]
