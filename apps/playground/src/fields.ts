// Every property of each params struct, as edited on the page.
// `index` is the field number in playground/abi.cpp: keep them in sync.
// Names, ranges and defaults match include/ivandaw/fx/*.h.

export interface NumberField {
    kind: 'number'
    id: string // the C++ struct member
    index: number
    min: number
    max: number
    step: number
    value: number // the C++ default
    unit: string
    hint?: (v: number) => string // extra read-out next to the field
}

export interface ChoiceField {
    kind: 'choice'
    id: string
    index: number
    choices: string[] // the C++ enum values, in order
    value: number
}

export type Field = NumberField | ChoiceField

export interface EffectDef {
    kind: number // 0 delay, 1 reverb, 2 filter, 3 unison
    title: string
    struct: string
    fields: Field[]
}

export const cutoffHz = (position: number) => 20 * 1000 ** Math.min(1, Math.max(0, position))
const hz = (p: number) => `= ${Math.round(cutoffHz(p))} Hz`

export const DELAY: EffectDef = {
    kind: 0,
    title: 'Delay',
    struct: 'DelayParams',
    fields: [
        { kind: 'number', id: 'delayTime', index: 0, min: 0, max: 4, step: 0.001, value: 0.25, unit: 's' },
        { kind: 'number', id: 'feedback', index: 1, min: 0, max: 1, step: 0.01, value: 0.4, unit: '(capped at 0.95)' },
        { kind: 'number', id: 'mix', index: 2, min: 0, max: 1, step: 0.01, value: 0.5, unit: '(0 dry, 1 wet)' },
    ],
}

export const REVERB: EffectDef = {
    kind: 1,
    title: 'Reverb',
    struct: 'ReverbParams',
    fields: [
        { kind: 'number', id: 'decay', index: 0, min: 0.05, max: 30, step: 0.01, value: 2, unit: 's (RT60)' },
        { kind: 'number', id: 'feedback', index: 1, min: 0, max: 1, step: 0.01, value: 1, unit: '' },
        { kind: 'number', id: 'mix', index: 2, min: 0, max: 1, step: 0.01, value: 0.3, unit: '(0 dry, 1 wet)' },
    ],
}

export const FILTER: EffectDef = {
    kind: 2,
    title: 'Filter',
    struct: 'FilterParams',
    fields: [
        { kind: 'choice', id: 'type', index: 0, choices: ['Low', 'High', 'Band', 'Morph'], value: 0 },
        { kind: 'number', id: 'filterPosition', index: 1, min: 0, max: 1, step: 0.001, value: 1, unit: '', hint: hz },
        { kind: 'number', id: 'res', index: 2, min: 0, max: 1, step: 0.01, value: 0, unit: '' },
        { kind: 'number', id: 'morphLow', index: 3, min: 0, max: 1, step: 0.001, value: 0.25, unit: '', hint: hz },
        { kind: 'number', id: 'morphHigh', index: 4, min: 0, max: 1, step: 0.001, value: 0.75, unit: '', hint: hz },
        { kind: 'choice', id: 'slope', index: 5, choices: ['Db12', 'Db24'], value: 0 },
        { kind: 'number', id: 'mix', index: 6, min: 0, max: 1, step: 0.01, value: 1, unit: '(0 dry, 1 wet)' },
    ],
}

// UnisonParams::param changes meaning with the type.
export const UNISON_PARAM = [
    { max: 100, step: 0.1, unit: 'cents (Detune)' },
    { max: 10, step: 0.01, unit: 'ms depth (Chorus)' },
    { max: 50, step: 0.1, unit: 'ms offset (Spread)' },
]

export const UNISON: EffectDef = {
    kind: 3,
    title: 'Unison',
    struct: 'UnisonParams',
    fields: [
        { kind: 'choice', id: 'type', index: 0, choices: ['Detune', 'Chorus', 'Spread'], value: 0 },
        { kind: 'number', id: 'voices', index: 1, min: 1, max: 8, step: 1, value: 4, unit: '' },
        { kind: 'number', id: 'param', index: 2, min: 0, max: 100, step: 0.1, value: 15, unit: UNISON_PARAM[0].unit },
        { kind: 'number', id: 'mix', index: 3, min: 0, max: 1, step: 0.01, value: 1, unit: '(0 dry, 1 wet)' },
    ],
}

export const EFFECTS = [
    { def: DELAY, href: 'delay.html' },
    { def: REVERB, href: 'reverb.html' },
    { def: FILTER, href: 'filter.html' },
    { def: UNISON, href: 'unison.html' },
]
