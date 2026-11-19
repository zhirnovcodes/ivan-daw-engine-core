import { UNISON, UNISON_PARAM } from '../fields'
import { mountRig, type Rig } from '../rig'

// Where each voice sits: pan across, and its detune / offset / LFO share down.
const canvas = document.createElement('canvas')
canvas.width = 1200
canvas.height = 160

function color(name: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function drawVoices(rig: Rig) {
    const { voices, type, param } = rig.values
    const g = canvas.getContext('2d') as CanvasRenderingContext2D
    const { width: w, height: h } = canvas
    g.fillStyle = color('--plot-bg')
    g.fillRect(0, 0, w, h)
    g.fillStyle = color('--muted')
    g.font = '20px system-ui'
    g.fillText('L', 12, h / 2 + 7)
    g.fillText('R', w - 26, h / 2 + 7)
    for (let i = 0; i < voices; i++) {
        const spread = voices > 1 ? -1 + (2 * i) / (voices - 1) : 0
        const share = voices > 1 ? i / (voices - 1) : 0
        const x = w / 2 + spread * (w / 2 - 70)
        const text =
            type === 0
                ? `${spread * param >= 0 ? '+' : ''}${(spread * param).toFixed(1)} ct`
                : type === 2
                  ? `${(share * param).toFixed(1)} ms`
                  : `${(0.25 + 0.65 * share).toFixed(2)} Hz`
        g.fillStyle = color('--series-l')
        g.beginPath()
        g.arc(x, h / 2 - 10, 14, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = color('--text')
        g.textAlign = 'center'
        g.fillText(text, x, h / 2 + 34)
        g.textAlign = 'left'
    }
}

const rig = mountRig(UNISON, {
    onChange(r, changed) {
        if (changed === 'type') {
            const p = UNISON_PARAM[r.values.type]
            r.updateField('param', { label: p.label, max: p.max, step: p.step, value: p.value, format: p.format })
        }
        drawVoices(r)
    },
})
const figure = document.createElement('figure')
figure.append(canvas, Object.assign(document.createElement('figcaption'), { textContent: 'Voices: pan position and what makes each one different (Chorus shows its LFO rate)' }))
rig.extra.append(figure)
drawVoices(rig)
