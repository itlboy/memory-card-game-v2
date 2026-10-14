<script setup lang="ts">
import { t } from '@/lib/i18n';
import { sizeForLevel } from '@mm/engine';
import { LogOut, X } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { dsHien, daCo as daCoRef } from '@/lib/achievements';
import { num, numShort } from '@/lib/format';
import { store } from '@/lib/storage';
import { bangXepHang, coApple, coGoogle, dangNhapApple, dangTai, dangXuat, me, veNutGoogle, xoaTaiKhoan, type DongBxh } from '@/lib/taikhoan';

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
const emit = defineEmits<{ close: []; 'danh-hieu': [] }>();
const closeBtn = ref<HTMLButtonElement | null>(null);
const nutGoogle = ref<HTMLElement | null>(null);
const loi = ref('');
const tab = ref<'hoso' | 'bxh'>('hoso');
const bxh = ref<DongBxh[] | null>(null);
const loiBxh = ref('');

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

async function moBxh(): Promise<void> {
  tab.value = 'bxh';
  if (bxh.value) return;
  try { bxh.value = await bangXepHang(); } catch { loiBxh.value = t('tk.loiBxh'); }
}

const tiLeThang = computed(() => {
  const m = me.value;
  return m && m.matches ? Math.round((m.wins / m.matches) * 100) : 0;
});

/** Kỷ lục, đọc tên cỡ bàn từ khoá `mode:L<cấp>`. */
const kyLuc = computed(() => {
  const m = me.value;
  if (!m) return [];
  return Object.entries(m.best)
    .map(([k, r]) => {
      const mm = /^([a-z]+):L(\d+)$/.exec(k);
      const cap = mm ? Number(mm[2]) : 0;
      const sz = cap ? sizeForLevel(cap) : null;
      const ten = mm?.[1] === 'campaign' ? t('tk.kyLucChienDich', { n: cap }) : sz ? t('tk.kyLucBan', { n: sz.cols * sz.rows }) : k;
      return { k, ten, cap, ...r };
    })
    .sort((a, b) => a.cap - b.cap);
});

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
          <!-- Nói bằng SỐ THẬT của máy này: "giữ 12 danh hiệu, 536k điểm" kéo người
               ta bấm hơn hẳn một câu chung chung về đồng bộ. -->
          <p class="lead">
            <template v-if="soDaCo || diemMay">
              {{ t('tk.loiIchSo1') }}<b>{{ t('tk.loiIchDanhHieu', { n: soDaCo }) }}</b>{{ t('tk.loiIchVa') }}<b>{{ t('tk.loiIchDiem', { n: numShort(diemMay) }) }}</b>{{ t('tk.loiIchSo2') }}
            </template>
            <template v-else>
              {{ t('tk.loiIchChung') }}
            </template>
            {{ t('tk.vanChoi') }}
          </p>
          <div v-if="coGoogle" ref="nutGoogle" class="nut-google" data-nosfx />
          <button v-if="coApple" class="nut-apple" type="button" :disabled="dangTai" @click="apple">
            <svg viewBox="0 0 814 1000" width="16" height="20" aria-hidden="true"><path fill="currentColor" d="M788 341c-6 4-108 62-108 190 0 149 131 201 135 203-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-57-156-127C45 792 0 667 0 548c0-191 124-292 247-292 65 0 119 43 160 43 39 0 100-45 174-45 28 0 129 3 207 87zM556 160c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 33-146 75-28 32-55 83-55 135 0 8 1 16 2 18 3 1 9 1 14 1 45 0 102-30 134-70z"/></svg>
            {{ t('tk.apple') }}
          </button>
          <p v-if="dangTai" class="muted">{{ t('tk.dangDangNhap') }}</p>
          <p v-if="loi" class="loi" role="alert">{{ loi }}</p>
          <button class="btn-link" type="button" @click="moBxh">{{ t('tk.xemBxh') }}</button>
<button class="nut-dh" type="button" @click="emit('danh-hieu')">
            🏅 <b>{{ t('dhd.danhHieu') }}</b> <span>{{ soDaCo }}/{{ dsHien.length }}</span> <i aria-hidden="true">›</i>
          </button>
          <ol v-if="tab === 'bxh' && bxh" class="bxh">
            <li v-for="(d, i) in bxh" :key="d.id">
              <span class="hang">{{ i + 1 }}</span>
              <img v-if="d.avatar" :src="d.avatar" alt="" referrerpolicy="no-referrer">
              <span class="ten">{{ d.name }}</span>
              <b>{{ num(d.totalScore) }}</b>
            </li>
            <li v-if="!bxh.length" class="muted">{{ t('tk.chuaAi') }}</li>
          </ol>
          <p v-if="loiBxh" class="loi">{{ loiBxh }}</p>
        </div>

        <!-- Đã đăng nhập -->
        <template v-else>
          <div class="hoso">
            <img v-if="me.avatar" class="avatar" :src="me.avatar" alt="" referrerpolicy="no-referrer">
            <span v-else class="avatar chu">{{ me.name.slice(0, 1) }}</span>
            <div class="ten-khoi">
              <b class="ten">{{ me.name }}</b>
              <span class="muted">{{ t('tk.diemTichLuy', { n: num(me.totalScore) }) }}</span>
            </div>
            <button class="btn" type="button" :aria-label="t('tk.dangXuat')" :title="t('tk.dangXuat')" @click="dangXuat(); emit('close')">
              <LogOut :size="18" />
            </button>
          </div>

          <div class="tabs" role="tablist">
            <button class="tab" role="tab" type="button" :aria-selected="tab === 'hoso'" @click="tab = 'hoso'">{{ t('tk.hoSo') }}</button>
            <button class="tab" role="tab" type="button" :aria-selected="tab === 'bxh'" @click="moBxh">{{ t('tk.xepHang') }}</button>
          </div>

          <template v-if="tab === 'hoso'">
            <dl class="so">
              <div><dt>{{ t('tk.van') }}</dt><dd>{{ num(me.matches) }}</dd></div>
              <div><dt>{{ t('tk.thang') }}</dt><dd>{{ num(me.wins) }}</dd></div>
              <div><dt>{{ t('tk.thua') }}</dt><dd>{{ num(me.losses) }}</dd></div>
              <div><dt>{{ t('tk.hoa') }}</dt><dd>{{ num(me.draws) }}</dd></div>
              <div><dt>{{ t('tk.tiLe') }}</dt><dd>{{ tiLeThang }}%</dd></div>
            </dl>

            <button class="nut-dh" type="button" @click="emit('danh-hieu')">
            🏅 <b>{{ t('dhd.danhHieu') }}</b> <span>{{ soDaCo }}/{{ dsHien.length }}</span> <i aria-hidden="true">›</i>
          </button>

            <h3>{{ t('tk.kyLuc') }}</h3>
            <ul v-if="kyLuc.length" class="ky-luc">
              <li v-for="r in kyLuc" :key="r.k">
                <span>{{ r.ten }}</span>
                <b>{{ num(r.score) }}</b>
                <small>{{ t('tk.luotGiay', { luot: r.moves, giay: r.seconds }) }}</small>
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

          <template v-else>
            <ol v-if="bxh" class="bxh">
              <li v-for="(d, i) in bxh" :key="d.id" :class="{ toi: d.id === me.id }">
                <span class="hang">{{ i + 1 }}</span>
                <img v-if="d.avatar" :src="d.avatar" alt="" referrerpolicy="no-referrer">
                <span class="ten">{{ d.name }}</span>
                <small>{{ t('tk.thangTren', { thang: d.wins, van: d.matches }) }}</small>
                <b>{{ num(d.totalScore) }}</b>
              </li>
              <li v-if="!bxh.length" class="muted">{{ t('tk.chuaAiMoi') }}</li>
            </ol>
            <p v-else-if="loiBxh" class="loi">{{ loiBxh }}</p>
            <p v-else class="muted">{{ t('tk.dangTai') }}</p>
          </template>
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
.body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
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
.xoa { margin-top: 18px; padding-top: 10px; border-top: 1px solid var(--line); text-align: center; }
.xoa p { margin: 0 0 10px; font-size: var(--text-sm); line-height: 1.5; }
.btn-link.do { color: var(--bad); margin-top: 0; }
.xoa-nut { display: flex; gap: 8px; justify-content: center; }
.btn.nguy { background: var(--bad); color: #fff; border-color: transparent; }
.btn-link {
  margin-top: 14px; border: 0; background: none; color: var(--accent);
  font: inherit; font-weight: 700; text-decoration: underline; min-height: 44px; cursor: pointer;
}

.hoso { display: flex; align-items: center; gap: 10px; }
.avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex: 0 0 44px; }
.avatar.chu {
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--nhan-nen); color: var(--nhan-chu); font-weight: 800;
}
.ten-khoi { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ten { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ten-khoi .muted { margin: 0; }

.tabs { display: flex; gap: 6px; margin: 12px 0 10px; }
.tab {
  flex: 1; min-height: 40px; border-radius: 10px; border: 1px solid var(--line);
  background: transparent; color: var(--muted); font: inherit; font-weight: 700; cursor: pointer;
}
.tab[aria-selected='true'] {
  background: var(--nhan-nen); color: var(--nhan-chu); border-color: transparent;
}

.so { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 0; }
.so div { text-align: center; padding: 8px 2px; border-radius: 10px; background: color-mix(in srgb, var(--fg) 6%, transparent); }
.so dt { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.so dd { margin: 2px 0 0; font-weight: 800; font-variant-numeric: tabular-nums; }

h3 {
  margin: 14px 0 6px; font-size: var(--text-sm);
  text-transform: uppercase; letter-spacing: .08em; color: var(--muted);
}
h3 small { font-weight: 400; letter-spacing: 0; text-transform: none; }

.ky-luc, .bxh { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }

.ky-luc li { display: grid; grid-template-columns: 1fr auto; gap: 0 10px; padding: 6px 10px; border-radius: 10px;
  background: color-mix(in srgb, var(--fg) 5%, transparent); font-size: var(--text-sm); }
.ky-luc b { font-variant-numeric: tabular-nums; }
.ky-luc small { grid-column: 1 / -1; color: var(--muted); }

.bxh li { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px;
  background: color-mix(in srgb, var(--fg) 5%, transparent); font-size: var(--text-sm); }
.bxh li.toi { background: color-mix(in srgb, var(--accent) 18%, transparent); }
.bxh .hang { width: 22px; text-align: center; font-weight: 800; color: var(--muted); }
.bxh img { width: 26px; height: 26px; border-radius: 50%; }
.bxh .ten { flex: 1; min-width: 0; }
.bxh small { color: var(--muted); }
.bxh b { font-variant-numeric: tabular-nums; }
.nut-dh {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 48px; margin-top: 12px;
  padding: 0 14px; border-radius: 12px; border: 0; cursor: pointer; font: inherit; color: #4a2f00;
  background: linear-gradient(135deg, #ffd76a, #f0a500); text-align: left;
}
.nut-dh b { flex: 1; }
.nut-dh span { font-weight: 800; font-variant-numeric: tabular-nums; }
.nut-dh i { font-style: normal; font-size: 22px; line-height: 1; }
</style>
