import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useChat } from '../../hooks/useChat';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MessageSquare, X, Send } from 'lucide-react';

export default function StudentChatWidget() {
    const { user } = useAuthContext();
    const { messages, sendMessage, openChatWithUser } = useChat(user);
    
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [coach, setCoach] = useState(null);
    const messagesEndRef = useRef(null);

    // 1. Buscar Coach e Inicializar Conversa
    useEffect(() => {
        const init = async () => {
            if (!user) return;
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists() && userDoc.data().coachId) {
                    const coachId = userDoc.data().coachId;
                    const coachDoc = await getDoc(doc(db, 'users', coachId));
                    if (coachDoc.exists()) {
                        const coachData = { uid: coachDoc.id, ...coachDoc.data() };
                        setCoach(coachData);
                        openChatWithUser(coachData);
                    }
                }
            } catch (err) {
                console.error("Erro no ChatWidget:", err);
            }
        };
        init();
    }, [user, openChatWithUser]);

    // Scroll automático
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        sendMessage(inputText);
        setInputText('');
    };

    // Se não tiver coach vinculado, não renderiza o widget flutuante
    if (!coach) return null;

    return (
        <>
            {/* BOTÃO FLUTUANTE DESKTOP (FAB - No mobile o chat é acessado pela Navbar) */}
            {!isOpen && (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="hidden md:flex fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-[#FFC107] to-[#FF9800] hover:from-[#FFB300] hover:to-[#FF8F00] text-black rounded-full shadow-2xl shadow-[#FFC107]/25 items-center justify-center transition-all hover:scale-110 active:scale-95 z-40 border-2 border-white dark:border-gray-900"
                    title="Abrir Chat com Treinador"
                >
                    <MessageSquare className="w-6 h-6 text-black fill-current" />
                </button>
            )}

            {/* JANELA DO CHAT */}
            {isOpen && (
                <div className="fixed bottom-20 right-2 left-2 md:left-auto md:bottom-6 md:right-6 w-auto md:w-96 h-[calc(100dvh-7rem)] md:h-[520px] bg-white dark:bg-[#1F2937] rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-200 dark:border-gray-700 animate-slide-up">
                    
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex justify-between items-center shadow-md shrink-0 border-b border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#FFC107]/20 flex items-center justify-center overflow-hidden border border-[#FFC107]/40">
                                {coach.photoURL ? (
                                    <img src={coach.photoURL} alt={coach.displayName || 'Treinador'} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-bold text-[#FFC107]">{coach.displayName?.[0]}</span>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-white">{coach.displayName}</h3>
                                <p className="text-[10px] text-[#FFC107] flex items-center gap-1 font-bold">
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Treinador
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center">
                            <X className="w-4 h-4 text-gray-300" />
                        </button>
                    </div>

                    {/* Area de Mensagens */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/60">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center p-6">
                                <MessageSquare className="w-8 h-8 text-[#FFC107] mb-2 opacity-60" />
                                <p className="font-bold text-gray-700 dark:text-gray-300 mb-1">Converse com seu Treinador</p>
                                <p className="text-gray-400">Tire suas dúvidas sobre execução ou peça ajustes nas cargas.</p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMe = msg.senderId === user.uid;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl text-xs sm:text-sm relative ${
                                            isMe 
                                            ? 'bg-gradient-to-r from-[#FFC107] to-[#FF9800] text-black font-medium rounded-tr-none shadow-sm' 
                                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none shadow-sm border border-gray-100 dark:border-gray-700'
                                        }`}>
                                            <p>{msg.text}</p>
                                            <p className={`text-[9px] mt-1 text-right font-bold ${isMe ? 'text-black/60' : 'text-gray-400'}`}>
                                                {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shrink-0">
                        <form onSubmit={handleSend} className="flex gap-2 items-center">
                            <input 
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Digite sua mensagem..."
                                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#FFC107]"
                            />
                            <button 
                                type="submit" 
                                disabled={!inputText.trim()}
                                className="w-10 h-10 btn-primary-gradient rounded-xl flex items-center justify-center shadow-sm disabled:opacity-50 transition-all active:scale-95 shrink-0"
                            >
                                <Send className="w-4 h-4 text-black" />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}