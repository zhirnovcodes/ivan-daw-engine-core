import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const page = (name: string) => resolve(import.meta.dirname, `${name}.html`)

export default defineConfig({
    // Relative, so the built site works from any folder (or GitHub Pages).
    base: './',
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
