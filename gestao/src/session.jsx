import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { API_URL, auth } from './firebase';
import { createApi } from './api';
import { useToast } from './components/Toast';

const Ctx = createContext(null);
export const useSession = () => useContext(Ctx);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(undefined);   // undefined = ainda carregando
  const toast = useToast();
  const navigate = useNavigate();
  const expired = useRef(false);
  useEffect(() => onAuthStateChanged(auth, (u) => { expired.current = false; setUser(u); }), []);

  // Sessão expirada (401 mesmo depois de renovar o token): volta ao login uma única vez, avisando.
  const onSessionExpired = useCallback(() => {
    if (expired.current) return;
    expired.current = true;
    toast('Sua sessão expirou. Entre novamente.', 'error');
    signOut(auth).finally(() => navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`, { replace: true }));
  }, [toast, navigate]);

  const api = useMemo(
    () => (user ? createApi({ baseUrl: API_URL, getToken: (force) => user.getIdToken(!!force), onSessionExpired }) : null),
    [user, onSessionExpired]
  );
  return <Ctx.Provider value={{ user, api, signOut: () => signOut(auth) }}>{children}</Ctx.Provider>;
}

/** Carrega dados da API com estados de carregamento, erro e nova tentativa. Respostas atrasadas de uma consulta antiga são descartadas. */
export function useApi(fn, deps) {
  const [state, setState] = useState({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => (s.status === 'ready' ? { ...s, refreshing: true } : { status: 'loading' }));
    Promise.resolve().then(fn).then((data) => live && setState({ status: 'ready', data })).catch((error) => live && setState({ status: 'error', error }));
    return () => { live = false; };
  }, [...deps, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return [state, useCallback(() => setTick((t) => t + 1), [])];
}
