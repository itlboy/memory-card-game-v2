<script setup lang="ts">
import { t } from '@/lib/i18n';
import { campaignSpec, CAMPAIGN_LEVELS, LEVEL_KEYS, sizeForLevel } from '@mm/engine';
import { LayoutGrid, LogOut, Map as BanDo, Medal, Play, Trophy, X } from 'lucide-vue-next';
import { hangXu } from '@/lib/hang-xu';
import { computed, onMounted, ref, watch } from 'vue';
import { dsHien, daCo as daCoRef } from '@/lib/achievements';
import { num, numShort } from '@/lib/format';
import { store } from '@/lib/storage';
import { hoSo, tenToi } from '@/lib/ho-so';
import type { PhaKyLuc } from '@/lib/taikhoan';
import { coApple, coGoogle, coGoogleApp, dangNhapApple, dangNhapGoogleApp, dangTai, dangXuat, me, veNutGoogle, xoaTaiKhoan } from '@/lib/taikhoan';

/**
 * MÀN TÀI KHOẢN: chưa đăng nhập thì nút Google và/hoặc Apple (tuỳ nền, xem
 * lib/taikhoan.ts); đã đăng nhập thì hồ sơ
 * (điểm, số ván, thắng/thua/hoà), danh hiệu, kỷ lục theo cỡ bàn và bảng xếp
 * hạng. Khung giống RulesDialog: tiêu đề + nút đóng đứng yên, RUỘT cuộn —
 * nên không phá luật KHÔNG SCROLL của trang.
 *
 * XOÁ TÀI KHOẢN phải nằm NGAY TRONG app (App Store 5.1.1(v)), hai bước: bấm
 * "Xoá tài khoản" chỉ mở câu hỏi, nút đỏ mới xoá thật.
 */
const emit = defineEmits<{ close: []; 'danh-hieu': []; 'xep-hang': []; 'pha-ky-luc': [PhaKyLuc] }>();
const closeBtn = ref<HTMLButtonElement | null>(null);
const nutGoogle = ref<HTMLElement | null>(null);
const loi = ref('');

onMounted(() => { closeBtn.value?.focus(); veNut(); });
watch(me, (m) => { if (!m) veNut(); });

const hoiXoa = ref(false);
const dangXoa = ref(false);
const loiXoa = ref('');

async function apple(): Promise<void> {
  loi.value = '';
  try { await dangNhapApple(); } catch (e) {
    const m = (e as Error).message;
    if (m !== 'huy') loi.value = m === '401' ? t('tk.loiApple') : t('tk.loiDangNhap');
  }
}

async function googleApp(): Promise<void> {
  loi.value = '';
  try { await dangNhapGoogleApp(); } catch (e) {
    const m = (e as Error).message;
    if (m !== 'huy') loi.value = m === '401' ? t('tk.loiGoogle') : t('tk.loiDangNhap');
  }
}

async function xoa(): Promise<void> {
  dangXoa.value = true;
  loiXoa.value = '';
  try { await xoaTaiKhoan(); emit('close'); } catch { loiXoa.value = t('tk.loiXoa'); } finally { dangXoa.value = false; }
}

async function veNut(): Promise<void> {
  if (me.value || !coGoogle.value) return;
  await Promise.resolve();            // chờ v-if dựng xong ô chứa nút
  const el = nutGoogle.value;
  if (!el) return;
  try {
    await veNutGoogle(el, () => { loi.value = ''; }, (e) => { loi.value = e.message === '401' ? t('tk.loiGoogle') : t('tk.loiDangNhap'); });
  } catch { loi.value = t('tk.loiNut'); }
}

/** Bảng xếp hạng nay là hộp riêng (BangXepHang.vue, 19.11.2026) — mở cả từ viên đồng xu. */
function moBxh(): void { emit('xep-hang'); }

const tiLeThang = computed(() => {
  const m = me.value;
  return m && m.matches ? Math.round((m.wins / m.matches) * 100) : 0;
});

/*
 * KỶ LỤC (22.11.2026, mockup duyệt https://claude.ai/artifact/KzuWVG5QwHxQ13Hi7AUN3C — chủ dự án: "kỷ lục cho nút bấm vào
 * chơi tiếp để phá kỷ lục; xếp khó trên, dễ dưới"). Khoá `mode:L<cấp>`:
 *  - Chiến dịch: cấp = số MÀN (1..60), số thẻ đọc từ `campaignSpec`.
 *  - Còn lại: cấp = khoá cỡ bàn. GỘP THEO SỐ THẺ, giữ điểm cao nhất — bản cũ có nhiều khoá cho cùng một cỡ
 *    (classic:L3 và L4 đều 12 thẻ → hai dòng "Bàn 12 thẻ" khó hiểu); chế độ cũ (time/peek/survival) cũng gộp vào.
 * Độ khó = số thẻ (màn Chiến dịch có thêm luật nên ngang thẻ thì xếp trên), cùng số thẻ thì màn cao hơn trên.
 */
interface DongKyLuc { k: string; loai: 'campaign' | 'classic'; ten: string; cap: number; cells: number; nac: number; score: number; moves: number; seconds: number }
const nacKho = (cells: number): number => (cells <= 8 ? 1 : cells <= 16 ? 2 : cells <= 30 ? 3 : 4);
const kyLuc = computed<DongKyLuc[]>(() => {
  const m = me.value;
  if (!m) return [];
  const ban = new Map<number, DongKyLuc>();
  const ra: DongKyLuc[] = [];
  for (const [k, r] of Object.entries(m.best)) {
    const mm = /^([a-z]+):L(\d+)$/.exec(k);
    if (!mm) continue;
    const cap = Number(mm[2]);
    if (mm[1] === 'campaign') {
      if (cap < 1 || cap > CAMPAIGN_LEVELS) continue;
      const cells = campaignSpec(cap).pairs * 2;
      ra.push({ k, loai: 'campaign', ten: t('tk.man', { n: cap }), cap, cells, nac: nacKho(cells), ...r });
      continue;
    }
    if (cap < 1 || cap > LEVEL_KEYS) continue;
    const sz = sizeForLevel(cap);
    const cells = sz.cols * sz.rows;
    const cu = ban.get(cells);
    if (!cu || r.score > cu.score) ban.set(cells, { k, loai: 'classic', ten: t('tk.kyLucBan', { n: cells }), cap, cells, nac: nacKho(cells), ...r });
  }
  return [...ra, ...ban.values()].sort((a, b) =>
    b.cells - a.cells || (a.loai === b.loai ? b.cap - a.cap : a.loai === 'campaign' ? -1 : 1));
});
function pha(r: DongKyLuc): void { emit('pha-ky-luc', { mode: r.loai, cap: r.cap, cells: r.cells }); }

/** Danh hiệu đã có: của tài khoản nếu đăng nhập, không thì của máy này. */
/** Đếm theo sổ của MÁY: đăng nhập là đã kéo danh hiệu tài khoản về máy (dongBo). */
const soDaCo = computed(() => dsHien.value.filter((a) => daCoRef.value.includes(a.id)).length);
const diemMay = store.totalScore();
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" :aria-label="t('tk.taiKhoan')" @keydown.esc="emit('close')">
    <div class="panel">
      <header class="head">
        <h2>{{ t('tk.taiKhoan') }}</h2>
        <button ref="closeBtn" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>

      <div class="body">
        <!-- Chưa đăng nhập -->
        <div v-if="!me" class="chua">
          <!-- MỘT DÒNG (chủ dự án 09.11.2026: đoạn giải thích 3 dòng "đau mắt quá") -->
          <p class="lead">{{ t('tk.loiIchNgan') }}</p>
          <div v-if="coGoogle" ref="nutGoogle" class="nut-google" data-nosfx />
          <!-- HAI NÚT NGANG NHAU, cùng cỡ (mockup duyệt 09.11.2026, https://claude.ai/artifact/TdQgni59VuVT5CLHuGfKsE):
               chữ chỉ còn tên hãng — câu "Đăng nhập…" đã nằm ở dòng trên. Apple bắt nút Apple không
               nhỏ hơn nút đăng nhập khác: chia đôi bằng nhau là đạt. -->
          <div v-if="coGoogleApp || coApple" class="hang-nut">
            <!-- App ≥ 1.5.0: nút Google NATIVE (nút GIS của web bị Google chặn trong WebView).
                 Kiểu nút theo hướng dẫn thương hiệu Google: nền trắng, viền xám, chữ G 4 màu. -->
            <button v-if="coGoogleApp" class="nut-google-app thach" type="button" :aria-label="t('tk.google')" :disabled="dangTai" @click="googleApp">
              <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>
              Google
            </button>
            <button v-if="coApple" class="nut-apple thach" type="button" :aria-label="t('tk.apple')" :disabled="dangTai" @click="apple">
              <svg viewBox="0 0 814 1000" width="16" height="20" aria-hidden="true"><path fill="currentColor" d="M788 341c-6 4-108 62-108 190 0 149 131 201 135 203-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-57-156-127C45 792 0 667 0 548c0-191 124-292 247-292 65 0 119 43 160 43 39 0 100-45 174-45 28 0 129 3 207 87zM556 160c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 33-146 75-28 32-55 83-55 135 0 8 1 16 2 18 3 1 9 1 14 1 45 0 102-30 134-70z"/></svg>
              Apple
            </button>
          </div>
          <p v-if="dangTai" class="muted">{{ t('tk.dangDangNhap') }}</p>
          <p v-if="loi" class="loi" role="alert">{{ loi }}</p>
          <button class="btn-link" type="button" @click="moBxh">{{ t('tk.xemBxh') }}</button>
<button class="nut-dh thach th-vang" type="button" @click="emit('danh-hieu')">
            <Medal :size="18" :stroke-width="2.4" aria-hidden="true" /> <b>{{ t('dhd.danhHieu') }}</b> <span>{{ soDaCo }}/{{ dsHien.length }}</span> <i aria-hidden="true">›</i>
          </button>
        </div>

        <!-- Đã đăng nhập -->
        <template v-else>
          <!-- MOCKUP DUYỆT 22.11.2026 (https://claude.ai/artifact/KzuWVG5QwHxQ13Hi7AUN3C): thẻ hồ sơ vàng ấm · hai ô Xếp hạng /
               Danh hiệu · vòng tỉ lệ thắng + 4 số · kỷ lục khó trên dễ dưới, mỗi dòng có nút "Phá" -->
          <div class="hoso">
            <!-- HỒ SƠ (25.11.2026, chủ dự án: "tên hiển thị dùng tên Kiên béo thay vì tên Google"): avatar + tên hồ sơ -->
            <span v-if="hoSo.xong" class="avatar chu hs" :style="{ '--m': hoSo.mau }">{{ hoSo.mat }}</span>
            <img v-else-if="me.avatar" class="avatar" :src="me.avatar" alt="" referrerpolicy="no-referrer">
            <span v-else class="avatar chu">{{ me.name.slice(0, 1) }}</span>
            <div class="ten-khoi">
              <b class="ten">{{ tenToi || me.name }}</b>
              <span class="xu-tong"><i class="xu" aria-hidden="true" />{{ num(me.totalScore) }}</span>
              <small>{{ t('tk.diemNgan') }}</small>
            </div>
            <button class="nut-ra thach th-nho" type="button" :aria-label="t('tk.dangXuat')" :title="t('tk.dangXuat')" @click="dangXuat(); emit('close')">
              <LogOut :size="16" />
            </button>
          </div>

          <div class="oi">
            <button class="o thach" type="button" @click="moBxh">
              <span class="o-ic vang" aria-hidden="true"><Trophy :size="17" :stroke-width="2.4" /></span>
              <b>{{ t('tk.xepHang') }}</b>
              <span class="o-phu">{{ t('bxh.tuanNay') }}<em v-if="hangXu"> #{{ num(hangXu) }}</em></span>
              <i class="o-mui" aria-hidden="true">›</i>
            </button>
            <button class="o thach" type="button" @click="emit('danh-hieu')">
              <span class="o-ic tim" aria-hidden="true"><Medal :size="17" :stroke-width="2.4" /></span>
              <b>{{ t('dhd.danhHieu') }}</b>
              <span class="o-phu"><em>{{ soDaCo }}</em>/{{ dsHien.length }}</span>
              <span class="o-vach" aria-hidden="true"><i :style="{ width: `${dsHien.length ? (soDaCo / dsHien.length) * 100 : 0}%` }" /></span>
              <i class="o-mui" aria-hidden="true">›</i>
            </button>
          </div>

          <div class="so-khoi">
            <div class="vong" :style="{ '--p': `${tiLeThang}%` }" role="img" :aria-label="`${t('tk.tiLe')} ${tiLeThang}%`">
              <span><b>{{ tiLeThang }}%</b><small>{{ t('tk.thang') }}</small></span>
            </div>
            <dl class="so">
              <div><dt>{{ t('tk.van') }}</dt><dd>{{ num(me.matches) }}</dd></div>
              <div><dt>{{ t('tk.thang') }}</dt><dd>{{ num(me.wins) }}</dd></div>
              <div><dt>{{ t('tk.thua') }}</dt><dd>{{ num(me.losses) }}</dd></div>
              <div><dt>{{ t('tk.hoa') }}</dt><dd>{{ num(me.draws) }}</dd></div>
            </dl>
          </div>

          <div class="kl-dau"><h3>{{ t('tk.kyLuc') }}</h3><small v-if="kyLuc.length > 1">{{ t('tk.khoTren') }}</small></div>
          <ul v-if="kyLuc.length" class="ky-luc">
            <li v-for="r in kyLuc" :key="r.k">
              <span class="kl-do" aria-hidden="true">
                <span class="kl-ic" :class="r.loai === 'campaign' ? 'la-cd' : 'la-ban'"><BanDo v-if="r.loai === 'campaign'" :size="14" :stroke-width="2.4" /><LayoutGrid v-else :size="14" :stroke-width="2.4" /></span>
                <span class="kl-nac"><i v-for="n in 4" :key="n" :class="{ on: n <= r.nac }" /></span>
              </span>
              <span class="kl-chu">
                <b>{{ r.loai === 'campaign' ? t('tk.kyLucChienDich', { n: r.cap }) : r.ten }}</b>
                <small>{{ t('tk.luotGiay', { luot: r.moves, giay: r.seconds }) }}</small>
              </span>
              <span class="kl-diem">{{ num(r.score) }}</span>
              <button class="kl-pha thach th-nho th-xanh" type="button" :aria-label="t('tk.phaAria', { ten: r.loai === 'campaign' ? t('tk.kyLucChienDich', { n: r.cap }) : r.ten })" @click="pha(r)">
                <Play :size="12" :stroke-width="0" fill="currentColor" aria-hidden="true" />{{ t('tk.pha') }}
              </button>
            </li>
          </ul>
          <p v-else class="muted">{{ t('tk.chuaKyLuc') }}</p>

            <div class="xoa">
              <button v-if="!hoiXoa" class="btn-link do" type="button" @click="hoiXoa = true">{{ t('tk.xoaTk') }}</button>
              <template v-else>
                <p>{{ t('tk.xoaHoi') }}</p>
                <div class="xoa-nut">
                  <button class="btn" type="button" @click="hoiXoa = false">{{ t('tk.huy') }}</button>
                  <button class="btn nguy" type="button" :disabled="dangXoa" @click="xoa">{{ t('tk.xoaChac') }}</button>
                </div>
              </template>
              <p v-if="loiXoa" class="loi" role="alert">{{ loiXoa }}</p>
            </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; padding: 12px;
  background: rgba(12, 14, 28, .45);
  backdrop-filter: blur(4px);
  /* Lớp phủ fixed nằm NGOÀI đệm vùng an toàn của #app: tự cộng env() (iPhone: tai thỏ,
     Dynamic Island, dải home) — không thì nút ✕ chui dưới đồng hồ/pin, khó bấm. */
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
.panel {
  width: 100%; max-width: var(--col-w); max-height: 100%;   /* = cao lớp phủ trừ đệm (đã gồm vùng an toàn) */
  display: flex; flex-direction: column; min-height: 0;
  padding: 16px; border-radius: 16px;
  background: var(--panel-solid); border: 1px solid var(--line);
  box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
}
.head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.head h2 { flex: 1; margin: 0; font-size: var(--text-xl); }
/* Đệm dưới 8px: nút thạch cuối (Danh hiệu) có gờ 4px + bóng NẰM NGOÀI hộp nút — `.body` cuộn
   (overflow) cắt sát mép thì gờ bị xén (chủ dự án thấy 09.11.2026). Đệm hai bên cho bóng ngang. */
.body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 2px 4px 10px; margin: 0 -4px; }
.lead { margin: 0 0 14px; font-size: var(--text-md); line-height: 1.5; }
.muted { color: var(--muted); font-size: var(--text-sm); margin: 6px 0 0; }
.loi { color: var(--bad); font-size: var(--text-sm); margin: 8px 0 0; }
.chua { display: flex; flex-direction: column; align-items: center; text-align: center; }
.chua :deep(.danh-hieu) { width: 100%; text-align: left; margin-top: 10px; }
.nut-google { min-height: 44px; display: flex; justify-content: center; }
/* Theo HIG của Apple: nền đen, logo + "Sign in with Apple", bo tròn như nút Google bên trên */
.nut-apple {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 280px; max-width: 100%; min-height: 44px; margin-top: 10px; padding: 0 16px;
  border: 0; border-radius: 999px; background: #000; color: #fff;
  font: inherit; font-size: 16px; font-weight: 600; cursor: pointer;
}
.nut-apple:disabled { opacity: .6; }
/* KIỂU THẠCH (mockup duyệt 09.11.2026): skin Kẹo tô nút `.thach` bằng bộ biến --b1..--b4/--bc
   (gradient + gờ dưới, !important). Google = thạch trắng mặc định; Apple = thạch ĐEN — giữ màu
   nhận diện đen/trắng của hai hãng, chỉ thêm khối nổi của game. */
.nut-apple.thach { --b1: #4b4b52; --b2: #16161a; --b3: #000; --b4: #000; --bc: #fff; }
.hang-nut { display: flex; gap: 10px; width: 100%; max-width: 320px; margin-top: 2px; }
.hang-nut > button { flex: 1 1 0; min-width: 0; width: auto; margin-top: 0; }
.nut-google-app {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  width: 280px; max-width: 100%; min-height: 44px; padding: 0 16px;
  border: 1px solid #747775; border-radius: 999px; background: #fff; color: #1f1f1f;
  font: inherit; font-size: 16px; font-weight: 600; cursor: pointer;
}
.nut-google-app:disabled { opacity: .6; }
.xoa { margin-top: 18px; padding-top: 10px; border-top: 1px solid var(--line); text-align: center; }
.xoa p { margin: 0 0 10px; font-size: var(--text-sm); line-height: 1.5; }
.btn-link.do { color: var(--bad); margin-top: 0; }
.xoa-nut { display: flex; gap: 8px; justify-content: center; }
.btn.nguy { background: var(--bad); color: #fff; border-color: transparent; }
.btn-link {
  margin-top: 14px; border: 0; background: none; color: var(--accent);
  font: inherit; font-weight: 700; text-decoration: underline; min-height: 44px; cursor: pointer;
}

/* ---------- ĐÃ ĐĂNG NHẬP (mockup duyệt 22.11.2026) ---------- */
.panel { --hs1: #fff4d6; --hs2: #ffe7a8; --hs-vien: #f0c64a; --diem: #b97800; --vong-nen: color-mix(in srgb, var(--fg) 10%, transparent); --vong-on: #2fb36a;
  --kl-cd-chu: #6a4bd8; --kl-cd-nen: #efeaff; --kl-ban-chu: #1d7fd6; --kl-ban-nen: #e6f3ff; --kl-nac: color-mix(in srgb, var(--fg) 14%, transparent); --kl-nac-on: #f0a020; }
:global([data-theme='dark'] .panel) { --hs1: #3a2f12; --hs2: #2a2412; --hs-vien: #8f7124; --diem: #ffcf4d; --vong-on: #3ccf75;
  --kl-cd-chu: #b9a8ff; --kl-cd-nen: #2d2660; --kl-ban-chu: #7cc2ff; --kl-ban-nen: #1c3354; }
.hoso { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 18px; background: linear-gradient(135deg, var(--hs1), var(--hs2)); border: 1.5px solid var(--hs-vien); }
.avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex: 0 0 56px; box-shadow: 0 0 0 3px #ffd45c; }
.avatar.chu {
  display: inline-flex; align-items: center; justify-content: center; font: 800 24px var(--font-display);
  background: linear-gradient(135deg, #7b6bff, #4a3bd0); color: #fff;
}
.ten-khoi { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ten { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 800 17px/1.2 var(--font-display); }
.xu-tong { display: inline-flex; align-items: center; gap: 5px; font: 800 15px var(--font-display); color: var(--diem); font-variant-numeric: tabular-nums; }
.xu { width: 14px; height: 14px; border-radius: 50%; flex: none; background: radial-gradient(circle at 35% 30%, #ffe58a, #f2b400 60%, #c98a00); }
.ten-khoi small { font-size: 11.5px; font-weight: 700; color: var(--muted); }
.nut-ra { width: 34px; height: 34px; min-height: 34px; padding: 0; display: grid; place-items: center; flex: none; color: var(--muted); }

.oi { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.o { position: relative; display: grid; gap: 2px; justify-items: start; align-content: start; padding: 10px 12px 12px; border-radius: 16px; text-align: left; font: inherit; cursor: pointer; min-width: 0; }
.o-ic { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; margin-bottom: 2px; }
.o-ic.vang { background: #fff1c7; color: #b77800; }
.o-ic.tim { background: #efe7ff; color: #6a4bd8; }
:global([data-theme='dark'] .o-ic.vang) { background: #4a3a10; color: #ffcf4d; }
:global([data-theme='dark'] .o-ic.tim) { background: #2d2660; color: #b9a8ff; }
.o b { font: 800 14px var(--font-display); }
.o-phu { font-weight: 800; font-size: 13px; color: var(--muted); }
.o-phu em { font-style: normal; color: var(--fg); font: 800 15px var(--font-display); }
.o-vach { width: 100%; height: 5px; border-radius: 5px; background: var(--vong-nen); overflow: hidden; margin-top: 3px; }
.o-vach i { display: block; height: 100%; border-radius: 5px; background: linear-gradient(90deg, #a98bff, #6a4bd8); }
.o-mui { position: absolute; right: 12px; top: 12px; font-style: normal; font-weight: 800; color: var(--muted); }

.so-khoi { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 10px 12px; border-radius: 16px; background: color-mix(in srgb, var(--fg) 5%, transparent); }
.vong { width: 64px; height: 64px; flex: none; border-radius: 50%; display: grid; place-items: center;
  background: conic-gradient(var(--vong-on) 0 var(--p), var(--vong-nen) var(--p) 100%); }
.vong span { width: 50px; height: 50px; border-radius: 50%; background: var(--panel-solid); display: grid; place-content: center; text-align: center; line-height: 1; }
.vong b { font: 800 16px var(--font-display); }
.vong small { font-size: 9px; font-weight: 800; color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
.so { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin: 0; text-align: center; }
.so dt { font-size: 10.5px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.so dd { margin: 2px 0 0; font: 800 18px var(--font-display); font-variant-numeric: tabular-nums; }

.kl-dau { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 16px 0 6px; }
.kl-dau h3 { margin: 0; font: 800 15px var(--font-display); text-transform: none; letter-spacing: 0; color: var(--fg); }
.kl-dau small { font-size: 11.5px; font-weight: 700; color: var(--muted); }
.ky-luc { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.ky-luc li { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 10px; border-radius: 14px; background: color-mix(in srgb, var(--fg) 5%, transparent); }
.kl-do { flex: none; display: grid; gap: 3px; justify-items: center; }
.kl-ic { width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center; }
.kl-ic.la-cd { background: var(--kl-cd-nen); color: var(--kl-cd-chu); }
.kl-ic.la-ban { background: var(--kl-ban-nen); color: var(--kl-ban-chu); }
.kl-nac { display: flex; gap: 1.5px; align-items: flex-end; height: 10px; }
.kl-nac i { width: 3.5px; border-radius: 2px; background: var(--kl-nac); }
.kl-nac i:nth-child(1) { height: 4px; } .kl-nac i:nth-child(2) { height: 6px; } .kl-nac i:nth-child(3) { height: 8px; } .kl-nac i:nth-child(4) { height: 10px; }
.kl-nac i.on { background: var(--kl-nac-on); }
.kl-chu { flex: 1; min-width: 0; display: grid; }
.kl-chu b { font: 800 14px/1.2 var(--font-display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kl-chu small { font-size: 11.5px; font-weight: 700; color: var(--muted); }
.kl-diem { font: 800 16px var(--font-display); color: var(--diem); font-variant-numeric: tabular-nums; }
.kl-pha { flex: none; display: inline-flex; align-items: center; gap: 4px; min-height: 32px; height: 32px; padding: 0 10px 0 8px; border-radius: 11px; font: 800 12px var(--font-body); white-space: nowrap; position: relative; }
.kl-pha::after { content: ''; position: absolute; inset: -6px -4px; }

.nut-dh {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 48px; margin-top: 12px;
  padding: 0 14px; border-radius: 12px; border: 0; cursor: pointer; font: inherit; color: #4a2f00;
  background: linear-gradient(135deg, #ffd76a, #f0a500); text-align: left;
}
.nut-dh b { flex: 1; }
.nut-dh span { font-weight: 800; font-variant-numeric: tabular-nums; }
.nut-dh i { font-style: normal; font-size: 22px; line-height: 1; }
.avatar.chu.hs { font-size: 34px; border-radius: 16px; background: var(--m); }
</style>
