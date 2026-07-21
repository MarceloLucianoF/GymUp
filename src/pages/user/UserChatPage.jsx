import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useChat } from '../../hooks/useChat';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ArrowLeft, Send, ShieldAlert } from 'lucide-react';

export default function UserChatPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { chats, messages, activeChat, setActiveChat, sendMessage, openChatWithUser, loading } = useChat(user);
  
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const [coach, setCoach] = useState(null);

  // 1. Identificar o Coach do aluno e abrir o chat
  useEffect(() => {
      const initChat = async () => {
          if (!user) return;

          // Busca perfil para ver quem é o coach
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData.coachId) {
                  // Busca dados do Coach
                  const coachDoc = await getDoc(doc(db, 'users', userData.coachId));
                  if (coachDoc.exists()) {
                      const coachData = { uid: coachDoc.id, ...coachDoc.data() };
                      setCoach(coachData);
                      // Abre ou Cria o chat com o coach
                      openChatWithUser(coachData); 
                  }
              }
          }
      };
      initChat();
  }, [user]);

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e) => {
      e.preventDefault();
      sendMessage(inputText);
      setInputText('');
  };

  const formatTime = (timestamp) => {
      if (!timestamp) return '';
      return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#FFC107]"></div></div>;

  // Se não tem coach vinculado
  if (!coach && !loading && !activeChat) {
      return (
          <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 text-center">
              <ShieldAlert className="w-16 h-16 text-gray-400 mb-4 opacity-50 mx-auto" />
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Sem Treinador Vinculado</h2>
              <p className="text-gray-500 max-w-xs mb-6">Peça o código de convite ao seu treinador para iniciar uma conversa.</p>
              <button onClick={() => navigate('/home')} className="bg-[#FFC107] hover:bg-[#FFB300] text-black px-6 py-3 rounded-xl font-bold transition-colors">Voltar ao Início</button>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
        
        {/* Header */}
        <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-sm z-10 sticky top-0">
            <button onClick={() => navigate('/home')} className="text-gray-500 hover:text-[#FFC107] pr-2 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-full bg-[#FFC107]/10 flex items-center justify-center text-lg font-bold text-[#FFC107] border border-[#FFC107]/20">
                {coach?.displayName?.[0] || 'C'}
            </div>
            <div>
                <h3 className="font-bold text-gray-800 dark:text-white">{coach?.displayName || 'Treinador'}</h3>
                <p className="text-xs text-green-500 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online
                </p>
            </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
            {messages.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm">
                    <p>Inicie a conversa com seu treinador. 👋</p>
                </div>
            )}
            
            {messages.map((msg) => {
                const isMe = msg.senderId === user.uid;
                return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm relative group ${
                            isMe 
                            ? 'bg-[#FFC107] text-black rounded-tr-none' 
                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-200 dark:border-gray-700'
                        }`}>
                            <p className="leading-relaxed">{msg.text}</p>
                            <p className={`text-[9px] mt-1 text-right opacity-70 ${isMe ? 'text-black/85' : 'text-gray-400'}`}>
                                {formatTime(msg.createdAt)}
                            </p>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto items-center">
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-3 rounded-full focus:ring-2 focus:ring-[#FFC107] outline-none transition-all"
                />
                <button 
                    type="submit" 
                    disabled={!inputText.trim()}
                    className="bg-[#FFC107] hover:bg-[#FFB300] text-black p-3 rounded-full shadow-lg shadow-[#FFC107]/10 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-12 h-12 flex items-center justify-center shrink-0"
                >
                    <Send className="w-5 h-5 text-black" />
                </button>
            </form>
        </div>
    </div>
  );
}