import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
      setEmail('');
    } catch (error) {
      console.error(error);
      let msg = "Erro ao enviar email.";
      if (error.code === 'auth/user-not-found') msg = "Email não cadastrado.";
      if (error.code === 'auth/invalid-email') msg = "Email inválido.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700 animate-fade-in-up">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-gray-800 dark:text-white">Recuperar Senha</h2>
          <p className="text-gray-500 text-sm mt-2">Digite seu email para receber o link.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Email</label>
            <input 
                type="email" 
                required 
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-700 p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                placeholder="seu@email.com"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-transform active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link to="/login" className="text-sm font-bold text-gray-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Voltar para o Login
          </Link>
        </div>
      </div>
    </div>
  );
}