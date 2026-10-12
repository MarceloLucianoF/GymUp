import { addDoc, collection } from 'firebase/firestore';

// Registro de quem alterou o quê no painel (coleção adminLog, só o admin lê e acrescenta).
// Falha no registro nunca impede a ação em si.
export async function logAdminAction(db, user, { action, target, targetId = '', name = '', detail = '' }) {
  try {
    await addDoc(collection(db, 'adminLog'), {
      at: new Date().toISOString(),
      uid: user.uid,
      action,
      target,
      targetId,
      name: String(name).slice(0, 200),
      detail: String(detail).slice(0, 500)
    });
  } catch (error) {
    console.error('Falha ao registrar histórico:', error);
  }
}

export const ACTION_LABEL = {
  criar: 'Criou',
  editar: 'Editou',
  duplicar: 'Duplicou',
  arquivar: 'Arquivou',
  restaurar: 'Restaurou',
  excluir: 'Excluiu',
  importar: 'Importou'
};
export const TARGET_LABEL = { exercises: 'exercício', trainings: 'ficha' };
