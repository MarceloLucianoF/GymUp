# Roteiro: App Check (enforce) e proteção contra enumeração de e-mail

Escrito em 12/10/2026. Os passos de console são seus (eu não acesso o console do Firebase); o que dá para checar pelo código e pelo navegador está marcado como **verificado**.

## 1. Como está hoje
- **Provedor:** reCAPTCHA Enterprise (`ReCaptchaEnterpriseProvider`), renovação automática do token (`src/firebase/config.js`).
- **Quando inicia:** em telas públicas (`/`, `/login`, `/register`, termos…) 1,5 s depois do carregamento, para não pesar a primeira pintura; ao entrar/cadastrar (`ensureAppCheck`) e quando já existe sessão (`AuthContext`). Nas demais telas, no carregamento.
- **Chave pública:** vem de `REACT_APP_RECAPTCHA_SITE_KEY` (`.env.local`, lida no build). **Verificado:** o bundle publicado contém a chave (2 arquivos JS).
- **Cobertura:** Firestore, Auth e Firebase AI Logic (Gemini) passam pelo SDK e levam o token. **Não cobre:** o Worker de IA (`/api/nvidia`), que se protege por ID token + limite de chamadas; scripts e o MCP (Admin SDK ignoram App Check e as regras).
- **Verificado em navegador sem cabeça (Chrome headless, usuário de teste):** as chamadas do Auth saem com o cabeçalho `X-Firebase-AppCheck`. As do Firestore não mostraram o cabeçalho na captura, mas o transporte do Firestore (WebChannel) nem sempre o expõe como cabeçalho, então **isso não prova nada**: quem decide é o painel de métricas do console (passo 3).
- **Prazo que importa:** o Firebase AI Logic passa a exigir App Check a partir de **2/11/2026**.

## 2. Antes de olhar as métricas
1. Console Google Cloud / reCAPTCHA Enterprise → a chave da web precisa listar `bohtreinar.marcelo-labs.workers.dev` (e o domínio próprio, se um dia existir). Sem isso, tokens falham só em produção.
2. Firebase Console → App Check → Apps → o app web aparece como **Registered** (reCAPTCHA Enterprise).
3. Gere um **token de debug** (App Check → app → ⋮ → *Gerenciar tokens de debug*) para testes automatizados. Guarde fora do repositório. Nunca coloque no código nem no `.env` versionado.

## 3. Métricas: o que observar e quando liberar
Console → App Check → **APIs** → clique em cada produto e leia "Solicitações verificadas / não verificadas / de clientes desatualizados / inválidas".

| Produto | Critério para ligar o enforce |
| --- | --- |
| Firebase AI Logic (Gemini) | ≥ 99% verificadas por 7 dias seguidos. **Primeiro** (prazo 2/11) |
| Cloud Firestore | ≥ 99% verificadas por 7 dias, incluindo um fim de semana (pico de treino) |
| Authentication | ≥ 99% verificadas; ligue por último, se ligar (erro aqui impede entrar) |

Se houver "não verificadas" acima de 1%, investigue antes de ligar:
- **Clientes desatualizados:** PWA com versão antiga em cache (antes do App Check). O aviso de atualização resolve com o tempo; espere uma semana de uso real.
- **Bloqueador de anúncios / navegador embutido (Instagram, WhatsApp):** o script do reCAPTCHA não carrega. Esses usuários vão perder acesso quando o enforce ligar; decida se aceita.
- **Automação e scripts do cliente:** testes com token customizado no navegador (como os meus E2E) passam a falhar; use o token de debug (passo 6).
- **Aluno que treina offline por horas:** o token se renova ao voltar a rede; a fila de treinos (PR 60) reenvia depois, então não perde treino.

## 4. Ordem do enforce
1. **Firebase AI Logic** (até 2/11). Se algo der errado, o Coach IA mostra o erro padrão de indisponibilidade; o restante do app continua.
2. **Cloud Firestore.** É o de maior risco (o app inteiro lê e grava ali). Faça em horário de pouco uso, com o celular e o computador à mão.
3. **Authentication**, só se as métricas estiverem limpas. Opcional: Firestore e AI já fecham o principal.

Cada "Enforce" leva alguns minutos para valer. **Reversão:** o mesmo botão (Unenforce); volta em minutos.

## 5. Roteiro de fumaça depois de cada enforce
Com uma conta de aluno, uma de treinador e o admin (aba anônima, cache limpo):
1. Entrar com e-mail/senha e com Google; sair e entrar.
2. Aluno: Home carrega (treinos, histórico); concluir um treino; ver no histórico.
3. Treino offline: modo avião, concluir, voltar a rede e conferir o aviso "aguardando" → "sincronizado".
4. Amigos: abrir `/amigos`, buscar por @usuário.
5. Coach IA: gerar uma ficha (Gemini) e ver a resposta.
6. Treinador: lista de alunos; admin: painel.
7. Console → App Check → métricas: "não verificadas" ~0% nas 24 h seguintes. Se subir, **Unenforce** e investigue.

## 6. Testes automatizados depois do enforce
Navegador automatizado não passa no reCAPTCHA. Use o token de debug **antes** de a página carregar:
```js
await page.addInitScript((t) => { self.FIREBASE_APPCHECK_DEBUG_TOKEN = t; }, process.env.APPCHECK_DEBUG_TOKEN);
```
(o SDK lê essa variável global também no build de produção). O token vale só para o seu projeto; guarde em variável de ambiente local e revogue no console quando não precisar mais. Scripts com Admin SDK não são afetados.

## 7. Custos e limites
- reCAPTCHA Enterprise tem cota gratuita mensal de avaliações (confira o número atual no console do Google Cloud). Cada sessão renova o token a cada ~1 h; com poucos alunos fica longe do limite, mas olhe a tela de uso depois da primeira semana com enforce.
- App Check **não substitui** as regras do Firestore: ele atesta que a chamada vem do app; quem pode ler o quê continua sendo a regra.

## 8. Proteção contra enumeração de e-mail (Authentication)
Console → Authentication → Configurações → **Ações do usuário** → *Proteção contra enumeração de e-mail* → ativar.
- **Efeito:** login com e-mail inexistente ou senha errada devolve o mesmo erro (`auth/invalid-credential`); a recuperação de senha não diz se o e-mail existe.
- **Já feito no app (PR desta etapa):** o login mostra a mesma frase para e-mail inexistente e senha errada ("E-mail ou senha incorretos."); a recuperação de senha responde igual com ou sem conta ("Se o e-mail tiver conta, enviamos o link…"). Antes, "Email não cadastrado." e "Usuário não encontrado." revelavam quais e-mails tinham conta mesmo com a proteção desligada.
- **Não dá para esconder:** o cadastro com e-mail já usado ainda informa "Este email já está em uso." (o usuário precisa saber). Se quiser fechar isso também, o caminho é cadastro com confirmação por e-mail, que é uma mudança de produto.
- **Depois de ativar, teste:** login com e-mail que não existe; login com senha errada; "Esqueci a senha" com e-mail inexistente e com existente (os dois mostram a mesma tela); cadastro novo; login com Google.

## 9. Resumo do que fazer, em ordem
1. Conferir domínios da chave reCAPTCHA e o app registrado (seção 2).
2. Ativar a proteção contra enumeração de e-mail e testar (seção 8) — não depende de métricas.
3. Esperar 7 dias de métricas; ligar o enforce do AI Logic antes de 2/11; depois o Firestore; Auth por último (seções 3 e 4).
4. Fumaça após cada passo (seção 5); reverter se "não verificadas" subir.
