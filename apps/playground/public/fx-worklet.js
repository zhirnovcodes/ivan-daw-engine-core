// AudioWorklet that runs one engine-core effect from engine_core_playground.wasm.
// Served as-is from public/, so it imports nothing.
// processorOptions: { kind: 0 delay | 1 reverb | 2 filter | 3 unison, wasm: ArrayBuffer }
// Messages in: { type: 'set', field, value } | { type: 'bypass', on } | { type: 'reset' }

const MAX_FRAMES = 4096;

class FxProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.core = null;
        this.pending = [];
        this.port.onmessage = (e) => this.handle(e.data);
        const { kind, wasm } = options.processorOptions;
        WebAssembly.instantiate(wasm, { env: { emscripten_notify_memory_growth() {} } }).then(({ instance }) => {
            const core = instance.exports;
            core._initialize?.();
            this.inst = core.fxp_create(kind, sampleRate);
            this.left = core.fxp_alloc(MAX_FRAMES * 4);
            this.right = core.fxp_alloc(MAX_FRAMES * 4);
            this.core = core;
            for (const m of this.pending) this.handle(m);
            this.pending = [];
            this.port.postMessage({ type: 'ready' });
        });
    }

    handle(m) {
        if (!this.core) {
            this.pending.push(m);
            return;
        }
        if (m.type === 'set') this.core.fxp_set(this.inst, m.field, m.value);
        else if (m.type === 'bypass') this.core.fxp_bypass(this.inst, m.on ? 1 : 0);
        else if (m.type === 'reset') this.core.fxp_reset(this.inst);
    }

    process(inputs, outputs) {
        const out = outputs[0];
        if (!this.core || out.length === 0) return true;
        const input = inputs[0];
        const n = Math.min(out[0].length, MAX_FRAMES);
        const mem = this.core.memory.buffer;
        const l = new Float32Array(mem, this.left, n);
        const r = new Float32Array(mem, this.right, n);
        // No input connected: keep feeding silence so tails ring out.
        if (input.length > 0) {
            l.set(input[0].subarray(0, n));
            r.set((input[1] ?? input[0]).subarray(0, n));
        } else {
            l.fill(0);
            r.fill(0);
        }
        this.core.fxp_process(this.inst, this.left, this.right, n);
        const after = this.core.memory.buffer;
        out[0].set(new Float32Array(after, this.left, n));
        if (out[1]) out[1].set(new Float32Array(after, this.right, n));
        return true;
    }
}

registerProcessor('fx', FxProcessor);
