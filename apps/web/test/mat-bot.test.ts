import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { BOT_SPECS, MAT_BAO_DEN, MAT_RONG_VANG } from '@mm/engine';
import MatBot from '@/components/MatBot.vue';

/*
 * Mặt báo đen là một KHOÁ chứ không phải emoji; màn nào có thể hiện bot mà in
 * thẳng chuỗi avatar là người chơi thấy ":bao-den:". Online CÓ bot (từ 1.7) — bản 1.8.1 còn in
 * thẳng mặt người đi trước ở màn đếm ngược, ra "🎮 :rong-vang: Bot rồng thần đi trước" (15.11.2026).
 */
const doc = (f: string): string => readFileSync(resolve(process.cwd(), 'src/components', f), 'utf8');

describe('mặt bot', () => {
  it('báo đen dùng khoá, không phải ký tự in được', () => {
    expect(BOT_SPECS.hard.avatar).toBe(MAT_BAO_DEN);
    expect(BOT_SPECS.divine.avatar).toBe(MAT_RONG_VANG);
    expect(MAT_RONG_VANG).toMatch(/^:[a-z-]+:$/);
    expect(MAT_BAO_DEN).toMatch(/^:[a-z-]+:$/);
  });

  it('MatBot dịch khoá ra SVG, mặt khác in nguyên chữ', () => {
    expect(mount(MatBot, { props: { mat: MAT_BAO_DEN } }).find('svg').exists()).toBe(true);
    expect(mount(MatBot, { props: { mat: MAT_RONG_VANG } }).find('svg').exists()).toBe(true);
    const w = mount(MatBot, { props: { mat: '🐲' } });
    expect(w.find('svg').exists()).toBe(false);
    expect(w.text()).toBe('🐲');
  });

  it.each(['PlayerStrip.vue', 'MenuScreen.vue', 'GameScreen.vue', 'OnlineGame.vue', 'OnlineScreen.vue', 'TeamStrip.vue', 'ChonDoi.vue'])('%s không in avatar thẳng', (f) => {
    const tpl = doc(f);
    expect(tpl, `${f}: có "{{ …avatar… }}" — phải đi qua <MatBot>`).not.toMatch(/\{\{[^}]*avatar[^}]*\}\}/i);
    expect(tpl, `${f}: mặt người đi trước in chữ trơn`).not.toMatch(/\{\{\s*matDiTruoc\s*\}\}/);
  });
});
