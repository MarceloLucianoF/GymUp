import React from 'react';
import Modal from './Modal';

// Diálogo de confirmação acessível (substitui window.confirm).
export default function ConfirmDialog({
  open,
  title = 'Confirmar',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <Modal onClose={onCancel} label={title} className="w-full max-w-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">{title}</h3>
        {message && <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{message}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl font-bold transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-brand hover:bg-brand-dark text-black'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
