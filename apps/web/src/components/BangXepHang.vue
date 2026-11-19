<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { t } from '@/lib/i18n';
import { num } from '@/lib/format';
import { store } from '@/lib/storage';
import { anKhach, bangXepHang, datTenKhach, me, type BangXh, type DongBxh } from '@/lib/taikhoan';
import MatBot from './MatBot.vue';

/**
 * BẢNG XẾP HẠNG (19.11.2026, mockup duyệt https://claude.ai/artifact/CYPTEG9edvmDEgEGFuEnzy):
 * mở từ viên đồng xu trên thanh trên cùng (và từ màn Tài khoản). Cả người CHƯA đăng nhập cũng
 * lên bảng chung (tên trong game + mặt thú) và luôn biết hạng mình: thẻ vàng đầu bảng "#137
 * trong 2.431 người chơi" + còn bao nhiêu điểm để vượt người ngay trên. Ngoài top 20 thì dòng
 * của mình ghim ở đáy kèm người ngay trên/dưới.
 *
 * Khách: ô đặt tên (chưa có tên thì mở sẵn), lời mời đăng nhập để giữ điểm, và "Ẩn tôi khỏi
 * bảng" — chính sách quyền riêng tư hứa nút này (pv.s2d).
 */
const emit = defineEmits<{ close: []; 'dang-nhap': [] }>();
const closeBtn = ref<HTMLButtonElement | null>(null);
const bang = ref<BangXh | null>(null);
const loi = ref(false);

const laKhach = computed(() => !me.value);
const khachAn = ref(!!store.khach(false)?.an);
const tenMay = ref(store.playerNames()[0] ?? '');
const dangSuaTen = ref(false);
const tenNhap = ref(tenMay.value);
const dangLuu = ref(false);

async function tai(): Promise<void> {
  loi.value = false;
  try { bang.value = await bangXepHang(); } catch { loi.value = true; }
}
onMounted(() => { closeBtn.value?.focus(); void tai(); });

const ten = (d: DongBxh): string => d.name || (d.khach ? t('bxh.khach', { so: d.khach }) : '?');
const toi = computed(() => bang.value?.toi ?? null);
/** Ngoài top hiển thị → ghim dòng mình ở đáy. */
const ghim = computed(() => !!toi.value && !(bang.value?.top ?? []).some((d) => d.toi));
const conDiem = computed(() => {
  const m = toi.value;
  if (!m?.tren) return null;
  return { n: num(Math.max(1, m.tren.totalScore - m.totalScore + 1)), ten: ten(m.tren), hang: m.tren.hang };
});
/** Mở sẵn ô đặt tên khi khách chưa có tên và đã có dòng trên bảng. */
const moTen = computed(() => laKhach.value && !khachAn.value && !!toi.value && (dangSuaTen.value || !tenMay.value));

async function luuTen(): Promise<void> {
  const tt = tenNhap.value.trim();
  if (!tt) return;
  dangLuu.value = true;
  try { await datTenKhach(tt); tenMay.value = tt; dangSuaTen.value = false; await tai(); } finally { dangLuu.value = false; }
}

async function doiAn(an: boolean): Promise<void> {
  try { await anKhach(an); khachAn.value = an; await tai(); } catch { loi.value = true; }
}
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" :aria-label="t('tk.xepHang')" @keydown.esc="emit('close')">
    <div class="panel">
      <header class="head">
        <h2>{{ t('tk.xepHang') }}</h2>
        <button ref="closeBtn" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>

      <div v-if="toi" class="hang-toi">
        <span class="so">#{{ num(toi.hang) }}</span>
        <span class="chu">
          {{ t('bxh.hangCua', { tong: num(toi.tong) }) }}<br>
          <template v-if="!toi.matches">{{ t('bxh.chuaChoi') }}</template>
          <template v-else-if="conDiem">{{ t('bxh.conDiem', conDiem) }}</template>
          <template v-else>{{ t('bxh.dauBang') }}</template>
        </span>
      </div>

      <div class="body">
        <ol v-if="bang" class="bxh">
          <li v-for="(d, i) in bang.top" :key="i" :class="{ toi: d.toi }">
            <span class="hang" :class="['vang', 'bac', 'dong'][i]">{{ i + 1 }}</span>
            <span class="mat"><MatBot :mat="d.mat ?? '🙂'" /></span>
            <span class="ten">{{ ten(d) }}<i v-if="d.toi" class="nhan-ban">{{ t('bxh.ban') }}</i></span>
            <small v-if="d.matches >= d.wins && d.matches">{{ t('tk.thangTren', { thang: d.wins, van: d.matches }) }}</small>
            <b>{{ num(d.totalScore) }}</b>
          </li>
          <li v-if="!bang.top.length" class="muted">{{ t('tk.chuaAiMoi') }}</li>
        </ol>
        <p v-else-if="loi" class="loi">{{ t('tk.loiBxh') }} <button class="btn-link" type="button" @click="tai">{{ t('bxh.thuLai') }}</button></p>
        <p v-else class="muted">{{ t('tk.dangTai') }}</p>
      </div>

      <div v-if="toi && ghim" class="ghim">
        <div v-if="toi.tren" class="ke"><span class="hang">{{ num(toi.tren.hang) }}</span><span class="ten"><MatBot :mat="toi.tren.mat ?? '🙂'" /> {{ ten(toi.tren) }}</span><b>{{ num(toi.tren.totalScore) }}</b></div>
        <div class="toi-dong"><span class="hang">{{ num(toi.hang) }}</span><span class="mat"><MatBot :mat="toi.mat ?? '🙂'" /></span><span class="ten">{{ ten(toi) }}<i class="nhan-ban">{{ t('bxh.ban') }}</i></span><b>{{ num(toi.totalScore) }}</b></div>
        <div v-if="toi.duoi" class="ke"><span class="hang">{{ num(toi.duoi.hang) }}</span><span class="ten"><MatBot :mat="toi.duoi.mat ?? '🙂'" /> {{ ten(toi.duoi) }}</span><b>{{ num(toi.duoi.totalScore) }}</b></div>
      </div>

      <!-- Khách: tên trên bảng -->
      <form v-if="moTen" class="dat-ten" @submit.prevent="luuTen">
        <label for="ten-bxh">{{ tenMay ? t('bxh.tenTren') : t('bxh.tenTrenKhach', { ten: toi ? ten(toi) : '' }) }}</label>
        <div class="hang-nhap">
          <input id="ten-bxh" v-model="tenNhap" maxlength="16" autocomplete="nickname" enterkeyhint="done">
          <button class="luu thach th-xanh" type="submit" :disabled="dangLuu || !tenNhap.trim()">{{ t('bxh.luu') }}</button>
        </div>
        <p>{{ t('bxh.goiYTen') }}</p>
      </form>

      <div v-if="laKhach" class="khach">
        <template v-if="khachAn">
          <p>{{ t('bxh.daAn') }}</p>
          <button class="btn-link" type="button" @click="doiAn(false)">{{ t('bxh.hienLai') }}</button>
        </template>
        <template v-else>
          <p>{{ t('bxh.moiDangNhap') }}</p>
          <button class="nut-dn thach th-vang" type="button" @click="emit('dang-nhap')">{{ t('bxh.dangNhap') }}</button>
          <div class="phu">
            <button v-if="toi && tenMay && !dangSuaTen" class="btn-link" type="button" @click="dangSuaTen = true; tenNhap = tenMay">{{ t('bxh.doiTen') }}</button>
            <button v-if="toi" class="btn-link mo" type="button" @click="doiAn(true)">{{ t('bxh.an') }}</button>
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
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
.panel {
  width: 100%; max-width: var(--col-w); max-height: 100%;
  display: flex; flex-direction: column; min-height: 0;
  padding: 16px; border-radius: 16px;
  background: var(--panel-solid); border: 1px solid var(--line);
  box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
}
.head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.head h2 { flex: 1; margin: 0; font-size: var(--text-xl); }
.body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 2px 4px 6px; margin: 0 -4px; }
.muted { color: var(--muted); font-size: var(--text-sm); margin: 6px 0 0; }
.loi { color: var(--bad); font-size: var(--text-sm); margin: 8px 0 0; }

/* Thẻ vàng "hạng của bạn" — luôn đứng yên trên đầu, không cuộn theo danh sách */
.hang-toi {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 10px 12px;
  border-radius: 14px; border: 2px solid #f0c64a; background: linear-gradient(#fff4dc, #ffe7b3);
  box-shadow: 0 3px 0 #e2b13a; color: #3d2f08;
}
.hang-toi .so { font-size: 26px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.hang-toi .chu { flex: 1; min-width: 0; font-size: var(--text-sm); font-weight: 700; line-height: 1.35; color: #5b4510; }

.bxh { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.bxh li, .toi-dong {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px;
  background: color-mix(in srgb, var(--fg) 5%, transparent);
}
.bxh li.toi, .toi-dong { background: #ffe7b3; color: #3d2f08; box-shadow: inset 0 0 0 2px #f0c64a; }
.bxh li.toi small { color: #5b4510; }
.hang { width: 30px; flex: 0 0 30px; text-align: center; font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums; }
.bxh li.toi .hang, .toi-dong .hang { color: #5b4510; }
.hang.vang { color: #c98a00; } .hang.bac { color: #8a96b3; } .hang.dong { color: #b0662c; }
.mat { font-size: 19px; line-height: 1; flex: 0 0 auto; }
.ten { flex: 1; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bxh small { color: var(--muted); font-size: 12px; white-space: nowrap; }
.bxh b, .ghim b { font-variant-numeric: tabular-nums; }
.nhan-ban {
  font-style: normal; font-size: 11px; font-weight: 800; color: #fff; background: #c2621a;
  border-radius: 8px; padding: 1px 6px; margin-left: 6px; vertical-align: 1px;
}

.ghim { border-top: 2px dashed var(--line); margin-top: 6px; padding-top: 8px; display: grid; gap: 4px; }
.ke { display: flex; align-items: center; gap: 8px; padding: 0 8px; font-size: var(--text-sm); color: var(--muted); }
.ke .ten { font-weight: 600; }

.dat-ten { margin-top: 10px; display: grid; gap: 6px; }
.dat-ten label { font-size: var(--text-sm); font-weight: 800; }
.hang-nhap { display: flex; gap: 8px; }
.hang-nhap input {
  flex: 1; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 0 12px;
  border-radius: 10px; border: 2px solid #e2b13a; font: inherit; font-weight: 700; font-size: 16px;
  background: var(--panel-solid); color: var(--fg);
}
.luu { min-height: 44px; padding: 0 16px; font-weight: 800; }
.dat-ten p, .khach p { margin: 0; font-size: var(--text-sm); color: var(--muted); line-height: 1.45; }

.khach { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); display: grid; gap: 8px; text-align: center; }
.nut-dn { min-height: 44px; font-weight: 800; }
.phu { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
.btn-link {
  border: 0; background: none; color: var(--accent); padding: 0;
  font: inherit; font-weight: 700; text-decoration: underline; min-height: 44px; cursor: pointer;
}
.btn-link.mo { color: var(--muted); }
</style>
