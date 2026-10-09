import React from 'react';
import { formatDate } from '../../utils/format';

export default function WeeklyChart({ history }) {
  // 1. Gera os últimos 7 dias (Dinâmico)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i)); // De 6 dias atrás até hoje
    d.setHours(0,0,0,0);
    return d;
  });

  // 2. Mapeia os dados
  const chartData = last7Days.map((date, i) => {
    // Formata dia da semana (Seg, Ter...)
    const dayStr = formatDate(date, { weekday: 'short' }, '').replace('.', '').slice(0, 3);
    
    // Conta treinos neste dia
    const count = history.filter(h => {
        if (!h.date) return false; // Proteção contra dados antigos sem data
        const hDate = new Date(h.date);
        return hDate.getDate() === date.getDate() && 
               hDate.getMonth() === date.getMonth() &&
               hDate.getFullYear() === date.getFullYear();
    }).length;

    return { 
        day: dayStr.charAt(0).toUpperCase() + dayStr.slice(1), 
        count,
        isToday: i === 6
    };
  });

  const maxVal = Math.max(...chartData.map(d => d.count), 1); // Escala máxima

  return (
    <div className="surface p-5 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Frequência (7 dias)
        </h3>
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-1 rounded-full">
            Meta: 4/semana
        </span>
      </div>

      {/* Área do Gráfico */}
      <div className="flex items-end justify-between flex-1 gap-2 sm:gap-3 min-h-[140px]" role="img" aria-label={`Treinos nos últimos 7 dias: ${chartData.reduce((a, d) => a + d.count, 0)}`}>
        {chartData.map((item, i) => {
          // Altura: Se tiver treino usa % real, se não usa 10% fixo pra mostrar a barra cinza
          const heightPct = item.count > 0 ? (item.count / maxVal) * 100 : 10; 
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative cursor-pointer h-full justify-end">
              
              {/* Tooltip Flutuante (Só aparece se tiver treino) */}
              {item.count > 0 && (
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-20 mb-2">
                     {item.count} treinos
                     <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black rotate-45"></div>
                  </div>
              )}

              {/* A Barra */}
              <div 
                style={{ height: `${heightPct}%`, transformOrigin: 'bottom', animationDelay: `${i * 70}ms` }}
                className={`w-full rounded-t-xl animate-bar-grow relative ${
                    item.count > 0 
                    ? 'bg-gradient-to-t from-[#FF9800] to-brand group-hover:opacity-80'  // Cor quando tem treino
                    : 'bg-gray-100 dark:bg-white/5' // <--- CORREÇÃO: Cor cinza quando vazio (antes estava transparent)
                } ${item.isToday ? 'ring-2 ring-brand/20 dark:ring-brand/10' : ''}`}
              >
                 {/* Brilho no topo da barra ativa */}
                 {item.count > 0 && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-white/20"></div>
                 )}
              </div>

              {/* Label do Dia */}
              <span className={`text-[10px] mt-3 font-bold uppercase transition-colors ${
                  item.isToday ? 'text-brand dark:text-brand' : 'text-gray-400 dark:text-gray-500'
              }`}>
                {item.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}