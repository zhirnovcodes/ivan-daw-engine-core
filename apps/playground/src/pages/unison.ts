import { UNISON, UNISON_PARAM } from '../fields'
import { canvas, PLOT } from '../plot'
import { mountRig, type Rig } from '../rig'

// Each voice: pan position across, and what makes it different underneath.
const voicesCanvas = canvas(1000, 110)

function drawVoices(rig: Rig) {
    const { type, param } = rig.values
    const voices = Math.min(8, Math.max(1, Math.round(rig.values.voices)))
    const g = voicesCanvas.getContext('2d') as CanvasRenderingContext2D
    const { width: w, height: h } = voicesCanvas
    g.fillStyle = PLOT.bg
    g.fillRect(0, 0, w, h)
    g.font = '14px sans-serif'
    g.fillStyle = PLOT.text
    g.fillText('L', 8, h / 2)
    g.fillText('R', w - 18, h / 2)
    g.textAlign = 'center'
    for (let i = 0; i < voices; i++) {
        const spread = voices > 1 ? -1 + (2 * i) / (voices - 1) : 0
        const share = voices > 1 ? i / (voices - 1) : 0
        const x = w / 2 + spread * (w / 2 - 60)
        const text =
            type === 0
                ? `${spread * param >= 0 ? '+' : ''}${(spread * param).toFixed(1)} ct`
                : type === 2
                  ? `${(share * param).toFixed(1)} ms`
                  : `LFO ${(0.25 + 0.65 * share).toFixed(2)} Hz`
        g.fillStyle = PLOT.l
        g.beginPath()
        g.arc(x, h / 2 - 12, 10, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = PLOT.text
        g.fillText(text, x, h / 2 + 22)
    }
    g.textAlign = 'left'
}

const rig = mountRig(UNISON, {
    onChange(r, changed) {
        if (changed === 'type') {
            const p = UNISON_PARAM[r.values.type]
            r.updateField('param', { max: p.max, step: p.step, unit: p.unit })
        }
        drawVoices(r)
    },
})
const fieldset = document.createElement('fieldset')
const legend = document.createElement('legend')
legend.textContent = 'Voices'
fieldset.append(legend, voicesCanvas)
rig.extra.append(fieldset)
drawVoices(rig)
