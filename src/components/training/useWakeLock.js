import { useEffect } from 'react';

// Mantém a tela acesa enquanto `active` (fallback silencioso se não suportado).
export function useWakeLock(active) {
    useEffect(() => {
        if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;
        let sentinel = null;
        let cancelled = false;

        const request = async () => {
            try {
                const s = await navigator.wakeLock.request('screen');
                if (cancelled) { s.release?.().catch?.(() => {}); return; }
                sentinel = s;
            } catch (e) { /* sem suporte ou negado: ignora */ }
        };
        const onVisible = () => { if (document.visibilityState === 'visible') request(); };

        request();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisible);
            try { sentinel?.release?.().catch?.(() => {}); } catch (e) { /* ignora */ }
        };
    }, [active]);
}
