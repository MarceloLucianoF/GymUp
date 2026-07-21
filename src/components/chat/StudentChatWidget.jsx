import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useChat } from '../../hooks/useChat';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MessageSquare, X, Send } from 'lucide-react';

export default function StudentChatWidget() {
    const { user } = useAuthContext();
    const { messages, activeChat, sendMessage, openChatWithUser } = useChat(user);
    
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [coach, setCoach] = useState(null);
    const messagesEndRef = useRef(null);

    // 1. Buscar Coach e Inicializar Conversa
    useEffect(() => {
        const init = async () => {
            if (!user) return;
            // Busca coachId no perfil
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().coachId) {
                const coachId = userDoc.data().coachId;
                // Busca dados do Coach
                const coachDoc = await getDoc(doc(db, 'users', coachId));
                if (coachDoc.exists()) {
                    const coachData = { uid: coachDoc.id, ...coachDoc.data() };
                    setCoach(coachData);
                    // Garante que o chat ativo esteja setado
                    openChatWithUser(coachData);
                }
            }
        };
        init();
    }, [user, isOpen]); // Tenta reconectar ao abrir

    // Scroll automático
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    const handleSend = (e) => {
        e.preventDefault();
        sendMessage(inputText);
        setInputText('');
    };

    // Se não tiver coach vinculado, nem mostra o widget (ou mostra estado vazio)
    if (!coach) return null;

    return (
        <>
            {/* BOTÃO FLUTUANTE (FAB) */}
            {!isOpen && (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 z-50 animate-bounce-in"
                >
                    <MessageSquare className="w-6 h-6 text-white" />
                </button>
            )}

            {/* JANELA DO CHAT */}
            {isOpen && (
                <div className="fixed bottom-0 right-0 md:bottom-6 md:right-6 w-full md:w-96 h-[100dvh] md:h-[500px] bg-white dark:bg-gray-800 md:rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-200 dark:border-gray-700 animate-slide-up">
                    
                    {/* Header */}
                    <div className="p-4 bg-blue-600 text-white flex justify-between items-center shadow-md shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border border-white/30">
                                {coach.photoURL ? (
                                    <img src={coach.photoURL} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-bold">{coach.displayName[0]}</span>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">{coach.displayName}</h3>
                                <p className="text-[10px] text-blue-100 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span> Treinador
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center">
                            <X className="w-4 h-4 text-white" />
                        </button>
                    </div>

                    {/* Area de Mensagens */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center p-6">
                                <p className="text-2xl mb-2">👋</p>
                                <p>Tire suas dúvidas ou peça feedback do seu treino.</p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMe = msg.senderId === user.uid;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm relative ${
                                            isMe 
                                            ? 'bg-blue-600 text-white rounded-tr-none' 
                                            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none shadow-sm border border-gray-100 dark:border-gray-600'
                                        }`}>
                                            <p>{msg.text}</p>
                                            <p className={`text-[9px] mt-1 text-right opacity-70 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
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
                                placeholder="Digite..."
                                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button 
                                type="submit" 
                                disabled={!inputText.trim()}
                                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-sm disabled:opacity-50 transition-all active:scale-95 shrink-0"
                            >
                                <Send className="w-4 h-4 text-white" />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}