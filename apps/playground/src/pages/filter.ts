import { FILTER } from '../fields'
import { morphMix, responseDb } from '../filterResponse'
import { canvas, PLOT } from '../plot'
import { mountRig, type Rig } from '../rig'

const RATE = 48000
const response = canvas(1000, 260)
const weights = canvas(1000, 100)

const xOf = (f: number, w: number) => (Math.log(f / 20) / Math.log(1000)) * w

function drawResponse(rig: Rig) {
    const v = rig.values as Parameters<typeof responseDb>[2]
    const g = response.getContext('2d') as CanvasRenderingContext2D
    const { width: w, height: h } = response
    const top = 30
    const bottom = -60
    const yOf = (db: number) => ((top - Math.max(bottom, Math.min(top, db))) / (top - bottom)) * h
    g.fillStyle = PLOT.bg
    g.fillRect(0, 0, w, h)
    g.strokeStyle = PLOT.grid
    g.fillStyle = PLOT.text
    g.font = '14px sans-serif'
    for (const db of [24, 12, 0, -12, -24, -36, -48]) {
        g.beginPath()
        g.moveTo(0, yOf(db))
        g.lineTo(w, yOf(db))
        g.stroke()
        g.fillText(`${db} dB`, 4, yOf(db) - 3)
    }
    for (const f of [100, 1000, 10000]) {
        g.beginPath()
        g.moveTo(xOf(f, w), 0)
        g.lineTo(xOf(f, w), h)
        g.stroke()
        g.fillText(f < 1000 ? `${f} Hz` : `${f / 1000} kHz`, xOf(f, w) + 4, h - 6)
    }
    g.strokeStyle = PLOT.l
    g.lineWidth = 2
    g.beginPath()
    for (let x = 0; x <= w; x++) {
        const y = yOf(responseDb(20 * 1000 ** (x / w), RATE, v))
        x ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.stroke()
}

// Morph weights across the whole position axis; the dashed line is the current filterPosition.
function drawWeights(rig: Rig) {
    const v = rig.values
    const g = weights.getContext('2d') as CanvasRenderingContext2D
    const { width: w, height: h } = weights
    g.fillStyle = PLOT.bg
    g.fillRect(0, 0, w, h)
    const series = [
        ['low', PLOT.l],
        ['band', PLOT.third],
        ['high', PLOT.r],
    ] as const
    g.font = '14px sans-serif'
    series.forEach(([key, c], i) => {
        g.strokeStyle = c
        g.lineWidth = 2
        g.beginPath()
        for (let x = 0; x <= w; x++) {
            const m = morphMix(x / w, v.morphLow, v.morphHigh)
            const y = h - 6 - m[key] * (h - 26)
            x ? g.lineTo(x, y) : g.moveTo(x, y)
        }
        g.stroke()
        g.fillStyle = c
        g.fillText(key, 6 + i * 50, 14)
    })
    g.strokeStyle = PLOT.marker
    g.setLineDash([5, 5])
    g.beginPath()
    g.moveTo(v.filterPosition * w, 0)
    g.lineTo(v.filterPosition * w, h)
    g.stroke()
    g.setLineDash([])
}

const morphBlock = document.createElement('div')

function redraw(rig: Rig) {
    drawResponse(rig)
    morphBlock.hidden = rig.values.type !== 3
    drawWeights(rig)
}

const rig = mountRig(FILTER, { onChange: redraw })
const fieldset = document.createElement('fieldset')
const legend = document.createElement('legend')
legend.textContent = 'Response (target settings, 48 kHz)'
const note = document.createElement('p')
note.textContent = 'Morph weights along filterPosition (dashed line = current position)'
morphBlock.append(note, weights)
fieldset.append(legend, response, morphBlock)
rig.extra.append(fieldset)
redraw(rig)
