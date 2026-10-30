import { assessmentAiMessages, assessmentLines, assessmentMatches, assessmentText, buildAssessmentFacts } from './assessmentInsight';

const older = { id: 'a1', date: '2026-08-01', kind: 'instructor', sex: 'male', age: 34, weight: 82, height: 178, bodyFat: 20.4, perimeters: { waist: 92, hip: 100 }, notes: 'Joelho dói' };
const latest = { id: 'a2', date: '2026-10-01', kind: 'instructor', sex: 'male', age: 34, weight: 81.5, height: 178, bodyFat: 18.2, perimeters: { waist: 89, hip: 99 }, notes: 'Evoluiu bem' };
const anamnesis = { parq: [false, false, false, false, true, false, false], injuries: 'Condromalácia no joelho', medications: 'Losartana' };

describe('buildAssessmentFacts', () => {
  it('calcula IMC, relação cintura-quadril, intervalo e variações com a anterior', () => {
    const f = buildAssessmentFacts({ assessments: [latest, older], anamnesis, goal: 'Hipertrofia' });
    expect(f).toMatchObject({ hasData: true, weight: 81.5, bmi: 25.7, fat: 18.2, fatSource: 'dobras cutâneas', waist: 89, whr: 0.9, wht: 0.5, daysBetween: 61, parqYes: true, hasInjuries: true });
    expect(f.deltas.map((d) => [d.key, d.delta])).toEqual([['weight', -0.5], ['fat', -2.2], ['waist', -3], ['hip', -1]]);
  });

  it('sem avaliação não tem dados; com uma só não tem variações', () => {
    expect(buildAssessmentFacts({ assessments: [] }).hasData).toBe(false);
    const f = buildAssessmentFacts({ assessments: [latest] });
    expect(f.deltas).toEqual([]);
    expect(assessmentText(f, 'student')).toMatch(/segunda avaliação em 30 a 60 dias/);
  });

  it('usa a gordura da bioimpedância quando não há dobras', () => {
    const f = buildAssessmentFacts({ assessments: [{ date: '2026-10-01', sex: 'female', weight: 60, height: 165, bioimpedance: { bodyFat: 27, leanMass: 43.8 } }] });
    expect(f).toMatchObject({ fat: 27, fatSource: 'bioimpedância', leanMass: 43.8 });
  });
});

describe('assessmentLines', () => {
  const f = buildAssessmentFacts({ assessments: [latest, older], anamnesis, goal: 'Hipertrofia' });

  it('aluno: leitura em segunda pessoa, recomposição e aviso de que não é diagnóstico', () => {
    const text = assessmentText(f, 'student');
    expect(text).toMatch(/Na sua avaliação mais recente: peso 81,5 kg, IMC 25,7 \(faixa sobrepeso\), gordura 18,2% \(dobras cutâneas\)/);
    expect(text).toMatch(/Em 61 dias desde a avaliação anterior: peso caiu 0,5 kg, gordura caiu 2,2 pontos percentuais, cintura caiu 3 cm/);
    expect(text).toMatch(/recomposição corporal/);
    expect(text).toMatch(/acima da referência da OMS \(0,90\)/);
    expect(text).toMatch(/não um diagnóstico/);
    expect(text).not.toMatch(/PAR-Q|lesões/);
  });

  it('professor: pontos para o treino (PAR-Q e lesões) sem copiar os textos da anamnese', () => {
    const lines = assessmentLines(f, 'coach');
    expect(lines.join(' ')).toMatch(/liberação médica/);
    expect(lines.join(' ')).toMatch(/lesões registradas/);
    expect(lines.join(' ')).not.toMatch(/Condromalácia|Losartana/);
  });
});

describe('assessmentAiMessages', () => {
  it('não leva nome, datas, observações nem textos da anamnese', () => {
    const f = buildAssessmentFacts({ assessments: [latest, older], anamnesis, goal: 'Hipertrofia' });
    ['student', 'coach'].forEach((audience) => {
      const json = assessmentAiMessages(f, audience)[1].content;
      expect(json).not.toMatch(/2026|Joelho|Evoluiu|Condromalácia|Losartana|instructor/);
      expect(JSON.parse(json)).toMatchObject({ sexo: 'masculino', idade: 34, objetivo: 'Hipertrofia', parq_sim: true });
    });
    expect(JSON.parse(assessmentAiMessages(f, 'student')[1].content).lesoes_registradas).toBeUndefined();
    expect(JSON.parse(assessmentAiMessages(f, 'coach')[1].content).lesoes_registradas).toBe(true);
  });
});

describe('assessmentMatches', () => {
  const f = buildAssessmentFacts({ assessments: [latest, older], anamnesis, goal: 'Hipertrofia' });
  it('aceita texto com os mesmos números e recusa número inventado', () => {
    expect(assessmentMatches('Em 61 dias sua gordura caiu 2,2 pontos e a cintura 3 cm, com IMC de 25,7 e relação cintura-quadril de 0,90.', f)).toBe(true);
    expect(assessmentMatches('Em 61 dias sua gordura caiu 2,2 pontos e você ganhou 1,7 kg de músculo, ótimo resultado no período.', f)).toBe(false);
    expect(assessmentMatches('curto', f)).toBe(false);
  });
});
