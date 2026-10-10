import React from 'react';
import usePageMeta from '../../hooks/usePageMeta';
import LegalLayout, { Section, CONTACT_EMAIL } from './LegalLayout';

export default function Privacidade() {
  usePageMeta('Política de Privacidade', 'Como o BohTreinar coleta, usa e protege seus dados pessoais e de saúde, conforme a LGPD.');
  return (
    <LegalLayout title="Política de Privacidade" updatedAt="outubro de 2026">
      <Section title="1. Quem somos">
        <p>O BohTreinar é um aplicativo de acompanhamento de treinos usado por alunos e treinadores. Esta política explica como tratamos seus dados pessoais, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).</p>
      </Section>
      <Section title="2. Dados que coletamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Conta: nome, e-mail e senha (a senha é gerida pelo Firebase Authentication e não fica visível para nós).</li>
          <li>Perfil: objetivo, altura, peso, idade e foto, se você informar.</li>
          <li>Dados de saúde e desempenho: medidas corporais, cargas, repetições, treinos realizados e histórico de evolução. São dados pessoais sensíveis.</li>
          <li>Comunicação: mensagens trocadas com seu treinador no chat.</li>
          <li>Dados técnicos: tipo de dispositivo, preferências (tema, lembretes) e registros de erro.</li>
          <li>Coach de IA: o texto que você digita e o contexto de treino necessário para responder.</li>
        </ul>
      </Section>
      <Section title="3. Para que usamos e base legal">
        <ul className="list-disc space-y-1 pl-5">
          <li>Prestar o serviço (criar conta, exibir fichas, registrar treinos): execução de contrato.</li>
          <li>Tratar dados de saúde para acompanhar sua evolução e permitir que seu treinador a acompanhe: seu consentimento específico, dado ao criar a conta e revogável a qualquer momento.</li>
          <li>Segurança, prevenção a fraudes e correção de falhas: legítimo interesse.</li>
          <li>Cumprir obrigações legais, quando houver.</li>
        </ul>
        <p>Não vendemos seus dados nem os usamos para publicidade.</p>
      </Section>
      <Section title="4. Com quem compartilhamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Seu treinador, quando você está vinculado a ele: vê seus treinos, medidas e mensagens. Cada aluno só vê os próprios dados.</li>
          <li>Google / Firebase (Authentication, Firestore, Hosting): armazenamento e autenticação.</li>
          <li>Cloudflare: entrega do site e proxy de requisições.</li>
          <li>Provedores de IA (Google Gemini e, quando habilitado, NVIDIA): processam as mensagens enviadas ao Coach de IA. Evite incluir dados que não deseja compartilhar.</li>
        </ul>
        <p>Alguns desses provedores podem tratar dados fora do Brasil, com as salvaguardas previstas na LGPD.</p>
      </Section>
      <Section title="5. Por quanto tempo guardamos">
        <p>Mantemos seus dados enquanto sua conta estiver ativa. Ao pedir a exclusão, apagamos ou anonimizamos os dados em prazo razoável, salvo os que a lei exigir guardar. Backups podem levar mais tempo para expirar.</p>
      </Section>
      <Section title="6. Seus direitos">
        <p>Você pode solicitar: confirmação e acesso aos dados, correção, anonimização ou eliminação, portabilidade, informação sobre compartilhamentos e revogação do consentimento. No app, em Perfil, há o botão &ldquo;Exportar meus dados (JSON)&rdquo; e o atalho para solicitar exclusão.</p>
      </Section>
      <Section title="7. Segurança">
        <p>Usamos conexão criptografada (HTTPS), autenticação e regras de acesso que isolam os dados de cada aluno. Nenhum sistema é totalmente imune a falhas; em caso de incidente relevante, avisaremos você e a autoridade competente conforme a lei.</p>
      </Section>
      <Section title="8. Crianças e adolescentes">
        <p>O app é destinado a maiores de 18 anos. Menores de idade devem usar com consentimento e acompanhamento de um responsável.</p>
      </Section>
      <Section title="9. Contato">
        <p>Dúvidas ou pedidos sobre seus dados: <a className="font-bold text-amber-700 underline dark:text-brand" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> (endereço a confirmar).</p>
      </Section>
    </LegalLayout>
  );
}
