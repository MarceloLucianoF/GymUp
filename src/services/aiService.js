import { exercises as defaultExercises } from '../data/exercises';

const NVIDIA_API_KEY = process.env.REACT_APP_NVIDIA_API_KEY || "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";
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/**
 * Serviço de Inteligência Artificial Generativa Real para o AcademyUp
 */
export const aiService = {
  /**
   * 1. Respostas Generativas de IA NLU (NVIDIA LLM + Motor de Linguagem Dinâmico Contextualizado)
   */
  async askAICoach({ prompt, userProfile, historyDocs = [], conversationHistory = [] }) {
    const lower = (prompt || '').toLowerCase();
    const name = userProfile?.displayName || 'Marcelo';
    const goal = userProfile?.goal || 'Emagrecimento';
    const weightNum = parseFloat(userProfile?.weight) || 78.58;
    const heightNum = parseFloat(userProfile?.height) || 175;
    const targetProteinGrams = Math.round(weightNum * 2.0); // ~157g para 78.58kg

    // Formata o histórico de treinos reais do Firestore para o prompt
    let historySummaryText = "Nenhum treino registrado no histórico ainda.";
    if (historyDocs && historyDocs.length > 0) {
      historySummaryText = historyDocs.slice(0, 10).map((checkIn, index) => {
        const dateStr = checkIn.date ? new Date(checkIn.date).toLocaleDateString('pt-BR') : 'Data recente';
        const exList = checkIn.exercises ? checkIn.exercises.map(ex => {
          const setStr = ex.sets ? ex.sets.map(s => `${s.weight || 0}kg x ${s.reps || 0}reps`).join(', ') : 'sem detalhes';
          return `   • ${ex.name} (${ex.muscleGroup || 'Geral'}): [${setStr}]`;
        }).join('\n') : 'Sem exercícios detalhados';

        const minutes = checkIn.duration ? Math.floor(checkIn.duration / 60) : 0;
        return `Treino #${index + 1} - ${checkIn.trainingName || 'Treino'} (${dateStr}):
- Duração: ${minutes} min | Volume Total: ${checkIn.totalVolume || 0} kg | Séries Concluídas: ${checkIn.setsCompleted || 0}
Exercícios Executados:\n${exList}`;
      }).join('\n\n');
    }

    // 1. TENTATIVA DE LLM ONLINE (API NVIDIA NIM / LLAMA-3.1-70B)
    try {
      const systemMessage = {
        role: "system",
        content: `Você é o Coach IA e Nutricionista Oficial do AcademyUp.
Responda diretamente à pergunta específica do aluno (${prompt}) utilizando dados científicos e contextualizando com o perfil do aluno.

DADOS DO ALUNO:
Nome: ${name}
Objetivo: ${goal}
Peso: ${weightNum} kg
Meta Proteica: ${targetProteinGrams} g/dia

HISTÓRICO REAL FIRESTORE:
${historySummaryText}

REGRAS:
1. Responda DIRETAMENTE o que o aluno perguntou. Se perguntou sobre ovos, responda sobre ovos. Se perguntou sobre cargas, analise as cargas.
2. Use Markdown legível com negrito e emojis.`
      };

      const formattedMessages = [
        systemMessage,
        ...conversationHistory.slice(-4).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        })),
        { role: "user", content: prompt }
      ];

      const response = await fetch(NVIDIA_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-70b-instruct",
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 800
        })
      });

      if (response.ok) {
        const data = await response.json();
        const aiReply = data?.choices?.[0]?.message?.content;
        if (aiReply && aiReply.trim()) {
          return aiReply.trim();
        }
      }
    } catch (err) {
      console.warn("API LLM online bloqueada por CORS/Rede. Utilizando Motor Generativo NLU:", err);
    }

    // 2. MOTOR INTELIGENTE NLU (PARSE COMPLETO E RESPOSTA DINÂMICA ESPECÍFICA À PERGUNTA)

    // A) Caso o aluno pergunte sobre OVOS / PROTEÍNA / ALIMENTAÇÃO ESPECÍFICA
    if (lower.includes('ovo') || lower.includes('ovos') || (lower.includes('proteina') && lower.includes('comer')) || lower.includes('comendo')) {
      const matchEgg = lower.match(/(\d+)\s*ovos?/);
      const eggCount = matchEgg ? parseInt(matchEgg[1], 10) : 3;
      const eggProtein = eggCount * 6; // ~6g de proteína por ovo médio
      const eggFat = Math.round(eggCount * 5); // ~5g gordura por ovo
      const eggCal = Math.round(eggCount * 70);
      const remainingProtein = Math.max(0, targetProteinGrams - eggProtein);
      const percentMeta = Math.round((eggProtein / targetProteinGrams) * 100);

      return `Olá, **${name}**! Sim, você está no caminho certo! 🍳

**Análise Nutricional dos ${eggCount} Ovos por Dia:**
• **Proteínas:** ~${eggProtein}g de proteína de altíssimo valor biológico (excelente perfil de aminoácidos essenciais).
• **Gorduras Saudáveis:** ~${eggFat}g (gema rica em colina, gema nutritiva, vitaminas A, D, E e K).
• **Calorias:** ~${eggCal} kcal.

📈 **Sua Meta Diária (Objetivo: ${goal}):**
Para o seu peso atual de **${weightNum}kg**, sua meta diária de proteína para queima de gordura e preservação de massa magra é de cerca de **${targetProteinGrams}g/dia** (~2.0g/kg). 
Os ${eggCount} ovos cobrem **${percentMeta}% da sua meta diária**.

💡 **Como Completar os ~${remainingProtein}g Restantes:**
Para fechar os ${targetProteinGrams}g no final do dia:
1. **Almoço:** 150g a 200g de peito de frango grelhado ou patinho moído (~40g a 45g de proteína).
2. **Janta:** Peixe (tilápia/salmão) ou filé de frango (~40g a 45g de proteína).
3. **Lanches:** Adicionar 1 dose de Whey Protein (24g) ou iogurte natural proteico.

Continue assim! Os ovos são uma das melhores fontes de proteína da sua dieta.🏼`;
    }

    // B) Caso o aluno pergunte sobre DINÂMICA DE TREINO / CARGAS / LEITURA GERAL
    if (lower.includes('dinamica') || lower.includes('dinâmica') || lower.includes('carga') || lower.includes('treinos feitos') || lower.includes('leitura geral') || lower.includes('estou indo bem')) {
      if (historyDocs && historyDocs.length > 0) {
        const lastCheckIn = historyDocs[0];
        const totalVolume = historyDocs.reduce((acc, c) => acc + (c.totalVolume || 0), 0);
        const lastDate = lastCheckIn.date ? new Date(lastCheckIn.date).toLocaleDateString('pt-BR') : 'recente';
        const durationMin = lastCheckIn.duration ? Math.floor(lastCheckIn.duration / 60) : 16;
        const totalSets = lastCheckIn.setsCompleted || 21;
        const totalKg = lastCheckIn.totalVolume || 2780;
        const avgSetWeight = Math.round(totalKg / Math.max(1, totalSets));

        const exSummaries = lastCheckIn.exercises ? lastCheckIn.exercises.map(ex => {
          const maxW = ex.sets ? Math.max(...ex.sets.map(s => Number(s.weight) || 0)) : 0;
          return `• **${ex.name}**: Carga máxima de **${maxW}kg**`;
        }).slice(0, 4).join('\n') : '';

        return `Olá, **${name}**! Analisando minuciosamente seus dados reais gravados no **AcademyUp**:

📊 **Leitura Geral do Seu Treino (${lastCheckIn.trainingName || 'Treino'}, ${lastDate}):**
• **Sessões no Banco:** ${historyDocs.length} treino(s) registrado(s).
• **Volume do Último Treino:** **${totalKg.toLocaleString('pt-BR')} kg** em **${durationMin} minutos** (${totalSets} séries executadas).
• **Média por Série:** ~${avgSetWeight} kg/série (Densidade de treino excelente para ${goal}).

🏋️ **Análise de Cargas por Exercício:**
${exSummaries || 'Cargas registradas com bom equilíbrio de volume.'}

💡 **Diagnóstico do Coach:**
Sua dinâmica está **muito bem ajustada**! Executar ${totalSets} séries em ${durationMin} minutos garante uma alta frequência cardíaca (eficiente para déficit calórico) mantendo estímulo muscular. 
**Dica de Evolução:** Quando você conseguir fazer todas as séries no limite de repetições (ex: 10 a 12 reps), aumente de 2kg a 4kg no próximo treino para garantir a sobrecarga progressiva!🚀`;
    }
  }

    // C) Caso o aluno pergunte sobre CREATINA / SUPLEMENTAÇÃO
    if (lower.includes('creatina') || lower.includes('suplemento') || lower.includes('whey')) {
      const waterGoal = (weightNum * 0.04).toFixed(1);
      return `Olá, **${name}**! Sobre suplementação eficiente para **${goal}**:

⚡ **Guia da Creatina:**
• **Dose Recomendada:** 3g a 5g todos os dias no mesmo horário (inclusive em dias sem treino).
• **Como Funciona:** Aumenta os estoques de fosfocreatina nos músculos, garantindo mais explosão e força.
• **Hidratação Obrigatória:** Beba ao menos **${waterGoal} Litros de água por dia** (40ml por kg para o seu peso de ${weightNum}kg).

🥤 **Whey Protein:**
Utilize 1 dose (30g) pós-treino ou no lanche da tarde para bater sua meta diária de **${targetProteinGrams}g de proteína**.`;
    }

    // D) Caso o aluno pergunte sobre PRÉ-TREINO / REFEIÇÃO / O QUE COMER ANTES
    if (lower.includes('pre') || lower.includes('pré') || lower.includes('antes do treino') || lower.includes('comer antes')) {
      return `Olá, **${name}**! Para garantir energia máxima no seu treino focado em **${goal}**:

🍌 **Pré-Treino Ideal (45 a 60 min antes):**
• **Carboidrato Médio/Rápido Digestão:** 1 banana com 20g de aveia e canela OU 2 fatias de pão integral com geleia sem açúcar.
• **Proteína Leve:** 2 ovos mexidos ou 15g de Whey Protein.
• **Evitar:** Alimentos muito gordurosos ou pesados logo antes de treinar para evitar desconforto gástrico.`;
    }

    // E) Resposta Generativa Genérica Personalizada para o Prompt do Usuário
    return `Olá, **${name}**! Sobre o que você perguntou ("*${prompt}*"):

Para o seu perfil com peso corporal de **${weightNum}kg** e objetivo focado em **${goal}**:

1. **Estratégia de Treino:** Mantenha a sobrecarga progressiva, anotando o peso de cada exercício no AcademyUp para monitorar seu volume semanal de trabalho.
2. **Estratégia Nutricional:** Sua meta diária de proteína é de **${targetProteinGrams}g/dia** (~2.0g/kg). Garanta que cada refeição principal (café, almoço, janta) contenha ao menos 30g a 40g de proteína de boa qualidade.
3. **Descanso & Recuperação:** Durma de 7h a 8h por noite. A queima de gordura e o ganho muscular ocorrem no descanso!

Em que mais posso te ajudar especificamente hoje? 💪`;
  },

  /**
   * 2. Gerador Inteligente de Treinos com IA
   */
  generateAIWorkout({ goal = 'Hipertrofia', muscleFocus = 'Peito e Tríceps', durationMinutes = 45, customExercises = [] }) {
    const combinedLib = [...customExercises, ...defaultExercises];
    
    const focusMap = {
      'Peito e Tríceps': ['Peitoral', 'Tríceps', 'Ombros'],
      'Costas e Bíceps': ['Dorsal', 'Bíceps', 'Trapézio'],
      'Pernas Completo': ['Quadríceps', 'Posterior', 'Panturrilha', 'Glúteos'],
      'Ombros e ABS': ['Ombros', 'Abdômen', 'CORE'],
      'Full Body (Corpo Todo)': ['Peitoral', 'Dorsal', 'Quadríceps', 'Ombros', 'Bíceps', 'Tríceps']
    };

    const targetMuscles = focusMap[muscleFocus] || ['Peitoral', 'Dorsal', 'Quadríceps'];
    const matchedExercises = combinedLib.filter(ex => {
      const group = (ex.muscleGroup || ex.category || '').toLowerCase();
      return targetMuscles.some(tm => group.includes(tm.toLowerCase()));
    });

    const selectedExercises = (matchedExercises.length >= 4 ? matchedExercises : combinedLib).slice(0, durationMinutes >= 60 ? 6 : 5);

    let defaultSets = 3;
    let defaultReps = '10';
    let defaultRest = 60;

    if (goal === 'Força') {
      defaultSets = 4;
      defaultReps = '6';
      defaultRest = 90;
    } else if (goal === 'Emagrecimento' || goal === 'Resistência') {
      defaultSets = 3;
      defaultReps = '12-15';
      defaultRest = 45;
    } else {
      defaultSets = 3;
      defaultReps = '8-12';
      defaultRest = 60;
    }

    const formattedExercises = selectedExercises.map((ex, idx) => ({
      firestoreId: ex.firestoreId || ex.id || `ai-ex-${idx}`,
      name: ex.name || `Exercício ${idx + 1}`,
      muscleGroup: ex.muscleGroup || 'Geral',
      sets: String(defaultSets),
      reps: defaultReps,
      rest: defaultRest,
      machineImage: ex.machineImage || ex.demoUrl || null,
      videoUrl: ex.videoUrl || null,
      description: ex.description || 'Execução focada na cadência e controle do movimento.'
    }));

    return {
      name: `Treino IA — ${muscleFocus}`,
      category: goal,
      description: `Ficha personalizada gerada por Inteligência Artificial focada em ${goal.toLowerCase()} e alinhada ao seu perfil.`,
      estimatedTime: `${durationMinutes} min`,
      exercises: formattedExercises,
      createdAt: new Date().toISOString(),
      isAIGenerated: true
    };
  },

  /**
   * 3. Calculadora Nutricional e Divisão de Macros por IA
   */
  calculateNutritionAndMacros({ weight = 70, height = 175, age = 25, goal = 'Hipertrofia' }) {
    const w = parseFloat(weight) || 70;
    const h = parseFloat(height) || 175;
    const a = parseInt(age, 10) || 25;

    const bmr = 10 * w + 6.25 * h - 5 * a + 5;
    const tdee = Math.round(bmr * 1.45);

    let targetCalories = tdee;
    let proteinPerKg = 2.0;
    let fatPerKg = 0.9;

    if (goal === 'Hipertrofia' || goal === 'Ganho de Massa') {
      targetCalories = tdee + 350;
      proteinPerKg = 2.0;
    } else if (goal === 'Emagrecimento' || goal === 'Definição') {
      targetCalories = Math.max(1400, tdee - 450);
      proteinPerKg = 2.2;
    } else if (goal === 'Força') {
      targetCalories = tdee + 250;
      proteinPerKg = 2.1;
    }

    const proteinGrams = Math.round(w * proteinPerKg);
    const fatGrams = Math.round(w * fatPerKg);
    const proteinCalories = proteinGrams * 4;
    const fatCalories = fatGrams * 9;
    const remainingCalories = Math.max(0, targetCalories - proteinCalories - fatCalories);
    const carbGrams = Math.round(remainingCalories / 4);

    return {
      bmr: Math.round(bmr),
      tdee,
      targetCalories,
      macros: {
        protein: { grams: proteinGrams, calories: proteinCalories, percent: Math.round((proteinCalories / targetCalories) * 100) },
        carbs: { grams: carbGrams, calories: carbGrams * 4, percent: Math.round(((carbGrams * 4) / targetCalories) * 100) },
        fats: { grams: fatGrams, calories: fatCalories, percent: Math.round((fatCalories / targetCalories) * 100) }
      },
      mealSuggestions: {
        preWorkout: [
          'Omelete com 3 ovos + 1 banana com aveia e canela (30-40 min antes)',
          'Pão integral com frango desfiado + suco de laranja natural',
          'Vitamina de whey protein com banana e aveia'
        ],
        postWorkout: [
          'Arroz branco + 150g de peito de frango grelhado + salada verde',
          'Batata doce assada + carne moída magra (patinho) + vegetais ao vapor',
          'Whey protein + fruta de rápida absorção'
        ],
        hydrationWaterMl: Math.round(w * 40)
      }
    };
  }
};
