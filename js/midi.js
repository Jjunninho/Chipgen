// ================================================================
//  midi.js — Exportação MIDI binária + gerador de código Python
// ================================================================

function vlq(v){
  if(v < 128) return [v];
  const b = []; b.unshift(v & 0x7F); v >>= 7;
  while(v > 0){ b.unshift((v & 0x7F)|0x80); v >>= 7; }
  return b;
}

function wrapChunk(tag, data){
  const L = data.length;
  return [
    ...tag.split('').map(c => c.charCodeAt(0)),
    (L>>24)&0xFF, (L>>16)&0xFF, (L>>8)&0xFF, L&0xFF,
    ...data
  ];
}

function buildMidi(song){
  const ppqn = 480;
  const mpb  = Math.round(60000000 / cfg.bpm);

  const tracks = [];
  if(cfg.tracks.melody) tracks.push({notes:song.melody, ch:0, prog:80});
  if(cfg.tracks.bass)   tracks.push({notes:song.bass,   ch:1, prog:81});
  if(cfg.tracks.arp)    tracks.push({notes:song.arp,    ch:2, prog:82});
  if(cfg.tracks.drums)  tracks.push({notes:song.drums,  ch:9, prog:0 });

  const nTracks = tracks.length + 1;
  const header  = [
    0x4D,0x54,0x68,0x64, 0,0,0,6, 0,1,
    (nTracks>>8)&0xFF, nTracks&0xFF,
    (ppqn>>8)&0xFF, ppqn&0xFF
  ];

  const tempoData = [
    0,0xFF,0x58,4,4,2,0x18,8,
    0,0xFF,0x51,3, (mpb>>16)&0xFF,(mpb>>8)&0xFF,mpb&0xFF,
    0,0xFF,0x2F,0
  ];
  const tempoChunk = wrapChunk('MTrk', tempoData);

  const noteChunks = tracks.map(t => {
    const evs = [];
    evs.push({tick:0, bytes:[0xC0|t.ch, t.prog]});
    for(const n of t.notes){
      const t0 = Math.round(n.startBeat * ppqn);
      const t1 = Math.round((n.startBeat + n.duration) * ppqn);
      const v  = n.velocity || 100;
      evs.push({tick:t0, bytes:[0x90|t.ch, n.pitch, v]});
      evs.push({tick:t1, bytes:[0x80|t.ch, n.pitch, 0]});
    }
    evs.sort((a,b) => a.tick !== b.tick ? a.tick - b.tick : ((a.bytes[0]&0xF0)===0x80 ? -1 : 1));
    const tb = []; let cur = 0;
    for(const e of evs){ tb.push(...vlq(e.tick-cur), ...e.bytes); cur=e.tick; }
    tb.push(0,0xFF,0x2F,0);
    return wrapChunk('MTrk', tb);
  });

  return new Uint8Array([...header, ...tempoChunk, ...noteChunks.flat()]);
}

function downloadMidi(song, suffix=''){
  const data = buildMidi(song);
  const blob = new Blob([data], {type:'audio/midi'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `chipgen_${cfg.preset}_bpm${cfg.bpm}${suffix}.mid`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Gerador de código Python
function noteName(midi){
  return NOTE_NAMES[midi%12] + `${Math.floor(midi/12)-1}`;
}

function generatePythonCode(song){
  const p     = PRESETS[cfg.preset];
  const lines = [];
  const hr    = '# ' + '='.repeat(58);

  lines.push(hr);
  lines.push(`# CHIP·GEN — ${p.label}`);
  lines.push(`# Key: ${noteName(cfg.key)} | Escala: ${SCALES[cfg.scale].label}`);
  lines.push(`# BPM: ${cfg.bpm} | Compassos: ${cfg.bars} | Seed: ${cfg.seed}`);
  lines.push(hr);
  lines.push('# pip install MIDIUtil');
  lines.push('');
  lines.push('from midiutil import MIDIFile');
  lines.push('');
  lines.push(`BPM  = ${cfg.bpm}`);
  lines.push(`BARS = ${cfg.bars}`);
  lines.push('');

  function fmtTrack(notes, name){
    lines.push(`# ── ${name.toUpperCase()} (${notes.length} notas) ──`);
    lines.push(`${name} = [`);
    for(const n of notes){
      lines.push(`    (${n.pitch}, ${n.startBeat.toFixed(3)}, ${n.duration.toFixed(3)}, ${n.velocity||100}),  # ${noteName(n.pitch)}`);
    }
    lines.push(']'); lines.push('');
  }

  if(cfg.tracks.melody && song.melody.length) fmtTrack(song.melody, 'melody');
  if(cfg.tracks.bass   && song.bass.length)   fmtTrack(song.bass,   'bass');
  if(cfg.tracks.arp    && song.arp.length)     fmtTrack(song.arp,    'arp');
  if(cfg.tracks.drums  && song.drums.length)   fmtTrack(song.drums,  'drums');

  const activeTracks = [];
  if(cfg.tracks.melody) activeTracks.push(['melody',0]);
  if(cfg.tracks.bass)   activeTracks.push(['bass',1]);
  if(cfg.tracks.arp)    activeTracks.push(['arp',2]);
  if(cfg.tracks.drums)  activeTracks.push(['drums',9]);

  lines.push(`midi = MIDIFile(${activeTracks.length})`);
  lines.push('');
  activeTracks.forEach(([name, ch], idx)=>{
    lines.push(`midi.addTempo(${idx}, 0, BPM)`);
    if(name !== 'drums') lines.push(`midi.addProgramChange(${idx}, ${ch}, 0, ${name==='melody'?80:name==='bass'?81:82})`);
    lines.push(`for pitch, start, dur, vel in ${name}:`);
    lines.push(`    midi.addNote(${idx}, ${ch}, pitch, start, dur, vel)`);
    lines.push('');
  });

  lines.push(`with open("chipgen_${cfg.preset}.mid", "wb") as f:`);
  lines.push('    midi.writeFile(f)');
  lines.push(`print("✅ Salvo: chipgen_${cfg.preset}.mid")`);

  return lines.join('\n');
}
