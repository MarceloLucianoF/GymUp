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
    <div className="aurora-bg min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-[#0B0F19] p-4 overflow-hidden transition-colors">
      <div className="surface p-6 sm:p-8 w-full max-w-md animate-fade-up">
        <div className="text-center mb-6">
          <h2 className="font-display text-2xl font-black text-gray-900 dark:text-white">Recuperar Senha</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">Digite seu email para receber o link.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase ml-1">Email</label>
            <input 
                type="email" 
                required 
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 min-h-[52px] rounded-2xl outline-none focus:ring-2 focus:ring-brand dark:text-white transition-all"
                placeholder="seu@email.com"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-gradient-to-r from-brand to-[#FF9800] text-black font-black min-h-[56px] rounded-2xl shadow-lg shadow-brand/25 transition-transform active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
          >
            {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link to="/login" className="text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-brand min-h-[44px] transition-colors flex items-center justify-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Voltar para o Login
          </Link>
        </div>
      </div>
    </div>
  );
}