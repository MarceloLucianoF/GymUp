import React from 'react';
import { Link } from 'react-router-dom';
import { GESTAO_URL } from '../../services/academyApi';

// Rota ainda ligada ao Firestore: com a API da academia (D1) ativa ela fica fechada, para nunca misturar as duas fontes de dados.
export default function ModuleInDeployment() {
  return (
    <main className="mx-auto max-w-xl p-6 text-center">
      <h1 className="text-xl font-semibold">Módulo em implantação</h1>
      <p className="mt-2 text-sm opacity-80">As fichas da academia estão sendo migradas para a nova Gestão. Enquanto isso, sua ficha atribuída aparece em Minha academia.</p>
      <div className="mt-4 flex justify-center gap-3 text-sm">
        <Link className="underline" to="/academia">Minha academia</Link>
        {GESTAO_URL ? <a className="underline" href={GESTAO_URL}>Abrir a Gestão</a> : null}
      </div>
    </main>
  );
}
