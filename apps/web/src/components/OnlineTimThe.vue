<script setup lang="ts">
/**
 * TÌM THẺ ONLINE — MÀN CHƠI (27.11.2026, mockup duyệt https://claude.ai/artifact/5rwkt1SVgamVqoED4nEWz6 màn ③–⑥).
 * Server dẫn nhịp (`PhongTimThe`, gửi `t:'tim'` mỗi lần đổi pha / có người chọn); màn này CHỈ VẼ và gửi lựa chọn.
 *
 * Giữ đúng các nguyên tắc của Tìm Thẻ chơi đơn (CLAUDE.md mục TÌM THẺ): màn chơi chỉ có bàn thẻ (+ hàng người chơi — cần để
 * biết ai đã chọn), KHÔNG bảng thông báo, KHÔNG thanh giờ, KHÔNG số giây nhảy; thẻ cần tìm hiện to giữa bàn trên lớp mờ;
 * chọn đúng thì số giây nằm trên lá, "+điểm" bay về ô Điểm. Đang chọn chỉ lộ AI đã chọn; tới đáp án mới hiện mặt người
 * dưới lá họ chọn.
 *
 * Giờ chọn đo TẠI MÁY NÀY (từ lúc nhận câu hỏi, trừ phần server đã trôi trước khi gửi) — đường truyền không ăn vào điểm;
 * server kẹp lại (`PhongTimThe.chon`).
 */
import { TIM_THE_SO_LUOT, timTheSoCot, type TimView } from '@mm/engine';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Check, Ellipsis, LogOut, TimerOff, X, Zap } from 'lucide-vue-next';
import type { useOnlineRoom } from '@/composables/useOnlineRoom';
import { anhEmoji, chonCoAnh, laKyTuChu, taiTruocAnh } from '@/lib/emoji';
import { sfx } from '@/lib/audio';
import { rung } from '@/lib/rung';
import { bcp, t } from '@/lib/i18n';
import { num } from '@/lib/format';
import { store } from '@/lib/storage';
import { taiKhoan } from '@/lib/taikhoan';
import { tenNguoi } from '@/lib/ten';
import { ghiVuaThang } from '@/lib/xin-danh-gia';
import { moChucNang, suKien } from '@/lib/phan-tich';
import { bayBan, dangTimOnline } from '@/lib/tim-the';
import DongXu from './DongXu.vue';
import MatNguoi from './MatNguoi.vue';
import EmojiDock from './EmojiDock.vue';
import EmojiBlast from './EmojiBlast.vue';
import LoiNoi from './LoiNoi.vue';

const props = defineProps<{ o: ReturnType<typeof useOnlineRoom> }>();
const emit = defineEmits<{ quit: [] }>();
const o = props.o;

const v = computed<TimView | null>(() => o.tim.value);
const pha = computed(() => v.value?.pha ?? 'xem');
const toiId = computed(() => o.myId.value);
const xem = computed(() => o.spectator.value);

/* ---------- người chơi: dữ liệu ván + mặt/màu từ phòng ---------- */
const nguoiPhong = (id: string) => o.room.value?.players.find((p) => p.id === id);
const ICON = { da: Ellipsis, dung: Check, nhanh: Zap, sai: X, het: TimerOff } as const;
const nguoi = computed(() => (v.value?.nguoi ?? []).map((n) => {
  const p = nguoiPhong(n.id);
  const lo = pha.value === 'dap-an' || pha.value === 'xong';
  const tt: keyof typeof ICON | '' = lo && n.kq
    ? (n.kq.ketCuc === 'dung' ? (n.kq.nhanhNhat ? 'nhanh' : 'dung') : n.kq.ketCuc === 'sai' ? 'sai' : 'het')
    : pha.value === 'hoi' && (n.da || (n.id === toiId.value && chonCuaToi.value !== null)) ? 'da' : '';
  return {
    ...n, tt, mat: p?.avatar ?? '🙂', mau: p?.mau, anh: p?.anh,
    ten: n.id === toiId.value ? t('tt.ban') : (p ? tenNguoi(p) : n.ten), cong: pha.value === 'dap-an' ? (n.kq?.diem ?? 0) : 0,
    giay: lo && n.kq && n.kq.ms !== null ? giayChon(n.kq.ms) : ''
  };
}));
const toi = computed(() => v.value?.nguoi.find((n) => n.id === toiId.value) ?? null);

/* ---------- bàn: hình đang hiện (giữ hình cũ trong lúc lá úp xuống để không loé ô trắng) ---------- */
const hinhCu = ref<string[]>([]);
const hinh = computed(() => v.value?.the ?? hinhCu.value);
const ngua = computed(() => !!v.value?.the);
const soThe = computed(() => v.value?.soThe ?? 9);
const soCot = ref(timTheSoCot(soThe.value));
/** Ai chọn lá nào — chỉ ở đáp án (server mới gửi `kq`). */
const aiChon = (i: number) => (pha.value === 'dap-an' || pha.value === 'xong') ? nguoi.value.filter((n) => n.kq?.viTri === i) : [];

/* ---------- nhịp: giờ chọn đo tại máy ---------- */
const chonCuaToi = ref<number | null>(null);
let hoiTu = 0;       // performance.now() lúc câu hỏi bắt đầu (đã trừ phần server trôi trước khi gửi)
let hoiDai = 0;
let raf = 0;
let giayCu = -1;
const ban = ref<HTMLElement | null>(null);
const laW = ref(72);
const KHE = 10;
function doBan(): void {
  const el = ban.value;
  if (!el) return;
  const b = bayBan(soThe.value, el.clientWidth, el.clientHeight, KHE);
  soCot.value = b.cot; laW.value = b.w;
}
const coAnh = computed(() => chonCoAnh(laW.value * 0.62));

/* ---------- điểm bay (cùng `gain-suck` của bàn chính) ---------- */
const gain = ref<{ key: number; i: number; diem: number; s: string } | null>(null);
let gainEl: HTMLElement | null = null;
function datGain(el: unknown): void { gainEl = el instanceof HTMLElement ? el : null; }
const diemHien = ref(0);
const nay = ref(0);
let henBay: ReturnType<typeof setTimeout> | undefined;
const giayChon = (ms: number): string => (Math.max(10, ms) / 1000).toLocaleString(bcp(), { maximumFractionDigits: ms < 1000 ? 2 : 1, minimumFractionDigits: ms < 1000 ? 2 : 0 });
async function bayDiem(i: number, diem: number, ms: number): Promise<void> {
  clearTimeout(henBay);
  gain.value = { key: (gain.value?.key ?? 0) + 1, i, diem, s: giayChon(ms) };
  await nextTick();
  const dich = document.querySelector('.ott .vien.diem b');
  if (gainEl && dich) {
    const a = gainEl.getBoundingClientRect(), b = dich.getBoundingClientRect();
    gainEl.style.setProperty('--to-x', `${b.left + b.width / 2 - (a.left + a.width / 2)}px`);
    gainEl.style.setProperty('--to-y', `${b.top + b.height / 2 - (a.top + a.height / 2)}px`);
  }
  henBay = setTimeout(() => { diemHien.value = toi.value?.diem ?? 0; nay.value++; }, 850);
}

/* ---------- nhận trạng thái ---------- */
let truocPha = '';
let truocLuot = -1;
let daGhiVan = -1;
watch(v, (moi) => {
  if (!moi) return;
  if (moi.the) hinhCu.value = moi.the;
  const doiLuot = moi.luot !== truocLuot;
  const doiPha = moi.pha !== truocPha || doiLuot;
  if (moi.pha === 'hoi' && doiPha) {
    hoiDai = moi.daiMs;
    hoiTu = o.timNhanLuc.value - (moi.daiMs - moi.conMs);
    giayCu = -1;
  }
  if (doiPha) {
    if (moi.pha === 'xem') {
      chonCuaToi.value = null; gain.value = null;
      if (moi.the) taiTruocAnh(moi.the, coAnh.value);
      sfx.flip();
      if (moi.luot === 0) diemHien.value = 0;
    } else if (moi.pha === 'up') sfx.swap();
    else if (moi.pha === 'noi') sfx.turn();
    else if (moi.pha === 'dap-an') {
      const k = moi.nguoi.find((n) => n.id === toiId.value)?.kq;
      if (k?.ketCuc === 'dung' && k.viTri !== null) { sfx.match(k.chuoi); rung.ghep(k.chuoi); void bayDiem(k.viTri, k.diem, k.ms ?? 0); }
      else if (!xem.value) { sfx.miss(); rung.sai(); }
    } else if (moi.pha === 'xong') ketThuc(moi);
  }
  truocPha = moi.pha; truocLuot = moi.luot;
  nextTick(doBan);
}, { immediate: true });

function cham(i: number): void {
  if (xem.value || pha.value !== 'hoi' || chonCuaToi.value !== null) return;
  const ms = performance.now() - hoiTu;
  if (ms > hoiDai) return;   // hết giờ ở máy này — server cũng sẽ từ chối
  chonCuaToi.value = i;
  sfx.select();
  rung.tach();
  o.timChon(i, Math.max(0, ms));
}

/** Tiếng tích 3 giây cuối (thay cho thanh giờ — màn chơi không có gì kéo mắt khỏi bàn). */
function khung(): void {
  if (pha.value === 'hoi' && chonCuaToi.value === null && !xem.value) {
    const s = Math.ceil((hoiDai - (performance.now() - hoiTu)) / 1000);
    if (s !== giayCu) { if (giayCu !== -1 && s <= 3 && s > 0) sfx.tick(); giayCu = s; }
  }
  raf = requestAnimationFrame(khung);
}

/* ---------- hết ván ---------- */
const xepHang = computed(() => {
  const ds = [...nguoi.value].sort((a, b) => b.diem - a.diem);
  return ds.map((n) => ({ ...n, hang: ds.findIndex((x) => x.diem === n.diem) + 1 }));
});
const coMay = computed(() => (v.value?.nguoi ?? []).some((n) => !!n.may));
function ketThuc(moi: TimView): void {
  diemHien.value = moi.nguoi.find((n) => n.id === toiId.value)?.diem ?? diemHien.value;
  if (xem.value || daGhiVan === moi.van) return;
  daGhiVan = moi.van;
  const ds = [...moi.nguoi].sort((a, b) => b.diem - a.diem);
  const minh = moi.nguoi.find((n) => n.id === toiId.value);
  if (!minh) return;
  const caoNhat = ds[0]?.diem ?? 0;
  const dongNhat = ds.filter((n) => n.diem === caoNhat).length;
  const ketQua = minh.diem === caoNhat ? (dongNhat > 1 ? 'hoa' : 'thang') : 'thua';
  if (ketQua === 'thua') sfx.defeat(); else sfx.win();
  suKien('van_ket_thuc', { che_do: 'tim_the_online', ket_qua: ketQua, so_the: moi.soThe, tuy_chon: moi.doKho, so_nguoi: moi.nguoi.length, diem: minh.diem });
  // Phòng có MÁY: không xu, không lên sổ (cùng luật ván ghép cặp online — chống cày bằng máy dễ)
  if (coMay.value) return;
  store.addScore(minh.diem);
  store.ghiVanBoDem({ thang: ketQua === 'thang', online: true });
  if (ketQua === 'thang') ghiVuaThang();
  void taiKhoan.ghiVan({ ketQua, score: minh.diem, achievements: [] });
}

let ro: ResizeObserver | undefined;
onMounted(() => {
  ro = new ResizeObserver(doBan);
  if (ban.value) ro.observe(ban.value);
  raf = requestAnimationFrame(khung);
  dangTimOnline.value = true;
});
onBeforeUnmount(() => { dangTimOnline.value = false; ro?.disconnect(); cancelAnimationFrame(raf); clearTimeout(henBay); });
</script>

<template>
  <section class="ott">
    <div class="ott-hud">
      <button class="tron thach nut-ra" type="button" :aria-label="t('hud.thoat')" @click="moChucNang('tim_online_thoat'); emit('quit')"><LogOut :size="18" /></button>
      <div :key="nay" class="vien diem" :class="{ nay: nay > 0 }"><DongXu :size="22" /><b>{{ num(diemHien) }}</b></div>
      <span class="gian" />
      <div class="vien luot">{{ t('tt.luot', { n: Math.min((v?.luot ?? 0) + 1, v?.soLuot ?? TIM_THE_SO_LUOT), tong: v?.soLuot ?? TIM_THE_SO_LUOT }) }}</div>
    </div>

    <div class="ott-nguoi" :style="{ gridTemplateColumns: `repeat(${Math.max(2, nguoi.length)}, 1fr)` }">
      <div v-for="n in nguoi" :key="n.id" class="khay-nho ng" :class="{ toi: n.id === toiId }">
        <span class="av vong-mau" :style="n.mau ? { '--m': n.mau } : undefined">
          <MatNguoi :mat="n.mat" :anh="n.anh" />
          <span v-if="n.tt" :key="n.tt" class="huy" :class="n.tt"><component :is="ICON[n.tt]" :size="11" :stroke-width="3.2" aria-hidden="true" /></span>
        </span>
        <span class="ten">{{ n.ten }}</span>
        <b class="d">{{ num(n.diem) }}</b>
        <span v-if="n.cong" :key="`c${v?.luot}`" class="cong">+{{ num(n.cong) }}</span>
        <span v-if="n.giay && pha === 'dap-an'" :key="`g${v?.luot}`" class="giay-chip" :class="{ sai: n.kq?.ketCuc !== 'dung' }">{{ n.giay }}s</span>
      </div>
    </div>

    <div ref="ban" class="ott-ban">
      <div v-if="o.countdownLeft.value !== null" class="dem" role="status" aria-live="assertive"><span :key="o.countdownLeft.value">{{ o.countdownLeft.value }}</span></div>
      <div v-else class="luoi" :style="{ gridTemplateColumns: `repeat(${soCot}, ${laW}px)` }">
        <div v-for="i in soThe" :key="`${v?.van}-${v?.luot}-${i}`" class="o" :class="{ 'co-gain': gain?.i === i - 1 }">
          <button
            class="card" type="button" data-nosfx data-phang
            :class="{
              lat: ngua,
              dung: (pha === 'dap-an' || pha === 'xong') && i - 1 === v?.dich,
              sai: (pha === 'dap-an' || pha === 'xong') && i - 1 === chonCuaToi && i - 1 !== v?.dich,
              cho: pha === 'hoi' && i - 1 === chonCuaToi
            }"
            :aria-label="ngua ? (hinh[i - 1] ?? '') : t('tt.theSo', { n: i })"
            :aria-disabled="pha !== 'hoi' || chonCuaToi !== null || xem"
            @pointerdown.prevent="cham(i - 1)" @keydown.enter.prevent="cham(i - 1)" @keydown.space.prevent="cham(i - 1)"
          >
            <span class="inner">
              <span class="face back" aria-hidden="true" />
              <span class="face front" :class="{ chu: laKyTuChu(hinh[i - 1]) }" aria-hidden="true">
                <img v-if="anhEmoji(hinh[i - 1], undefined, coAnh)" class="emoji" :src="anhEmoji(hinh[i - 1], undefined, coAnh)!" alt="" draggable="false">
                <span v-else class="emoji chu">{{ hinh[i - 1] }}</span>
              </span>
            </span>
          </button>
          <span v-if="aiChon(i - 1).length" class="ai-chon" aria-hidden="true">
            <span v-for="n in aiChon(i - 1)" :key="n.id" class="mat-nho vong-mau" :style="n.mau ? { '--m': n.mau } : undefined"><MatNguoi :mat="n.mat" :anh="n.anh" /></span>
          </span>
          <template v-if="gain && gain.i === i - 1 && pha === 'dap-an'">
            <span :key="`s${gain.key}`" class="tt-giay" aria-hidden="true">{{ gain.s }}s</span>
            <span :key="`g${gain.key}`" :ref="datGain" class="tt-gain" aria-hidden="true">+{{ num(gain.diem) }}</span>
          </template>
        </div>
      </div>

      <!-- Thẻ cần tìm giữa bàn (như bản chơi đơn) -->
      <Transition name="tt-noi">
        <div v-if="pha === 'noi' && v?.hinhDich" :key="`n${v.luot}`" class="tt-noi" aria-hidden="true">
          <span class="lon">
            <img v-if="anhEmoji(v.hinhDich, undefined, chonCoAnh(108))" :src="anhEmoji(v.hinhDich, undefined, chonCoAnh(108))!" alt="" draggable="false">
            <template v-else>{{ v.hinhDich }}</template>
          </span>
          <b class="nhan-noi">{{ t('tt.timTheNay') }}</b>
        </div>
      </Transition>
      <p class="an-di" aria-live="polite">{{ pha === 'hoi' && v?.hinhDich ? `${t('tt.hoi')} ${v.hinhDich}` : '' }}</p>

      <!-- HẾT VÁN: bảng xếp hạng + Chơi lại (cả phòng bấm) / Về phòng chờ -->
      <div v-if="pha === 'xong'" class="ott-phu" role="dialog" aria-modal="true" aria-labelledby="ottCuoi">
        <div class="hop khay">
          <h2 id="ottCuoi">{{ xepHang[0] && xepHang.filter((x) => x.hang === 1).length === 1 ? t('tt.thangTen', { ten: xepHang[0].ten }) : t('tt.hoa') }}</h2>
          <ol class="hang">
            <li v-for="n in xepHang" :key="n.id" class="khay-nho" :class="{ toi: n.id === toiId }">
              <span class="so">{{ n.hang }}</span>
              <span class="av vong-mau" :style="n.mau ? { '--m': n.mau } : undefined"><MatNguoi :mat="n.mat" :anh="n.anh" /></span>
              <span class="ten">{{ n.ten }}</span>
              <b class="d">{{ num(n.diem) }}</b>
            </li>
          </ol>
          <p v-if="toi && !coMay" class="phu-chu xu"><DongXu :size="18" /> <b>+{{ num(toi.diem) }}</b></p>
          <button v-if="!xem" class="btn btn-primary nut-to" type="button" :disabled="o.iWantAgain.value" @click="moChucNang('tim_online_choi_lai'); o.again()">
            <Check v-if="o.iWantAgain.value" :size="20" :stroke-width="3" aria-hidden="true" /> {{ t('hud.choiLai') }}
          </button>
          <button class="btn" type="button" @click="moChucNang('tim_online_ve_phong'); o.veLobby()">{{ t('kq.vePhongCho') }}</button>
        </div>
      </div>
    </div>

    <EmojiDock :o="o" />
    <EmojiBlast :o="o" />
    <LoiNoi :o="o" />
  </section>
</template>

<style scoped>
/* Cao bằng khung như OnlineGame (`.game { height: 100% }`) — thiếu thì bàn co về cỡ nội dung, thẻ tí hon */
.ott { position: relative; display: flex; flex-direction: column; gap: 10px; height: 100%; min-height: 0; box-sizing: border-box; }
.ott-hud { display: flex; align-items: center; gap: 6px; flex: none; }
.vien {
  display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 999px;
  font-family: var(--font-display); font-size: 18px; font-weight: 900; font-variant-numeric: tabular-nums;
  background: linear-gradient(#fff 20%, #e9effc); color: #1d2a5a;
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, .8), 0 3px 0 #b9c6e6, 0 6px 10px rgba(20, 30, 70, .15);
}
.vien.luot { font-size: 15px; padding: 0 12px; }
.vien.diem.nay { animation: nay .3s; }
@keyframes nay { 40% { transform: scale(1.25); } }
.gian { flex: 1; }
.nut-ra { flex: none; width: 44px; height: 44px; min-width: 0; min-height: 0; padding: 0; display: grid; place-items: center; border-radius: 50%; }

.ott-nguoi { flex: none; display: grid; gap: 6px; }
.ng { position: relative; display: flex; align-items: center; gap: 6px; padding: 5px 8px; min-width: 0; }
.ng.toi { border-color: #ffc21a; }
.av { position: relative; flex: none; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-size: 18px; }
.ten { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; font-size: 13px; }
.d { font-family: var(--font-display); font-weight: 800; font-size: 15px; font-variant-numeric: tabular-nums; }
.huy {
  position: absolute; right: -6px; bottom: -5px; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center;
  color: #fff; border: 2px solid var(--k-nen, #fff); box-sizing: border-box; animation: no .25s both;
}
.huy.da { background: #7d88a8; } .huy.dung { background: #2f9e57; } .huy.nhanh { background: #f0a816; color: #5a3d00; }
.huy.sai, .huy.het { background: #e0533a; }
/* GIÂY CHỌN trên khung điểm (27.11.2026, chủ dự án: "hiện cả thời gian chọn… cho người xem cũng thấy"): mỗi người đã chọn
   có viên số giây ở góc dưới khung tới hết đáp án — xanh nếu đúng, xám nếu sai */
.giay-chip {
  position: absolute; right: 6px; bottom: -9px; z-index: 2; pointer-events: none; white-space: nowrap;
  padding: 1px 7px; border-radius: 999px; background: #2f9e57; color: #fff; font-family: var(--font-display); font-weight: 800;
  font-size: 11.5px; font-variant-numeric: tabular-nums; box-shadow: 0 2px 0 #1f7a3e; animation: no .25s both;
}
.giay-chip.sai { background: #7d88a8; box-shadow: 0 2px 0 #5b6688; }
.cong {
  position: absolute; right: 6px; top: -9px; font-family: var(--font-display); font-weight: 800; font-size: 14px; color: #fff;
  -webkit-text-stroke: 3px #2f9e57; paint-order: stroke; pointer-events: none; animation: bay 1s both;
}
@keyframes bay { from { transform: translateY(8px); opacity: 0; } 25% { opacity: 1; } to { transform: translateY(-6px); opacity: 1; } }
@keyframes no { from { transform: scale(.5); opacity: 0; } 60% { transform: scale(1.12); } to { transform: none; opacity: 1; } }

.ott-ban { position: relative; flex: 1; min-height: 0; display: grid; place-items: center; }
.luoi { display: grid; gap: 10px; justify-content: center; align-content: center; }
.o { position: relative; aspect-ratio: 3 / 4; }
.o.co-gain { z-index: 8; }
.card {
  position: relative; display: block; width: 100%; height: 100%; padding: 0; border: 0; background: none; border-radius: 12px;
  perspective: 600px; container-type: size; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
}
.card[aria-disabled='true'] { cursor: default; }
.inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .32s cubic-bezier(.3, .9, .3, 1.15); border-radius: inherit; }
.card.lat .inner { transform: rotateY(180deg); }
.face { position: absolute; inset: 0; box-sizing: border-box; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: grid; place-items: center; }
.face.front { transform: rotateY(180deg); }
.front.chu { font-family: var(--font-display); font-weight: 800; color: #1d2a5a; }
.emoji { width: 62%; height: 62%; object-fit: contain; pointer-events: none; }
.emoji.chu { width: auto; height: auto; font-size: min(48cqw, 58cqh); line-height: 1; }
.card::after { content: ''; position: absolute; inset: -5px; border-radius: 16px; pointer-events: none; z-index: 3; border: 4px solid transparent; transition: border-color .15s; }
.card.cho::after { border-color: #ffc21a; box-shadow: 0 0 16px 3px rgba(255, 194, 26, .7); }
/* Chọn một lá: lá LẮC nhẹ (chủ dự án 27.11.2026) — `rotate` riêng, không đụng `transform` lật của `.inner` */
.card.cho { animation: lac-chon .42s ease; }
@keyframes lac-chon { 15% { rotate: -7deg; scale: 1.06; } 35% { rotate: 6deg; } 55% { rotate: -4deg; } 75% { rotate: 2deg; } 100% { rotate: 0deg; scale: 1; } }
.card.dung::after { border-color: #3fbf5f; box-shadow: 0 0 18px 5px rgba(63, 191, 95, .7); }
.card.sai::after { border-color: #ff4d6d; box-shadow: 0 0 14px 3px rgba(255, 77, 109, .6); }
.card.dung { animation: nay-the .45s; z-index: 2; }
@keyframes nay-the { 40% { scale: 1.1; } }
/* Mặt người chọn lá này — chỉ ở đáp án */
.ai-chon { position: absolute; left: 0; right: 0; bottom: -9px; z-index: 4; display: flex; justify-content: center; gap: 2px; pointer-events: none; }
.mat-nho { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; font-size: 13px; box-shadow: 0 0 0 2px #fff; animation: no .25s both; }

.dem { font-family: var(--font-display); font-weight: 900; font-size: 96px; color: #fff; -webkit-text-stroke: 6px #2f4fa6; paint-order: stroke; }
.dem span { display: inline-block; animation: no .35s both; }

.tt-noi {
  position: absolute; inset: -6px; z-index: 6; border-radius: 22px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px; pointer-events: auto;
  background: rgba(13, 24, 56, .38); -webkit-backdrop-filter: blur(7px); backdrop-filter: blur(7px);
}
.tt-noi .lon {
  width: min(108px, 30%); aspect-ratio: 3 / 4; border-radius: 15px; display: grid; place-items: center; font-size: 60px; line-height: 1;
  font-family: var(--font-display); font-weight: 800; color: #1d2a5a;
  background: radial-gradient(110% 80% at 50% 35%, #fff, #f1f5ff 90%); border: 4px solid #ffc21a;
  box-shadow: 0 6px 0 #c98f00, 0 14px 30px rgba(10, 20, 60, .35); animation: bat .38s cubic-bezier(.3, 1.5, .5, 1) both;
}
.tt-noi .lon img { width: 66%; height: auto; object-fit: contain; }
.nhan-noi {
  font-family: var(--font-display); font-weight: 900; font-size: 18px; color: #fff; padding: 5px 14px; border-radius: 999px;
  background: #2f4fa6; box-shadow: 0 3px 0 #1f3577; animation: bat .38s .08s both;
}
@keyframes bat { from { transform: scale(.3); opacity: 0; } to { transform: none; opacity: 1; } }
.tt-noi-enter-active { transition: opacity .25s; }
.tt-noi-leave-active { transition: opacity .12s; pointer-events: none; }
.tt-noi-leave-active .lon { transition: transform .12s; transform: scale(.8); }
.tt-noi-enter-from, .tt-noi-leave-to { opacity: 0; }
.an-di { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); margin: 0; }

.tt-gain {
  --to-x: 0px; --to-y: -120px;
  position: absolute; left: 50%; top: 50%; z-index: 9; transform: translate(-50%, -50%); pointer-events: none; white-space: nowrap;
  font-family: var(--font-display); font-weight: 800; font-size: clamp(22px, 6vw, 30px); color: #ffd23a;
  -webkit-text-stroke: 4px #8a5a00; paint-order: stroke; text-shadow: 0 3px 10px rgba(217, 158, 0, .5);
  animation: gain-suck 1.05s cubic-bezier(.35, .05, .3, 1) forwards;
}
@keyframes gain-suck {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.5); }
  18% { opacity: 1; transform: translate(-50%, -50%) scale(1.35); }
  45% { opacity: 1; transform: translate(calc(-50% + var(--to-x) * .18), calc(-50% + var(--to-y) * .18)) scale(1.2); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--to-x)), calc(-50% + var(--to-y))) scale(.45); }
}
.tt-giay {
  position: absolute; left: 0; right: 0; top: -10px; z-index: 9; width: fit-content; margin: 0 auto; pointer-events: none; white-space: nowrap;
  padding: 2px 10px; border-radius: 999px; background: #2f9e57; color: #fff; font-family: var(--font-display); font-weight: 800;
  font-size: 15px; font-variant-numeric: tabular-nums; box-shadow: 0 2px 0 #1f7a3e; animation: no .25s both;
}

.ott-phu { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; padding: 6px; border-radius: 22px; background: color-mix(in srgb, #0d1838 35%, transparent); }
.hop { width: 100%; max-width: 380px; max-height: 100%; overflow: auto; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; padding: 18px 18px 16px; text-align: center; }
.hop h2 { margin: 0; font-size: 26px; line-height: 1.15; text-wrap: balance; }
.hop .btn { min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 6px; }
.hop .nut-to { min-height: 56px; font-size: 22px; }
.hang { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.hang li { display: flex; align-items: center; gap: 8px; padding: 6px 10px; text-align: start; }
.hang li.toi { border-color: #ffc21a; }
.hang .so { flex: none; width: 1.2em; font-family: var(--font-display); font-weight: 800; font-size: 18px; text-align: center; }
.phu-chu { margin: 0; font-family: var(--font-display); font-weight: 700; color: var(--muted); }
.phu-chu b { color: var(--fg); }
.phu-chu.xu { display: flex; align-items: center; justify-content: center; gap: 6px; }
@media (prefers-reduced-motion: reduce) {
  .inner { transition-duration: .01s; }
  .card.dung, .card.cho, .huy, .cong, .tt-noi .lon, .nhan-noi, .tt-giay, .vien.diem.nay, .mat-nho, .dem span { animation: none; }
}
</style>
