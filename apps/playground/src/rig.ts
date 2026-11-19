// Shared page rig: nav, input picker, play/stop, bypass, reset, param controls, scope and spectrum.
// Every effect page is `mountRig(DEF, hooks)`.

import './style.css'
import { EFFECTS, type EffectDef, type Field, type RangeField } from './fields'

const BASE = import.meta.env.BASE_URL
const SAMPLE_URL = `${BASE}samples/breakbeat-115bpm.wav`

type InputKind = 'breakbeat' | 'chord' | 'clicks' | 'noise' | 'file' | 'mic' | 'none'

const INPUTS: { id: InputKind; label: string }[] = [
    { id: 'breakbeat', label: 'Breakbeat 115 BPM' },
    { id: 'chord', label: 'Saw chord' },
    { id: 'clicks', label: 'Clicks (1 per second)' },
    { id: 'noise', label: 'White noise' },
    { id: 'file', label: 'Audio file…' },
    { id: 'mic', label: 'Microphone' },
    { id: 'none', label: 'Silence (hear the tail)' },
]

export interface Rig {
    values: Record<string, number>
    set(id: string, value: number): void
    updateField(id: string, patch: Partial<RangeField>): void
    extra: HTMLElement
}

export interface Hooks {
    onChange?(rig: Rig, changed: string): void
    onReady?(rig: Rig): void
}

let wasmBytes: Promise<ArrayBuffer> | null = null
const loadWasm = () => {
    wasmBytes ??= fetch(`${BASE}engine_core_playground.wasm`).then((r) => {
        if (!r.ok) throw new Error('engine_core_playground.wasm missing: run `pnpm build:wasm` first')
        return r.arrayBuffer()
    })
    return wasmBytes
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag)
    Object.assign(node, props)
    node.append(...kids)
    return node
}

// Slider position 0..1000 <-> value, linear or log.
function toSlider(f: RangeField, v: number) {
    const t = f.scale === 'log' ? Math.log(v / f.min) / Math.log(f.max / f.min) : (v - f.min) / (f.max - f.min)
    return Math.round(Math.min(1, Math.max(0, t)) * 1000)
}
function fromSlider(f: RangeField, s: number) {
    const t = s / 1000
    const raw = f.scale === 'log' ? f.min * (f.max / f.min) ** t : f.min + t * (f.max - f.min)
    return Math.round(raw / f.step) * f.step
}

export function mountRig(def: EffectDef, hooks: Hooks = {}): Rig {
    document.title = `${def.title} · engine-core playground`
    const app = document.getElementById('app') as HTMLElement

    const nav = el('nav', {}, el('a', { href: 'index.html', textContent: 'engine-core' }))
    for (const e of EFFECTS) {
        nav.append(el('a', { href: e.href, textContent: e.def.title, className: e.def === def ? 'current' : '' }))
    }

    // --- transport row
    const inputSelect = el('select')
    for (const i of INPUTS) inputSelect.append(el('option', { value: i.id, textContent: i.label }))
    const fileInput = el('input', { type: 'file', accept: 'audio/*', hidden: true })
    const playButton = el('button', { textContent: 'Play', className: 'primary' })
    const bypassBox = el('input', { type: 'checkbox' })
    const resetButton = el('button', { textContent: 'Reset()' })
    const clickButton = el('button', { textContent: 'Fire click' })
    const status = el('span', { className: 'status' })
    const transport = el(
        'div',
        { className: 'transport' },
        inputSelect,
        fileInput,
        playButton,
        el('label', { className: 'check' }, bypassBox, 'Bypass'),
        resetButton,
        clickButton,
        status,
    )

    // --- controls
    const values: Record<string, number> = {}
    const fieldsById = new Map<string, Field>()
    const controls = el('div', { className: 'controls' })
    const rangeUi = new Map<string, { input: HTMLInputElement; label: HTMLElement; out: HTMLElement }>()
    const choiceUi = new Map<string, HTMLSelectElement>()

    const rig: Rig = {
        values,
        set: (id, value) => setValue(id, value, true),
        updateField(id, patch) {
            const f = fieldsById.get(id)
            if (!f || f.kind !== 'range') return
            Object.assign(f, patch)
            const ui = rangeUi.get(id)
            if (!ui) return
            ui.label.textContent = f.label
            setValue(id, patch.value ?? Math.min(f.max, Math.max(f.min, values[id])), true)
        },
        extra: el('div', { className: 'extra' }),
    }

    function render(id: string) {
        const f = fieldsById.get(id)
        if (!f) return
        if (f.kind === 'range') {
            const ui = rangeUi.get(id)
            if (!ui) return
            ui.input.value = String(toSlider(f, values[id]))
            ui.out.textContent = f.format ? f.format(values[id]) : values[id].toFixed(3)
        } else {
            const sel = choiceUi.get(id)
            if (sel) sel.value = String(values[id])
        }
    }

    function setValue(id: string, value: number, notify: boolean) {
        const f = fieldsById.get(id)
        if (!f) return
        values[id] = value
        render(id)
        post({ type: 'set', field: f.index, value })
        if (notify) hooks.onChange?.(rig, id)
    }

    for (const f of def.fields) {
        fieldsById.set(f.id, f)
        values[f.id] = f.value
        if (f.kind === 'range') {
            const input = el('input', { type: 'range', min: '0', max: '1000', step: '1' })
            const label = el('span', { className: 'name', textContent: f.label })
            const out = el('output')
            input.addEventListener('input', () => setValue(f.id, fromSlider(f, Number(input.value)), true))
            rangeUi.set(f.id, { input, label, out })
            controls.append(el('label', { className: 'field' }, label, input, out))
        } else {
            const sel = el('select')
            f.choices.forEach((c, i) => sel.append(el('option', { value: String(i), textContent: c })))
            sel.addEventListener('change', () => setValue(f.id, Number(sel.value), true))
            choiceUi.set(f.id, sel)
            controls.append(el('label', { className: 'field' }, el('span', { className: 'name', textContent: f.label }), sel, el('output')))
        }
        render(f.id)
    }

    // --- visuals
    const scope = el('canvas', { width: 1200, height: 260 })
    const spectrum = el('canvas', { width: 1200, height: 260 })
    const visuals = el(
        'div',
        { className: 'visuals' },
        el('figure', {}, scope, el('figcaption', { textContent: 'Output waveform (L teal, R amber)' })),
        el('figure', {}, spectrum, el('figcaption', { textContent: 'Output spectrum, 20 Hz – 20 kHz' })),
    )

    app.append(
        nav,
        el('header', {}, el('h1', { textContent: def.title }), el('p', { textContent: def.blurb })),
        transport,
        controls,
        rig.extra,
        visuals,
    )

    // --- audio
    let ctx: AudioContext | null = null
    let node: AudioWorkletNode | null = null
    let inputBus: GainNode | null = null
    let analyserL: AnalyserNode | null = null
    let analyserR: AnalyserNode | null = null
    let source: { stop(): void } | null = null
    let playing = false
    let fileBuffer: AudioBuffer | null = null
    let sampleBuffer: AudioBuffer | null = null

    function post(m: unknown) {
        node?.port.postMessage(m)
    }

    async function ensureAudio() {
        if (ctx) return ctx
        ctx = new AudioContext({ latencyHint: 'interactive' })
        status.textContent = 'loading…'
        const [bytes] = await Promise.all([loadWasm(), ctx.audioWorklet.addModule(`${BASE}fx-worklet.js`)])
        node = new AudioWorkletNode(ctx, 'fx', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2],
            channelCount: 2,
            channelCountMode: 'explicit',
            channelInterpretation: 'speakers',
            processorOptions: { kind: def.kind, wasm: bytes.slice(0) },
        })
        node.port.onmessage = (e) => {
            if (e.data?.type === 'ready') status.textContent = `${ctx?.sampleRate} Hz`
        }
        inputBus = ctx.createGain()
        inputBus.connect(node)
        const split = ctx.createChannelSplitter(2)
        analyserL = ctx.createAnalyser()
        analyserR = ctx.createAnalyser()
        for (const a of [analyserL, analyserR]) {
            a.fftSize = 4096
            a.smoothingTimeConstant = 0.75
        }
        node.connect(ctx.destination)
        node.connect(split)
        split.connect(analyserL, 0)
        split.connect(analyserR, 1)
        for (const f of def.fields) post({ type: 'set', field: f.index, value: values[f.id] })
        post({ type: 'bypass', on: bypassBox.checked })
        draw()
        hooks.onReady?.(rig)
        return ctx
    }

    function loopBuffer(ac: AudioContext, buffer: AudioBuffer) {
        const s = ac.createBufferSource()
        s.buffer = buffer
        s.loop = true
        s.connect(inputBus as GainNode)
        s.start()
        return s
    }

    async function startInput(kind: InputKind) {
        const ac = await ensureAudio()
        source?.stop()
        source = null
        if (kind === 'breakbeat') {
            let buffer = sampleBuffer
            if (!buffer) {
                const bytes = await fetch(SAMPLE_URL).then((r) => r.arrayBuffer())
                buffer = await ac.decodeAudioData(bytes)
                sampleBuffer = buffer
            }
            source = loopBuffer(ac, buffer)
        } else if (kind === 'chord') {
            const gain = ac.createGain()
            gain.gain.value = 0.12
            gain.connect(inputBus as GainNode)
            const oscs = [220, 277.18, 329.63, 440].map((hz) => {
                const o = ac.createOscillator()
                o.type = 'sawtooth'
                o.frequency.value = hz
                o.connect(gain)
                o.start()
                return o
            })
            source = { stop: () => oscs.forEach((o) => o.stop()) }
        } else if (kind === 'clicks') {
            const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
            const d = b.getChannelData(0)
            for (let i = 0; i < 240; i++) d[i] = (Math.random() * 2 - 1) * 0.8 * (1 - i / 240)
            source = loopBuffer(ac, b)
        } else if (kind === 'noise') {
            const b = ac.createBuffer(2, ac.sampleRate * 2, ac.sampleRate)
            for (let c = 0; c < 2; c++) {
                const d = b.getChannelData(c)
                for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.25
            }
            source = loopBuffer(ac, b)
        } else if (kind === 'file') {
            const buffer = fileBuffer
            if (!buffer) {
                fileInput.click()
                return false
            }
            source = loopBuffer(ac, buffer)
        } else if (kind === 'mic') {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            })
            const mic = ac.createMediaStreamSource(stream)
            mic.connect(inputBus as GainNode)
            source = {
                stop: () => {
                    mic.disconnect()
                    stream.getTracks().forEach((t) => t.stop())
                },
            }
        }
        return true
    }

    async function play() {
        const ac = await ensureAudio()
        await ac.resume()
        if (await startInput(inputSelect.value as InputKind)) {
            playing = true
            playButton.textContent = 'Stop'
        }
    }

    function stop() {
        source?.stop()
        source = null
        playing = false
        playButton.textContent = 'Play'
    }

    playButton.addEventListener('click', () => (playing ? stop() : play()))
    inputSelect.addEventListener('change', () => {
        if (inputSelect.value === 'file') {
            fileInput.click()
            return
        }
        if (playing) startInput(inputSelect.value as InputKind)
    })
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0]
        if (!file) return
        const ac = await ensureAudio()
        fileBuffer = await ac.decodeAudioData(await file.arrayBuffer())
        status.textContent = file.name
        if (playing) startInput('file')
        else play()
    })
    bypassBox.addEventListener('change', () => post({ type: 'bypass', on: bypassBox.checked }))
    resetButton.addEventListener('click', () => post({ type: 'reset' }))
    clickButton.addEventListener('click', async () => {
        const ac = await ensureAudio()
        await ac.resume()
        const b = ac.createBuffer(1, 240, ac.sampleRate)
        const d = b.getChannelData(0)
        for (let i = 0; i < 240; i++) d[i] = (Math.random() * 2 - 1) * 0.9 * (1 - i / 240)
        const s = ac.createBufferSource()
        s.buffer = b
        s.connect(inputBus as GainNode)
        s.start()
    })

    // --- drawing
    const css = getComputedStyle(document.documentElement)
    const color = (name: string) => css.getPropertyValue(name).trim()

    function draw() {
        requestAnimationFrame(draw)
        if (!analyserL || !analyserR || !ctx) return
        drawScope()
        drawSpectrum(ctx.sampleRate)
    }

    const timeL = new Float32Array(2048)
    const timeR = new Float32Array(2048)
    function drawScope() {
        const g = scope.getContext('2d') as CanvasRenderingContext2D
        const { width: w, height: h } = scope
        g.fillStyle = color('--plot-bg')
        g.fillRect(0, 0, w, h)
        g.strokeStyle = color('--grid')
        g.beginPath()
        g.moveTo(0, h / 2)
        g.lineTo(w, h / 2)
        g.stroke()
        analyserL?.getFloatTimeDomainData(timeL)
        analyserR?.getFloatTimeDomainData(timeR)
        for (const [data, c] of [
            [timeR, '--series-r'],
            [timeL, '--series-l'],
        ] as const) {
            g.strokeStyle = color(c)
            g.lineWidth = 2
            g.beginPath()
            for (let i = 0; i < data.length; i++) {
                const x = (i / (data.length - 1)) * w
                const y = h / 2 - Math.max(-1, Math.min(1, data[i])) * (h / 2 - 4)
                i ? g.lineTo(x, y) : g.moveTo(x, y)
            }
            g.stroke()
        }
    }

    const freqL = new Float32Array(2048)
    function drawSpectrum(rate: number) {
        const g = spectrum.getContext('2d') as CanvasRenderingContext2D
        const { width: w, height: h } = spectrum
        g.fillStyle = color('--plot-bg')
        g.fillRect(0, 0, w, h)
        g.strokeStyle = color('--grid')
        g.fillStyle = color('--muted')
        g.font = '20px system-ui'
        for (const f of [100, 1000, 10000]) {
            const x = (Math.log(f / 20) / Math.log(1000)) * w
            g.beginPath()
            g.moveTo(x, 0)
            g.lineTo(x, h)
            g.stroke()
            g.fillText(f < 1000 ? `${f}` : `${f / 1000}k`, x + 6, h - 8)
        }
        analyserL?.getFloatFrequencyData(freqL)
        g.strokeStyle = color('--series-l')
        g.lineWidth = 2
        g.beginPath()
        const binHz = rate / 2 / freqL.length
        for (let x = 0; x < w; x++) {
            const f = 20 * 1000 ** (x / w)
            const db = freqL[Math.min(freqL.length - 1, Math.round(f / binHz))]
            const y = Math.min(h, Math.max(0, ((-10 - db) / 90) * h))
            x ? g.lineTo(x, y) : g.moveTo(x, y)
        }
        g.stroke()
    }

    return rig
}
