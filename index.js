// GA Riffs - Node.js (CLI + Presets)
// Autor: JP + ChatGPT
// Ejecuta: node index.js --help
// Dependencias: midi-writer-js (npm i midi-writer-js)

const fs = require('fs');
const Midi = require('midi-writer-js');

// ---------------- CLI PARSER (sin dependencias) ----------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    let a = argv[i];
    if (a.startsWith('--')) {
      const k = a.replace(/^--/, '');
      // boolean flags
      if (k === 'help' || k === 'no-midi' || k === 'no-json') {
        args[k] = true; continue;
      }
      // key=value ó key value
      const next = argv[i + 1];
      if (typeof next === 'undefined' || next.startsWith('--')) {
        args[k] = true; // treat as boolean if no value
      } else {
        args[k] = next; i++;
      }
    }
  }
  return args;
}

function printHelp() {
  console.log(`\nGenetic Algorithm Riff Generator (Node.js)\n\nUso básico:\n  node index.js --preset techno\n\nOpciones:\n  --preset <techno|organic|tribal|custom>  Selecciona un preset rítmico\n  --steps <n>         Número de steps por compás (p.ej. 16)\n  --bpm <n>           Tempo para el MIDI (default: 120)\n  --target-hits <n>   Golpes objetivo en el compás (p.ej. 6)\n  --gens <n>          Generaciones del GA (default: 200)\n  --pop <n>           Tamaño población (default: 120)\n  --elitism <n>       Individuos élite que pasan directo (default: 4)\n  --mut <0-1>         Prob. de mutación por bit (default: 0.05)\n  --k <n>             Torneo K (default: 3)\n  --note <n>          Nota MIDI (default: 36 = C2)\n  --velocity <1-100>  Velocidad de nota (default: 90)\n  --outfile <name>    Nombre base de salida (default: riff)\n  --seed <none|euclid:X>  Semilla inicial (ninguna o euclid con X golpes)\n  --no-midi           No exportar MIDI\n  --no-json           No exportar JSON\n  --help              Mostrar ayuda\n\nEjemplos:\n  node index.js --preset techno --gens 300\n  node index.js --preset organic --steps 12 --target-hits 5 --bpm 110\n  node index.js --preset tribal --seed euclid:7 --outfile tribal_7\n  node index.js --preset custom --steps 16 --target-hits 8 --mut 0.08\n`);
}

// ---------------- PRESETS ----------------
const PRESETS = {
  techno: {
    STEPS: 16,
    TARGET_HITS: 6,
    ACCENTS: [0, 4, 8, 12], // negras
    SYNC_OPTY: 0.5,         // apetito por síncopa
    LONG_RUN_PENALTY: 0.3,
    DENSITY_W: 2.0,
    STRONG_W: 1.6,
    SYNC_W: 1.2,
    VAR_W: 1.2,
  },
  organic: {
    STEPS: 12,              // feel ternario / 12 steps
    TARGET_HITS: 5,
    ACCENTS: [0, 3, 6, 9],  // pulsos ternarios
    SYNC_OPTY: 0.6,
    LONG_RUN_PENALTY: 0.25,
    DENSITY_W: 1.8,
    STRONG_W: 1.3,
    SYNC_W: 1.4,
    VAR_W: 1.3,
  },
  tribal: {
    STEPS: 16,
    TARGET_HITS: 8,
    ACCENTS: [0, 8],        // compases abiertos; peso menor a acentos clásicos
    SYNC_OPTY: 0.7,
    LONG_RUN_PENALTY: 0.2,
    DENSITY_W: 1.7,
    STRONG_W: 1.1,
    SYNC_W: 1.5,
    VAR_W: 1.4,
  }
};

// ---------------- UTILIDADES ----------------
function randInt(n) { return Math.floor(Math.random() * n); }
function clone(arr) { return arr.slice(); }
function countOnes(g) { return g.reduce((a,b)=>a+b,0); }

function randomGenome(steps, seedOpt) {
  if (seedOpt && seedOpt.startsWith('euclid:')) {
    const hits = Math.max(1, parseInt(seedOpt.split(':')[1], 10) || 1);
    return euclideanPattern(steps, hits);
  }
  const hits = Math.max(1, Math.min(steps, 2 + randInt(Math.min(10, steps))));
  const g = new Array(steps).fill(0);
  for (let i = 0; i < hits; i++) g[randInt(steps)] = 1;
  return g;
}

// Algoritmo de Bjorklund (patrón euclidiano básico)
function euclideanPattern(steps, pulses) {
  pulses = Math.min(pulses, steps);
  const pattern = [];
  const counts = [];
  const remainders = [];
  remainders.push(pulses);
  let divisor = steps - pulses;
  let level = 0;
  while (true) {
    counts.push(Math.floor(divisor / remainders[level]));
    remainders.push(divisor % remainders[level]);
    divisor = remainders[level];
    level += 1;
    if (remainders[level] <= 1) { break; }
  }
  counts.push(divisor);
  function build(level) {
    if (level === -1) { pattern.push(0); }
    else if (level === -2) { pattern.push(1); }
    else {
      for (let i = 0; i < counts[level]; i++) build(level - 1);
      if (remainders[level] !== 0) build(level - 2);
    }
  }
  build(level);
  // pattern es de 0/1 pero puede quedar con longitud != steps, normalizamos:
  if (pattern.length > steps) return pattern.slice(0, steps);
  if (pattern.length < steps) return pattern.concat(new Array(steps - pattern.length).fill(0));
  return pattern;
}

function runLengths(g) {
  const lens = [];
  let c = 0;
  for (let i=0;i<g.length;i++){
    if (g[i] === 1) c++;
    if (g[i] === 0 || i === g.length-1) {
      if (g[i] === 0 && c>0) { lens.push(c); c = 0; }
      if (i === g.length-1 && g[i] === 1) { lens.push(c); }
    }
  }
  return lens;
}

function onsets(g) {
  const idx = [];
  for (let i=0;i<g.length;i++) if (g[i] === 1) idx.push(i);
  return idx;
}

function interOnsetIntervals(g) {
  const o = onsets(g);
  if (o.length < 2) return [];
  const res = [];
  for (let i=1;i<o.length;i++) res.push(o[i]-o[i-1]);
  return res;
}

function variance(xs) {
  if (xs.length === 0) return 0;
  const m = xs.reduce((a,b)=>a+b,0)/xs.length;
  const v = xs.reduce((a,b)=>a+(b-m)*(b-m),0)/xs.length;
  return v;
}

// ---------------- FITNESS ----------------
function makeFitness(cfg) {
  const {
    TARGET_HITS, ACCENTS, SYNC_OPTY,
    LONG_RUN_PENALTY, DENSITY_W, STRONG_W, SYNC_W, VAR_W
  } = cfg;

  return function fitness(g) {
    const hits = countOnes(g);
    const densityScore = Math.max(0, 1 - Math.abs(hits - TARGET_HITS) / Math.max(1, TARGET_HITS)); // [0..1]

    let strongScore = 0;
    if (ACCENTS && ACCENTS.length) {
      let s = 0;
      for (const i of ACCENTS) if (i < g.length && g[i] === 1) s++;
      strongScore = s / ACCENTS.length;
    }

    let syncop = 0;
    for (let i=0;i<g.length;i++) if (g[i] === 1 && (i % 2 === 1)) syncop++;
    // Ajuste por apetito de síncopa del preset
    const syncopRatio = hits > 0 ? (syncop / hits) : 0;
    const syncopScore = Math.min(1, syncopRatio + SYNC_OPTY * 0.15);

    const rl = runLengths(g);
    const longRuns = rl.filter(r => r >= 4).length;
    const longRunPenalty = (longRuns > 0 ? LONG_RUN_PENALTY * longRuns : 0);

    const ioi = interOnsetIntervals(g);
    const varIOI = variance(ioi);
    const varietyScore = Math.min(1, varIOI / 2);

    const emptinessPenalty = hits === 0 ? 1.0 : (hits === 1 ? 0.4 : 0);

    let score = (
      DENSITY_W * densityScore +
      STRONG_W * strongScore +
      SYNC_W   * syncopScore +
      VAR_W    * varietyScore
    ) - (longRunPenalty + emptinessPenalty);

    return score;
  }
}

// ---------------- GA ----------------
function tournamentSelect(pop, k) {
  let best = null;
  for (let i=0;i<k;i++){
    const c = pop[randInt(pop.length)];
    if (!best || c.fit > best.fit) best = c;
  }
  return best.genome;
}

function crossover(a, b) {
  if (a.length !== b.length) throw new Error('Crossover length mismatch');
  const point = 1 + randInt(a.length - 2);
  return a.slice(0, point).concat(b.slice(point));
}

function mutate(g, rate) {
  const c = clone(g);
  for (let i=0;i<c.length;i++) if (Math.random() < rate) c[i] = c[i] ? 0 : 1;
  return c;
}

function evolve(cfg) {
  const {
    STEPS, POP_SIZE, GENERATIONS, ELITISM, MUTATION_RATE, TOURNAMENT_K,
    FITNESS, BPM, MIDI_NOTE, VELOCITY, SEED
  } = cfg;

  let population = new Array(POP_SIZE).fill(0).map(()=>({ genome: randomGenome(STEPS, SEED), fit: 0 }));
  population.forEach(ind => ind.fit = FITNESS(ind.genome));

  for (let gen=0; gen<GENERATIONS; gen++){
    population.sort((x,y)=> y.fit - x.fit);
    if (gen % 20 === 0 || gen === GENERATIONS-1) {
      const best = population[0];
      console.log(`Gen ${gen} | best=${best.fit.toFixed(3)} | hits=${countOnes(best.genome)} | ${best.genome.join('')}`);
    }

    const next = [];
    for (let i=0;i<ELITISM;i++) next.push({ genome: clone(population[i].genome), fit: population[i].fit });

    while (next.length < POP_SIZE) {
      const p1 = tournamentSelect(population, TOURNAMENT_K);
      const p2 = tournamentSelect(population, TOURNAMENT_K);
      let child = Math.random() < 0.9 ? crossover(p1, p2) : clone(p1);
      child = mutate(child, MUTATION_RATE);
      next.push({ genome: child, fit: 0 });
    }

    next.forEach(ind => ind.fit = FITNESS(ind.genome));
    population = next;
  }

  population.sort((x,y)=> y.fit - x.fit);
  return population[0];
}

// ---------------- EXPORT ----------------
function patternToMidi(genome, bpm, midiNote, velocity, outfileBase) {
  const track = new Midi.Track();
  track.setTempo(bpm);
  track.addTrackName('GA Riff');

  let waitSteps = 0;
  const events = [];
  for (let i=0;i<genome.length;i++){
    if (genome[i] === 1) {
      events.push(new Midi.NoteEvent({
        pitch: [midiNote],
        duration: '16',
        velocity,
        wait: waitSteps > 0 ? `T${waitSteps}` : undefined
      }));
      waitSteps = 0;
    } else {
      waitSteps += 1;
    }
  }
  if (events.length === 0) {
    // Forzar una nota corta al inicio para evitar MIDI vacío
    events.push(new Midi.NoteEvent({ pitch: [midiNote], duration: '16', velocity }));
  }

  track.addEvent(events);
  const write = new Midi.Writer([track]);
  const data = write.buildFile();
  fs.writeFileSync(`${outfileBase}.mid`, data, 'binary');
}

function savePattern(genome, meta, outfileBase) {
  const out = {
    steps: genome.length,
    pattern: genome,
    onsets: onsets(genome),
    ...meta
  };
  fs.writeFileSync(`${outfileBase}.json`, JSON.stringify(out, null, 2));
}

// ---------------- MAIN ----------------
(function main(){
  const argv = parseArgs(process.argv);
  if (argv.help) return printHelp();

  const presetKey = (argv.preset || 'techno').toLowerCase();
  const preset = PRESETS[presetKey] || PRESETS.techno;

  const STEPS = parseInt(argv.steps || preset.STEPS, 10);
  const TARGET_HITS = parseInt(argv['target-hits'] || preset.TARGET_HITS, 10);
  const BPM = parseInt(argv.bpm || 120, 10);
  const GENERATIONS = parseInt(argv.gens || 200, 10);
  const POP_SIZE = parseInt(argv.pop || 120, 10);
  const ELITISM = parseInt(argv.elitism || 4, 10);
  const MUTATION_RATE = parseFloat(argv.mut || 0.05);
  const TOURNAMENT_K = parseInt(argv.k || 3, 10);
  const MIDI_NOTE = parseInt(argv.note || 36, 10);
  const VELOCITY = parseInt(argv.velocity || 90, 10);
  const OUTFILE = (argv.outfile || `${presetKey}_riff`).toString();
  const SEED = (argv.seed || '').toString();

  const FITNESS = makeFitness({
    TARGET_HITS,
    ACCENTS: preset.ACCENTS,
    SYNC_OPTY: preset.SYNC_OPTY,
    LONG_RUN_PENALTY: preset.LONG_RUN_PENALTY,
    DENSITY_W: preset.DENSITY_W,
    STRONG_W: preset.STRONG_W,
    SYNC_W: preset.SYNC_W,
    VAR_W: preset.VAR_W
  });

  const best = evolve({
    STEPS, POP_SIZE, GENERATIONS, ELITISM, MUTATION_RATE, TOURNAMENT_K,
    FITNESS, BPM, MIDI_NOTE, VELOCITY, SEED
  });

  console.log(`\nMejor patrón: ${best.genome.join(' ')} | fitness=${best.fit.toFixed(3)}`);

  if (!argv['no-json']) {
    savePattern(best.genome, { preset: presetKey, targetHits: TARGET_HITS, bpm: BPM, note: MIDI_NOTE }, OUTFILE);
    console.log(`Guardado JSON: ${OUTFILE}.json`);
  }
  if (!argv['no-midi']) {
    patternToMidi(best.genome, BPM, MIDI_NOTE, VELOCITY, OUTFILE);
    console.log(`Guardado MIDI: ${OUTFILE}.mid`);
  }
})();
