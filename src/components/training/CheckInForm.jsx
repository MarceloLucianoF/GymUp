import React, { useState } from 'react';
import toast from 'react-hot-toast';

function CheckInForm({ exercise, onSubmit, onCancel }) {
  const [repsCompleted, setRepsCompleted] = useState(exercise.reps); // Valor padrão: repetições sugeridas
  const [setsCompleted, setSetsCompleted] = useState(exercise.sets); // Valor padrão: séries sugeridas
  const [notes, setNotes] = useState(''); // Notas adicionais

  const handleSubmit = (e) => {
    e.preventDefault();
    if (repsCompleted <= 0 || setsCompleted <= 0) {
      toast.error('Repetições e séries devem ser maiores que zero.');
      return;
    }
    onSubmit({
      repsCompleted: Number(repsCompleted),
      setsCompleted: Number(setsCompleted),
      notes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="check-in-form">
      <h4 className="check-in-form-title">Registrar Exercício: {exercise.name}</h4>

      <div className="form-group">
        <label htmlFor="setsCompleted">Séries Realizadas:</label>
        <input
          type="number"
          id="setsCompleted"
          min="1"
          value={setsCompleted}
          onChange={(e) => setSetsCompleted(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="repsCompleted">Repetições por Série:</label>
        <input
          type="number"
          id="repsCompleted"
          min="1"
          value={repsCompleted}
          onChange={(e) => setRepsCompleted(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="notes">Observações (opcional):</label>
        <textarea
          id="notes"
          placeholder="Ex: Senti dor no ombro, carga leve, consegui mais 2 reps..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows="3"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">✓ Confirmar Check-in</button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Cancelar</button>
      </div>
    </form>
  );
}

export default CheckInForm;