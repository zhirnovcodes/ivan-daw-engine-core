import { EFFECTS } from '../fields'

const app = document.getElementById('app') as HTMLElement
const h1 = document.createElement('h1')
h1.textContent = 'ivan-daw-engine-core playground'
const p = document.createElement('p')
p.textContent = 'One page per effect. Each runs the library compiled to wasm in an AudioWorklet.'
const ul = document.createElement('ul')
for (const { def, href } of EFFECTS) {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.href = href
    a.textContent = def.title
    li.append(a, ` – ivandaw::fx::${def.struct}`)
    ul.append(li)
}
app.append(h1, p, ul)
