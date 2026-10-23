# App Android (Capacitor): como funciona e como gerar

Fase 1 do [plano](PLANO_APP_ANDROID.md), em 23/10/2026.

## Como o app funciona
- **Capacitor 8**, pacote `dev.marcelolabs.bohtreinar`, nome "BohTreinar". O app abre o site publicado (`server.url` em `capacitor.config.json`): toda publicação do site chega ao app sem precisar de app novo. Sem internet, o service worker do site serve o que já estiver guardado.
- **Login com Google:** usa a conta Google do celular (`@capacitor-firebase/authentication`), porque o Google bloqueia o popup dentro de apps; a credencial entra no Firebase da web e o resto do app continua igual (`src/services/nativeApp.js`). E-mail e senha funcionam como no site. A exclusão de conta também confirma a identidade pela conta do celular.
- **Avisos:** no app não existe Web Push nem notificação do navegador; o sino do treino e o interruptor do Perfil ligam os avisos nativos pelo **FCM** (`@capacitor/push-notifications`, canal "Treino e amigos"). O Worker envia pelo FCM HTTP v1 (`worker/src/fcm.js`) com a conta de serviço `bohtreinar-fcm` (papel único: Firebase Cloud Messaging Admin), cuja chave está só no segredo `FCM_SERVICE_ACCOUNT_JSON`. Tocar no aviso abre a tela certa.
- **Identificação:** o app acrescenta `BohTreinarApp/1` ao user agent do WebView.

## Onde ficam as coisas (fora do git)
| Item | Lugar |
| --- | --- |
| Chave de assinatura | `~/bohtreinar-android/release.jks` + `keystore.pass` (permissão 600). **Guardar backup**: sem ela não dá para atualizar o app na Play (a Play App Signing guarda a chave de publicação, mas a de envio também precisa ser preservada). |
| `google-services.json` | `~/bohtreinar-android/google-services.json`; copiar para `android/app/` antes do build (o arquivo está no `.gitignore`). Baixar de novo: `npx firebase apps:sdkconfig ANDROID 1:701946803421:android:ba09dadb36477bf05f1734 --project workout-tracker-app-20e43 -o android/app/google-services.json` |
| Java 21 e Android SDK | `~/android-tools/jdk/...` e `~/android-tools/sdk` |

## Gerar o APK
```bash
make android-apk
```
Gera `android/app/build/outputs/apk/release/app-release.apk` (assinado). Para instalar no celular: enviar o arquivo e abrir (permitir "instalar apps desconhecidos" para o app usado), ou `adb install -r` com a depuração USB/Wi-Fi ligada.

## Play Store (fase 4)
- Gerar o pacote da loja: `cd android && ./gradlew bundleRelease` (`.aab`).
- Ao ativar a Play App Signing, cadastrar no Firebase a impressão digital SHA-1 da chave da Play (Play Console → Integridade do app), senão o login com Google falha na versão da loja.
- Conta pessoal: teste fechado com 12 testadores por 14 dias antes da produção.

## Limites desta fase
- Sem cronômetro na notificação e sem Samsung Health (fases 2 e 3).
- O app depende do site no ar; sem internet no primeiro uso, não abre.
- O conteúdo embutido no APK é só `mobile-shell/` (página "Sem conexão"); o app carrega o site publicado.
- **Ponte nativa e o site:** como o app abre o site publicado, um XSS no site poderia chamar os plugins nativos (login Google, avisos). Mantemos só esses dois plugins; antes da Play Store, avaliar uma Content-Security-Policy no Worker.
- Backup do Android desligado (`allowBackup=false`): o login e o cache do WebView não vão para o backup do Google.
- Antes da loja: ligar `minifyEnabled` e separar a senha da chave da senha do keystore.

