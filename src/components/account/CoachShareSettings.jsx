import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import SwitchRow from '../ui/Switch';
import { getCoachShare, saveCoachShare, shareCovers, SHARE_ITEMS } from '../../services/coachShare';

// "O que meu treinador vê": o aluno liga e desliga treinos próprios e peso/medidas/fotos. Vale só para o treinador atual.
export default function CoachShareSettings({ uid, coachId }) {
  const [share, setShare] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!uid || !coachId) return undefined;
    getCoachShare(uid).then((s) => { if (alive) { setShare(s); setLoaded(true); } }).catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [uid, coachId]);

  if (!coachId) return null;
  const on = (key) => shareCovers(share, coachId, key);
  const toggle = async (key, value) => {
    setBusy(true);
    try {
      const next = { workouts: on('workouts'), measurements: on('measurements'), [key]: value };
      setShare(await saveCoachShare(uid, coachId, next));
      toast.success(value ? 'Compartilhado com seu treinador.' : 'Seu treinador deixou de ver isso.');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl bg-gray-50 p-4 dark:bg-white/5" aria-labelledby="share-title">
      <p id="share-title" className="text-sm font-bold text-gray-900 dark:text-white">O que seu treinador vê</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Ele sempre vê os treinos que você concluiu (cargas, séries e frequência), porque é a base do acompanhamento. O resto você escolhe:
      </p>
      <div className="divide-y divide-gray-200 dark:divide-white/10">
        {Object.entries(SHARE_ITEMS).map(([key, [label, hint]]) => (
          <SwitchRow key={key} label={label} hint={hint} checked={on(key)} disabled={!loaded || busy} onChange={(v) => toggle(key, v)} />
        ))}
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Avaliações físicas e anamnese têm autorização própria em <Link to="/measurements/saude" className="font-bold underline">Avaliações e anamnese</Link>.
        Trocar ou encerrar o vínculo encerra tudo isso.
      </p>
    </div>
  );
}
