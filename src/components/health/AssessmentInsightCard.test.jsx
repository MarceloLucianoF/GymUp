import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AssessmentInsightCard from './AssessmentInsightCard';
import { aiService } from '../../services/aiService';

jest.mock('../../services/aiService', () => ({ aiService: { summarizeFacts: jest.fn() } }));

const items = [
  { id: 'b', date: '2026-10-01', sex: 'female', age: 29, weight: 63, height: 165, bodyFat: 24.1, perimeters: { waist: 72, hip: 98 } },
  { id: 'a', date: '2026-09-01', sex: 'female', age: 29, weight: 64, height: 165, bodyFat: 26, perimeters: { waist: 75, hip: 99 } }
];

afterEach(() => jest.clearAllMocks());

test('mostra a análise calculada e troca pelo texto da IA quando os números conferem', async () => {
  aiService.summarizeFacts.mockResolvedValue('Em 30 dias você perdeu 1 kg e a gordura caiu 1,9 pontos, chegando a 24,1%. A cintura caiu 3 cm. Continue com treino de força.');
  render(<AssessmentInsightCard assessments={items} anamnesis={null} goal="Emagrecimento" />);
  expect(screen.getByText(/Na sua avaliação mais recente: peso 63 kg/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Analisar com IA' }));
  expect(await screen.findByText(/Continue com treino de força/)).toBeInTheDocument();
  expect(screen.getByText(/conferido com os números/)).toBeInTheDocument();
});

test('recusa texto da IA com número inventado e avisa quando ela está fora', async () => {
  aiService.summarizeFacts.mockResolvedValueOnce('Você ganhou 2,5 kg de massa magra em 30 dias, um resultado excelente para o período.');
  render(<AssessmentInsightCard assessments={items} anamnesis={null} goal="" audience="coach" />);
  expect(screen.getByRole('heading', { name: /Análise para o treino/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Analisar com IA' }));
  expect(await screen.findByText(/números diferentes dos registrados/)).toBeInTheDocument();
  aiService.summarizeFacts.mockResolvedValueOnce(null);
  fireEvent.click(screen.getByRole('button', { name: 'Analisar com IA' }));
  expect(await screen.findByText(/IA indisponível agora/)).toBeInTheDocument();
  expect(screen.getByText(/ainda não preencheu a anamnese/)).toBeInTheDocument();
});

test('sem avaliação não oferece a IA', () => {
  render(<AssessmentInsightCard assessments={[]} />);
  expect(screen.queryByRole('button', { name: 'Analisar com IA' })).toBeNull();
  expect(screen.getByText(/Lance uma avaliação física/)).toBeInTheDocument();
});
