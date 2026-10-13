import React from 'react';
import { Link } from 'react-router-dom';
import { Users, ChevronRight } from 'lucide-react';

const ordinal = (n) => `${n}º`;

// Amigos e ranking: com amigos participando, mostra a posição da semana; senão, o convite para começar.
export default function FriendsWeekCard({ preview }) {
  const ready = preview?.status === 'ready' && preview.position;
  const top = ready ? preview.rows.slice(0, 3) : [];
  return (
    <Link to="/amigos" className="surface surface-hover pressable mt-3 flex flex-col gap-3 p-4" aria-label={ready ? `Amigos e ranking: você está em ${ordinal(preview.position)} lugar na semana` : 'Amigos e ranking'}>
      <span className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-amber-800 dark:text-brand"><Users className="h-6 w-6" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-black text-gray-900 dark:text-white">
            {ready ? `Você está em ${ordinal(preview.position)} entre ${preview.total} esta semana` : 'Amigos e ranking'}
          </span>
          <span className="block text-xs text-gray-600 dark:text-gray-400">
            {ready ? 'Consistência registrada: treinos, dias ativos e sequência.' : preview?.status === 'noFriends' ? 'Adicione amigos pelo @usuário ou código e compare a semana.' : 'Compare a consistência da semana com quem treina com você.'}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
      </span>
      {ready && (
        <ol className="grid grid-cols-3 gap-2 text-center">
          {top.map((r) => (
            <li key={r.uid} className={`rounded-2xl px-2 py-2 ${r.me ? 'bg-brand/15 ring-1 ring-brand/40' : 'bg-gray-50 dark:bg-white/5'}`}>
              <span className="block truncate text-xs font-bold text-gray-900 dark:text-white">{r.me ? 'Você' : r.name}</span>
              <span className="block text-[11px] text-gray-700 dark:text-gray-300">{r.workouts} treino{r.workouts === 1 ? '' : 's'}</span>
            </li>
          ))}
        </ol>
      )}
    </Link>
  );
}
