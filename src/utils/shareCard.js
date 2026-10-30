// Imagem do treino concluído para stories e WhatsApp (1080 × 1920), desenhada no aparelho com canvas.
// Leva só o que a pessoa vê na tela de conclusão: nome do treino, data, números, recordes e evoluções. Sem nome, e-mail ou foto.
import { fmtKg } from './progression';

export const CARD_W = 1080;
export const CARD_H = 1920;
export const SHARE_URL = 'bohtreinar.marcelo-labs.workers.dev';
const BRAND = '#FFC107';
const ORANGE = '#FF9800';
const BG = '#0B0F19';
const DISPLAY = "'Outfit', 'Inter', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

const nf = new Intl.NumberFormat('pt-BR');

/** Dados da imagem a partir das estatísticas da conclusão e dos fatos do resumo. */
export function shareCardData(stats = {}, facts = null, now = new Date()) {
  const highlights = (facts?.exercises || [])
    .filter((e) => (e.trend === 'load' || e.trend === 'reps') && e.delta)
    .slice(0, 3)
    .map((e) => `${e.name}: ${e.trend === 'load' ? `+${fmtKg(e.delta)} kg` : `+${e.delta} ${e.delta === 1 ? 'repetição' : 'repetições'}`}`);
  return {
    title: String(stats.trainingName || 'Treino').slice(0, 60),
    date: now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
    stats: [
      ['Tempo', stats.timeStr || '-'],
      ['Volume', `${nf.format(Math.round(stats.volumeKg || 0))} kg`],
      ['Séries', String(stats.completedSetsCount || 0)],
      ['Exercícios', String(stats.executedExercisesCount || 0)]
    ],
    prs: (stats.newPRs || []).slice(0, 3),
    highlights
  };
}

/** Quebra o texto em linhas que cabem na largura (no máximo maxLines; a última ganha reticências). */
export function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

/** Desenha a imagem no canvas. Devolve false se o aparelho não tiver canvas 2D. */
export async function drawShareCard(canvas, data, { logoSrc = '/icon-192.png' } = {}) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return false;
  canvas.width = CARD_W; canvas.height = CARD_H;
  try { await Promise.all([`900 96px ${DISPLAY}`, `700 40px ${BODY}`].map((f) => document.fonts?.load?.(f))); } catch (_) { /* usa a fonte do sistema */ }

  // Fundo escuro com brilhos da marca
  ctx.fillStyle = BG; ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = (x, y, r, color) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(11,15,25,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, CARD_W, CARD_H); };
  glow(960, 120, 760, 'rgba(255,193,7,0.38)');
  glow(80, 1800, 700, 'rgba(255,112,67,0.22)');

  const X = 96; const W = CARD_W - X * 2;

  // Marca
  const logo = await loadImage(logoSrc);
  if (logo) { ctx.save(); roundRect(ctx, X, 120, 96, 96, 24); ctx.clip(); ctx.drawImage(logo, X, 120, 96, 96); ctx.restore(); }
  ctx.fillStyle = '#FFFFFF'; ctx.font = `900 56px ${DISPLAY}`; ctx.textBaseline = 'middle';
  ctx.fillText('BohTreinar', logo ? X + 124 : X, 170);

  // Título
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BRAND; ctx.font = `800 40px ${BODY}`;
  ctx.fillText('TREINO CONCLUÍDO', X, 400);
  ctx.fillStyle = '#FFFFFF'; ctx.font = `900 104px ${DISPLAY}`;
  let y = 510;
  wrapLines(ctx, data.title, W, 3).forEach((l) => { ctx.fillText(l, X, y); y += 112; });
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `500 40px ${BODY}`;
  ctx.fillText(data.date.charAt(0).toUpperCase() + data.date.slice(1), X, y + 6);
  y += 90;

  // Números 2 × 2
  const gap = 24; const tw = (W - gap) / 2; const th = 196;
  data.stats.forEach(([label, value], i) => {
    const tx = X + (i % 2) * (tw + gap); const ty = y + Math.floor(i / 2) * (th + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; roundRect(ctx, tx, ty, tw, th, 40); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = `700 34px ${BODY}`; ctx.fillText(label.toUpperCase(), tx + 44, ty + 70);
    // O número diminui até caber (volume alto como "12.346 kg" não é cortado).
    let size = 84;
    do { ctx.font = `900 ${size}px ${DISPLAY}`; size -= 4; } while (size >= 44 && ctx.measureText(value).width > tw - 88);
    ctx.fillStyle = '#FFFFFF'; ctx.fillText(value, tx + 44, ty + 156);
  });
  y += th * 2 + gap + 70;

  // Recordes e evoluções
  const fy = CARD_H - 250;
  const block = (heading, items, color) => {
    if (!items.length || y + 64 + 62 > fy - 30) return;
    ctx.fillStyle = color; ctx.font = `800 36px ${BODY}`; ctx.fillText(heading, X, y); y += 64;
    ctx.fillStyle = '#FFFFFF'; ctx.font = `600 42px ${BODY}`;
    items.forEach((it) => { if (y > fy - 50) return; ctx.fillText(`• ${wrapLines(ctx, it, W - 40, 1)[0]}`, X, y); y += 62; });
    y += 30;
  };
  block(data.prs.length === 1 ? 'RECORDE PESSOAL' : 'RECORDES PESSOAIS', data.prs, BRAND);
  block('EVOLUIU HOJE', data.highlights, '#34D399');

  // Rodapé com chamada e endereço
  const band = ctx.createLinearGradient(X, 0, X + W, 0); band.addColorStop(0, BRAND); band.addColorStop(1, ORANGE);
  ctx.fillStyle = band; roundRect(ctx, X, fy, W, 150, 40); ctx.fill();
  ctx.fillStyle = '#000000'; ctx.font = `900 46px ${DISPLAY}`; ctx.fillText('Treine comigo no BohTreinar', X + 48, fy + 66);
  ctx.font = `600 32px ${BODY}`; ctx.fillText(SHARE_URL, X + 48, fy + 116);
  return true;
}

/** PNG da imagem, ou null se o aparelho não conseguir gerar. */
export async function shareCardBlob(data) {
  const canvas = document.createElement('canvas');
  if (!(await drawShareCard(canvas, data))) return null;
  return new Promise((resolve) => { try { canvas.toBlob((b) => resolve(b), 'image/png'); } catch (_) { resolve(null); } });
}
