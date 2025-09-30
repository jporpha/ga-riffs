# GA Riff Generator (Node.js)

**Genetic Algorithm Riff Generator** — A tiny Node.js CLI that **evolves rhythmic patterns** (binary genomes) into **MIDI riffs**. You pick the notes/instruments in your DAW; the algorithm designs the **groove** (on/off events in time).

> ⚙️ Built for simplicity: no ML frameworks, just classic **Genetic Algorithms** + optional **Euclidean seeds** (Bjorklund) and musical heuristics.

---

## ✨ Features
- **CLI-first** workflow (no deps beyond `midi-writer-js`).
- **Presets**: `techno`, `organic` (ternary/12-step feel), `tribal`.
- **Euclidean seeds** via `--seed euclid:X` to start from balanced patterns.
- **Configurable GA**: population, generations, mutation, elitism, tournament-K.
- **Exports**: `*.mid` (one-bar riff) + `*.json` (pattern metadata).
- **NPM scripts** for quick riffs (basic + advanced).

---

## 📦 Installation
```bash
npm i midi-writer-js
```
Put `index.js` and `package.json` in your repo root. Run with Node 18+ recommended.

---

## 🚀 Quick Start
```bash
# Techno default preset
node index.js --preset techno

# Organic (12 steps), 110 bpm, 5 target hits
node index.js --preset organic --steps 12 --bpm 110 --target-hits 5

# Tribal with Euclidean seed of 7 pulses
node index.js --preset tribal --seed euclid:7 --outfile tribal_7
```
Outputs:
- `*.mid` — import into your DAW, assign instrument/note.
- `*.json` — contains steps, pattern array, and onsets.

---

## 🧰 CLI Options
```
--preset <techno|organic|tribal|custom>
--steps <n>              # steps per bar (e.g., 16 for 4/4 sixteenth-notes)
--bpm <n>                # MIDI tempo (default: 120)
--target-hits <n>        # desired number of onsets per bar
--gens <n>               # GA generations (default: 200)
--pop <n>                # population size (default: 120)
--elitism <n>            # number of elites (default: 4)
--mut <0-1>              # mutation rate (default: 0.05)
--k <n>                  # tournament K (default: 3)
--note <0-127>           # MIDI note number (default: 36 = C2)
--velocity <1-100>       # note velocity (default: 90)
--outfile <name>         # output base name (default: <preset>_riff)
--seed <none|euclid:X>   # initial genome seed (Bjorklund with X pulses)
--no-midi                # skip MIDI export
--no-json                # skip JSON export
--help                   # show help
```

---

## 🎚️ Presets
| Preset  | Steps | Accents           | Target Hits | Sync Bias | Notes |
|---------|------:|-------------------|------------:|----------:|-------|
| techno  | 16    | 0,4,8,12          | 6           | 0.5       | 4/4 sixteenth; strong downbeats |
| organic | 12    | 0,3,6,9           | 5           | 0.6       | ternary/12 feel; gentle swing-ready |
| tribal  | 16    | 0,8               | 8           | 0.7       | denser, open accents |

> You can override any parameter regardless of preset.

---

## 🧪 Example Workflows
**1) Techno, explore more variety**
```bash
node index.js --preset techno --gens 400 --pop 200 --mut 0.08 --outfile tech_var
```

**2) Organic, slower BPM, fewer hits**
```bash
node index.js --preset organic --steps 12 --bpm 108 --target-hits 4 --outfile org_slow
```

**3) Tribal + Euclid seed, custom note/velocity**
```bash
node index.js --preset tribal --seed euclid:7 --note 38 --velocity 95 --outfile tribal_d2
```

**4) Custom preset feel**
```bash
# Start from 'custom' but specify everything explicitly
node index.js --preset custom --steps 16 --target-hits 7 --bpm 124 --gens 300 --pop 180 --mut 0.06 --outfile custom_124
```

---

## 🎛️ NPM Scripts
Besides running with Node directly, you can use NPM scripts from `package.json`:

### Basic
```bash
npm run riff:techno
npm run riff:organic
npm run riff:tribal
npm run riff:custom
```

### Advanced
```bash
npm run riff:euclid7       # Tribal with Euclidean seed of 7 pulses
npm run riff:slow-organic  # Organic, 12 steps at 100 bpm, 4 hits
npm run riff:dense-techno  # Techno, 9 hits, longer GA, denser groove
npm run riff:groovy-tribal # Tribal, note D2, velocity 95
npm run riff:odd-meter     # Odd meter (7/8), 14 steps, 6 hits
```

---

## 🎼 MIDI Tips
- Default note is **C2 (36)**; change with `--note` or in your DAW.
- The generator writes **sixteenth-note durations** for each onset.
- To add **swing** in your DAW: apply groove/swing to sixteenths.
- For polymeters (e.g., 7/8): set `--steps 14` and adjust accents/target-hits accordingly.

---

## 🧠 How Fitness Works (Simplified)
- **Density** close to `--target-hits` ✔️
- **Accents** placed on strong beats per preset ✔️
- **Syncopation** preference ✔️
- **Variety** in inter-onset intervals ✔️
- Penalties for **overlong runs** of 1s and **empty bars** ✖️

> You can tune feel by changing `--target-hits`, steps, seed, or by editing preset weights in code.

---

## 🐛 Troubleshooting
- **No MIDI created**: ensure you didn’t pass `--no-midi` and that `midi-writer-js` is installed.
- **DAW imports but you hear nothing**: check instrument assignment and note range (`--note`).
- **All-on or all-off patterns**: increase generations or tweak mutation, try an Euclidean seed.

---

## 🗺️ Roadmap
- Multi-bar evolution & pattern chaining.
- Swing/time-shifted exports.
- Multi-voice exports (kick/snare/hats lanes).
- Style presets packs (`minimal`, `breaks`, `afro`, `latin`).
- Learnable fitness from user likes (ranked-choice selection).

---

## 🤝 Contributing
PRs welcome. Ideas/issues: open a discussion. Keep code dependency-light.

---

## 📄 License
MIT. See `LICENSE` (optional).