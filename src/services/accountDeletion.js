import {
  collection, query, where, getDocs, getDoc, doc, writeBatch, deleteDoc
} from 'firebase/firestore';
import {
  EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, deleteUser, browserPopupRedirectResolver
} from 'firebase/auth';
import { db } from '../firebase/config';

const BATCH_SIZE = 400; // limite do Firestore é 500 operações por lote

// Etapas exibidas ao usuário, na ordem em que acontecem.
export const DELETION_STEPS = [
  { id: 'reauth', label: 'Confirmando sua identidade' },
  { id: 'checkIns', label: 'Apagando treinos realizados' },
  { id: 'measurements', label: 'Apagando medidas' },
  { id: 'chats', label: 'Apagando conversas' },
  { id: 'trainings', label: 'Apagando fichas criadas por IA' },
  { id: 'notes', label: 'Apagando anotações do treinador sobre você' },
  { id: 'social', label: 'Apagando perfil social e amizades' },
  { id: 'profile', label: 'Apagando perfil' },
  { id: 'login', label: 'Encerrando o login' }
];

export const chunk = (items, size = BATCH_SIZE) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const realDeps = { db, collection, query, where, getDocs, getDoc, doc, writeBatch, deleteDoc };

const deleteRefs = async (refs, deps) => {
  for (const group of chunk(refs)) {
    const batch = deps.writeBatch(deps.db);
    group.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return refs.length;
};

const refsOf = async (deps, collectionName, ...constraints) => {
  const snap = await deps.getDocs(deps.query(deps.collection(deps.db, collectionName), ...constraints));
  return snap.docs;
};

// Apaga os dados do aluno no Firestore. A ordem importa: o perfil (que dá o papel nas regras) é o último.
export async function deleteUserData(uid, { onStep = () => {}, deps = realDeps } = {}) {
  if (!uid) throw new Error('Usuário inválido.');
  const counts = {};
  const run = async (id, fn) => {
    onStep(id, 'running');
    try {
      counts[id] = await fn();
    } catch (error) {
      onStep(id, 'error');
      const wrapped = new Error(`Falha na etapa "${id}": ${error?.code || error?.message || 'erro desconhecido'}`);
      wrapped.step = id;
      wrapped.cause = error;
      throw wrapped;
    }
    onStep(id, 'done');
  };

  await run('checkIns', async () => {
    const removed = await deleteRefs((await refsOf(deps, 'checkIns', deps.where('userId', '==', uid))).map((d) => d.ref), deps);
    // O contador de check-ins (userStats) também é dado do aluno.
    try { await deps.deleteDoc(deps.doc(deps.db, 'userStats', uid)); } catch (_) { /* inexistente */ }
    return removed;
  });
  await run('measurements', async () => deleteRefs((await refsOf(deps, 'measurements', deps.where('userId', '==', uid))).map((d) => d.ref), deps));

  const knownCoachIds = new Set(); // treinadores que podem ter notas sobre o aluno

  await run('chats', async () => {
    const chats = await refsOf(deps, 'chats', deps.where('participants', 'array-contains', uid));
    let total = 0;
    for (const chat of chats) {
      (chat.data?.().participants || []).forEach((id) => { if (id && id !== uid) knownCoachIds.add(id); });
      // Mensagens primeiro: apagar o pai deixaria a subcoleção órfã.
      const messages = await deps.getDocs(deps.collection(deps.db, 'chats', chat.id, 'messages'));
      total += await deleteRefs(messages.docs.map((d) => d.ref), deps);
      await deps.deleteDoc(chat.ref);
      total += 1;
    }
    return total;
  });

  await run('trainings', async () => {
    const own = await refsOf(deps, 'trainings', deps.where('createdBy', '==', uid));
    // Só fichas geradas por IA do próprio aluno (as regras não permitem apagar as demais).
    const mine = own.filter((d) => d.data().isAIGenerated === true && !d.data().coachId);
    return deleteRefs(mine.map((d) => d.ref), deps);
  });

  // Notas privadas do treinador (coachNotes/{coachId}_{uid}). O aluno não consegue ler nem listar essas notas,
  // então apaga pelo ID, para o treinador do perfil e para os das conversas. Doc inexistente nega por regra: é ignorado.
  await run('notes', async () => {
    try {
      const profile = await deps.getDoc(deps.doc(deps.db, 'users', uid));
      const coachId = profile?.exists?.() ? profile.data()?.coachId : null;
      if (coachId) knownCoachIds.add(coachId);
    } catch { /* sem perfil legível: segue só com os treinadores das conversas */ }
    let removed = 0;
    for (const coachId of knownCoachIds) {
      try {
        await deps.deleteDoc(deps.doc(deps.db, 'coachNotes', `${coachId}_${uid}`));
        removed += 1;
      } catch (error) {
        if (error?.code !== 'permission-denied') throw error;
      }
    }
    return removed;
  });

  // Perfil social, @usuário, código de amigo e amizades. As regras só deixam apagar amizades junto com o documento do usuário
  // (existsAfter), para ninguém zerar espera/recusas: elas vão no mesmo lote do passo 'profile'.
  const leftover = [];
  await run('social', async () => {
    let removed = 0;
    const tryDelete = async (ref) => {
      try { await deps.deleteDoc(ref); removed += 1; } catch (error) { if (error?.code !== 'permission-denied') throw error; }
    };
    try {
      const profile = await deps.getDoc(deps.doc(deps.db, 'publicProfiles', uid));
      if (profile?.exists?.()) {
        const data = profile.data() || {};
        await tryDelete(deps.doc(deps.db, 'publicProfiles', uid));
        if (data.handle) await tryDelete(deps.doc(deps.db, 'handles', data.handle));
        if (data.friendCode) await tryDelete(deps.doc(deps.db, 'friendCodes', data.friendCode));
      }
    } catch (error) { if (error?.code !== 'permission-denied') throw error; }
    await tryDelete(deps.doc(deps.db, 'publicStats', uid));
    // Resumos semanais do aluno (números e texto): são dados dele.
    for (const d of await refsOf(deps, 'weeklySummaries', deps.where('uid', '==', uid))) await tryDelete(d.ref);
    for (const field of ['userA', 'userB']) {
      const docs = await refsOf(deps, 'friendships', deps.where(field, '==', uid));
      for (const d of docs) {
        leftover.push(d.ref); // as regras só deixam apagar amizades junto com users/{uid}
      }
    }
    // Registro das próprias ações sociais: só pode ser apagado depois que o perfil social some.
    const logs = await refsOf(deps, 'socialLog', deps.where('uid', '==', uid));
    for (const group of chunk(logs)) for (const d of group) await tryDelete(d.ref);
    return removed + leftover.length;
  });

  await run('profile', async () => {
    const batch = deps.writeBatch(deps.db);
    leftover.slice(0, 450).forEach((ref) => batch.delete(ref));
    batch.delete(deps.doc(deps.db, 'users', uid));
    await batch.commit();
    return 1;
  });
  return counts;
}

// Remove do navegador tudo que é deste usuário/app (preferências, fila offline, rascunho de treino).
export function purgeLocalData(uid, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return 0;
  const doomed = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && (key.includes(uid) || /^(academyup|bt_)/.test(key))) doomed.push(key);
  }
  doomed.forEach((key) => storage.removeItem(key));
  return doomed.length;
}

export const providerOf = (user) => {
  const ids = (user?.providerData || []).map((p) => p.providerId);
  if (ids.includes('password')) return 'password';
  if (ids.includes('google.com')) return 'google';
  return 'unknown';
};

export async function reauthenticate(user, { password } = {}) {
  const provider = providerOf(user);
  if (provider === 'password') {
    if (!password) throw Object.assign(new Error('Informe sua senha.'), { code: 'app/missing-password' });
    return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  }
  if (provider === 'google') return reauthenticateWithPopup(user, new GoogleAuthProvider(), browserPopupRedirectResolver);
  throw Object.assign(new Error('Método de login não suportado para exclusão automática.'), { code: 'app/unsupported-provider' });
}

export const friendlyDeletionError = (error) => {
  const code = error?.cause?.code || error?.code || '';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Senha incorreta.';
  if (code === 'app/missing-password') return 'Informe sua senha para confirmar.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Confirmação cancelada.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde alguns minutos.';
  if (code === 'auth/requires-recent-login') return 'Por segurança, entre novamente e tente de novo.';
  if (code === 'permission-denied') return 'Sem permissão para apagar algum dado. Fale com o suporte.';
  return error?.message || 'Não foi possível excluir a conta.';
};

// Fluxo completo: reautentica → apaga dados → limpa o navegador → apaga o login.
export async function deleteAccount({ user, password, onStep = () => {}, deps } = {}) {
  if (!user?.uid) throw new Error('Sessão inválida.');
  onStep('reauth', 'running');
  try {
    await reauthenticate(user, { password });
  } catch (error) {
    onStep('reauth', 'error');
    throw error;
  }
  onStep('reauth', 'done');

  const counts = await deleteUserData(user.uid, { onStep, deps });
  purgeLocalData(user.uid);

  onStep('login', 'running');
  try {
    await deleteUser(user);
  } catch (error) {
    onStep('login', 'error');
    const wrapped = new Error('Seus dados foram apagados, mas o login não pôde ser encerrado. Entre novamente e peça a exclusão do login, ou fale com o suporte.');
    wrapped.cause = error;
    wrapped.step = 'login';
    throw wrapped;
  }
  onStep('login', 'done');
  return counts;
}
