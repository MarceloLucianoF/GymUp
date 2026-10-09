import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../hooks/AuthContext';
import { useTheme } from '../../hooks/ThemeContext'; // <--- Importe o hook

export default function Navigation() {
  const navigate = useNavigate();
  const { logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme(); // <--- Use o hook

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-gray-800 dark:bg-gray-900 text-white p-4 shadow-lg transition-colors duration-300"> {/* Adicione dark:bg-gray-900 */}
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link to="/home" className="text-2xl font-bold">
          💪 Workout Tracker
        </Link>

        <div className="flex gap-6 items-center">
          {/* ... seus outros links ... */}
          
          <Link to="/home" className="hover:text-blue-400 transition">Home</Link>
          <Link to="/trainings" className="hover:text-blue-400 transition">Treinos</Link>
          <Link to="/history" className="hover:text-blue-400 transition">Histórico</Link>
          <Link to="/admin" className="hover:text-blue-400 transition">Admin</Link>
          <Link to="/profile" className="hover:text-blue-400 transition">Perfil</Link>

          {/* Botão de Tema */}
          <button aria-label="Alternar tema" 
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-700 dark:hover:bg-gray-800 transition"
            title={theme === 'dark' ? 'Mudar para Claro' : 'Mudar para Escuro'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <button
            onClick={handleLogout}
            className="bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}