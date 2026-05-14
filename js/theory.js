// ================================================================
//  theory.js v2 — Procedural Style Engine
//  Escalas · Presets · Perfis de Estilo · Grooves de Bateria
// ================================================================

// ────────────────────────────────────────────────────────────────
//  ESCALAS — intervalos em semitons a partir da tônica
// ────────────────────────────────────────────────────────────────
const SCALES = {
  major:      {i:[0,2,4,5,7,9,11],       label:'MAJOR'},
  minor:      {i:[0,2,3,5,7,8,10],       label:'MINOR (NATURAL)'},
  dorian:     {i:[0,2,3,5,7,9,10],       label:'DORIAN'},
  phrygian:   {i:[0,1,3,5,7,8,10],       label:'PHRYGIAN'},
  pentatonic: {i:[0,2,4,7,9],            label:'PENTATONIC'},
  lydian:     {i:[0,2,4,6,7,9,11],       label:'LYDIAN'},
  mixolydian: {i:[0,2,4,5,7,9,10],       label:'MIXOLYDIAN'},
  harmMinor:  {i:[0,2,3,5,7,8,11],       label:'HARMONIC MINOR'},
  blues:      {i:[0,3,5,6,7,10],         label:'BLUES'},
  wholeTone:  {i:[0,2,4,6,8,10],         label:'WHOLE TONE'},
  locrian:    {i:[0,1,3,5,6,8,10],       label:'LOCRIAN'},
  hungarian:  {i:[0,2,3,6,7,8,11],       label:'HUNGARIAN MINOR'},
};

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// ────────────────────────────────────────────────────────────────
//  TIPOS DE ACORDE — shapes sobre a escala
// ────────────────────────────────────────────────────────────────
const CHORD_SHAPES = {
  triad:   [0,2,4],       // tríade básica
  seventh: [0,2,4,6],     // tétrade (sétima)
  sus2:    [0,1,4],       // suspenso 2
  sus4:    [0,3,4],       // suspenso 4
  power:   [0,4],         // power chord (5ª)
  cluster: [0,1,2],       // cluster de semitons
  add9:    [0,2,4,1],     // tríade + 9ª
  shell:   [0,2,6],       // shell chord (3ª + 7ª)
};

// ────────────────────────────────────────────────────────────────
//  PERFIS DE ESTILO — DNA musical de cada preset
// ────────────────────────────────────────────────────────────────
const STYLE_PROFILES = {
  heroic: {
    label:         'HEROIC',
    rhythmDensity: 0.65,   // probabilidade de preencher cada pulso
    leapChance:    0.35,   // chance de salto melódico grande
    chordType:     'triad',
    arpDensity:    1.0,    // multiplicador de densidade do arpejo
    swing:         0.0,    // offset de swing (0 = reto, 0.08 = swingado)
    octaveSpread:  1,      // variação de oitava na melodia
    fillChance:    0.3,    // chance de fill de bateria no último beat do compasso
    velocityRange: [95,115],
  },
  dark: {
    label:         'DARK',
    rhythmDensity: 0.45,
    leapChance:    0.20,
    chordType:     'seventh',
    arpDensity:    0.5,
    swing:         0.0,
    octaveSpread:  0,
    fillChance:    0.15,
    velocityRange: [70,95],
  },
  chaotic: {
    label:         'CHAOTIC',
    rhythmDensity: 0.90,
    leapChance:    0.75,
    chordType:     'cluster',
    arpDensity:    2.0,
    swing:         0.0,
    octaveSpread:  2,
    fillChance:    0.6,
    velocityRange: [90,127],
  },
  minimal: {
    label:         'MINIMAL',
    rhythmDensity: 0.30,
    leapChance:    0.10,
    chordType:     'power',
    arpDensity:    0.2,
    swing:         0.0,
    octaveSpread:  0,
    fillChance:    0.05,
    velocityRange: [60,85],
  },
  dreamy: {
    label:         'DREAMY',
    rhythmDensity: 0.50,
    leapChance:    0.25,
    chordType:     'add9',
    arpDensity:    1.5,
    swing:         0.04,
    octaveSpread:  1,
    fillChance:    0.1,
    velocityRange: [65,90],
  },
  aggressive: {
    label:         'AGGRESSIVE',
    rhythmDensity: 0.85,
    leapChance:    0.55,
    chordType:     'power',
    arpDensity:    0.8,
    swing:         0.0,
    octaveSpread:  1,
    fillChance:    0.5,
    velocityRange: [100,127],
  },
  melancholic: {
    label:         'MELANCHOLIC',
    rhythmDensity: 0.40,
    leapChance:    0.15,
    chordType:     'sus2',
    arpDensity:    0.6,
    swing:         0.06,
    octaveSpread:  0,
    fillChance:    0.08,
    velocityRange: [60,88],
  },
  epic: {
    label:         'EPIC',
    rhythmDensity: 0.70,
    leapChance:    0.45,
    chordType:     'seventh',
    arpDensity:    1.2,
    swing:         0.0,
    octaveSpread:  2,
    fillChance:    0.4,
    velocityRange: [90,120],
  },
  jazzy: {
    label:         'JAZZY',
    rhythmDensity: 0.55,
    leapChance:    0.30,
    chordType:     'shell',
    arpDensity:    0.7,
    swing:         0.10,
    octaveSpread:  1,
    fillChance:    0.35,
    velocityRange: [72,100],
  },
};

// ────────────────────────────────────────────────────────────────
//  ESTILOS DE BATERIA — posições em semicolcheias (0–15)
// ────────────────────────────────────────────────────────────────
const DRUM_STYLES = {
  rock: {
    label:  'ROCK',
    kicks:  [0,8],
    snares: [4,12],
    hhs:    [0,2,4,6,8,10,12,14],
    openAt: [6,14],
  },
  halfTime: {
    label:  'HALF-TIME',
    kicks:  [0,10],
    snares: [8],
    hhs:    [0,4,8,12],
    openAt: [12],
  },
  dnb: {
    label:  'DnB',
    kicks:  [0,7,10],
    snares: [4,12],
    hhs:    [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    openAt: [],
  },
  tribal: {
    label:  'TRIBAL',
    kicks:  [0,3,7,11],
    snares: [6,14],
    hhs:    [0,2,4,6,8,10,12,14],
    openAt: [4,12],
  },
  shuffle: {
    label:  'SHUFFLE',
    kicks:  [0,9],
    snares: [4,12],
    hhs:    [0,3,4,7,8,11,12,15],
    openAt: [7,15],
  },
  march: {
    label:  'MARCH',
    kicks:  [0,4,8,12],
    snares: [2,6,10,14],
    hhs:    [0,4,8,12],
    openAt: [],
  },
  sparse: {
    label:  'SPARSE',
    kicks:  [0,12],
    snares: [8],
    hhs:    [0,8],
    openAt: [8],
  },
  fast: {
    label:  'FAST',
    kicks:  [0,6,8,14],
    snares: [4,12,14],
    hhs:    [0,2,4,6,8,10,12,14],
    openAt: [],
  },
  breakbeat: {
    label:  'BREAKBEAT',
    kicks:  [0,5,8,13],
    snares: [4,10,12],
    hhs:    [0,2,3,4,6,7,8,10,11,12,14,15],
    openAt: [6,14],
  },
};

// ────────────────────────────────────────────────────────────────
//  PRESETS — agora com style, drumStyle e chordType
// ────────────────────────────────────────────────────────────────
const PRESETS = {
  overworld: {
    label:'🍄 OVERWORLD',      key:60, scale:'major',     bpm:160, bars:8,
    prog:[0,3,4,0],            style:'heroic',             drumStyle:'rock',
  },
  dungeon: {
    label:'🗝 DUNGEON',        key:57, scale:'minor',      bpm:110, bars:8,
    prog:[0,5,3,4],            style:'dark',               drumStyle:'halfTime',
  },
  battle: {
    label:'⚔ BATTLE',          key:62, scale:'dorian',    bpm:180, bars:8,
    prog:[0,6,3,4],            style:'aggressive',         drumStyle:'fast',
  },
  boss: {
    label:'💀 BOSS FIGHT',     key:59, scale:'phrygian',  bpm:200, bars:16,
    prog:[0,1,5,4],            style:'chaotic',            drumStyle:'dnb',
  },
  title: {
    label:'🏆 TITLE SCREEN',   key:60, scale:'major',     bpm:100, bars:16,
    prog:[0,5,3,4],            style:'epic',               drumStyle:'march',
  },
  gameover: {
    label:'💔 GAME OVER',      key:57, scale:'harmMinor', bpm:75,  bars:4,
    prog:[0,3,5,4],            style:'melancholic',        drumStyle:'sparse',
  },
  town: {
    label:'🏘 TOWN / SHOP',    key:67, scale:'major',     bpm:130, bars:8,
    prog:[0,4,3,5],            style:'dreamy',             drumStyle:'shuffle',
  },
  cave: {
    label:'🌑 CAVE / MYSTERY', key:55, scale:'phrygian',  bpm:95,  bars:8,
    prog:[0,1,4,0],            style:'minimal',            drumStyle:'tribal',
  },
  underwater: {
    label:'🌊 UNDERWATER',     key:62, scale:'wholeTone', bpm:85,  bars:8,
    prog:[0,2,4,1],            style:'dreamy',             drumStyle:'sparse',
  },
  sky: {
    label:'☁ SKY / FLIGHT',    key:64, scale:'lydian',    bpm:145, bars:8,
    prog:[0,4,2,5],            style:'heroic',             drumStyle:'rock',
  },
  lofi: {
    label:'🎧 LO-FI HIP HOP',  key:62, scale:'dorian',   bpm:88,  bars:8,
    prog:[0,3,2,5],            style:'jazzy',              drumStyle:'shuffle',
  },
  credits: {
    label:'🎬 CREDITS',        key:60, scale:'major',     bpm:90,  bars:16,
    prog:[0,3,4,5],            style:'melancholic',        drumStyle:'halfTime',
  },
  minigame: {
    label:'🎮 MINIGAME',       key:65, scale:'pentatonic',bpm:200, bars:8,
    prog:[0,2,4,0],            style:'chaotic',            drumStyle:'breakbeat',
  },
  boss2: {
    label:'👹 FINAL BOSS',     key:57, scale:'hungarian', bpm:220, bars:16,
    prog:[0,1,3,5],            style:'epic',               drumStyle:'dnb',
  },
  jazz: {
    label:'🎷 JAZZ CLUB',      key:60, scale:'mixolydian',bpm:120, bars:8,
    prog:[0,4,2,5],            style:'jazzy',              drumStyle:'shuffle',
  },
  tribal: {
    label:'🥁 TRIBAL',         key:55, scale:'blues',     bpm:140, bars:8,
    prog:[0,2,0,4],            style:'aggressive',         drumStyle:'tribal',
  },
};

// ────────────────────────────────────────────────────────────────
//  RNG — gerador determinístico (LCG)
// ────────────────────────────────────────────────────────────────
let _seed = 42;
function seedRng(s){ _seed = s >>> 0; }
function rng(){
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
}
function ri(a,b){ return Math.floor(rng()*(b-a+1))+a; }
function pick(arr){ return arr[Math.floor(rng()*arr.length)]; }

// ────────────────────────────────────────────────────────────────
//  UTILITÁRIOS DE TEORIA MUSICAL
// ────────────────────────────────────────────────────────────────
function scaleNotesList(keyMidi, scaleName, lo=36, hi=96){
  const root = keyMidi % 12;
  const ivs  = SCALES[scaleName] ? SCALES[scaleName].i : SCALES.major.i;
  const out  = [];
  for(let p=lo; p<=hi; p++) if(ivs.includes((p-root+120)%12)) out.push(p);
  return out;
}

function nearestIn(arr, pitch){
  if(!arr.length) return pitch;
  return arr.reduce((a,b) => Math.abs(b-pitch) < Math.abs(a-pitch) ? b : a, arr[0]);
}

function stepFrom(arr, pitch, steps){
  if(!arr.length) return pitch;
  let idx = arr.findIndex(n => n >= pitch);
  if(idx < 0) idx = arr.length - 1;
  return arr[Math.max(0, Math.min(arr.length-1, idx+steps))];
}

// Agora suporta tipos de acorde além de tríade
function chordPCs(keyMidi, scaleName, degree, chordType='triad'){
  const ivs   = SCALES[scaleName] ? SCALES[scaleName].i : SCALES.major.i;
  const len   = ivs.length;
  const root  = keyMidi % 12;
  const shape = CHORD_SHAPES[chordType] || CHORD_SHAPES.triad;
  return shape.map(off => {
    const pos = (degree + off) % len;
    return (root + ivs[pos]) % 12;
  });
}

function chordTones(scaleNotes, pcs){
  return scaleNotes.filter(n => pcs.includes(n%12));
}

// ────────────────────────────────────────────────────────────────
//  PADRÕES RÍTMICOS — por categoria de densidade
// ────────────────────────────────────────────────────────────────
const RHYTHMS_DENSE = [
  [.5,.5,.5,.5,.5,.5,1],
  [.25,.25,.5,.25,.25,.5,.5,.5],
  [.5,.25,.25,.5,.5,.5,.5],
  [.25,.25,.25,.25,.5,.5,.5,.5],
  [.5,.5,.25,.25,.5,.5,.5],
];
const RHYTHMS_MID = [
  [1,.5,.5,1,1],
  [.5,.5,.5,.5,2],
  [1,1,1,1],
  [.5,.5,1,.5,.5,1],
  [1.5,.5,1,1],
  [1,.5,.5,.5,.5,1],
  [2,1,.5,.5],
];
const RHYTHMS_SPARSE = [
  [2,2],
  [1.5,.5,2],
  [2,1,1],
  [1,3],
  [3,1],
  [1.5,1.5,1],
];

function getRhythmPool(density){
  if(density >= 0.75) return RHYTHMS_DENSE;
  if(density >= 0.45) return RHYTHMS_MID;
  return RHYTHMS_SPARSE;
}

// ────────────────────────────────────────────────────────────────
//  PADRÕES DE BAIXO
// ────────────────────────────────────────────────────────────────
const BASS_PATS = [
  // walking básico
  (r,f)    => [{p:r,b:0,d:.9},{p:f,b:1,d:.4},{p:r,b:2,d:.9},{p:f,b:3,d:.4}],
  // notas longas
  (r,f)    => [{p:r,b:0,d:1.9},{p:f,b:2,d:1.9}],
  // walking cromático
  (r,f,sc) => [{p:r,b:0,d:.9},{p:stepFrom(sc,r,1),b:1,d:.9},{p:f,b:2,d:.9},{p:stepFrom(sc,f,1),b:3,d:.9}],
  // ostinato em oitava
  (r,f)    => [{p:r,b:0,d:.4},{p:r+12,b:.5,d:.4},{p:f,b:1,d:.4},{p:r,b:1.5,d:.4},{p:r,b:2,d:.4},{p:r+12,b:2.5,d:.4},{p:f,b:3,d:.4},{p:r,b:3.5,d:.4}],
  // pedal (power)
  (r)      => [{p:r,b:0,d:3.9}],
  // sincopado
  (r,f)    => [{p:r,b:0,d:.4},{p:f,b:.75,d:.4},{p:r,b:1.5,d:.4},{p:f,b:2.25,d:.4},{p:r,b:3,d:.9}],
  // baixo em colcheias
  (r,f,sc) => [{p:r,b:0,d:.4},{p:stepFrom(sc,r,2),b:.5,d:.4},{p:f,b:1,d:.4},{p:stepFrom(sc,f,-1),b:1.5,d:.4},{p:r,b:2,d:.4},{p:stepFrom(sc,r,1),b:2.5,d:.4},{p:f,b:3,d:.4},{p:r,b:3.5,d:.4}],
  // groove funk
  (r,f)    => [{p:r,b:0,d:.2},{p:r,b:.25,d:.2},{p:f,b:.75,d:.4},{p:r,b:1.5,d:.2},{p:r,b:2,d:.2},{p:f,b:2.5,d:.4},{p:r,b:3.25,d:.2},{p:r,b:3.75,d:.2}],
];

// ────────────────────────────────────────────────────────────────
//  SHAPES DE ARPEJO
// ────────────────────────────────────────────────────────────────
const ARP_SHAPES = [
  [0,1,2,1],       // up-down tríade
  [0,1,2,3],       // up tétrade
  [3,2,1,0],       // down tétrade
  [0,2,1,3],       // skip
  [2,0,3,1],       // salto invertido
  [0,1,2,3,2,1],   // up-down completo
  [0,2,4,2],       // arpejo largo
  [0,3,1,2],       // jazz comping
];

// ================================================================
//  SISTEMA DE GENOME MUSICAL — v4
//  Cada geração nasce com um "DNA" derivado dos parâmetros emocionais.
//  O genome persiste ao longo de toda a música, criando identidade.
// ================================================================

// ── Constrói o genome inicial a partir do cfg (com _emotion)
function buildGenome(cfg) {
  const emo      = cfg._emotion || {};
  const arousal  = emo.arousal         != null ? emo.arousal         : 0.5;
  const momentum = emo.emotionalMomentum != null ? emo.emotionalMomentum : 0;
  const dissonance = emo.dissonance    != null ? emo.dissonance      : 0.1;
  const density  = emo.noteDensity     != null ? emo.noteDensity     : 0.5;

  const style = STYLE_PROFILES[cfg.style] || STYLE_PROFILES.heroic;
  const rhythmPool = getRhythmPool(style.rhythmDensity);

  let motifContour;
  if      (momentum >  0.4) motifContour = 'up';
  else if (momentum < -0.4) motifContour = 'down';
  else                       motifContour = 'arch';

  return {
    motifRhythmIdx:      ri(0, rhythmPool.length - 1),
    motifContour:        motifContour,
    motifLeapSize:       Math.max(1, Math.round(arousal * 4)),
    mutationRate:        Math.min(0.5, arousal * 0.3 + dissonance * 0.2),
    repetitionTolerance: Math.max(0.2, 1 - arousal),
    tensionBias:         dissonance,
    registerBias:        (momentum + 1) / 2,
    ornamentChance:      Math.max(0, 0.2 - arousal * 0.15),
    syncopationBias:     density * 0.4,
    bassPatIdx:          ri(0, BASS_PATS.length - 1),
    arpShapeIdx:         ri(0, ARP_SHAPES.length - 1),
    generation:          0,
  };
}

// ── Snapshot de uma frase (compasso) para memória anti-repetição
function buildPhraseSnapshot(barMelody) {
  if (!barMelody.length) return { pitchMean: 60, density: 0, intervalMean: 0 };
  const pitches   = barMelody.map(n => n.pitch);
  const pitchMean = pitches.reduce((a, b) => a + b, 0) / pitches.length;
  let iSum = 0;
  for (let i = 1; i < pitches.length; i++) iSum += Math.abs(pitches[i] - pitches[i - 1]);
  return {
    pitchMean,
    density:      barMelody.length,
    intervalMean: pitches.length > 1 ? iSum / (pitches.length - 1) : 0,
  };
}

// ── Calcula pressão de repetição [0,1] a partir da memória de frases
function calcRepeatPressure(memory) {
  if (memory.length < 2) return 0;
  const last = memory[memory.length - 1];
  const prev = memory[memory.length - 2];
  const sim12 = 1 - Math.min(1,
    (Math.abs(last.pitchMean - prev.pitchMean) / 12 +
     Math.abs(last.density   - prev.density)   / 8  +
     Math.abs(last.intervalMean - prev.intervalMean) / 6) / 3
  );
  if (memory.length < 3) return sim12 * 0.5;
  const prev2 = memory[memory.length - 3];
  const sim123 = 1 - Math.min(1,
    (Math.abs(last.pitchMean - prev2.pitchMean) / 12 +
     Math.abs(last.density   - prev2.density)   / 8  +
     Math.abs(last.intervalMean - prev2.intervalMean) / 6) / 3
  );
  return Math.max(sim12 * 0.6, sim123 * 0.5);
}

// ── Muta o genome antes de cada compasso (3 níveis de mutação)
function mutateGenome(genome, phraseMemory) {
  const g       = { ...genome };
  const pressure = calcRepeatPressure(phraseMemory);
  const effective = Math.min(0.65, g.mutationRate + pressure);
  const contours  = ['up', 'down', 'arch', 'flat'];

  // LEVE — qualquer compasso
  if (rng() < effective) {
    g.motifContour   = contours[ri(0, contours.length - 1)];
    g.syncopationBias = Math.max(0, Math.min(1, g.syncopationBias + (rng() - 0.5) * 0.1));
  }

  // ESTRUTURAL — a cada 4 compassos ou pressão alta
  if (g.generation > 0 && (g.generation % 4 === 0 || pressure > 0.6)) {
    g.bassPatIdx  = ri(0, BASS_PATS.length - 1);
    g.arpShapeIdx = ri(0, ARP_SHAPES.length - 1);
    if      (g.motifContour === 'up')   g.motifContour = 'down';
    else if (g.motifContour === 'down') g.motifContour = 'up';
  }

  // DE SEÇÃO — a cada 8 compassos
  if (g.generation > 0 && g.generation % 8 === 0) {
    g.motifRhythmIdx = ri(0, 6);   // max pool size
    g.registerBias   = (g.registerBias + 0.3) % 1;
  }

  // Pressão extra de arousal
  if (g.tensionBias > 0.8 && rng() < 0.25) {
    g.motifLeapSize = Math.max(1, Math.min(6, g.motifLeapSize + (rng() < 0.5 ? 1 : -1)));
  }

  g.generation++;
  return g;
}

// ── Curva de tensão dinâmica [0,1] por compasso
function tensionCurve(barIdx, totalBars, momentum) {
  const t = barIdx / Math.max(1, totalBars - 1);
  let tension;
  if      (t < 0.15) tension = t / 0.15;
  else if (t < 0.60) tension = 1.0;
  else if (t < 0.85) tension = 1.0 - ((t - 0.60) / 0.25) * 0.5;
  else               tension = 0.5 - ((t - 0.85) / 0.15) * 0.5;
  return Math.max(0, Math.min(1, tension + (momentum || 0) * 0.1));
}

// ── Aplica humanização a uma nota durante a geração
function humanizeNoteGen(note, amount, isDrum) {
  if (!amount || amount <= 0) return note;
  const n = { ...note };
  if (isDrum) {
    n.velocity = Math.round(Math.max(20, Math.min(127, n.velocity + (rng() - 0.5) * 2 * (amount * 12))));
  } else {
    n.startBeat = Math.max(0, n.startBeat + (rng() - 0.5) * 2 * amount);
    n.velocity  = Math.round(Math.max(20, Math.min(127, n.velocity + (rng() - 0.5) * 2 * (amount * 30))));
    n.duration  = Math.max(0.05, n.duration * (1 + (rng() - 0.5) * 2 * (amount * 0.08)));
  }
  return n;
}

// ── Gera linha de contraponto (segunda voz melódica)
function genCounterpoint(melody, cfg) {
  const sc   = cfg.scale || 'major';
  const sMel = scaleNotesList(cfg.key, sc, 48, 72);
  const counter = [];
  const bars    = cfg.bars || 8;

  for (let bar = 0; bar < bars; bar++) {
    const bOff    = bar * 4;
    const barNotes = melody.filter(n => n.startBeat >= bOff && n.startBeat < bOff + 4);
    if (!barNotes.length) continue;

    const step = pick([1, 2]);
    for (let beat = bOff; beat < bOff + 4; beat += step) {
      const ref = barNotes.find(n => n.startBeat <= beat && n.startBeat + n.duration > beat)
               || barNotes[0];
      if (!ref) continue;

      let pitch = ref.pitch - ri(5, 10);
      pitch = nearestIn(sMel, pitch);
      while (pitch < 48) pitch += 12;
      while (pitch > 72) pitch -= 12;

      counter.push({
        pitch,
        startBeat: beat,
        duration:  step * 0.9,
        velocity:  Math.max(20, ref.velocity - 8),
      });
    }
  }
  return counter;
}

// ================================================================
//  generateBlock — núcleo do engine v4
//  Aceita genome e memória de frases do bloco anterior para
//  geração contínua e evolutiva (loop infinito).
// ================================================================
function generateBlock(cfg, genomeIn, memoryIn, blockOffset) {
  const { key, bars } = cfg;
  const sc            = cfg.scale     || 'major';
  const prog          = cfg.prog      || [0,3,4,0];
  const styleName     = cfg.style     || 'heroic';
  const drumStyleName = cfg.drumStyle || 'rock';
  const style         = STYLE_PROFILES[styleName]     || STYLE_PROFILES.heroic;
  const drumStyle     = DRUM_STYLES[drumStyleName]    || DRUM_STYLES.rock;
  const emo           = cfg._emotion  || {};
  const momentum      = emo.emotionalMomentum != null ? emo.emotionalMomentum : 0;
  const dissonance    = emo.dissonance        != null ? emo.dissonance         : 0.1;
  const humanizeAmt   = emo.humanizeAmount    != null ? emo.humanizeAmount     : 0;

  // Estilo efetivo: parâmetros emocionais sobrescrevem defaults do preset
  const effectiveStyle = { ...style };
  if (emo.noteDensity != null) effectiveStyle.rhythmDensity = emo.noteDensity;
  if (emo.velocityLo  != null) effectiveStyle.velocityRange = [emo.velocityLo, emo.velocityHi];
  if (dissonance > 0.65)       effectiveStyle.chordType = 'cluster';
  else if (dissonance > 0.50)  effectiveStyle.chordType = 'seventh';

  const sMel  = scaleNotesList(key, sc, 60, 84);
  const sBass = scaleNotesList(key, sc, 36, 59);
  const sArp  = scaleNotesList(key, sc, 60, 84);
  const melody=[], bass=[], arp=[], drums=[];

  let genome       = genomeIn ? { ...genomeIn } : buildGenome(cfg);
  let phraseMemory = memoryIn ? [...memoryIn]   : [];
  const rhythmPool = getRhythmPool(effectiveStyle.rhythmDensity);
  const modPoint   = Math.floor(bars / 2);
  const offset     = blockOffset || 0;

  for (let bar = 0; bar < bars; bar++) {
    // Muta genome antes de cada compasso
    genome = mutateGenome(genome, phraseMemory);

    const tension = tensionCurve(bar, bars, momentum);
    const deg     = prog[bar % prog.length];
    const bOff    = offset + bar * 4;
    const pcs     = chordPCs(key, sc, deg, effectiveStyle.chordType);
    const cTones  = chordTones(sMel, pcs);
    const cTBass  = chordTones(sBass, pcs);
    const vary    = (bar >= 4 && bar >= prog.length) ? 0.25 : 0;
    const isTurn  = (bar === modPoint);
    const isEnd   = (bar === bars - 1);
    const isFill  = (bar === bars - 2) && rng() < effectiveStyle.fillChance;

    // Contorno melódico dirigido pelo emotionalMomentum
    let dir;
    const relPos = bar / Math.max(1, bars - 1);
    if      (momentum >  0.4) dir = relPos < 0.6 ? 'up'   : 'arch';
    else if (momentum < -0.4) dir = relPos < 0.6 ? 'down' : 'flat';
    else {
      if      (relPos < 0.25) dir = 'up';
      else if (relPos < 0.65) dir = 'arch';
      else                     dir = 'down';
    }

    // Tensão modula rhythmDensity e velocityRange dinamicamente
    const tensionStyle = {
      ...effectiveStyle,
      rhythmDensity: effectiveStyle.rhythmDensity * (0.6 + tension * 0.4),
      velocityRange: [
        Math.round((effectiveStyle.velocityRange[0] || 80) * (0.7 + tension * 0.3)),
        Math.round((effectiveStyle.velocityRange[1] || 110) * (0.8 + tension * 0.2)),
      ],
    };

    const melStart = melody.length;
    genMelody(melody, sMel, pcs, cTones, bOff, bar,
              genome.motifRhythmIdx % rhythmPool.length,
              dir, vary, tensionStyle, rhythmPool, isTurn, isEnd);
    genBassIdx(bass, sBass, pcs, cTBass, bOff, tensionStyle, genome.bassPatIdx);
    genArpIdx(arp, sArp, pcs, bOff, tensionStyle, genome.arpShapeIdx);
    genDrums(drums, bOff, drumStyle, tensionStyle, isFill, bar);

    // Aplica humanização real nas notas geradas neste compasso
    if (humanizeAmt > 0) {
      for (let i = melStart; i < melody.length; i++)
        melody[i] = humanizeNoteGen(melody[i], humanizeAmt, false);
    }

    // Snapshot para anti-repetição
    const snap = melody.slice(melStart).map(n => ({ pitch: n.pitch, startBeat: n.startBeat - bOff, duration: n.duration }));
    phraseMemory.push(buildPhraseSnapshot(snap));
    if (phraseMemory.length > 8) phraseMemory.shift();
  }

  const song = { melody, bass, arp, drums, _emotion: emo, _cfg: cfg };
  return { song, genome, memory: phraseMemory };
}

// ── Versão de genBass que aceita bassPatIdx do genome
function genBassIdx(notes, scNotes, pcs, cTones, bOff, style, patIdx) {
  if (!cTones.length) return;
  const r = cTones[0];
  const f = cTones[1] || (r + 7 <= 59 ? r + 7 : r - 5);
  const idx = patIdx % BASS_PATS.length;
  const evs = BASS_PATS[idx](r, f, scNotes);
  for (const ev of evs) {
    let p = ev.p;
    while (p < 36) p += 12;
    while (p > 59) p -= 12;
    const [vLo, vHi] = style.velocityRange || [80, 105];
    notes.push({ pitch: p, startBeat: bOff + ev.b, duration: ev.d, velocity: ri(vLo, vHi) });
  }
}

// ── Versão de genArp que aceita arpShapeIdx do genome
function genArpIdx(notes, scNotes, pcs, bOff, style, shapeIdx) {
  const cTones = chordTones(scNotes, pcs).slice(0, 4);
  if (cTones.length < 2) return;
  const density = style.arpDensity || 1.0;
  if (rng() > density && density < 1) return;
  const shape = ARP_SHAPES[shapeIdx % ARP_SHAPES.length];
  const step  = density >= 1.5 ? 0.25 : density >= 1.0 ? 0.5 : 1.0;
  const count = Math.floor(4 / step);
  const [vLo, vHi] = style.velocityRange || [60, 80];
  for (let i = 0; i < count; i++) {
    const idx = shape[i % shape.length] % cTones.length;
    notes.push({
      pitch:     cTones[idx],
      startBeat: bOff + i * step,
      duration:  step * 0.75,
      velocity:  ri(Math.max(40, vLo - 20), Math.max(60, vHi - 20)),
    });
  }
}

// ================================================================
//  GERADOR PRINCIPAL — agora wrapper de generateBlock()
//  Compatibilidade total: generate(cfg) ainda funciona igual
// ================================================================
function generate(cfg){
  // Inicializa RNG se necessário
  const result = generateBlock(cfg, null, null, 0);
  const song   = result.song;
  song._genome = result.genome;
  song._memory = result.memory;
  // Adiciona contraponto como canal separado
  song.counter = genCounterpoint(song.melody, cfg);
  return song;
}

// ────────────────────────────────────────────────────────────────
//  GERADOR DE MELODIA
// ────────────────────────────────────────────────────────────────
function genMelody(notes, scNotes, pcs, cTones, bOff, barIdx,
                   rhythmIdx, dir, vary, style, rhythmPool, isTurn, isEnd){

  const ridx2 = (barIdx%2===0) ? rhythmIdx : (rhythmIdx + 2) % rhythmPool.length;
  const pat   = rhythmPool[ridx2];
  const swing = style.swing || 0;
  const [velLo, velHi] = style.velocityRange || [80, 110];

  // Ponto de partida baseado no contorno e tipo de acorde
  let startPitch;
  const pool = cTones.length ? cTones : scNotes;
  if     (dir === 'up')   startPitch = pool[0];
  else if(dir === 'down') startPitch = pool[pool.length-1];
  else                    startPitch = pool[Math.floor(pool.length/2)];

  while(startPitch < 62) startPitch += 12;
  while(startPitch > 80) startPitch -= 12;

  // Spread de oitava — estilos épicos e caóticos saltam mais
  const octave = style.octaveSpread > 0 && rng() < 0.15 * style.octaveSpread
    ? (rng() < .5 ? 12 : -12) : 0;

  let prevPitch = startPitch + octave;
  let beat = bOff;

  for(let i=0; i<pat.length && beat-bOff < 4; i++){
    const dur = pat[i];

    // Pula nota baseado na densidade do estilo
    if(vary > 0 && rng() < vary && i > 0){ beat += dur; continue; }

    // Swing: desloca off-beats (colcheias ímpares) levemente
    const isOffBeat = Math.abs((beat - bOff) % 1 - 0.5) < 0.05;
    const t0 = beat + (isOffBeat ? swing : 0);

    let pitch;
    if(i === 0){
      pitch = nearestIn(pool, prevPitch);
    } else {
      const dirBias = dir==='up' ? 1 : dir==='down' ? -1 : (i < pat.length/2 ? 1 : -1);

      // Leap chance controlado pelo estilo
      const jump = rng() < style.leapChance
        ? ri(-3, 3)                          // salto livre
        : (rng() < .7 ? dirBias : 2*dirBias); // passo direcional

      const candidate = stepFrom(scNotes, prevPitch, jump);
      const isStrong  = Number.isInteger(beat-bOff) && (beat-bOff)%2 === 0;
      pitch = (isStrong && rng() < .6 && cTones.length)
        ? nearestIn(cTones, candidate)
        : candidate;
    }

    // Mantém na região certa
    while(pitch < 60) pitch += 12;
    while(pitch > 84) pitch -= 12;

    // Na virada — usa tensão (nota fora do acorde intencional)
    if(isTurn && i === 0 && scNotes.length > 0){
      pitch = stepFrom(scNotes, pitch, 1);
    }

    // No final — resolve na tônica ou 5ª
    if(isEnd && i === pat.length-1 && cTones.length){
      pitch = cTones[0];
      while(pitch < 60) pitch += 12;
    }

    const vel = (i===0 || Number.isInteger(beat-bOff))
      ? ri(Math.min(velLo+15, velHi), velHi)
      : ri(velLo, velLo+20);

    notes.push({pitch, startBeat:t0, duration:dur*.88, velocity:vel});
    prevPitch = pitch;
    beat += dur;
  }
}

// ────────────────────────────────────────────────────────────────
//  GERADOR DE BAIXO
// ────────────────────────────────────────────────────────────────
function genBass(notes, scNotes, pcs, cTones, bOff, style){
  if(!cTones.length) return;

  const r = cTones[0];
  const f = cTones[1] || (r+7 <= 59 ? r+7 : r-5);

  // Estilos minimalistas usam padrões longos (pedal, notas longas)
  // Estilos agressivos usam padrões rápidos
  let patIdx;
  if(style.rhythmDensity < 0.4)       patIdx = pick([0,1,4]);   // sparse
  else if(style.rhythmDensity < 0.65) patIdx = pick([0,1,2,5]); // mid
  else                                 patIdx = pick([2,3,5,6,7]); // dense

  const evs = BASS_PATS[patIdx](r, f, scNotes);
  for(const ev of evs){
    let p = ev.p;
    while(p < 36) p += 12;
    while(p > 59) p -= 12;
    const [vLo, vHi] = style.velocityRange || [80,105];
    notes.push({pitch:p, startBeat:bOff+ev.b, duration:ev.d, velocity:ri(vLo, vHi)});
  }
}

// ────────────────────────────────────────────────────────────────
//  GERADOR DE ARPEJO
// ────────────────────────────────────────────────────────────────
function genArp(notes, scNotes, pcs, bOff, style){
  const cTones = chordTones(scNotes, pcs).slice(0, 4);
  if(cTones.length < 2) return;

  const density = style.arpDensity || 1.0;
  if(rng() > density && density < 1) return; // estilos esparsos pulam arpejo

  const shape = ARP_SHAPES[ri(0, ARP_SHAPES.length-1)];
  // Mais notas = mais arpejo (densidade > 1 = colcheias, <= 1 = semínimas)
  const step  = density >= 1.5 ? 0.25 : density >= 1.0 ? 0.5 : 1.0;
  const count = Math.floor(4 / step);
  const [vLo, vHi] = style.velocityRange || [60,80];

  for(let i=0; i<count; i++){
    const idx = shape[i % shape.length] % cTones.length;
    notes.push({
      pitch:      cTones[idx],
      startBeat:  bOff + i * step,
      duration:   step * 0.75,
      velocity:   ri(Math.max(40, vLo-20), Math.max(60, vHi-20)),
    });
  }
}

// ────────────────────────────────────────────────────────────────
//  GERADOR DE BATERIA
// ────────────────────────────────────────────────────────────────
const KICK=36, SNARE=38, HHC=42, HHO=46;

function genDrums(drums, bOff, drumStyle, style, isFill, barIdx){
  const [vLo, vHi] = style.velocityRange || [80, 110];

  // Kicks
  for(const p of drumStyle.kicks){
    drums.push({
      pitch:KICK, startBeat:bOff+p/4, duration:.1,
      velocity:ri(Math.min(vHi,105), Math.min(vHi+5,115)), isDrum:true
    });
  }

  // Snares
  for(const p of drumStyle.snares){
    drums.push({
      pitch:SNARE, startBeat:bOff+p/4, duration:.1,
      velocity:ri(Math.min(vHi-10,95), Math.min(vHi,108)), isDrum:true
    });
  }

  // Hi-hats
  for(let i=0; i<drumStyle.hhs.length; i++){
    const p    = drumStyle.hhs[i];
    const open = drumStyle.openAt && drumStyle.openAt.includes(p);
    drums.push({
      pitch:     open ? HHO : HHC,
      startBeat: bOff + p/4,
      duration:  .1,
      velocity:  ri(Math.max(50,vLo-25), Math.max(75,vHi-30)),
      isDrum:    true
    });
  }

  // Crash no primeiro compasso
  if(barIdx === 0){
    drums.push({pitch:49, startBeat:bOff, duration:.1, velocity:ri(85,95), isDrum:true});
  }

  // Fill no penúltimo compasso (tom + snare em semicolcheias)
  if(isFill){
    const fillBeats = [2.5, 2.75, 3.0, 3.25, 3.5, 3.75];
    const fillPitches = [45, 43, 41, 38, 38, 49]; // toms descendentes + snare + crash
    fillBeats.forEach((fb, i) => {
      drums.push({
        pitch:    fillPitches[i],
        startBeat:bOff + fb,
        duration: .1,
        velocity: ri(90, 115),
        isDrum:   true
      });
    });
  }

  // Variação: ghost notes no snare (estilos jazzy/shuffle)
  if(style.swing > 0.05 && rng() < 0.4){
    const ghostPos = pick([1, 1.5, 2.5, 3]);
    drums.push({
      pitch:SNARE, startBeat:bOff+ghostPos, duration:.1,
      velocity:ri(35,50), isDrum:true
    });
  }
}

// ────────────────────────────────────────────────────────────────
//  GERADOR DE PRESETS ALEATÓRIOS (modo exploração)
// ────────────────────────────────────────────────────────────────
function randomPreset(){
  const scaleKeys     = Object.keys(SCALES);
  const styleKeys     = Object.keys(STYLE_PROFILES);
  const drumStyleKeys = Object.keys(DRUM_STYLES);

  return {
    label:     '🎲 RANDOM',
    key:       ri(48, 71),
    scale:     pick(scaleKeys),
    bpm:       ri(70, 210),
    bars:      pick([4, 8, 8, 8, 16]),   // 8 bars mais comum
    prog:      Array.from({length:4}, () => ri(0, 5)),
    style:     pick(styleKeys),
    drumStyle: pick(drumStyleKeys),
  };
}
