# CHIP·GEN — Prompt de Contexto para Continuação

## O que é o projeto

CHIP·GEN é um gerador procedural de música de videogame que roda no browser. Gera melodia, baixo, arpejo e bateria em estilo chiptune, toca via Web Audio API, exporta MIDI binário e tem integração com Magenta.js para continuar a melodia usando IA (MusicRNN) ou gerar bateria nova (MusicVAE). Possui um editor de piano roll standalone completo com ferramentas de desenho, seleção, corte e edição de notas. Possui também um sistema completo de composição emocional baseado no **Modelo de Circumplex de Russell (1980)**, com análise acústica em tempo real.

---

## Estrutura de arquivos

```
chipgen/
├── chipgen_v9.html       ← HTML principal do gerador
├── editor.html           ← Editor de piano roll standalone
├── css/
│   ├── style.css         ← Visual estilo terminal verde (Press Start 2P)
│   └── editor.css        ← Estilos do editor de notas
└── js/
    ├── theory.js         ← Escalas, presets, RNG, geração de notas
    ├── theory_russel.js  ← NOVO: Camada emocional (Russell Circumplex Model)
    ├── audio.js          ← Síntese chiptune + masterAnalyser + humanizeSong
    ├── analyzer.js       ← NOVO: Análise acústica em tempo real (RMS/ZCR/Centroid)
    ├── pianoroll.js      ← Visualização canvas + seek bar + playhead drag
    ├── midi.js           ← Exportação .mid binária + código Python
    ├── ui.js             ← Estado global (cfg) + eventos + painel emocional
    ├── magenta.js        ← Integração IA (MusicRNN + MusicVAE)
    ├── player.js         ← Engine de playback para MIDIs importados
    └── editor/           ← Módulos do editor standalone
        ├── editor_state.js
        ├── editor_canvas.js
        ├── editor_audio.js
        ├── editor_midi.js
        └── editor_ui.js
```

**Ordem de carregamento no chipgen_v9.html:**
`theory` → `theory_russel` → `audio` → `analyzer` → `player` → `pianoroll` → `midi` → `ui` → `magenta`

⚠️ `theory_russel.js` deve carregar APÓS `theory.js` pois depende de `generate()` e `seedRng()`.
⚠️ `analyzer.js` deve carregar APÓS `audio.js` pois depende de `masterAnalyser` e `getCtx()`.

---

## Estrutura de dados central

```js
// Estado global em ui.js
const cfg = {
  preset: 'overworld',
  key: 60,              // MIDI note (60 = C4)
  scale: 'major',
  bpm: 160,
  bars: 8,
  seed: 42,
  prog: [0,3,4,0],
  style: 'heroic',
  drumStyle: 'rock',
  tracks: { melody:true, bass:true, arp:true, drums:true }
};

// Música — estrutura padrão em todos os contextos
{
  melody: [ {pitch, startBeat, duration, velocity}, ... ],
  bass:   [ ... ],
  arp:    [ ... ],
  drums:  [ {pitch, startBeat, duration, velocity, isDrum:true}, ... ],
  // Metadados emocionais (presente quando gerado via theory_russel.js)
  _emotion: {
    valence, arousal, emotionStrength,
    ascBias, dissonance, tension,
    humanizeAmount, emotionalMomentum,
    label, quadrant
  },
  _cfg: { /* cfg completo que gerou a música */ }
}
```

---

## Módulos novos

### theory_russel.js (v2)
Implementa o **Modelo de Circumplex de Russell (1980)** como camada de mapeamento
entre coordenadas emocionais e parâmetros musicais.

**Eixos:**
- `valence  ∈ [-1.0, +1.0]` — negativo = triste/tenso, positivo = alegre
- `arousal  ∈ [ 0.0,  1.0]` — baixo = calmo, alto = energético

**Classe principal — `EmotionContext(valence, arousal, emotionStrength=1.0)`:**
```js
const emo = new EmotionContext(0.7, 0.8);
// emo.bpm          → calculado com curva exponencial easeIn(a, 1.2)
// emo.scaleName    → seleção por fit ponderado α*|v| + β*a  (α=0.6, β=0.4)
// emo.styleName    → STYLE_PROFILE do quadrante
// emo.drumStyle    → DRUM_STYLE do quadrante
// emo.prog         → progressão por tensão = 1 - |valence|
// emo.key          → tônica (tons brilhantes para v+, escuros para v-)
// emo.tension      → 1 - |v|  (valência extrema = harmonia limpa)
// emo.ascBias      → (v+1)/2  direção melódica 0=desce, 1=sobe
// emo.dissonance   → cromatismo crescente com valência negativa
// emo.humanizeAmount → lerp(0.15, 0.02, a)  baixo arousal = mais rubato
// emo.emotionalMomentum → vetor de evolução temporal intra-música
// emo.label        → "emoji NOME" (ex: "🦸 HEROIC")
```

**Melhorias v2 sobre v1:**
- Quadrante por **distância contínua** aos centros (elimina corte binário em arousal=0.5)
- BPM com **curva exponencial** `easeIn(a, 1.2)` — mais natural que linear
- **Seleção de escala ponderada:** `fit = 0.6*|v| + 0.4*a` — arousal co-influencia escolha modal
- **`emotionStrength`** — mistura emocional: `bpm = lerp(120, bpmEmocional, strength)`
- **`humanizeAmount`** — preparado para humanização via Magenta
- **`emotionalMomentum`** — vetor de evolução temporal (futuro: crescendo progressivo)
- **`emotionError` ponderado** — `wv*|dv| + wa*|da|` com arousal dominante (wa=0.6)

**API pública:**
```js
generateFromEmotion(v, a, seed, bars, emotionStrength?)  → song
generateCalibrated(v, a, seed, bars, analyzerFn?, maxIter?, weights?, threshold?) → song
emotionFromPresetName('boss')   → {valence: -0.8, arousal: 0.95}
describeEmotion(v, a)           → "😱 TERROR"
emotionError(target, measured, weights?) → number
getEmotionQuadrant(v, a)        → 'positive_high' | 'negative_low' | etc.
```

**Constantes expostas:**
- `EMOTION_PRESETS` — 16 emoções predefinidas para a grade UI (4×4)
- `EMOTION_QUADRANTS` — 21 rótulos com centros (vc, ac) para `describeEmotion()`
- `QUADRANT_CENTERS` — 5 centros para `getEmotionQuadrant()`
- `PRESET_EMOTION_MAP` — 16 presets clássicos → coordenadas (v,a)
- `PROGRESSIONS` — 4 pools (consonant/moderate/tense/dissonant)
- `EMOTION_SCALES`, `EMOTION_STYLES`, `EMOTION_DRUMS` — tabelas por quadrante

---

### analyzer.js
Análise acústica em tempo real usando o `AnalyserNode` da Web Audio API.
**Zero dependências externas** — não usa Meyda nem bibliotecas de terceiros.

**Features extraídas a cada frame (RAF):**
| Feature | Cálculo | Uso emocional |
|---------|---------|---------------|
| RMS | `sqrt(mean(x²))` | → arousal (energia) |
| Spectral Centroid | `Σ(freq*mag) / Σ(mag)` | → valence (brilho) |
| ZCR | cruzamentos de zero / N | → arousal auxiliar |

**Mapeamento para Russell:**
```
arousal  = 0.70 * rmsNorm + 0.30 * min(1, zcr*20)
valence  = (centroidNorm - 0.5) * 2   → [-1, +1]
```

**Calibração dinâmica:** min/max de RMS e Centroid se adaptam à sessão automaticamente
com taxa `CALIB_RATE = 0.002` — funciona mesmo com volume baixo.

**Suavização:** exponential moving average com fator `SMOOTH = 0.15`.

**API pública:**
```js
initAnalyzer()          → boolean  (conecta ao masterAnalyser)
startAnalyzer()         → inicia RAF loop + atualiza UI a cada frame
stopAnalyzer()          → para RAF, limpa canvas, reseta labels
getEmotionEstimate()    → {valence, arousal, rms, centroid, label}
drawCircumplexStatic(canvas, v, a)  → desenha só o ponto alvo (sem análise)
```

**Visualizador (`_drawCircumplex`):**
- Canvas 220×180px no painel emocional
- **Ponto verde** = emoção alvo (posição dos sliders)
- **Ponto âmbar** = emoção medida do áudio em tempo real
- **Rastro âmbar** = histórico dos últimos 40 frames (`_trail[]`)
- **Linha pontilhada** = desvio alvo → medido
- Labels de quadrante e eixos em pixel font

**Integração com `generateCalibrated()`:**
```js
// analyzerFn pronta para uso:
const song = generateCalibrated(0.7, 0.8, 42, 8, getEmotionEstimate, 5);
// Gera 5 variações, retorna a mais próxima da emoção alvo
```

---

## Módulos modificados

### audio.js
**Adições:**

**`masterAnalyser`** — AnalyserNode global criado junto com o AudioContext:
```js
masterAnalyser = audioCtx.createAnalyser();
masterAnalyser.fftSize = 2048;
masterAnalyser.smoothingTimeConstant = 0.5;
masterAnalyser.connect(audioCtx.destination);
// Todos os gains conectam a masterAnalyser, não diretamente ao destination
gain.connect(masterAnalyser || ctx.destination);
```
Isso permite `analyzer.js` capturar o sinal sem modificar o grafo de áudio existente.

**`humanizeSong(song, amount)`** — aplica microvariações expressivas:
```js
// amount = EmotionContext.humanizeAmount  ∈ [0.02, 0.15]
// Notas tonais (melody, bass, arp):
//   startBeat ± amount beats         (timing jitter — rubato)
//   velocity  ± amount*30            (dinâmica expressiva)
//   duration  * (1 ± amount*0.08)    (respiração das notas)
// Drums:
//   velocity  ± amount*12 apenas     (groove preservado)
```
- Nunca modifica a song original — retorna deep clone
- RNG determinístico baseado no número de notas (mesma música = mesma humanização)

**`humanizeEnabled`** — flag global controlada pelo toggle da UI.
Aplicada automaticamente em `playAllFrom()` antes do scheduleNote.

---

### ui.js
**Adições:**

**`buildEmotionPanel()`** — registra todos os eventos do painel Russell:
- Sliders VALÊNCIA e AROUSAL → `updateEmotionDisplay()` + `highlightClosestChip()`
- Grade 4×4 de `EMOTION_PRESETS` → clique move sliders + atualiza display
- Botão **🎭 GERAR EMOCIONAL** → `runEmotionalGenerate()`
- Botão **🎲 EMOÇÃO ALEATÓRIA** → escolhe preset aleatório da grade
- Botão **🎻 HUMANIZAR: OFF/ON** → toggle `humanizeEnabled` + exibe `humanizeAmount`

**`updateEmotionDisplay()`** — sincronização em tempo real dos sliders:
- Atualiza label, BPM, escala, estilo, drums, tensão, key
- Cor dinâmica do rótulo por quadrante (amarelo/verde/vermelho/azul/âmbar)
- Redesenha circumplex estático via `drawCircumplexStatic()`

**`runEmotionalGenerate()`** — geração emocional principal:
- Lê sliders → `generateFromEmotion(v, a, seed, bars)`
- Espelha parâmetros mapeados de volta para os controles do painel CONFIGURAÇÃO
- Atualiza `currentSong`, `drawRoll()`, info display

**Play/Stop com analyzer:**
```js
// playBtn → startAnalyzer() após 200ms (aguarda áudio iniciar)
// stopBtn → stopAnalyzer() + mensagem de status
```

**`_setAnalyzerStatus(msg)`** — helper para atualizar o label de status do analyzer.

---

## Painel Emocional — Fluxo do usuário

```
1. Ajusta sliders VALÊNCIA (-1 a +1) e AROUSAL (0 a 1)
   → display atualiza: label, BPM, escala, estilo, drums, tensão, key
   → circumplex mostra ponto alvo (verde)

2. Ou clica numa das 16 emoções da grade (BATTLE CRY, SERENE, TERROR...)
   → sliders saltam para as coordenadas do preset
   → chip mais próximo fica destacado (âmbar)

3. Clica 🎭 GERAR EMOCIONAL
   → theory_russel.js mapeia (v,a) → cfg musical
   → generate(cfg) cria a música
   → parâmetros aparecem também no painel CONFIGURAÇÃO (espelho)
   → piano roll atualiza

4. Clica ▶ PLAY
   → analyzer.js inicia análise acústica em tempo real
   → circumplex mostra ponto medido (âmbar) se movendo
   → DESVIO DO ALVO mostra % de erro (verde <15%, amarelo <35%, vermelho >35%)

5. Toggle 🎻 HUMANIZAR ON
   → próximo PLAY aplica microvariações de timing + velocity + duração
   → amount calculado automaticamente pelo arousal atual
   → baixo arousal = mais rubato | alto arousal = mais mecânico
```

---

## Módulos — o que cada um faz (resumo completo)

### theory.js (inalterado)
- `SCALES` — escalas com intervalos
- `PRESETS`, `STYLE_PROFILES`, `DRUM_STYLES` — perfis de geração
- `seedRng(s)` / `rng()` / `ri(a,b)` / `pick(arr)` — RNG determinístico
- `generate(cfg)` → `{melody, bass, arp, drums}` — ponto de entrada
- `genMelody()`, `genBass()`, `genArp()`, `genDrums()` — geradores por trilha

### pianoroll.js (inalterado)
- `drawRoll(song, playBeat)` — renderiza canvas
- `animatePlayhead()` — RAF + `updateSeekBar()`
- `initSeekBar()` / `seekToBeat(beat)` — controle de seek

### midi.js (inalterado)
- `buildMidi(song)` → `Uint8Array` — arquivo .mid binário
- `downloadMidi(song, suffix)` — download
- `generatePythonCode(song)` → string Python

### player.js (inalterado)
- Lookahead scheduler para MIDIs importados
- `playImported()` / `stopMidiPlayer()` / `animateMidiPlayhead()`

### magenta.js (inalterado)
- MusicRNN: `continueSequence()` — continua melodia
- MusicVAE: `sample()` — gera bateria
- `toMelodySeq()` / `fromMelodySeq()` / `fromDrumSeq()` — conversores de formato

---

## Editor standalone (inalterado)

### Ferramentas
| Tecla | Ferramenta | Comportamento |
|-------|-----------|---------------|
| D | ✏️ DRAW | Clique-drag pinta notas |
| E | 🗑 ERASE | Clique apaga nota |
| S | 👆 SELECT | Seleciona, move, redimensiona |
| R | ✂️ RAZOR | Divide notas ou corta regiões |

### Integração bidirecional com CHIP·GEN
```
CHIP·GEN → Editor:
  openEditor() → localStorage('chipgen_import') → window.open('editor.html')

Editor → CHIP·GEN:
  sendToChipgen() → localStorage('chipgen_import') → redirect

CHIP·GEN auto-reload:
  window.addEventListener('focus', verifica localStorage)
```

---

## Bugs corrigidos (versões anteriores)

1. **midi.js — sort de eventos** — precedência de operador JS quebrava MIDIs gerados
2. **editor_audio.js — reset do cache** — `._keys` virava `undefined` após `playNodes=[]`
3. **editor.html — ordem de scripts** — `editor_audio` carregava antes de `editor_canvas`
4. **editor_midi.js — sort** — mesmo bug do midi.js original
5. **editor (monolítico) — playback de MIDIs grandes** — schedule-all substituído por lookahead

---

## Decisões de arquitetura importantes

**theory_russel.js não modifica theory.js** — é uma camada wrapper pura. `generate(cfg)` é chamado normalmente; o módulo Russell apenas prepara o cfg com parâmetros emocionalmente calibrados.

**analyzer.js não usa bibliotecas externas** — features extraídas diretamente do `AnalyserNode` da Web Audio API. Meyda.js seria mais preciso mas adicionaria dependência desnecessária.

**masterAnalyser como ponto de interceptação** — todos os `gain` nodes conectam ao `masterAnalyser` que conecta ao `destination`. O sinal de áudio não é alterado; o analyzer só "escuta". Retrocompatível com player.js e magenta.js.

**humanizeSong retorna deep clone** — a song original nunca é modificada. A versão humanizada existe só durante o playback, o que permite desligar a humanização a qualquer momento.

**RNG determinístico na humanização** — baseado em `song.melody.length`, garantindo que a mesma música humanize sempre da mesma forma (reprodutível).

**generateCalibrated() aguarda analyzerFn** — a função está implementada e funcional, mas `analyzerFn = null` por padrão. A integração total (loop fechado) seria: `generateCalibrated(v, a, seed, bars, getEmotionEstimate, 5)` — gera 5 seeds, retorna a música cuja análise acústica ficou mais próxima da emoção alvo.

---

## Como rodar

```bash
cd chipgen/
python -m http.server 8000
# abrir http://localhost:8000
```

Magenta **não funciona via file://** — obrigatório servidor HTTP por causa de CORS.

---

## Próximas ideias

### Sistema Russell (próximos passos naturais)
- **Loop fechado completo** — conectar `getEmotionEstimate` ao `generateCalibrated()` para busca automática de seed
- **`emotionStrength` slider na UI** — controle de intensidade da influência emocional (0=neutro, 1=máximo)
- **Emotion timeline** — emoção evolui ao longo dos compassos usando `emotionalMomentum`
- **Preset reverse mapping** — ao selecionar preset clássico (ex: "BOSS"), exibir sua posição no circumplex
- **Export com metadados** — incluir (v,a) nos comentários do código Python gerado

### Audio / Síntese
- Exportar WAV direto no browser (OfflineAudioContext)
- Reverb e delay (ConvolverNode / DelayNode)
- Visualizador de osciloscópio estilo CRT
- Velocity editor no piano roll

### Geração
- Novas escalas: blues `[0,3,5,6,7,10]`, whole-tone `[0,2,4,6,8,10]`
- Gerar 4 variações de seed e deixar o usuário escolher
- Modo "battle of the bands": duas gerações side-by-side

### Editor
- Copy/paste de notas entre tracks
- Preview de nota durante o drag
- Velocity editor (barras abaixo das notas)
