# Makefile interno para workout-app (AcademyUp)

.PHONY: install dev build seed clean deploy deploy-hosting deploy-functions deploy-rules deploy-all

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

deploy:
	npm run build && firebase deploy

deploy-hosting:
	npm run build && firebase deploy --only hosting

deploy-functions:
	firebase deploy --only functions

test-rules:
	firebase emulators:exec --only firestore --project demo-bohtreinar "cd rules-test && node --test firestore.rules.test.js"

deploy-rules:
	firebase deploy --only firestore:rules

deploy-all:
	npm run build && firebase deploy
