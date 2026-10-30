import React, { useState } from 'react';
import { Lock, Sparkles, X } from 'lucide-react';

// Aviso de novidade no Painel do treinador: aparece até ele fechar (guardado no aparelho, por treinador e por versão do aviso).
export const NOTICE_ID = 'compartilhamento-2026-10-30';
const keyFor = (uid) => `bt-coach-notice:${NOTICE_ID}:${uid}`;

const readSeen = (uid) => { try { return localStorage.getItem(keyFor(uid)) === '1'; } catch (_) { return false; } };

export default function CoachNotice({ uid }) {
  const [open, setOpen] = useState(() => !!uid && !readSeen(uid));
  if (!open) return null;
  const close = () => { try { localStorage.setItem(keyFor(uid), '1'); } catch (_) { /* navegação privada: fecha só nesta visita */ } setOpen(false); };

  return (
    <section className="surface relative space-y-3 border border-brand/30 p-5" aria-labelledby="coach-notice-title">
      <button type="button" onClick={close} aria-label="Fechar aviso" className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <h2 id="coach-notice-title" className="flex items-center gap-2 pr-10 font-display text-base font-black text-gray-900 dark:text-white">
        <Lock className="h-5 w-5 text-brand" aria-hidden="true" /> Novidade: o aluno escolhe o que você vê
      </h2>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Para proteger os dados dos alunos (LGPD), <b>peso, medidas e fotos de progresso</b> agora só aparecem depois que o aluno autorizar.
        Quem ainda não autorizou aparece com um cadeado na aba Evolução. Você continua vendo sempre os treinos concluídos, a fila de ação, o resumo e o chat.
      </p>
      <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
        <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><span>Com autorização, você vê os treinos que o aluno montou e a ordem da ficha dele (aba Treinos).</span></li>
        <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><span>Botão <b>Lembrar</b> para o aluno parado: ele recebe uma notificação sua, no máximo uma por dia.</span></li>
        <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><span>Avaliação física com análise por IA na aba Saúde.</span></li>
      </ul>
      <p className="rounded-2xl bg-brand/10 p-3 text-sm text-gray-800 dark:text-gray-100">
        <b>Como pedir a autorização:</b> o aluno abre Perfil › Treinador › "O que seu treinador vê" e liga o que quiser compartilhar.
      </p>
      <button type="button" onClick={close} className="pressable inline-flex min-h-[44px] items-center rounded-2xl bg-gray-100 px-4 text-sm font-bold text-gray-900 dark:bg-white/10 dark:text-white">Entendi</button>
    </section>
  );
}
