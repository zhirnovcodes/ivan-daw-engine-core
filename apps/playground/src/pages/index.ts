import '../style.css'
import { EFFECTS } from '../fields'

const app = document.getElementById('app') as HTMLElement
app.innerHTML = `
  <header>
    <h1>ivan-daw-engine-core playground</h1>
    <p>Each page runs one effect from the library, compiled to wasm, inside an AudioWorklet.
       Pick an input, press Play, move the sliders. Bypass compares with the dry signal.</p>
  </header>
  <div class="cards"></div>`
const cards = app.querySelector('.cards') as HTMLElement
for (const { def, href } of EFFECTS) {
    const a = document.createElement('a')
    a.className = 'card'
    a.href = href
    a.innerHTML = `<h2></h2><p></p>`
    ;(a.querySelector('h2') as HTMLElement).textContent = def.title
    ;(a.querySelector('p') as HTMLElement).textContent = def.blurb
    cards.append(a)
}
