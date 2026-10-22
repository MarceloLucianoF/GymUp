import React, { useCallback, useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '../../../components/common/EmptyState';
import { REPORT_REASONS, listReports, resolveReports } from '../../../services/feedService';
import { postLine } from '../../../utils/feed';

const REASON = Object.fromEntries(REPORT_REASONS);
const btn = 'pressable inline-flex min-h-[44px] items-center rounded-xl px-3 text-xs font-bold';

// Fila de denúncias do feed: o admin vê o post (título e números, nunca carga ou saúde) e decide remover ou dispensar.
export default function ReportsSection({ names }) {
  const [state, setState] = useState({ loading: true, error: false, groups: [] });
  const load = useCallback(async () => {
    try { setState({ loading: false, error: false, groups: await listReports() }); }
    catch (error) { console.error(error); setState({ loading: false, error: true, groups: [] }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (group, removePost) => {
    try { await resolveReports(group, { removePost }); toast.success(removePost ? 'Publicação removida.' : 'Denúncias dispensadas.'); load(); }
    catch (error) { console.error(error); toast.error('Não foi possível concluir.'); }
  };

  return (
    <section className="surface p-5" aria-labelledby="soc-reports">
      <h2 id="soc-reports" className="mb-3 flex items-center gap-2 font-display text-lg font-black text-gray-900 dark:text-white"><Flag className="h-5 w-5 text-amber-800 dark:text-brand" aria-hidden="true" /> Denúncias do feed</h2>
      {state.loading ? <p className="text-sm text-gray-600 dark:text-gray-400">Carregando…</p>
        : state.error ? <p className="text-sm text-gray-600 dark:text-gray-400">Não foi possível carregar as denúncias.</p>
          : state.groups.length === 0 ? <EmptyState icon={Flag} title="Nenhuma denúncia" description="Quando alguém denunciar uma publicação da aba Atividade, ela aparece aqui." /> : (
            <ul className="space-y-3">
              {state.groups.map((g) => (
                <li key={g.postId} className="rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
                  <p className="text-sm text-gray-900 dark:text-white"><b>{names[g.authorId] || 'Usuário'}</b> · {g.post ? <><b>{g.post.title}</b> <span className="text-xs text-gray-600 dark:text-gray-400">({postLine(g.post)})</span></> : <i>publicação já apagada</i>}</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">{g.reports.length} {g.reports.length === 1 ? 'denúncia' : 'denúncias'}: {g.reports.map((r) => REASON[r.reason] || r.reason).join(', ')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {g.post && <button type="button" onClick={() => act(g, true)} className={`${btn} bg-rose-600 text-white`}>Remover publicação</button>}
                    <button type="button" onClick={() => act(g, false)} className={`${btn} bg-gray-200 text-gray-900 dark:bg-white/10 dark:text-white`}>Dispensar</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
    </section>
  );
}
