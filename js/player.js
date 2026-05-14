// ================================================================
//  player.js — Engine de playback para MIDIs importados
//  Usa LOOKAHEAD SCHEDULER: agenda apenas os próximos 2s de cada vez
//  Isso evita criar milhares de nós WebAudio de uma só vez
// ================================================================

// ── Estado do player MIDI
let midiMasterComp    = null;   // compressor único do master bus
let midiMasterGain    = null;   // gain master
let midiScheduled     = [];     // nós ativos (para cleanup)
let midiLoopTimer     = null;   // timer do loop de música
let midiSchedTimer    = null;   // timer do lookahead scheduler
let midiPlaying       = false;
let midiPlayStart     = 0;      // ctx.currentTime quando a música começou
let midiRafId         = null;
let importedSong      = null;
let importedMaxBeats  = 0;

// ── Lookahead scheduler config
const LOOKAHEAD_SEC   = 2.0;    // agenda até 2s à frente
const SCHEDULE_MS     = 100;    // re-verifica a cada 100ms
let   schedCursor     = 0;      // índice na lista achatada de notas
let   allNotesSorted  = [];     // todas as notas ordenadas por tempo real (segundos)
let   currentPrograms = null;

// Nota: KICK=36, SNARE=38, HHC=42, HHO=46 estão em theory.js
//       CLAP=39 está em audio.js

// ── Retorna o AudioContext compartilhado de audio.js + garante master bus
function getMidiCtx(){
  const ctx = getCtx();  // ← contexto único de audio.js

  if (!midiMasterComp){
    midiMasterComp = ctx.createDynamicsCompressor();
    midiMasterComp.threshold.value = -18;
    midiMasterComp.knee.value      = 6;
    midiMasterComp.ratio.value     = 4;
    midiMasterComp.attack.value    = 0.003;
    midiMasterComp.release.value   = 0.15;

    midiMasterGain = ctx.createGain();
    midiMasterGain.gain.value = 0.85;

    midiMasterComp.connect(midiMasterGain);
    midiMasterGain.connect(ctx.destination);

    console.log('[player] Master bus criado no audioCtx compartilhado (getCtx).');
  }
  return ctx;
}

function m2fMidi(note){ return 440 * Math.pow(2, (note - 69) / 12); }

function makeMidiNoise(ctx){
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function waveForProgram(prog){
  if (prog < 8)   return {type:'sine',     filter:3000, vol:0.4};   // Piano
  if (prog < 16)  return {type:'triangle', filter:3500, vol:0.35};  // Chromatic Perc
  if (prog < 24)  return {type:'sine',     filter:2500, vol:0.45};  // Organ
  if (prog < 32)  return {type:'triangle', filter:3000, vol:0.38};  // Guitar
  if (prog < 40)  return {type:'sawtooth', filter:1200, vol:0.35};  // Bass
  if (prog < 48)  return {type:'sawtooth', filter:3500, vol:0.30};  // Strings
  if (prog < 56)  return {type:'sawtooth', filter:4000, vol:0.28};  // Ensemble
  if (prog < 64)  return {type:'sawtooth', filter:3500, vol:0.30};  // Brass
  if (prog < 72)  return {type:'triangle', filter:4000, vol:0.30};  // Reed
  if (prog < 80)  return {type:'sine',     filter:4500, vol:0.28};  // Pipe
  if (prog < 88)  return {type:'square',   filter:3000, vol:0.25};  // Synth Lead
  if (prog < 96)  return {type:'triangle', filter:2500, vol:0.22};  // Synth Pad
  return             {type:'triangle',     filter:3000, vol:0.25};
}

// ── Sintetiza UMA nota em t0 absoluto (ctx.currentTime)
function playNoteAt(ctx, note, t0, programNumber){
  const dur = Math.max(0.05, note.duration * (cfg.bpm / 60) === 0
    ? 0.2
    : note.duration / (cfg.bpm / 60));
  // Recalcula dur corretamente
  const bps = cfg.bpm / 60;
  const durSec = Math.max(0.05, note.duration / bps);

  const gain = ctx.createGain();
  gain.connect(midiMasterComp);

  // ── DRUMS
  if (note.isDrum){
    const p   = note.pitch;
    const vel = (note.velocity || 80) / 127;

    if (p === 35 || p === 36){                          // Kick
      const osc = ctx.createOscillator();
      osc.connect(gain); osc.type = 'sine';
      osc.frequency.setValueAtTime(180, t0);
      osc.frequency.exponentialRampToValueAtTime(35, t0 + 0.14);
      gain.gain.setValueAtTime(1.0 * vel, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.start(t0); osc.stop(t0 + 0.25);
      midiScheduled.push(osc, gain);
    }
    else if (p === 38 || p === 40){                     // Snare
      const ns = makeMidiNoise(ctx);
      const f  = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.7;
      ns.connect(f); f.connect(gain);
      gain.gain.setValueAtTime(0.85 * vel, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      ns.start(t0); ns.stop(t0 + 0.20);
      midiScheduled.push(ns, f, gain);
    }
    else if (p === 39 || p === CLAP){                   // Clap
      const ns = makeMidiNoise(ctx);
      const f  = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.2;
      ns.connect(f); f.connect(gain);
      gain.gain.setValueAtTime(0.65 * vel, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      ns.start(t0); ns.stop(t0 + 0.14);
      midiScheduled.push(ns, f, gain);
    }
    else if ([41,43,45,47,48,50].includes(p)){          // Toms
      const osc = ctx.createOscillator();
      osc.connect(gain); osc.type = 'sine';
      const baseFreq = 80 + (p - 41) * 12;
      osc.frequency.setValueAtTime(baseFreq, t0);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, t0 + 0.18);
      gain.gain.setValueAtTime(0.75 * vel, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.start(t0); osc.stop(t0 + 0.25);
      midiScheduled.push(osc, gain);
    }
    else if (p === 42 || p === 44){                     // Hi-hat fechado
      const ns = makeMidiNoise(ctx);
      const f  = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 8000;
      ns.connect(f); f.connect(gain);
      gain.gain.setValueAtTime(0.4 * vel, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
      ns.start(t0); ns.stop(t0 + 0.06);
      midiScheduled.push(ns, f, gain);
    }
    else if (p === 46){                                 // Hi-hat aberto
      const ns = makeMidiNoise(ctx);
      const f  = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 7000;
      ns.connect(f); f.connect(gain);
      gain.gain.setValueAtTime(0.45 * vel, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      ns.start(t0); ns.stop(t0 + 0.20);
      midiScheduled.push(ns, f, gain);
    }
    else if ([49,51,52,55,57,59].includes(p)){          // Crash / Ride
      const ns = makeMidiNoise(ctx);
      const f  = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 6000;
      ns.connect(f); f.connect(gain);
      const decayTime = [49,52,57].includes(p) ? 0.6 : 0.3;
      gain.gain.setValueAtTime(0.38 * vel, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + decayTime);
      ns.start(t0); ns.stop(t0 + decayTime + 0.01);
      midiScheduled.push(ns, f, gain);
    }
    else {                                              // Drum genérico
      const ns = makeMidiNoise(ctx);
      const f  = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 1;
      ns.connect(f); f.connect(gain);
      gain.gain.setValueAtTime(0.45 * vel, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
      ns.start(t0); ns.stop(t0 + 0.12);
      midiScheduled.push(ns, f, gain);
    }
    return;
  }

  // ── NOTAS TONAIS
  const tw   = waveForProgram(programNumber || 0);
  const vel  = (note.velocity || 80) / 127;
  const osc  = ctx.createOscillator();
  const flt  = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.Q.value = 1.2;
  flt.frequency.value = tw.filter;
  osc.type = tw.type;
  osc.frequency.value = m2fMidi(note.pitch);
  osc.detune.value = (Math.random() - 0.5) * 6;
  osc.connect(flt); flt.connect(gain);

  const v      = tw.vol * vel;
  const atkEnd = t0 + 0.012;
  const susEnd = t0 + Math.min(0.06, durSec * 0.4);
  const relEnd = t0 + durSec;

  gain.gain.setValueAtTime(0,        t0);
  gain.gain.linearRampToValueAtTime(v,        atkEnd);
  gain.gain.linearRampToValueAtTime(v * 0.85, susEnd);
  gain.gain.linearRampToValueAtTime(0,        relEnd);

  osc.start(t0); osc.stop(relEnd + 0.01);
  midiScheduled.push(osc, flt, gain);
}

// ── Tick do lookahead scheduler (chamado a cada SCHEDULE_MS)
function schedulerTick(){
  if (!midiPlaying) return;

  const ctx      = getMidiCtx();
  const bps      = cfg.bpm / 60;
  const deadline = ctx.currentTime + LOOKAHEAD_SEC;

  let count = 0;
  while (schedCursor < allNotesSorted.length){
    const item = allNotesSorted[schedCursor];
    const t0   = midiPlayStart + item.note.startBeat / bps;

    if (t0 > deadline) break;   // ainda não está no horizonte

    if (t0 >= ctx.currentTime - 0.01){  // não agenda notas já passadas
      playNoteAt(ctx, item.note, t0, item.prog);
      count++;
    }
    schedCursor++;
  }

  if (count > 0){
    console.log(`[player] Tick: agendadas ${count} notas | cursor ${schedCursor}/${allNotesSorted.length} | nós ativos: ${midiScheduled.length}`);
  }

  // Música terminou?
  if (schedCursor >= allNotesSorted.length){
    const totalSec = importedMaxBeats / bps;
    const elapsed  = ctx.currentTime - midiPlayStart;
    const remaining = (totalSec - elapsed) * 1000 + 300;
    console.log(`[player] Todas as notas agendadas. Loop em ${remaining.toFixed(0)}ms`);
    clearInterval(midiSchedTimer);
    midiSchedTimer = null;
    midiLoopTimer  = setTimeout(() => {
      if (midiPlaying){
        console.log('[player] Loop — reiniciando');
        playImported(importedSong, currentPrograms);
      }
    }, Math.max(300, remaining));
  }
}

// ── Para o player MIDI
function stopMidiPlayer(){
  console.log('[player] stopMidiPlayer — nós a liberar:', midiScheduled.length);
  clearTimeout(midiLoopTimer);
  clearInterval(midiSchedTimer);
  cancelAnimationFrame(midiRafId);
  midiSchedTimer = null;
  midiLoopTimer  = null;

  for (const n of midiScheduled){
    try { n.stop(); }       catch(e){}
    try { n.disconnect(); } catch(e){}
  }
  midiScheduled = [];
  midiPlaying   = false;
  schedCursor   = 0;
  updateMidiPlayerUI(false);
}

// ── Toca a música importada (ponto de entrada)
function playImported(song, programs){
  console.log('[player] playImported chamado');
  console.log('[player] song tracks:', song
    ? Object.entries(song).map(([k,v]) => `${k}:${v.length}`).join(' | ')
    : 'null');

  stopMidiPlayer();
  if (!song){ console.warn('[player] song é null — abortando.'); return; }

  const ctx = getMidiCtx();
  if (ctx.state === 'suspended'){
    ctx.resume().then(() => console.log('[player] AudioContext resumido OK.'));
  }
  console.log('[player] AudioContext state:', ctx.state, '| currentTime:', ctx.currentTime.toFixed(3));

  // Monta lista única ordenada por startBeat para o scheduler
  const bps = cfg.bpm / 60;
  const trackDefs = {
    melody: { notes: song.melody || [], prog: (programs && programs.melody) || 0  },
    bass:   { notes: song.bass   || [], prog: (programs && programs.bass)   || 32 },
    arp:    { notes: song.arp    || [], prog: (programs && programs.arp)    || 0  },
    drums:  { notes: song.drums  || [], prog: 0 }
  };

  allNotesSorted = [];
  for (const [tname, t] of Object.entries(trackDefs)){
    if (!cfg.tracks[tname]) continue;
    for (const n of t.notes){
      allNotesSorted.push({ note: n, prog: t.prog, track: tname });
    }
  }
  allNotesSorted.sort((a, b) => a.note.startBeat - b.note.startBeat);

  importedMaxBeats = allNotesSorted.length > 0
    ? allNotesSorted.reduce((m, item) => Math.max(m, item.note.startBeat + item.note.duration), 0)
    : cfg.bars * 4;

  console.log(`[player] Total notas na fila: ${allNotesSorted.length} | ${importedMaxBeats.toFixed(2)} beats`);

  midiPlaying      = true;
  midiPlayStart    = ctx.currentTime + 0.08;
  schedCursor      = 0;
  currentPrograms  = programs;

  // Primeiro tick imediato + interval para os próximos
  schedulerTick();
  midiSchedTimer = setInterval(schedulerTick, SCHEDULE_MS);

  console.log('[player] Lookahead scheduler iniciado. Tick a cada', SCHEDULE_MS, 'ms');

  updateMidiPlayerUI(true);
  animateMidiPlayhead();
}

// ── Animação do playhead
function animateMidiPlayhead(){
  cancelAnimationFrame(midiRafId);
  if (!midiPlaying){ drawRoll(importedSong); return; }

  const ctx        = getMidiCtx();
  const bps        = cfg.bpm / 60;
  const totalBeats = importedMaxBeats || (cfg.bars * 4);
  let beat = ((ctx.currentTime - midiPlayStart) * bps) % totalBeats;
  if (beat < 0) beat = 0;

  const bar     = Math.floor(beat / 4) + 1;
  const beatNum = Math.floor(beat % 4) + 1;
  document.getElementById('beatDisp').textContent =
    `BAR ${String(bar).padStart(2,'0')} BEAT ${beatNum}`;

  // ← Atualiza seek bar com o tempo real da música importada
  if (typeof updateSeekBar === 'function'){
    updateSeekBar(beat, totalBeats, bps);
  }

  drawRoll(importedSong, beat);
  midiRafId = requestAnimationFrame(animateMidiPlayhead);
}

// ── Sincroniza UI
function updateMidiPlayerUI(playing){
  const led  = document.getElementById('playLed');
  const play = document.getElementById('playBtn');
  const stop = document.getElementById('stopBtn');
  if (led)  led.className = 'led' + (playing ? ' on play' : '');
  if (play) play.disabled = playing;
  if (stop) stop.disabled = !playing;
  if (!playing){
    const bd = document.getElementById('beatDisp');
    if (bd) bd.textContent = 'BAR -- BEAT --';
  }
  console.log('[player] UI — playing:', playing);
}
