import React from 'react';
import usePageMeta from '../../hooks/usePageMeta';
import LegalLayout, { Section, CONTACT_EMAIL } from './LegalLayout';

export default function Termos() {
  usePageMeta('Termos de Uso', 'Termos de uso do BohTreinar: regras de conta, uso responsável, Coach de IA e limites de responsabilidade.');
  return (
    <LegalLayout title="Termos de Uso" updatedAt="outubro de 2026">
      <Section title="1. Aceite">
        <p>Ao criar uma conta no BohTreinar você declara ter lido e concordado com estes Termos e com a Política de Privacidade.</p>
      </Section>
      <Section title="2. Conta">
        <p>Você é responsável pelos dados informados e pela guarda da sua senha. O papel da conta (aluno ou treinador) é definido pela plataforma e não pode ser alterado pelo usuário.</p>
      </Section>
      <Section title="3. Uso adequado">
        <p>Não é permitido tentar acessar dados de outras pessoas, burlar controles de segurança, sobrecarregar o serviço ou usá-lo para fins ilícitos.</p>
      </Section>
      <Section title="4. Aviso de saúde">
        <p>O BohTreinar não substitui avaliação médica ou de profissional de educação física. Consulte um profissional antes de iniciar ou alterar um programa de exercícios. Você assume os riscos da prática.</p>
      </Section>
      <Section title="5. Coach de IA">
        <p>As respostas e fichas geradas por IA são sugestões automatizadas, podem conter erros e não constituem prescrição profissional. Revise-as com seu treinador.</p>
      </Section>
      <Section title="6. Conteúdo do usuário">
        <p>Os dados e mensagens que você registra continuam sendo seus. Você nos autoriza a armazená-los e exibi-los ao seu treinador para prestar o serviço.</p>
      </Section>
      <Section title="7. Disponibilidade e responsabilidade">
        <p>Buscamos manter o serviço disponível, mas ele é oferecido no estado em que se encontra, podendo sofrer interrupções. Na máxima extensão permitida em lei, não respondemos por danos indiretos decorrentes do uso do app.</p>
      </Section>
      <Section title="8. Encerramento">
        <p>Você pode pedir a exclusão da conta a qualquer momento. Podemos suspender contas que violem estes Termos.</p>
      </Section>
      <Section title="9. Alterações e contato">
        <p>Podemos atualizar estes Termos; mudanças relevantes serão avisadas no app. Contato: <a className="font-bold text-amber-700 underline dark:text-brand" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> (a confirmar). Foro: a definir.</p>
      </Section>
    </LegalLayout>
  );
}
