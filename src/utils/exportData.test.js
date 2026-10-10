import { buildExportPayload, exportFileName, deletionMailto } from './exportData';

jest.mock("../firebase/config", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({}));

describe('exportData', () => {
  const now = new Date('2026-03-04T10:00:00.000Z');

  it('monta o JSON com conta, perfil, check-ins e medidas, convertendo timestamps', () => {
    const ts = { toDate: () => new Date('2026-01-02T00:00:00.000Z') };
    const out = buildExportPayload({
      user: { uid: 'abc12345xyz', email: 'a@b.com' },
      profile: { displayName: 'Ana', createdAt: ts },
      checkIns: [{ id: '1', date: ts, sets: [{ kg: 10 }] }],
      measurements: [{ id: 'm', weight: 70 }]
    }, now);
    expect(out.exportedAt).toBe('2026-03-04T10:00:00.000Z');
    expect(out.account).toEqual({ uid: 'abc12345xyz', email: 'a@b.com' });
    expect(out.profile.createdAt).toBe('2026-01-02T00:00:00.000Z');
    expect(out.checkIns[0].date).toBe('2026-01-02T00:00:00.000Z');
    expect(out.checkIns[0].sets[0].kg).toBe(10);
    expect(out.measurements).toHaveLength(1);
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it('tolera entradas vazias', () => {
    const out = buildExportPayload({ user: null }, now);
    expect(out.checkIns).toEqual([]);
    expect(out.account.uid).toBeNull();
  });

  it('gera nome de arquivo estável', () => {
    expect(exportFileName('abc12345xyz', now)).toBe('bohtreinar-meus-dados-abc12345-2026-03-04.json');
    expect(exportFileName(undefined, now)).toBe('bohtreinar-meus-dados-usuario-2026-03-04.json');
  });

  it('monta mailto de exclusão com e-mail da conta', () => {
    const link = deletionMailto({ uid: 'u1', email: 'a@b.com' });
    expect(link.startsWith('mailto:contato@bohtreinar.app?subject=')).toBe(true);
    expect(decodeURIComponent(link)).toContain('a@b.com');
  });
});
