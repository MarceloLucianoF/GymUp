import React, { useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../firebase/config';
import Modal from '../common/Modal';

// --- MODAL PARA VINCULAR TREINADOR ---
const LinkCoachModal = ({ isOpen, onClose, currentUserId, onSuccess }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLink = async () => {
        const cleanCode = code.trim();
        if (!cleanCode) return toast.error("Digite o código do treinador.");
        
        setLoading(true);
        try {
            // 1. Verifica se o coach existe
            const coachRef = doc(db, 'users', cleanCode);
            const coachSnap = await getDoc(coachRef);

            if (!coachSnap.exists()) {
                throw new Error("Treinador não encontrado.");
            }

            const coachData = coachSnap.data();
            if (coachData.role !== 'coach' && coachData.role !== 'admin') {
                throw new Error("Este código não pertence a um treinador.");
            }

            // 2. Atualiza o perfil do aluno
            await updateDoc(doc(db, 'users', currentUserId), {
                coachId: cleanCode
            });

            toast.success(`Vinculado a ${coachData.displayName}!`);
            onSuccess(); // Recarrega a home
            onClose();

        } catch (error) {
            console.error(error);
            toast.error(error.message || "Erro ao vincular.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} label="Vincular treinador" className="w-full max-w-sm">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Vincular Treinador</h3>
                <p className="text-sm text-gray-500 mb-4">Peça o "Código de Convite" (UID) para seu coach e digite abaixo.</p>
                
                <input 
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Cole o código aqui..."
                    className="w-full bg-gray-100 dark:bg-gray-700 p-3 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-brand dark:text-white font-mono text-center tracking-widest text-sm"
                />

                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-gray-500 font-bold text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">Cancelar</button>
                    <button 
                        onClick={handleLink} 
                        disabled={loading}
                        className="flex-1 py-2 bg-brand hover:bg-brand-dark text-black font-bold text-sm rounded-xl shadow-lg shadow-brand/10 disabled:opacity-50"
                    >
                        {loading ? 'Vinculando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default LinkCoachModal;
