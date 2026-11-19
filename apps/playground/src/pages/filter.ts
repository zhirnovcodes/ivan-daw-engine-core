import { FILTER } from '../fields'
import { morphMix, responseDb } from '../filterResponse'
import { mountRig, type Rig } from '../rig'

const RATE = 48000

const canvas = document.createElement('canvas')
canvas.width = 1200
canvas.height = 300
const weights = document.createElement('canvas')
weights.width = 1200
weights.height = 110

function color(name: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function xOf(f: number, w: number) {
    return (Math.log(f / 20) / Math.log(1000)) * w
}

function drawResponse(rig: Rig) {
    const v = rig.values as Parameters<typeof responseDb>[2]
    const g = canvas.getContext('2d') as CanvasRenderingContext2D
    const { width: w, height: h } = canvas
    const top = 30
    const bottom = -60
    const yOf = (db: number) => ((top - Math.max(bottom, Math.min(top, db))) / (top - bottom)) * h
    g.fillStyle = color('--plot-bg')
    g.fillRect(0, 0, w, h)
    g.strokeStyle = color('--grid')
    g.fillStyle = color('--muted')
    g.font = '20px system-ui'
    for (const db of [24, 12, 0, -12, -24, -36, -48]) {
        g.beginPath()
        g.moveTo(0, yOf(db))
        g.lineTo(w, yOf(db))
        g.stroke()
        g.fillText(`${db} dB`, 6, yOf(db) - 4)
    }
    for (const f of [100, 1000, 10000]) {
        g.beginPath()
        g.moveTo(xOf(f, w), 0)
        g.lineTo(xOf(f, w), h)
        g.stroke()
        g.fillText(f < 1000 ? `${f} Hz` : `${f / 1000} kHz`, xOf(f, w) + 6, h - 8)
    }
    g.strokeStyle = color('--series-l')
    g.lineWidth = 3
    g.beginPath()
    for (let x = 0; x <= w; x++) {
        const y = yOf(responseDb(20 * 1000 ** (x / w), RATE, v))
        x ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.stroke()
}

// The Morph weights across the whole position axis, with a marker at the current position.
function drawWeights(rig: Rig) {
    const v = rig.values
    const g = weights.getContext('2d') as CanvasRenderingContext2D
    const { width: w, height: h } = weights
    g.fillStyle = color('--plot-bg')
    g.fillRect(0, 0, w, h)
    const series = [
        ['low', '--series-l'],
        ['band', '--series-3'],
        ['high', '--series-r'],
    ] as const
    for (const [key, c] of series) {
        g.strokeStyle = color(c)
        g.lineWidth = 3
        g.beginPath()
        for (let x = 0; x <= w; x++) {
            const m = morphMix(x / w, v.morphLow, v.morphHigh)
            const y = h - 8 - m[key] * (h - 30)
            x ? g.lineTo(x, y) : g.moveTo(x, y)
        }
        g.stroke()
    }
    g.fillStyle = color('--muted')
    g.font = '20px system-ui'
    g.fillText('low', 8, 20)
    g.fillStyle = color('--series-3')
    g.fillText('band', w / 2 - 20, 20)
    g.fillStyle = color('--series-r')
    g.fillText('high', w - 50, 20)
    g.strokeStyle = color('--text')
    g.lineWidth = 2
    g.setLineDash([6, 6])
    g.beginPath()
    g.moveTo(v.filterPosition * w, 0)
    g.lineTo(v.filterPosition * w, h)
    g.stroke()
    g.setLineDash([])
}

function redraw(rig: Rig) {
    drawResponse(rig)
    weights.parentElement!.hidden = rig.values.type !== 3
    drawWeights(rig)
}

const rig = mountRig(FILTER, { onChange: redraw })
const response = document.createElement('figure')
response.append(canvas, Object.assign(document.createElement('figcaption'), { textContent: 'Response at 48 kHz (target settings, before the 5 ms glide)' }))
const morph = document.createElement('figure')
morph.append(weights, Object.assign(document.createElement('figcaption'), { textContent: 'Morph weights along the position axis; dashed line = current position' }))
rig.extra.append(response, morph)
redraw(rig)
