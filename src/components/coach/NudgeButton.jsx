import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { BellRing } from 'lucide-react';
import { nudgeAvailable, nudgeStudent } from '../../services/pushService';

const MESSAGES = {
  sent: ['success', 'Lembrete enviado'],
  'no-subscription': ['error', 'O aluno não ativou as notificações'],
  'rate-limited': ['error', 'Já foi lembrado nas últimas 24 h'],
  error: ['error', 'Não foi possível enviar o lembrete agora']
};

// "Lembrar": o treinador manda ao aluno parado um aviso com o app fechado (o servidor confere o vínculo e o limite de 24 h).
export default function NudgeButton({ studentId, days, name = 'aluno', className = '' }) {
  const [busy, setBusy] = useState(false);
  if (!nudgeAvailable() || !studentId || !Number.isFinite(days) || days < 1) return null;
  const click = async () => {
    setBusy(true);
    const result = await nudgeStudent(studentId, days);
    setBusy(false);
    const [kind, text] = MESSAGES[result] || MESSAGES.error;
    toast[kind](text);
  };
  return (
    <button type="button" onClick={click} disabled={busy} aria-label={`Lembrar ${name} de voltar a treinar`} className={className}>
      <BellRing className="h-4 w-4" aria-hidden="true" /> Lembrar
    </button>
  );
}
