import React from 'react';
import { Award, Lock } from 'lucide-react';
import { formatDate } from '../../utils/format';

// Conquistas do aluno (utils/achievements): as obtidas, com como ganhou e a data, e as próximas, com o que falta.
export default function AchievementBadges({ achievements = [] }) {
  const won = achievements.filter((a) => a.unlocked);
  const next = achievements.filter((a) => !a.unlocked);
  return (
    <section className="surface min-w-0 p-5" aria-labelledby="conquistas-titulo">
      <h3 id="conquistas-titulo" className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Conquistas</h3>
      {won.length === 0 && <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">Nenhuma ainda. Conclua um treino de 10 min ou mais, com 3 séries ou mais, para ganhar a primeira.</p>}
      {won.length > 0 && (
        <ul aria-label="Conquistas obtidas" className="space-y-2">
          {won.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-brand/15 text-amber-800 dark:text-brand"><Award className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900 dark:text-white">{a.label}</span>
                <span className="block text-xs text-gray-600 dark:text-gray-400">{a.how}{a.date ? ` Em ${formatDate(a.date)}.` : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {next.length > 0 && (
        <>
          <h4 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Próximas</h4>
          <ul aria-label="Próximas conquistas" className="space-y-2">
            {next.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-100 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"><Lock className="h-4 w-4" aria-hidden="true" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-gray-700 dark:text-gray-200">{a.label} <span className="sr-only">(bloqueada)</span></span>
                  <span className="block text-xs text-gray-600 dark:text-gray-400">{a.missing}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
