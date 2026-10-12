import { createContext, useContext, useEffect, useRef, useState } from "react";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    browserPopupRedirectResolver
} from "firebase/auth";
import { auth, db, ensureAppCheck, markSession } from "../firebase/config"; 
import { doc, setDoc, getDoc } from "firebase/firestore";
import { syncPublicCoachProfile } from "../services/coachProfile";

// Versão do texto de Termos/Privacidade aceito no cadastro (atualize ao mudar os textos).
export const TERMS_VERSION = '2026-10';

const AuthContext = createContext();

const translateError = (code) => {
    switch (code) {
        case 'auth/email-already-in-use': return 'Este email já está em uso.';
        case 'auth/invalid-email': return 'Email inválido.';
        case 'auth/weak-password': return 'Senha fraca: use ao menos 8 caracteres, com maiúscula, número e símbolo.';
        case 'auth/password-does-not-meet-requirements': return 'Senha fraca: use ao menos 8 caracteres, com maiúscula, número e símbolo.';
        // Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails têm conta.
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-credential': return 'E-mail ou senha incorretos.';
        case 'auth/too-many-requests': return 'Muitas tentativas. Tente mais tarde.';
        case 'auth/popup-blocked': return 'O navegador bloqueou a janela do Google. Libere pop-ups e tente de novo.';
        case 'auth/account-exists-with-different-credential': return 'Já existe uma conta com este e-mail. Entre com e-mail e senha.';
        case 'auth/operation-not-allowed': return 'Login com Google ainda não está ativado.';
        case 'auth/unauthorized-domain': return 'Este endereço não está autorizado para login com Google.';
        case 'auth/network-request-failed': return 'Sem conexão. Verifique a internet e tente de novo.';
        default: return 'Ocorreu um erro. Tente novamente.';
    }
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    // Enquanto o perfil do primeiro login com Google é criado, o monitor de sessão não deve tratá-lo como "sem perfil".
    const creatingProfile = useRef(false);

    // --- 1. REGISTRO (Atualizado para aceitar dados extras) ---
    const register = async (email, password, displayName, additionalData = {}) => {
        ensureAppCheck();
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
            // Convite de treinador: vira uma SOLICITAÇÃO (coachLinks). O vínculo só vale depois do aceite dele.
            const inviteCoachId = typeof additionalData.coachId === 'string' ? additionalData.coachId.trim() : '';
            // Aceite dos termos (a tela de cadastro só envia com o checkbox marcado).
            if (additionalData.acceptedTerms === true) {
                initialData.termsAcceptedAt = new Date().toISOString();
                initialData.termsVersion = TERMS_VERSION;
            }
            if (typeof additionalData.currentTrainingId === 'string' && additionalData.currentTrainingId.trim()) {
                initialData.currentTrainingId = additionalData.currentTrainingId.trim();
            }

            await setDoc(doc(db, "users", res.user.uid), initialData);
            if (inviteCoachId) {
                const stamp = new Date().toISOString();
                try {
                    await setDoc(doc(db, "coachLinks", res.user.uid), {
                        studentId: res.user.uid, studentName: String(displayName || 'Aluno').slice(0, 100), coachId: inviteCoachId,
                        status: 'pending', requestedBy: 'student', createdAt: stamp, updatedAt: stamp
                    });
                } catch (linkError) {
                    console.error('Convite não registrado (a conta foi criada):', linkError);
                }
            }

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
        ensureAppCheck();
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            throw new Error(translateError(error.code));
        }
    };

    // --- 2b. LOGIN COM GOOGLE ---
    // O primeiro acesso cria o perfil de aluno (o aceite dos termos é o próprio clique, com o aviso visível na tela).
    const loginWithGoogle = async () => {
        ensureAppCheck();
        creatingProfile.current = true;
        try {
            const res = await signInWithPopup(auth, new GoogleAuthProvider(), browserPopupRedirectResolver);
            const ref = doc(db, "users", res.user.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                setUser(res.user);
                setUserProfile(snap.data());
                syncPublicCoachProfile(res.user.uid, snap.data()).catch(() => {});
            } else {
                const initialData = {
                    uid: res.user.uid,
                    displayName: res.user.displayName || (res.user.email || '').split('@')[0] || 'Aluno',
                    email: res.user.email || '',
                    role: "user",
                    createdAt: new Date().toISOString(),
                    age: null,
                    weight: null,
                    height: null,
                    photoURL: null,
                    termsAcceptedAt: new Date().toISOString(),
                    termsVersion: TERMS_VERSION
                };
                await setDoc(ref, initialData);
                setUser(res.user);
                setUserProfile(initialData);
            }
            return res.user;
        } catch (error) {
            if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') return null;
            console.error("Erro no login com Google:", error);
            throw new Error(translateError(error.code));
        } finally {
            creatingProfile.current = false;
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
            markSession(!!firebaseUser);
            if (firebaseUser) {
                ensureAppCheck();
                setUser(firebaseUser);
                try {
                    if (creatingProfile.current) { setAuthLoading(false); return; }
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
        loginWithGoogle,
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
