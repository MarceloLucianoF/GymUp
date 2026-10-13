import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Utensils, MessageSquare, CheckCircle2, ChevronRight, ChevronDown, RefreshCw, Zap, Trash2 } from 'lucide-react';
import { aiService, localFallbackText } from '../../services/aiService';
import { modelLabel, failureMessage } from '../../services/aiMeta';
import Markdown from '../common/Markdown';
import { db } from '../../firebase/config';
import { collection, addDoc, query, where, orderBy, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { btnPrimary, btnGhost, iconBtn } from '../coach/styles';

const selectCls = 'w-full min-h-[48px] appearance-none rounded-2xl border border-transparent bg-gray-100 px-4 pr-11 text-base font-semibold text-gray-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30 dark:bg-white/5 dark:text-white [&>option]:text-gray-900';
const fieldLabel = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400';
const chipCls = 'pressable inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 text-xs font-bold text-gray-700 transition hover:border-brand/50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200';
const TABS = [
  { id: 'chat', label: 'Chat IA', Icon: MessageSquare },
  { id: 'generator', label: 'Gerador', Icon: Sparkles },
  { id: 'nutrition', label: 'Nutrição', Icon: Utensils }
];

export default function AICoachModal({ isOpen, onClose, userProfile, user, customExercises = [], onWorkoutSaved }) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'generator' | 'nutrition'
  const [aiMeta, setAiMeta] = useState(null); // provedor/modelo da última resposta
  const [historyDocs, setHistoryDocs] = useState([]);

  // Chat State
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Olá! Sou seu **Coach de IA no BohTreinar**. Analiso seu histórico real de treinos e métricas corporais para oferecer orientações científicas e personalizadas. Como posso te ajudar hoje?`
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const abortRef = useRef(null); // interrompe a chamada em andamento ao cancelar, estourar o prazo ou fechar
  const requestRef = useRef(0); // identifica o pedido em andamento: respostas de pedidos cancelados são ignoradas

  // Contador de espera (alimenta o aviso por etapas).
  useEffect(() => {
    if (!isTyping) { setWaitSeconds(0); return undefined; }
    const started = Date.now();
    const id = setInterval(() => setWaitSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isTyping]);

  const chatEndRef = useRef(null);

  // Generator State
  const [selectedGoal, setSelectedGoal] = useState(userProfile?.goal || 'Hipertrofia');
  const [selectedFocus, setSelectedFocus] = useState('Peito e Tríceps');
  const [selectedDuration, setSelectedDuration] = useState(45);
  const [generatedWorkout, setGeneratedWorkout] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Nutrition State
  const [nutritionData, setNutritionData] = useState(null);

  // Carrega histórico de check-ins do aluno do Firestore
  useEffect(() => {
    const fetchHistory = async () => {
      if (isOpen && user?.uid) {
        try {
          const q = query(
            collection(db, 'checkIns'),
            where('userId', '==', user.uid),
            orderBy('date', 'desc')
          );
          const snap = await getDocs(q);
          const docs = snap.docs.map(d => d.data());
          setHistoryDocs(docs);
        } catch (err) {
          console.warn("Erro ao buscar histórico para IA:", err);
        }
      }
    };
    fetchHistory();
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen && userProfile) {
      const data = aiService.calculateNutritionAndMacros({
        weight: userProfile.weight || 70,
        height: userProfile.height || 180,
        age: userProfile.age || 25,
        goal: userProfile.goal || 'Hipertrofia'
      });
      setNutritionData(data);
    }
  }, [isOpen, userProfile]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!isOpen) return null;

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: `Olá! Sou seu **Coach de IA no BohTreinar**. Analiso seu histórico real de treinos e métricas corporais para oferecer orientações científicas e personalizadas. Como posso te ajudar hoje?`
      }
    ]);
    toast.success('Conversa reiniciada.');
  };

  const sendQuestion = async (userText, { addUserMessage = true } = {}) => {
    if (!userText || isTyping) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (addUserMessage) setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: userText }]);
    setIsTyping(true);
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    let metaSeen = null;
    const failMessage = (text, retry = true) => ({ id: `${Date.now()}-e`, sender: 'ai', text, retryText: retry ? userText : null });
    try {
      // Teto de espera: além dele o pedido é tratado como lento (a resposta tardia é descartada).
      const responseText = await Promise.race([
        aiService.askAICoach({
          prompt: userText,
          userProfile,
          historyDocs,
          conversationHistory: messages,
          customExercises,
          signal: abortController.signal,
          onMeta: (meta) => { metaSeen = meta; if (requestRef.current === requestId) setAiMeta(meta); },
          onWorkout: (workout) => {
            if (requestRef.current !== requestId) return;
            setGeneratedWorkout(workout);
            toast.success('Treino gerado! Veja na aba Treino.');
          }
        }),
        new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 45000))
      ]);
      if (requestRef.current !== requestId) return; // cancelado
      if (responseText?.timeout) {
        abortController.abort(); // não deixa a chamada pendurada em segundo plano
        setAiMeta({ provider: 'local', reason: 'lento' });
        setMessages(prev => [...prev, failMessage(localFallbackText(userProfile, 'lento'))]);
      } else {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'ai', text: responseText, retryText: metaSeen?.provider === 'local' ? userText : null }]);
      }
    } catch (err) {
      console.error(err);
      if (requestRef.current === requestId) setMessages(prev => [...prev, failMessage(failureMessage('indisponivel'))]);
    } finally {
      if (requestRef.current === requestId) setIsTyping(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const userText = inputPrompt.trim();
    if (!userText || isTyping) return;
    setInputPrompt('');
    sendQuestion(userText);
  };

  // Cancela a espera: a resposta que chegar depois é ignorada e a pergunta volta ao campo para reenviar.
  const cancelWaiting = () => {
    const last = [...messages].reverse().find((m) => m.sender === 'user');
    requestRef.current += 1;
    abortRef.current?.abort();
    setIsTyping(false);
    if (last) setInputPrompt(last.text);
    toast('Pedido cancelado. A pergunta voltou ao campo para você reenviar.');
  };

  const handleGenerateWorkout = async () => {
    setIsGenerating(true);
    try {
      const workout = await aiService.generateAIWorkout({
        goal: selectedGoal,
        muscleFocus: selectedFocus,
        durationMinutes: selectedDuration,
        customExercises
      });
      setGeneratedWorkout(workout);
      toast.success('Treino com IA gerado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível gerar o treino agora.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveWorkoutToFirestore = async () => {
    if (!generatedWorkout || isSaving || !user) return;
    setIsSaving(true);
    const toastId = toast.loading('Salvando treino no seu perfil...');

    try {
      const workoutPayload = {
        name: generatedWorkout.name,
        category: generatedWorkout.category,
        description: generatedWorkout.description,
        estimatedTime: generatedWorkout.estimatedTime,
        exercises: generatedWorkout.exercises,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        isAIGenerated: true
      };

      await addDoc(collection(db, 'trainings'), workoutPayload);
      toast.success('Treino IA salvo em "Meus Treinos"!', { id: toastId });
      if (onWorkoutSaved) onWorkoutSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar treino.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/85 backdrop-blur-md animate-fade-in sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Coach IA e Nutrição">
      <div className="bg-white dark:bg-[#1F2937] border border-[#FFC107]/30 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl h-[94dvh] sm:h-[90vh] sm:max-h-[750px] shadow-2xl flex flex-col overflow-hidden relative animate-fade-in-up">
        
        {/* HEADER DO MODAL */}
        <div className="p-4 sm:p-5 bg-white dark:bg-gradient-to-r dark:from-gray-900 dark:via-[#1F2937] dark:to-gray-900 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFC107] to-[#FF9800] flex items-center justify-center text-black font-black shadow-lg shadow-[#FFC107]/20">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">Coach IA & Nutrição</h3>
                <span className="bg-[#FFC107]/10 text-amber-800 dark:text-brand text-[11px] font-black px-2 py-0.5 rounded-full border border-[#FFC107]/20 uppercase">{modelLabel(aiMeta)}</span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400">Inteligência fitness com dados do seu perfil</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} aria-label="Fechar" className={`${iconBtn} !rounded-full`}>
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div role="tablist" aria-label="Seções do Coach IA" className="grid grid-cols-3 p-2 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0 gap-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`pressable min-h-[44px] px-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                activeTab === id
                  ? 'bg-gradient-to-r from-brand to-[#FF9800] text-black shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-[#0B0F19]">
          
          {/* TAB 1: CHAT IA */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full justify-between gap-4">
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-brand to-[#FF9800] text-black font-semibold rounded-tr-none'
                        : 'card-premium-glass text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-200 dark:border-gray-800'
                    }`}>
                      {msg.sender === 'user'
                        ? <p className="whitespace-pre-wrap text-left">{msg.text}</p>
                        : <Markdown text={msg.text} />}
                      {msg.retryText && (
                        <button type="button" onClick={() => sendQuestion(msg.retryText, { addUserMessage: false })} disabled={isTyping}
                          className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-[#FF9800] px-3 text-xs font-black text-black disabled:opacity-50">
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Tentar novamente
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start" role="status" aria-live="polite">
                    <div className="card-premium-glass flex flex-col gap-2 rounded-2xl p-3 text-sm text-gray-700 dark:text-gray-300">
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-amber-800 dark:text-brand" aria-hidden="true" />
                        {waitSeconds < 5 ? 'Preparando resposta...' : waitSeconds < 15 ? 'O Coach está analisando sua pergunta...' : 'Esta resposta está demorando mais que o normal.'}
                      </span>
                      {waitSeconds >= 5 && (
                        <button type="button" onClick={cancelWaiting} className="self-start rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-800 dark:bg-white/10 dark:text-gray-100">Cancelar e reenviar depois</button>
                      )}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Dicas de Perguntas Rápidas */}
              <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-hide items-center">
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className={chipCls}
                  title="Limpar conversa"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Limpar
                </button>
                <button type="button" onClick={() => setInputPrompt('Pelos meus treinos registrados, como está minha evolução e cargas?')} className={chipCls}>
                  Análise de Treinos e Cargas
                </button>
                <button type="button" onClick={() => setInputPrompt('Quanto de proteína e calorias devo consumir diariamente?')} className={chipCls}>
                  Proteínas & Macros Diários
                </button>
                <button type="button" onClick={() => setInputPrompt('Qual a melhor estratégia para tomar creatina e whey?')} className={chipCls}>
                  Guia de Suplementos
                </button>
              </div>

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="flex gap-2 shrink-0">
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={e => setInputPrompt(e.target.value)}
                  placeholder="Pergunte ao Coach IA..."
                  aria-label="Mensagem para o Coach IA"
                  className="min-h-[48px] min-w-0 flex-1 rounded-2xl border border-transparent bg-gray-100 px-4 text-base text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-brand focus:ring-2 focus:ring-brand/30 dark:bg-white/5 dark:text-white"
                />
                <button type="submit" aria-label="Enviar" disabled={!inputPrompt.trim() || isTyping} className={`${btnPrimary} h-12 w-12 shrink-0 !px-0`}>
                  <Send className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: GERADOR DE TREINOS IA */}
          {activeTab === 'generator' && (
            <div className="space-y-4">
              <div className="card-premium-glass p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                <h4 className="text-xs font-black uppercase text-amber-800 dark:text-brand tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Configurar Ficha de IA
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="gen-570" className={fieldLabel}>Objetivo Principal</label>
                    <div className="relative">
                    <select id="gen-570"
                      value={selectedGoal}
                      onChange={e => setSelectedGoal(e.target.value)}
                      className={selectCls}
                    >
                      <option value="Hipertrofia">Hipertrofia (Massa)</option>
                      <option value="Emagrecimento">Emagrecimento (Definição)</option>
                      <option value="Força">Força Máxima</option>
                      <option value="Resistência">Resistência Física</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="gen-870" className={fieldLabel}>Foco Muscular</label>
                    <div className="relative">
                    <select id="gen-870"
                      value={selectedFocus}
                      onChange={e => setSelectedFocus(e.target.value)}
                      className={selectCls}
                    >
                      <option value="Peito e Tríceps">Peito + Tríceps + Ombros</option>
                      <option value="Costas e Bíceps">Costas + Bíceps + Trapézio</option>
                      <option value="Pernas Completo">Pernas Completo (Quadríceps/Glúteo)</option>
                      <option value="Ombros e ABS">Ombros + Abdômen + CORE</option>
                      <option value="Full Body (Corpo Todo)">Full Body (Corpo Todo)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="gen-893" className={fieldLabel}>Duração Desejada</label>
                    <div className="relative">
                    <select id="gen-893"
                      value={selectedDuration}
                      onChange={e => setSelectedDuration(Number(e.target.value))}
                      className={selectCls}
                    >
                      <option value={30}>30 minutos (Rápido)</option>
                      <option value={45}>45 minutos (Padrão)</option>
                      <option value={60}>60 minutos (Completo)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateWorkout}
                  disabled={isGenerating}
                  className={`${generatedWorkout ? btnGhost : btnPrimary} w-full min-h-[52px] text-sm`}
                >
                  {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Zap className="w-4 h-4" aria-hidden="true" />}
                  {isGenerating ? 'Gerando treino...' : generatedWorkout ? 'Gerar outro treino' : 'Gerar treino com IA'}
                </button>
              </div>

              {/* TREINO GERADO */}
              {generatedWorkout && (
                <div className="card-premium-glass p-4 rounded-2xl border border-[#FFC107]/30 space-y-4 animate-fade-in-up">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-[#FFC107]/10 text-amber-800 dark:text-brand text-xs font-black px-2.5 py-0.5 rounded-full border border-[#FFC107]/20 uppercase">
                        Gerado com IA
                      </span>
                      <h3 className="mt-1 font-display text-xl font-black text-gray-900 dark:text-white">{generatedWorkout.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{generatedWorkout.description}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {generatedWorkout.exercises.map((ex, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#FFC107]/10 text-amber-800 dark:text-brand text-xs font-black flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-gray-800 dark:text-white">{ex.name}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase font-bold">{ex.muscleGroup}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-amber-800 dark:text-brand">{ex.sets}x {ex.reps}</span>
                          <p className="text-[11px] text-gray-600 dark:text-gray-400 font-bold">{ex.rest}s descanso</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveWorkoutToFirestore}
                    disabled={isSaving}
                    className={`${btnPrimary} w-full min-h-[52px] text-sm`}
                  >
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> {isSaving ? 'Salvando...' : 'Salvar em Meus treinos'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NUTRIÇÃO & MACROS */}
          {activeTab === 'nutrition' && nutritionData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="card-premium-glass p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">TMB (Metabolismo Basal)</span>
                  <p className="text-lg font-black text-gray-800 dark:text-white font-mono mt-0.5">{nutritionData.bmr} kcal</p>
                </div>
                <div className="card-premium-glass p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Gasto Total (TDEE)</span>
                  <p className="text-lg font-black text-amber-800 dark:text-brand font-mono mt-0.5">{nutritionData.tdee} kcal</p>
                </div>
                <div className="col-span-2 sm:col-span-1 card-premium-glass p-3.5 rounded-2xl border border-[#FFC107]/30 text-center bg-[#FFC107]/5">
                  <span className="text-xs font-bold text-amber-800 dark:text-brand uppercase">Meta Diária IA</span>
                  <p className="text-lg font-black text-amber-800 dark:text-brand font-mono mt-0.5">{nutritionData.targetCalories} kcal</p>
                </div>
              </div>

              {/* DIVISÃO DE MACRONUTRIENTES */}
              <div className="card-premium-glass p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                <h4 className="text-xs font-black uppercase text-amber-800 dark:text-brand tracking-wider">Divisão de Macronutrientes por IA</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                    <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase block">Proteínas</span>
                    <span className="text-base font-black text-red-700 dark:text-red-400 font-mono">{nutritionData.macros.protein.grams}g</span>
                    <span className="text-[11px] text-gray-600 dark:text-gray-400 block">{nutritionData.macros.protein.percent}% das calorias</span>
                  </div>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase block">Carboidratos</span>
                    <span className="text-base font-black text-amber-800 dark:text-amber-400 font-mono">{nutritionData.macros.carbs.grams}g</span>
                    <span className="text-[11px] text-gray-600 dark:text-gray-400 block">{nutritionData.macros.carbs.percent}% das calorias</span>
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase block">Gorduras</span>
                    <span className="text-base font-black text-blue-700 dark:text-blue-400 font-mono">{nutritionData.macros.fats.grams}g</span>
                    <span className="text-[11px] text-gray-600 dark:text-gray-400 block">{nutritionData.macros.fats.percent}% das calorias</span>
                  </div>
                </div>
              </div>

              {/* SUGESTÕES DE REFEIÇÕES */}
              <div className="card-premium-glass p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                <h4 className="text-xs font-black uppercase text-gray-800 dark:text-white tracking-wider flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-amber-800 dark:text-brand" /> Guia de Refeições Sugeridas
                </h4>
                
                <div className="space-y-2">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-black text-amber-800 dark:text-brand uppercase block">Pré-Treino Recomendado</span>
                    <ul className="text-xs text-gray-700 dark:text-gray-300 mt-1 space-y-1">
                      {nutritionData.mealSuggestions.preWorkout.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5 text-amber-800 dark:text-brand shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase block">Pós-Treino Recomendado</span>
                    <ul className="text-xs text-gray-700 dark:text-gray-300 mt-1 space-y-1">
                      {nutritionData.mealSuggestions.postWorkout.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase block">Hidratação Diária Recomendada</span>
                      <span className="text-xs text-gray-600 dark:text-gray-300">Baseado no seu peso corporal ({userProfile?.weight || 70}kg)</span>
                    </div>
                    <span className="text-base font-black text-blue-700 dark:text-blue-400 font-mono">{(nutritionData.mealSuggestions.hydrationWaterMl / 1000).toFixed(1)} L/dia</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
