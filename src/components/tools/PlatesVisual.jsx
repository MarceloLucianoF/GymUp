import React from 'react';

const COLORS = { 25: '#dc2626', 20: '#2563eb', 15: '#eab308', 10: '#16a34a', 5: '#e5e7eb', 2.5: '#9ca3af', 1.25: '#6b7280' };
const heightOf = (p) => 30 + Math.min(p, 25) * 2.2;

// Barra com as anilhas de um lado, da mais pesada (junto ao colar) para a mais leve.
const PlatesVisual = ({ perSide }) => {
    const plateW = 14;
    const width = 40 + perSide.length * (plateW + 3) + 40;
    return (
        <svg viewBox={`0 0 ${Math.max(width, 160)} 120`} className="w-full max-w-sm mx-auto" role="img" aria-label={`Anilhas por lado: ${perSide.join(', ') || 'nenhuma'}`}>
            <rect x="0" y="56" width={Math.max(width, 160)} height="8" rx="3" fill="#9ca3af" />
            <rect x="24" y="30" width="8" height="60" rx="2" fill="#4b5563" />
            {perSide.map((p, i) => {
                const h = heightOf(p);
                return (
                    <g key={`${p}-${i}`}>
                        <rect x={36 + i * (plateW + 3)} y={60 - h / 2} width={plateW} height={h} rx="3" fill={COLORS[p] || '#6b7280'} stroke="#111827" strokeWidth="1" />
                        <text x={36 + i * (plateW + 3) + plateW / 2} y="62" fontSize="7" fontWeight="700" textAnchor="middle" fill="#111827">{p}</text>
                    </g>
                );
            })}
        </svg>
    );
};

export default PlatesVisual;
