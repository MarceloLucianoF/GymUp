import { useState, useEffect, useCallback } from 'react';
import { 
    collection, query, where, orderBy, onSnapshot, 
    addDoc, setDoc, updateDoc, doc, serverTimestamp, getDoc 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import toast from 'react-hot-toast';

export const useChat = (user) => {
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    const userId = user?.uid;

    // 1. Carregar Chats (Para o Coach ver a lista ordenada)
    useEffect(() => {
        if (!userId) {
            setChats([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'chats'), 
            where('participants', 'array-contains', userId),
            orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chatList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setChats(chatList);
            setLoading(false);
        }, (error) => {
            console.error("Erro chat list:", error);
            if (error.code !== 'permission-denied') setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    // 2. Carregar Mensagens (Do chat ativo)
    useEffect(() => {
        if (!activeChat?.id) {
            setMessages([]);
            return;
        }

        const q = query(
            collection(db, 'chats', activeChat.id, 'messages'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [activeChat?.id]);

    // 3. Enviar Mensagem (Atualizando o Pai)
    const sendMessage = useCallback(async (text) => {
        if (!activeChat || !text.trim() || !user) return;

        try {
            await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
                text,
                senderId: user.uid,
                createdAt: serverTimestamp(),
                senderName: user.displayName || 'Usuário'
            });

            await updateDoc(doc(db, 'chats', activeChat.id), {
                lastMessage: text,
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error("Erro ao enviar:", error);
            toast.error("Não foi possível enviar.");
        }
    }, [activeChat, user]);

    // 4. Abrir Chat (ID Determinístico para evitar duplicidade)
    const openChatWithUser = useCallback(async (targetUser) => {
        if (!user || !targetUser?.uid) return;

        const sortedIds = [user.uid, targetUser.uid].sort();
        const deterministicId = `${sortedIds[0]}_${sortedIds[1]}`;

        try {
            const chatDocRef = doc(db, 'chats', deterministicId);
            const chatSnap = await getDoc(chatDocRef);

            if (!chatSnap.exists()) {
                const newChatData = {
                    participants: [user.uid, targetUser.uid],
                    participantData: {
                        [user.uid]: { name: user.displayName || '', photo: user.photoURL || '' },
                        [targetUser.uid]: { name: targetUser.displayName || '', photo: targetUser.photoURL || '' }
                    },
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastMessage: ''
                };
                await setDoc(chatDocRef, newChatData);
                setActiveChat({ id: deterministicId, ...newChatData });
            } else {
                setActiveChat({ id: deterministicId, ...chatSnap.data() });
            }
        } catch (error) {
            console.error("Erro openChat:", error);
            toast.error("Erro ao conectar.");
        }
    }, [user]);

    return { chats, messages, activeChat, setActiveChat, sendMessage, openChatWithUser, loading };
};