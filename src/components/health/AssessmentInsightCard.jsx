import React, { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { aiService } from '../../services/aiService';
import { assessmentAiMessages, assessmentLines, assessmentMatches, buildAssessmentFacts } from '../../utils/assessmentInsight';

// Análise da avaliação física. O texto local sai na hora; "Analisar com IA" pede uma explicação mais natural, que só aparece
// se usar exatamente os mesmos números. audience: 'student' (Evolução) ou 'coach' (aba Saúde do aluno).
export default function AssessmentInsightCard({ assessments, anamnesis, goal, audience = 'student' }) {
  const facts = useMemo(() => buildAssessmentFacts({ assessments, anamnesis, goal }), [assessments, anamnesis, goal]);
  const lines = assessmentLines(facts, audience);
  const [ai, setAi] = useState({ text: '', loading: false, note: '' });
  const coach = audience === 'coach';

  const analyze = async () => {
    setAi({ text: '', loading: true, note: '' });
    const reply = await aiService.summarizeFacts(assessmentAiMessages(facts, audience));
    if (reply && assessmentMatches(reply, facts, audience)) setAi({ text: reply.replace(/\s+/g, ' ').trim(), loading: false, note: '' });
    else setAi({ text: '', loading: false, note: reply ? 'A IA trouxe números diferentes dos registrados; mantive a análise calculada.' : 'IA indisponível agora; mantive a análise calculada.' });
  };

  return (
    <section className="surface space-y-3 p-5" aria-labelledby={`insight-${audience}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`insight-${audience}`} className="flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white">
          <Sparkles className="h-5 w-5 text-amber-700 dark:text-brand" aria-hidden="true" /> {coach ? 'Análise para o treino' : 'Análise da avaliação'}
        </h2>
        {facts.hasData && (
          <button type="button" onClick={analyze} disabled={ai.loading}
            className="pressable inline-flex min-h-[44px] items-center rounded-xl bg-gray-100 px-3 text-xs font-bold text-gray-900 disabled:opacity-60 dark:bg-white/10 dark:text-white print:hidden">
            {ai.loading ? 'Analisando…' : ai.text ? 'Analisar de novo' : 'Analisar com IA'}
          </button>
        )}
      </div>
      <div aria-live="polite">
        {ai.text ? (
          <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{ai.text}</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            {lines.map((line) => <li key={line}>{line}</li>)}
          </ul>
        )}
      </div>
      {ai.text && <p className="text-xs text-gray-600 dark:text-gray-400">Texto da IA conferido com os números da avaliação. <button type="button" className="underline" onClick={() => setAi({ text: '', loading: false, note: '' })}>Ver a análise calculada</button></p>}
      {ai.note && <p className="text-xs text-gray-600 dark:text-gray-400">{ai.note}</p>}
      {facts.hasData && (
        <p className="text-xs text-gray-600 dark:text-gray-400 print:hidden">
          Para a IA vão só os números da avaliação, sexo, idade e objetivo. {coach ? 'Nome, observações e textos da anamnese do aluno' : 'Seu nome, observações e textos da anamnese'} não saem do app e nada fica guardado.
        </p>
      )}
    </section>
  );
}
