# 🏋️‍♂️ Workout Tracker App

> Uma aplicação web completa para gerenciamento e execução de treinos, desenvolvida com React e Firebase.

![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![Firebase](https://img.shields.io/badge/Firebase-V9-orange?style=for-the-badge&logo=firebase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológico](#-stack-tecnológico)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Instalação e Setup](#-instalação-e-setup)
- [Configuração do Firebase](#-configuração-do-firebase)
- [Guia de Uso](#-guia-de-uso)
- [Deploy](#-deploy)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Visão Geral

O **Workout Tracker** permite que usuários gerenciem sua rotina de exercícios, executem treinos com check-ins em tempo real e acompanhem seu histórico. O sistema inclui um painel administrativo robusto para gestão de conteúdo.

---

## ✨ Funcionalidades

### 👤 Para Usuários
- ✅ **Autenticação:** Login, cadastro e persistência de sessão.
- ✅ **Home:** Dashboard com acesso rápido a treinos e histórico.
- ✅ **Execução de Treino:** Interface interativa com cronômetro e checklist de exercícios.
- ✅ **Histórico:** Visualização detalhada de treinos realizados e progresso.

### 🛡️ Painel Administrativo
- ✅ **Gestão de Exercícios:** CRUD completo (Criar, Ler, Atualizar, Deletar).
- ✅ **Gestão de Treinos:** Montagem de treinos com seleção de exercícios.
- ✅ **Importação em Massa:** Importação de Exercícios e Treinos via arquivos JSON.

---

## 🛠 Stack Tecnológico

- **Frontend:** React 18, React Router, Context API
- **Estilização:** Tailwind CSS
- **Backend (BaaS):** Firebase (Authentication, Firestore Database)
- **Ferramentas:** npm, Git

---

## 📁 Estrutura do Projeto

```text
workout-app/
├── src/
│   ├── components/      # Componentes UI (Cards, Forms, Nav)
│   ├── pages/           # Páginas (Auth, User, Admin)
│   ├── hooks/           # Custom Hooks (useAuth, useAdmin, etc.)
│   ├── firebase/        # Configuração e inicialização
│   ├── data/            # Dados estáticos/mock
│   ├── styles/          # Estilos globais
│   └── App.jsx          # Componente Raiz
├── .env.local           # Variáveis de ambiente
└── package.json

---

🚀 Instalação e SetupPré-requisitosNode.js 14+Conta no Firebase1. Clonar o repositórioBashgit clone [https://github.com/seu-usuario/workout-tracker.git](https://github.com/seu-usuario/workout-tracker.git)
cd workout-tracker
2. Instalar dependênciasBashnpm install
3. Configurar Variáveis de AmbienteCrie um arquivo .env.local na raiz do projeto e preencha com suas credenciais do Firebase:Snippet de códigoREACT_APP_FIREBASE_API_KEY=sua_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=seu_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
REACT_APP_FIREBASE_APP_ID=seu_app_id
4. Rodar a aplicaçãoBashnpm start
Acesse em: http://localhost:3000🔥 Configuração do FirebasePara que o aplicativo funcione, configure seu projeto no Firebase Console:Authentication: Ative o provedor Email/Password.Firestore Database: Crie um banco de dados no modo de teste.Regras de Segurança (Firestore Rules):Copie e cole as regras abaixo na aba "Rules" do Firestore:JavaScriptrules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /exercises/{document=**} { allow read, write: if request.auth != null; }
    match /trainings/{document=**} { allow read, write: if request.auth != null; }
    match /checkIns/{document=**} { allow read, write: if request.auth != null; }
  }
}
Índices (Indexes):Para o histórico funcionar corretamente, crie um índice composto na coleção checkIns:Campos: userId (Ascending), timestamp (Descending).📖 Guia de UsoImportação de Dados (Admin)Para popular o banco rapidamente, acesse o Painel Admin e use a função de importação JSON.Exemplo JSON para Exercícios:JSON[
  {
    "id": 1,
    "name": "Supino Reto",
    "sets": 4,
    "reps": 10,
    "rest": 90,
    "muscleGroup": "peito",
    "difficulty": "iniciante"
    // ...outros campos
  }
]
Executando um TreinoVá até a aba Treinos.Selecione "Iniciar Treino".Marque os exercícios conforme realiza.Clique em "Finalizar" para salvar no histórico.🐛 TroubleshootingErroSolução ProvávelMissing permissionsVerifique as Regras de Segurança no Firestore.Query requires indexClique no link do erro no console para criar o índice automático ou crie manualmente conforme guia acima.Firebase not initializedVerifique se o arquivo .env.local está na raiz e com os dados corretos.🚀 DeployO projeto está configurado para deploy fácil no Firebase Hosting.Instale a CLI: npm install -g firebase-toolsLogin: firebase loginInicialize: firebase init (Selecione Hosting, pasta build, SPA Yes)Deploy:Bashnpm run build
make deploy
📄 LicençaEste projeto está sob a licença MIT. Sinta-se livre para usar e modificar.Última atualização: 07/02/2026