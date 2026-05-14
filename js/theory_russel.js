// ================================================================
//  theory_russel.js v2 — Camada de Contexto Emocional
//  Modelo: James A. Russell (1980) — Circumplex Model of Affect
//  Depende de: theory.js (deve ser carregado antes)
//
//  Eixos:
//    valence  ∈ [-1.0, +1.0]   negativo = triste/tenso, positivo = alegre
//    arousal  ∈ [ 0.0,  1.0]   baixo = calmo, alto = energético
//
//  API pública:
//    new EmotionContext(valence, arousal, emotionStrength?)
//    generateFromEmotion(v, a, seed, bars, emotionStrength?)
//    generateCalibrated(v, a, seed, bars, analyzerFn?, maxIter?)
//    emotionFromPresetName(name)   → {valence, arousal}
//    describeEmotion(v, a)         → "emoji LABEL"
//    emotionError(target, measured, weights?) → number
//
//  v2 — Melhorias:
//    · Quadrante por distância contínua (sem corte binário em 0.5)
//    · BPM com curva exponencial easeIn(a, 1.2) — mais natural
//    · Seleção de escala ponderada: fit = α*|v| + β*a
//    · emotionStrength: controla intensidade da influência emocional
//    · humanizeAmount: rubato/mecanicidade proporcional ao arousal
//    · emotionalMomentum: vetor de evolução temporal intra-música
//    · emotionError com pesos diferenciais (arousal domina percepção)
// ================================================================

'use strict';

// ────────────────────────────────────────────────────────────────
//  CENTROS DOS QUADRANTES — base para classificação suavizada
//  A transição entre quadrantes agora é contínua:
//  arousal=0.499 e arousal=0.501 produzem resultado praticamente igual
// ────────────────────────────────────────────────────────────────
const QUADRANT_CENTERS = {
  positive_high: { vc:  0.6, ac: 0.75 },
  positive_low:  { vc:  0.6, ac: 0.20 },
  negative_high: { vc: -0.6, ac: 0.75 },
  negative_low:  { vc: -0.6, ac: 0.20 },
  neutral:       { vc:  0.0, ac: 0.45 },
};

// ────────────────────────────────────────────────────────────────
//  RÓTULOS EMOCIONAIS — cada ponto tem centro (vc, ac) no espaço
//  describeEmotion() encontra o mais próximo por distância
// ────────────────────────────────────────────────────────────────
const EMOTION_QUADRANTS = [
  { label: 'EUPHORIC',    emoji: '🔥', vc:  0.80, ac: 0.90 },
  { label: 'TRIUMPHANT',  emoji: '🏆', vc:  0.65, ac: 0.80 },
  { label: 'EXCITED',     emoji: '⚡', vc:  0.35, ac: 0.75 },
  { label: 'BATTLE CRY',  emoji: '⚔',  vc:  0.10, ac: 0.95 },
  { label: 'HAPPY',       emoji: '😊', vc:  0.65, ac: 0.50 },
  { label: 'PLAYFUL',     emoji: '🎮', vc:  0.55, ac: 0.62 },
  { label: 'HOPEFUL',     emoji: '🌅', vc:  0.50, ac: 0.40 },
  { label: 'ROMANTIC',    emoji: '💫', vc:  0.70, ac: 0.30 },
  { label: 'RELAXED',     emoji: '🌿', vc:  0.65, ac: 0.15 },
  { label: 'SERENE',      emoji: '✨', vc:  0.40, ac: 0.15 },
  { label: 'DREAMY',      emoji: '🌙', vc:  0.30, ac: 0.20 },
  { label: 'NEUTRAL',     emoji: '😐', vc:  0.00, ac: 0.40 },
  { label: 'MYSTERIOUS',  emoji: '🌑', vc: -0.20, ac: 0.55 },
  { label: 'TENSE',       emoji: '😰', vc: -0.40, ac: 0.70 },
  { label: 'FRENZY',      emoji: '🌀', vc: -0.30, ac: 0.95 },
  { label: 'TERROR',      emoji: '😱', vc: -0.80, ac: 0.95 },
  { label: 'ANGRY',       emoji: '💢', vc: -0.75, ac: 0.80 },
  { label: 'GLOOMY',      emoji: '☁',  vc: -0.50, ac: 0.30 },
  { label: 'MELANCHOLIC', emoji: '🌧', vc: -0.70, ac: 0.15 },
  { label: 'DESOLATE',    emoji: '💀', vc: -0.90, ac: 0.05 },
  { label: 'BORED',       emoji: '😶', vc: -0.05, ac: 0.15 },
];

// ────────────────────────────────────────────────────────────────
//  MAPEAMENTO: emoção → escalas
//  Indexação usa fit ponderado = α*|v| + β*a  (α=0.6, β=0.4)
//  Arousal co-influencia a escolha modal, não só valência
// ────────────────────────────────────────────────────────────────
const EMOTION_SCALES = {
  positive_high:  ['major', 'lydian', 'pentatonic', 'mixolydian'],
  positive_low:   ['major', 'pentatonic', 'wholeTone', 'dorian'],
  negative_high:  ['phrygian', 'locrian', 'blues', 'dorian'],
  negative_low:   ['minor', 'harmMinor', 'hungarian', 'phrygian'],
  neutral:        ['dorian', 'mixolydian', 'pentatonic', 'blues'],
};

const SCALE_ALPHA = 0.6;  // peso de |valence| no fit
const SCALE_BETA  = 0.4;  // peso de arousal no fit

// ────────────────────────────────────────────────────────────────
//  MAPEAMENTO: emoção → estilos e baterias
// ────────────────────────────────────────────────────────────────
const EMOTION_STYLES = {
  positive_high:  ['heroic', 'epic', 'aggressive', 'chaotic'],
  positive_low:   ['dreamy', 'minimal', 'jazzy', 'melancholic'],
  negative_high:  ['aggressive', 'chaotic', 'dark', 'epic'],
  negative_low:   ['melancholic', 'dark', 'minimal', 'dreamy'],
  neutral:        ['jazzy', 'minimal', 'dreamy', 'heroic'],
};

const EMOTION_DRUMS = {
  positive_high:  ['rock', 'fast', 'dnb', 'breakbeat'],
  positive_low:   ['shuffle', 'halfTime', 'sparse', 'march'],
  negative_high:  ['dnb', 'breakbeat', 'fast', 'tribal'],
  negative_low:   ['sparse', 'halfTime', 'shuffle', 'march'],
  neutral:        ['shuffle', 'rock', 'halfTime', 'tribal'],
};

// ────────────────────────────────────────────────────────────────
//  PROGRESSÕES HARMÔNICAS POR TENSÃO CONTÍNUA
//  tension = 1 - |valence| — valência extrema = harmonia limpa
// ────────────────────────────────────────────────────────────────
const PROGRESSIONS = {
  consonant:  [[0,3,4,0], [0,5,3,4], [0,4,3,0], [0,3,5,4]],
  moderate:   [[0,5,3,4], [0,3,5,1], [0,6,3,4], [0,2,5,3]],
  tense:      [[0,1,5,4], [0,1,3,5], [0,6,1,5], [0,4,1,5]],
  dissonant:  [[0,1,5,0], [0,1,4,5], [0,6,5,1], [0,1,0,5]],
};

// ────────────────────────────────────────────────────────────────
//  UTILITÁRIOS
// ────────────────────────────────────────────────────────────────
function lerp(a, b, t)    { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function easeIn(t, exp)   { return Math.pow(clamp(t, 0, 1), exp); }

// ────────────────────────────────────────────────────────────────
//  getEmotionQuadrant — CLASSIFICAÇÃO CONTÍNUA POR DISTÂNCIA
//  Elimina a transição brusca que havia em arousal = 0.499 → 0.500
//  Valence normalizado por /2 (range [-1,1]) para equalizar escala com arousal ([0,1])
// ────────────────────────────────────────────────────────────────
function getEmotionQuadrant(valence, arousal) {
  let bestQ    = 'neutral';
  let bestDist = Infinity;
  for (const [name, c] of Object.entries(QUADRANT_CENTERS)) {
    const dv = (valence - c.vc) / 2;   // normaliza range
    const da =  arousal - c.ac;
    const d  = Math.sqrt(dv * dv + da * da);
    if (d < bestDist) { bestDist = d; bestQ = name; }
  }
  return bestQ;
}

// ────────────────────────────────────────────────────────────────
//  describeEmotion — rótulo humano para o ponto (v, a)
// ────────────────────────────────────────────────────────────────
function describeEmotion(valence, arousal) {
  let best     = EMOTION_QUADRANTS[EMOTION_QUADRANTS.length - 1];
  let bestDist = Infinity;
  for (const q of EMOTION_QUADRANTS) {
    const dv = (valence - q.vc) / 2;
    const da =  arousal - q.ac;
    const d  = Math.sqrt(dv * dv + da * da);
    if (d < bestDist) { bestDist = d; best = q; }
  }
  return `${best.emoji} ${best.label}`;
}

// ────────────────────────────────────────────────────────────────
//  EmotionContext v2
//
//  emotionStrength ∈ [0.0, 1.0]
//    0.0 → parâmetros completamente neutros
//    1.0 → influência emocional máxima  (padrão, compatibilidade v1)
//
//  Permite "misturar" geração emocional com geração padrão:
//    finalBpm = lerp(120, emotionalBpm, emotionStrength)
// ────────────────────────────────────────────────────────────────
class EmotionContext {
  constructor(valence, arousal, emotionStrength = 1.0) {
    this.valence         = clamp(valence, -1, 1);
    this.arousal         = clamp(arousal,  0, 1);
    this.emotionStrength = clamp(emotionStrength, 0, 1);

    const v  = this.valence;
    const a  = this.arousal;
    const es = this.emotionStrength;
    const q  = getEmotionQuadrant(v, a);
    this.quadrant = q;

    // ── BPM — curva exponencial (soa mais natural que linear)
    // easeIn(a, 1.2) acelera devagar no início, mais rápido no topo
    // Faixa efetiva: ~60 BPM (calmo) a ~180 BPM (máxima energia)
    // +v*10: valência positiva empurra levemente para cima
    const bpmEmotional = Math.round(lerp(60, 180, easeIn(a, 1.2)) + (v * 10));
    this.bpm = Math.round(lerp(120, bpmEmotional, es));

    // ── Escala — fit ponderado α*|v| + β*a
    // Arousal co-influencia a escolha modal além da valência
    const scaleList = EMOTION_SCALES[q] || EMOTION_SCALES.neutral;
    const fitScore  = SCALE_ALPHA * Math.abs(v) + SCALE_BETA * a;
    const scaleIdx  = Math.floor(fitScore * (scaleList.length - 1));
    this.scaleName  = scaleList[clamp(scaleIdx, 0, scaleList.length - 1)];

    // ── Estilo — arousal indexa dentro do quadrante
    const styleList = EMOTION_STYLES[q] || EMOTION_STYLES.neutral;
    const styleIdx  = Math.floor(a * (styleList.length - 1));
    this.styleName  = styleList[clamp(styleIdx, 0, styleList.length - 1)];

    // ── Bateria
    const drumList  = EMOTION_DRUMS[q] || EMOTION_DRUMS.neutral;
    const drumIdx   = Math.floor(a * (drumList.length - 1));
    this.drumStyle  = drumList[clamp(drumIdx, 0, drumList.length - 1)];

    // ── Tensão harmônica (gradação contínua, não categórica)
    this.tension = 1 - Math.abs(v);
    let progPool;
    if      (this.tension < 0.25) progPool = PROGRESSIONS.consonant;
    else if (this.tension < 0.50) progPool = PROGRESSIONS.moderate;
    else if (this.tension < 0.75) progPool = PROGRESSIONS.tense;
    else                           progPool = PROGRESSIONS.dissonant;

    const pIdx = v < 0
      ? progPool.length - 1 - Math.floor(Math.abs(v) * (progPool.length - 1))
      : Math.floor(v * (progPool.length - 1));
    this.prog = progPool[clamp(pIdx, 0, progPool.length - 1)];

    // ── Tônica (variação estética tímbrica)
    // Impacto psicológico menor que harmonia, mas contribui para "cor" tonal
    const brightKeys = [60, 67, 62, 64, 69]; // C G D E A
    const darkKeys   = [57, 61, 56, 63, 59]; // A C# Ab Eb B
    const keyPool    = v >= 0 ? brightKeys : darkKeys;
    const keyIdx     = Math.floor(Math.abs(v) * (keyPool.length - 1));
    this.key         = keyPool[clamp(keyIdx, 0, keyPool.length - 1)];

    // ── Métricas derivadas ────────────────────────────────────

    this.noteDensity = lerp(0.20, 0.90, a);
    this.velocityLo  = Math.round(lerp(45, 90,  a));
    this.velocityHi  = Math.round(lerp(72, 127, a));

    // Direção melódica: 0.0 = tende descer, 1.0 = tende subir
    this.ascBias = (v + 1) / 2;

    // Dissonância cromática: aumenta com valência negativa
    this.dissonance  = v < 0 ? lerp(0.2, 0.7, Math.abs(v)) : 0.1;

    // Swing: valência positiva + baixo arousal = mais rubato expressivo
    this.swingAmount = v >= 0 ? lerp(0, 0.08, 1 - a) : 0;

    // ── humanizeAmount ────────────────────────────────────────
    // Quanto de microvariação "humana" inserir
    // Baixo arousal → mais rubato, expressividade, imprecisão intencional
    // Alto arousal  → mais mecânico, rígido, quantizado
    // (contraintuitivo, mas perceptivamente real — músicas agitadas tendem
    //  a ser mais métricas; contemplativas têm mais expressão temporal)
    // Útil para futura humanização via Magenta ou quantização adaptativa
    this.humanizeAmount = lerp(0.15, 0.02, a);

    // ── emotionalMomentum ─────────────────────────────────────
    // Vetor de evolução emocional ao longo dos compassos
    // > 0: música "cresce" — aumenta densidade/tensão progressivamente
    // < 0: música "cai"   — relaxa, resolve, diminui ao longo do tempo
    // Magnitude = velocidade de mudança; modulada por arousal (easeIn 1.5)
    // Exemplo de uso futuro:
    //   if (momentum > 0.4) deslocar octave up em barIdx alto
    //   if (momentum < -0.4) reduzir noteDensity nos últimos bars
    this.emotionalMomentum = lerp(-1, 1, (v + 1) / 2) * easeIn(a, 1.5);

    // ── Rótulo final
    this.label = describeEmotion(v, a);
  }

  // ── toCfg v4 — cfg completo com todos os parâmetros emocionais
  //  Parâmetros que antes eram calculados e descartados agora chegam ao generate()
  toCfg(seed = 42, bars = 8) {
    return {
      key:       this.key,
      scale:     this.scaleName,
      bpm:       this.bpm,
      bars:      bars,
      seed:      seed,
      prog:      this.prog,
      style:     this.styleName,
      drumStyle: this.drumStyle,
      _emotion: {
        // ── Metadados emocionais
        valence:           this.valence,
        arousal:           this.arousal,
        emotionStrength:   this.emotionStrength,
        ascBias:           this.ascBias,
        tension:           this.tension,
        label:             this.label,
        quadrant:          this.quadrant,
        // ── Parâmetros v4: agora realmente usados pelo motor
        noteDensity:       this.noteDensity,       // [0.2–0.9] → rhythmDensity
        dissonance:        this.dissonance,         // [0.0–0.7] → chordType + leapChance
        humanizeAmount:    this.humanizeAmount,     // [0–1] → jitter de timing/dur/vel
        emotionalMomentum: this.emotionalMomentum,  // [-1,+1] → arco macro da peça
        velocityLo:        this.velocityLo,         // substitui velocityRange do estilo
        velocityHi:        this.velocityHi,
      },
    };
  }

  toString() {
    const f = n => n.toFixed(2);
    return [
      `╔═ EmotionContext v2 ═══════════════════`,
      `║  ${this.label}`,
      `║  valence=${f(this.valence)}  arousal=${f(this.arousal)}  strength=${f(this.emotionStrength)}`,
      `║  quadrant=${this.quadrant}`,
      `╠═ Parâmetros Musicais ══════════════════`,
      `║  bpm=${this.bpm}  key=${this.key}  scale=${this.scaleName}`,
      `║  style=${this.styleName}  drums=${this.drumStyle}`,
      `║  prog=[${this.prog}]  tension=${f(this.tension)}`,
      `╠═ Métricas Derivadas ════════════════════`,
      `║  ascBias=${f(this.ascBias)}  dissonance=${f(this.dissonance)}`,
      `║  humanize=${f(this.humanizeAmount)}  momentum=${f(this.emotionalMomentum)}`,
      `║  swing=${f(this.swingAmount)}  noteDensity=${f(this.noteDensity)}`,
      `╚════════════════════════════════════════`,
    ].join('\n');
  }
}

// ────────────────────────────────────────────────────────────────
//  generateFromEmotion — ponto de entrada principal
// ────────────────────────────────────────────────────────────────
function generateFromEmotion(valence, arousal, seed = 42, bars = 8, emotionStrength = 1.0) {
  if (typeof generate !== 'function') {
    throw new Error('[theory_russel] generate() não encontrado. Carregue theory.js antes.');
  }
  if (typeof seedRng === 'function') seedRng(seed);

  const emo  = new EmotionContext(valence, arousal, emotionStrength);
  const cfg  = emo.toCfg(seed, bars);
  const song = generate(cfg);   // generate() agora é wrapper de generateBlock()

  song._emotion = cfg._emotion;
  song._cfg     = cfg;
  // _genome e _memory já são adicionados por generate() via generateBlock()

  return song;
}

// ────────────────────────────────────────────────────────────────
//  emotionError v2 — distância ponderada
//
//  Arousal domina a percepção emocional imediata (energia física).
//  Valência é mais sutil; demora mais para ser percebida.
//  Pesos padrão: wArousal=0.6, wValence=0.4
//
//  Para distância euclidiana clássica: { valence:0.5, arousal:0.5 }
// ────────────────────────────────────────────────────────────────
function emotionError(target, measured, weights = { valence: 0.4, arousal: 0.6 }) {
  const dv = Math.abs(target.valence - measured.valence);
  const da = Math.abs(target.arousal - measured.arousal);
  return weights.valence * dv + weights.arousal * da;
}

// ────────────────────────────────────────────────────────────────
//  generateCalibrated — busca guiada por emoção
//  Gera até maxIterations músicas, retorna a mais próxima do alvo
// ────────────────────────────────────────────────────────────────
function generateCalibrated(
  valence, arousal, seed, bars,
  analyzerFn    = null,
  maxIterations = 5,
  errorWeights  = { valence: 0.4, arousal: 0.6 },
  threshold     = 0.10
) {
  let bestSong  = null;
  let bestError = Infinity;
  const target  = { valence, arousal };

  for (let i = 0; i < maxIterations; i++) {
    const song = generateFromEmotion(valence, arousal, seed + i, bars);
    if (!analyzerFn) return song;

    const measured = analyzerFn(song);
    const err      = emotionError(target, measured, errorWeights);

    if (err < bestError) {
      bestError = err;
      bestSong  = song;
      bestSong._emotionError    = err;
      bestSong._emotionMeasured = measured;
      bestSong._emotionTarget   = target;
    }

    if (err < threshold) {
      console.log(`[theory_russel] Convergiu em ${i+1} iterações (erro=${err.toFixed(3)})`);
      break;
    }
  }

  return bestSong;
}

// ────────────────────────────────────────────────────────────────
//  emotionFromPresetName — lookup reverso preset → (v, a)
// ────────────────────────────────────────────────────────────────
const PRESET_EMOTION_MAP = {
  overworld:  { valence:  0.7, arousal: 0.80 },
  dungeon:    { valence: -0.5, arousal: 0.40 },
  battle:     { valence: -0.2, arousal: 0.90 },
  boss:       { valence: -0.8, arousal: 0.95 },
  title:      { valence:  0.8, arousal: 0.60 },
  gameover:   { valence: -0.9, arousal: 0.10 },
  town:       { valence:  0.6, arousal: 0.40 },
  cave:       { valence: -0.4, arousal: 0.25 },
  underwater: { valence:  0.3, arousal: 0.20 },
  sky:        { valence:  0.9, arousal: 0.75 },
  lofi:       { valence:  0.4, arousal: 0.20 },
  credits:    { valence: -0.1, arousal: 0.30 },
  minigame:   { valence:  0.5, arousal: 0.95 },
  boss2:      { valence: -0.9, arousal: 1.00 },
  jazz:       { valence:  0.5, arousal: 0.50 },
  tribal:     { valence: -0.1, arousal: 0.75 },
};

function emotionFromPresetName(presetName) {
  return PRESET_EMOTION_MAP[presetName] || { valence: 0, arousal: 0.5 };
}

// ────────────────────────────────────────────────────────────────
//  GRID DE EMOÇÕES PREDEFINIDAS — 16 pontos para UI
// ────────────────────────────────────────────────────────────────
const EMOTION_PRESETS = [
  // linha 1 — alto arousal
  { label: 'BATTLE CRY',  emoji: '⚔',  valence:  0.1,  arousal: 1.00 },
  { label: 'TRIUMPHANT',  emoji: '🏆', valence:  0.8,  arousal: 0.90 },
  { label: 'TERROR',      emoji: '😱', valence: -0.8,  arousal: 0.95 },
  { label: 'FRENZY',      emoji: '🌀', valence: -0.3,  arousal: 0.95 },
  // linha 2 — arousal médio-alto
  { label: 'HEROIC',      emoji: '🦸', valence:  0.7,  arousal: 0.75 },
  { label: 'TENSE',       emoji: '😰', valence: -0.4,  arousal: 0.70 },
  { label: 'MYSTERIOUS',  emoji: '🌑', valence: -0.2,  arousal: 0.55 },
  { label: 'PLAYFUL',     emoji: '🎮', valence:  0.6,  arousal: 0.65 },
  // linha 3 — arousal médio
  { label: 'HOPEFUL',     emoji: '🌅', valence:  0.5,  arousal: 0.45 },
  { label: 'NEUTRAL',     emoji: '😐', valence:  0.0,  arousal: 0.40 },
  { label: 'GLOOMY',      emoji: '☁',  valence: -0.5,  arousal: 0.35 },
  { label: 'ROMANTIC',    emoji: '💫', valence:  0.7,  arousal: 0.35 },
  // linha 4 — baixo arousal
  { label: 'SERENE',      emoji: '🌿', valence:  0.8,  arousal: 0.15 },
  { label: 'MELANCHOLIC', emoji: '🌧', valence: -0.7,  arousal: 0.15 },
  { label: 'DREAMY',      emoji: '✨', valence:  0.4,  arousal: 0.20 },
  { label: 'DESOLATE',    emoji: '💀', valence: -0.9,  arousal: 0.05 },
];

// ────────────────────────────────────────────────────────────────
//  EXPORTS — browser (<script> tag): todas as funções ficam globais
//  Para Node/ESM, descomente:
// export {
//   EmotionContext, generateFromEmotion, generateCalibrated,
//   emotionFromPresetName, describeEmotion, emotionError,
//   getEmotionQuadrant, EMOTION_PRESETS, PRESET_EMOTION_MAP,
//   EMOTION_QUADRANTS, QUADRANT_CENTERS,
// };
// ────────────────────────────────────────────────────────────────
