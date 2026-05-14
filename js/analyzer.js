// ================================================================
//  analyzer.js — Analisador Emocional em Tempo Real
//  Extrai features acústicas do sinal sintetizado pelo audio.js
//  e mapeia para (valence, arousal) no espaço de Russell
//
//  Não usa bibliotecas externas — só Web Audio API AnalyserNode
//
//  Features extraídas:
//    RMS             → amplitude/energia → arousal
//    Spectral Centroid → brilho tonal    → valence
//    ZCR             → cruzamentos/zero  → arousal (aux)
//
//  API pública:
//    initAnalyzer()           → cria/conecta o AnalyserNode
//    startAnalyzer()          → inicia loop de análise (RAF)
//    stopAnalyzer()           → para o loop
//    getEmotionEstimate()     → {valence, arousal, rms, centroid}
//    drawCircumplex(canvas)   → renderiza o visualizador
// ================================================================

'use strict';

// ── Estado do analyzer
let _analyserRaf    = null;
let _analyserActive = false;

// Buffers reutilizáveis (alocados em initAnalyzer)
let _timeBuf  = null;   // Float32Array — domínio do tempo
let _freqBuf  = null;   // Float32Array — domínio da frequência (dB)

// Estimativas suavizadas (exponential moving average)
let _smoothRms      = 0;
let _smoothCentroid = 0.5;  // normalizado [0,1]
let _smoothZcr      = 0;
const SMOOTH = 0.15;  // fator de suavização (0=sem suavização, 1=congela)

// Estimativa emocional atual
let _estimate = { valence: 0, arousal: 0.5, rms: 0, centroid: 0.5 };

// Histórico para calibração dinâmica (min/max observados)
let _rmsMin      = 0.0001;
let _rmsMax      = 0.05;
let _centMin     = 500;
let _centMax     = 4000;
const CALIB_RATE = 0.002;  // taxa de adaptação do range (lenta)

// ────────────────────────────────────────────────────────────────
//  initAnalyzer — conecta AnalyserNode ao masterAnalyser de audio.js
//  Deve ser chamado após getCtx() estar disponível
// ────────────────────────────────────────────────────────────────
function initAnalyzer() {
  if (!masterAnalyser) {
    console.warn('[analyzer] masterAnalyser não encontrado. Chame após audio.js carregar.');
    return false;
  }
  const fftSize = masterAnalyser.fftSize;  // 2048 definido em audio.js
  _timeBuf  = new Float32Array(fftSize);
  _freqBuf  = new Float32Array(masterAnalyser.frequencyBinCount);
  console.log('[analyzer] Inicializado. FFT size:', fftSize);
  return true;
}

// ────────────────────────────────────────────────────────────────
//  _extractFeatures — lê os buffers do AnalyserNode e computa
//  RMS, Spectral Centroid e ZCR
// ────────────────────────────────────────────────────────────────
function _extractFeatures() {
  if (!masterAnalyser || !_timeBuf) return null;

  masterAnalyser.getFloatTimeDomainData(_timeBuf);
  masterAnalyser.getFloatFrequencyData(_freqBuf);

  const ctx = getCtx();
  const sampleRate = ctx.sampleRate;
  const N    = _timeBuf.length;
  const Nf   = _freqBuf.length;

  // ── RMS (Root Mean Square) — energia do sinal
  let sumSq = 0;
  for (let i = 0; i < N; i++) sumSq += _timeBuf[i] * _timeBuf[i];
  const rms = Math.sqrt(sumSq / N);

  // ── ZCR (Zero Crossing Rate) — cruzamentos de zero por sample
  let zcr = 0;
  for (let i = 1; i < N; i++) {
    if ((_timeBuf[i] >= 0) !== (_timeBuf[i - 1] >= 0)) zcr++;
  }
  zcr /= N;

  // ── Spectral Centroid — "centro de gravidade" do espectro
  // Convertemos dB → magnitude linear antes de calcular
  let weightedSum = 0;
  let magSum      = 0;
  for (let k = 0; k < Nf; k++) {
    const mag  = Math.pow(10, _freqBuf[k] / 20);  // dB → linear
    const freq = (k / Nf) * (sampleRate / 2);       // bin → Hz
    weightedSum += freq * mag;
    magSum      += mag;
  }
  const centroid = magSum > 0 ? weightedSum / magSum : 0;

  return { rms, zcr, centroid };
}

// ────────────────────────────────────────────────────────────────
//  _mapToEmotion — converte features acústicas → (valence, arousal)
//
//  Arousal ← RMS (energia) + contribuição ZCR
//    Alto RMS + muitos ZCR = som energético → alto arousal
//
//  Valence ← Spectral Centroid normalizado
//    Centroid alto (espectro brilhante) → valência mais positiva
//    Centroid baixo (espectro escuro)   → valência mais negativa
//
//  Calibração dinâmica: min/max se adaptam ao longo da sessão
// ────────────────────────────────────────────────────────────────
function _mapToEmotion(rms, zcr, centroid) {
  // Atualiza range dinâmico lentamente
  if (rms > 0.0001) {
    _rmsMin = _rmsMin + CALIB_RATE * (Math.min(_rmsMin, rms * 0.3) - _rmsMin);
    _rmsMax = _rmsMax + CALIB_RATE * (Math.max(_rmsMax, rms * 1.5) - _rmsMax);
  }
  if (centroid > 10) {
    _centMin = _centMin + CALIB_RATE * (Math.min(_centMin, centroid * 0.5) - _centMin);
    _centMax = _centMax + CALIB_RATE * (Math.max(_centMax, centroid * 1.5) - _centMax);
  }

  // Normaliza RMS para [0,1]
  const rmsNorm = Math.max(0, Math.min(1,
    (rms - _rmsMin) / Math.max(_rmsMax - _rmsMin, 0.0001)
  ));

  // Normaliza Centroid para [0,1]
  const centNorm = Math.max(0, Math.min(1,
    (centroid - _centMin) / Math.max(_centMax - _centMin, 1)
  ));

  // Arousal = 70% RMS + 30% ZCR (ambos indicam energia)
  const arousal = Math.max(0, Math.min(1,
    0.70 * rmsNorm + 0.30 * Math.min(1, zcr * 20)
  ));

  // Valence = centroid normalizado mapeado de [0,1] → [-1,+1]
  // Sons brilhantes tendem a soar mais positivos (pesquisa perceptiva)
  const valence = Math.max(-1, Math.min(1,
    (centNorm - 0.5) * 2
  ));

  return { valence, arousal };
}

// ────────────────────────────────────────────────────────────────
//  getEmotionEstimate — retorna última estimativa suavizada
// ────────────────────────────────────────────────────────────────
function getEmotionEstimate() {
  return { ..._estimate };
}

// ────────────────────────────────────────────────────────────────
//  _analyserTick — chamado a cada frame pelo RAF loop
// ────────────────────────────────────────────────────────────────
function _analyserTick() {
  if (!_analyserActive) return;

  const features = _extractFeatures();
  if (features) {
    const { rms, zcr, centroid } = features;

    // Suavização exponencial
    _smoothRms      += SMOOTH * (rms      - _smoothRms);
    _smoothCentroid += SMOOTH * (centroid - _smoothCentroid);
    _smoothZcr      += SMOOTH * (zcr      - _smoothZcr);

    const em = _mapToEmotion(_smoothRms, _smoothZcr, _smoothCentroid);

    _estimate = {
      valence:  em.valence,
      arousal:  em.arousal,
      rms:      _smoothRms,
      centroid: _smoothCentroid,
      label:    describeEmotion(em.valence, em.arousal),
    };

    // Atualiza UI
    _updateAnalyzerUI();
  }

  _analyserRaf = requestAnimationFrame(_analyserTick);
}

// ────────────────────────────────────────────────────────────────
//  startAnalyzer / stopAnalyzer
// ────────────────────────────────────────────────────────────────
function startAnalyzer() {
  if (!_timeBuf && !initAnalyzer()) return;
  _analyserActive = true;
  cancelAnimationFrame(_analyserRaf);
  _analyserTick();
  console.log('[analyzer] Análise iniciada.');
}

function stopAnalyzer() {
  _analyserActive = false;
  cancelAnimationFrame(_analyserRaf);
  _analyserRaf = null;

  // Reseta display
  const canvas = document.getElementById('circomplexCanvas');
  if (canvas) {
    _drawCircumplex(canvas, null, null);
  }
  document.getElementById('analyzerMeasuredLabel').textContent = '—';
  document.getElementById('analyzerErrorDisp').textContent     = '—';
  document.getElementById('analyzerRmsDisp').textContent       = '—';
}

// ────────────────────────────────────────────────────────────────
//  _updateAnalyzerUI — atualiza canvas + labels a cada tick
// ────────────────────────────────────────────────────────────────
function _updateAnalyzerUI() {
  const canvas = document.getElementById('circomplexCanvas');
  if (!canvas) return;

  // Ponto alvo = posição dos sliders
  const tv = parseInt(document.getElementById('valenceSlider').value) / 100;
  const ta = parseInt(document.getElementById('arousalSlider').value) / 100;
  const target   = { valence: tv, arousal: ta };
  const measured = _estimate;

  _drawCircumplex(canvas, target, measured);

  // Labels textuais
  const mlEl = document.getElementById('analyzerMeasuredLabel');
  if (mlEl) mlEl.textContent = measured.label || '—';

  // Erro emocional
  const errEl = document.getElementById('analyzerErrorDisp');
  if (errEl) {
    const err = emotionError(target, measured);
    errEl.textContent = (err * 100).toFixed(0) + '%';
    errEl.style.color = err < 0.15 ? 'var(--g)' : err < 0.35 ? 'var(--am)' : 'var(--rd)';
  }

  // RMS
  const rmsEl = document.getElementById('analyzerRmsDisp');
  if (rmsEl) rmsEl.textContent = (_estimate.rms * 1000).toFixed(1);
}

// ────────────────────────────────────────────────────────────────
//  _drawCircumplex — renderiza o espaço emocional 2D
//
//  Canvas 200×180px:
//    X = valence  (-1 esquerda, +1 direita)
//    Y = arousal  (1 topo, 0 base) — invertido para Y crescer p/ cima
//
//  Elementos:
//    · Grade de quadrantes com labels
//    · Ponto verde = alvo (sliders)
//    · Ponto âmbar = medido (analyzer)
//    · Linha conectando os dois
//    · Rastro do ponto medido
// ────────────────────────────────────────────────────────────────
const _trail = [];   // histórico de posições medidas (max 40)
const TRAIL_MAX = 40;

function _drawCircumplex(canvas, target, measured) {
  const W  = canvas.width;
  const H  = canvas.height;
  const cx = canvas.getContext('2d');

  // Fundo
  cx.fillStyle = '#020902';
  cx.fillRect(0, 0, W, H);

  // Converte coordenadas emocionais → pixels
  // valence [-1,+1] → [pad, W-pad]
  // arousal [0,1]   → [H-pad, pad]  (invertido)
  const pad = 24;
  const vToX = v => pad + ((v + 1) / 2) * (W - pad * 2);
  const aToY = a => (H - pad) - a * (H - pad * 2);

  // ── Eixos
  const cx0 = vToX(0);
  const cy0 = aToY(0.5);

  cx.strokeStyle = '#003300';
  cx.lineWidth   = 0.8;

  // Vertical (valence=0)
  cx.beginPath(); cx.moveTo(cx0, pad); cx.lineTo(cx0, H - pad); cx.stroke();
  // Horizontal (arousal=0.5)
  cx.beginPath(); cx.moveTo(pad, cy0); cx.lineTo(W - pad, cy0); cx.stroke();

  // ── Labels de quadrante
  cx.font      = '5px "Press Start 2P", monospace';
  cx.fillStyle = '#004400';
  cx.textAlign = 'center';
  cx.fillText('⚡ EXCITADO',  vToX( 0.55), aToY(0.85));
  cx.fillText('😰 TENSO',     vToX(-0.55), aToY(0.85));
  cx.fillText('🌿 RELAXADO',  vToX( 0.55), aToY(0.12));
  cx.fillText('🌧 MELÂNC.',   vToX(-0.55), aToY(0.12));

  // ── Labels dos eixos
  cx.font      = '4px "Press Start 2P", monospace';
  cx.fillStyle = '#005500';
  cx.textAlign = 'center';
  cx.fillText('VALÊNCIA −',  pad + 10,      cy0 - 4);
  cx.fillText('VALÊNCIA +',  W - pad - 10,  cy0 - 4);
  cx.textAlign = 'right';
  cx.fillText('↑ ARS', cx0 - 4, pad + 8);
  cx.fillText('↓ ARS', cx0 - 4, H - pad - 4);

  // ── Borda
  cx.strokeStyle = '#003300';
  cx.lineWidth   = 1;
  cx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

  if (!target && !measured) return;

  // ── Rastro do ponto medido
  if (measured && _analyserActive) {
    _trail.push({ v: measured.valence, a: measured.arousal });
    if (_trail.length > TRAIL_MAX) _trail.shift();
  }
  for (let i = 0; i < _trail.length; i++) {
    const alpha = (i / _trail.length) * 0.35;
    cx.fillStyle = `rgba(255,176,0,${alpha})`;
    cx.beginPath();
    cx.arc(vToX(_trail[i].v), aToY(_trail[i].a), 2, 0, Math.PI * 2);
    cx.fill();
  }

  // ── Linha alvo → medido
  if (target && measured) {
    cx.strokeStyle = 'rgba(255,255,255,0.15)';
    cx.lineWidth   = 1;
    cx.setLineDash([3, 4]);
    cx.beginPath();
    cx.moveTo(vToX(target.valence),   aToY(target.arousal));
    cx.lineTo(vToX(measured.valence), aToY(measured.arousal));
    cx.stroke();
    cx.setLineDash([]);
  }

  // ── Ponto ALVO (verde)
  if (target) {
    const tx = vToX(target.valence);
    const ty = aToY(target.arousal);
    cx.fillStyle   = 'rgba(0,255,65,0.15)';
    cx.beginPath(); cx.arc(tx, ty, 10, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = '#00ff41';
    cx.lineWidth   = 1.5;
    cx.beginPath(); cx.arc(tx, ty, 7, 0, Math.PI * 2); cx.stroke();
    cx.fillStyle   = '#00ff41';
    cx.beginPath(); cx.arc(tx, ty, 3, 0, Math.PI * 2); cx.fill();
    // Label
    cx.font      = '5px "Press Start 2P", monospace';
    cx.fillStyle = '#00ff41';
    cx.textAlign = 'center';
    cx.fillText('ALVO', tx, ty - 11);
  }

  // ── Ponto MEDIDO (âmbar)
  if (measured && _analyserActive) {
    const mx = vToX(measured.valence);
    const my = aToY(measured.arousal);
    cx.fillStyle   = 'rgba(255,176,0,0.15)';
    cx.beginPath(); cx.arc(mx, my, 10, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = '#ffb000';
    cx.lineWidth   = 1.5;
    cx.beginPath(); cx.arc(mx, my, 7, 0, Math.PI * 2); cx.stroke();
    cx.fillStyle   = '#ffb000';
    cx.beginPath(); cx.arc(mx, my, 3, 0, Math.PI * 2); cx.fill();
    cx.font      = '5px "Press Start 2P", monospace';
    cx.fillStyle = '#ffb000';
    cx.textAlign = 'center';
    cx.fillText('REAL', mx, my - 11);
  }
}

// ────────────────────────────────────────────────────────────────
//  drawCircumplex — versão pública (chamada na init com target apenas)
// ────────────────────────────────────────────────────────────────
function drawCircumplexStatic(canvas, valence, arousal) {
  _drawCircumplex(canvas, { valence, arousal }, null);
}
