import React from 'react';
import { formatDate } from '../../utils/format';

export default function MonthCalendar({ history }) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // 1. Gerar dias do mês
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Dom, 1 = Seg...

  const days = [];
  // Espaços vazios antes do dia 1
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  // Dias reais
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentYear, currentMonth, i));
  }

  // 2. Mapear dias treinados
  const trainedDays = [...new Set(history
    .map(h => new Date(h.date))
    .filter(d => !Number.isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear)
    .map(d => d.getDate()))];

  // Nomes dos dias
  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <div className="surface p-4 sm:p-6 mb-6 animate-fade-up">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-800 dark:text-white uppercase text-sm tracking-wider">
           {formatDate(today, { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-2 items-center text-[10px] text-gray-500 dark:text-gray-400">
            <span className="w-3 h-3 rounded-full bg-gray-100 dark:bg-gray-700"></span> Descanso
            <span className="w-3 h-3 rounded-full bg-brand"></span> Treino
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {/* Cabeçalho Semana */}
        {weekDays.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-gray-400 py-1">
                {d}
            </div>
        ))}

        {/* Dias */}
        {days.map((date, i) => {
            if (!date) return <div key={i}></div>; // Espaço vazio

            const dayNum = date.getDate();
            const isTrained = trainedDays.includes(dayNum);
            const isToday = dayNum === today.getDate();

            return (
                <div 
                    key={i}
                    className={`
                        aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all
                        ${isTrained 
                            ? 'bg-gradient-to-br from-brand to-[#FF9800] text-black shadow-md shadow-brand/30 scale-105' 
                            : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                        }
                        ${isToday && !isTrained ? 'border-2 border-brand text-brand' : ''}
                    `}
                >
                    {isTrained ? '💪' : dayNum}
                </div>
            );
        })}
      </div>
      
      <p className="text-center text-xs text-gray-400 mt-4">
          Você treinou <strong>{trainedDays.length} dias</strong> este mês! 🔥
      </p>
    </div>
  );
}