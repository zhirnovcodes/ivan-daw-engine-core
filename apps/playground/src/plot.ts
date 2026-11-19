// Fixed plot colours. The pages have no stylesheet; only the canvases are drawn.
export const PLOT = {
    bg: '#ffffff',
    grid: '#dddddd',
    text: '#555555',
    l: '#007f7f',
    r: '#cc7a00',
    third: '#6a4fd8',
    marker: '#000000',
}

export function canvas(width: number, height: number) {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    c.style.border = '1px solid #999'
    c.style.maxWidth = '100%'
    return c
}
