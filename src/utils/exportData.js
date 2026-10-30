import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { academyApi, ACADEMY_API_ENABLED } from '../services/academyApi';

// Exportação dos dados do PRÓPRIO usuário (LGPD, art. 18). A montagem é pura; a leitura usa só userId == uid.

const toPlain = (value) => {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  }
  return value;
};

export const buildExportPayload = ({ user, profile, checkIns = [], measurements = [], health, academy }, now = new Date()) => ({
  exportedAt: now.toISOString(),
  app: 'BohTreinar',
  account: { uid: user?.uid || null, email: user?.email || null },
  profile: toPlain(profile || {}),
  checkIns: toPlain(checkIns),
  measurements: toPlain(measurements),
  // Saúde (itens 15/19): avaliações (inclusive as do professor), anamneses e o consentimento atual.
  health: toPlain({ assessments: health?.assessments || [], anamneses: health?.anamneses || [], consent: health?.consent || null }),
  ...(academy !== undefined ? { academy } : {})   // vínculos com academias (Gestão), quando a integração está ligada
});

export const exportFileName = (uid, now = new Date()) =>
  `bohtreinar-meus-dados-${String(uid || 'usuario').slice(0, 8)}-${now.toISOString().slice(0, 10)}.json`;

export const downloadJson = (payload, fileName) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportMyData = async (user) => {
  const own = (name) => getDocs(query(collection(db, name), where('userId', '==', user.uid)));
  const [profileSnap, checkSnap, measSnap, assessSnap, anamSnap, consentSnap] = await Promise.all([
    getDoc(doc(db, 'users', user.uid)), own('checkIns'), own('measurements'), own('assessments'), own('anamneses'),
    getDoc(doc(db, 'healthConsents', user.uid))
  ]);
  const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Dados que a academia guarda sobre a pessoa (vínculos, consentimentos, professor, ficha atribuída). Falha aqui não impede o resto.
  let academy;
  if (ACADEMY_API_ENABLED) {
    try { academy = await academyApi.exportMine(); } catch (error) { academy = { error: 'indisponivel', message: 'Não foi possível ler os dados das academias agora. Tente exportar de novo mais tarde.' }; }
  }
  const payload = buildExportPayload({
    user,
    profile: profileSnap.exists() ? profileSnap.data() : {},
    checkIns: mapDocs(checkSnap),
    measurements: mapDocs(measSnap),
    health: { assessments: mapDocs(assessSnap), anamneses: mapDocs(anamSnap), consent: consentSnap.exists() ? consentSnap.data() : null },
    academy
  });
  downloadJson(payload, exportFileName(user.uid));
  return payload;
};

export const DELETION_EMAIL = 'contato@bohtreinar.app'; // A CONFIRMAR
export const deletionMailto = (user) => {
  const subject = encodeURIComponent('Solicitação de exclusão de dados - BohTreinar');
  const body = encodeURIComponent(
    `Olá,\n\nSolicito a exclusão da minha conta e dos meus dados pessoais.\nE-mail da conta: ${user?.email || ''}\nID: ${user?.uid || ''}\n`
  );
  return `mailto:${DELETION_EMAIL}?subject=${subject}&body=${body}`;
};
