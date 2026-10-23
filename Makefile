# Makefile do BohTreinar (workout-app). O app roda na Cloudflare; Firebase fica com Auth e Firestore.

.PHONY: install dev build seed clean deploy deploy-rules test-rules android-apk

install:
	npm install --legacy-peer-deps

dev:
	npm start

build:
	npm run build

seed:
	node scripts/seed.cjs

clean:
	rm -rf build
	rm -rf node_modules

# Publica o app (build + Worker da Cloudflare)
deploy:
	REACT_APP_NVIDIA_PROXY=true REACT_APP_AI_PRIMARY=nvidia npm run build && cd worker && npx wrangler deploy --config ../wrangler.jsonc

# Regras e índices do Firestore
deploy-rules:
	firebase deploy --only firestore:rules,firestore:indexes

test-rules:
	firebase emulators:exec --only firestore --project demo-bohtreinar "cd rules-test && node --test firestore.rules.test.js && node --test academy.rules.test.js"

# App Android (Capacitor): APK assinado com a chave de ~/bohtreinar-android (ver docs/APP_ANDROID.md)
android-apk:
	@test -f ~/bohtreinar-android/google-services.json || { echo 'Falta ~/bohtreinar-android/google-services.json (ver docs/APP_ANDROID.md): sem ele o app sai sem avisos.'; exit 1; }
	cp ~/bohtreinar-android/google-services.json android/app/google-services.json
	JAVA_HOME=$$HOME/android-tools/jdk/jdk-21.0.13+9 ANDROID_HOME=$$HOME/android-tools/sdk npx cap sync android
	cd android && JAVA_HOME=$$HOME/android-tools/jdk/jdk-21.0.13+9 ANDROID_HOME=$$HOME/android-tools/sdk ./gradlew assembleRelease --no-daemon -q
	@ls -la android/app/build/outputs/apk/release/app-release.apk

