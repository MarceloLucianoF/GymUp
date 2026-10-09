"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { createNvidiaProxyHandler } = require("./lib/nvidiaProxy");

if (admin.apps.length === 0) admin.initializeApp();

const defaultAllowedOrigins = [
  "https://workout-tracker-app-20e43.web.app",
  "https://workout-tracker-app-20e43.firebaseapp.com",
  "http://localhost:3000"
];

const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const handler = createNvidiaProxyHandler({
  verifyIdToken: (token) => admin.auth().verifyIdToken(token, true),
  fetchImpl: (...args) => fetch(...args),
  getApiKey: () => process.env.NVIDIA_NIM_API_KEY,
  allowedOrigins: [...new Set([...defaultAllowedOrigins, ...configuredOrigins])],
  logger: functions.logger
});

exports.nvidiaProxy = functions
  .runWith({
    secrets: ["NVIDIA_NIM_API_KEY"],
    timeoutSeconds: 30,
    memory: "256MB",
    maxInstances: 10
  })
  .https.onRequest(handler);
