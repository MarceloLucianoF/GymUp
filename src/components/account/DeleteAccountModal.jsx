import React, { useState } from 'react';
import { AlertTriangle, Check, Loader2, Circle } from 'lucide-react';
import Modal from '../common/Modal';
import {
  DELETION_STEPS, deleteAccount, friendlyDeletionError, providerOf
} from '../../services/accountDeletion';

export const CONFIRM_WORD = 'EXCLUIR';

// Modal de exclusão definitiva da conta do aluno (LGPD): confirmação por texto + reautenticação.
export default function DeleteAccountModal({ user, onClose, onDeleted, onExport }) {
  const provider = providerOf(user);
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [steps, setSteps] = useState({});

  const needsPassword = provider === 'password';
  const unsupported = provider === 'unknown';
  const canSubmit = !running && !unsupported && typed.trim().toUpperCase() === CONFIRM_WORD && (!needsPassword || password.length > 0);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError('');
    setRunning(true);
    try {
      await deleteAccount({
        user,
        password,
        onStep: (id, status) => setSteps((current) => ({ ...current, [id]: status }))
      });
      onDeleted?.();
    } catch (err) {
      setError(friendlyDeletionError(err));
      setRunning(false);
    }
  };

  return (
    <Modal onClose={running ? () => {} : onClose} label="Excluir minha conta" className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500"><AlertTriangle className="h-6 w-6" aria-hidden="true" /></span>
          <div>
            <h2 className="font-display text-lg font-black text-gray-900 dark:text-white">Excluir minha conta</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Esta ação é <strong>definitiva</strong> e não pode ser desfeita.</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-2xl bg-gray-50 p-4 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">
          <p><strong className="text-gray-900 dark:text-white">Será apagado:</strong> seus treinos realizados, medidas, conversas (inclusive as mensagens do seu treinador nelas), fichas geradas por IA, as anotações privadas que seu treinador escreveu sobre você, seu perfil (com dados de mensalidade) e o login.</p>
          <p><strong className="text-gray-900 dark:text-white">Fora do nosso alcance:</strong> cópias que o seu treinador tenha exportado ou anotado fora do app (planilhas, WhatsApp). Para essas, fale com ele.</p>
          {onExport && <p>Antes de excluir, você pode <button type="button" onClick={onExport} className="font-bold text-amber-700 underline dark:text-brand">baixar uma cópia dos seus dados</button>.</p>}
        </div>

        {unsupported ? (
          <p role="alert" className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">Seu método de login não permite a exclusão automática. Fale com o suporte.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {needsPassword && (
              <div>
                <label htmlFor="del-password" className="mb-1 block text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Sua senha</label>
                <input id="del-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={running}
                  className="min-h-[48px] w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 outline-none focus:ring-2 focus:ring-rose-500 dark:border-white/10 dark:bg-white/5 dark:text-white" />
              </div>
            )}
            {provider === 'google' && <p className="text-xs text-gray-500 dark:text-gray-400">Vamos pedir para você confirmar com a sua conta Google.</p>}
            <div>
              <label htmlFor="del-confirm" className="mb-1 block text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Digite {CONFIRM_WORD} para confirmar</label>
              <input id="del-confirm" type="text" autoComplete="off" autoCapitalize="characters" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={running} placeholder={CONFIRM_WORD}
                className="min-h-[48px] w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 outline-none focus:ring-2 focus:ring-rose-500 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </div>
          </div>
        )}

        {running && (
          <ol className="mt-4 space-y-1.5" aria-live="polite" aria-label="Progresso da exclusão">
            {DELETION_STEPS.map(({ id, label }) => {
              const status = steps[id];
              return (
                <li key={id} className={`flex items-center gap-2 text-sm ${status === 'done' ? 'text-emerald-600' : status === 'error' ? 'text-rose-600' : status === 'running' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                  {status === 'done' ? <Check className="h-4 w-4" aria-hidden="true" /> : status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
                  {label}
                </li>
              );
            })}
          </ol>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300">{error}</p>}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={running} className="pressable min-h-[48px] rounded-2xl border border-gray-200 px-5 text-sm font-bold text-gray-700 disabled:opacity-50 dark:border-white/15 dark:text-gray-200">Cancelar</button>
          <button type="submit" disabled={!canSubmit} aria-busy={running} className="pressable min-h-[48px] rounded-2xl bg-rose-600 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
            {running ? 'Excluindo...' : 'Excluir definitivamente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
