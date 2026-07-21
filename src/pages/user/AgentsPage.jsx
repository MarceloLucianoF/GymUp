import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Code, ShieldAlert, Lightbulb, Coins, Palette, MessageSquare, Send, CheckCircle2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AgentsPage() {
  const [activeTab, setActiveTab] = useState('council'); // 'council' | 'front' | 'back'
  const [queryText, setQueryText] = useState('');
  const [isDebating, setIsDebating] = useState(false);
  const [currentTypingAgent, setCurrentTypingAgent] = useState(null);
  const [debateHistory, setDebateHistory] = useState([]);
  
  // Agentes específicos de front e back
  const [frontChat, setFrontChat] = useState([]);
  const [backChat, setBackChat] = useState([]);
  const [frontInput, setFrontInput] = useState('');
  const [backInput, setBackInput] = useState('');
  
  const debateEndRef = useRef(null);

  const councilMembers = [
    {
      id: 'alistair',
      name: 'Dr. Alistair',
      role: 'Ceticismo & Riscos',
      avatar: <ShieldAlert className="w-5 h-5 text-red-400" />,
      avatarBg: 'bg-red-950/40 border-red-500/30',
      color: 'text-red-400',
      bio: 'Exige análise de riscos, segurança de dados e otimização de performance. Avesso a firulas.'
    },
    {
      id: 'clara',
      name: 'Clara',
      role: 'Inovação & IA',
      avatar: <Lightbulb className="w-5 h-5 text-yellow-400" />,
      avatarBg: 'bg-yellow-950/40 border-yellow-500/30',
      color: 'text-yellow-400',
      bio: 'Defende novas tecnologias, gamificação, micro-interações e recursos modernos.'
    },
    {
      id: 'enzo',
      name: 'Enzo',
      role: 'Viabilidade & Custos',
      avatar: <Coins className="w-5 h-5 text-green-400" />,
      avatarBg: 'bg-green-950/40 border-green-500/30',
      color: 'text-green-400',
      bio: 'Focado em manter o MVP simples, reduzir o custo de escrita/leitura do Firebase e economizar tempo.'
    },
    {
      id: 'sofia',
      name: 'Sofia',
      role: 'Experiência do Usuário (UX/UI)',
      avatar: <Palette className="w-5 h-5 text-pink-400" />,
      avatarBg: 'bg-pink-950/40 border-pink-500/30',
      color: 'text-pink-400',
      bio: 'Focada em acessibilidade, navegação fluida, consistência visual e apelo estético.'
    },
    {
      id: 'arthur',
      name: 'Arthur',
      role: 'Clean Code & SOLID',
      avatar: <Code className="w-5 h-5 text-blue-400" />,
      avatarBg: 'bg-blue-950/40 border-blue-500/30',
      color: 'text-blue-400',
      bio: 'Focado em padrões de projeto, testabilidade, refatoração, hooks customizados e modularidade.'
    }
  ];

  // Auto-scroll
  useEffect(() => {
    debateEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debateHistory, currentTypingAgent]);

  // Lógica de Geração de Respostas do Conselho
  const generateCouncilResponse = (query) => {
    const q = String(query).toLowerCase();
    
    // 1. Caso: Gamificação / Medalhas / Conquistas
    if (q.includes('gamific') || q.includes('conquista') || q.includes('medalha') || q.includes('ponto') || q.includes('xp')) {
      return {
        alistair: "Minha preocupação com a gamificação é o risco de fraude de dados (alunos marcando treinos falsos para ganhar medalhas) e a sobrecarga de queries adicionais de escrita no Firestore a cada ação. Precisamos blindar a API.",
        clara: "Precisamos de medalhas em 3D, níveis de XP animados no perfil e confete explodindo na tela sempre que o treino for concluído! Gamificação é a chave para aumentar o engajamento diário dos alunos.",
        enzo: "Medalhas 3D são caras de carregar e demoradas para programar. Sugiro apenas uma contagem simples de XP salva diretamente no documento `users` do aluno, o que custa exatamente zero leituras/escritas adicionais no Firebase.",
        sofia: "Concordo com a Clara sobre a motivação, mas o design deve ser minimalista. Uma barra de progresso sutil no dashboard e toasts elegantes. Excesso de confete pode incomodar o usuário no dia a dia.",
        arthur: "Toda a lógica de gamificação (cálculo de nível, validação de conquistas) deve ficar encapsulada em um hook customizado `useGamification.js`. Não podemos poluir as páginas de visualização com essa lógica de negócio.",
        president: "VEREDITO: Aprovada a gamificação minimalista. Salvaremos os dados de XP e conquistas dentro do documento de perfil (`users`) para evitar custos de banco de dados (apoio ao Enzo). Usaremos animações nativas com CSS e confetti leve em JS (apoio à Sofia/Clara) e toda a lógica ficará centralizada em um hook customizado (apoio ao Arthur)."
      };
    }
    
    // 2. Caso: Visual / Design / Emojis / Ícones
    if (q.includes('visual') || q.includes('design') || q.includes('emoji') || q.includes('icon') || q.includes('estetic') || q.includes('tema')) {
      return {
        alistair: "Substituir emojis por pacotes de ícones gigantescos pode aumentar o tamanho do bundle JavaScript. Recomendo importar apenas os ícones estritamente necessários via tree-shaking para manter o app veloz.",
        clara: "Finalmente! Emojis deixavam o site com cara de amador. Devemos ir além de apenas trocar por ícones: vamos colocar fundos com glassmorphism (desfoque), gradientes dinâmicos que mudam de cor com o grupo muscular do treino e transições em 3D.",
        enzo: "A troca de emojis por ícones Lucide é barata em desenvolvimento e não gera custo de banco de dados. Sou a favor. Mas vamos barrar animações pesadas e layouts hiper complexos para entregar rápido.",
        sofia: "Perfeito. Ícones Lucide trazem consistência visual, facilitam a leitura e melhoram a acessibilidade. Recomendo usar cores consistentes: azul para peito, verde para perna, vermelho para cardio, facilitando a navegação.",
        arthur: "Do ponto de vista de código, para trocar esses ícones precisamos importar o pacote `lucide-react`. Recomendo padronizar um componente wrapper de ícone ou exportar componentes isolados para evitar repetição de classes Tailwind.",
        president: "VEREDITO: Homologada a substituição total de emojis por Lucide React Icons. O visual do site será modernizado com cores de grupos musculares unificadas (sugestão da Sofia) e gradientes suaves para manter o visual premium, mantendo a performance com tree-shaking ativo no webpack (sugestão de Alistair e Arthur)."
      };
    }

    // 3. Caso: Seed / Banco / Firestore / Script
    if (q.includes('seed') || q.includes('banco') || q.includes('dados') || q.includes('firestore') || q.includes('limpar') || q.includes('limpeza')) {
      return {
        alistair: "Executar scripts de seed que limpam coleções inteiras é um perigo crítico. Devemos garantir que o script `seed.cjs` recuse a execução caso detecte credenciais de produção, abortando imediatamente.",
        clara: "Seria excelente termos um seed inteligente integrado a um painel admin visual onde possamos gerar massas de dados mockados com IA em um clique, facilitando testes de novas features.",
        enzo: "A limpeza completa do banco para testes economiza tempo. O Firebase tem limite gratuito diário de 20 mil escritas. Nosso seed com 24 exercícios e 4 treinos está perfeito e econômico.",
        sofia: "Os treinos e exercícios do seed precisam ter nomes, descrições e URLs de imagens reais. Ver 'Exercício Teste 1' ou placeholders cinzas desestimula o teste da usabilidade.",
        arthur: "O script de seed que criamos resolve perfeitamente a conversão de IDs legados em strings do Firestore usando um mapa de associação temporário. Deve ser mantido modular e fácil de rodar com Node.",
        president: "VEREDITO: Aprovado o uso do script `scripts/seed.cjs`. O script está configurado para limpar o banco de dados local/teste e inserir dados realistas com mapeamento de relacionamentos (Arthur/Sofia). O comando foi integrado ao Makefile (`make seed`) e Alistair tem razão: o script impede a execução se não encontrar as credenciais adequadas."
      };
    }

    // Fallback padrão
    return {
      alistair: "Precisamos conduzir uma análise minuciosa de segurança e performance antes de aprovar essa alteração. Qualquer aumento de latência na requisição é inaceitável.",
      clara: "Isso soa promissor! Acho que deveríamos criar um protótipo com layouts avançados e suporte a IA para impressionar e engajar mais usuários.",
      enzo: "A ideia é boa, mas o que ela resolve de imediato? Se não for essencial para o núcleo do negócio, sugiro simplificar ou adiar para evitar custos extras.",
      sofia: "Seja qual for a decisão, a interface precisa ser limpa e direta. O usuário não pode ficar confuso ao tentar executar uma ação básica.",
      arthur: "Se implementarmos isso, precisamos garantir que o código seja desacoplado, modular e coberto por testes unitários simples. Evitemos código espaguete.",
      president: "VEREDITO: Decisão tomada. Focaremos em uma abordagem híbrida: a mudança será implementada de maneira simples e modular (sugestão do Arthur/Enzo) com prioridade na experiência do usuário e design limpo (Sofia), adiando recursos complexos para a próxima fase."
    };
  };

  const handleCouncilSubmit = (e) => {
    e.preventDefault();
    if (!queryText.trim() || isDebating) return;

    const userPrompt = queryText;
    setQueryText('');
    setIsDebating(true);
    
    // Iniciar novo debate no log
    const responses = generateCouncilResponse(userPrompt);
    
    setDebateHistory(prev => [...prev, {
      type: 'user',
      text: userPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    let step = 0;
    const membersList = [...councilMembers];
    
    const debateInterval = setInterval(() => {
      if (step < membersList.length) {
        const currentMember = membersList[step];
        setCurrentTypingAgent(currentMember.name);
        
        // Simular digitação
        setTimeout(() => {
          setDebateHistory(prev => [...prev, {
            type: 'agent',
            agentName: currentMember.name,
            role: currentMember.role,
            avatar: currentMember.avatar,
            avatarBg: currentMember.avatarBg,
            color: currentMember.color,
            text: responses[currentMember.id],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
          step++;
        }, 1200);

      } else {
        clearInterval(debateInterval);
        setCurrentTypingAgent("Presidente Valdemar");
        
        // Veredito do Presidente
        setTimeout(() => {
          setDebateHistory(prev => [...prev, {
            type: 'president',
            agentName: 'Presidente Valdemar',
            role: 'Veredito do Conselho',
            avatar: <CheckCircle2 className="w-5 h-5 text-purple-400" />,
            avatarBg: 'bg-purple-950/40 border-purple-500/30',
            color: 'text-purple-400 font-bold',
            text: responses.president,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
          
          setCurrentTypingAgent(null);
          setIsDebating(false);
          toast.success("O conselho emitiu um veredito!");
        }, 1500);
      }
    }, 1800);
  };

  const handleFrontSubmit = (e) => {
    e.preventDefault();
    if (!frontInput.trim()) return;

    const text = frontInput;
    setFrontInput('');

    setFrontChat(prev => [...prev, { sender: 'user', text }]);
    
    // Resposta simulada Front Agent baseada no código
    setTimeout(() => {
      let response = "Olá! Sou o Agente Front-End. O site do AcademyUp utiliza React 19 no front-end, estruturado com componentes funcionais e hooks. A estilização é feita com Tailwind CSS (v3.4) e os gráficos são gerados dinamicamente via Recharts (em MeasurementsPage e ExerciseAnalytics). Se precisar saber sobre o Navbar, ele foi atualizado com ícones da biblioteca Lucide React.";
      
      const t = text.toLowerCase();
      if (t.includes('rota') || t.includes('router') || t.includes('link')) {
        response = "As rotas da aplicação estão configuradas no arquivo `src/App.jsx` utilizando `react-router-dom` v6. Rotas de alunos são protegidas pelo componente `<ProtectedRoute>` que valida o login via `useAuthContext`. O Navbar só é visível para usuários autenticados.";
      } else if (t.includes('tema') || t.includes('dark') || t.includes('escuro') || t.includes('estilo')) {
        response = "O controle de tema escuro é gerenciado globalmente pelo `ThemeContext.js` em `src/hooks/ThemeContext.js`. Ele adiciona a classe `.dark` no elemento raiz `<html>` quando ativo. Os estilos de fallback do body estão configurados em `src/index.css` via diretiva `@layer base`.";
      } else if (t.includes('chat') || t.includes('mensag')) {
        response = "O chat de alunos com treinador utiliza o hook customizado `useChat.js` localizado em `src/hooks/useChat.js`. Ele escuta em tempo real a coleção `/chats/{chatId}/messages` do Firestore ordenada por `createdAt` e atualiza a interface de conversa de forma dinâmica.";
      }

      setFrontChat(prev => [...prev, { sender: 'agent', text: response }]);
    }, 800);
  };

  const handleBackSubmit = (e) => {
    e.preventDefault();
    if (!backInput.trim()) return;

    const text = backInput;
    setBackInput('');

    setBackChat(prev => [...prev, { sender: 'user', text }]);

    // Resposta simulada Back Agent baseada no código
    setTimeout(() => {
      let response = "Olá! Sou o Agente Back-End. O backend da aplicação utiliza o Firebase como serviço (BaaS). Gerenciamos a autenticação via Firebase Auth e armazenamos as informações estruturadas no Firestore Database. Também criamos scripts de seed administrativos usando o pacote `firebase-admin` na pasta `scripts`.";

      const t = text.toLowerCase();
      if (t.includes('colec') || t.includes('tabel') || t.includes('banco') || t.includes('firestore')) {
        response = "Temos as seguintes coleções principais no Firestore:\n\n" +
          "1. `users`: Contém perfis de alunos e treinadores (`uid`, `role`, `displayName`, `email`, `age`, `weight`, `height`, `coachId`).\n" +
          "2. `exercises`: Banco de dados de exercícios (`name`, `sets`, `reps`, `rest`, `execution`, `machineImage`, `videoUrl`, `muscleGroup`).\n" +
          "3. `trainings`: Treinos montados pelo treinador (`name`, `difficulty`, `duration`, `exercises` como array de UIDs do Firestore).\n" +
          "4. `checkIns`: Histórico de execução de treinos dos alunos (`userId`, `trainingId`, `trainingName`, `date`, `duration`, `totalVolume`, `exercises` detalhados).";
      } else if (t.includes('regras') || t.includes('segur') || t.includes('security')) {
        response = "As Regras de Segurança (Firestore Security Rules) estão definidas no arquivo `firebase.json` e descritas no README.md. Permitem leituras e escritas nas coleções `exercises`, `trainings` e `checkIns` para qualquer usuário autenticado (`request.auth != null`).";
      } else if (t.includes('seed') || t.includes('import') || t.includes('json')) {
        response = "O seed do banco de dados pode ser feito de duas formas:\n\n" +
          "1. **Admin Panel (Front):** A função `handleImportJson` em `AdminPanel.jsx` permite carregar arquivos JSON do seu computador e inseri-los no banco usando o SDK de cliente.\n" +
          "2. **Script Node (Back):** O script `scripts/seed.cjs` usa `firebase-admin` para limpar coleções e subir uma carga padrão de testes. Rode `make seed` na raiz.";
      }

      setBackChat(prev => [...prev, { sender: 'agent', text: response }]);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8 pb-24 md:pb-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        
        {/* Cabeçalho Cockpit */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2 tracking-tight">
              <Bot className="w-8 h-8 text-blue-500 animate-pulse" /> Centro de Decisões e Agentes IA
            </h1>
            <p className="text-sm text-gray-400 mt-1">Converse com agentes de desenvolvimento ou convoque o debate do conselho.</p>
          </div>
          
          {/* Tabs */}
          <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700 w-full md:w-auto">
            <button 
              onClick={() => setActiveTab('council')} 
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'council' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Conselho de Decisões
            </button>
            <button 
              onClick={() => setActiveTab('front')} 
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'front' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Agente Front-End
            </button>
            <button 
              onClick={() => setActiveTab('back')} 
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'back' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Agente Back-End
            </button>
          </div>
        </div>

        {/* MODO 1: CONSELHO DE DECISÕES */}
        {activeTab === 'council' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Sidebar: Membros */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-gray-800/50 border border-gray-800 p-5 rounded-2xl">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">Membros do Conselho</h3>
                <div className="space-y-4">
                  {councilMembers.map((m) => (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${m.avatarBg}`}>
                        {m.avatar}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-200">{m.name}</h4>
                        <p className={`text-[10px] uppercase font-bold tracking-wide ${m.color}`}>{m.role}</p>
                        <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{m.bio}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Area: Painel de Debate */}
            <div className="lg:col-span-3 flex flex-col h-[600px] bg-gray-950/60 rounded-3xl border border-gray-800 overflow-hidden shadow-2xl backdrop-blur-md">
              
              {/* Header do Chat */}
              <div className="bg-gray-900/80 px-6 py-4 border-b border-gray-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
                <span className="text-xs font-bold text-gray-300">Debate do Conselho de Arquitetura</span>
              </div>

              {/* Corpo da Conversa */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-900/10">
                {debateHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4 border border-gray-700">
                      <MessageSquare className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="font-bold text-lg text-white">Pronto para debate</h3>
                    <p className="text-xs text-gray-400 max-w-sm mt-1">Insira uma proposta ou dúvida tecnológica para que as 5 personalidades do conselho debatam e o Presidente emita um veredito.</p>
                    <div className="flex flex-wrap gap-2 mt-6 justify-center">
                      <button 
                        onClick={() => setQueryText("Como podemos implementar gamificação e pontos de XP no perfil do aluno?")}
                        className="text-[10px] bg-gray-800 hover:bg-gray-750 text-gray-300 px-3 py-1.5 rounded-full border border-gray-700 transition-colors"
                      >
                        XP & Gamificação
                      </button>
                      <button 
                        onClick={() => setQueryText("Substituir emojis por ícones Lucide React é uma boa escolha visual?")}
                        className="text-[10px] bg-gray-800 hover:bg-gray-750 text-gray-300 px-3 py-1.5 rounded-full border border-gray-700 transition-colors"
                      >
                        Visual & Emojis
                      </button>
                      <button 
                        onClick={() => setQueryText("Como estruturar o script de seed para cadastrar dados fictícios no Firebase?")}
                        className="text-[10px] bg-gray-800 hover:bg-gray-750 text-gray-300 px-3 py-1.5 rounded-full border border-gray-700 transition-colors"
                      >
                        Firebase & Seeds
                      </button>
                    </div>
                  </div>
                ) : (
                  debateHistory.map((msg, i) => {
                    if (msg.type === 'user') {
                      return (
                        <div key={i} className="flex justify-end animate-fade-in">
                          <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm shadow-md">
                            <p className="font-bold text-[10px] text-blue-200 uppercase tracking-wider mb-1">Minha Proposta</p>
                            <p>{msg.text}</p>
                            <p className="text-[9px] text-right text-blue-200 mt-1 opacity-70">{msg.timestamp}</p>
                          </div>
                        </div>
                      );
                    }
                    
                    const isPres = msg.type === 'president';
                    return (
                      <div key={i} className={`flex justify-start animate-fade-in ${isPres ? 'border border-purple-500/20 bg-purple-950/10 rounded-2xl p-2' : ''}`}>
                        <div className="flex gap-3 items-start max-w-[90%]">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${msg.avatarBg}`}>
                            {msg.avatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{msg.agentName}</span>
                              <span className={`text-[9px] uppercase tracking-wider ${msg.color}`}>{msg.role}</span>
                            </div>
                            <div className={`text-sm mt-1 leading-relaxed ${isPres ? 'text-gray-100' : 'text-gray-300'}`}>
                              {isPres ? (
                                <div className="space-y-2">
                                  <p className="font-bold text-purple-400">📜 Veredito Oficial:</p>
                                  <p className="italic bg-gray-900/60 p-3 rounded-xl border border-gray-800">{msg.text}</p>
                                </div>
                              ) : (
                                <p>{msg.text}</p>
                              )}
                            </div>
                            <span className="text-[9px] text-gray-500 block mt-1">{msg.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Loading typing state */}
                {currentTypingAgent && (
                  <div className="flex gap-3 items-center text-gray-500 text-xs italic animate-pulse">
                    <Bot className="w-5 h-5 animate-spin text-blue-500" />
                    <span>{currentTypingAgent} está digitando as ponderações...</span>
                  </div>
                )}
                <div ref={debateEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-gray-900 border-t border-gray-800">
                <form onSubmit={handleCouncilSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    disabled={isDebating}
                    placeholder={isDebating ? "Aguarde o debate concluir..." : "Envie sua dúvida/proposta de arquitetura..."}
                    className="flex-1 bg-gray-950 text-white px-4 py-3 rounded-xl text-sm outline-none border border-gray-800 focus:border-blue-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!queryText.trim() || isDebating}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 shadow-lg shadow-blue-900/25"
                  >
                    <Send className="w-4 h-4" /> Enviar
                  </button>
                </form>
              </div>

            </div>

          </div>
        )}

        {/* MODO 2: AGENTE FRONT-END */}
        {activeTab === 'front' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Context */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-gray-800/50 border border-gray-800 p-5 rounded-2xl">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider mb-2 border-b border-gray-800 pb-2 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-blue-400" /> Agente Front
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  Especializado no código do cliente e interface do AcademyUp.
                </p>
                <div className="space-y-2 text-xs">
                  <p className="font-bold text-gray-300">Documentação Indexada:</p>
                  <ul className="list-disc pl-4 space-y-1 text-gray-400">
                    <li>React 19 & Router v6</li>
                    <li>Tailwind CSS v3</li>
                    <li>ThemeContext (Dark Mode)</li>
                    <li>Dashboard e Recharts</li>
                    <li>UseChat Hook & Widgets</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Chat Area */}
            <div className="lg:col-span-3 flex flex-col h-[550px] bg-gray-950/60 rounded-3xl border border-gray-800 overflow-hidden shadow-2xl">
              <div className="bg-gray-900/80 px-6 py-4 border-b border-gray-800 flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
                <span className="text-xs font-bold text-gray-300">Front-End Developer Copilot</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {frontChat.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <Bot className="w-12 h-12 text-blue-400 mb-2" />
                    <h3 className="font-bold text-white">Assistente Front-End</h3>
                    <p className="text-xs text-gray-400 max-w-sm">Tire dúvidas sobre roteamento, Tailwind, estados de formulário ou UI de treinos.</p>
                  </div>
                ) : (
                  frontChat.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-gray-900 border-t border-gray-800">
                <form onSubmit={handleFrontSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={frontInput}
                    onChange={(e) => setFrontInput(e.target.value)}
                    placeholder="Pergunte algo sobre o front do site (ex: dark mode)..."
                    className="flex-1 bg-gray-950 text-white px-4 py-3 rounded-xl text-sm outline-none border border-gray-800 focus:border-blue-500"
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* MODO 3: AGENTE BACK-END */}
        {activeTab === 'back' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Context */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-gray-800/50 border border-gray-800 p-5 rounded-2xl">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider mb-2 border-b border-gray-800 pb-2 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-green-400" /> Agente Back
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  Especializado no banco de dados Firestore, regras de segurança e seeds.
                </p>
                <div className="space-y-2 text-xs">
                  <p className="font-bold text-gray-300">Documentação Indexada:</p>
                  <ul className="list-disc pl-4 space-y-1 text-gray-400">
                    <li>Coleções do Firestore</li>
                    <li>Security Rules no firebase.json</li>
                    <li>Firebase Admin SDK</li>
                    <li>Script seed.cjs</li>
                    <li>Makefile de banco</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Chat Area */}
            <div className="lg:col-span-3 flex flex-col h-[550px] bg-gray-950/60 rounded-3xl border border-gray-800 overflow-hidden shadow-2xl">
              <div className="bg-gray-900/80 px-6 py-4 border-b border-gray-800 flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                <span className="text-xs font-bold text-gray-300">Back-End Firebase Copilot</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {backChat.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <Bot className="w-12 h-12 text-green-400 mb-2" />
                    <h3 className="font-bold text-white">Assistente Back-End</h3>
                    <p className="text-xs text-gray-400 max-w-sm">Tire dúvidas sobre as coleções do banco Firestore, autenticação ou scripts de dados.</p>
                  </div>
                ) : (
                  backChat.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-gray-900 border-t border-gray-800">
                <form onSubmit={handleBackSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={backInput}
                    onChange={(e) => setBackInput(e.target.value)}
                    placeholder="Pergunte algo sobre o banco Firestore (ex: coleções)..."
                    className="flex-1 bg-gray-950 text-white px-4 py-3 rounded-xl text-sm outline-none border border-gray-800 focus:border-blue-500"
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
