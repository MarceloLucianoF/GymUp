import { safeHttpUrl, youtubeId } from './safeUrl';

describe('safeHttpUrl', () => {
  it('aceita http e https', () => {
    expect(safeHttpUrl('https://exemplo.com/a?b=1')).toBe('https://exemplo.com/a?b=1');
    expect(safeHttpUrl(' http://exemplo.com ')).toBe('http://exemplo.com/');
  });
  it('aceita caminho do próprio site', () => {
    expect(safeHttpUrl('/exercicios/supino-maquina.jpg')).toBe('/exercicios/supino-maquina.jpg');
  });
  it('bloqueia esquemas perigosos e entradas inválidas', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBe('');
    expect(safeHttpUrl('JaVaScRiPt:alert(1)')).toBe('');
    expect(safeHttpUrl('data:text/html,<script>1</script>')).toBe('');
    expect(safeHttpUrl('//exemplo.com')).toBe('');
    expect(safeHttpUrl('/exercicios/../segredo.jpg')).toBe('');
    expect(safeHttpUrl('/ex icio.jpg')).toBe('');
    expect(safeHttpUrl('')).toBe('');
    expect(safeHttpUrl(null)).toBe('');
    expect(safeHttpUrl(42)).toBe('');
  });
});

describe('youtubeId', () => {
  it('extrai o ID dos formatos comuns', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('rejeita IDs inválidos', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=../../evil')).toBe('');
    expect(youtubeId('javascript:alert(1)')).toBe('');
    expect(youtubeId(undefined)).toBe('');
  });
});
