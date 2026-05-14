# ⚡ CHIP·GEN

Gerador procedural de música de videogame com integração Magenta.js (IA).

## Como rodar

```bash
# Obrigatório: servidor HTTP (Magenta não funciona via file://)
cd chipgen/
python -m http.server 8000

# Abrir no browser:
# http://localhost:8000
```

---

## Estrutura do projeto

```
chipgen/
│
├── index.html          ← HTML puro (sem JS inline)
│
├── css/
│   └── style.css       ← Todos os estilos visuais
│
└── js/
    ├── theory.js       ← Teoria musical (escalas, geração de notas)
    ├── audio.js        ← Engine Web Audio (síntese chiptune)
    ├── pianoroll.js    ← Visualização canvas do piano roll
    ├── midi.js         ← Exportação MIDI + gerador de código Python
    ├── ui.js           ← Estado global (cfg) + eventos da interface
    └── magenta.js      ← Integração IA (MusicRNN + MusicVAE)
```

### Ordem de dependência dos módulos

```
theory.js
    ↓
audio.js  ──────────┐
    ↓               │
pianoroll.js        │  (todos dependem de cfg em ui.js,
    ↓               │   mas ui.js é carregado por último
midi.js             │   pois chama buildUI() que inicializa tudo)
    ↓               │
ui.js  ─────────────┘
    ↓
magenta.js   (depende de todos acima: cfg, scheduleNote, buildMidi, etc.)
```

---

## Módulos — responsabilidades

### `js/theory.js`
- Constantes: `SCALES`, `NOTE_NAMES`, `PRESETS`, `RHYTHMS`, `ARP_SHAPES`, `BASS_PATS`
- RNG determinístico: `seedRng()`, `rng()`, `ri()`, `pick()`
- Teoria musical: `scaleNotesList()`, `chordPCs()`, `chordTones()`
- **Geração**: `generate(cfg)` → `{melody, bass, arp, drums}`

**Para adicionar um novo preset:**
```js
// Em theory.js, dentro de PRESETS:
space: { label:'🚀 SPACE', key:62, scale:'lydian', bpm:90, bars:8, prog:[0,2,4,6] },
```

### `js/audio.js`
- Síntese chiptune via Web Audio API (square wave, triangle, noise)
- `scheduleNote(note, bps, startOffset, trackName)` — agenda uma nota
- `playAll(song)` — toca a música em loop
- `stopAll()` — para tudo

**Para adicionar um novo timbre:**
```js
// Em scheduleNote(), adicionar um novo trackName:
else if(trackName === 'lead'){
  osc.type = 'sawtooth';
  flt.frequency.value = 3000;
}
```

### `js/pianoroll.js`
- `drawRoll(song, playBeat)` — desenha as notas no canvas
- `animatePlayhead()` — anima o cursor durante reprodução
- `TCOLORS` — cores por trilha (altere aqui para mudar as cores)

### `js/midi.js`
- `buildMidi(song)` → `Uint8Array` com arquivo .mid binário
- `downloadMidi(song, suffix)` — dispara download
- `generatePythonCode(song)` → string com código Python (MIDIUtil)

### `js/ui.js`
- `cfg` — objeto de estado global (preset, key, scale, bpm, bars, seed, tracks)
- `buildUI()` — popula selects e registra todos os event listeners
- `applyPreset(name)` — atualiza cfg + DOM ao trocar preset
- `updatePlayUI()` — sincroniza botões com estado de reprodução

### `js/magenta.js`
- Integração com `mm.MusicRNN` (continuar melodia) e `mm.MusicVAE` (bateria)
- `toMelodySeq()` — converte notas CHIP·GEN → NoteSequence do Magenta
- `fromMelodySeq()` / `fromDrumSeq()` — converte de volta
- `mgSong` — música resultado da IA (mesma estrutura de `currentSong`)

---

## Ideias para próximas features

- [ ] **Mais escalas**: blues, whole-tone, diminuta
- [ ] **Novos presets**: underwater, sky, credits, boss2
- [ ] **Exportar WAV**: gravar o áudio gerado direto no browser
- [ ] **Magenta harmonize**: gerar acompanhamento harmônico para a melodia
- [ ] **Editor de progressão**: permitir editar `prog[]` visualmente
- [ ] **Efeitos**: reverb, delay, vibrato no engine de áudio
- [ ] **Visualizador de forma de onda**: osciloscópio estilo CRT
- [ ] **Múltiplas seeds**: gerar 4 variações e escolher a melhor
