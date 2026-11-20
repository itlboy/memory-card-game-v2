<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { t } from '@/lib/i18n';
import { num } from '@/lib/format';
import { store } from '@/lib/storage';
import { anKhach, bangXepHang, bxhLanTruoc, datTenKhach, me, type BangXh, type DongBxh, type LoaiBxh } from '@/lib/taikhoan';
import MatBot from './MatBot.vue';
import { ghiHang } from '@/lib/hang-xu';

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
/*
 * HAI TAB (20.11.2026, mockup duyệt https://claude.ai/artifact/WqxQ9L7SgMRzERfoqkCgxP — chủ dự án: "bảng xếp hạng tuần
 * để người chơi mới có động lực"): "Tuần" (mở mặc định) và "Mọi lúc". Tuần = thứ Hai 00:00 UTC; ‹ › xem các tuần cũ
 * (server giữ lịch sử). Hạng trên viên xu vẫn là hạng Mọi lúc — chỉ tab đó gọi ghiHang.
 */
const loai = ref<LoaiBxh>('tuan');
/** Thứ Hai của tuần cũ đang xem; undefined = tuần này. */
const tuanXem = ref<string | undefined>(undefined);
/** Hiện NGAY bảng lần trước (bxhLanTruoc) rồi thay bằng số mới — xem taikhoan.ts. */
const bang = ref<BangXh | null>(bxhLanTruoc('tuan'));
const loi = ref(false);
/** Đang hỏi số mới: bảng (lần trước) hiện MỜ cho tới khi số mới về — chủ dự án: "hiện bảng mờ là được". */
const dangTai = ref(false);

const laKhach = computed(() => !me.value);
const khachAn = ref(!!store.khach(false)?.an);
const tenMay = ref(store.playerNames()[0] ?? '');
const dangSuaTen = ref(false);
const tenNhap = ref(tenMay.value);
const dangLuu = ref(false);

let luot = 0;
async function tai(): Promise<void> {
  loi.value = false;
  // Đang có bảng cũ mà mất mạng: giữ bảng cũ, không báo lỗi đè lên
  dangTai.value = true;
  const l = loai.value, w = tuanXem.value, so = ++luot;
  try {
    const b = await bangXepHang(l, w);
    if (so !== luot) return;   // đã bấm sang tab / tuần khác — bỏ kết quả cũ
    bang.value = b;
    if (l === 'tat') ghiHang(b);
  } catch { if (so === luot && !bang.value) loi.value = true; } finally { if (so === luot) dangTai.value = false; }
}
function doiLoai(l: LoaiBxh): void {
  if (l === loai.value) return;
  loai.value = l; tuanXem.value = undefined;
  bang.value = bxhLanTruoc(l);
  void tai();
}
const NGAY = 86_400_000;
const congNgay = (d: string, n: number): string => new Date(Date.parse(`${d}T00:00:00Z`) + n * NGAY).toISOString().slice(0, 10);
/** Sang tuần trước (-1) / sau (+1). Về đúng tuần hiện tại thì xin "tuần này" (undefined) để được lưu làm bảng lần trước. */
function doiTuan(buoc: -1 | 1): void {
  const tw = bang.value?.tuan;
  if (!tw) return;
  const moi = congNgay(tw.batDau, 7 * buoc);
  tuanXem.value = buoc === 1 && Date.parse(`${moi}T00:00:00Z`) + 7 * NGAY > Date.now() ? undefined : moi;
  void tai();
}
const tuan = computed(() => (loai.value === 'tuan' ? bang.value?.tuan ?? null : null));
const ngayNgan = (d: string): string => new Intl.DateTimeFormat(document.documentElement.lang || undefined, { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
/** "Tuần này" / "Tuần trước" / "3 – 9/11". */
const tenTuan = computed(() => {
  const tw = tuan.value;
  if (!tw) return '';
  if (tw.nay) return t('bxh.tuanNay');
  if (tw.het + 7 * NGAY > Date.now()) return t('bxh.tuanTruoc');
  return `${ngayNgan(tw.batDau)} – ${ngayNgan(congNgay(tw.batDau, 6))}`;
});
/** Dòng nhỏ: tuần này "còn 3 ngày" (ngày cuối: "còn 5 giờ"); tuần trước: ngày tháng. Chủ dự án: "hiển thị đơn giản hơn". */
const phuTuan = computed(() => {
  const tw = tuan.value;
  if (!tw) return '';
  if (tw.nay) {
    const con = tw.het - Date.now();
    return con >= NGAY ? t('bxh.conNgay', { n: Math.floor(con / NGAY) }) : t('bxh.conGio', { n: Math.max(1, Math.ceil(con / 3_600_000)) });
  }
  return tenTuan.value === t('bxh.tuanTruoc') ? `${ngayNgan(tw.batDau)} – ${ngayNgan(congNgay(tw.batDau, 6))}` : '';
});
/** Đầu tuần chưa ai có điểm → mời chơi thay vì bảng trống. */
const tuanTrong = computed(() => !!tuan.value?.nay && !bang.value?.top.length);
onMounted(() => { closeBtn.value?.focus(); void tai(); });

/** Hạt vàng bốc lên từ bục: cố định (không random mỗi lần vẽ), dày ở giữa chỗ hạng 1. */
const HAT = Array.from({ length: 22 }, (_, k) => {
  const r = (n: number): number => { const x = Math.sin(k * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  const sao = k % 4 === 0;
  const c = sao ? 9 + r(1) * 6 : 3 + r(1) * 4;
  const trai = 50 + (r(2) - 0.5) * (k % 3 ? 60 : 96);
  return {
    sao,
    st: `left:${trai.toFixed(1)}%;width:${c.toFixed(1)}px;height:${c.toFixed(1)}px;--c:${c.toFixed(1)}px;--x:${((r(3) - 0.5) * 30).toFixed(0)}px;animation-duration:${(2.4 + r(4) * 2.2).toFixed(2)}s;animation-delay:-${(r(5) * 4).toFixed(2)}s`
  };
});

const ten = (d: DongBxh): string => d.name || (d.khach ? t('bxh.khach', { so: d.khach }) : '?');
const toi = computed(() => bang.value?.toi ?? null);
/** Ngoài top + 3 người chót đang hiện → ghim dòng mình ở đáy (chủ dự án: "luôn phải hiện vị trí người chơi hiện tại"). */
const ghim = computed(() => !!toi.value && !(bang.value?.top ?? []).some((d) => d.toi) && !(bang.value?.cuoi ?? []).some((d) => d.toi));

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

      <!-- GỌN (19.11.2026, mockup duyệt https://claude.ai/artifact/4SQdKfUtpcCdbsGvRZK7sH — chủ dự án: "nhiều chữ giải
           thích quá"): bỏ thẻ vàng "Hạng của bạn trong N người…", bỏ cột "x/y thắng" (còn ở nhãn ẩn), bỏ dòng dưới mình,
           bỏ câu mời đăng nhập + câu dặn tên. Dòng mình tô vàng là đủ biết mình ở đâu. -->
      <div class="tabs" role="tablist">
        <button class="tab thach th-nho th-chon" role="tab" type="button" :aria-selected="loai === 'tuan'" @click="doiLoai('tuan')">{{ t('bxh.tabTuan') }}</button>
        <button class="tab thach th-nho th-chon" role="tab" type="button" :aria-selected="loai === 'tat'" @click="doiLoai('tat')">{{ t('bxh.tabMoiLuc') }}</button>
      </div>
      <!-- Luôn giữ chỗ khi ở tab Tuần (chưa có dữ liệu thì ghi "Tuần này") — hàng hiện muộn là nội dung giật xuống -->
      <div v-if="loai === 'tuan'" class="tuan">
        <button class="thach th-nho" type="button" :aria-label="t('bxh.tuanTruoc')" :disabled="!tuan?.coTruoc || dangTai" @click="doiTuan(-1)">‹</button>
        <div class="giua"><b>{{ tenTuan || t('bxh.tuanNay') }}</b><small :class="{ dem: !tuan || tuan.nay }">{{ phuTuan || '\u00a0' }}</small></div>
        <button class="thach th-nho" type="button" :aria-label="t('bxh.tuanSau')" :disabled="!tuan || tuan.nay || dangTai" @click="doiTuan(1)">›</button>
      </div>

      <div class="body">
        <div v-if="bang && tuanTrong" class="trong">
          <span class="to" aria-hidden="true">🏁</span>
          <b>{{ t('bxh.tuanMoi') }}</b>
          <p>{{ t('bxh.tuanMoiMo') }}</p>
          <button class="choi thach th-vang" type="button" @click="emit('close')">{{ t('bxh.choiNgay') }}</button>
        </div>
        <template v-else-if="bang">
          <!-- BỤC TOP 3 (20.11.2026, mockup duyệt https://claude.ai/artifact/QujXue1p74g1e25fWz8QtP — phương án A, bỏ vòng
               tròn quanh mặt, thêm hạt vàng bốc lên): thứ tự trái→phải là hạng 2·1·3. Thiếu người thì ô trống giữ chỗ. -->
          <div v-if="bang.top.length" class="buc" :class="{ mo: dangTai }">
            <div class="bui" aria-hidden="true"><i v-for="(h, k) in HAT" :key="k" :class="{ sao: h.sao }" :style="h.st" /></div>
            <div v-for="i in [1, 0, 2]" :key="i" class="bn" :class="`n${i + 1}`">
              <template v-if="bang.top[i]">
                <span class="av"><span v-if="i === 0" class="vm" aria-hidden="true">👑</span><MatBot :mat="bang.top[i].mat ?? '🙂'" /></span>
                <span class="tn">{{ ten(bang.top[i]) }}</span>
                <i v-if="bang.top[i].toi" class="nhan-ban">{{ t('bxh.ban') }}</i>
                <span class="so">{{ num(bang.top[i].totalScore) }}<i class="xu" aria-hidden="true" /></span>
              </template>
              <div class="bac" aria-hidden="true">{{ i + 1 }}</div>
            </div>
          </div>
          <ol class="bxh" :class="{ mo: dangTai }" :aria-busy="dangTai" :start="4">
            <li v-for="(d, i) in bang.top.slice(3)" :key="i" :class="{ toi: d.toi }">
              <span class="hang">{{ i + 4 }}</span>
              <span class="mat"><MatBot :mat="d.mat ?? '🙂'" /></span>
              <span class="ten">{{ ten(d) }}<i v-if="d.toi" class="nhan-ban">{{ t('bxh.ban') }}</i></span>
              <span v-if="d.matches >= d.wins && d.matches" class="sr-only">{{ t('tk.thangTren', { thang: d.wins, van: d.matches }) }}</span>
              <span class="so">{{ num(d.totalScore) }}<i class="xu" aria-hidden="true" /></span>
            </li>
            <!-- 3 NGƯỜI CHÓT kèm số thứ tự (20.11.2026, chủ dự án: "cho người khác hiểu bao nhiêu người là đủ") -->
            <template v-if="bang.cuoi?.length">
              <li v-if="bang.cuoi[0]!.hang > bang.top.length + 1" class="cham" aria-hidden="true">···</li>
              <li v-for="d in bang.cuoi" :key="`c${d.hang}`" :class="{ toi: d.toi }">
                <span class="hang">{{ num(d.hang) }}</span>
                <span class="mat"><MatBot :mat="d.mat ?? '🙂'" /></span>
                <span class="ten">{{ ten(d) }}<i v-if="d.toi" class="nhan-ban">{{ t('bxh.ban') }}</i></span>
                <span class="so">{{ num(d.totalScore) }}<i class="xu" aria-hidden="true" /></span>
              </li>
            </template>
          </ol>
          <p v-if="!bang.top.length" class="muted">{{ t('tk.chuaAiMoi') }}</p>
        </template>
        <p v-else-if="loi" class="loi">{{ t('tk.loiBxh') }} <button class="btn-link" type="button" @click="tai">{{ t('bxh.thuLai') }}</button></p>
        <!-- Lần đầu (chưa có bảng cũ): dòng xám đúng dáng bảng thay chữ "Đang tải…" — khung không giật cao -->
        <ol v-else class="bxh xuong" :aria-label="t('tk.dangTai')" aria-busy="true">
          <li v-for="i in 6" :key="i"><span class="hang">{{ i }}</span><i class="o mat-o" /><i class="o ten-o" :style="{ width: `${42 + (i * 17) % 30}%` }" /><i class="o so-o" /></li>
        </ol>
      </div>

      <div v-if="toi && ghim && !tuanTrong" class="ghim" :class="{ mo: dangTai }">
        <span class="cham" aria-hidden="true">···</span>
        <div v-if="toi.tren" class="ke"><span class="hang">{{ num(toi.tren.hang) }}</span><span class="ten"><MatBot :mat="toi.tren.mat ?? '🙂'" /> {{ ten(toi.tren) }}</span><span class="so">{{ num(toi.tren.totalScore) }}<i class="xu" aria-hidden="true" /></span></div>
        <div class="toi-dong"><span class="hang">{{ toi.hang ? num(toi.hang) : '–' }}</span><span class="mat"><MatBot :mat="toi.mat ?? '🙂'" /></span><span class="ten">{{ ten(toi) }}<i class="nhan-ban">{{ t('bxh.ban') }}</i></span><span class="so">{{ num(toi.totalScore) }}<i class="xu" aria-hidden="true" /></span></div>
      </div>

      <!-- Khách: tên trên bảng -->
      <form v-if="moTen" class="dat-ten" @submit.prevent="luuTen">
        <div class="hang-nhap">
          <input id="ten-bxh" v-model="tenNhap" :placeholder="t('bxh.tenTren')" :aria-label="t('bxh.tenTren')" maxlength="16" autocomplete="nickname" enterkeyhint="done">
          <button class="luu thach th-xanh" type="submit" :disabled="dangLuu || !tenNhap.trim()">{{ t('bxh.luu') }}</button>
        </div>
      </form>

      <div v-if="laKhach" class="khach">
        <template v-if="khachAn">
          <p>{{ t('bxh.daAn') }}</p>
          <button class="btn-link" type="button" @click="doiAn(false)">{{ t('bxh.hienLai') }}</button>
        </template>
        <template v-else>
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
  /* CAO CỐ ĐỊNH (20.11.2026, chủ dự án: "bấm tuần / mọi lúc độ cao bị thay đổi, nhảy nhảy") — đổi tab/tuần chỉ đổi nội dung cuộn bên trong */
  width: 100%; max-width: var(--col-w); height: 100%; max-height: 780px;
  display: flex; flex-direction: column; min-height: 0;
  padding: 16px; border-radius: 16px;
  background: var(--panel-solid); border: 1px solid var(--line);
  box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
}
.head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.head h2 { flex: 1; margin: 0; font-size: var(--text-xl); }
.body { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; touch-action: pan-y; -webkit-overflow-scrolling: touch; padding: 2px 4px 6px; margin: 0 -4px; }
.muted { color: var(--muted); font-size: var(--text-sm); margin: 6px 0 0; }
.loi { color: var(--bad); font-size: var(--text-sm); margin: 8px 0 0; }

.bxh { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.bxh li, .toi-dong {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px;
  background: color-mix(in srgb, var(--fg) 5%, transparent);
}
.bxh li.toi, .toi-dong { background: #ffe7b3; color: #3d2f08; box-shadow: inset 0 0 0 2px #f0c64a; }
.bxh li.toi small { color: #5b4510; }
.hang { min-width: 30px; flex: none; text-align: center; font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums; }
.bxh li.toi .hang, .toi-dong .hang { color: #5b4510; }
.mat { font-size: 19px; line-height: 1; flex: 0 0 auto; }
.ten { flex: 1; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bxh small { color: var(--muted); font-size: 12px; white-space: nowrap; }
/* Số điểm: Baloo 2 + chữ số đều bề ngang, cột cố định canh phải — 980 và 12.450 thẳng mép */
.so { font-family: var(--font-display); font-weight: 800; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; text-align: right; white-space: nowrap; }
.bxh .so, .ghim .so { min-width: 7ch; font-size: 17px; }
.ke .so { font-size: var(--text-sm); }
.xu {
  display: inline-block; width: 13px; height: 13px; border-radius: 50%; margin-left: 4px; vertical-align: -1px;
  background: radial-gradient(circle at 35% 30%, #ffe58a, #f2b400 60%, #c98a00); box-shadow: inset 0 -1px 0 rgba(0, 0, 0, .2);
}

/* Bục */
.buc { position: relative; isolation: isolate; display: grid; grid-template-columns: 1fr 1.15fr 1fr; align-items: end; gap: 8px; margin: 4px 0 10px; }
.bn { display: grid; justify-items: center; gap: 2px; text-align: center; min-width: 0; }
.bn .av { position: relative; display: grid; place-items: center; font-size: 40px; line-height: 1; padding-top: 4px; }
.bn.n1 .av { font-size: 52px; padding-top: 14px; }
.bn .vm { position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: 20px; }
.bn .tn { font-weight: 800; font-size: 13px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bn .nhan-ban { margin: 0; }
.bn .so { font-size: 16px; }
.bn.n1 .so { font-size: 19px; }
.bn .bac { width: 100%; margin-top: 2px; border-radius: 12px 12px 4px 4px; display: grid; place-items: center; font: 800 22px var(--font-display); color: #fff; }
.n1 .bac { height: 58px; background: linear-gradient(#ffd34d, #f2b400); }
.n2 .bac { height: 42px; background: linear-gradient(#c5cee2, #9aa6c4); }
.n3 .bac { height: 32px; background: linear-gradient(#e2a06a, #c27a3e); }
/* Hạt vàng bốc lên + quầng sáng thở sau hạng 1 */
.bui { position: absolute; inset: -10px 0 0; overflow: hidden; pointer-events: none; z-index: -1; border-radius: 14px; }
.bui::before {
  content: ""; position: absolute; left: 50%; bottom: 20px; width: 170px; height: 170px; transform: translateX(-50%); border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 206, 64, .45), rgba(255, 206, 64, 0) 68%); animation: tho 2.6s ease-in-out infinite alternate;
}
.bui i { position: absolute; bottom: -8px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff6c8, #ffd23f 55%, rgba(242, 180, 0, 0) 72%); opacity: 0; animation: bay linear infinite; }
.bui i.sao { border-radius: 0; background: none; color: #ffcf33; font-size: var(--c); line-height: 1; text-shadow: 0 0 6px rgba(255, 200, 40, .8); }
.bui i.sao::before { content: "✦"; }
@keyframes bay { 0% { transform: translate(0, 0) scale(.6); opacity: 0; } 12% { opacity: 1; } 70% { opacity: .85; } 100% { transform: translate(var(--x), -150px) scale(1); opacity: 0; } }
@keyframes tho { from { opacity: .55; transform: translateX(-50%) scale(.92); } to { opacity: 1; transform: translateX(-50%) scale(1.06); } }
@media (prefers-reduced-motion: reduce) { .bui i { display: none; } .bui::before { animation: none; } }
.buc { transition: opacity .2s ease; }
.buc.mo { opacity: .45; }
.nhan-ban {
  font-style: normal; font-size: 11px; font-weight: 800; color: #fff; background: #c2621a;
  border-radius: 8px; padding: 1px 6px; margin-left: 6px; vertical-align: 1px;
}

.ghim { margin-top: 2px; display: grid; gap: 4px; }
.bxh li.cham { background: none; justify-content: center; padding: 0; }

/* Tab Tuần / Mọi lúc + chọn tuần */
.tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.tabs .tab { min-height: 38px; font-weight: 800; font-size: var(--text-sm); }
.tuan { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.tuan button { width: 40px; height: 40px; flex: none; padding: 0; font: 800 20px var(--font-body); }
.tuan button:disabled { opacity: .3; }
.tuan .giua { flex: 1; text-align: center; display: grid; line-height: 1.2; }
.tuan .giua b { font: 800 16px var(--font-display); }
.tuan .giua small { font-size: 12px; font-weight: 700; color: var(--muted); }
.tuan .giua small.dem { color: #c2621a; }
.trong { text-align: center; padding: 22px 8px 14px; display: grid; gap: 6px; justify-items: center; }
.trong .to { font-size: 44px; line-height: 1; }
.trong b { font: 800 18px var(--font-display); }
.trong p { margin: 0; color: var(--muted); font-size: var(--text-sm); line-height: 1.45; max-width: 30ch; }
.trong .choi { min-height: 44px; padding: 0 22px; font-weight: 800; margin-top: 6px; }
/* Bảng lần trước đang chờ số mới: mờ đi, không bấm/đọc nhầm số cũ là số thật */
.bxh, .ghim { transition: opacity .2s ease; }
.bxh.mo, .ghim.mo { opacity: .45; }
.xuong li { min-height: 36px; box-sizing: border-box; }
.xuong .o { display: block; height: 14px; border-radius: 7px; background: color-mix(in srgb, var(--fg) 12%, transparent); animation: nhap 1.1s ease-in-out infinite alternate; }
.xuong .mat-o { width: 22px; height: 22px; border-radius: 50%; flex: none; }
.xuong .so-o { width: 58px; margin-left: auto; flex: none; }
@keyframes nhap { to { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .xuong .o { animation: none; } }
.cham { text-align: center; color: var(--muted); font-weight: 800; letter-spacing: 4px; line-height: 1; }
.ke { display: flex; align-items: center; gap: 8px; padding: 0 8px; font-size: var(--text-sm); color: var(--muted); }
.ke .ten { font-weight: 600; }

.dat-ten { margin-top: 10px; display: grid; gap: 6px; }
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
