import { useEffect, useMemo, useState } from 'react';
import { buildWeeklySummary, factsHash, localNarrative } from '../utils/weeklySummary';
import { resolveNarrative } from '../services/weeklySummaryService';

/**
 * Resumo da semana: números calculados na hora (determinísticos) e texto que começa local e pode virar o guardado/da IA.
 * Só consulta o snapshot e a IA depois do conteúdo principal (`ready`) e uma vez por conjunto de números.
 */
export function useWeeklySummary({ uid, history, weeklyGoal, ready }) {
  const [period, setPeriod] = useState('current');
  const current = useMemo(() => buildWeeklySummary({ history, weeklyGoal, which: 'current' }), [history, weeklyGoal]);
  const last = useMemo(() => buildWeeklySummary({ history, weeklyGoal, which: 'last' }), [history, weeklyGoal]);
  const facts = period === 'current' ? current : last;
  const hash = factsHash(facts);
  const [narrative, setNarrative] = useState({ text: localNarrative(facts), source: 'local', hash });

  useEffect(() => {
    setNarrative({ text: localNarrative(facts), source: 'local', hash });
    if (!ready || !uid) return undefined;
    let off = false;
    const timer = setTimeout(async () => {
      const result = await resolveNarrative(uid, facts);
      if (!off) setNarrative(result);
    }, 1200);
    return () => { off = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, ready, hash]);

  return { period, setPeriod, facts, narrative };
}
