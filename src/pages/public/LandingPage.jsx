import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Dumbbell, Flame, CheckCircle, Shield, Award, Users, Target, Zap, Heart, TrendingUp } from 'lucide-react';

// --- LOGO OFICIAL DA MARCA (A + U + Halter + Seta) ---
const AcademyUpLogo = ({ className = "w-10 h-10" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* O "A" (Academy) */}
      <path 
        d="M 22 80 L 46 22 C 48 17, 52 17, 54 22 L 78 80" 
        stroke="currentColor" 
        strokeWidth="9" 
        strokeLinecap="round" 
        fill="none" 
      />
      {/* Barra do halter (travessão do A) */}
      <line 
        x1="31" 
        y1="58" 
        x2="69" 
        y2="58" 
        stroke="currentColor" 
        strokeWidth="9" 
        strokeLinecap="round" 
      />
      {/* Anilhas do halter nas pontas */}
      <rect x="26" y="49" width="6" height="18" rx="2" fill="#FFC107" />
      <rect x="68" y="49" width="6" height="18" rx="2" fill="#FFC107" />
      
      {/* O "U" (Up / Evolução) que envolve a perna direita */}
      <path 
        d="M 50 56 C 50 82, 76 82, 76 56 L 76 34" 
        stroke="#FFC107" 
        strokeWidth="9" 
        strokeLinecap="round" 
        fill="none" 
      />
      
      {/* Seta para cima no topo do U */}
      <path 
        d="M 67 42 L 76 32 L 85 42" 
        stroke="#FFB300" 
        strokeWidth="9" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none" 
      />
    </svg>
  );
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0D1117] text-white selection:bg-[#FFC107] selection:text-black transition-colors duration-300 font-sans">
      
      {/* Top Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#FFC107]/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-10 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Navbar */}
      <nav className="relative flex justify-between items-center p-6 max-w-7xl mx-auto z-10">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center border border-[#FFC107]/20 group-hover:border-[#FFC107]/60 group-hover:scale-105 transition-all p-1">
            <AcademyUpLogo className="w-full h-full text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black text-white tracking-tighter leading-none">
              ACADEMY<span className="text-[#FFC107]">UP</span>
            </span>
            <span className="text-[9px] text-gray-500 font-bold tracking-[0.2em] mt-0.5">TREINE • EVOLUA • SUPERE</span>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <button 
            onClick={() => navigate('/login')} 
            className="text-gray-300 font-bold hover:text-[#FFC107] transition-colors text-sm px-4 py-2"
          >
            Entrar
          </button>
          <button 
            onClick={() => navigate('/register')} 
            className="bg-[#FFC107] hover:bg-[#FFB300] text-black px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-[#FFC107]/10 hover:shadow-[#FFC107]/20 transition-all hover:-translate-y-0.5 text-sm"
          >
            Começar Grátis
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative max-w-5xl mx-auto px-6 pt-20 pb-16 text-center z-10">
        <div className="inline-flex items-center gap-2 bg-[#1F2937] border border-gray-800 text-[#FFC107] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-8">
          <Zap className="w-3.5 h-3.5 text-[#FFC107] fill-current animate-pulse" />
          Plataforma de Alta Performance para Consultorias
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-[1.1] tracking-tight">
          Escale seus treinos <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFC107] to-[#FFB300]">
            com máxima disciplina.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
          Abandone as planilhas estáticas. Tenha seu próprio aplicativo de treino inteligente com cronômetro integrado, análise de evolução, chat com treinador e controle total de metas.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto sm:max-w-none">
          <button 
            onClick={() => navigate('/register')}
            className="bg-[#FFC107] hover:bg-[#FFB300] text-black text-lg px-8 py-4.5 rounded-2xl font-black shadow-xl shadow-[#FFC107]/20 hover:shadow-[#FFC107]/30 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
          >
            <Flame className="w-5 h-5 fill-current" /> Criar Minha Conta
          </button>
          <button 
            onClick={() => navigate('/login')}
            className="bg-[#1F2937] hover:bg-gray-800 text-gray-200 border border-gray-800 text-lg px-8 py-4.5 rounded-2xl font-bold transition-all hover:border-[#FFC107]/30"
          >
            Acessar Meu Painel
          </button>
        </div>
      </header>

      {/* Atributos da Marca (Strip Horizontal) */}
      <section className="relative border-y border-gray-900 bg-[#1F2937]/30 py-8 z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center md:justify-between items-center gap-6 text-center">
          <AttributeBadge icon={<Target className="w-4 h-4" />} text="Focada em Resultados" />
          <AttributeBadge icon={<Zap className="w-4 h-4" />} text="Energia e Motivação" />
          <AttributeBadge icon={<Shield className="w-4 h-4" />} text="Confiança e Segurança" />
          <AttributeBadge icon={<Award className="w-4 h-4" />} text="Alta Performance" />
          <AttributeBadge icon={<Heart className="w-4 h-4" />} text="Saúde e Bem-Estar" />
          <AttributeBadge icon={<Smartphone className="w-4 h-4" />} text="Acessível e Moderna" />
        </div>
      </section>

      {/* Pilares da Marca */}
      <section className="max-w-6xl mx-auto px-6 py-24 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-xs font-black tracking-[0.2em] text-[#FFC107] uppercase mb-3">Nossos Fundamentos</h2>
          <p className="text-3xl md:text-4xl font-black text-white">Os Pilares da Marca AcademyUp</p>
          <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm">Desenvolvemos nossa metodologia em torno de quatro valores inabaláveis para garantir a sua melhor versão.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <PillarCard 
            icon={<Dumbbell className="w-6 h-6 text-black" />} 
            title="Treinos Inteligentes" 
            desc="Programação de treinos efetiva e totalmente personalizada de acordo com seu biotipo, nível e limitações."
          />
          <PillarCard 
            icon={<CheckCircle className="w-6 h-6 text-black" />} 
            title="Disciplina & Foco" 
            desc="Constância e construção de mentalidade forte para transformar seus hábitos diários e atingir metas consistentes."
          />
          <PillarCard 
            icon={<TrendingUp className="w-6 h-6 text-black" />} 
            title="Evolução Real" 
            desc="Acompanhe seu progresso e superação de limites com gráficos de cargas, histórico detalhado e fotos de evolução."
          />
          <PillarCard 
            icon={<Users className="w-6 h-6 text-black" />} 
            title="Comunidade & Apoio" 
            desc="Juntos somos muito mais fortes. Suporte direto e motivação constante que inspira no chat com seu treinador."
          />
        </div>
      </section>

      {/* Seção Como Funciona */}
      <section className="bg-[#1F2937]/20 border-t border-gray-900 py-24 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard 
              num="01"
              title="Crie sua Ficha"
              desc="Acesse a biblioteca de exercícios com GIFs interativos para montar e ordenar seu roteiro de treinos."
            />
            <StepCard 
              num="02"
              title="Treine no Foco"
              desc="Inicie a sessão com nosso cronômetro de descanso inteligente e insira suas cargas em tempo real."
            />
            <StepCard 
              num="03"
              title="Acompanhe"
              desc="Visualize suas métricas financeiras, feedbacks de consultoria e relatórios de recordes pessoais (PRs)."
            />
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative text-center py-24 max-w-4xl mx-auto px-6 z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#FFC107]/5 rounded-full blur-[80px] pointer-events-none"></div>
        <h2 className="text-4xl md:text-5xl font-black mb-6">Pronto para o próximo nível?</h2>
        <p className="text-gray-400 mb-10 text-lg max-w-xl mx-auto">Cadastre-se hoje mesmo e comece a treinar com disciplina e inteligência.</p>
        <button 
          onClick={() => navigate('/register')}
          className="bg-[#FFC107] hover:bg-[#FFB300] text-black text-lg font-black px-10 py-5 rounded-2xl shadow-xl shadow-[#FFC107]/10 hover:shadow-[#FFC107]/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          Iniciar Agora Gratuitamente
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-12 text-center text-gray-500 text-xs relative z-10">
        <div className="flex justify-center items-center gap-2 mb-4">
          <div className="w-6 h-6 text-gray-400">
            <AcademyUpLogo className="w-full h-full text-gray-500" />
          </div>
          <span className="font-black text-gray-400">ACADEMYUP</span>
        </div>
        <p className="mb-2">© 2026 AcademyUp. Todos os direitos reservados.</p>
        <p className="text-gray-600">TREINE. EVOLUA. SUPERE.</p>
      </footer>
    </div>
  );
}

const AttributeBadge = ({ icon, text }) => (
  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors">
    <span className="text-[#FFC107]">{icon}</span>
    <span>{text}</span>
  </div>
);

const PillarCard = ({ icon, title, desc }) => (
  <div className="bg-[#1F2937]/40 border border-gray-800/80 p-8 rounded-3xl hover:border-[#FFC107]/30 transition-all duration-300 group hover:-translate-y-0.5">
    <div className="w-12 h-12 bg-[#FFC107] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-[#FFC107]/10 group-hover:scale-105 transition-transform">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
  </div>
);

const StepCard = ({ num, title, desc }) => (
  <div className="relative p-6">
    <div className="text-6xl font-black text-gray-800/40 font-mono mb-4">{num}</div>
    <h4 className="text-lg font-bold text-white mb-2">{title}</h4>
    <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
  </div>
);