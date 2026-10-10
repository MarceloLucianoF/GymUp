import React from 'react';
import { MessageSquare, Eye, Check, ClipboardList, Trophy, AlertOctagon, Clock, ListChecks, Smile } from 'lucide-react';
import Avatar from './Avatar';
import EmptyState from '../common/EmptyState';
import { brl } from './helpers';

const META = {
  overdue: { icon: AlertOctagon, cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', label: 'Cobrança' },
  inactive: { icon: Clock, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Parado' },
  nofile: { icon: ClipboardList, cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', label: 'Sem ficha' },
  record: { icon: Trophy, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Recorde' }
};

const MESSAGE_LABEL = { overdue: 'Cobrar', inactive: 'Chamar', record: 'Parabenizar' };

const act = 'pressable inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl px-3 text-xs font-bold disabled:opacity-50';

// Fila de ação do dia: cada item traz o motivo e os botões diretos (mensagem pronta, ver aluno, marcar pago).
export default function ActionQueue({ items, busyId, onMessage, onView, onMarkPaid, onAssign, limit = 8 }) {
  const shown = items.slice(0, limit);
  if (shown.length === 0) {
    return <EmptyState icon={Smile} title="Fila vazia" description="Nada pedindo sua atenção agora." />;
  }
  return (
    <>
      <ul className="space-y-2" aria-label="Fila de ação do dia">
        {shown.map((item) => {
          const { icon: Icon, cls, label } = META[item.type];
          const s = item.student;
          const name = s.displayName || 'Aluno';
          return (
            <li key={item.id} className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-white/[0.04] sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={name} src={s.photoURL} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{name}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${cls}`}><Icon className="h-3 w-3" aria-hidden="true" />{label}</span>
                    <span>{item.detail}{item.type === 'overdue' && item.weight ? ` · ${brl(item.weight)}` : ''}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.type === 'overdue' && (
                  <button type="button" disabled={busyId === s.uid} onClick={() => onMarkPaid(s)} className={`${act} bg-emerald-500 text-white`}><Check className="h-4 w-4" /> Marcar pago</button>
                )}
                {item.type === 'nofile' && (
                  <button type="button" onClick={() => onAssign(s)} className={`${act} bg-brand text-black`}><ClipboardList className="h-4 w-4" /> Atribuir ficha</button>
                )}
                {MESSAGE_LABEL[item.type] && (
                  <button type="button" onClick={() => onMessage(item)} aria-label={`${MESSAGE_LABEL[item.type]} ${name} por mensagem`} className={`${act} bg-sky-500/10 text-sky-600`}><MessageSquare className="h-4 w-4" /> {MESSAGE_LABEL[item.type]}</button>
                )}
                <button type="button" onClick={() => onView(s)} aria-label={`Ver ${name}`} className={`${act} bg-gray-200/70 text-gray-700 dark:bg-white/10 dark:text-gray-200`}><Eye className="h-4 w-4" /> Ver</button>
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > shown.length && <p className="mt-3 flex items-center gap-1 text-xs text-gray-500"><ListChecks className="h-3.5 w-3.5" aria-hidden="true" />+{items.length - shown.length} itens na fila</p>}
    </>
  );
}
