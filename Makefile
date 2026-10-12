# Makefile do BohTreinar (workout-app). O app roda na Cloudflare; Firebase fica com Auth e Firestore.

.PHONY: install dev build seed clean deploy deploy-rules deploy-redirect test-rules

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

# Hosting do Firebase: apenas redireciona para o endereço novo (mantém /__/auth/handler)
deploy-redirect:
	firebase deploy --only hosting

test-rules:
	firebase emulators:exec --only firestore --project demo-bohtreinar "cd rules-test && node --test firestore.rules.test.js"
