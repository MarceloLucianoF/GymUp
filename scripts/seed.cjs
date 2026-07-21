// scripts/seed.cjs
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const path = require("path");
const fs = require("fs");

const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ ERRO: Arquivo serviceAccountKey.json não encontrado!");
  console.error("Por favor, baixe as credenciais do Admin SDK no console do Firebase e salve como: workout-app/serviceAccountKey.json");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();
const auth = getAuth();
const now = new Date().toISOString();

// ==========================================
// 🏋️‍♂️ EXERCÍCIOS BASE (Novo Split do Usuário)
// ==========================================
const exercisesData = [
  // Treino A – Peitoral + Dorsal + CORE
  {
    id: "ex_supino_inc_halteres",
    name: "Supino Inclinado com Halteres",
    sets: 3,
    reps: "10",
    rest: 90,
    description: "Trabalha a porção superior do peitoral e ombros de forma equilibrada.",
    execution: "Sente-se no banco com os halteres apoiados nas coxas. Deite-se empurrando os halteres para a posição inicial (braços esticados). Desça os pesos controladamente até a linha do peito, mantendo os cotovelos levemente apontados para baixo (não totalmente abertos). Empurre de volta para cima.",
    machineImage: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "peito",
    difficulty: "intermediário"
  },
  {
    id: "ex_crucifixo_inv_inclinado",
    name: "Crucifixo Inverso no Banco Inclinado",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Excelente isolamento para deltoides posteriores e meio das costas.",
    execution: "Deite-se de bruços no banco inclinado, segurando os halteres com os braços pendurados. Mantendo um leve ângulo nos cotovelos, levante os braços para os lados, apertando as costas (escápulas) no topo do movimento. Desça devagar.",
    machineImage: "https://images.unsplash.com/photo-1605296867304-46d5465a25f1?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "costas",
    difficulty: "intermediário"
  },
  {
    id: "ex_supino_reto_halteres",
    name: "Supino Reto com Halteres",
    sets: 3,
    reps: "10",
    rest: 90,
    description: "Construção de peitoral com grande amplitude e estabilização de ombro.",
    execution: "Deite-se no banco reto com os halteres na altura do peito. Empurre os pesos para cima até estender os braços e desça controladamente. Totalmente seguro para fazer sozinho, basta soltar os pesos no chão caso não consiga subir.",
    machineImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "peito",
    difficulty: "intermediário"
  },
  {
    id: "ex_remada_curvada_neutra",
    name: "Remada Curvada com Halteres (Pegada Neutra)",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Foco no desenvolvimento de espessura e ativação de grande dorsal.",
    execution: "Em pé, com os pés na largura dos ombros, incline o tronco para frente mantendo as costas retas. Com as palmas das mãos viradas uma para a outra (pegada neutra), puxe os halteres em direção à linha do umbigo, apertando as costas. Estique os braços na descida.",
    machineImage: "https://images.unsplash.com/photo-1605296867304-46d5465a25f1?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "costas",
    difficulty: "intermediário"
  },
  {
    id: "ex_barra_fixa_pe",
    name: "Barra Fixa (Em pé)",
    sets: 3,
    reps: "10",
    rest: 95,
    description: "Clássico peso do corpo para largura e força das dorsais.",
    execution: "Segure a barra com uma pegada um pouco mais larga que os ombros. Puxe o corpo para cima até o queixo passar a linha da barra, concentrando a força nas costas. Desça controlando o peso do próprio corpo.",
    machineImage: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "costas",
    difficulty: "avançado"
  },
  {
    id: "ex_extensao_lombar_yw",
    name: "Extensão Lombar Y + W",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Fortalecimento do eretor da espinha e estabilidade postural.",
    execution: "Deite-se de bruços no colchonete. Levante o tronco e os braços formando um 'Y'. Retorne e, na próxima repetição, puxe os cotovelos para trás formando um 'W'. Contraia bem a região lombar e repita.",
    machineImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "core",
    difficulty: "iniciante"
  },
  {
    id: "ex_abs_canivete_alt",
    name: "Abdominal Canivete Alternado",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Fortalecimento global da parede abdominal.",
    execution: "Deite-se de costas com braços e pernas estendidos. Suba o tronco e uma perna simultaneamente, tentando tocar o pé com a mão oposta. Desça e alterne o lado.",
    machineImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "core",
    difficulty: "iniciante"
  },

  // Treino B – Pernas + Ombros
  {
    id: "ex_desenv_barra_reta",
    name: "Desenvolvimento Barra Reta",
    sets: 3,
    reps: "10",
    rest: 90,
    description: "Trabalha deltoides (principalmente anterior) e tríceps.",
    execution: "Em pé ou sentado (em banco com encosto), segure a barra na altura dos ombros. Empurre o peso para cima da cabeça até estender os braços. Desça controladamente até a altura do queixo/clavícula.",
    machineImage: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "ombros",
    difficulty: "intermediário"
  },
  {
    id: "ex_eleveacao_lat_sentado",
    name: "Elevação Lateral Sentado com Halteres",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Foco no deltoide lateral para ombros mais largos.",
    execution: "Sente-se na ponta do banco com o peito estufado e um halter em cada mão. Eleve os braços lateralmente até a altura dos ombros, mantendo uma leve flexão nos cotovelos. Desça devagar.",
    machineImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "ombros",
    difficulty: "iniciante"
  },
  {
    id: "ex_agachamento_halteres",
    name: "Agachamento com Halteres",
    sets: 3,
    reps: "10",
    rest: 90,
    description: "Agachamento focado em quadríceps e glúteos.",
    execution: "Em pé, segure um halter em cada mão nas laterais do corpo. Flexione os joelhos e desça o quadril como se fosse sentar em uma cadeira, mantendo a coluna reta e o peito para cima. Empurre o chão com os calcanhares para subir.",
    machineImage: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "pernas",
    difficulty: "iniciante"
  },
  {
    id: "ex_flexao_nordica_inv",
    name: "Flexão Nórdica Inversa",
    sets: 3,
    reps: "10",
    rest: 90,
    description: "Fortalecimento excêntrico e mobilidade de quadríceps.",
    execution: "Ajoelhe-se no colchonete com os tornozelos fixos. Mantenha o corpo em linha reta dos joelhos até a cabeça. Incline o corpo para trás de forma controlada, usando a força das coxas para frear a descida e depois retorne à posição inicial.",
    machineImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "pernas",
    difficulty: "intermediário"
  },
  {
    id: "ex_afundo_halteres",
    name: "Afundo Livre com Halteres",
    sets: 3,
    reps: "10",
    rest: 90,
    description: "Trabalho unilateral de quadríceps e glúteos.",
    execution: "Dê um passo largo para frente. Segurando os halteres ao lado do corpo, desça o quadril flexionando ambos os joelhos até formarem ângulos de 90 graus (o joelho de trás não deve tocar o chão). Suba e repita, depois troque a perna.",
    machineImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "pernas",
    difficulty: "intermediário"
  },
  {
    id: "ex_panturrilha_pe_halteres",
    name: "Panturrilha em pé com Halteres",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Fortalecimento de tríceps sural.",
    execution: "Segure os halteres e apoie a ponta dos pés no degrau. Desça os calcanhares alongando a panturrilha e, em seguida, empurre o corpo para cima o máximo que conseguir, contraindo no topo.",
    machineImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "pernas",
    difficulty: "iniciante"
  },
  {
    id: "ex_mesa_flexora",
    name: "Mesa Flexora",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Isolamento mecânico de isquiotibiais.",
    execution: "Deite-se de bruços na máquina, posicionando o rolo logo acima dos tornozelos. Puxe o peso em direção aos glúteos dobrando os joelhos. Estenda as pernas controlando o peso na volta.",
    machineImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "pernas",
    difficulty: "iniciante"
  },

  // Treino C – Bíceps + Tríceps + CORE
  {
    id: "ex_rosca_scott_barraw",
    name: "Rosca Scott com Barra W",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Concentração mecânica para o pico do bíceps no Scott.",
    execution: "Sente-se no banco Scott apoiando os braços no suporte. Segure a Barra W na curva interna e levante o peso contraindo os bíceps em direção aos ombros. Desça até quase esticar os braços completamente.",
    machineImage: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "braços",
    difficulty: "intermediário"
  },
  {
    id: "ex_triceps_polia_barra",
    name: "Tríceps Barra Encostado na Polia",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Exercício clássico de empurrar na polia.",
    execution: "Fique de pé próximo à polia. Segure a barra e cole os cotovelos nas costelas. Empurre a barra para baixo usando a força dos tríceps até estender totalmente os braços. Volte até a altura do peito.",
    machineImage: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "braços",
    difficulty: "iniciante"
  },
  {
    id: "ex_rosca_direta_bancoinc",
    name: "Rosca Direta Banco Inclinado",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Foco na amplitude com bíceps em alongamento máximo.",
    execution: "Sente-se no banco inclinado e deixe os braços caírem retos nas laterais. Dobre os cotovelos e traga os halteres até a altura dos ombros. A posição do banco garante um alongamento máximo do bíceps no início do movimento.",
    machineImage: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "braços",
    difficulty: "intermediário"
  },
  {
    id: "ex_triceps_supinado_halteres",
    name: "Tríceps Supinado com Halteres",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Tríceps no banco com halteres e pegada fechada.",
    execution: "Deite-se no banco segurando os halteres com os braços esticados para o teto, mas com as mãos na mesma linha dos ombros (pegada fechada). Desça os halteres em direção ao seu peito mantendo os cotovelos bem rentes ao tronco. Empurre para cima.",
    machineImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "braços",
    difficulty: "intermediário"
  },
  {
    id: "ex_rosca_polia_corda",
    name: "Rosca Direta na Polia Baixa com Corda",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Trabalho de braquial e braquiorradial com pegada martelo na polia.",
    execution: "Em pé, de frente para a polia baixa, segure a corda com pegada neutra (dedões para cima). Puxe a corda em direção aos ombros, mantendo os cotovelos firmes nas laterais do corpo.",
    machineImage: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "braços",
    difficulty: "iniciante"
  },
  {
    id: "ex_abs_troca_bola_suica",
    name: "Abdominal trocando bola suíça",
    sets: 3,
    reps: "10",
    rest: 60,
    description: "Core e coordenação motora com bola suíça.",
    execution: "Deite-se de costas com a bola presa entre os pés. Faça um movimento de canivete, subindo braços e pernas, e pegue a bola com as mãos. Desça os braços (com a bola) e as pernas (vazias) até perto do chão. Suba novamente e devolva a bola para os pés. Cada troca de mãos para pés conta como 1 repetição.",
    machineImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&auto=format&fit=crop",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    muscleGroup: "core",
    difficulty: "intermediário"
  }
];

// ==========================================
// 📋 TREINOS BASE (Mapeados pelo novo split)
// ==========================================
const trainingsData = [
  {
    id: "A",
    name: "Treino A: Peitoral + Dorsal + CORE",
    day: "Segunda",
    duration: "45-60 min",
    difficulty: "Intermediário",
    exercises: [
      "ex_supino_inc_halteres",
      "ex_crucifixo_inv_inclinado",
      "ex_supino_reto_halteres",
      "ex_remada_curvada_neutra",
      "ex_barra_fixa_pe",
      "ex_extensao_lombar_yw",
      "ex_abs_canivete_alt"
    ]
  },
  {
    id: "B",
    name: "Treino B: Pernas + Ombros",
    day: "Quarta",
    duration: "50-60 min",
    difficulty: "Intermediário",
    exercises: [
      "ex_desenv_barra_reta",
      "ex_eleveacao_lat_sentado",
      "ex_agachamento_halteres",
      "ex_flexao_nordica_inv",
      "ex_afundo_halteres",
      "ex_panturrilha_pe_halteres",
      "ex_mesa_flexora"
    ]
  },
  {
    id: "C",
    name: "Treino C: Bíceps + Tríceps + CORE",
    day: "Sexta",
    duration: "45-55 min",
    difficulty: "Intermediário",
    exercises: [
      "ex_rosca_scott_barraw",
      "ex_triceps_polia_barra",
      "ex_rosca_direta_bancoinc",
      "ex_triceps_supinado_halteres",
      "ex_rosca_polia_corda",
      "ex_abs_troca_bola_suica"
    ]
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
      height: user.role === "user" ? 176 : null,
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
  let firstTrainingId = null;
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
    if (!firstTrainingId) {
      firstTrainingId = docRef.id;
    }
  }
  console.log(`✅ ${trainingsData.length} Fichas de treinos criadas e associadas!`);

  if (firstTrainingId) {
    console.log(`🔗 Associando Treino A (${firstTrainingId}) ao Aluno Determinado...`);
    await db.collection("users").doc("student_default_id").update({
      currentTrainingId: firstTrainingId
    });
  }

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
