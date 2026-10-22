import React, { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { aiService } from '../../services/aiService';
import { buildCoachFacts, coachBriefAiMessages, coachBriefMatches, coachBriefText } from '../../utils/coachBrief';

// Resumo do aluno para o treinador (últimas 4 semanas). O texto local sai na hora; "Reescrever com IA" pede um texto mais natural,
// que só aparece se usar exatamente os mesmos números. Nada de peso corporal, medidas ou saúde vai para a IA.
export default function CoachBriefCard({ checkIns, student }) {
  const name = (student?.displayName || 'O aluno').split(' ')[0];
  const facts = useMemo(() => buildCoachFacts({ checkIns, weeklyGoal: student?.weeklyGoal }), [checkIns, student?.weeklyGoal]);
  const local = coachBriefText(facts, name);
  const [ai, setAi] = useState({ text: '', loading: false, note: '' });

  const rewrite = async () => {
    setAi({ text: '', loading: true, note: '' });
    const reply = await aiService.summarizeFacts(coachBriefAiMessages(facts, name));
    if (reply && coachBriefMatches(reply, facts, name)) setAi({ text: reply.replace(/\s+/g, ' ').trim(), loading: false, note: '' });
    else setAi({ text: '', loading: false, note: reply ? 'A IA trouxe números diferentes dos registrados; mantive o resumo calculado.' : 'IA indisponível agora; mantive o resumo calculado.' });
  };

  return (
    <section className="surface p-5" aria-labelledby="coach-brief-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="coach-brief-title" className="flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white"><Sparkles className="h-5 w-5 text-amber-700 dark:text-brand" aria-hidden="true" /> Resumo do aluno (4 semanas)</h2>
        {facts.hasHistory && (
          <button type="button" onClick={rewrite} disabled={ai.loading} className="pressable inline-flex min-h-[44px] items-center rounded-xl bg-gray-100 px-3 text-xs font-bold text-gray-900 disabled:opacity-60 dark:bg-white/10 dark:text-white">
            {ai.loading ? 'Escrevendo…' : 'Reescrever com IA'}
          </button>
        )}
      </div>
      <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200" aria-live="polite">{ai.text || local}</p>
      {ai.text && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Texto da IA conferido com os números registrados.</p>}
      {ai.note && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{ai.note}</p>}
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Calculado a partir dos treinos registrados no app. Sugestões são pontos de partida: a decisão é sua.</p>
    </section>
  );
}
