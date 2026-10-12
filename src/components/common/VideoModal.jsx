import React from 'react';
import { X } from 'lucide-react';
import Modal from './Modal';
import { youtubeId } from '../../utils/safeUrl';

export default function VideoModal({ videoUrl, onClose }) {
  if (!videoUrl) return null;

  const videoId = youtubeId(videoUrl);
  if (!videoId) return null;
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

  return (
    <Modal onClose={onClose} label="Vídeo do exercício" className="w-full max-w-3xl bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
      <div className="absolute top-0 right-0 p-4 z-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar vídeo"
          className="bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
        >
<X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Player (Aspect Ratio 16:9) */}
      <div className="aspect-video w-full">
        <iframe
          className="w-full h-full"
          src={embedUrl}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </Modal>
  );
}
