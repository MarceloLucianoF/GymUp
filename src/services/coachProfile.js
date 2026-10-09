import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Perfil público do treinador: único dado do treinador que o aluno pode ler (ver firestore.rules).
export async function getPublicCoach(coachId) {
  if (!coachId) return null;
  const snap = await getDoc(doc(db, 'publicCoachProfiles', coachId));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

// Mantém publicCoachProfiles/{uid} em dia a partir do perfil privado do treinador/admin.
export async function syncPublicCoachProfile(uid, profile) {
  if (!uid || !['coach', 'admin'].includes(profile?.role)) return;
  const current = await getDoc(doc(db, 'publicCoachProfiles', uid));
  const next = {
    uid,
    displayName: profile.displayName || 'Treinador',
    photoURL: profile.photoURL || '',
    bio: profile.bio || '',
    role: profile.role,
    updatedAt: new Date().toISOString()
  };
  const unchanged = current.exists() && ['displayName', 'photoURL', 'bio', 'role']
    .every((key) => current.data()[key] === next[key]);
  if (!unchanged) await setDoc(doc(db, 'publicCoachProfiles', uid), next);
}
