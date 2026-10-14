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

describe('chưa bật bán Premium (bản đầu lên store)', () => {
  it('menu chỉ bày skin miễn phí — Kẹo, Neon, Gỗ; bật bán thì hiện đủ', async () => {
    const { banPremium, daMuaPremium } = await import('../src/lib/premium');
    const { skinsHien, SKIN_PREMIUM } = await import('../src/lib/skin');
    daMuaPremium.value = false; banPremium.value = false;
    expect(skinsHien.value).toEqual(['keo', 'neon', 'go']);
    expect(skinsHien.value.length % 3).toBe(0);            // một hàng tròn
    banPremium.value = true;
    expect(skinsHien.value.filter((s) => SKIN_PREMIUM.has(s))).toEqual(['sao', 'bong']);
    banPremium.value = false;
  });
});

describe('nút "Mở Premium để thử" ở chế độ debug', () => {
  it('bật thì menu bày đủ 5 skin và nhớ qua lần mở sau; tắt thì về 3', async () => {
    const { datPremiumThu } = await import('../src/lib/premium');
    const { skinsHien } = await import('../src/lib/skin');
    datPremiumThu(true);
    expect(skinsHien.value).toHaveLength(5);
    expect(localStorage.getItem('mm.premium')).toBe('1');
    datPremiumThu(false);
    expect(skinsHien.value).toEqual(['keo', 'neon', 'go']);
    expect(localStorage.getItem('mm.premium')).toBeNull();
  });
});
