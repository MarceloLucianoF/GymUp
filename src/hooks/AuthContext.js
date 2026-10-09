import { createContext, useContext, useEffect, useState } from "react";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile 
} from "firebase/auth";
import { auth, db } from "../firebase/config"; 
import { doc, setDoc, getDoc } from "firebase/firestore";
import { syncPublicCoachProfile } from "../services/coachProfile";

const AuthContext = createContext();

const translateError = (code) => {
    switch (code) {
        case 'auth/email-already-in-use': return 'Este email já está em uso.';
        case 'auth/invalid-email': return 'Email inválido.';
        case 'auth/weak-password': return 'A senha deve ter pelo menos 6 caracteres.';
        case 'auth/wrong-password': return 'Senha incorreta.';
        case 'auth/user-not-found': return 'Usuário não encontrado.';
        case 'auth/too-many-requests': return 'Muitas tentativas. Tente mais tarde.';
        case 'auth/invalid-credential': return 'Credenciais inválidas.';
        default: return 'Ocorreu um erro. Tente novamente.';
    }
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    // --- 1. REGISTRO (Atualizado para aceitar dados extras) ---
    const register = async (email, password, displayName, additionalData = {}) => {
        try {
            const res = await createUserWithEmailAndPassword(auth, email, password);
            if (!res.user) throw new Error("Não foi possível criar o usuário.");

            await updateProfile(res.user, { displayName });

            const initialData = {
                uid: res.user.uid,
                displayName,
                email,
                role: "user",
                createdAt: new Date().toISOString(),
                age: null,
                weight: null,
                height: null,
                photoURL: null
            };

            // Somente campos de vínculo conhecidos podem vir do formulário.
            // Campos de autorização, identidade e auditoria nunca são sobrescritos pelo cliente.
            if (typeof additionalData.coachId === 'string' && additionalData.coachId.trim()) {
                initialData.coachId = additionalData.coachId.trim();
            }
            if (typeof additionalData.currentTrainingId === 'string' && additionalData.currentTrainingId.trim()) {
                initialData.currentTrainingId = additionalData.currentTrainingId.trim();
            }

            await setDoc(doc(db, "users", res.user.uid), initialData);

            setUser({ ...res.user, displayName }); 
            setUserProfile(initialData); 
            return res.user;
        } catch (error) {
            console.error("Erro no register:", error);
            throw new Error(translateError(error.code));
        }
    };

    // --- 2. LOGIN ---
    const login = async (email, password) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            throw new Error(translateError(error.code));
        }
    };

    // --- 3. LOGOUT ---
    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setUserProfile(null);
        } catch (error) {
            console.error("Erro ao sair:", error);
        }
    };

    // --- 4. MONITORAR STATUS ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                try {
                    const docSnap = await getDoc(doc(db, "users", firebaseUser.uid));
                    if (docSnap.exists()) {
                        setUserProfile(docSnap.data());
                        syncPublicCoachProfile(firebaseUser.uid, docSnap.data()).catch(() => {});
                    }
                } catch (error) {
                    console.error("Erro ao buscar perfil:", error);
                }
            } else {
                setUser(null);
                setUserProfile(null);
            }
            setAuthLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const value = {
        user,
        userProfile,
        authLoading, // ou 'loading' se preferir manter compatibilidade
        register,
        login,
        logout,
        translateError
    };

    return (
        <AuthContext.Provider value={value}>
            {!authLoading && children}
        </AuthContext.Provider>
    );
}

export function useAuthContext() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext deve ser usado dentro de AuthProvider');
    }
    return context;
}
