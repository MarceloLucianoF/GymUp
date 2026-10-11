import React, { useEffect, useState } from 'react';
import { Dumbbell } from 'lucide-react';

// Miniatura do exercício com ícone quando não há imagem ou o link está quebrado.
export default function ExerciseThumb({ src, className = 'h-full w-full', iconClassName = 'h-7 w-7' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);

  if (!src || failed) {
    return (
      <span className={`flex items-center justify-center ${className}`} aria-hidden="true">
        <Dumbbell className={`${iconClassName} text-gray-500 dark:text-gray-400`} />
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={`${className} object-cover`} />;
}
