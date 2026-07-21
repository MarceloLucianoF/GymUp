import React from 'react';

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
  const trainedDays = history.map(h => new Date(h.date).getDate());

  // Nomes dos dias
  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <div className="bg-white dark:bg-[#1F2937]/50 dark:backdrop-blur-md rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#FFC107]/10 mb-6 hover:shadow-[0_0_25px_rgba(255,193,7,0.06)] hover:border-[#FFC107]/20 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-800 dark:text-white uppercase text-sm tracking-wider">
           {today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-2 items-center text-[10px] text-gray-400">
            <span className="w-3 h-3 rounded-full bg-gray-100 dark:bg-gray-700"></span> Descanso
            <span className="w-3 h-3 rounded-full bg-green-500"></span> Treino
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
                        aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all
                        ${isTrained 
                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 scale-105' 
                            : 'bg-gray-50 dark:bg-gray-700/50 text-gray-450 dark:text-gray-500'
                        }
                        ${isToday && !isTrained ? 'border-2 border-[#FFC107] text-[#FFC107]' : ''}
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