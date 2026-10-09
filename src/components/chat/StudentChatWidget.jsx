import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useChat } from '../../hooks/useChat';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MessageSquare, X } from 'lucide-react';
import ChatMessages from './ChatMessages';
import ChatComposer from './ChatComposer';
import { getPublicCoach } from '../../services/coachProfile';

export default function StudentChatWidget() {
    const { user } = useAuthContext();
    const { messages, sendMessage, openChatWithUser } = useChat(user);
    
    const [isOpen, setIsOpen] = useState(false);
    const [coach, setCoach] = useState(null);

    // 1. Buscar Coach e Inicializar Conversa
    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            if (!user?.uid) return;
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists() && userDoc.data().coachId) {
                    const coachId = userDoc.data().coachId;
                    const coachData = await getPublicCoach(coachId);
                    if (coachData && isMounted) {
                        setCoach(coachData);
                        openChatWithUser(coachData);
                    }
                }
            } catch (err) {
                console.error("Erro no ChatWidget:", err);
            }
        };
        init();
        return () => { isMounted = false; };
    }, [user?.uid, openChatWithUser]);

    // Se não tiver coach vinculado, não renderiza o widget flutuante
    if (!coach) return null;

    return (
        <>
            {/* FAB desktop (no mobile o chat é acessado pela Navbar) */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    aria-label="Abrir chat com o treinador"
                    className="pressable hidden md:flex fixed bottom-6 right-6 w-14 h-14 btn-primary-gradient rounded-full shadow-2xl shadow-brand/25 items-center justify-center z-40 hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
                >
                    <MessageSquare className="w-6 h-6" aria-hidden="true" />
                </button>
            )}

            {isOpen && (
                <section
                    role="dialog"
                    aria-label={`Chat com ${coach.displayName || 'treinador'}`}
                    className="surface fixed bottom-20 right-2 left-2 md:left-auto md:bottom-6 md:right-6 md:w-96 h-[calc(100dvh-7rem)] md:h-[520px] flex flex-col z-50 overflow-hidden !rounded-3xl shadow-2xl animate-slide-up"
                >
                    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 p-3 dark:border-white/10">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand/30 bg-brand/15">
                                {coach.photoURL ? (
                                    <img src={coach.photoURL} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <span className="font-bold text-brand">{coach.displayName?.[0]}</span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">{coach.displayName}</h3>
                                <p className="text-xs font-semibold text-brand">Seu treinador</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            aria-label="Fechar chat"
                            className="pressable flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </header>

                    <ChatMessages
                        messages={messages}
                        userId={user.uid}
                        emptyTitle="Converse com seu treinador"
                        emptyText="Tire dúvidas sobre execução ou peça ajustes nas cargas."
                    />
                    <ChatComposer onSend={sendMessage} />
                </section>
            )}
        </>
    );
}
