import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useChat } from '../../hooks/useChat';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, MessageSquare, Send, Zap } from 'lucide-react';

export default function CoachChatPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Hook de Chat
  const { chats, messages, activeChat, setActiveChat, sendMessage, openChatWithUser, loading } = useChat(user);
  
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // Filtro da sidebar
  const messagesEndRef = useRef(null);

  // 1. Auto-scroll para o fim quando chega mensagem nova
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 2. Integração com Dashboard: Se clicar em "Chat" no card do aluno, abre direto aqui
  useEffect(() => {
      if (location.state?.targetUser) {
          openChatWithUser(location.state.targetUser);
      }
  }, [location.state]);

  const handleSend = (e) => {
      e.preventDefault();
      sendMessage(inputText);
      setInputText('');
  };

  // 3. Formatação segura de data (Suporta Timestamp do Firebase e Date do JS)
  const formatTime = (timestamp) => {
      if (!timestamp) return '';
      if (timestamp.seconds) {
          return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 4. Lógica de Filtro na Sidebar
  const filteredChats = chats.filter(chat => {
      const otherId = chat.participants.find(id => id !== user.uid);
      const studentName = chat.participantData?.[otherId]?.name || 'Aluno';
      return studentName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // 5. Helper para pegar dados do aluno no chat atual
  const getStudentData = (chat) => {
      if (!chat) return { name: 'Aluno', photo: null };
      const otherId = chat.participants.find(id => id !== user.uid);
      return chat.participantData?.[otherId] || { name: 'Aluno', photo: null };
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500"></div></div>;

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden transition-colors">
      
      {/* --- SIDEBAR (LISTA DE ALUNOS) --- */}
      {/* Esconde no mobile se tiver chat aberto */}
      <div className={`w-full md:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Header Sidebar */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-gray-800 dark:text-white">Mensagens</h2>
                <button 
                    onClick={() => navigate('/coach/dashboard')} 
                    className="text-xs font-bold text-gray-500 hover:text-blue-500 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                    <ArrowLeft className="w-3 h-3" /> Voltar
                </button>
            </div>
            {/* Input de Busca */}
            <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                    type="text" 
                    placeholder="Buscar aluno..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-700 pl-9 pr-4 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all border border-transparent focus:border-blue-500"
                />
            </div>
        </div>
        
        {/* Lista de Chats */}
        <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center justify-center h-full">
                    <MessageSquare className="w-8 h-8 text-gray-400 opacity-50 mb-2" />
                    <p>Nenhuma conversa encontrada.</p>
                </div>
            ) : (
                filteredChats.map(chat => {
                    const student = getStudentData(chat);
                    const isActive = activeChat?.id === chat.id;
                    
                    return (
                        <div 
                            key={chat.id}
                            onClick={() => setActiveChat(chat)}
                            className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700/50 relative ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                            {/* Indicador Ativo */}
                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>}

                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-white font-bold shrink-0 shadow-sm overflow-hidden">
                                {student.photo ? (
                                    <img src={student.photo} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <span className="text-gray-500 dark:text-gray-400 text-lg">{student.name[0]?.toUpperCase()}</span>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className={`text-sm truncate ${isActive ? 'font-black text-blue-600 dark:text-blue-400' : 'font-bold text-gray-800 dark:text-white'}`}>
                                        {student.name}
                                    </h3>
                                    <span className="text-[10px] text-gray-400 font-mono">{formatTime(chat.updatedAt)}</span>
                                </div>
                                <p className={`text-xs truncate ${isActive ? 'text-blue-500/80' : 'text-gray-500 dark:text-gray-400 font-medium'}`}>
                                    {chat.lastMessage || <span className="italic opacity-50">Nova conversa</span>}
                                </p>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </div>

      {/* --- ÁREA DO CHAT PRINCIPAL --- */}
      {/* Esconde no mobile se não tiver chat aberto */}
      <div className={`flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {activeChat ? (
            <>
                {/* Header Chat */}
                <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4 shadow-sm z-10">
                    <button onClick={() => setActiveChat(null)} className="md:hidden text-gray-500 hover:bg-gray-150 p-2 rounded-full transition-colors flex items-center justify-center">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    
                    {(() => {
                        const student = getStudentData(activeChat);
                        return (
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-lg overflow-hidden font-bold text-gray-500 border border-gray-100 dark:border-gray-600">
                                    {student.photo ? <img src={student.photo} className="w-full h-full object-cover" alt=""/> : student.name[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-white">{student.name}</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-2 w-2 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        <p className="text-xs text-gray-500 font-medium">Online agora</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Lista de Mensagens */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                            <MessageSquare className="w-12 h-12 text-gray-400 opacity-50 mb-4" />
                            <p className="text-sm">Inicie o atendimento com este aluno.</p>
                        </div>
                    )}
                    
                    {messages.map((msg) => {
                        const isMe = msg.senderId === user.uid;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] p-3 rounded-2xl text-sm shadow-sm relative group ${
                                    isMe 
                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-200 dark:border-gray-700'
                                }`}>
                                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                    <p className={`text-[9px] mt-1 text-right opacity-70 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                                        {formatTime(msg.createdAt)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Área de Input */}
                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <form onSubmit={handleSend} className="flex gap-3 max-w-4xl mx-auto items-center">
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Digite sua mensagem..."
                            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white px-5 py-3 rounded-full focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner border border-transparent focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500"
                        />
                        <button 
                            type="submit" 
                            disabled={!inputText.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        >
                            <Send className="w-5 h-5 text-white" />
                        </button>
                    </form>
                </div>
            </>
        ) : (
            // Estado Vazio (Nenhum chat selecionado)
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 dark:text-gray-600 bg-gray-50 dark:bg-gray-900">
                <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <Zap className="w-12 h-12 text-gray-400 opacity-30" />
                </div>
                <h3 className="text-xl font-black text-gray-400 dark:text-gray-500">Central de Alunos</h3>
                <p className="text-sm mt-2 text-gray-400 max-w-xs text-center">Selecione uma conversa na lista lateral para iniciar o atendimento.</p>
            </div>
        )}
      </div>
    </div>
  );
}