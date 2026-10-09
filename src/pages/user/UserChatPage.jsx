import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useChat } from '../../hooks/useChat';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ArrowLeft, Send, Sparkles, Bot } from 'lucide-react';
import AICoachModal from '../../components/ai/AICoachModal';
import { formatTime } from '../../utils/format';

export default function UserChatPage() {
  const { user, userProfile } = useAuthContext();
  const navigate = useNavigate();
  const { messages, sendMessage, openChatWithUser, loading } = useChat(user);
  
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const [coach, setCoach] = useState(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // 1. Identificar o Coach do aluno e abrir o chat
  useEffect(() => {
      let isMounted = true;
      const initChat = async () => {
          if (!user?.uid) return;

          try {
              const userDoc = await getDoc(doc(db, 'users', user.uid));
              if (userDoc.exists()) {
                  const userData = userDoc.data();
                  if (userData.coachId) {
                      const coachDoc = await getDoc(doc(db, 'users', userData.coachId));
                      if (coachDoc.exists() && isMounted) {
                          const coachData = { uid: coachDoc.id, ...coachDoc.data() };
                          setCoach(coachData);
                          openChatWithUser(coachData); 
                      }
                  }
              }
          } catch (err) {
              console.error("Erro UserChatPage init:", err);
          }
      };
      initChat();
      return () => { isMounted = false; };
  }, [user?.uid, openChatWithUser]);

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e) => {
      e.preventDefault();
      sendMessage(inputText);
      setInputText('');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand"></div></div>;

  // Se não tem coach vinculado
  if (!coach && !loading) {
      return (
          <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0B0F19] p-6 text-center">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand to-[#FF9800] flex items-center justify-center text-black font-black mb-4 shadow-xl shadow-brand/20">
                  <Bot className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Treine com o Coach IA ✨</h2>
              <p className="text-gray-400 text-xs max-w-xs mb-6">Você ainda não tem um treinador humano vinculado, mas pode conversar com nosso Coach IA sobre treinos, nutrição e metas!</p>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button onClick={() => setIsAIModalOpen(true)} className="btn-primary-gradient py-3.5 px-6 rounded-2xl font-black text-xs shadow-lg flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 fill-current" /> Conversar com Coach IA
                </button>
                <button onClick={() => navigate('/home')} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-3 px-6 rounded-2xl font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    Voltar ao Início
                </button>
              </div>

              <AICoachModal 
                isOpen={isAIModalOpen}
                onClose={() => setIsAIModalOpen(false)}
                userProfile={userProfile}
                user={user}
              />
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#0B0F19] transition-colors pb-safe-nav">
        
        {/* Header */}
        <div className="p-4 bg-white dark:bg-[#1F2937]/90 dark:backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-sm z-10 sticky top-0">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/home')} className="text-gray-500 hover:text-brand pr-2 flex items-center justify-center transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-lg font-bold text-brand border border-brand/20">
                    {coach?.displayName?.[0] || 'C'}
                </div>
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-white">{coach?.displayName || 'Treinador'}</h3>
                    <p className="text-xs text-green-500 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online
                    </p>
                </div>
            </div>

            <button
              onClick={() => setIsAIModalOpen(true)}
              className="bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" /> Coach IA
            </button>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-[#0B0F19]">
            {messages.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm">
                    <p>Inicie a conversa com seu treinador. 👋</p>
                </div>
            )}
            
            {messages.map((msg) => {
                const isMe = msg.senderId === user.uid;
                return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3.5 rounded-2xl text-sm shadow-sm relative group ${
                            isMe 
                            ? 'bg-gradient-to-r from-brand to-[#FF9800] text-black font-medium rounded-tr-none' 
                            : 'card-premium-glass text-gray-800 dark:text-gray-100 rounded-tl-none p-3.5'
                        }`}>
                            <p className="leading-relaxed">{msg.text}</p>
                            <p className={`text-[9px] mt-1 text-right opacity-70 ${isMe ? 'text-black/85 font-bold' : 'text-gray-400'}`}>
                                {formatTime(msg.createdAt)}
                            </p>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-white dark:bg-[#1F2937]/90 border-t border-gray-200 dark:border-gray-800">
            <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto items-center">
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 input-brand-dark text-sm"
                />
                <button aria-label="Enviar mensagem" 
                    type="submit" 
                    disabled={!inputText.trim()}
                    className="btn-primary-gradient px-4 py-3 rounded-xl touch-target text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>

        {/* MODAL DO COACH IA */}
        <AICoachModal 
            isOpen={isAIModalOpen}
            onClose={() => setIsAIModalOpen(false)}
            userProfile={userProfile}
            user={user}
        />
    </div>
  );
}