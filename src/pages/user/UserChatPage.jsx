import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useChat } from '../../hooks/useChat';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ArrowLeft, Sparkles, Bot } from 'lucide-react';
import AICoachModal from '../../components/ai/AICoachModal';
import ChatMessages from '../../components/chat/ChatMessages';
import ChatComposer from '../../components/chat/ChatComposer';
import { getPublicCoach } from '../../services/coachProfile';

export default function UserChatPage() {
  const { user, userProfile } = useAuthContext();
  const navigate = useNavigate();
  const { messages, sendMessage, openChatWithUser, loading } = useChat(user);
  
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
                      const coachData = await getPublicCoach(userData.coachId);
                      if (coachData && isMounted) {
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

  if (loading) return <div className="h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-[#0B0F19]" role="status" aria-label="Carregando chat"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand"></div></div>;

  // Se não tem coach vinculado
  if (!coach && !loading) {
      return (
          <div className="h-[100dvh] flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0B0F19] p-6 text-center">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand to-[#FF9800] flex items-center justify-center text-black font-black mb-4 shadow-xl shadow-brand/20">
                  <Bot className="w-8 h-8" />
              </div>
              <h2 className="font-display text-xl font-black text-gray-800 dark:text-white mb-2">Treine com o Coach IA</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mb-6">Você ainda não tem um treinador humano vinculado, mas pode conversar com nosso Coach IA sobre treinos, nutrição e metas!</p>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button onClick={() => setIsAIModalOpen(true)} className="btn-primary-gradient min-h-[48px] px-6 rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 fill-current" /> Conversar com Coach IA
                </button>
                <button onClick={() => navigate('/home')} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 min-h-[48px] px-6 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
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
    <div className="flex flex-col h-[100dvh] md:h-[calc(100dvh-5rem)] bg-gray-50 dark:bg-[#0B0F19] transition-colors pb-safe-nav md:pb-0">
        
        {/* Header */}
        <div className="p-3 sm:p-4 bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 flex items-center justify-between z-10 sticky top-0">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/home')} aria-label="Voltar" className="pressable text-gray-600 dark:text-gray-300 hover:text-brand w-11 h-11 -ml-2 flex items-center justify-center transition-colors rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                    <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                </button>
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-lg font-bold text-brand border border-brand/20">
                    {coach?.displayName?.[0] || 'C'}
                </div>
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-white">{coach?.displayName || 'Treinador'}</h3>
                    <p className="text-xs font-semibold text-brand">Seu treinador</p>
                </div>
            </div>

            <button
              onClick={() => setIsAIModalOpen(true)}
              className="pressable min-h-[44px] bg-brand/10 hover:bg-brand/20 text-amber-700 dark:text-brand border border-brand/30 px-4 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" /> Coach IA
            </button>
        </div>

        <ChatMessages
            messages={messages}
            userId={user.uid}
            emptyTitle="Inicie a conversa"
            emptyText="Mande uma mensagem para o seu treinador."
            className="bg-gray-50 dark:bg-[#0B0F19]"
        />

        <ChatComposer onSend={sendMessage} safeArea={false} />

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