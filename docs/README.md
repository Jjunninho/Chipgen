# ⚡ CHIP·GEN
Motor de Composição Procedural e Emocional para trilhas sonoras de games

[![Demo](https://img.shields.io/badge/Demo-GitHub%20Pages-blue)](https://jjunninho.github.io/Chipgen/) [![Estado](https://img.shields.io/badge/status-beta-yellow)]() [![Licença](https://img.shields.io/badge/license-MIT-blue.svg)]()

Descrição
---------
CHIP·GEN é um laboratório interativo que combina geração procedural e modelos de IA para criar trilhas sonoras dinâmicas para videogames. O grande diferencial é o motor emocional: você define valência e ativação (arousal) e o sistema compõe músicas que seguem esse mapa afetivo em tempo real.

Destaques
---------
- Composição baseada no modelo de emoções de Russell (valência × ativação).
- Integração com Magenta.js / TensorFlow.js para expansão criativa via IA.
- Motor procedural com seeds reproduzíveis, presets de estilo e mixagem multicanal.
- Editor visual (Piano Roll) e exportação em MIDI.
- Geração automática de script Python para recriar estruturas fora do navegador.

Funcionalidades Principais
--------------------------
1. Sistema de Composição Emocional
   - Controle por sliders de Valência (positivo/negativo) e Energia (calmo/intenso).
   - Feedback em tempo real com desvio percentual em relação à emoção alvo.
   - Presets rápidos: Euphoric, Tense, Calm, Relaxed.

2. Integração com IA (Magenta)
   - Carregue modelos de melodia e bateria (RNN) direto no navegador.
   - Geração assistida para complementar ideias procedurais.

3. Geração Procedural e Customização
   - Presets de estilo, escalas e grooves.
   - Seed para recriar composições.
   - Controles separados para Melody, Bass, Arp e Drums.

4. Ferramentas de Exportação
   - Visualizador Piano Roll em tempo real.
   - Exportação para .mid.
   - Código Python gerado automaticamente para reprodução offline.

Tecnologias
-----------
- Magenta.js / TensorFlow.js
- Tone.js
- Web Audio API
- HTML5 Canvas
- JavaScript (ES6+)

Demo Rápida
-----------
Acesse a demo hospedada: https://jjunninho.github.io/Chipgen/

Guia Rápido — Uso (browser)
---------------------------
1. Abra a demo no navegador.
2. No modo "Procedural", escolha um estilo e clique em 🎲 GERAR.
3. No modo "Emocional", arraste o ponto no gráfico de Russell para alterar o clima sonoro.
4. Para usar IA: clique em ⚡ CARREGAR IA e selecione um modelo.
5. Exporte com 💾 SALVAR .MID quando satisfeito.

Instalação e Execução Local
---------------------------
Opção 1 — Projeto estático (rápido)
- Clone o repositório:
  git clone https://github.com/Jjunninho/Chipgen.git
  cd Chipgen
- Abra `index.html` em um navegador (recomendado servir por um servidor local para evitar problemas de CORS).

Opção 2 — Servidor local (recomendado)
- Python:
  python -m http.server 8000
  Acesse http://localhost:8000
- Node (se houver package.json):
  npm install
  npm start
  npm run dev

Configurações e Parâmetros
-------------------------
- seed: inteiro para reprodutibilidade.
- estilo: preset de timbre/ritmo.
- valência: [-1, 1] (negativo → positivo).
- energia/arousal: [0, 1] (calmo → intenso).
- opções de IA: selecione modelos Melody/Bass/Drums.

Recomendações de Uso
--------------------
- Teste seeds diferentes para explorar variações.
- Use presets emocionais para prototipagem rápida de trilhas.
- Combine geração procedural com trechos gerados por IA para resultados mais naturais.

Estrutura do Projeto (resumo)
-----------------------------
- /docs — documentação e README (este arquivo)
- /src — código-fonte do front-end (UI, gerador procedural, integração com Tone.js/Magenta)
- /assets — imagens, GIFs e exemplos
- /examples — presets e projetos de demonstração

Desenvolvimento
---------------
- Fork → branch (feature/<nome>) → PR
- Commit messages claros e atômicos
- Inclua screenshots ou GIFs em PRs quando alterar a UI/UX
- (Opcional) Adote ESLint/Prettier para padronização

Contribuindo
-----------
Contribuições são bem-vindas!
- Abra uma issue descrevendo a proposta antes de iniciar mudanças grandes.
- Para bugs pequenos ou docs, abra um PR diretamente.
- Adicione testes e documentação das novas features.

Licença
-------
Este projeto recomenda MIT. Ver arquivo LICENSE para detalhes.

Agradecimentos
--------------
- Projetos/tecnologias inspiradoras: Magenta, Tone.js e a comunidade de música generativa.
- Desenvolvido por [Jjunninho](https://github.com/Jjunninho)

Contato
-------
GitHub: https://github.com/Jjunninho
Email: (adicione seu contato, se desejar)

Notas finais
------------
Posso:
- Comitar esta versão em docs/README.md;
- Substituir o README na raiz do repositório;
- Adicionar badges dinâmicos (build, coverage) integrando CI;
- Gerar um CHANGELOG ou uma versão em inglês.

Diga qual ação deseja que eu execute.
