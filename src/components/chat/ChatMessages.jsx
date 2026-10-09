import React, { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { formatTime } from '../../utils/format';
import { groupMessages } from './groupMessages';

// Lista de mensagens: balões agrupados por remetente, horário no fim do grupo,
// rolagem automática ao fim e região aria-live para novas mensagens.
export default function ChatMessages({
  messages,
  userId,
  loading = false,
  emptyTitle = 'Comece a conversa',
  emptyText = 'Envie a primeira mensagem.',
  className = '',
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  if (loading) {
    return (
      <div className={`flex-1 space-y-3 p-4 ${className}`} role="status" aria-label="Carregando mensagens">
        {[60, 40, 52].map((w, i) => (
          <div key={w} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
            <div className="h-10 animate-pulse rounded-2xl bg-gray-200 dark:bg-white/10" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    );
  }

  const groups = groupMessages(messages);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Mensagens"
      className={`flex-1 overflow-y-auto overscroll-contain p-4 ${className}`}
    >
      {messages.length === 0 ? (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center p-6 text-center animate-fade-up">
          <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-brand/15 text-brand">
            <MessageSquare className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="font-display font-black text-gray-800 dark:text-white">{emptyTitle}</p>
          <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isMe = group.senderId === userId;
            const last = group.messages[group.messages.length - 1];
            return (
              <div key={group.messages[0].id} className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                {group.messages.map((msg, i) => {
                  const first = i === 0;
                  const radius = isMe
                    ? `rounded-2xl ${first ? '' : 'rounded-tr-md'} ${i === group.messages.length - 1 ? 'rounded-br-md' : 'rounded-br-md'}`
                    : `rounded-2xl ${first ? '' : 'rounded-tl-md'} rounded-bl-md`;
                  return (
                    <div
                      key={msg.id}
                      className={`max-w-[82%] break-words px-3.5 py-2 text-sm leading-relaxed animate-fade-up ${radius} ${
                        isMe
                          ? 'bg-gradient-to-r from-brand to-[#FF9800] font-medium text-black shadow-sm'
                          : 'surface !rounded-2xl text-gray-800 dark:text-gray-100'
                      }`}
                    >
                      {msg.text}
                    </div>
                  );
                })}
                <span className="px-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {formatTime(last.createdAt, 'enviando...')}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
