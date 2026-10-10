import React, { useState } from 'react';
import { Zap, Settings2, X, Plus, Trash2, RotateCcw } from 'lucide-react';
import Modal from '../common/Modal';
import { fillTemplate, firstName, loadTemplates, saveTemplates, DEFAULT_TEMPLATES } from '../../utils/coachTemplates';
import { btnGhost, btnPrimary, inputCls, labelCls } from './styles';

function EditorModal({ templates, onSave, onClose }) {
  const [draft, setDraft] = useState(templates);
  const patch = (i, field, value) => setDraft((d) => d.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  return (
    <Modal onClose={onClose} label="Editar respostas rápidas" className="w-full max-w-lg">
      <div className="surface flex max-h-[85vh] flex-col bg-white dark:bg-gray-900 animate-scale-in">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4 dark:border-white/10">
          <h3 className="flex-1 font-display text-lg font-black text-gray-900 dark:text-white">Respostas rápidas</h3>
          <button type="button" aria-label="Fechar" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-xs text-gray-500">Use <code>{'{nome}'}</code> para o primeiro nome do aluno. Os modelos ficam salvos só neste navegador.</p>
          {draft.map((t, i) => (
            <div key={t.id} className="space-y-2 rounded-2xl border border-gray-200 p-3 dark:border-white/10">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor={`tpl-label-${i}`} className={labelCls}>Título</label>
                  <input id={`tpl-label-${i}`} value={t.label} maxLength={40} onChange={(e) => patch(i, 'label', e.target.value)} className={inputCls} />
                </div>
                <button type="button" aria-label={`Remover modelo ${t.label}`} onClick={() => setDraft((d) => d.filter((_, idx) => idx !== i))} className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-5 w-5" /></button>
              </div>
              <label htmlFor={`tpl-text-${i}`} className={labelCls}>Mensagem</label>
              <textarea id={`tpl-text-${i}`} rows={3} value={t.text} maxLength={1000} onChange={(e) => patch(i, 'text', e.target.value)} className={`${inputCls} py-3`} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDraft((d) => [...d, { id: `custom-${Date.now()}`, label: 'Novo modelo', text: 'Oi, {nome}! ' }])} className={btnGhost}><Plus className="h-4 w-4" /> Novo modelo</button>
            <button type="button" onClick={() => setDraft(DEFAULT_TEMPLATES)} className={btnGhost}><RotateCcw className="h-4 w-4" /> Restaurar padrão</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 p-4 dark:border-white/10">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="button" onClick={() => onSave(draft)} className={btnPrimary}>Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

// Chips de respostas rápidas acima do campo de texto: preenchem o input (o treinador revisa e envia).
export default function QuickReplies({ studentName, onPick }) {
  const [templates, setTemplates] = useState(() => loadTemplates());
  const [editing, setEditing] = useState(false);
  const save = (list) => {
    saveTemplates(list);
    setTemplates(loadTemplates());
    setEditing(false);
  };
  return (
    <div className="flex items-center gap-2 border-t border-gray-200 bg-white/80 px-3 pt-2 dark:border-white/10 dark:bg-white/[0.03]">
      <Zap className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto py-1" role="group" aria-label="Respostas rápidas">
        {templates.map((t) => (
          <button key={t.id} type="button" onClick={() => onPick(fillTemplate(t.text, { nome: firstName(studentName), recorde: '', valor: '', dias: '' }))}
            className="pressable min-h-[44px] shrink-0 rounded-full bg-gray-100 px-4 text-xs font-bold text-gray-700 hover:bg-brand/20 dark:bg-white/10 dark:text-gray-200">{t.label}</button>
        ))}
      </div>
      <button type="button" aria-label="Editar respostas rápidas" onClick={() => setEditing(true)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"><Settings2 className="h-5 w-5" /></button>
      {editing && <EditorModal templates={templates} onSave={save} onClose={() => setEditing(false)} />}
    </div>
  );
}
