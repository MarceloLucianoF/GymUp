import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { aiService } from './aiService';
import { aiMessages, factsHash, localNarrative, narrativeMatchesFacts } from '../utils/weeklySummary';

// Narrativa do resumo semanal. Os números já vieram de utils/weeklySummary (determinísticos); aqui só se decide o TEXTO:
// o guardado (mesmos números), o da IA (validado contra os números) ou o local. Nada daqui altera metas, treinos ou permissões.

export const snapshotId = (uid, weekKey) => `${uid}_${weekKey}`;
const FAIL_TTL_MS = 6 * 3_600_000;
const failKey = (uid, hash) => `bt_summary_ai_fail_${uid}_${hash}`;

const storage = () => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch (e) { return null; } };
const recentlyFailed = (uid, hash, now, store = storage()) => { try { return now - (Number(store?.getItem(failKey(uid, hash))) || 0) < FAIL_TTL_MS; } catch (e) { return false; } };
const markFailed = (uid, hash, now, store = storage()) => { try { store?.setItem(failKey(uid, hash), String(now)); } catch (e) { /* sem storage */ } };

export async function loadSnapshot(uid, weekKey) {
  const snap = await getDoc(doc(db, 'weeklySummaries', snapshotId(uid, weekKey)));
  return snap.exists() ? snap.data() : null;
}

export async function saveSnapshot(uid, facts, text, source, now = new Date()) {
  await setDoc(doc(db, 'weeklySummaries', snapshotId(uid, facts.weekKey)), {
    uid, weekKey: facts.weekKey, factsHash: factsHash(facts), text, source, facts, updatedAt: now.toISOString()
  });
}

/** Texto da IA já validado, ou null. */
export async function aiNarrative(facts, ai = aiService) {
  const text = await ai.summarizeFacts(aiMessages(facts));
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean && narrativeMatchesFacts(clean, facts) ? clean : null;
}

/**
 * @returns {{text, source:'local'|'ai'|'saved-ai'|'saved-local', hash}} nunca lança.
 * Não gera de novo enquanto os números forem os mesmos (snapshot) nem tenta a IA de novo por 6 h depois de uma falha.
 */
export async function resolveNarrative(uid, facts, { ai = aiService, load = loadSnapshot, save = saveSnapshot, now = Date.now(), store } = {}) {
  const local = localNarrative(facts);
  const hash = factsHash(facts);
  let snap = null;
  try { snap = await load(uid, facts.weekKey); } catch (e) { snap = null; }
  if (snap && snap.factsHash === hash && typeof snap.text === 'string' && snap.text) return { text: snap.text, source: snap.source === 'ai' ? 'saved-ai' : 'saved-local', hash };
  if (facts.workouts === 0) return { text: local, source: 'local', hash };            // sem treinos: nada a pedir à IA
  if (recentlyFailed(uid, hash, now, store)) return { text: local, source: 'local', hash };
  const text = await aiNarrative(facts, ai).catch(() => null);
  if (text) {
    try { await save(uid, facts, text, 'ai', new Date(now)); } catch (e) { /* o texto continua valendo nesta sessão */ }
    return { text, source: 'ai', hash };
  }
  markFailed(uid, hash, now, store);
  if (facts.closed) { try { await save(uid, facts, local, 'local', new Date(now)); } catch (e) { /* ignora */ } }   // semana fechada: guarda o resumo local
  return { text: local, source: 'local', hash };
}
