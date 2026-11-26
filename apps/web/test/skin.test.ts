import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SKINS, SKIN_MAC_DINH } from '../src/lib/skin';
import { NGON_NGU, TU_DIEN } from '../src/lib/i18n';
import { resolve } from 'node:path';

/**
 * HỆ THỐNG SKIN (lib/skin.ts): thêm skin = id + file CSS + tên ở 12 từ điển.
 * Thiếu file là skin chạy y hệt neon mà không ai biết; thiếu tên là menu hiện khoá thô.
 */
const src = (p: string) => resolve('src', p);

describe('skin', () => {
  it('mặc định là Kẹo (chủ dự án chốt 13.10.2026)', () => {
    expect(SKIN_MAC_DINH).toBe('keo');
  });

  it('mỗi skin có file CSS, được nạp ở main.ts, và mọi khối nằm dưới :root[data-skin]', () => {
    const main = readFileSync(src('main.ts'), 'utf8');
    for (const s of SKINS) {
      expect(existsSync(src(`styles/skins/${s}.css`)), `thiếu styles/skins/${s}.css`).toBe(true);
      expect(main).toContain(`./styles/skins/${s}.css`);
      const css = readFileSync(src(`styles/skins/${s}.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      // Selector lọt ra ngoài skin là đổi giao diện của MỌI skin
      const selectors = css.split('}').map((b) => b.split('{')[0]!.trim()).filter((x) => x && !x.startsWith('@'));
      for (const sel of selectors) {
        for (const part of sel.split(/,(?![^(]*\))/)) expect(part.trim(), `lọt skin: ${part}`).toMatch(new RegExp(`^:root\\[data-skin='${s}'\\]`));
      }
    }
  });

  it('tên skin có ở mọi ngôn ngữ', () => {
    for (const { id } of NGON_NGU) {
      const tu = TU_DIEN[id] as unknown as Record<string, string>;
      expect(tu['tb.giaoDien'], `${id}: tb.giaoDien`).toBeTruthy();
      for (const s of SKINS) expect(tu[`tb.skin.${s}`], `${id}: tb.skin.${s}`).toBeTruthy();
    }
  });
});

/**
 * 26.11.2026 — chủ dự án: "các theme cũ trước kia thì tôi nghĩ nên bỏ đi luôn" → "đúng, xoá đi". Bốn skin Neon · Gỗ · Đêm Sao ·
 * Kẹo Bông đã xoá hẳn; vẻ ngoài giờ đổi bằng Chủ đề (lib/canh.ts).
 */
describe('chỉ còn skin Kẹo', () => {
  it('danh sách skin chỉ có Kẹo; file CSS, dòng nạp và tên của bốn skin cũ không còn', () => {
    expect([...SKINS]).toEqual(['keo']);
    const main = readFileSync(src('main.ts'), 'utf8');
    for (const cu of ['neon', 'go', 'sao', 'bong']) {
      expect(existsSync(src(`styles/skins/${cu}.css`)), `${cu}.css còn sót`).toBe(false);
      expect(main).not.toContain(`./styles/skins/${cu}.css`);
      for (const { id } of NGON_NGU) expect((TU_DIEN[id] as unknown as Record<string, string>)[`tb.skin.${cu}`], `${id}: tb.skin.${cu}`).toBeUndefined();
    }
  });

  it('máy còn lưu skin cũ (hoặc mở bằng ?skin=go) thì về Kẹo, không vỡ giao diện', async () => {
    const { vi } = await import('vitest');
    for (const cu of ['neon', 'go', 'sao', 'bong']) {
      localStorage.setItem('mm.skin', cu);
      vi.resetModules();
      const m = await import('../src/lib/skin');
      expect(m.skin.value, cu).toBe('keo');
    }
    localStorage.removeItem('mm.skin');
  });

  it('nút "Mở Premium để thử" ở chế độ debug vẫn nhớ qua lần mở sau', async () => {
    const { datPremiumThu } = await import('../src/lib/premium');
    datPremiumThu(true);
    expect(localStorage.getItem('mm.premium')).toBe('1');
    datPremiumThu(false);
    expect(localStorage.getItem('mm.premium')).toBeNull();
  });
});
