# ⚡ CHIP·GEN — Motor de Composição Procedural e Emocional

O **CHIP·GEN** é um laboratório avançado de inteligência artificial e geração procedural voltado para a criação de trilhas sonoras de videogame. O diferencial deste motor é a sua capacidade de compor música não apenas com base em algoritmos matemáticos, mas também através de **estados emocionais** e modelos de **deep learning**.

## 🚀 Funcionalidades Únicas

### 1. Sistema de Composição Emocional (Russell Circumplex)
Baseado no modelo de valência e ativação (Arousal) de James Russell, o motor permite:
- **Mapeamento Afetivo:** Gere músicas ajustando os sliders de Valência (Positivo/Negativo) e Energia (Calmo/Intenso).
- **Análise em Tempo Real:** O sistema analisa o áudio gerado e compara com a "emoção alvo", exibindo o desvio percentual em tempo real.
- **Presets de Emoção:** Botões rápidos para estados como *Euphoric, Tense, Calm* e *Relaxed*.

### 2. Integração com IA (Google Magenta)
Utiliza redes neurais recorrentes (RNN) para expandir a criatividade:
- **Modelos de Melodia e Bateria:** Carregue modelos de IA (Basic, Melody ou Improv) diretamente no navegador.
- **Geração Assistida:** Use a IA para criar trechos que complementam a base procedural.

### 3. Geração Procedural e Customização
- **Motor de Estilos:** Escolha entre diferentes presets, escalas musicais e grooves de bateria.
- **Variação por Seed:** Sistema de sementes para garantir que uma composição específica possa ser recriada ou modificada.
- **Mixagem Multicanal:** Controles independentes para Melody, Bass, Arp e Drums.

### 4. Ferramentas de Exportação
- **Piano Roll:** Visualização em tempo real das notas geradas.
- **Exportação MIDI:** Salve suas criações em arquivos `.mid` prontos para uso em qualquer DAW.
- **Recriação em Python:** O sistema gera automaticamente o código Python necessário para recriar a estrutura da música fora do navegador.

## 🛠️ Tecnologias Utilizadas

- **Magenta.js / TensorFlow.js:** Para os modelos de inteligência artificial musical.
- **Tone.js:** Framework principal para síntese de áudio e agendamento rítmico.
- **Web Audio API:** Para análise de sinal (RMS e energia) e processamento de efeitos.
- **HTML5 Canvas:** Interface gráfica para o Piano Roll e o gráfico de análise emocional.

## 🎮 Como Usar

1. Acesse o [CHIP·GEN Core](https://jjunninho.github.io/Chipgen/).
2. No **Modo Procedural**, escolha um estilo e clique em **🎲 GERAR**.
3. Experimente o **Modo Emocional** arrastando o ponto no gráfico de Russell para mudar o "clima" da música instantaneamente.
4. Clique em **⚡ CARREGAR IA** para usar os modelos de redes neurais.
5. Quando estiver satisfeito, clique em **💾 SALVAR .MID**.

---
Desenvolvido por [Jjunninho](https://github.com/Jjunninho)
