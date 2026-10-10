import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, MessageSquare, Send, Eye } from 'lucide-react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useChat } from '../../hooks/useChat';
import { formatTime } from '../../utils/format';
import Avatar from '../../components/coach/Avatar';
import EmptyState from '../../components/common/EmptyState';
import { timeAgo, toDate } from '../../components/coach/helpers';
import QuickReplies from '../../components/coach/QuickReplies';
import { inputCls } from '../../components/coach/styles';

const otherOf = (chat, uid) => {
  const otherId = chat?.participants?.find((id) => id !== uid);
  return { id: otherId, ...(chat?.participantData?.[otherId] || {}) };
};

export default function CoachChatPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { chats, messages, activeChat, setActiveChat, sendMessage, openChatWithUser, loading } = useChat(user);

  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Vindo do painel/alunos: abre direto a conversa com o aluno
  useEffect(() => {
    if (location.state?.targetUser) openChatWithUser(location.state.targetUser);
    if (location.state?.draft) setInputText(location.state.draft); // mensagem pronta: o treinador revisa e envia
  }, [location.state, openChatWithUser]);

  const filteredChats = useMemo(() => chats.filter((chat) => (otherOf(chat, user.uid).name || 'Aluno').toLowerCase().includes(searchTerm.toLowerCase())), [chats, searchTerm, user.uid]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  if (loading) {
    return (
      <div role="status" aria-label="Carregando" className="flex h-[calc(100dvh-5rem)] bg-gray-50 dark:bg-gray-900">
        <div className="w-full space-y-3 p-4 md:w-80">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-shimmer h-16 rounded-2xl" />)}</div>
        <div className="skeleton-shimmer hidden flex-1 md:block" />
      </div>
    );
  }

  const active = activeChat ? otherOf(activeChat, user.uid) : null;

  return (
    <div className="flex h-[calc(100dvh-5rem)] overflow-hidden bg-gray-50 transition-colors dark:bg-gray-900">
      {/* Lista de conversas */}
      <aside className={`w-full flex-col border-r border-gray-200 bg-white/80 dark:border-white/10 dark:bg-white/[0.03] md:flex md:w-80 lg:w-96 ${activeChat ? 'hidden' : 'flex'}`}>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-black text-gray-900 dark:text-white">Mensagens</h1>
            <button type="button" onClick={() => navigate('/coach/students')} className="pressable min-h-[44px] rounded-2xl bg-gray-100 px-3 text-xs font-bold text-gray-600 dark:bg-white/5 dark:text-gray-300">Alunos</button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input type="search" aria-label="Buscar conversa" placeholder="Buscar aluno..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`${inputCls} pl-11`} />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-4">
          {filteredChats.length === 0 ? (
            <li><EmptyState icon={MessageSquare} title="Nenhuma conversa" description="Abra o chat a partir da lista de alunos." /></li>
          ) : filteredChats.map((chat, i) => {
            const student = otherOf(chat, user.uid);
            const isActive = activeChat?.id === chat.id;
            return (
              <li key={chat.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <button type="button" aria-current={isActive ? 'true' : undefined} onClick={() => setActiveChat(chat)}
                  className={`pressable flex min-h-[68px] w-full items-center gap-3 rounded-2xl p-3 text-left transition ${isActive ? 'bg-brand/15' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                  <Avatar name={student.name || 'Aluno'} src={student.photo} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-bold text-gray-900 dark:text-white">{student.name || 'Aluno'}</span>
                      <span className="shrink-0 text-[11px] text-gray-400">{chat.updatedAt ? timeAgo(chat.updatedAt) : ''}</span>
                    </span>
                    <span className="block truncate text-xs text-gray-500">{chat.lastMessage || <i className="opacity-60">Nova conversa</i>}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Conversa */}
      <section className={`min-w-0 flex-1 flex-col ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {activeChat ? (
          <>
            <header className="flex items-center gap-3 border-b border-gray-200 bg-white/80 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-white/[0.03]">
              <button type="button" aria-label="Voltar às conversas" onClick={() => setActiveChat(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 md:hidden"><ArrowLeft className="h-5 w-5" /></button>
              <Avatar name={active.name || 'Aluno'} src={active.photo} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display font-black text-gray-900 dark:text-white">{active.name || 'Aluno'}</h2>
                <p className="text-xs text-gray-500">Conversa com seu aluno</p>
              </div>
              {active.id && <button type="button" aria-label="Ver perfil do aluno" onClick={() => navigate(`/coach/students/${active.id}`)} className="pressable inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300"><Eye className="h-5 w-5" /></button>}
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Mensagens">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center"><EmptyState icon={MessageSquare} title="Inicie o atendimento" description="Envie a primeira mensagem para este aluno." /></div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.senderId === user.uid;
                const day = toDate(msg.createdAt)?.toDateString();
                const prevDay = i > 0 ? toDate(messages[i - 1].createdAt)?.toDateString() : null;
                return (
                  <React.Fragment key={msg.id}>
                    {day && day !== prevDay && (
                      <p className="py-2 text-center text-[11px] font-bold uppercase tracking-wide text-gray-400">{toDate(msg.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</p>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`animate-scale-in max-w-[82%] rounded-3xl px-4 py-2.5 text-sm shadow-sm md:max-w-[65%] ${isMe ? 'rounded-br-lg bg-brand text-black' : 'rounded-bl-lg border border-gray-200 bg-white text-gray-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-100'}`}>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                        <p className={`mt-1 text-right text-[10px] ${isMe ? 'text-black/60' : 'text-gray-400'}`}>{formatTime(msg.createdAt)}</p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <QuickReplies studentName={active.name} onPick={setInputText} />
            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <input type="text" aria-label="Mensagem" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Digite sua mensagem..." maxLength={2000} className={`${inputCls} flex-1 rounded-full px-5`} />
              <button type="submit" aria-label="Enviar mensagem" disabled={!inputText.trim()} className="pressable inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-black shadow-lg shadow-brand/30 disabled:opacity-40"><Send className="h-5 w-5" /></button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState icon={MessageSquare} title="Central de alunos" description="Selecione uma conversa na lista para iniciar o atendimento." />
          </div>
        )}
      </section>
    </div>
  );
}
