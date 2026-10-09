import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LOG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'audit.log');

// Registro local de toda escrita aplicada (sem dados sensíveis, apenas ação e ids).
export function audit(entry) {
  try {
    appendFileSync(LOG, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  } catch {
    // auditoria é best-effort
  }
}
