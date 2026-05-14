// ================================================================
//  audio.js — Web Audio engine (síntese chiptune + playback)
// ================================================================

// --- NOVAS VARIÁVEIS PARA O LOOKAHEAD SCHEDULER ---
let schedulerTimer = null;
const lookahead = 25; // ms de intervalo de checagem
const scheduleAheadTime = 0.5; // agenda no máximo meio segundo de antecedência

let nextNoteIndices = { melody: 0, bass: 0, arp: 0, drums: 0, counter: 0 };
let currentSongToPlay = null;
let songBps = 2.0;
let globalStartBeat = 0;
let playAbsStartTime = 0;

// ── Variáveis do Loop Infinito Evolutivo
let infiniteMode        = false;
let infiniteCfg         = null;
let infiniteGenome      = null;
let infiniteMemory      = null;
let infiniteBlockOffset = 0;
// --------------------------------------------------

let audioCtx = null, scheduled = [], loopTimer = null;
let playStart = 0;
let isPlaying = false;
let isPaused = false; // NOVA VARIÁVEL AQUI

// ── AnalyserNode global — usado por analyzer.js para análise em tempo real
let masterAnalyser = null;

const CLAP = 39;

// ── Flag global: ativa/desativa humanização antes do playback
let humanizeEnabled = false;

// ================================================================
//  humanizeSong — aplica microvariações expressivas nas notas
//
//  amount ∈ [0.0, 0.15]  (vem de EmotionContext.humanizeAmount)
//    0.00 = sem alteração (mecânico, quantizado)
//    0.15 = máxima expressão (rubato, dinâmica variada)
//
//  O que faz:
//    · Timing jitter    — desloca startBeat ± amount beats
//    · Velocity jitter  — varia velocity ± amount*30 (notas tonais)
//    · Velocity suave   — variação menor na bateria (±amount*12)
//    · Duração leve     — encurta/alonga levemente notas tonais
//
//  Nunca modifica a song original — retorna deep clone
// ================================================================
function humanizeSong(song, amount) {
  if (!amount || amount <= 0) return song;

  // Semente determinística baseada no número de notas (reprodutível)
  // Garante que a mesma música sempre humaniza da mesma forma
  let _h = (song.melody.length * 1664525 + 1013904223) >>> 0;
  function hrng() {
    _h = (_h * 1664525 + 1013904223) >>> 0;
    return _h / 4294967296;
  }
  function hjitter(scale) { return (hrng() - 0.5) * 2 * scale; }

  const timingScale   = amount;          // ±amount beats de deslocamento
  const velScaleTonal = amount * 30;     // ±0~4.5 de velocity (notas tonais)
  const velScaleDrum  = amount * 12;     // ±0~1.8 de velocity (bateria)
  const durScale      = amount * 0.08;   // ±0~1.2% de duração

  function humanizeNote(n, isDrum) {
    const note = { ...n };

    if (isDrum) {
      // Bateria: só variação de velocity (timing fixo mantém o groove)
      note.velocity = Math.round(
        clampVal(note.velocity + hjitter(velScaleDrum), 20, 127)
      );
    } else {
      // Notas tonais: timing + velocity + duração
      note.startBeat = Math.max(0, note.startBeat + hjitter(timingScale));
      note.velocity  = Math.round(
        clampVal(note.velocity + hjitter(velScaleTonal), 20, 127)
      );
      note.duration  = Math.max(0.05,
        note.duration * (1 + hjitter(durScale))
      );
    }
    return note;
  }

  function clampVal(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  return {
    melody: song.melody.map(n => humanizeNote(n, false)),
    bass:   song.bass  .map(n => humanizeNote(n, false)),
    arp:    song.arp   .map(n => humanizeNote(n, false)),
    drums:  song.drums .map(n => humanizeNote(n, true)),
    // preserva metadados emocionais
    _emotion: song._emotion,
    _cfg:     song._cfg,
  };
}

function getCtx(){
  if(!audioCtx){
    audioCtx = new(window.AudioContext || window.webkitAudioContext)();
    // AnalyserNode: intercepta o sinal antes do destination para analyzer.js
    masterAnalyser = audioCtx.createAnalyser();
    masterAnalyser.fftSize              = 2048;
    masterAnalyser.smoothingTimeConstant = 0.5;
    masterAnalyser.connect(audioCtx.destination);
  }
  return audioCtx;
}

function m2f(note){ return 440 * Math.pow(2, (note-69)/12); }

function makeNoise(ctx){
  const buf = ctx.createBuffer(1, ctx.sampleRate*.3, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for(let i=0; i<d.length; i++) d[i] = Math.random()*2-1;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  return s;
}

function scheduleNote(note, beatsPerSec, t0Abs, trackName, startOffsetBeat = 0){
  const ctx = getCtx();
  
  const t0 = t0Abs + (note.startBeat - startOffsetBeat) / beatsPerSec;
  const dur = note.duration / beatsPerSec;

  if(t0 + dur < ctx.currentTime) return;

  let actualStart = t0;
  let actualDur = dur;
  if (t0 < ctx.currentTime) {
      actualStart = ctx.currentTime;
      actualDur = dur - (ctx.currentTime - t0);
  }

  const gain = ctx.createGain();
  // Conecta ao masterAnalyser (que por sua vez conecta ao destination)
  // Isso permite analyzer.js capturar o sinal em tempo real
  gain.connect(masterAnalyser || ctx.destination);

  if(note.isDrum){
    if(note.pitch === 36){
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, actualStart);
      osc.frequency.exponentialRampToValueAtTime(40, actualStart+.12);
      gain.gain.setValueAtTime(1.0, actualStart);
      gain.gain.exponentialRampToValueAtTime(.001, actualStart+.22);
      osc.start(actualStart); osc.stop(actualStart+.23);
      scheduled.push(osc, gain);
    } else if(note.pitch === 38 || note.pitch === CLAP){
      const ns = makeNoise(ctx);
      const f  = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 2800; f.Q.value = .6;
      ns.connect(f); f.connect(gain);
      gain.gain.setValueAtTime(.9, actualStart);
      gain.gain.exponentialRampToValueAtTime(.001, actualStart+.14);
      ns.start(actualStart); ns.stop(actualStart+.15);
      scheduled.push(ns, gain);
    } else {
      const ns = makeNoise(ctx);
      const f  = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 7000;
      ns.connect(f); f.connect(gain);
      const d2 = note.pitch === 46 ? .1 : .04;
      gain.gain.setValueAtTime(.5, actualStart);
      gain.gain.exponentialRampToValueAtTime(.001, actualStart+d2);
      ns.start(actualStart); ns.stop(actualStart+d2+.01);
      scheduled.push(ns, gain);
    }
    return;
  }

  const osc = ctx.createOscillator();
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.Q.value = 1;

  if(trackName === 'melody')     { osc.type='square';   flt.frequency.value=2400; }
  else if(trackName === 'bass')  { osc.type='square';   flt.frequency.value=700;  }
  else                           { osc.type='triangle'; flt.frequency.value=4000; }

  osc.frequency.value = m2f(note.pitch);
  osc.connect(flt); flt.connect(gain);

  const vol = trackName==='melody'?.35 : trackName==='bass'?.45 : .22;
  const vel = (note.velocity || 100) / 127;
  
  gain.gain.setValueAtTime(0, actualStart);
  if (actualStart === t0) {
      gain.gain.linearRampToValueAtTime(vol*vel, actualStart+.008);
  } else {
      gain.gain.setValueAtTime(vol*vel, actualStart);
  }
  
  gain.gain.setValueAtTime(vol*vel, actualStart+Math.max(.01, actualDur-.02));
  gain.gain.linearRampToValueAtTime(0, actualStart+actualDur);

  osc.start(actualStart); osc.stop(actualStart+actualDur+.01);
  scheduled.push(osc, gain, flt);
}

function stopAll(){
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume(); 
  
  clearTimeout(loopTimer);
  clearTimeout(schedulerTimer); // NOVO: Para o loop do scheduler
  
  for(const n of scheduled){ try{n.stop();}catch(e){} try{n.disconnect();}catch(e){} }
  scheduled  = [];
  isPlaying  = false;
  isPaused   = false; 
  
  if (typeof updatePlayUI === 'function') updatePlayUI();
  if (typeof rafId !== 'undefined') cancelAnimationFrame(rafId);
}

function playAll(song) {
    playAllFrom(song, 0);
}

// A função que roda a cada 25ms para agendar as próximas notas
function scheduler() {
    if (!isPlaying || isPaused) return;

    const ctx = getCtx();
    const currentTime = ctx.currentTime;
    const scheduleUntil = currentTime + scheduleAheadTime;
    const trackNames = ['melody', 'bass', 'arp', 'drums', 'counter'];
    
    for (const tname of trackNames) {
        if (!cfg.tracks[tname] && tname !== 'counter') continue; // counter sempre toca
        if (!currentSongToPlay[tname]) continue;
        
        const notes = currentSongToPlay[tname];
        let idx = nextNoteIndices[tname];

        while (idx < notes.length) {
            const note = notes[idx];
            const noteBeatOffset = note.startBeat - globalStartBeat;
            
            if (noteBeatOffset < 0) { idx++; continue; }

            const noteTime = playAbsStartTime + (noteBeatOffset / songBps);

            if (noteTime < scheduleUntil) {
                scheduleNote(note, songBps, playAbsStartTime, tname, globalStartBeat);
                idx++;
            } else {
                break;
            }
        }
        nextNoteIndices[tname] = idx;
    }

    const totalBeats = (currentSongToPlay._cfg && currentSongToPlay._cfg.bars)
        ? currentSongToPlay._cfg.bars * 4
        : cfg.bars * 4;

    // ── Loop infinito: quando o buffer de notas está baixo, gera o próximo bloco
    if (infiniteMode) {
        const remainingBeats = (playAbsStartTime + (totalBeats - globalStartBeat) / songBps) - currentTime;
        if (remainingBeats < 16 / songBps) {
            _appendInfiniteBlock();
        }
    } else {
        // Modo normal: loop simples ao fim da música
        const endTimeAbs = playAbsStartTime + ((totalBeats - globalStartBeat) / songBps);
        if (currentTime >= endTimeAbs) {
            playAllFrom(currentSongToPlay._originalSong || currentSongToPlay, 0);
            return;
        }
    }

    schedulerTimer = setTimeout(scheduler, lookahead);
}

// ── Gera e anexa o próximo bloco no modo loop infinito
function _appendInfiniteBlock() {
    if (!infiniteCfg || !infiniteGenome) return;

    const barsPerBlock = infiniteCfg.bars || 8;
    infiniteBlockOffset += barsPerBlock * 4;

    const result = generateBlock(
        infiniteCfg,
        infiniteGenome,
        infiniteMemory,
        infiniteBlockOffset
    );

    // Salva estado evolutivo para o próximo bloco
    infiniteGenome = result.genome;
    infiniteMemory = result.memory;

    const newBlock = result.song;

    // Adiciona notas do novo bloco ao currentSongToPlay em tempo real
    ['melody', 'bass', 'arp', 'drums', 'counter'].forEach(t => {
        if (!currentSongToPlay[t]) currentSongToPlay[t] = [];
        if (newBlock[t]) currentSongToPlay[t].push(...newBlock[t]);
    });

    console.log(`[audio] ∞ Bloco gerado: offset=${infiniteBlockOffset} beats | notas totais melody=${currentSongToPlay.melody.length}`);
}

// ── Ativa o modo loop infinito (chamado por ui.js após a geração)
function startInfiniteMode(cfg_in, genome, memory) {
    infiniteMode        = true;
    infiniteCfg         = cfg_in;
    infiniteGenome      = genome;
    infiniteMemory      = memory;
    infiniteBlockOffset = (cfg_in.bars || 8) * 4;  // offset do primeiro bloco já gerado
    console.log('[audio] ∞ Loop infinito ativado.');
}

// A nova função de play que dá o "kickstart" no scheduler
function playAllFrom(song, startBeat) {
  stopAll();
  const ctx = getCtx();
  if(ctx.state === 'suspended') ctx.resume();
  isPlaying = true;

  let songToPlay = song;
  if (humanizeEnabled) {
    const amount = (song._emotion && song._emotion.humanizeAmount != null)
      ? song._emotion.humanizeAmount
      : 0.06;
    songToPlay = humanizeSong(song, amount);
  }
  
  songToPlay._originalSong = song; // Guarda a limpa para o loop

  songBps = cfg.bpm / 60;
  globalStartBeat = startBeat;
  currentSongToPlay = songToPlay;

  playAbsStartTime = ctx.currentTime + 0.08;
  playStart = playAbsStartTime - (startBeat / songBps); 

  // Zera os ponteiros de leitura das tracks
  nextNoteIndices = { melody: 0, bass: 0, arp: 0, drums: 0, counter: 0 };
  
  // Reset do loop infinito ao tocar manualmente
  infiniteMode = false;

  // Dá a partida na esteira!
  scheduler();

  if (typeof updatePlayUI === 'function') updatePlayUI();
  if (typeof animatePlayhead === 'function') animatePlayhead();
}
// Inicio da correção do pause
// ================================================================
// ENGINE DE PAUSE NATIVO
// ================================================================
function pauseAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === 'running') {
    ctx.suspend();
    isPaused = true;
  }
}

function resumeAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
    isPaused = false;
  }
}