import { useCallback, useEffect, useState } from 'react';
import { getSocialProfile, listFriendships, otherOf } from '../services/socialService';
import { loadRanking, syncPublicStats } from '../services/socialService';

// Estado social do aluno: meu perfil público, amizades (com nomes) e ranking de consistência.
export default function useSocial(uid) {
  const [state, setState] = useState({ loading: true, error: false, profile: null, friendships: [], people: {}, ranking: { participating: false, rows: [] } });

  const reload = useCallback(async () => {
    if (!uid) return;
    try {
      const [profile, friendships] = await Promise.all([getSocialProfile(uid), listFriendships(uid)]);
      const others = [...new Set(friendships.filter((f) => f.status !== 'removed').map((f) => otherOf(f, uid)))];
      const people = {};
      await Promise.all(others.map(async (id) => { try { const p = await getSocialProfile(id); if (p) people[id] = p; } catch (_) { /* sem permissão: mostra genérico */ } }));
      if (profile?.shareRanking) { try { await syncPublicStats(uid); } catch (_) { /* o ranking mostra o que houver */ } }
      const ranking = await loadRanking(uid, profile, friendships);
      setState({ loading: false, error: false, profile, friendships, people, ranking });
    } catch (error) {
      console.error('Erro social:', error);
      setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, [uid]);

  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
