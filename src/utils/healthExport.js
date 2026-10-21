// Sessão de exercício no formato do Health Connect (ExerciseSessionRecord), para importar por app/atalho do próprio aluno.
const EXERCISE_TYPE_STRENGTH = 'EXERCISE_SEGMENT_TYPE_STRENGTH_TRAINING';

const iso = (value) => {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** Converte um check-in numa sessão de musculação. Devolve null se faltar data ou duração. */
export function toHealthConnectSession(checkIn) {
  if (!checkIn) return null;
  const seconds = Math.round(Number(checkIn.duration) || 0);
  const end = iso(checkIn.date || checkIn.createdAt);
  if (!end || seconds <= 0) return null;
  const start = new Date(new Date(end).getTime() - seconds * 1000).toISOString();
  return {
    type: 'ExerciseSessionRecord',
    exerciseType: EXERCISE_TYPE_STRENGTH,
    title: String(checkIn.trainingName || 'Treino').slice(0, 60),
    startTime: start,
    endTime: end,
    metadata: { clientRecordId: String(checkIn.clientId || checkIn.id || `${start}`), clientRecordVersion: 1, recordingMethod: 'RECORDING_METHOD_MANUAL_ENTRY' },
    notes: `${Number(checkIn.setsCompleted) || 0} séries concluídas · BohTreinar`
  };
}
