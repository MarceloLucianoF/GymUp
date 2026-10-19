# BohTreinar no iPhone e no iPad

## Como funciona hoje (aplicativo web instalável, PWA)
O app roda no iPhone e no iPad como aplicativo web instalado pelo Safari: **Compartilhar, Adicionar à Tela de Início**. Não passa pela App Store, não custa nada e atualiza sozinho. O iOS não tem botão de instalar nem o evento `beforeinstallprompt`, então o app orienta a pessoa:
- convite de instalação no iPhone/iPad (qualquer navegador de iOS) com o caminho em uma frase e o link **Ver o passo a passo**;
- página pública **/instalar** com os passos do iPhone/iPad e do Android (link no rodapé da página inicial);
- navegador embutido (Instagram, Facebook, WhatsApp etc.): avisa para abrir no Safari, porque ali não existe "Adicionar à Tela de Início".

### Preparado para o iOS
- `apple-touch-icon` 180x180 opaco, `apple-mobile-web-app-capable` e título.
- Barra de status do iOS opaca (`black`), para o conteúdo não ficar sob o relógio (a versão translúcida exigiria margem de segurança em todas as barras superiores).
- 15 imagens de abertura (`public/splash/`, fundo `#0B0F19` com o ícone) para iPhone e iPad em retrato, evitando o clarão branco ao abrir o aplicativo instalado.
- `format-detection` desligado (telefones não viram link) e `prefer_related_applications: false` no manifesto.
- Já existiam: áreas seguras (`env(safe-area-inset-*)`), campos de 16 px (sem zoom), `playsInline` nos vídeos, tela sempre ligada no treino (`Wake Lock`, iOS 16.4 ou mais novo) e funcionamento offline com Service Worker.

### Limites conhecidos do iOS
- A instalação é sempre manual (Safari). Em outros navegadores só funciona no iOS 16.4 ou mais novo.
- Notificações do navegador só existem para aplicativo instalado, no iOS 16.4 ou mais novo; vibração (`navigator.vibrate`) não existe no iOS.
- Áudio só toca depois de um toque na tela (regra do iOS); o aviso sonoro do descanso já parte de um toque do treino.
- Não foi possível testar em aparelho físico neste ambiente (sem macOS nem iPhone): a verificação foi feita com a interface do iPhone emulada (agente de usuário, tela 390x844) e testes automáticos.

## Aplicativo nativo na App Store (opcional, depois)
Só vale a pena se for preciso aparecer na loja, usar notificações push nativas ou recursos do aparelho. Caminho: empacotar o mesmo app com **Capacitor** (o código React continua o mesmo).
Requisitos que o ambiente atual não tem:
1. um Mac com Xcode para compilar e assinar;
2. conta **Apple Developer** (paga, anual);
3. revisão da Apple (política de privacidade pública, exclusão de conta dentro do app, que o app já tem, e rótulos de privacidade);
4. ícones e capturas de tela nas medidas da loja.
Passos previstos: `@capacitor/core` e `@capacitor/ios`, `npx cap add ios`, apontar `webDir` para `build/`, ajustar o login do Google (fluxo nativo) e o redirecionamento de e-mail do Firebase Auth, testar no simulador e enviar pelo TestFlight.
