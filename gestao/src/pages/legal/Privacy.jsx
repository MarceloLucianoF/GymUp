import React from 'react';
import Legal from './Legal';

export default function Privacy() {
  return (
    <Legal title="Privacidade">
      <h2>O que a Gestão guarda</h2>
      <p>Seu identificador de conta, o nome que você informou, seu papel e seu status em cada academia, os convites que você criou, os vínculos entre professor e aluno e o registro de auditoria das mudanças administrativas. O consentimento do aluno fica registrado separadamente do vínculo.</p>
      <h2>O que a Gestão não guarda</h2>
      <p>Peso, medidas, cargas, volume de treino, histórico de saúde, frequência individual, CPF e telefone. Esses dados não aparecem em nenhuma tela da Gestão. A aderência individual não é exibida nesta versão.</p>
      <h2>Quem vê o quê</h2>
      <p>Proprietário e administrador veem membros, papéis e a auditoria da própria academia. A recepção vê alunos e convites de aluno. O professor vê apenas os alunos que aceitaram ser acompanhados por ele. Uma academia nunca enxerga dados de outra.</p>
      <h2>Seus direitos</h2>
      <p>O aluno pode revogar o consentimento e sair da academia a qualquer momento; ao sair, o consentimento e os vínculos com professor são encerrados. Os procedimentos de exportação, retenção e exclusão serão definidos com a revisão jurídica antes do uso comercial.</p>
      <h2>Registro de auditoria</h2>
      <p>Mudanças administrativas são registradas com quem fez, quando e o quê, e esse registro não pode ser editado nem apagado. Leituras de dados não são registradas nesta versão.</p>
    </Legal>
  );
}
