import React from 'react';
import Modal from './Modal';

export default function VideoModal({ videoUrl, onClose }) {
  if (!videoUrl) return null;

  // Função para extrair o ID do vídeo do YouTube
  const getEmbedUrl = (url) => {
    let videoId = '';
    
    // Tenta formato padrão: youtube.com/watch?v=ID
    if (url.includes('v=')) {
      videoId = url.split('v=')[1].split('&')[0];
    } 
    // Tenta formato curto: youtu.be/ID
    else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1];
    }

    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  };

  return (
    <Modal onClose={onClose} label="Vídeo do exercício" className="w-full max-w-3xl bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
      <div className="absolute top-0 right-0 p-4 z-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar vídeo"
          className="bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Player (Aspect Ratio 16:9) */}
      <div className="aspect-video w-full">
        <iframe
          className="w-full h-full"
          src={getEmbedUrl(videoUrl)}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </Modal>
  );
}
