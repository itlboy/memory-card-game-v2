import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * HIỆU ỨNG TRONG VÁN (Premium) + CHỈ SỐ TRÍ NHỚ "CẢ NĂM" (26.11.2026, mockup duyệt https://claude.ai/artifact/ALpRKG88kcozoAgRgw9gCh).
 * Chủ dự án: "chỉ cần 2 cặp cũng là đủ có hiệu ứng đẹp rồi đó, kể cả 1 cặp"; "làm sao để người dùng biết đó là hiệu ứng premium".
 */
const doc = (f: string): string => readFileSync(resolve(process.cwd(), f), 'utf8');
beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; });

describe('hiệu ứng ghép cặp Premium', () => {
  it('dòng "Hiệu ứng Premium" chỉ MỘT lần mỗi ngày', async () => {
    vi.resetModules();
    const h = await import('@/lib/hieu-ung-premium');
    expect(h.baoLanDauHomNay('2026-11-26')).toBe(true);
    expect(h.baoLanDauHomNay('2026-11-26')).toBe(false);
    expect(h.baoLanDauHomNay('2026-11-27')).toBe(true);
  });

  it('1 cặp đã có hiệu ứng (phồng sáng + bung tia); từ 2 cặp liền có nhãn "Chuỗi N" đeo vương miện', async () => {
    vi.resetModules();
    document.body.innerHTML = '<div role="grid"><div data-index="3"></div><div data-index="7"></div></div>';
    const h = await import('@/lib/hieu-ung-premium');
    const Fx = (await import('@/components/GhepPremiumFx.vue')).default;
    const w = mount(Fx, { attachTo: document.body });
    h.bungGhep([3, 7], 1);
    await w.vm.$nextTick();
    expect(document.querySelectorAll('.ghep-pm')).toHaveLength(2);
    expect(document.querySelectorAll('.gpf .bung')).toHaveLength(2);
    expect(document.querySelector('.gpf .chuoi'), '1 cặp: chưa có nhãn chuỗi').toBeNull();
    expect(document.querySelector('.gpf .bao'), 'lần đầu trong ngày: có dòng Hiệu ứng Premium').not.toBeNull();
    h.bungGhep([3, 7], 2);
    await w.vm.$nextTick();
    const chuoi = document.querySelector('.gpf .chuoi');
    expect(chuoi?.textContent).toContain('Chuỗi 2');
    expect(chuoi?.querySelector('.vm'), 'nhãn chuỗi đeo vương miện').not.toBeNull();
    w.unmount();
  });

  it('chỉ phát cho người có Premium: offline = người trên máy (không cho máy), online = mình có Premium hoặc server báo người đó `pm`', () => {
    expect(doc('src/composables/useGameSession.ts')).toContain('if (daMuaPremium.value && !laBot(e.playerId)) bungGhep(e.indices, streak);');
    const on = doc('src/composables/useOnlineRoom.ts');
    expect(on).toContain("const coPm = e.playerId === myId.value ? daMuaPremium.value : !!room.value?.players.find((p) => p.id === e.playerId)?.pm;");
    expect(on).toContain("if (daMuaPremium.value) params.set('pm', '1');");
    const sv = doc('../server/src/room.ts');
    expect(sv).toContain("const pm = url.searchParams.get('pm') === '1';");
    expect(sv.match(/\.\.\.\(p\.pm \? \{ pm: true \} : \{\}\)/g)).toHaveLength(2);
  });
});

describe('Chỉ số trí nhớ: tab "Cả năm" (Premium)', () => {
  it('12 cột theo tháng, tab đeo vương miện, chưa có Premium thì bấm mở bảng Premium', () => {
    const s = doc('src/components/SoTriNho.vue');
    expect(s).toContain('const thang = Array.from({ length: 12 }');
    expect(s).toMatch(/class="thach th-nho tab-nam"[^>]*@click="moTabNam"/);
    expect(s).toMatch(/function moTabNam\(\): void \{\s*if \(!daMuaPremium\.value\) \{[^}]*moPremium\('tri-nho'\); return; \}/);
    expect(s).toContain('.hinh.nam { grid-template-columns: repeat(12, minmax(0, 1fr));');
  });
});

/** 26.11.2026 — chủ dự án: "trong cài đặt giờ cũng cho menu cài đặt premium, tương tự bấm vào nút premium". */
describe('Cài đặt Premium trong trang Cài đặt của menu ☰', () => {
  it('ba ô Chủ đề · Nhạc nền · Huy hiệu khi có Premium; chưa có thì một dòng mở bảng Premium; đóng bảng con về lại trang Cài đặt', () => {
    const tb = doc('src/components/TopBar.vue');
    expect(tb).toContain('<template v-if="daMuaPremium || moiNangCap">');
    for (const m of ['nen', 'nhac', 'hh']) expect(tb).toContain(`@click="emit('mo-pm', '${m}')"`);
    expect(tb).toMatch(/moMenu: \(trang\?: 'cd'\): void => \{ open\.value = true; if \(trang === 'cd'\)/);
    const app = doc('src/App.vue');
    expect(app).toContain('@mo-pm="moTuCaiDat"');
    expect(app).toContain("topBar.value?.moMenu(veCaiDat ? 'cd' : undefined)");
  });
});

/** 26.11.2026 — mockup B duyệt https://claude.ai/artifact/FbPTdLUCEZMaZhfMcKsKs2: nhãn dán "● N online" thay viên ba con số nền xám. */
describe('nhãn "● N online" trên ô Chơi online', () => {
  it('một nhãn trắng dán lệch mép trên, nghiêng như nhãn "Màn N"; chấm xanh nhịp khi có phòng chờ; đọc màn hình nghe đủ ba số', () => {
    const s = doc('src/components/MenuScreen.vue');
    expect(s).not.toContain('class="so-phong"');
    expect(s).toMatch(/class="nhan-online" :class="\{ 'co-phong': soPhongCho > 0 \}"/);
    expect(s).toMatch(/\.nhan-online \{[^}]*top: -11px; right: 6px;[^}]*rotate: 4deg;/);
    expect(s).toContain("t('menu.soPhongXem', { n: soPhongXem })");
  });
});
