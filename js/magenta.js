// ================================================================
//  magenta.js — Integração Magenta.js (MusicRNN + MusicVAE)
// ================================================================

let mgRNN      = null;   // MusicRNN  — continua melodia
let mgVAE      = null;   // MusicVAE  — bateria
let mgSong     = null;   // Música gerada pela IA
let mgMode     = 'melody';
let mgLoopTimer= null;
let mgCurrentModel = 'basic_rnn';

// ── Checkpoints disponíveis por modelo
const MELODY_CHECKPOINTS = {
  basic_rnn:            'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn',
  melody_rnn:           'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn',
  chord_pitches_improv: 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv',
};

const MELODY_LABELS = {
  basic_rnn:            'BASIC (rápido, ~30s)',
  melody_rnn:           'MELODY (equilibrado, ~1min)',
  chord_pitches_improv: 'IMPROV (qualidade máx, ~3min)',
};

const DRUMS_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/drums_2bar_lokl_small';

// ── Controla visibilidade do select de modelo (só no modo melody)
function updateModelSelVisibility(){
  const wrap = document.getElementById('mgModelWrap');
  if(wrap) wrap.style.display = mgMode === 'melody' ? '' : 'none';
}

// ── Mode toggle
document.querySelectorAll('.mg-opt').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.mg-opt').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    mgMode = el.dataset.mg;
    updateModelSelVisibility();
    mgStatus(`Modo: ${mgMode === 'melody' ? 'MELODIA' : 'BATERIA'}. Carregue o modelo.`, '');
    document.getElementById('mgLoadBtn').disabled = false;
    document.getElementById('mgLoadBtn').textContent = '⚡ CARREGAR IA';
    document.getElementById('mgGenBtn').disabled = true;
  });
});

// ── Troca de modelo — descarta instância atual e pede novo carregamento
document.getElementById('mgModelSel').addEventListener('change', e => {
  mgCurrentModel = e.target.value;
  // Reseta o estado em memória para evitar vazamentos (Memory Leaks)
  if(mgRNN){ 
    try { mgRNN.dispose(); } catch(err){} 
    mgRNN = null; 
  }
  
  document.getElementById('mgLoadBtn').disabled    = false;
  document.getElementById('mgLoadBtn').textContent = '⚡ CARREGAR IA';
  document.getElementById('mgGenBtn').disabled     = true;
  mgStatus(`Modelo: ${MELODY_LABELS[mgCurrentModel]}. Clique em CARREGAR IA.`, '');
});

document.getElementById('mgTemp').addEventListener('input', e => {
  document.getElementById('mgTempVal').textContent = parseFloat(e.target.value).toFixed(2);
});

// ── Helpers de UI
function mgStatus(msg, cls=''){
  const el = document.getElementById('mgStatus');
  el.textContent = '▸ ' + msg;
  el.className   = 'mg-status' + (cls ? ' '+cls : '');
}
function mgProgress(pct){
  const bar  = document.getElementById('mgBar');
  const fill = document.getElementById('mgBarFill');
  if(pct === null){ bar.style.display='none'; return; }
  bar.style.display = 'block';
  fill.style.width  = pct+'%';
}

// ── CARREGAR IA
document.getElementById('mgLoadBtn').addEventListener('click', async () => {
  if(typeof mm === 'undefined'){
    mgStatus('❌ Magenta não carregou. Use: python -m http.server 8000', 'err');
    return;
  }
  const btn = document.getElementById('mgLoadBtn');
  btn.disabled = true;
  mgProgress(10);

  try {
    if(mgMode === 'melody'){
      const modelKey    = mgCurrentModel || 'basic_rnn';
      const checkpoint  = MELODY_CHECKPOINTS[modelKey];
      const label       = MELODY_LABELS[modelKey];
      mgStatus(`Baixando ${label}... aguarde (pode demorar na 1ª vez)`, 'loading');
      
      if(mgRNN){ try{mgRNN.dispose();}catch(e){} mgRNN=null; }
      
      mgRNN = new mm.MusicRNN(checkpoint);
      mgProgress(30);
      await mgRNN.initialize();
    } else {
      mgStatus('Baixando MusicVAE (bateria)... aguarde', 'loading');
      if(mgVAE){ try{mgVAE.dispose();}catch(e){} mgVAE=null; }
      
      mgVAE = new mm.MusicVAE(DRUMS_CHECKPOINT);
      mgProgress(30);
      await mgVAE.initialize();
    }
    mgProgress(100);
    setTimeout(()=>mgProgress(null), 500);
    const loadedLabel = mgMode === 'melody'
      ? MELODY_LABELS[mgCurrentModel]
      : 'DRUMS VAE';
    mgStatus(`✅ ${loadedLabel} pronto! Gere uma música e clique em GERAR COM IA.`, 'ok');
    btn.textContent = '✅ IA PRONTA';
    document.getElementById('mgGenBtn').disabled = false;

  } catch(err){
    mgStatus('❌ Erro ao carregar: ' + err.message, 'err');
    mgProgress(null);
    btn.disabled = false;
  }
});

// Função que gera a música em pequenos pedaços para não travar o navegador
async function generateRNNChunked(inputSequence, totalSteps, temperature, chordProgression = undefined) {
    let currentContext = mm.sequences.clone(inputSequence);
    let stepsLeft = totalSteps;
    
    // Tamanho do "lote" (Ex: 32 steps = 2 compassos de 4/4)
    const CHUNK_SIZE = 32; 
    const totalToGenerate = totalSteps;

    // Conectando aos IDs originais do seu HTML (mgBar e mgBarFill)
    const progressBarContainer = document.getElementById('mgBar'); 
    const progressBarFill = document.getElementById('mgBarFill'); 
    
    if (progressBarContainer) progressBarContainer.style.display = 'block';
    if (progressBarFill) progressBarFill.style.width = '0%';

    while (stepsLeft > 0) {
        const stepsThisRound = Math.min(CHUNK_SIZE, stepsLeft);

        // Gera apenas um pequeno pedaço (passando acordes se existirem)
        let continuation;
        if (chordProgression) {
             continuation = await mgRNN.continueSequence(currentContext, stepsThisRound, temperature, chordProgression);
        } else {
             continuation = await mgRNN.continueSequence(currentContext, stepsThisRound, temperature);
        }

        // Junta o novo pedaço ao nosso contexto atual
        currentContext = mm.sequences.concatenate([currentContext, continuation]);

        stepsLeft -= stepsThisRound;

        // Calcula o progresso (de 0.0 a 1.0)
        const progress = 1 - (stepsLeft / totalToGenerate);
        const percent = Math.round(progress * 100);

        // Atualiza a interface visualmente
        if (progressBarFill) progressBarFill.style.width = percent + '%';
        
        // Dá feedback textual usando a função do projeto
        if (typeof mgStatus === 'function') {
            mgStatus(`Gerando IA: ${percent}% processado...`, 'warning');
        }

        // 🟢 A MÁGICA ACONTECE AQUI: Pausa de 10ms
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Esconde a barra quando terminar
    if (progressBarContainer) setTimeout(() => progressBarContainer.style.display = 'none', 500);

    return currentContext;
}

// ── Loopa um track (bass/arp/drums) para preencher uma seção de continuação
function loopTrackForContinuation(notes, srcBeats, destOffset, destBeats){
  if (!notes.length || srcBeats <= 0) return [];
  const result = [];
  for (let b = 0; b < destBeats; b += srcBeats){
    const chunkLen = Math.min(srcBeats, destBeats - b);
    notes.forEach(n => {
      if (n.startBeat < chunkLen){
        result.push({
          ...n,
          startBeat: destOffset + b + n.startBeat,
          duration:  Math.min(n.duration, chunkLen - n.startBeat)
        });
      }
    });
  }
  return result;
}

// ── Converte notas CHIP·GEN → NoteSequence quantizada (formato Magenta)
function toMelodySeq(notes, bars, bpm){
  const SPQ   = 4;               
  const total = bars * 4 * SPQ;
  const filtered = notes
    .filter(n => n.pitch >= 48 && n.pitch <= 83)
    .map(n => ({
      pitch:              n.pitch,
      quantizedStartStep: Math.round(n.startBeat * SPQ),
      quantizedEndStep:   Math.min(Math.round((n.startBeat + n.duration) * SPQ), total),
      velocity:           n.velocity || 80
    }))
    .filter(n => n.quantizedStartStep < n.quantizedEndStep && n.quantizedStartStep < total);

  return {
    totalQuantizedSteps: total,
    quantizationInfo:    { stepsPerQuarter: SPQ },
    tempos:              [{ time: 0, qpm: bpm }],
    notes:               filtered
  };
}

// ── Converte NoteSequence Magenta → notas CHIP·GEN
function fromMelodySeq(seq, offsetBeats=0){
  const SPQ = 4;
  return (seq.notes || [])
    .map(n => ({
      pitch:     n.pitch,
      startBeat: n.quantizedStartStep / SPQ + offsetBeats,
      duration:  Math.max(0.1, (n.quantizedEndStep - n.quantizedStartStep) / SPQ),
      velocity:  n.velocity || 80,
      isDrum:    false
    }))
    .filter(n => n.pitch >= 0);
}

function fromDrumSeq(seq){
  const SPQ      = 4;
  const DRUM_MAP = {0:36, 1:38, 2:42, 3:46, 4:41, 5:43, 6:45, 7:49, 8:51};
  return (seq.notes || []).map(n => ({
    pitch:     DRUM_MAP[n.pitch % 9] || 36,
    startBeat: n.quantizedStartStep / SPQ,
    duration:  0.1,
    velocity:  n.velocity || 80,
    isDrum:    true
  }));
}

// ── GERAR COM IA
document.getElementById('mgGenBtn').addEventListener('click', async () => {
  if(!currentSong){ mgStatus('❌ Gere uma música primeiro (botão GERAR)!', 'err'); return; }

  // Para o analyzer em tempo real para não competir com o TensorFlow (Magenta)
  if(typeof stopAnalyzer === 'function') stopAnalyzer();

  const genBtn     = document.getElementById('mgGenBtn');
  genBtn.disabled  = true;
  mgProgress(20);

  const temp       = parseFloat(document.getElementById('mgTemp').value);
  const totalBeats = cfg.bars * 4;
  const steps      = cfg.bars * 16;  

  try {
    if(mgMode === 'melody'){
      if(!mgRNN){ mgStatus('❌ Carregue o modelo MELODIA primeiro!', 'err'); genBtn.disabled=false; mgProgress(null); return; }

      const melNotes = currentSong.melody;
      if(!melNotes.length){ mgStatus('❌ Nenhuma nota de melodia encontrada.', 'err'); genBtn.disabled=false; mgProgress(null); return; }

      mgStatus('🤖 MusicRNN analisando e gerando continuação...', 'loading');
	  
	  const seedSeq = toMelodySeq(melNotes, cfg.bars, cfg.bpm);
		  
	let continuation;
      if (mgCurrentModel === 'chord_pitches_improv') {
        // 1. Traduz a lógica procedural do CHIP·GEN para Cifras (ex: "Cm", "F")
        const chordProgression = [];
        const NOTE_NAMES_EN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        const ivs = SCALES[cfg.scale].i;

        for (let bar = 0; bar < cfg.bars; bar++) {
          const deg = cfg.prog[bar % cfg.prog.length];
          const rootMidi = (cfg.key % 12 + ivs[deg]) % 12;
          const rootName = NOTE_NAMES_EN[rootMidi];

          // Descobre se o acorde é maior ou menor checando a terça (3 ou 4 semitons)
          const thirdDeg = (deg + 2) % ivs.length;
          const thirdMidi = (cfg.key % 12 + ivs[thirdDeg]) % 12;
          const diff = (thirdMidi - rootMidi + 12) % 12;
          
          const chordString = (diff === 3) ? rootName + 'm' : rootName;
          chordProgression.push(chordString);
        }
        
        console.log("[Magenta] Acordes injetados na IA:", chordProgression);
        // 2. Geração em lotes COM condicionamento de acordes
        continuation = await generateRNNChunked(seedSeq, steps, temp, chordProgression);
      } else {
        // 2. Geração em lotes SEM condicionamento (Modelos básicos)
        continuation = await generateRNNChunked(seedSeq, steps, temp);
      }
      
      mgProgress(80);

      const aiNotes  = fromMelodySeq(continuation, totalBeats);
      const aiBars   = Math.max(totalBeats,
        aiNotes.reduce((m,n) => Math.max(m, n.startBeat + n.duration - totalBeats), 0));

      const bassLoop = loopTrackForContinuation(currentSong.bass,  totalBeats, totalBeats, aiBars);
      const arpLoop  = loopTrackForContinuation(currentSong.arp,   totalBeats, totalBeats, aiBars);
      const drumLoop = loopTrackForContinuation(currentSong.drums, totalBeats, totalBeats, aiBars);

      mgSong = {
        melody: [...melNotes,        ...aiNotes],
        bass:   [...currentSong.bass, ...bassLoop],
        arp:    [...currentSong.arp,  ...arpLoop],
        drums:  [...currentSong.drums,...drumLoop]
      };
      mgStatus(`✅ MusicRNN: ${aiNotes.length} notas geradas + todos os tracks expandidos!`, 'ok');

    } else {
      if(!mgVAE){ mgStatus('❌ Carregue o modelo BATERIA primeiro!', 'err'); genBtn.disabled=false; mgProgress(null); return; }

      mgStatus('🤖 MusicVAE gerando padrão de bateria...', 'loading');
      const [sample]  = await mgVAE.sample(1, temp);
      mgProgress(80);

      const baseDrums = fromDrumSeq(sample);
      const aiDrums   = [];
      for(let bar=0; bar<cfg.bars; bar+=2){
        baseDrums.forEach(n => aiDrums.push({...n, startBeat: n.startBeat + bar*4}));
      }

      mgSong = {
        melody: currentSong.melody,
        bass:   currentSong.bass,
        arp:    currentSong.arp,
        drums:  aiDrums
      };
      mgStatus(`✅ MusicVAE gerou ${aiDrums.length} eventos de bateria!`, 'ok');
    }

    mgProgress(null);
    document.getElementById('mgPlayBtn').disabled = false;
    document.getElementById('mgMidiBtn').disabled = false;
    document.getElementById('mgStopBtn').disabled = true;

  } catch(err){
    mgStatus('❌ Erro: ' + err.message, 'err');
    mgProgress(null);
  }
  genBtn.disabled = false;
});

// ── STOP IA
document.getElementById('mgStopBtn').addEventListener('click', ()=>{
  stopAll();
  stopMidiPlayer();
  clearTimeout(mgLoopTimer);
  document.getElementById('mgPlayBtn').disabled = false;
  document.getElementById('mgStopBtn').disabled = true;
  mgStatus('■ Parado.', '');
  // Reseta seek bar
  if(typeof updateSeekBar === 'function'){
    updateSeekBar(0, cfg.bars * 4, cfg.bpm / 60);
  }
});

// ── PLAY IA 
document.getElementById('mgPlayBtn').addEventListener('click', () => {
  if(!mgSong) return;

  // Para os DOIS engines (evita dois áudios simultâneos)
  stopAll();
  stopMidiPlayer();

  const allNotes = [...mgSong.melody, ...mgSong.bass, ...mgSong.arp, ...mgSong.drums];
  const maxBeat  = allNotes.reduce((m,n) => Math.max(m, n.startBeat + n.duration), 0);

  currentSong    = mgSong;
  cfg.bars       = Math.max(cfg.bars, Math.ceil(maxBeat / 4));
  isImportedSong = false;   // IA usa audio.js, não player.js

  const canvas = document.getElementById('roll');
  canvas.width = canvas.offsetWidth || 900;
  drawRoll(currentSong);

  // Inicializa seek bar com duração total correta
  if(typeof updateSeekBar === 'function'){
    updateSeekBar(0, cfg.bars * 4, cfg.bpm / 60);
  }

  playAll(mgSong);

  document.getElementById('mgPlayBtn').disabled = true;
  document.getElementById('mgStopBtn').disabled = false;
  mgStatus('▶ Tocando música com continuação da IA...', 'ok');
});

// ── SALVAR .MID IA
document.getElementById('mgMidiBtn').addEventListener('click', () => {
  if(!mgSong) return;
  downloadMidi(mgSong, '_IA');
});

// ── Diagnóstico na inicialização
window.addEventListener('load', ()=>{
  updateModelSelVisibility();  
  setTimeout(()=>{
    if(typeof mm !== 'undefined' && mm.MusicRNN){
      mgStatus('✅ Magenta.js carregado! Escolha o modelo e clique em CARREGAR IA.', 'ok');
    } else {
      mgStatus('⚠️ Magenta não carregou. Use servidor HTTP: python -m http.server 8000', 'err');
    }
  }, 800);
});