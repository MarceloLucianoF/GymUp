import { ApiError } from '../http.js';
import { changed, getIdempotent, guarded, idempotencyCleanupStmt, idempotencyStmt, sha256Hex } from '../db.js';

const KEY_RE = /^[A-Za-z0-9_.:-]{8,64}$/;

/**
 * Operação repetível com Idempotency-Key obrigatória. `build()` valida e devolve { stmts, response, storable? }.
 * Dado e chave gravam no MESMO batch. Mesma chave + mesmo corpo devolve o resultado salvo; corpo diferente é 409.
 * `storable` é a versão do resultado que pode ficar no banco (sem segredos, como o código de um convite).
 */
export async function runIdempotent(ctx, scope, hashInput, build) {
  const key = ctx.request.headers.get('Idempotency-Key') || '';
  if (!KEY_RE.test(key)) throw new ApiError('idempotency_required');
  const requestHash = await sha256Hex(JSON.stringify(hashInput));
  const saved = await getIdempotent(ctx.db, scope, key, ctx.now);
  if (saved) {
    if (saved.request_hash !== requestHash) throw new ApiError('conflict');
    return JSON.parse(saved.response_json);   // repetição: mesmo resultado, nada novo é gravado
  }
  const { stmts, response, storable } = await build();
  let results;
  try {
    results = await guarded(() => ctx.db.batch([idempotencyCleanupStmt(ctx.db, ctx), ...stmts, idempotencyStmt(ctx.db, ctx, scope, key, requestHash, storable ?? response)]));
  } catch (error) {
    // Mesma chave em paralelo: a outra requisição ganhou a corrida. Devolve o resultado salvo se for o mesmo pedido.
    const winner = await getIdempotent(ctx.db, scope, key, ctx.now).catch(() => null);
    if (winner && winner.request_hash === requestHash) return JSON.parse(winner.response_json);
    throw error;
  }
  // A chave só é gravada se a operação de fato aconteceu (a última instrução da operação mudou 1 linha); senão nada mudou e é conflito.
  if (!changed(results, results.length - 1)) throw new ApiError('conflict');
  return response;
}

// "Escape" de LIKE para a busca por nome (o curinga do usuário não vira padrão).
export const likeEscape = (text) => text.replace(/[\\%_]/g, (c) => `\\${c}`);
