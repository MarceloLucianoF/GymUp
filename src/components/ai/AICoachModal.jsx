import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Utensils, MessageSquare, CheckCircle2, ChevronRight, RefreshCw, Zap, Trash2 } from 'lucide-react';
import { aiService } from '../../services/aiService';
import { db } from '../../firebase/config';
import { collection, addDoc, query, where, orderBy, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function AICoachModal({ isOpen, onClose, userProfile, user, customExercises = [], onWorkoutSaved }) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'generator' | 'nutrition'
  const [historyDocs, setHistoryDocs] = useState([]);

  // Chat State
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Olá! Sou seu **Coach de IA no AcademyUp**. Analiso seu histórico real de treinos e métricas corporais para oferecer orientações científicas e personalizadas. Como posso te ajudar hoje?`
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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
        height: userProfile.height || 175,
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

  if (!isOpen) return null;

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: `Olá! Sou seu **Coach de IA no AcademyUp**. Analiso seu histórico real de treinos e métricas corporais para oferecer orientações científicas e personalizadas. Como posso te ajudar hoje?`
      }
    ]);
    toast.success('Conversa reiniciada.');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isTyping) return;

    const userText = inputPrompt.trim();
    setInputPrompt('');
    const userMsg = { id: Date.now().toString(), sender: 'user', text: userText };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const responseText = await aiService.askAICoach({
        prompt: userText,
        userProfile,
        historyDocs,
        conversationHistory: messages,
        customExercises,
        onWorkout: (workout) => {
          setGeneratedWorkout(workout);
          toast.success('Treino gerado! Veja na aba Treino.');
        }
      });
      const aiMsg = { id: (Date.now() + 1).toString(), sender: 'ai', text: responseText };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao conectar com o Coach IA.');
    } finally {
      setIsTyping(false);
    }
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#1F2937] border border-[#FFC107]/30 rounded-3xl w-full max-w-2xl h-[90vh] max-h-[750px] shadow-2xl flex flex-col overflow-hidden relative animate-fade-in-up">
        
        {/* HEADER DO MODAL */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-gray-900 via-[#1F2937] to-gray-900 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFC107] to-[#FF9800] flex items-center justify-center text-black font-black shadow-lg shadow-[#FFC107]/20">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">Coach IA & Nutrição</h3>
                <span className="bg-[#FFC107]/10 text-[#FFC107] text-[9px] font-black px-2 py-0.5 rounded-full border border-[#FFC107]/20 uppercase">Llama 3.1 70B</span>
              </div>
              <p className="text-[11px] text-gray-400">Inteligência fitness com dados do seu perfil</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full bg-gray-100 dark:bg-gray-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="grid grid-cols-3 p-2 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0 gap-1">
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'chat'
                ? 'bg-gradient-to-r from-[#FFC107] to-[#FF9800] text-black shadow-md font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Chat IA
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'generator'
                ? 'bg-gradient-to-r from-[#FFC107] to-[#FF9800] text-black shadow-md font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Gerador Treino
          </button>
          <button
            onClick={() => setActiveTab('nutrition')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'nutrition'
                ? 'bg-gradient-to-r from-[#FFC107] to-[#FF9800] text-black shadow-md font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Utensils className="w-4 h-4" /> Nutrição
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-[#0B0F19]">
          
          {/* TAB 1: CHAT IA */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full justify-between gap-4">
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-[#FFC107] to-[#FF9800] text-black font-semibold rounded-tr-none'
                        : 'card-premium-glass text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-200 dark:border-gray-800'
                    }`}>
                      {msg.text.split('**').map((chunk, i) => i % 2 === 1 ? <strong key={i} className="font-black text-[#FFC107] dark:text-[#FFC107]">{chunk}</strong> : chunk)}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="card-premium-glass p-3 rounded-2xl text-xs text-gray-400 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FFC107]" /> Coach IA digitando...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Dicas de Perguntas Rápidas */}
              <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-hide items-center">
                <button 
                  onClick={handleClearHistory} 
                  className="text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-400 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 rounded-full flex items-center gap-1 shrink-0 transition-colors"
                  title="Limpar conversa"
                >
                  <Trash2 className="w-3 h-3" /> Limpar
                </button>
                <button onClick={() => setInputPrompt('Pelos meus treinos registrados, como está minha evolução e cargas?')} className="text-[10px] font-bold bg-[#FFC107]/10 text-[#FFC107] border border-[#FFC107]/30 px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-[#FFC107]/20 shrink-0">
                  Análise de Treinos e Cargas
                </button>
                <button onClick={() => setInputPrompt('Quanto de proteína e calorias devo consumir diariamente?')} className="text-[10px] font-bold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 whitespace-nowrap hover:border-[#FFC107] shrink-0">
                  Proteínas & Macros Diários
                </button>
                <button onClick={() => setInputPrompt('Qual a melhor estratégia para tomar creatina e whey?')} className="text-[10px] font-bold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 whitespace-nowrap hover:border-[#FFC107] shrink-0">
                  Guia de Suplementos
                </button>
              </div>

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="flex gap-2 shrink-0">
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={e => setInputPrompt(e.target.value)}
                  placeholder="Pergunte ao Coach IA (treinos, dieta, suplementos)..."
                  className="flex-1 input-brand-dark text-xs"
                />
                <button type="submit" disabled={!inputPrompt.trim() || isTyping} className="btn-primary-gradient px-4 py-3 rounded-xl touch-target text-xs font-bold disabled:opacity-50">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: GERADOR DE TREINOS IA */}
          {activeTab === 'generator' && (
            <div className="space-y-4">
              <div className="card-premium-glass p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                <h4 className="text-xs font-black uppercase text-[#FFC107] tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Configurar Ficha de IA
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Objetivo Principal</label>
                    <select
                      value={selectedGoal}
                      onChange={e => setSelectedGoal(e.target.value)}
                      className="w-full input-brand-dark text-xs font-bold py-2.5"
                    >
                      <option value="Hipertrofia">Hipertrofia (Massa)</option>
                      <option value="Emagrecimento">Emagrecimento (Definição)</option>
                      <option value="Força">Força Máxima</option>
                      <option value="Resistência">Resistência Física</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Foco Muscular</label>
                    <select
                      value={selectedFocus}
                      onChange={e => setSelectedFocus(e.target.value)}
                      className="w-full input-brand-dark text-xs font-bold py-2.5"
                    >
                      <option value="Peito e Tríceps">Peito + Tríceps + Ombros</option>
                      <option value="Costas e Bíceps">Costas + Bíceps + Trapézio</option>
                      <option value="Pernas Completo">Pernas Completo (Quadríceps/Glúteo)</option>
                      <option value="Ombros e ABS">Ombros + Abdômen + CORE</option>
                      <option value="Full Body (Corpo Todo)">Full Body (Corpo Todo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Duração Desejada</label>
                    <select
                      value={selectedDuration}
                      onChange={e => setSelectedDuration(Number(e.target.value))}
                      className="w-full input-brand-dark text-xs font-bold py-2.5"
                    >
                      <option value={30}>30 minutos (Rápido)</option>
                      <option value={45}>45 minutos (Padrão)</option>
                      <option value={60}>60 minutos (Completo)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleGenerateWorkout}
                  disabled={isGenerating}
                  className="w-full btn-primary-gradient py-3.5 text-xs font-black rounded-xl touch-target shadow-lg flex items-center justify-center gap-2"
                >
                  {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                  GERAR TREINO COM INTELIGÊNCIA ARTIFICIAL
                </button>
              </div>

              {/* TREINO GERADO */}
              {generatedWorkout && (
                <div className="card-premium-glass p-4 rounded-2xl border border-[#FFC107]/30 space-y-4 animate-fade-in-up">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-[#FFC107]/10 text-[#FFC107] text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#FFC107]/20 uppercase">
                        Gerado com IA ✨
                      </span>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">{generatedWorkout.name}</h3>
                      <p className="text-xs text-gray-400">{generatedWorkout.description}</p>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {generatedWorkout.exercises.map((ex, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#FFC107]/10 text-[#FFC107] text-xs font-black flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-gray-800 dark:text-white">{ex.name}</h4>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">{ex.muscleGroup}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-[#FFC107]">{ex.sets}x {ex.reps}</span>
                          <p className="text-[9px] text-gray-400 font-bold">{ex.rest}s descanso</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSaveWorkoutToFirestore}
                    disabled={isSaving}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3.5 text-xs rounded-xl touch-target shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" /> SALVAR TREINO EM "MEUS TREINOS"
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
                  <span className="text-[10px] font-bold text-gray-400 uppercase">TMB (Metabolismo Basal)</span>
                  <p className="text-lg font-black text-gray-800 dark:text-white font-mono mt-0.5">{nutritionData.bmr} kcal</p>
                </div>
                <div className="card-premium-glass p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Gasto Total (TDEE)</span>
                  <p className="text-lg font-black text-[#FFC107] font-mono mt-0.5">{nutritionData.tdee} kcal</p>
                </div>
                <div className="col-span-2 sm:col-span-1 card-premium-glass p-3.5 rounded-2xl border border-[#FFC107]/30 text-center bg-[#FFC107]/5">
                  <span className="text-[10px] font-bold text-[#FFC107] uppercase">Meta Diária IA</span>
                  <p className="text-lg font-black text-[#FFC107] font-mono mt-0.5">{nutritionData.targetCalories} kcal</p>
                </div>
              </div>

              {/* DIVISÃO DE MACRONUTRIENTES */}
              <div className="card-premium-glass p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                <h4 className="text-xs font-black uppercase text-[#FFC107] tracking-wider">Divisão de Macronutrientes por IA</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-red-400 uppercase block">Proteínas</span>
                    <span className="text-base font-black text-red-400 font-mono">{nutritionData.macros.protein.grams}g</span>
                    <span className="text-[9px] text-gray-400 block">{nutritionData.macros.protein.percent}% das calorias</span>
                  </div>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-amber-400 uppercase block">Carboidratos</span>
                    <span className="text-base font-black text-amber-400 font-mono">{nutritionData.macros.carbs.grams}g</span>
                    <span className="text-[9px] text-gray-400 block">{nutritionData.macros.carbs.percent}% das calorias</span>
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-blue-400 uppercase block">Gorduras</span>
                    <span className="text-base font-black text-blue-400 font-mono">{nutritionData.macros.fats.grams}g</span>
                    <span className="text-[9px] text-gray-400 block">{nutritionData.macros.fats.percent}% das calorias</span>
                  </div>
                </div>
              </div>

              {/* SUGESTÕES DE REFEIÇÕES */}
              <div className="card-premium-glass p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                <h4 className="text-xs font-black uppercase text-gray-800 dark:text-white tracking-wider flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-[#FFC107]" /> Guia de Refeições Sugeridas
                </h4>
                
                <div className="space-y-2">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700">
                    <span className="text-[10px] font-black text-[#FFC107] uppercase block">🍌 Pré-Treino Recomendado</span>
                    <ul className="text-xs text-gray-700 dark:text-gray-300 mt-1 space-y-1">
                      {nutritionData.mealSuggestions.preWorkout.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5 text-[#FFC107] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700">
                    <span className="text-[10px] font-black text-green-500 uppercase block">🍗 Pós-Treino Recomendado</span>
                    <ul className="text-xs text-gray-700 dark:text-gray-300 mt-1 space-y-1">
                      {nutritionData.mealSuggestions.postWorkout.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black text-blue-400 uppercase block">💧 Hidratação Diária Recomendada</span>
                      <span className="text-xs text-gray-300">Baseado no seu peso corporal ({userProfile?.weight || 70}kg)</span>
                    </div>
                    <span className="text-base font-black text-blue-400 font-mono">{(nutritionData.mealSuggestions.hydrationWaterMl / 1000).toFixed(1)} L/dia</span>
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
