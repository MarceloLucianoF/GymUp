import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ChevronRight } from 'lucide-react';

// Mensagem do treinador ainda não vista (some quando o chat é aberto).
export default function CoachMessageCard({ message, coachName }) {
  if (!message?.unread) return null;
  const text = message.text.length > 120 ? `${message.text.slice(0, 117)}...` : message.text;
  return (
    <Link to="/chat" className="surface surface-hover pressable flex items-center gap-3 border border-brand/30 p-4" aria-label={`Nova mensagem de ${coachName || 'seu treinador'}: ${text}`}>
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-amber-800 dark:text-brand">
        <MessageSquare className="h-6 w-6" aria-hidden="true" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-gray-900" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-brand">Mensagem de {coachName || 'seu treinador'}</span>
        <span className="block truncate text-sm text-gray-900 dark:text-white">{text}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
    </Link>
  );
}
