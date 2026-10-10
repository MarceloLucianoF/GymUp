import React, { useState } from 'react';
import { Image as ImageIcon, Play } from 'lucide-react';

export default function GifPlayer({ src, alt, className }) {
  const [isHovered, setIsHovered] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Se não tiver imagem, mostra placeholder
  if (!src || hasError) {
    return (
      <div className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 ${className}`}>
        <ImageIcon className="h-7 w-7" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div 
      className={`relative overflow-hidden cursor-pointer group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. O GIF (Só aparece se estiver com mouse em cima) */}
      {isHovered ? (
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-full object-cover animate-fade-in"
          onError={() => setHasError(true)}
        />
      ) : (
        /* 2. O Placeholder "Estático" (Quando o mouse sai) */
        <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center transition-colors">
          {/* Tenta mostrar uma versão estática se você tiver (ex: supino.jpg), senão mostra ícone */}
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="ml-1 h-6 w-6 fill-current text-white" aria-hidden="true" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">Passe o mouse</p>
        </div>
      )}

      {/* Badge de Video/GIF */}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full uppercase font-bold tracking-wider pointer-events-none">
        GIF
      </div>
    </div>
  );
}