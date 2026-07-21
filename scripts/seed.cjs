// scripts/seed.cjs
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ ERRO: Arquivo serviceAccountKey.json não encontrado!");
  console.error("Por favor, baixe as credenciais do Admin SDK no console do Firebase e salve como: workout-app/serviceAccountKey.json");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();
const now = new Date().toISOString();

// ==========================================
// 🏋️‍♂️ EXERCÍCIOS BASE (Copilado de exercises.js)
// ==========================================
const exercisesData = [
  // Treino A – Peito, ombro, tríceps
  {
    id: "ex1",
    name: "Supino Reto Máquina",
    sets: 4,
    reps: "10",
    rest: 90,
    description: "Exercício para peito, ombro e tríceps. Foco na força e hipertrofia do peitoral.",
    execution: "Sente-se na máquina com as costas bem apoiadas. Ajuste a altura do assento para que as alças fiquem na altura do meio do peito. Empurre as alças para frente até estender os braços, contraindo o peitoral. Retorne lentamente controlando o movimento.",
    machineImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "peito",
    difficulty: "iniciante"
  },
  {
    id: "ex2",
    name: "Supino Inclinado Halter",
    sets: 3,
    reps: "10",
    rest: 90,
    description: "Trabalha a porção superior do peitoral e ombros. Requer mais estabilização.",
    execution: "Deite-se em um banco inclinado (30-45 graus) com um halter em cada mão, palmas para frente. Desça os halteres lateralmente até a altura do peito, mantendo os cotovelos ligeiramente abaixo dos ombros. Empurre os halteres para cima, unindo-os levemente no topo, sem tocar.",
    machineImage: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "peito",
    difficulty: "intermediário"
  },
  {
    id: "ex3",
    name: "Peck Deck (Voador)",
    sets: 3,
    reps: "12",
    rest: 60,
    description: "Exercício isolador para o peitoral, foca na contração máxima.",
    execution: "Sente-se na máquina com as costas apoiadas. Ajuste os braços da máquina para que fiquem alinhados com o peito. Junte os braços à frente, contraindo o peitoral. Retorne controladamente, sentindo o alongamento.",
    machineImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "peito",
    difficulty: "iniciante"
  },
  {
    id: "ex4",
    name: "Desenvolvimento Halter",
    sets: 3,
    reps: "10",
    rest: 90,
    description: "Exercício composto para ombros, trabalha deltoides e tríceps.",
    execution: "Sente-se em um banco com encosto, segurando um halter em cada mão na altura dos ombros, palmas para frente. Empurre os halteres para cima até estender os braços, sem travar os cotovelos. Retorne lentamente à posição inicial.",
    machineImage: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "ombro",
    difficulty: "intermediário"
  },
  {
    id: "ex5",
    name: "Elevação Lateral",
    sets: 3,
    reps: "12",
    rest: 60,
    description: "Isola o deltoide lateral, responsável pela largura dos ombros.",
    execution: "Em pé, segure um halter leve em cada mão, braços estendidos ao lado do corpo. Eleve os halteres lateralmente até a altura dos ombros, com os cotovelos ligeiramente flexionados. Mantenha o controle na descida.",
    machineImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "ombro",
    difficulty: "iniciante"
  },
  {
    id: "ex6",
    name: "Tríceps Corda",
    sets: 3,
    reps: "12",
    rest: 60,
    description: "Trabalha as três cabeças do tríceps, com foco na porção lateral.",
    execution: "Em pé, de frente para a polia alta, segure a corda com as duas mãos. Mantenha os cotovelos próximos ao corpo e empurre a corda para baixo, estendendo os braços. Abra a corda no final do movimento para maior contração.",
    machineImage: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "triceps",
    difficulty: "iniciante"
  },
  {
    id: "ex7",
    name: "Tríceps Barra (Pushdown)",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Foca na masa muscular do tríceps, usando barra reta ou V.",
    execution: "Em pé, de frente para a polia alta, segure a barra com as mãos na largura dos ombros. Mantenha os cotovelos fixos e empurre a barra para baixo, estendendo os braços. Retorne controladamente.",
    machineImage: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "triceps",
    difficulty: "iniciante"
  },
  // Treino B – Costas, bíceps
  {
    id: "ex8",
    name: "Puxada Aberta (Lat Pulldown)",
    sets: 4,
    reps: "10",
    rest: 90,
    description: "Exercício fundamental para largura das costas, trabalha o grande dorsal.",
    execution: "Sente-se na máquina, ajuste o apoio de coxa. Segure a barra com pegada aberta, palmas para frente. Puxe a barra em direção ao peito, contraindo as costas. Retorne lentamente, sentindo o alongamento.",
    machineImage: "https://images.unsplash.com/photo-1605296867304-46d5465a25f1?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "costas",
    difficulty: "iniciante"
  },
  {
    id: "ex9",
    name: "Remada Máquina (Sentado)",
    sets: 3,
    reps: "10",
    rest: 90,
    description: "Trabalha a espessura das costas, focando nos músculos do meio das costas.",
    execution: "Sente-se na máquina, com os pés apoiados. Segure a alça (triângulo ou barra reta). Puxe a alça em direção ao abdômen, apertando as escápulas. Retorne controladamente, alongando as costas.",
    machineImage: "https://images.unsplash.com/photo-1605296867304-46d5465a25f1?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "costas",
    difficulty: "iniciante"
  },
  {
    id: "ex10",
    name: "Puxada Triângulo (Pegada Fechada)",
    sets: 3,
    reps: "12",
    rest: 60,
    description: "Foca na porção inferior e central do grande dorsal, dando espessura.",
    execution: "Sente-se na máquina de puxada, use a pegada fechada (triângulo). Puxe a barra em direção ao abdômen inferior, mantendo os cotovelos próximos ao corpo. Contraia as costas e retorne lentamente.",
    machineImage: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "costas",
    difficulty: "iniciante"
  },
  {
    id: "ex11",
    name: "Rosca Direta Barra",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Exercício clássico para bíceps, foca na massa muscular.",
    execution: "Em pé, segure uma barra (reta ou W) com as mãos na largura dos ombros, palmas para cima. Mantenha os cotovelos fixos ao lado do corpo e eleve a barra até a altura dos ombros, contraindo o bíceps. Desça controladamente.",
    machineImage: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "biceps",
    difficulty: "iniciante"
  },
  {
    id: "ex12",
    name: "Rosca Alternada Halter",
    sets: 3,
    reps: "12",
    rest: 60,
    description: "Trabalha o bíceps de forma unilateral, permitindo maior foco e amplitude.",
    execution: "Em pé, segure um halter em cada mão, palmas para dentro. Alterne a elevação dos halteres, girando a palma da mão para cima durante a subida. Mantenha o cotovelo fixo e controle a descida.",
    machineImage: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "biceps",
    difficulty: "iniciante"
  },
  {
    id: "ex13",
    name: "Rosca Concentrada",
    sets: 2,
    reps: "12",
    rest: 60,
    description: "Isola o bíceps, ideal para finalizar o treino e focar na contração.",
    execution: "Sente-se em um banco, incline o tronco para frente. Apoie o cotovelo do braço que trabalha na parte interna da coxa. Segure um halter e eleve-o em direção ao ombro, contraindo o bíceps. Desça lentamente.",
    machineImage: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "biceps",
    difficulty: "intermediário"
  },
  // Treino C – Perna
  {
    id: "ex14",
    name: "Agachamento Livre ou Hack",
    sets: 4,
    reps: "10",
    rest: 120,
    description: "Exercício composto fundamental para pernas e glúteos, grande gasto calórico.",
    execution: "No agachamento livre, posicione a barra nas costas. No Hack, apoie as costas e ombros. Desça controladamente até as coxas ficarem paralelas ao chão (ou mais fundo, se possível), mantendo a coluna reta. Empurre para cima usando a força das pernas e glúteos.",
    machineImage: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "pernas",
    difficulty: "avancado"
  },
  {
    id: "ex15",
    name: "Leg Press",
    sets: 4,
    reps: "12",
    rest: 90,
    description: "Trabalha quadríceps, glúteos e isquiotibiais com menos impacto na coluna.",
    execution: "Sente-se na máquina, apoie os pés na plataforma na largura dos ombros. Empurre a plataforma estendendo as pernas, sem travar os joelhos. Retorne controladamente, flexionando os joelhos até um ângulo de 90 graus.",
    machineImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "pernas",
    difficulty: "intermediário"
  },
  {
    id: "ex16",
    name: "Mesa Flexora",
    sets: 3,
    reps: "12",
    rest: 60,
    description: "Isola os isquiotibiais (posterior de coxa).",
    execution: "Deite-se de bruços na máquina, com os calcanhares sob o rolo. Flexione os joelhos, puxando o rolo em direção aos glúteos. Contraia os posteriores e retorne lentamente, sentindo o alongamento.",
    machineImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "pernas",
    difficulty: "iniciante"
  },
  {
    id: "ex17",
    name: "Cadeira Extensora",
    sets: 3,
    reps: "12",
    rest: 60,
    description: "Isola o quadríceps (anterior de coxa).",
    execution: "Sente-se na máquina, ajuste o rolo para que fique sobre os tornozelos. Estenda as pernas para cima, contraindo o quadríceps. Retorne lentamente, controlando o movimento.",
    machineImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "pernas",
    difficulty: "iniciante"
  },
  {
    id: "ex18",
    name: "Elevação Pélvica (Glúteo)",
    sets: 4,
    reps: "12",
    rest: 90,
    description: "Foca na ativação e hipertrofia dos glúteos.",
    execution: "Sente-se no chão com as costas apoiadas em um banco, joelhos flexionados e pés no chão. Coloque uma barra ou halter sobre o quadril. Eleve o quadril até formar uma linha reta dos ombros aos joelhos, contraindo os glúteos. Desça controladamente.",
    machineImage: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "core",
    difficulty: "intermediário"
  },
  {
    id: "ex19",
    name: "Panturrilha em Pé (Máquina)",
    sets: 4,
    reps: "15",
    rest: 60,
    description: "Trabalha os músculos da panturrilha, importante para força e estética.",
    execution: "Em pé na máquina, apoie a parte da frente dos pés na plataforma e os ombros nos apoios. Eleve os calcanhares o máximo possível, contraindo a panturrilha. Desça lentamente, alongando bem os músculos.",
    machineImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "pernas",
    difficulty: "iniciante"
  },
  // Treino D – Cardio + core
  {
    id: "ex20",
    name: "Esteira / Bike / Escada",
    sets: 1,
    reps: "0",
    rest: 0,
    description: "Cardio de baixa a moderada intensidade para queima de gordura e condicionamento.",
    execution: "Escolha sua máquina preferida (esteira, bicicleta ergométrica ou escada). Mantenha um ritmo constante onde você consiga conversar, mas sinta o esforço. Duração de 25 a 40 minutos.",
    machineImage: "https://images.unsplash.com/photo-1578762560072-46cf152c907f?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "core",
    difficulty: "iniciante"
  },
  {
    id: "ex21",
    name: "HIIT (Cardio de Alta Intensidade)",
    sets: 1,
    reps: "0",
    rest: 0,
    description: "Cardio de alta intensidade para queima de gordura e melhora da capacidade cardiovascular.",
    execution: "Alternar períodos curtos de esforço máximo (ex: 30s de sprint) com períodos de recuperação ativa (ex: 60s de caminhada). Repetir por 15-20 minutos. Pode ser feito em esteira, bike ou com exercícios corporais.",
    machineImage: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "core",
    difficulty: "avancado"
  },
  {
    id: "ex22",
    name: "Prancha Abdominal",
    sets: 3,
    reps: "30s",
    rest: 60,
    description: "Fortalece o core, abdômen e lombar. Melhora a postura e estabilidade.",
    execution: "Deite-se de bruços, apoie os antebraços e as pontas dos pés no chão. Mantenha o corpo reto, contraindo o abdômen e glúteos. Evite deixar o quadril cair ou subir demais. Mantenha a posição por 30-60 segundos.",
    machineImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "core",
    difficulty: "iniciante"
  },
  {
    id: "ex23",
    name: "Abdominal Infra",
    sets: 3,
    reps: "15",
    rest: 60,
    description: "Foca na porção inferior do abdômen.",
    execution: "Deite-se de costas, mãos sob o quadril ou ao lado do corpo. Eleve as pernas estendidas ou semi-flexionadas, contraindo o abdômen. Desça lentamente sem tocar os pés no chão. Pode ser feito em banco declinado para maior dificuldade.",
    machineImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "core",
    difficulty: "intermediário"
  },
  {
    id: "ex24",
    name: "Abdominal Oblíquo (Bicicleta)",
    sets: 3,
    reps: "15",
    rest: 60,
    description: "Trabalha os músculos oblíquos, responsáveis pela rotação do tronco.",
    execution: "Deite-se de costas, mãos atrás da cabeça, pernas elevadas e joelhos flexionados. Leve o cotovelo direito em direção ao joelho esquerdo, estendendo a perna direita. Alterne os lados, simulando um movimento de bicicleta.",
    machineImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "core",
    difficulty: "intermediário"
  }
];

// ==========================================
// 📋 TREINOS BASE (Mapeados por ID antigo)
// ==========================================
const trainingsData = [
  {
    id: "A",
    name: "Treino A – Peito, Ombro, Tríceps",
    day: "Segunda/Quinta",
    exercises: ["ex1", "ex2", "ex3", "ex4", "ex5", "ex6", "ex7"],
    duration: "60 min",
    difficulty: "Intermediário"
  },
  {
    id: "B",
    name: "Treino B – Costas, Bíceps",
    day: "Terça/Sexta",
    exercises: ["ex8", "ex9", "ex10", "ex11", "ex12", "ex13"],
    duration: "50 min",
    difficulty: "Intermediário"
  },
  {
    id: "C",
    name: "Treino C – PERNA",
    day: "Quarta",
    exercises: ["ex14", "ex15", "ex16", "ex17", "ex18", "ex19"],
    duration: "70 min",
    difficulty: "Avançado"
  },
  {
    id: "D",
    name: "Treino D – Cardio + Core",
    day: "Sábado/Domingo (Opcional)",
    exercises: ["ex20", "ex21", "ex22", "ex23", "ex24"],
    duration: "25-40 min",
    difficulty: "Iniciante"
  }
];

// ==========================================
// 👤 USUÁRIOS BASE (Treinador, Aluno, Admin)
// ==========================================
const usersData = [
  {
    uid: "coach_default_id",
    email: "coach@academyup.com",
    password: "123456",
    displayName: "Mister Coach",
    role: "coach"
  },
  {
    uid: "student_default_id",
    email: "student@academyup.com",
    password: "123456",
    displayName: "Aluno Determinado",
    role: "user",
    coachId: "coach_default_id"
  },
  {
    uid: "admin_default_id",
    email: "admin@academyup.com",
    password: "123456",
    displayName: "Super Admin",
    role: "admin"
  }
];

// ==========================================
// 🧹 FUNÇÕES DE LIMPEZA
// ==========================================
async function deleteCollection(collectionPath, batchSize = 20) {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.limit(batchSize).get();
  
  if (snapshot.size === 0) return;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recursivo se houver mais documentos
  return deleteCollection(collectionPath, batchSize);
}

// ==========================================
// 🚀 INICIALIZAÇÃO DO SEED
// ==========================================
async function getOrCreateAuthUser(user) {
  try {
    const userRecord = await auth.getUser(user.uid);
    console.log(`👤 Auth: Usuário ${user.email} já existe. Atualizando senha...`);
    await auth.updateUser(user.uid, {
      password: user.password,
      displayName: user.displayName,
    });
    return userRecord;
  } catch (error) {
    if (error.code === "auth/user-not-found" || error.code === "auth/invalid-uid") {
      const userRecord = await auth.createUser({
        uid: user.uid,
        email: user.email,
        password: user.password,
        displayName: user.displayName,
        emailVerified: true,
      });
      console.log(`✨ Auth: Criado novo usuário ${user.email}`);
      return userRecord;
    }
    throw error;
  }
}

async function runSeed() {
  console.log("🧹 Iniciando limpeza do banco de dados...");
  
  // Limpar coleções principais
  await deleteCollection("exercises");
  await deleteCollection("trainings");
  await deleteCollection("users");
  await deleteCollection("checkIns");
  await deleteCollection("measurements");
  await deleteCollection("chats");
  
  console.log("✅ Limpeza de coleções concluída!");

  // 1. Criar Contas de Usuário no Auth e Firestore
  console.log("👤 Criando contas de usuários...");
  for (const user of usersData) {
    await getOrCreateAuthUser(user);
    
    // Salvar perfil no Firestore
    const firestoreData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: now,
      age: 26,
      weight: user.role === "user" ? 78.5 : null,
      height: user.role === "user" ? 1.76 : null,
      photoURL: null,
    };
    
    if (user.coachId) {
      firestoreData.coachId = user.coachId;
    }
    
    await db.collection("users").doc(user.uid).set(firestoreData);
  }
  console.log("✅ Contas de usuários criadas!");

  // 2. Criar Biblioteca de Exercícios no Firestore
  console.log("🏋️‍♂️ Populando biblioteca de exercícios...");
  const exerciseIdMap = {}; // originalId -> firestoreId
  
  for (const ex of exercisesData) {
    const docRef = db.collection("exercises").doc();
    const payload = {
      ...ex,
      originalId: ex.id,
      createdAt: now,
      updatedAt: now
    };
    delete payload.id; // Remover ID local para evitar colisão
    
    await docRef.set(payload);
    exerciseIdMap[ex.id] = docRef.id;
  }
  console.log(`✅ ${exercisesData.length} Exercícios criados!`);

  // 3. Criar Fichas de Treino vinculando aos Exercícios
  console.log("📋 Montando treinos e vinculando exercícios...");
  for (const tr of trainingsData) {
    const docRef = db.collection("trainings").doc();
    
    // Converte os IDs locais (ex1, ex2) para os novos IDs gerados no Firestore
    const resolvedExercises = tr.exercises
      .map(oldId => exerciseIdMap[oldId])
      .filter(Boolean);
      
    const payload = {
      name: tr.name,
      day: tr.day,
      duration: tr.duration,
      difficulty: tr.difficulty,
      exercises: resolvedExercises,
      createdAt: now,
      updatedAt: now
    };
    
    await docRef.set(payload);
  }
  console.log(`✅ ${trainingsData.length} Fichas de treinos criadas e associadas!`);

  console.log("🎉 SEED FINALIZADO COM SUCESSO!");
  console.log("\nCredenciais para login local:");
  console.log("--------------------------------------");
  console.log("Treinador: coach@academyup.com / 123456");
  console.log("Aluno:     student@academyup.com / 123456");
  console.log("Admin:     admin@academyup.com / 123456");
  console.log("--------------------------------------\n");
}

runSeed().catch(err => {
  console.error("❌ Erro durante a execução do seed:", err);
});
