import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  addDoc, collection, deleteDoc, doc, getCountFromServer, getDocs, limit, orderBy, query, updateDoc, where, writeBatch
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { FileJson } from 'lucide-react';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import { useAdmin } from '../../hooks/useAdmin';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/coach/Tabs';
import PageSkeleton from '../../components/coach/PageSkeleton';
import { btnGhost, pageCls } from '../../components/coach/styles';
import OverviewTab from './panel/OverviewTab';
import ExercisesTab from './panel/ExercisesTab';
import TrainingsTab from './panel/TrainingsTab';
import ExerciseEditor from './panel/ExerciseEditor';
import TrainingEditor from './panel/TrainingEditor';
import ImportModal from './panel/ImportModal';
import { logAdminAction } from './panel/adminLog';
import { exerciseIssues, trainingIssues, usageByTraining } from './panel/adminUtils';

const TABS = [['overview', 'Visão geral'], ['exercises', 'Exercícios'], ['trainings', 'Fichas']];
const withId = (d) => ({ firestoreId: d.id, ...d.data() });
const stamp = () => new Date().toISOString();

export default function AdminPanel() {
  const { user } = useAuthContext();
  const { confirm, dialog } = useConfirm();
  const { isAdmin, loading: authLoading } = useAdmin();
  const [tab, setTab] = useState('overview');
  const [exerciseFilters, setExerciseFilters] = useState({});
  const [filterKey, setFilterKey] = useState(0);

  const [exercises, setExercises] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [users, setUsers] = useState([]);
  const [checkins7, setCheckins7] = useState(null);
  const [log, setLog] = useState([]);
  const [logError, setLogError] = useState(false);
  const [loading, setLoading] = useState(true);

  const [exerciseEditor, setExerciseEditor] = useState(null); // { initial, id }
  const [trainingEditor, setTrainingEditor] = useState(null);
  const [importKind, setImportKind] = useState(null);

  const load = useCallback(async () => {
    try {
      const [exSnap, trSnap, userSnap] = await Promise.all([
        getDocs(collection(db, 'exercises')), getDocs(collection(db, 'trainings')), getDocs(collection(db, 'users'))
      ]);
      setExercises(exSnap.docs.map(withId));
      setTrainings(trSnap.docs.map(withId));
      setUsers(userSnap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar os dados.');
    } finally {
      setLoading(false);
    }
    // Métricas e histórico não impedem o uso do painel se falharem.
    try {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const count = await getCountFromServer(query(collection(db, 'checkIns'), where('date', '>=', since)));
      setCheckins7(count.data().count);
    } catch (error) { console.error(error); setCheckins7(null); }
    try {
      const snap = await getDocs(query(collection(db, 'adminLog'), orderBy('at', 'desc'), limit(8)));
      setLog(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLogError(false);
    } catch (error) { console.error(error); setLogError(true); }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.firestoreId, e])), [exercises]);
  const usage = useMemo(() => usageByTraining(users), [users]);
  const coachNames = useMemo(() => Object.fromEntries(users.filter((u) => u.role !== 'user').map((u) => [u.uid, u.displayName || u.email])), [users]);

  const stats = useMemo(() => ({
    exercises: exercises.filter((e) => !e.archived).length,
    archived: exercises.filter((e) => e.archived).length,
    trainings: trainings.length,
    globalTrainings: trainings.filter((t) => !t.coachId).length,
    students: users.filter((u) => u.role === 'user').length,
    coaches: users.filter((u) => u.role === 'coach' || u.role === 'admin').length,
    checkins7
  }), [exercises, trainings, users, checkins7]);

  const issues = useMemo(() => {
    const out = { 'sem-imagem': 0, 'sem-video': 0, 'sem-execucao': 0, 'sem-descricao': 0 };
    exercises.filter((e) => !e.archived).forEach((e) => exerciseIssues(e).forEach((k) => { out[k] += 1; }));
    return out;
  }, [exercises]);

  const trainingAlerts = useMemo(() => trainings.flatMap((training) =>
    trainingIssues(training, exerciseMap).filter((i) => i.id !== 'sem-midia').map((issue) => ({ training, issue }))), [trainings, exerciseMap]);

  const record = (entry) => logAdminAction(db, user, entry).then(() => load());

  // ---- exercícios ----
  const saveExercise = async (form) => {
    const t = toast.loading('Salvando...');
    try {
      const payload = { ...form, muscleGroup: String(form.muscleGroup).toLowerCase(), updatedAt: stamp() };
      if (exerciseEditor.id) {
        await updateDoc(doc(db, 'exercises', exerciseEditor.id), payload);
        await record({ action: 'editar', target: 'exercises', targetId: exerciseEditor.id, name: form.name });
      } else {
        const ref = await addDoc(collection(db, 'exercises'), { ...payload, createdAt: stamp() });
        await record({ action: exerciseEditor.copy ? 'duplicar' : 'criar', target: 'exercises', targetId: ref.id, name: form.name });
      }
      toast.success('Exercício salvo.', { id: t });
      setExerciseEditor(null);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível salvar.', { id: t });
    }
  };

  const duplicateExercise = (ex) => {
    const { firestoreId, createdAt, updatedAt, archived, ...rest } = ex; // eslint-disable-line no-unused-vars
    setExerciseEditor({ initial: { ...rest, name: `${ex.name} (cópia)` }, id: null, copy: true });
  };

  const archiveExercise = async (ex) => {
    const archived = !ex.archived;
    try {
      await updateDoc(doc(db, 'exercises', ex.firestoreId), { archived, updatedAt: stamp() });
      toast.success(archived ? 'Exercício arquivado. Ele sai das listas de escolha, mas continua nas fichas existentes.' : 'Exercício restaurado.');
      await record({ action: archived ? 'arquivar' : 'restaurar', target: 'exercises', targetId: ex.firestoreId, name: ex.name });
    } catch (error) { console.error(error); toast.error('Não foi possível alterar.'); }
  };

  const deleteExercise = async (ex) => {
    const used = trainings.filter((t) => (t.exercises || []).some((e) => e === ex.firestoreId)).length;
    const ok = await confirm({
      title: `Excluir "${ex.name}"?`,
      message: used > 0
        ? `Este exercício está em ${used} ficha(s). Excluir faz ele sumir delas. Prefira arquivar.`
        : 'A exclusão é definitiva. Se só quer tirar das listas, use Arquivar.',
      confirmLabel: 'Excluir definitivamente', danger: true
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'exercises', ex.firestoreId));
      toast.success('Exercício excluído.');
      await record({ action: 'excluir', target: 'exercises', targetId: ex.firestoreId, name: ex.name, detail: used ? `estava em ${used} ficha(s)` : '' });
    } catch (error) { console.error(error); toast.error('Não foi possível excluir.'); }
  };

  // ---- fichas ----
  const saveTraining = async (form) => {
    const t = toast.loading('Salvando...');
    try {
      const payload = { ...form, updatedAt: stamp() };
      if (trainingEditor.id) {
        await updateDoc(doc(db, 'trainings', trainingEditor.id), payload);
        await record({ action: 'editar', target: 'trainings', targetId: trainingEditor.id, name: form.name });
      } else {
        const ref = await addDoc(collection(db, 'trainings'), { ...payload, createdAt: stamp() });
        await record({ action: trainingEditor.copy ? 'duplicar' : 'criar', target: 'trainings', targetId: ref.id, name: form.name });
      }
      toast.success('Ficha salva.', { id: t });
      setTrainingEditor(null);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível salvar.', { id: t });
    }
  };

  const duplicateTraining = (tr) => setTrainingEditor({
    initial: { name: `${tr.name} (cópia)`, description: tr.description || '', difficulty: tr.difficulty || 'Intermediário', exercises: tr.exercises || [] }, id: null, copy: true
  });

  const deleteTraining = async (tr, students) => {
    const ok = await confirm({
      title: `Excluir a ficha "${tr.name}"?`,
      message: students > 0 ? `${students} aluno(s) usam esta ficha e ficarão sem treino atribuído.` : 'A exclusão é definitiva.',
      confirmLabel: 'Excluir ficha', danger: true
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'trainings', tr.firestoreId));
      toast.success('Ficha excluída.');
      await record({ action: 'excluir', target: 'trainings', targetId: tr.firestoreId, name: tr.name, detail: students ? `${students} aluno(s) usavam` : '' });
    } catch (error) { console.error(error); toast.error('Não foi possível excluir.'); }
  };

  // ---- importação ----
  const confirmImport = async (report) => {
    const t = toast.loading('Importando...');
    try {
      let byOldId = {};
      if (importKind === 'trainings') {
        exercises.forEach((e) => { if (e.originalId) byOldId[String(e.originalId)] = e.firestoreId; });
      }
      const batch = writeBatch(db);
      report.novos.forEach((item) => {
        const data = { ...item, createdAt: stamp(), updatedAt: stamp(), originalId: item.id ? String(item.id) : null };
        delete data.id;
        if (importKind === 'exercises') data.muscleGroup = String(data.muscleGroup).toLowerCase();
        if (importKind === 'trainings' && Array.isArray(item.exercises)) data.exercises = item.exercises.map((old) => byOldId[String(old)] || old).filter(Boolean);
        batch.set(doc(collection(db, importKind)), data);
      });
      await batch.commit();
      toast.success(`${report.novos.length} importado(s).`, { id: t });
      await record({ action: 'importar', target: importKind, name: `${report.novos.length} itens`, detail: `${report.duplicados.length} duplicados e ${report.invalidos.length} inválidos ignorados` });
      setImportKind(null);
    } catch (error) {
      console.error(error);
      toast.error('Falha na importação. Nada foi gravado.', { id: t });
    }
  };

  const goTo = (next, filters = {}) => { setExerciseFilters(filters); setFilterKey((k) => k + 1); setTab(next); };

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/home" />;

  const tabLabel = TABS.find(([id]) => id === tab)?.[1];

  return (
    <div className={pageCls}>
      {dialog}
      <div className="mx-auto max-w-6xl space-y-5">
        <nav aria-label="Você está em" className="text-xs font-semibold text-gray-600 dark:text-gray-400">Administração <span aria-hidden="true">/</span> <span className="text-gray-900 dark:text-white">{tabLabel}</span></nav>
        <PageHeader
          title="Painel administrativo"
          subtitle="Gerencie exercícios, fichas e o conteúdo do aplicativo."
          actions={<button type="button" onClick={() => setImportKind(tab === 'trainings' ? 'trainings' : 'exercises')} className={btnGhost}><FileJson className="h-4 w-4" aria-hidden="true" /> Importar JSON</button>}
        />
        <Tabs tabs={TABS.map(([id, label]) => ({ id, label: id === 'exercises' ? `${label} (${stats.exercises})` : id === 'trainings' ? `${label} (${stats.trainings})` : label }))} value={tab} onChange={setTab} />

        {loading ? <PageSkeleton cards={3} /> : (
          <>
            {tab === 'overview' && (
              <OverviewTab
                stats={stats} issues={issues} trainingAlerts={trainingAlerts} log={log} logError={logError} adminNames={coachNames}
                onGo={goTo}
                onNewExercise={() => setExerciseEditor({ initial: {}, id: null })}
                onNewTraining={() => setTrainingEditor({ initial: {}, id: null })}
              />
            )}
            {tab === 'exercises' && (
              <ExercisesTab
                key={filterKey} exercises={exercises} initialFilters={exerciseFilters}
                onNew={() => setExerciseEditor({ initial: {}, id: null })}
                onEdit={(ex) => setExerciseEditor({ initial: ex, id: ex.firestoreId })}
                onDuplicate={duplicateExercise} onArchive={archiveExercise} onDelete={deleteExercise}
              />
            )}
            {tab === 'trainings' && (
              <TrainingsTab
                trainings={trainings} exerciseMap={exerciseMap} usage={usage} coachNames={coachNames}
                onNew={() => setTrainingEditor({ initial: {}, id: null })}
                onEdit={(tr) => setTrainingEditor({ initial: tr, id: tr.firestoreId })}
                onDuplicate={duplicateTraining} onDelete={deleteTraining}
              />
            )}
          </>
        )}
      </div>

      {exerciseEditor && (
        <ExerciseEditor initial={exerciseEditor.initial} existing={exercises} editingId={exerciseEditor.id} onSave={saveExercise} onClose={() => setExerciseEditor(null)} />
      )}
      {trainingEditor && (
        <TrainingEditor initial={trainingEditor.initial} exercises={exercises} exerciseMap={exerciseMap} editingId={trainingEditor.id} onSave={saveTraining} onClose={() => setTrainingEditor(null)} />
      )}
      {importKind && <ImportModal kind={importKind} existing={importKind === 'exercises' ? exercises : trainings} onConfirm={confirmImport} onClose={() => setImportKind(null)} />}
    </div>
  );
}
