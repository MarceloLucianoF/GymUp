import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { API_URL, auth } from './firebase';
import { createApi } from './api';

const Ctx = createContext(null);
export const useSession = () => useContext(Ctx);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(undefined);   // undefined = ainda carregando
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const api = useMemo(() => (user ? createApi({ baseUrl: API_URL, getToken: () => user.getIdToken() }) : null), [user]);
  return <Ctx.Provider value={{ user, api }}>{children}</Ctx.Provider>;
}

// Carrega dados da API com estados de carregamento, erro e nova tentativa.
export function useApi(fn, deps) {
  const [state, setState] = useState({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    fn().then((data) => live && setState({ status: 'ready', data })).catch((error) => live && setState({ status: 'error', error }));
    return () => { live = false; };
  }, [...deps, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return [state, () => setTick((t) => t + 1)];
}
