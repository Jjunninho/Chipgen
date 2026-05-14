// ================================================================
//  pianoroll.js — Visualização do piano roll (Canvas 2D)
// ================================================================

const TCOLORS = {melody:'#00ff41', bass:'#ffb000', arp:'#00ffff', drums:'#ff3300', counter:'#ff88ff'};
let isDraggingPlayhead = false;
let seekBeat = 0;
let rafId = null;
let currentSong = null;

function drawRoll(song, playBeat=-1){
  const canvas = document.getElementById('roll');
  const W = canvas.width, H = canvas.height;
  const cx = canvas.getContext('2d');

  cx.fillStyle = '#000a00';
  cx.fillRect(0, 0, W, H);
  if(!song) return;

  const totalBeats = cfg.bars * 4;
  const minP=36, maxP=96, pRange=maxP-minP;

  for(let b=0; b<=cfg.bars; b++){
    const x = (b/cfg.bars)*W;
    cx.strokeStyle = b%4===0 ? '#005500' : '#001a00';
    cx.lineWidth   = b%4===0 ? 1.5 : .5;
    cx.beginPath(); cx.moveTo(x,0); cx.lineTo(x,H); cx.stroke();
  }

  for(let p=minP; p<=maxP; p++){
    if(p%12===0){
      const y = ((maxP-p)/pRange)*H;
      cx.strokeStyle='#002200'; cx.lineWidth=.5;
      cx.beginPath(); cx.moveTo(0,y); cx.lineTo(W,y); cx.stroke();
      cx.fillStyle='#003300'; cx.font='6px monospace';
      cx.fillText(`C${Math.floor(p/12)-1}`, 2, y-1);
    }
  }

  const order = ['counter','arp','bass','drums','melody'];
  for(const t of order){
    if(!cfg.tracks[t] || !song[t]) continue;
    cx.fillStyle = TCOLORS[t];
    for(const n of song[t]){
      const x  = (n.startBeat / totalBeats) * W;
      const w  = Math.max(2, (n.duration / totalBeats) * W - .5);
      const y  = ((maxP - n.pitch) / pRange) * H;
      const nh = Math.max(3, H/pRange*1.2);
      cx.globalAlpha = .82;
      cx.fillRect(x, y-nh/2, w, nh);
    }
  }
  cx.globalAlpha = 1;

  cx.font = '7px "Press Start 2P",monospace';
  cx.fillStyle = '#005a00';
  for(let b=0; b<cfg.bars; b++){
    cx.fillText(`${b+1}`, (b/cfg.bars)*W+3, H-4);
  }

  if(playBeat >= 0){
    const x = (playBeat / totalBeats) * W;
    cx.strokeStyle='rgba(255,255,255,.7)'; cx.lineWidth=1.5;
    cx.beginPath(); cx.moveTo(x,0); cx.lineTo(x,H); cx.stroke();
  }
}

function animatePlayhead(){
  cancelAnimationFrame(rafId);
  if(!isPlaying){ drawRoll(currentSong); return; }
  const ctx  = getCtx();
  const bps  = cfg.bpm / 60;
  const totalBeats = cfg.bars * 4;
  let beat = ((ctx.currentTime - playStart) * bps) % totalBeats;
  if(beat < 0) beat = 0;

  const bar     = Math.floor(beat/4) + 1;
  const beatNum = Math.floor(beat%4) + 1;
  document.getElementById('beatDisp').textContent =
    `BAR ${String(bar).padStart(2,'0')} BEAT ${beatNum}`;

  updateSeekBar(beat, totalBeats, bps);
  drawRoll(currentSong, beat);
  rafId = requestAnimationFrame(animatePlayhead);
}

// ── Seek bar helpers ──
function formatTime(beats, bpm){
  const sec = beats / (bpm / 60);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateSeekBar(currentBeat, totalBeats, bps){
  const pct = Math.min(100, (currentBeat / totalBeats) * 100);
  const fill  = document.getElementById('seekFill');
  const thumb = document.getElementById('seekThumb');
  const cur   = document.getElementById('seekCurrent');
  const tot   = document.getElementById('seekTotal');
  if(fill)  fill.style.width = pct + '%';
  if(thumb) thumb.style.left = pct + '%';
  if(cur)   cur.textContent  = formatTime(currentBeat, cfg.bpm);
  if(tot)   tot.textContent  = formatTime(totalBeats, cfg.bpm);
}

// ── Helper interno: para o engine correto e reinicia de um beat ──
function seekToBeat(beat){
  if(isImportedSong){
    // Para os DOIS engines antes (garante que nenhum sobrevive)
    stopMidiPlayer();
    stopAll();

    const totalBeats = importedMaxBeats || (cfg.bars * 4);
    const bps = cfg.bpm / 60;
    const ctx = getMidiCtx();
    if(ctx.state === 'suspended') ctx.resume();

    // Reconstrói allNotesSorted completo a partir de currentSong
    const trackDefs = {
      melody: { notes: currentSong.melody || [], prog: (currentPrograms && currentPrograms.melody) || 0  },
      bass:   { notes: currentSong.bass   || [], prog: (currentPrograms && currentPrograms.bass)   || 32 },
      arp:    { notes: currentSong.arp    || [], prog: (currentPrograms && currentPrograms.arp)    || 0  },
      drums:  { notes: currentSong.drums  || [], prog: 0 }
    };
    allNotesSorted = [];
    for(const [tname, t] of Object.entries(trackDefs)){
      if(!cfg.tracks[tname]) continue;
      for(const n of t.notes) allNotesSorted.push({ note:n, prog:t.prog, track:tname });
    }
    allNotesSorted.sort((a,b) => a.note.startBeat - b.note.startBeat);

    // Avança cursor para o ponto de seek
    schedCursor = allNotesSorted.findIndex(item => item.note.startBeat >= beat);
    if(schedCursor < 0) schedCursor = allNotesSorted.length;

    midiPlaying   = true;
    midiPlayStart = ctx.currentTime + 0.05 - (beat / bps);

    schedulerTick();
    midiSchedTimer = setInterval(schedulerTick, SCHEDULE_MS);
    updateMidiPlayerUI(true);
    animateMidiPlayhead();

  } else {
    // Música gerada: usa audio.js
    stopAll();
    playAllFrom(currentSong, beat);
  }
}

function initSeekBar(){
  const track = document.getElementById('seekTrack');
  if(!track) return;

  let dragging = false;

  const seekTo = (e) => {
    if(!currentSong) return;
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const totalBeats = isImportedSong
      ? (importedMaxBeats || cfg.bars * 4)
      : (cfg.bars * 4);
    const beat = pct * totalBeats;
    updateSeekBar(beat, totalBeats, cfg.bpm / 60);
    seekToBeat(beat);
  };

  track.addEventListener('mousedown', (e) => { dragging = true; seekTo(e); });
  window.addEventListener('mousemove', (e) => { if(dragging) seekTo(e); });
  window.addEventListener('mouseup',   ()  => { dragging = false; });
}

// ── Eventos do canvas (ponteiro / razor) ──
function initCanvasEvents() {
  const canvas = document.getElementById('roll');

  const getBeatFromX = (x) => {
    const W = canvas.width;
    const totalBeats = isImportedSong
      ? (importedMaxBeats || cfg.bars * 4)
      : (cfg.bars * 4);
    return Math.max(0, Math.min((x / W) * totalBeats, totalBeats));
  };

  canvas.addEventListener('mousedown', (e) => {
    if (!currentSong) return;
    const clickedBeat = getBeatFromX(e.offsetX);
    isDraggingPlayhead = true;
    if(isImportedSong){ stopMidiPlayer(); stopAll(); }
    else { stopAll(); }
    drawRoll(currentSong, clickedBeat);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDraggingPlayhead && currentSong) {
      const beat = getBeatFromX(e.offsetX);
      drawRoll(currentSong, beat);
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (isDraggingPlayhead && currentSong) {
      isDraggingPlayhead = false;
      seekBeat = getBeatFromX(e.offsetX);
      seekToBeat(seekBeat);
    }
  });
}

