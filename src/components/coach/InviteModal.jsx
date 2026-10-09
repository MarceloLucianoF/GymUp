import React from 'react';
import toast from 'react-hot-toast';
import { Megaphone, Copy, Link2, X } from 'lucide-react';
import Modal from '../common/Modal';
import { btnPrimary, btnGhost } from './styles';

const copy = async (text, ok) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch (e) {
    toast.error('Não foi possível copiar.');
  }
};

// Convite de aluno: o aluno informa o código (UID do treinador) no cadastro.
export default function InviteModal({ onClose, coachCode }) {
  return (
    <Modal onClose={onClose} label="Vincular aluno" className="w-full max-w-md">
      <div className="surface relative bg-white p-6 dark:bg-gray-900 animate-scale-in">
        <button type="button" aria-label="Fechar" onClick={onClose} className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-brand/15 text-brand"><Megaphone className="h-8 w-8" /></span>
          <h3 className="font-display text-xl font-black text-gray-900 dark:text-white">Convidar aluno</h3>
          <p className="mt-1 text-sm text-gray-500">Envie o link ou o código para o aluno se vincular a você.</p>
        </div>
        <div className="mb-4 rounded-2xl bg-gray-100 p-4 text-center dark:bg-white/5">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">Seu código</p>
          <code className="break-all font-mono text-lg font-bold text-gray-900 dark:text-white select-all">{coachCode}</code>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => copy(coachCode, 'Código copiado!')} className={btnGhost}><Copy className="h-4 w-4" /> Copiar código</button>
          <button type="button" onClick={() => copy(`${window.location.origin}/register?coach=${coachCode}`, 'Link copiado!')} className={btnPrimary}><Link2 className="h-4 w-4" /> Copiar link</button>
        </div>
      </div>
    </Modal>
  );
}
