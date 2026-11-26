import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QUICK_SAYS } from '@mm/engine';
import { EMOJI_NOI } from '@/lib/noi-nhanh';
import { NGON_NGU } from '@/lib/i18n';

/**
 * NÓI NHANH (14.10.2026): chỉ câu CÓ SẴN, mã đi trên dây, mỗi máy tự dịch.
 * Thiếu emoji / bản dịch của một câu là bảng chọn hiện ra ô trống hoặc mã thô.
 */
describe('nói nhanh', () => {
  it('mã câu không trùng', () => {
    expect(QUICK_SAYS.length % 2).toBe(0);
    expect(new Set(QUICK_SAYS).size).toBe(QUICK_SAYS.length);
  });

  it('câu nào cũng có emoji riêng, không trùng nhau', () => {
    const e = QUICK_SAYS.map((id) => EMOJI_NOI[id]);
    expect(e.every(Boolean)).toBe(true);
    expect(new Set(e).size, 'hai câu cùng emoji thì không nhận ra trong một liếc').toBe(e.length);
  });

  // 22.11.2026: khung chọn và bong bóng vẽ ICON (Lucide trong vòng màu) — thiếu một câu là IconNoi vỡ lúc vẽ
  it('câu nào cũng có icon', async () => {
    const { ICON_NOI } = await import('@/lib/noi-nhanh');
    for (const id of QUICK_SAYS) expect(ICON_NOI[id]?.c, id).toBeTruthy();
  });

  it('câu nào cũng được dịch ở mọi ngôn ngữ', async () => {
    for (const { id: l } of NGON_NGU) {
      const tu = (await import(`../src/locales/${l}.ts`)).default as Record<string, unknown>;
      for (const id of QUICK_SAYS) expect(String(tu[`say.${id}`] ?? '').trim(), `${l}: say.${id}`).not.toBe('');
    }
  });

  // Nút nói nhanh CÓ LẠI (22.11.2026, mockup duyệt https://claude.ai/artifact/54TeMHuUCQA2pxs7FN7C4Q): ngoài cùng bên trái,
  // rồi tới ＋ — luật ẩn bớt chỉ đụng từ con thứ 6 nên cả hai luôn còn.
  it('nút nói chuyện là con ĐẦU của thanh, ＋ thứ hai, rồi mới tới hàng emoji', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/EmojiBar.vue'), 'utf8');
    const bar = src.slice(src.indexOf('class="emoji-bar"'));
    expect(bar.indexOf('emoji noi')).toBeGreaterThan(-1);
    expect(bar.indexOf('emoji noi')).toBeLessThan(bar.indexOf('emoji chon'));
    expect(bar.indexOf('emoji chon')).toBeLessThan(bar.indexOf('v-for="e in hangNgoai"'));
  });
  // 26.11.2026: câu "Tôi bận rồi, hẹn gặp lại sau nhé" TÁCH LÀM HAI (chủ dự án: "tách ra làm hai câu nhé") — dùng lại hai mã có sẵn
  it('10 câu đúng chủ dự án chọn, đúng thứ tự; "bận" và "hẹn gặp lại" là HAI câu riêng; 4 câu mới 26.11.2026', async () => {
    const { NOI_NHANH, QUICK_SAYS } = await import('@mm/engine');
    expect([...NOI_NHANH]).toEqual(['gioi', 'choiTiep', 'mayMan', 'batDau', 'choChut', 'quayLai', 'ban', 'henGap', 'vuiChoi', 'dongY']);
    expect(QUICK_SAYS.slice(-4), 'mã mới CHỈ THÊM VÀO CUỐI').toEqual(['choChut', 'quayLai', 'batDau', 'mayMan']);
    const vi = (await import('../src/locales/vi.ts')).default as Record<string, string>;
    expect(NOI_NHANH.map((id) => vi[`say.${id}`])).toEqual([
      'Bạn giỏi quá', 'Chúng ta chơi tiếp nhé', 'Chúc may mắn!', 'Bắt đầu đi!', 'Chờ mình chút nhé', 'Mình quay lại rồi',
      'Rất tiếc, tôi bận mất rồi', 'Hẹn gặp lại bạn sau nhé', 'Rất vui được chơi với bạn', 'Đồng ý'
    ]);
    // 26.11.2026: khung câu nói RIÊNG như bản cũ (chủ dự án: "tách riêng ô chat text và ô chat icon") — 10 câu cuộn trên máy thấp
    const eb = readFileSync(resolve(process.cwd(), 'src/components/EmojiBar.vue'), 'utf8');
    expect(eb, 'khung 10 câu cuộn trên máy thấp').toMatch(/\.bang-noi \{[^}]*max-height: min\(52vh, 420px\); overflow-y: auto;/);
    expect(eb, 'khung câu nói hai cột').toMatch(/\.bang-noi \{[^}]*grid-template-columns: 1fr 1fr;/);
    expect(eb, 'khung câu nói KHÔNG nằm trong khung emoji').toContain(`<div v-if="mo === 'noi' && !props.o.spectator.value" class="bang-noi khay"`);
    // Khung emoji: hàng ô nằm SAU phần nội dung (dưới cùng) — đổi ô không làm hàng ô nhảy dưới ngón tay
    expect(eb.indexOf('<div class="tab-o"'), 'hàng ô dưới cùng').toBeGreaterThan(eb.indexOf('<div class="noi-dung">'));
  });

  // 26.11.2026: emoji Premium — chủ dự án: "làm thêm một số icon premium", "disable mờ với người thường"
  it('emoji Premium: nằm trong danh sách server nhận, không trùng emoji thường; bảng có hàng riêng, chưa có Premium thì mờ + mở bảng Premium', async () => {
    const { EMOJI_PREMIUM, EMOJI_NHOM, QUICK_EMOJIS } = await import('@mm/engine');
    expect(EMOJI_PREMIUM).toHaveLength(24);                      // ô Premium: 3 hàng × 8
    const thuong = [...EMOJI_NHOM.camXuc, ...EMOJI_NHOM.tay, ...EMOJI_NHOM.vui, ...EMOJI_NHOM.treu] as string[];
    for (const e of EMOJI_PREMIUM) { expect(QUICK_EMOJIS, e).toContain(e); expect(thuong, e).not.toContain(e); }
    const src = readFileSync(resolve(process.cwd(), 'src/components/EmojiBar.vue'), 'utf8');
    expect(src).toContain('<div v-if="hienPremium()" class="be-luoi be-premium"');
    expect(src).toContain(":class=\"{ khoa: !daMuaPremium }\"");
    expect(src).toMatch(/if \(!daMuaPremium\.value\) \{[\s\S]{0,120}moPremium\('chat'\); return; \}/);
    expect(src).toMatch(/\.be-premium \.emoji\.khoa \{[^}]*grayscale/);
  });

  // 26.11.2026: bản bong bóng mờ .78 (1.10.37) bị bỏ cùng ngày — "khó nhìn". Bong bóng câu nói, emoji và khung chọn đều ĐẶC.
  it('bong bóng câu nói, emoji và khung chọn đều đặc — không mờ', () => {
    for (const f of ['LoiNoi.vue', 'EmojiBlast.vue']) {
      const s = readFileSync(resolve(process.cwd(), 'src/components', f), 'utf8');
      expect(s, f).not.toMatch(/\.bong \{[^}]*opacity: \./);
    }
    const bar = readFileSync(resolve(process.cwd(), 'src/components/EmojiBar.vue'), 'utf8');
    expect(bar).not.toMatch(/\.bang-(noi|emoji)[^{]*\{[^}]*opacity: \./);
  });
});
