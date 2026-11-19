// Shared page rig in plain HTML: input picker, play/stop, bypass, Reset(), one edit field per params
// property, and output waveform + spectrum. Every effect page is `mountRig(DEF, hooks)`.

import { EFFECTS, type EffectDef, type Field, type NumberField } from './fields'
import { canvas, PLOT } from './plot'

const BASE = import.meta.env.BASE_URL
const SAMPLE_URL = `${BASE}samples/breakbeat-115bpm.wav`

type InputKind = 'breakbeat' | 'chord' | 'clicks' | 'noise' | 'file' | 'mic' | 'none'

const INPUTS: { id: InputKind; label: string }[] = [
    { id: 'breakbeat', label: 'breakbeat-115bpm.wav' },
    { id: 'chord', label: 'Saw chord' },
    { id: 'clicks', label: 'Clicks (1 per second)' },
    { id: 'noise', label: 'White noise' },
    { id: 'file', label: 'Audio file…' },
    { id: 'mic', label: 'Microphone' },
    { id: 'none', label: 'Silence (hear the tail)' },
]

export interface Rig {
    values: Record<string, number>
    updateField(id: string, patch: Partial<NumberField>): void
    extra: HTMLElement
}

export interface Hooks {
    onChange?(rig: Rig, changed: string): void
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

export function mountRig(def: EffectDef, hooks: Hooks = {}): Rig {
    document.title = `${def.title} – engine-core playground`
    const app = document.getElementById('app') as HTMLElement

    // --- nav
    const nav = el('p', {}, el('a', { href: 'index.html', textContent: 'index' }))
    for (const e of EFFECTS) {
        nav.append(' | ', e.def === def ? el('b', { textContent: e.def.title }) : el('a', { href: e.href, textContent: e.def.title }))
    }

    // --- transport
    const inputSelect = el('select')
    for (const i of INPUTS) inputSelect.append(el('option', { value: i.id, textContent: i.label }))
    const fileInput = el('input', { type: 'file', accept: 'audio/*', hidden: true })
    const playButton = el('button', { textContent: 'Play' })
    const bypassBox = el('input', { type: 'checkbox', id: 'bypass' })
    const resetButton = el('button', { textContent: 'Reset()' })
    const clickButton = el('button', { textContent: 'Fire click' })
    const status = el('span')
    const transport = el(
        'fieldset',
        {},
        el('legend', { textContent: 'Input' }),
        inputSelect,
        ' ',
        fileInput,
        playButton,
        ' ',
        bypassBox,
        el('label', { htmlFor: 'bypass', textContent: 'Bypass' }),
        ' ',
        resetButton,
        ' ',
        clickButton,
        ' ',
        status,
    )

    // --- params: one row per struct property
    const values: Record<string, number> = {}
    const fieldsById = new Map<string, Field>()
    const numberUi = new Map<string, { input: HTMLInputElement; unit: HTMLElement; hint: HTMLElement }>()
    const tbody = el('tbody')
    const params = el(
        'fieldset',
        {},
        el('legend', { textContent: `ivandaw::fx::${def.struct}` }),
        el('table', {}, el('thead', {}, el('tr', {}, el('th', { textContent: 'property' }), el('th', { textContent: 'value' }), el('th', { textContent: 'range / unit' }), el('th'))), tbody),
    )

    function post(m: unknown) {
        node?.port.postMessage(m)
    }

    function commit(id: string, value: number) {
        const f = fieldsById.get(id)
        if (!f) return
        values[id] = value
        post({ type: 'set', field: f.index, value })
        const ui = numberUi.get(id)
        if (ui && f.kind === 'number') ui.hint.textContent = f.hint ? f.hint(value) : ''
        hooks.onChange?.(rig, id)
    }

    for (const f of def.fields) {
        fieldsById.set(f.id, f)
        values[f.id] = f.value
        let control: HTMLElement
        let unit: HTMLElement = el('span')
        let hint: HTMLElement = el('span')
        if (f.kind === 'number') {
            const input = el('input', { type: 'number', min: String(f.min), max: String(f.max), step: String(f.step), value: String(f.value) })
            input.addEventListener('input', () => {
                const v = input.valueAsNumber
                if (Number.isFinite(v)) commit(f.id, v)
            })
            // On leaving the field, show the value the effect will clamp it to.
            input.addEventListener('change', () => {
                const v = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : f.value
                const clamped = Math.min(f.max, Math.max(f.min, v))
                input.value = String(clamped)
                commit(f.id, clamped)
            })
            unit = el('span', { textContent: `${f.min} .. ${f.max} ${f.unit}`.trim() })
            hint = el('span', { textContent: f.hint ? f.hint(f.value) : '' })
            numberUi.set(f.id, { input, unit, hint })
            control = input
        } else {
            const sel = el('select')
            f.choices.forEach((c, i) => sel.append(el('option', { value: String(i), textContent: c })))
            sel.value = String(f.value)
            sel.addEventListener('change', () => commit(f.id, Number(sel.value)))
            unit = el('span', { textContent: 'enum' })
            control = sel
        }
        tbody.append(el('tr', {}, el('td', {}, el('code', { textContent: f.id })), el('td', {}, control), el('td', {}, unit), el('td', {}, hint)))
    }

    const rig: Rig = {
        values,
        updateField(id, patch) {
            const f = fieldsById.get(id)
            const ui = numberUi.get(id)
            if (!f || f.kind !== 'number' || !ui) return
            Object.assign(f, patch)
            ui.input.min = String(f.min)
            ui.input.max = String(f.max)
            ui.input.step = String(f.step)
            ui.unit.textContent = `${f.min} .. ${f.max} ${f.unit}`.trim()
            const v = Math.min(f.max, Math.max(f.min, patch.value ?? values[id]))
            ui.input.value = String(v)
            commit(id, v)
        },
        extra: el('div'),
    }

    // --- output plots
    const scope = canvas(1000, 200)
    const spectrum = canvas(1000, 200)
    const output = el(
        'fieldset',
        {},
        el('legend', { textContent: 'Output' }),
        el('p', {}, 'Waveform (L teal, R orange)'),
        scope,
        el('p', {}, 'Spectrum of L, 20 Hz – 20 kHz'),
        spectrum,
    )

    app.append(nav, el('h1', { textContent: def.title }), transport, params, rig.extra, output)

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
        g.fillStyle = PLOT.bg
        g.fillRect(0, 0, w, h)
        g.strokeStyle = PLOT.grid
        g.beginPath()
        g.moveTo(0, h / 2)
        g.lineTo(w, h / 2)
        g.stroke()
        analyserL?.getFloatTimeDomainData(timeL)
        analyserR?.getFloatTimeDomainData(timeR)
        for (const [data, c] of [
            [timeR, PLOT.r],
            [timeL, PLOT.l],
        ] as const) {
            g.strokeStyle = c
            g.lineWidth = 1.5
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
        g.fillStyle = PLOT.bg
        g.fillRect(0, 0, w, h)
        g.strokeStyle = PLOT.grid
        g.fillStyle = PLOT.text
        g.font = '14px sans-serif'
        for (const f of [100, 1000, 10000]) {
            const x = (Math.log(f / 20) / Math.log(1000)) * w
            g.beginPath()
            g.moveTo(x, 0)
            g.lineTo(x, h)
            g.stroke()
            g.fillText(f < 1000 ? `${f} Hz` : `${f / 1000} kHz`, x + 4, h - 6)
        }
        analyserL?.getFloatFrequencyData(freqL)
        g.strokeStyle = PLOT.l
        g.lineWidth = 1.5
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
