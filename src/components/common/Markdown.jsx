import React from 'react';

// Markdown mínimo e SEGURO para respostas da IA: títulos, listas, regra horizontal, negrito, itálico e código.
// Nunca usa dangerouslySetInnerHTML: todo texto vira nó React (sem execução de HTML/scripts).

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

export const renderInline = (text, keyPrefix = 'i') => String(text)
  .split(INLINE)
  .filter((part) => part !== '')
  .map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) return <strong key={key} className="font-black text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={key} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/10">{part.slice(1, -1)}</code>;
    if (/^\*[^*\s][^*]*\*$/.test(part) || /^_[^_\s][^_]*_$/.test(part)) return <em key={key} className="italic">{part.slice(1, -1)}</em>;
    return part;
  });

// Converte o texto em blocos: { type: 'h'|'ul'|'ol'|'hr'|'p'|'quote', ... }
export const parseBlocks = (source) => {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => { if (paragraph.length) { blocks.push({ type: 'p', text: paragraph.join(' ') }); paragraph = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };

  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushList(); return; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { flushParagraph(); flushList(); blocks.push({ type: 'h', level: Math.min(heading[1].length, 4), text: heading[2] }); return; }

    if (/^([-*_])\1{2,}$/.test(line)) { flushParagraph(); flushList(); blocks.push({ type: 'hr' }); return; }

    const bullet = line.match(/^[*\-•]\s+(.*)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((bullet || numbered)[bullet ? 1 : 2]);
      return;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) { flushParagraph(); flushList(); blocks.push({ type: 'quote', text: quote[1] }); return; }

    flushList();
    paragraph.push(line);
  });
  flushParagraph();
  flushList();
  return blocks;
};

const HEADING_CLASS = {
  1: 'mt-3 mb-1.5 font-display text-base font-black',
  2: 'mt-3 mb-1.5 font-display text-sm font-black',
  3: 'mt-3 mb-1 font-display text-[13px] font-black text-amber-700 dark:text-brand',
  4: 'mt-2 mb-1 text-xs font-black uppercase tracking-wide'
};

export default function Markdown({ text, className = '' }) {
  const blocks = parseBlocks(text);
  return (
    <div className={`space-y-2 text-left ${className}`}>
      {blocks.map((block, index) => {
        const key = `b-${index}`;
        if (block.type === 'h') {
          const Tag = block.level <= 2 ? 'h3' : 'h4';
          return <Tag key={key} className={HEADING_CLASS[block.level]}>{renderInline(block.text, key)}</Tag>;
        }
        if (block.type === 'hr') return <hr key={key} className="my-3 border-gray-200 dark:border-white/10" />;
        if (block.type === 'ul' || block.type === 'ol') {
          const List = block.type === 'ul' ? 'ul' : 'ol';
          return (
            <List key={key} className={`space-y-1 pl-5 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-brand`}>
              {block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>)}
            </List>
          );
        }
        if (block.type === 'quote') return <blockquote key={key} className="border-l-2 border-brand pl-3 text-gray-500 dark:text-gray-400">{renderInline(block.text, key)}</blockquote>;
        return <p key={key}>{renderInline(block.text, key)}</p>;
      })}
    </div>
  );
}
