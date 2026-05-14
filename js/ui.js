// ================================================================
//  ui.js — Estado global, controles e eventos da interface
// ================================================================

const cfg = {
  preset:'overworld', key:60, scale:'major', bpm:160, bars:8, seed:42,
  prog:[0,3,4,0],
  style:'heroic',
  drumStyle:'rock',
  tracks:{ melody:true, bass:true, arp:true, drums:true }
};

let isImportedSong   = false;
let importedPrograms = null;
let loopInfinite     = false;   // ← flag do loop infinito evolutivo

// ── Alterna o modo ∞ Loop Evolutivo
function toggleInfinite() {
  loopInfinite = !loopInfinite;
  const btn = document.getElementById('loopInfiniteBtn');
  if (btn) {
    btn.classList.toggle('btn-active', loopInfinite);
    btn.textContent = loopInfinite ? '∞ LOOP: ON' : '∞ LOOP';
    btn.style.borderColor = loopInfinite ? 'var(--am)' : '';
    btn.style.color       = loopInfinite ? 'var(--am)' : '';
    btn.style.background  = loopInfinite ? 'rgba(255,176,0,0.10)' : '';
  }
}
window.toggleInfinite = toggleInfinite;

// Helper: atualiza status do painel do analyzer
function _setAnalyzerStatus(msg){
  const el = document.getElementById('analyzerStatus');
  if(el) el.textContent = msg;
}

// ── Status enriquecido com parâmetros emocionais
function buildStatusMsg(song, bpm, seed) {
  const emo = song && song._emotion;
  let msg = `${bpm} BPM`;
  if (emo) {
    if (emo.noteDensity       != null) msg += ` · dens:${(emo.noteDensity * 100).toFixed(0)}%`;
    if (emo.dissonance        != null) msg += ` · diss:${(emo.dissonance  * 100).toFixed(0)}%`;
    if (emo.emotionalMomentum != null) msg += ` · mom:${emo.emotionalMomentum >= 0 ? '+' : ''}${emo.emotionalMomentum.toFixed(2)}`;
    if (emo.humanizeAmount    != null) msg += ` · hum:${(emo.humanizeAmount * 100).toFixed(0)}%`;
  }
  return msg;
}

function updatePlayUI(){
  const playing = isImportedSong ? midiPlaying : isPlaying;
  
  document.getElementById('playLed').className = 'led' + (playing ? ' on play' : '');
  document.getElementById('playBtn').disabled  = !currentSong || playing;
  document.getElementById('stopBtn').disabled  = (!playing && !isPaused);

  // Controle nativo do botão PAUSE
  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) {
    pauseBtn.disabled = !playing && !isPaused;
    if (isPaused) {
      pauseBtn.textContent = '▶ RETOMAR';
      pauseBtn.classList.add('paused');
    } else {
      pauseBtn.textContent = '⏸ PAUSE';
      pauseBtn.classList.remove('paused');
    }
  }

  if (!playing && !isPaused) document.getElementById('beatDisp').textContent = 'BAR -- BEAT --';
}

function applyPreset(name){
  const p = PRESETS[name];
  cfg.preset=name; cfg.key=p.key; cfg.scale=p.scale;
  cfg.bpm=p.bpm;   cfg.bars=p.bars; cfg.prog=p.prog;
  cfg.style     = p.style     || 'heroic';
  cfg.drumStyle = p.drumStyle || 'rock';

  document.getElementById('keySel').value       = p.key;
  document.getElementById('scaleSel').value     = p.scale;
  document.getElementById('bpmSlider').value    = p.bpm;
  document.getElementById('bpmVal').textContent = p.bpm;
  document.getElementById('barsSel').value      = p.bars;
  document.getElementById('styleSel').value     = cfg.style;
  document.getElementById('drumStyleSel').value = cfg.drumStyle;
}

// ================================================================
//  PAINEL EMOCIONAL — Russell Circumplex
// ================================================================

// Sync visual dos parâmetros mapeados pelo EmotionContext
function updateEmotionDisplay(){
  const v = parseInt(document.getElementById('valenceSlider').value) / 100;
  const a = parseInt(document.getElementById('arousalSlider').value) / 100;

  document.getElementById('valenceVal').textContent = (v >= 0 ? '+' : '') + v.toFixed(2);
  document.getElementById('arousalVal').textContent = a.toFixed(2);

  const emo = new EmotionContext(v, a);

  document.getElementById('emotionLabel').textContent = emo.label;

  document.getElementById('epBpm').textContent     = emo.bpm;
  document.getElementById('epScale').textContent   = emo.scaleName.toUpperCase();
  document.getElementById('epStyle').textContent   = emo.styleName.toUpperCase();
  document.getElementById('epDrums').textContent   = emo.drumStyle.toUpperCase();
  document.getElementById('epTension').textContent = (emo.tension * 100).toFixed(0) + '%';
  document.getElementById('epKey').textContent     = NOTE_NAMES[emo.key % 12];
  

  // NOVA LÓGICA: Sincroniza o BPM sugerido pela emoção e recalcula a duração
  document.getElementById('emoBpm').value = emo.bpm;
  const currentBars = parseInt(document.getElementById('emoBars').value) || 8;
  // Faz a Duração em segundos comandar o número de compassos da música
  document.getElementById('emoDuration').addEventListener('change', (e) => {
    const durationSec = parseInt(e.target.value);
    const bpm = parseInt(document.getElementById('emoBpm').value) || cfg.bpm; 
    
    // (Segundos x BPM) / 240 = Quantidade de compassos 4/4
    let calculatedBars = Math.round((durationSec * bpm) / 240);
    if (calculatedBars < 1) calculatedBars = 1; // Mínimo de 1 compasso
    
    // Atualiza o campo que o sistema usa para a geração real
    document.getElementById('emoBars').value = calculatedBars;
	});

  // Cor do rótulo emocional baseada no quadrante
  const lbl = document.getElementById('emotionLabel');
  if      (v >= 0.3 && a >= 0.6) lbl.style.color = '#ffff00';  // euforia — amarelo
  else if (v >= 0.3)              lbl.style.color = '#00ff41';  // positivo — verde
  else if (v <= -0.3 && a >= 0.6) lbl.style.color = '#ff3300'; // raiva/terror — vermelho
  else if (v <= -0.3)             lbl.style.color = '#00ccff';  // melancolia — azul
  else                             lbl.style.color = '#ffb000'; // neutro — âmbar

  // Info do quadrante
  const quadNames = {
    positive_high: '↗ Alta energia + valência positiva → música animada e brilhante',
    positive_low:  '→ Energia baixa + valência positiva → sereno, contemplativo',
    negative_high: '↘ Alta energia + valência negativa → tenso, agressivo, sombrio',
    negative_low:  '↙ Baixa energia + valência negativa → melancólico, introspectivo',
    neutral:       '━ Zona neutra → equilibrado, modal, ambíguo',
  };
  document.getElementById('emoQuadrantInfo').textContent =
    quadNames[emo.quadrant] || '';

  // Redesenha o circumplex estático (só o ponto alvo, sem medição)
  const canvas = document.getElementById('circomplexCanvas');
  if(canvas && typeof drawCircumplexStatic === 'function'){
    drawCircumplexStatic(canvas, v, a);
  }
}

// Acende o chip da grade que está mais próximo dos sliders atuais
function highlightClosestChip(){
  const v = parseInt(document.getElementById('valenceSlider').value) / 100;
  const a = parseInt(document.getElementById('arousalSlider').value) / 100;
  let bestIdx = 0, bestDist = Infinity;
  EMOTION_PRESETS.forEach((ep, i) => {
    const d = Math.hypot(ep.valence - v, ep.arousal - a);
    if(d < bestDist){ bestDist = d; bestIdx = i; }
  });
  document.querySelectorAll('.emo-chip').forEach((chip, i) => {
    chip.classList.toggle('emo-chip-active', i === bestIdx);
  });
}

// Constrói a grade de chips de emoção
function buildEmotionGrid(){
  const grid = document.getElementById('emotionGrid');
  if(!grid) return;
  grid.innerHTML = '';

  EMOTION_PRESETS.forEach((ep, idx) => {
    const chip = document.createElement('button');
    chip.className   = 'emo-chip';
    chip.dataset.idx = idx;
    chip.innerHTML   = `<span class="emo-chip-emoji">${ep.emoji}</span><span class="emo-chip-label">${ep.label}</span>`;
    chip.title       = `Valência: ${ep.valence >= 0 ? '+' : ''}${ep.valence.toFixed(2)} | Arousal: ${ep.arousal.toFixed(2)}`;

    chip.addEventListener('click', () => {
      document.getElementById('valenceSlider').value = Math.round(ep.valence * 100);
      document.getElementById('arousalSlider').value = Math.round(ep.arousal * 100);
      updateEmotionDisplay();
      highlightClosestChip();

      // Remove active de todos, acende o clicado
      document.querySelectorAll('.emo-chip').forEach(c => c.classList.remove('emo-chip-active'));
      chip.classList.add('emo-chip-active');
    });

    grid.appendChild(chip);
  });
}

// Executa a geração emocional e atualiza a interface principal
function runEmotionalGenerate(){
  const v    = parseInt(document.getElementById('valenceSlider').value) / 100;
  const a    = parseInt(document.getElementById('arousalSlider').value) / 100;
  
  // LÊ OS VALORES DO NOVO PAINEL EMOCIONAL
  const emoBars = parseInt(document.getElementById('emoBars').value) || 8;
  const emoBpm  = parseInt(document.getElementById('emoBpm').value) || null;

  // Seed: automática ou fixada
  if(!document.getElementById('seedLock').checked){
    cfg.seed = Math.floor(Math.random() * 10000);
    document.getElementById('seedSlider').value    = cfg.seed;
    document.getElementById('seedVal').textContent = cfg.seed;
    document.getElementById('manualSeedInput').value = cfg.seed; // ADICIONE ESTA LINHA
  }

  stopAll();
  stopMidiPlayer();
  isImportedSong   = false;
  importedPrograms = null;

  // Gera passando o número de compassos customizado
  const song   = generateFromEmotion(v, a, cfg.seed, emoBars);
  
  // ── Humanização real: multiplica humanizeAmount por 1.8x quando botão ativo
  if (humanizeEnabled && song._cfg && song._cfg._emotion) {
    song._cfg._emotion.humanizeAmount = Math.min(0.25,
      (song._cfg._emotion.humanizeAmount || 0.06) * 1.8
    );
  }
  
  // Se o usuário digitou um BPM manual diferente da emoção, aplica ele:
  if (emoBpm) song._cfg.bpm = emoBpm;
  
  const mapped = song._cfg;

  // ... (o resto da função continua normal a partir daqui até a atualização do painel superior)
  // Espelha os parâmetros mapeados nos controles principais (mantém UI coerente)
  cfg.key       = mapped.key;
  cfg.scale     = mapped.scale;
  cfg.bpm       = mapped.bpm;
  cfg.prog      = mapped.prog;
  cfg.style     = mapped.style;
  cfg.drumStyle = mapped.drumStyle;

  document.getElementById('keySel').value       = mapped.key;
  document.getElementById('scaleSel').value     = mapped.scale;
  document.getElementById('bpmSlider').value    = mapped.bpm;
  document.getElementById('bpmVal').textContent = mapped.bpm;
  document.getElementById('styleSel').value     = mapped.style;
  document.getElementById('drumStyleSel').value = mapped.drumStyle;

// NOVA LÓGICA: Adiciona a opção de compasso no select global caso ela não exista
  let barsSel = document.getElementById('barsSel');
  if (![...barsSel.options].some(o => parseInt(o.value) === mapped.bars)) {
      barsSel.add(new Option(mapped.bars, mapped.bars));
  }
  barsSel.value = mapped.bars;
  cfg.bars = mapped.bars; 
  // Atualiza o state global
  currentSong = song;

  const canvas = document.getElementById('roll');
  canvas.width = canvas.offsetWidth || 900;
  drawRoll(currentSong);

  const total = currentSong.melody.length + currentSong.bass.length
              + currentSong.arp.length    + currentSong.drums.length;

  document.getElementById('infoKey').textContent   = NOTE_NAMES[mapped.key % 12];
  document.getElementById('infoScale').textContent = SCALES[mapped.scale].label;
  document.getElementById('infoBpm').textContent   = mapped.bpm;
  document.getElementById('infoSeed').textContent  = cfg.seed;
  document.getElementById('infoNotes').textContent = total;

  document.getElementById('playBtn').disabled = false;
  document.getElementById('midiBtn').disabled = false;
  document.getElementById('codeBtn').disabled = false;
  document.getElementById('codeWrap').classList.remove('open');
  document.getElementById('codePlaceholder').style.display = '';
  updatePlayUI();

  // ── Status enriquecido com parâmetros emocionais
  const statusMsg = buildStatusMsg(song, mapped.bpm, cfg.seed);
  const infoNotes = document.getElementById('infoNotes');
  if (infoNotes) infoNotes.title = statusMsg;

  // ── Loop infinito evolutivo: ativa se botão ligado
  if (loopInfinite && song._genome && song._cfg) {
    if (typeof startInfiniteMode === 'function') {
      startInfiniteMode(song._cfg, song._genome, song._memory || []);
    }
  }

  // Feedback visual no botão
  const btn = document.getElementById('emotionGenBtn');
  btn.textContent = '✅ GERADO!';
  setTimeout(() => { btn.textContent = '🎭 GERAR EMOCIONAL'; }, 1500);
}

// Registra todos os eventos do painel emocional
function buildEmotionPanel(){
  buildEmotionGrid();
  updateEmotionDisplay(); // estado inicial

  document.getElementById('valenceSlider').addEventListener('input', () => {
    updateEmotionDisplay();
    highlightClosestChip();
  });
  document.getElementById('arousalSlider').addEventListener('input', () => {
    updateEmotionDisplay();
    highlightClosestChip();
  });

  document.getElementById('emotionGenBtn').addEventListener('click', runEmotionalGenerate);

  document.getElementById('emotionRndBtn').addEventListener('click', () => {
    // Escolhe emoção aleatória da grade
    const idx  = Math.floor(Math.random() * EMOTION_PRESETS.length);
    const ep   = EMOTION_PRESETS[idx];
    document.getElementById('valenceSlider').value = Math.round(ep.valence * 100);
    document.getElementById('arousalSlider').value = Math.round(ep.arousal * 100);
    updateEmotionDisplay();
    highlightClosestChip();
  });

  // ── Toggle de humanização
  document.getElementById('humanizeBtn').addEventListener('click', () => {
    humanizeEnabled = !humanizeEnabled;  // flag declarada em audio.js

    const btn   = document.getElementById('humanizeBtn');
    const info  = document.getElementById('humanizeInfo');
    const label = document.getElementById('humanizeStatus');

    label.textContent    = humanizeEnabled ? 'ON' : 'OFF';
    btn.style.borderColor = humanizeEnabled ? 'var(--am)' : '';
    btn.style.color       = humanizeEnabled ? 'var(--am)' : '';
    btn.style.background  = humanizeEnabled ? 'rgba(255,176,0,0.08)' : '';
    info.style.display    = humanizeEnabled ? 'block' : 'none';

    // Mostra o amount calculado para o estado emocional atual
    if (humanizeEnabled) {
      const v   = parseInt(document.getElementById('valenceSlider').value) / 100;
      const a   = parseInt(document.getElementById('arousalSlider').value) / 100;
      const emo = new EmotionContext(v, a);
      document.getElementById('humanizeAmountDisp').textContent =
        (emo.humanizeAmount * 100).toFixed(0) + '%';
    }
  });

  // Highlight inicial
  highlightClosestChip();
}

// ================================================================
//  buildUI — controles principais (inalterado + chama buildEmotionPanel)
// ================================================================
function buildUI(){
  // ── Presets
  const pSel = document.getElementById('presetSel');
  for(const [k,v] of Object.entries(PRESETS)){
    const o = document.createElement('option');
    o.value=k; o.textContent=v.label;
    if(k==='overworld') o.selected=true;
    pSel.appendChild(o);
  }

  // ── Keys
  const kSel = document.getElementById('keySel');
  for(let n=48; n<=71; n++){
    const o = document.createElement('option');
    o.value=n; o.textContent=NOTE_NAMES[n%12]+Math.floor(n/12-1);
    if(n===60) o.selected=true;
    kSel.appendChild(o);
  }

  // ── Scales
  const scSel = document.getElementById('scaleSel');
  for(const [k,v] of Object.entries(SCALES)){
    const o = document.createElement('option');
    o.value=k; o.textContent=v.label;
    if(k==='major') o.selected=true;
    scSel.appendChild(o);
  }

  // ── Style Profiles
  const stSel = document.getElementById('styleSel');
  for(const [k,v] of Object.entries(STYLE_PROFILES)){
    const o = document.createElement('option');
    o.value=k; o.textContent=v.label;
    if(k==='heroic') o.selected=true;
    stSel.appendChild(o);
  }

  // ── Drum Styles
  const dsSel = document.getElementById('drumStyleSel');
  for(const [k,v] of Object.entries(DRUM_STYLES)){
    const o = document.createElement('option');
    o.value=k; o.textContent=v.label;
    if(k==='rock') o.selected=true;
    dsSel.appendChild(o);
  }

  // ── Eventos dos controles principais
  pSel.addEventListener('change', e => applyPreset(e.target.value));
  kSel.addEventListener('change', e => { cfg.key=parseInt(e.target.value); cfg.prog=PRESETS[cfg.preset].prog; });
  scSel.addEventListener('change', e => cfg.scale=e.target.value);
  document.getElementById('styleSel').addEventListener('change',    e => cfg.style=e.target.value);
  document.getElementById('drumStyleSel').addEventListener('change',e => cfg.drumStyle=e.target.value);
  document.getElementById('barsSel').addEventListener('change',     e => cfg.bars=parseInt(e.target.value));

  document.getElementById('bpmSlider').addEventListener('input', e => {
    cfg.bpm = parseInt(e.target.value);
    document.getElementById('bpmVal').textContent = cfg.bpm;
  });
  document.getElementById('seedSlider').addEventListener('input', e => {
    cfg.seed = parseInt(e.target.value);
    document.getElementById('seedVal').textContent = cfg.seed;
	document.getElementById('manualSeedInput').value = cfg.seed; // ADICIONE ESTA LINHA
  });

  // ── Track toggles
  document.querySelectorAll('.toggle').forEach(el => {
    el.addEventListener('click', () => {
      const t = el.dataset.track;
      cfg.tracks[t] = !cfg.tracks[t];
      el.classList.toggle('active', cfg.tracks[t]);
      if(currentSong) drawRoll(currentSong);
    });
  });

  // ── PRESET ALEATÓRIO
  document.getElementById('randomBtn').addEventListener('click', () => {
    const p = randomPreset();
    cfg.key=p.key; cfg.scale=p.scale; cfg.bpm=p.bpm;
    cfg.bars=p.bars; cfg.prog=p.prog; cfg.style=p.style; cfg.drumStyle=p.drumStyle;
    cfg.preset='overworld';
    document.getElementById('keySel').value       = p.key;
    document.getElementById('scaleSel').value     = p.scale;
    document.getElementById('bpmSlider').value    = p.bpm;
    document.getElementById('bpmVal').textContent = p.bpm;
    document.getElementById('barsSel').value      = p.bars;
    document.getElementById('styleSel').value     = p.style;
    document.getElementById('drumStyleSel').value = p.drumStyle;
  });

  // ── GERAR (modo clássico)
  document.getElementById('genBtn').addEventListener('click', () => {
    stopAll();
    stopMidiPlayer();
    isImportedSong   = false;
    importedPrograms = null;

    if(!document.getElementById('seedLock').checked){
      cfg.seed = Math.floor(Math.random() * 10000);
      document.getElementById('seedSlider').value    = cfg.seed;
      document.getElementById('seedVal').textContent = cfg.seed;
	  document.getElementById('manualSeedInput').value = cfg.seed; // ADICIONE ESTA LINHA
    }

    seedRng(cfg.seed + cfg.bpm + cfg.key + cfg.bars);
    currentSong = generate(cfg);

    const canvas = document.getElementById('roll');
    canvas.width = canvas.offsetWidth || 900;
    drawRoll(currentSong);

    const total = currentSong.melody.length + currentSong.bass.length
                + currentSong.arp.length    + currentSong.drums.length;
    document.getElementById('infoKey').textContent   = NOTE_NAMES[cfg.key%12];
    document.getElementById('infoScale').textContent = SCALES[cfg.scale].label;
    document.getElementById('infoBpm').textContent   = cfg.bpm;
    document.getElementById('infoSeed').textContent  = cfg.seed;
    document.getElementById('infoNotes').textContent = total;
    document.getElementById('infoNotes').title       = buildStatusMsg(currentSong, cfg.bpm, cfg.seed);

    document.getElementById('playBtn').disabled = false;
    document.getElementById('midiBtn').disabled = false;
    document.getElementById('codeBtn').disabled = false;
    document.getElementById('codeWrap').classList.remove('open');
    document.getElementById('codePlaceholder').style.display = '';
    updatePlayUI();

    // Loop infinito evolutivo no modo clássico
    if (loopInfinite && currentSong._genome && cfg) {
      if (typeof startInfiniteMode === 'function') {
        startInfiniteMode(cfg, currentSong._genome, currentSong._memory || []);
      }
    }
  });

  // ── PLAY / STOP
  document.getElementById('playBtn').addEventListener('click', () => {
    if(!currentSong) return;
    if(isImportedSong){
      importedSong = currentSong;
      playImported(currentSong, importedPrograms);
    } else {
      playAll(currentSong);
    }
    // Inicia análise emocional em tempo real
    if(typeof startAnalyzer === 'function'){
      setTimeout(startAnalyzer, 200); // aguarda o áudio iniciar
      _setAnalyzerStatus('▸ Analisando áudio em tempo real...');
    }
  });
  // Correção do PAUSE
  // ── PAUSE
  document.getElementById('pauseBtn').addEventListener('click', () => {
    if (isPaused) {
      resumeAudio();
    } else {
      pauseAudio();
    }
    updatePlayUI();
  });
  // Fim da inclusão
  
document.getElementById('stopBtn').addEventListener('click', () => {
    if (isPaused) resumeAudio(); // Retoma o tempo antes de desligar as notas
    
    if(isImportedSong){ stopMidiPlayer(); drawRoll(currentSong); }
    else               { stopAll();       drawRoll(currentSong); }
    
    // Para o analyzer
    if(typeof stopAnalyzer === 'function'){
      stopAnalyzer();
      _setAnalyzerStatus('■ Análise parada. Toque uma música para reiniciar.');
    }
    updatePlayUI(); // Atualiza a tela
  });

  // ── SALVAR MIDI
  document.getElementById('midiBtn').addEventListener('click', () => { if(currentSong) downloadMidi(currentSong); });

  // ── CÓDIGO PYTHON
  document.getElementById('codeBtn').addEventListener('click', () => {
    if(!currentSong) return;
    const wrap = document.getElementById('codeWrap');
    const ph   = document.getElementById('codePlaceholder');
    if(!wrap.classList.contains('open')){
      document.getElementById('codeOut').textContent = generatePythonCode(currentSong);
      wrap.classList.add('open'); ph.style.display='none';
    } else {
      wrap.classList.remove('open'); ph.style.display='';
    }
  });

  // ── COPIAR CÓDIGO
  document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('codeOut').textContent).then(() => {
      const ok = document.getElementById('copyOk');
      ok.style.display='block';
      setTimeout(()=>ok.style.display='none', 2000);
    });
  });

  // ── Resize do canvas
  window.addEventListener('resize', () => {
    if(currentSong){
      document.getElementById('roll').width = document.getElementById('roll').offsetWidth;
      drawRoll(currentSong, isPlaying ? undefined : -1);
    }
  });

  // ── ABRIR MIDI
  document.getElementById('loadMidiBtn').addEventListener('click', () => {
    document.getElementById('midiInput').click();
  });

  document.getElementById('midiInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const midiData    = new Midi(arrayBuffer);
      const importedSong = { melody:[], bass:[], arp:[], drums:[] };

      if(midiData.header.tempos.length > 0){
        cfg.bpm = Math.round(midiData.header.tempos[0].bpm);
        document.getElementById('bpmSlider').value    = cfg.bpm;
        document.getElementById('bpmVal').textContent = cfg.bpm;
      }

      const detectedPrograms = { melody:0, bass:32, arp:0 };

      midiData.tracks.forEach(track => {
        if(!track.notes || !track.notes.length) return;
        let targetTrack = 'melody';
        if(track.instrument && track.instrument.percussion)           targetTrack = 'drums';
        else if(track.instrument && track.instrument.number === 81)   targetTrack = 'bass';
        else if(track.instrument && track.instrument.number === 82)   targetTrack = 'arp';

        if(targetTrack !== 'drums' && track.instrument)
          detectedPrograms[targetTrack] = track.instrument.number || 0;

        track.notes.forEach(note => {
          importedSong[targetTrack].push({
            pitch:     note.midi,
            startBeat: note.ticks / midiData.header.ppq,
            duration:  note.durationTicks / midiData.header.ppq,
            velocity:  Math.round(note.velocity * 127),
            isDrum:    targetTrack === 'drums'
          });
        });
      });

      stopAll(); stopMidiPlayer();
      currentSong      = importedSong;
      isImportedSong   = true;
      importedPrograms = detectedPrograms;
      window.importedSong = currentSong;

      let maxBeat = 0;
      Object.values(currentSong).flat().forEach(n => {
        if(n.startBeat + n.duration > maxBeat) maxBeat = n.startBeat + n.duration;
      });
      cfg.bars = Math.max(4, Math.ceil(maxBeat / 4));
      document.getElementById('barsSel').value = cfg.bars;

      const canvas = document.getElementById('roll');
      canvas.width = canvas.offsetWidth || 900;
      drawRoll(currentSong);

      const totalNotes = Object.values(currentSong).flat().length;
      document.getElementById('infoNotes').textContent = totalNotes;
      document.getElementById('infoBpm').textContent   = cfg.bpm;
      document.getElementById('infoScale').textContent = 'IMPORTADA';
      document.getElementById('infoKey').textContent   = '--';

      document.getElementById('playBtn').disabled = false;
      document.getElementById('midiBtn').disabled = false;
      document.getElementById('codeBtn').disabled = false;
      document.getElementById('codePlaceholder').style.display = '';
      updatePlayUI();
	  
	// /////////////////////////////
	// ── ESPELHAMENTO DE SEED (NOVO) ──
	  const manualSeedInput = document.getElementById('manualSeedInput');
	  manualSeedInput.addEventListener('change', e => {
		let val = parseInt(e.target.value);
		if (isNaN(val) || val < 0) val = 0;
		if (val > 9999) val = 9999;
		e.target.value = val;
		cfg.seed = val;
		document.getElementById('seedSlider').value = val;
		document.getElementById('seedVal').textContent = val;
	  });

	  // Espelhar os dois checkboxes de "FIXAR"
	  const topSeedLock = document.getElementById('seedLock');
	  const bottomSeedLock = document.getElementById('manualSeedLock');

	  topSeedLock.addEventListener('change', e => {
		bottomSeedLock.checked = e.target.checked;
	  });
	  bottomSeedLock.addEventListener('change', e => {
		topSeedLock.checked = e.target.checked;
	  });
	////////////////////////////////////////

    } catch(err){
      alert('Erro ao ler o arquivo MIDI. O arquivo pode estar corrompido.');
      console.error(err);
    } finally {
      e.target.value = '';
    }
	
  });

  // ── Canvas e seek bar
  initCanvasEvents();
  initSeekBar();
  updatePlayUI();

  // ── Painel Emocional (Russell)
  buildEmotionPanel();
}

// ── Inicialização
buildUI();
setTimeout(() => {
  document.getElementById('roll').width = document.getElementById('roll').offsetWidth || 900;
  drawRoll(null);
}, 50);
