// Miniaturas e listas usam a FOTO (leve); só a execução e o zoom usam o GIF animado (150 a 330 KB cada).
// Convenção: /exercises/<slug>.gif tem a foto /exercicios/<slug>.jpg (gerada junto, ver scripts/midia-exercicios.py).
export function stillSrc(src) {
  if (typeof src !== 'string') return src;
  const m = src.match(/^\/exercises\/([a-z0-9-]+)\.gif$/);
  return m ? `/exercicios/${m[1]}.jpg` : src;
}
