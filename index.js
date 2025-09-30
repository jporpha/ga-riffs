const fs = require('fs');
const Midi = require('midi-writer-js');

// ---------- Parámetros ----------
const STEPS = 16;           // 16 = semicorcheas en 4/4, ajustable
const POP_SIZE = 120;       // tamaño población
const GENERATIONS = 200;    // iteraciones
const ELITISM = 4;          // cuántos mejores pasan directo
const MUTATION_RATE = 0.05; // prob. de mutación por bit
const TOURNAMENT_K = 3;     // selección por torneo

// Música
const TARGET_HITS = 6;      // densidad objetivo (golpes por compás)
const BPM = 120;            // tempo del MIDI exportado
const MIDI_NOTE = 36;       // C2 por defecto (cámbialo después a gusto)
const VELOCITY = 90;        // 1-100 aprox. (midi-writer-js)

// ---------- Utilidades ----------
function randInt(n) { return Math.floor(Math.random() * n); }
function clone(arr) { return arr.slice(); }
function randomGenome(steps = STEPS) {
  // Densidad aleatoria suave (2..10), para no empezar con basura vacía
  const hits = 2 + randInt(Math.min(10, steps));
  const g = new Array(steps).fill(0);
  for (let i = 0; i < hits; i++) g[randInt(steps)] = 1;
  return g;
}

function countOnes(g) { return g.reduce((a,b)=>a+b,0); }

function runLengths(g) {
  // longitudes de rachas de 1s
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

// ---------- Fitness ----------
function fitness(g) {
  // 1) Densidad cerca de objetivo
  const hits = countOnes(g);
  const densityScore = Math.max(0, 1 - Math.abs(hits - TARGET_HITS) / TARGET_HITS); // [0..1]

  // 2) Acentos en tiempos fuertes (0, 4, 8, 12)
  const strong = [0, 4, 8, 12].filter(i => i < g.length);
  let strongScore = 0;
  for (const i of strong) if (g[i] === 1) strongScore += 1;
  strongScore = strongScore / strong.length; // [0..1]

  // 3) Síncopa (off-beats). Premia golpes en posiciones impares (orientativo)
  let syncop = 0;
  for (let i=0;i<g.length;i++) if (g[i] === 1 && (i % 2 === 1)) syncop++;
  const syncopScore = hits > 0 ? (syncop / hits) : 0; // [0..1]

  // 4) Penalizar rachas largas (>3)
  const rl = runLengths(g);
  const longRuns = rl.filter(r => r >= 4).length;
  const longRunPenalty = longRuns > 0 ? 0.3 * longRuns : 0; // resta

  // 5) Variedad de IOI (inter-onset intervals). No queremos todo 1,1,1,1…
  const ioi = interOnsetIntervals(g);
  const varIOI = variance(ioi);
  // Normaliza rudimentariamente: si var>2 ya está “bien”
  const varietyScore = Math.min(1, varIOI / 2);

  // 6) Evitar barras vacías (o con un único golpe)
  const emptinessPenalty = hits === 0 ? 1.0 : (hits === 1 ? 0.4 : 0);

  let score = (
    2.0 * densityScore +
    1.5 * strongScore +
    1.2 * syncopScore +
    1.3 * varietyScore
  ) - (longRunPenalty + emptinessPenalty);

  return score;
}

// ---------- GA Ops ----------
function tournamentSelect(pop, k=TOURNAMENT_K) {
  let best = null;
  for (let i=0;i<k;i++){
    const c = pop[randInt(pop.length)];
    if (!best || c.fit > best.fit) best = c;
  }
  return best.genome;
}

function crossover(a, b) {
  // 1-point crossover
  const point = 1 + randInt(a.length-2); // evita extremos
  const child = a.slice(0, point).concat(b.slice(point));
  return child;
}

function mutate(g) {
  const c = clone(g);
  for (let i=0;i<c.length;i++){
    if (Math.random() < MUTATION_RATE) c[i] = c[i] ? 0 : 1;
  }
  return c;
}

// ---------- Bucle principal ----------
function evolve() {
  // Población inicial
  let population = new Array(POP_SIZE).fill(0).map(()=>({ genome: randomGenome(), fit: 0 }));

  // Evaluar
  population.forEach(ind => ind.fit = fitness(ind.genome));

  for (let gen=0; gen<GENERATIONS; gen++){
    // Ordenar por fitness desc
    population.sort((x,y)=> y.fit - x.fit);

    // Log breve cada cierto tiempo
    if (gen % 20 === 0 || gen === GENERATIONS-1) {
      const best = population[0];
      console.log(`Gen ${gen} | best=${best.fit.toFixed(3)} | hits=${countOnes(best.genome)} | ${best.genome.join('')}`);
    }

    // Nueva población con elitismo
    const next = [];
    for (let i=0;i<ELITISM;i++) next.push({ genome: clone(population[i].genome), fit: population[i].fit });

    // Resto por cruce + mutación
    while (next.length < POP_SIZE) {
      const p1 = tournamentSelect(population);
      const p2 = tournamentSelect(population);
      let child = Math.random() < 0.9 ? crossover(p1, p2) : clone(p1);
      child = mutate(child);
      next.push({ genome: child, fit: 0 });
    }

    // Evaluar nueva población
    next.forEach(ind => ind.fit = fitness(ind.genome));
    population = next;
  }

  population.sort((x,y)=> y.fit - x.fit);
  return population[0];
}

// ---------- Export MIDI ----------
function patternToMidi(genome, bpm=BPM, midiNote=MIDI_NOTE, velocity=VELOCITY) {
  const track = new Midi.Track();
  track.setTempo(bpm);
  track.addTrackName('GA Riff');

  // Queremos que cada step sea una semicorchea => duración "16"
  // midi-writer-js usa notación como "16", "8", "4"...
  // Para convertir pasos a eventos: usamos "wait" para colocar el onset exacto.
  let waitSteps = 0;
  const events = [];

  for (let i=0;i<genome.length;i++){
    if (genome[i] === 1) {
      // Añadimos una nota con "wait" acumulado
      events.push(new Midi.NoteEvent({
        pitch: [midiNote],
        duration: '16',
        velocity,
        wait: waitSteps > 0 ? `T${waitSteps}` : undefined // Tn = ticks relativos; midi-writer-js usa ticks por step interno
      }));
      waitSteps = 0; // resetea
    } else {
      waitSteps += 1; // acumula silencio
    }
  }

  // Si termina en silencio, da igual; el compás cierra.
  track.addEvent(events);
  const write = new Midi.Writer([track]);
  const data = write.buildFile();
  fs.writeFileSync('riff.mid', data, 'binary');
}

function savePattern(genome) {
  const out = {
    steps: genome.length,
    pattern: genome,
    onsets: onsets(genome),
    targetHits: TARGET_HITS,
    bpm: BPM,
    note: MIDI_NOTE
  };
  fs.writeFileSync('pattern.json', JSON.stringify(out, null, 2));
}

// ---------- Run ----------
const best = evolve();
console.log('\nMejor patrón:', best.genome.join(' '), `| fitness=${best.fit.toFixed(3)}`);
savePattern(best.genome);
patternToMidi(best.genome);
console.log('Guardados: riff.mid y pattern.json');
