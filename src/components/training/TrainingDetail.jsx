import React, { useState } from 'react';
import toast from 'react-hot-toast';
import ExerciseCard from './ExerciseCard'; // Componente para cada exercício

function TrainingDetail({ training, allExercises, onBack, onCheckIn }) {
  // Filtra os exercícios que pertencem a este treino
  const trainingExercises = training.exercises
    .map(id => allExercises.find(ex => ex.id === id))
    .filter(Boolean); // Remove exercícios que não foram encontrados

  // Estado para controlar quais exercícios foram marcados como completos nesta sessão
  const [completedExercises, setCompletedExercises] = useState({});

  // Calcula o progresso
  const progressCount = Object.keys(completedExercises).length;
  const totalExercises = trainingExercises.length;
  const progressBarWidth = totalExercises > 0 ? (progressCount / totalExercises) * 100 : 0;

  const handleExerciseCheckIn = async (exerciseId, checkInData) => {
    try {
      await onCheckIn({
        exerciseId: exerciseId,
        trainingDay: training.id, // Adiciona o ID do treino ao check-in
        ...checkInData,
      });
      setCompletedExercises(prev => ({
        ...prev,
        [exerciseId]: true, // Marca o exercício como completo
      }));
    } catch (error) {
      console.error('Erro ao registrar check-in:', error);
      toast.error('Erro ao registrar check-in. Tente novamente.');
    }
  };

  return (
    <div className="training-detail-page">
      <button onClick={onBack} className="btn btn-secondary btn-back">← Voltar para Treinos</button>

      <h1 className="page-title">{training.name}</h1>
      <p className="page-subtitle">Complete os exercícios para registrar seu treino.</p>

      {/* Barra de Progresso */}
      <div className="progress-bar-container">
        <div className="progress-bar-text">
          Progresso: {progressCount} de {totalExercises} exercícios
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${progressBarWidth}%` }}></div>
        </div>
      </div>

      <div className="exercises-list">
        {trainingExercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            isCompleted={!!completedExercises[exercise.id]}
            onCheckIn={handleExerciseCheckIn}
            exerciseNumber={index + 1} // Número do exercício na lista
          />
        ))}
      </div>
    </div>
  );
}

export default TrainingDetail;