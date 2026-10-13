import { academyTrainingId, parseAcademyTrainingId } from './academyTrainingId';

test('ida e volta do ID da ficha da academia', () => {
  const id = academyTrainingId('academiaaaaaaaaaaaa', 'Xy12AbCd_3');
  expect(id).toBe('ac~academiaaaaaaaaaaaa~Xy12AbCd_3');
  expect(parseAcademyTrainingId(id)).toEqual({ academyId: 'academiaaaaaaaaaaaa', versionId: 'Xy12AbCd_3' });
});

test('IDs de treino comuns e lixo não viram ficha da academia', () => {
  ['abc123', '', null, 'ac~curto~Xy_1', 'ac~academiaaaaaaaaaaaa~semversao', 'x~academiaaaaaaaaaaaa~Xy_1', 'ac~academiaaaaaaaaaaaa~Xy_1~extra'].forEach((v) => expect(parseAcademyTrainingId(v)).toBeNull());
});
