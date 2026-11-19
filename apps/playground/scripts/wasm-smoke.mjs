// Smoke test of public/engine_core_playground.wasm in Node: the same calls the worklet makes.
// Checks every effect runs, stays finite, and that the delay echo lands where the native tests say.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const wasm = readFileSync(resolve(import.meta.dirname, '../public/engine_core_playground.wasm'))
const { instance } = await WebAssembly.instantiate(wasm, { env: { emscripten_notify_memory_growth() {} } })
const c = instance.exports
c._initialize?.()

const RATE = 48000
const BLOCK = 128
let failed = 0
const check = (ok, text) => {
    if (!ok) {
        console.log(`FAIL ${text}`)
        failed++
    }
}

function render(kind, fields, input) {
    const inst = c.fxp_create(kind, RATE)
    check(inst !== 0, `create kind ${kind}`)
    for (const [field, value] of fields) c.fxp_set(inst, field, value)
    const lp = c.fxp_alloc(BLOCK * 4)
    const rp = c.fxp_alloc(BLOCK * 4)
    const out = new Float32Array(input.length)
    for (let at = 0; at < input.length; at += BLOCK) {
        const n = Math.min(BLOCK, input.length - at)
        new Float32Array(c.memory.buffer, lp, n).set(input.subarray(at, at + n))
        new Float32Array(c.memory.buffer, rp, n).set(input.subarray(at, at + n))
        c.fxp_process(inst, lp, rp, n)
        out.set(new Float32Array(c.memory.buffer, lp, n), at)
    }
    c.fxp_free(lp)
    c.fxp_free(rp)
    c.fxp_destroy(inst)
    return out
}

const impulse = new Float32Array(RATE)
impulse[0] = 1
const noise = Float32Array.from({ length: RATE }, (_, i) => Math.sin(i * 12.9898) * 0.5)
const finite = (a) => a.every((v) => Number.isFinite(v) && Math.abs(v) < 20)

// Delay: 10 ms, feedback 0.5, mix 1 -> 1 at frame 480, 0.5 at 960.
const d = render(0, [[0, 0.01], [1, 0.5], [2, 1]], impulse)
check(Math.abs(d[480] - 1) < 1e-3 && Math.abs(d[960] - 0.5) < 1e-3, `delay echoes ${d[480]} ${d[960]}`)

check(finite(render(1, [[0, 2], [1, 1], [2, 1]], noise)), 'reverb finite')
for (let type = 0; type < 4; type++) {
    check(finite(render(2, [[0, type], [1, 0.5], [2, 1], [5, 1]], noise)), `filter type ${type} finite`)
}
for (let type = 0; type < 3; type++) {
    check(finite(render(3, [[0, type], [1, 8], [2, 50]], noise)), `unison type ${type} finite`)
}
// Mix 0 is dry for every effect.
for (const [kind, mixField] of [[0, 2], [1, 2], [2, 6], [3, 3]]) {
    const out = render(kind, [[mixField, 0]], noise)
    check(out.every((v, i) => v === noise[i]), `kind ${kind} mix 0 is dry`)
}

if (failed === 0) console.log('ok wasm smoke')
process.exit(failed ? 1 : 0)
