// A ficha mora em users/{uid}/myWorkouts/minha-ficha: nunca aparece como treino e grava só campos que as regras aceitam.
jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => 'col', query: () => 'q', orderBy: () => null, getDocs: jest.fn(), getDoc: jest.fn(), addDoc: jest.fn(),
  doc: (db, ...path) => path.join('/'), setDoc: jest.fn(), deleteDoc: jest.fn(), serverTimestamp: () => 'TS'
}));

const fs = require('firebase/firestore');
const { listMyWorkoutsAndRoutine, listMyWorkouts, saveMyRoutine, ROUTINE_DOC_ID } = require('./myWorkouts');

const snap = (rows) => ({ docs: rows.map(([id, data]) => ({ id, data: () => data })) });

// CRA zera os mocks (resetMocks) antes de cada teste: caminhos do Firestore são funções puras acima.

test('separa a ficha dos treinos e descarta itens de treino apagado', async () => {
  fs.getDocs.mockResolvedValue(snap([
    ['w1', { name: 'Peito', exercises: [{}] }],
    [ROUTINE_DOC_ID, { name: 'Minha ficha', category: 'routine', exercises: [{ workoutId: 'w1', day: 2 }, { workoutId: 'apagado' }] }],
    ['w2', { name: 'Costas', exercises: [{}] }]
  ]));
  const { workouts, routine } = await listMyWorkoutsAndRoutine('u1');
  expect(workouts.map((w) => w.id)).toEqual(['my_w1', 'my_w2']);
  expect(routine.items).toEqual([{ workoutId: 'w1', day: 2 }]);
  expect((await listMyWorkouts('u1')).map((w) => w.docId)).toEqual(['w1', 'w2']);
});

test('grava só as chaves aceitas pelas regras de myWorkouts; ficha vazia apaga o documento', async () => {
  await saveMyRoutine('u1', [{ workoutId: 'w2' }, { workoutId: 'w1', day: 0 }]);
  const [path, data] = fs.setDoc.mock.calls[0];
  expect(path).toBe(`users/u1/myWorkouts/${ROUTINE_DOC_ID}`);
  expect(Object.keys(data).sort()).toEqual(['category', 'createdAt', 'description', 'estimatedTime', 'exercises', 'name', 'source', 'updatedAt']);
  expect(data.exercises).toEqual([{ workoutId: 'w2', day: null }, { workoutId: 'w1', day: 0 }]);
  expect(data.source).toBe('manual');

  await saveMyRoutine('u1', []);
  expect(fs.deleteDoc).toHaveBeenCalledWith(`users/u1/myWorkouts/${ROUTINE_DOC_ID}`);
});
