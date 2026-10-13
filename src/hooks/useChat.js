import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    collection, query, where, orderBy, onSnapshot, 
    addDoc, setDoc, updateDoc, doc, serverTimestamp, getDoc 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import toast from 'react-hot-toast';

// O nome/foto gravados no chat na criação ficam velhos (perfil renomeado, nome de teste). Mostra sempre o perfil atual do outro
// participante: aluno vinculado (users) ou treinador (publicCoachProfiles); sem acesso, cai no que está gravado no chat.
const liveProfiles = new Map();
export const resolveLiveProfile = async (id) => {
    if (liveProfiles.has(id)) return liveProfiles.get(id);
    let found = null;
    for (const col of ['users', 'publicCoachProfiles']) {
        try {
            const snap = await getDoc(doc(db, col, id));
            if (snap.exists() && snap.data().displayName) { found = { name: snap.data().displayName, photo: snap.data().photoURL || null }; break; }
        } catch (e) { /* sem acesso a esta coleção: tenta a próxima */ }
    }
    liveProfiles.set(id, found);
    return found;
};
export const withLiveNames = (chat, uid, names) => {
    const other = chat?.participants?.find((p) => p !== uid);
    const live = other && names[other];
    if (!live) return chat;
    return { ...chat, participantData: { ...chat.participantData, [other]: { ...chat.participantData?.[other], ...live } } };
};

export const useChat = (user) => {
    const [rawChats, setChats] = useState([]);
    const [names, setNames] = useState({});
    const [rawActive, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    const userId = user?.uid;
    const chats = useMemo(() => rawChats.map((c) => withLiveNames(c, userId, names)), [rawChats, userId, names]);
    const activeChat = useMemo(() => (rawActive ? withLiveNames(rawActive, userId, names) : null), [rawActive, userId, names]);

    useEffect(() => {
        const ids = new Set();
        [...rawChats, rawActive].forEach((c) => { const o = c?.participants?.find((p) => p !== userId); if (o) ids.add(o); });
        let alive = true;
        ids.forEach(async (id) => {
            const live = await resolveLiveProfile(id);
            if (alive && live) setNames((prev) => (prev[id]?.name === live.name && prev[id]?.photo === live.photo ? prev : { ...prev, [id]: live }));
        });
        return () => { alive = false; };
    }, [rawChats, rawActive, userId]);

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
        }, (error) => {
            // Sem acesso à conversa (por exemplo, vínculo encerrado): nada de mensagens e um aviso genérico.
            console.error('Erro mensagens:', error);
            setMessages([]);
            if (error.code === 'permission-denied') toast.error('Conversa indisponível no momento (o vínculo pode ter sido encerrado).', { id: 'chat-unavailable' });
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