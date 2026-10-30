import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Weight, Timer, Trophy, Target } from 'lucide-react';
import StatCard from '../ui/StatCard';
import Reveal from '../ui/Reveal';
import Skeleton from '../common/Skeleton';
import WeeklySummaryCard from './WeeklySummaryCard';
import RecordsCard from './RecordsCard';
import VolumeTrend from './VolumeTrend';
import AchievementBadges from './AchievementBadges';
import WeeklyChart from './WeeklyChart';
import { fetchStudentCheckIns } from '../../services/checkInsCache';
import { computeStats, GOAL_DEFAULT } from '../../hooks/useStudentHome';
import { computeAchievements } from '../../utils/achievements';
import { useWeeklySummary } from '../../hooks/useWeeklySummary';
import { recentRecords } from '../../utils/records';

/** Números do mês a partir do histórico (puro, para a Home e a Evolução usarem a mesma conta). */
export function monthNumbers(history, now = new Date()) {
  const items = (history || []).filter((h) => {
    const d = new Date(h.date);
    return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  return {
    count: items.length,
    volume: items.reduce((acc, h) => acc + (Number(h.totalVolume) || 0), 0),
    minutes: Math.round(items.reduce((acc, h) => acc + (Number(h.duration) || 0), 0) / 60),
  };
}

/**
 * Seção "Seus treinos" da Evolução: os cartões de números que ficavam na Home
 * (mês, recorde, nível, resumo da semana, recordes novos, frequência, volume e conquistas).
 */
export default function TrainingNumbers({ uid, weeklyGoal }) {
  const [history, setHistory] = useState([]);
  const [state, setState] = useState('loading');
  useEffect(() => {
    if (!uid) return undefined;
    let alive = true;
    fetchStudentCheckIns(uid)
      .then((rows) => { if (alive) { setHistory(rows); setState('ready'); } })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [uid]);

  const stats = useMemo(() => computeStats(history), [history]);
  const goal = Number(weeklyGoal) || GOAL_DEFAULT;
  const game = useMemo(() => computeAchievements(history, { weeklyGoal: goal }), [history, goal]);
  const level = game.level;
  const records = useMemo(() => recentRecords(history), [history]);
  const month = useMemo(() => monthNumbers(history), [history]);
  const summary = useWeeklySummary({ uid, history, weeklyGoal: goal, ready: state === 'ready' });
  const volumeSpark = history.slice(0, 8).map((h) => Number(h.totalVolume) || 0).reverse();

  if (state === 'loading') {
    return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 !rounded-3xl" />)}</div>;
  }
  if (state === 'error') {
    return <p role="alert" className="surface p-4 text-sm text-gray-600 dark:text-gray-300">Não foi possível carregar os números dos seus treinos.</p>;
  }

  return (
    <section aria-labelledby="treinos-numeros" className="space-y-4">
      <h2 id="treinos-numeros" className="font-display text-lg font-black text-gray-900 dark:text-white">Seus treinos</h2>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarCheck} label="Treinos no mês" value={month.count} className="h-full" />
        <StatCard icon={Weight} accent="green" label="Volume no mês" value={Math.round(month.volume / 100) / 10} decimals={1} suffix=" t" spark={volumeSpark} className="h-full" />
        <StatCard icon={Timer} accent="blue" label="Minutos treinados" value={month.minutes} suffix=" min" className="h-full" />
        <StatCard icon={Trophy} label="Maior carga (PR)" value={stats.maxGlobalLoad} suffix=" kg" className="h-full" />
      </div>

      <div className="surface p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400"><Target className="h-4 w-4 text-brand" aria-hidden="true" /> Nível {level.name}</h3>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{level.next ? `${level.count}/${level.nextAt}` : `${level.count} treinos`}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10" role="progressbar" aria-valuenow={Math.round(level.progress)} aria-valuemin={0} aria-valuemax={100} aria-label={level.next ? `Progresso até o nível ${level.next}` : 'Nível máximo'}>
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-[#FF9800] transition-all duration-1000" style={{ width: `${level.progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          {level.next ? `Faltam ${level.remaining} ${level.remaining === 1 ? 'treino' : 'treinos'} para o nível ${level.next}.` : 'Você chegou ao nível mais alto.'} Conta 1 treino por dia, com 10 min ou mais e 3 séries ou mais.
        </p>
      </div>

      <Reveal><WeeklySummaryCard facts={summary.facts} narrative={summary.narrative} period={summary.period} onPeriod={summary.setPeriod} /></Reveal>
      {records.length > 0 && <Reveal><RecordsCard records={records} /></Reveal>}

      <Reveal>
        <h3 className="mb-3 px-1 font-display text-base font-black text-gray-900 dark:text-white">Frequência semanal</h3>
        <WeeklyChart history={history} />
      </Reveal>

      <Reveal><VolumeTrend history={history} /></Reveal>
      <Reveal><AchievementBadges achievements={game.achievements} /></Reveal>
    </section>
  );
}
