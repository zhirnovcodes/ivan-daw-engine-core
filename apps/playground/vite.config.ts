import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const page = (name: string) => resolve(import.meta.dirname, `${name}.html`)

export default defineConfig({
    // Relative, so the built site works from any folder (or GitHub Pages).
    base: './',
    // Its own address: IvanDAW and Beatality use 5173, Beatality also 5180, both on every interface.
    // Binding 127.0.0.1 explicitly wins over their wildcard listeners, so http://127.0.0.1:5290 is always
    // this playground. strictPort: fail instead of silently moving to another port.
    server: { host: '127.0.0.1', port: 5290, strictPort: true, open: '/index.html' },
    preview: { host: '127.0.0.1', port: 5291, strictPort: true },
    build: {
        rollupOptions: {
            input: {
                index: page('index'),
                delay: page('delay'),
                reverb: page('reverb'),
                filter: page('filter'),
                unison: page('unison'),
            },
        },
    },
})
