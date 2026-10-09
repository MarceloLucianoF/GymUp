import React, { useState } from 'react';
import { Send } from 'lucide-react';

// Campo de envio fixo ao rodapé: respeita safe-area (iOS) e usa fonte 16px para não dar zoom.
export default function ChatComposer({ onSend, placeholder = 'Digite sua mensagem...', safeArea = true, className = '' }) {
  const [text, setText] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <form
      onSubmit={submit}
      className={`shrink-0 flex items-center gap-2 border-t border-gray-200 bg-white/90 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0F19]/90 ${className}`}
      style={safeArea ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' } : undefined}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label="Mensagem"
        enterKeyHint="send"
        autoComplete="off"
        maxLength={1000}
        className="min-h-[48px] flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-base text-gray-900 outline-none transition-all focus:ring-2 focus:ring-brand dark:border-white/10 dark:bg-white/5 dark:text-white"
      />
      <button
        type="submit"
        aria-label="Enviar mensagem"
        disabled={!text.trim()}
        className="btn-primary-gradient pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-5 w-5" aria-hidden="true" />
      </button>
    </form>
  );
}
