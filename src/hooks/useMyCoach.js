import { useCallback, useEffect, useState } from 'react';
import { getMyLink, linkState } from '../services/coachLinkService';
import { getPublicCoach } from '../services/coachProfile';

// Estado do vínculo do aluno com o treinador: none | pending | active | rejected | revoked.
export default function useMyCoach(uid, profile) {
  const [link, setLink] = useState(null);
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);
  const coachId = profile?.coachId || null;

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const doc = await getMyLink(uid).catch(() => null);
      setLink(doc);
      const target = coachId || (doc && doc.status !== 'revoked' ? doc.coachId : null);
      setCoach(target ? await getPublicCoach(target).catch(() => null) : null);
    } finally {
      setLoading(false);
    }
  }, [uid, coachId]);

  useEffect(() => { load(); }, [load]);

  return { state: linkState(profile, link), link, coach, loading, reload: load };
}
