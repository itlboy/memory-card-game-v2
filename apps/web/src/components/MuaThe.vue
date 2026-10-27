<script setup lang="ts">
/**
 * MÀN MƯA THẺ — chế độ thẻ rơi (thử nghiệm, mở từ trang Debug). Luật ở `lib/mua-the.ts`.
 *
 * Vị trí lá đổi MỖI KHUNG nên KHÔNG đi qua Vue: vòng rAF ghi thẳng `transform` vào phần tử
 * (`elLa`). Vue chỉ vẽ lại khi danh sách lá hoặc trạng thái ngửa/chọn đổi (`chuKy` → `rev`) —
 * vẽ lại 24 lá mỗi khung là đúng loại chi phí đã làm bàn 88 thẻ online giật (CLAUDE.md).
 * Mặt lá dùng chung lớp `.card .face.back/.front` nên skin Kẹo tô y như lá trong ván.
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { COT, COT_CHON, comboMultiplier, mocCap, DANG_LA, DEM_DOC, DEM_NGANG, VanMuaThe, hangChoGieng, type La } from '@/lib/mua-the';
import { anhEmoji, chonCoAnh, taiTruocAnh } from '@/lib/emoji';
import { choiDuoc } from '@/lib/premium';
import type { CardTheme } from '@/lib/themes';
import { sfx } from '@/lib/audio';
import { rung } from '@/lib/rung';
import { bcp, t } from '@/lib/i18n';
import { num } from '@/lib/format';
import DongXu from './DongXu.vue';
import { X } from 'lucide-vue-next';

const props = defineProps<{ themes: CardTheme[]; themeIds: string[] }>();
const emit = defineEmits<{
  thoat: [];
  'bat-dau': [soCot: number];
  'ket-thuc': [kq: { diem: number; cap: number; soCap: number; soCot: number; giay: number }];
}>();

const SO_HINH = 12;
/** Kỷ lục RIÊNG từng số cột — 4 cột và 6 cột là hai bàn khác hẳn nhau. */
const khoaKyLuc = (n: number): string => `mm.muaThe.kyLuc.${n}`;
const KHOA_COT = 'mm.muaThe.cot';
/** Hình minh hoạ màn mở đầu: ba lá rơi (Noto 3D như mặt bài). */
const LA_MINH_HOA = ['🐼', '🦊', '🐸'];
const anhNho = (e: string): string | null => anhEmoji(e, undefined, 128);

const van = shallowRef<VanMuaThe | null>(null);
const rev = ref(0);
const buoc = ref<'dau' | 'choi' | 'dung' | 'cuoi'>('dau');
const banCap = ref<number | null>(null);
const bay = ref<{ id: number; x: number; y: number; chu: string }[]>([]);
/** Vụ nổ khi ăn cặp: vòng sóng + mảnh kẹo bắn ra từ tâm mỗi lá (CSS thuần, gỡ sau 700ms). */
interface Manh { dx: number; dy: number; co: number; mau: string; quay: number; sao: boolean }
const no = ref<{ id: string; x: number; y: number; manh: Manh[]; to: boolean }[]>([]);
const MAU_NO = ['#ffc21a', '#ff4d8d', '#4cc9f0', '#6be08a', '#b388ff', '#ff8a3d'];
function noTai(l: La, chuoi: number): void {
  const to = chuoi >= 3;
  const n = to ? 22 : 16;
  const tam = { x: (l.cot + 0.5) * oW.value, y: dinh.value + (l.y + 0.5) * oH.value };
  const manh = Array.from({ length: n }, (_, i): Manh => {
    const goc = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const xa = oW.value * (to ? 2 : 1.4) * (0.5 + Math.random() * 0.7);
    return {
      dx: Math.cos(goc) * xa, dy: Math.sin(goc) * xa - oH.value * 0.15, co: 9 + Math.random() * (to ? 12 : 8),
      mau: MAU_NO[Math.floor(Math.random() * MAU_NO.length)]!, quay: Math.random() * 540 - 270, sao: Math.random() < 0.4
    };
  });
  const id = `${l.id}-${Math.random()}`;
  no.value = [...no.value, { id, ...tam, manh, to }];
  henDon.push(setTimeout(() => { no.value = no.value.filter((x) => x.id !== id); }, 750));
}
const soCot = ref<number>(docCot());
const kyLuc = ref(docKyLuc(soCot.value));
const kyLucMoi = ref(false);

function docCot(): number {
  try { const n = Number(localStorage.getItem(KHOA_COT)); return (COT_CHON as readonly number[]).includes(n) ? n : COT; } catch { return COT; }
}
function docKyLuc(n: number): number {
  try { return Number(localStorage.getItem(khoaKyLuc(n))) || 0; } catch { return 0; }
}
function chonCot(n: number): void {
  soCot.value = n;
  kyLuc.value = docKyLuc(n);
  try { localStorage.setItem(KHOA_COT, String(n)); } catch { /* chế độ riêng tư: chỉ không nhớ */ }
}

/** Hình của ván: các theme người chơi đang chọn (chơi được), thiếu thì cả kho miễn phí. */
function bocHinh(): string[] {
  const chon = props.themes.filter((th) => props.themeIds.includes(th.id) && choiDuoc(th));
  const nguon = [...new Set((chon.length ? chon : props.themes.filter(choiDuoc)).flatMap((th) => th.symbols))];
  for (let i = nguon.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nguon[i], nguon[j]] = [nguon[j]!, nguon[i]!];
  }
  return nguon.length >= 2 ? nguon.slice(0, SO_HINH) : ['🐶', '🐱', '🦊', '🐻', '🐼', '🐨'];
}

/* ---------- kích thước giếng ---------- */
const gieng = ref<HTMLElement | null>(null);
const oW = ref(0);
const oH = ref(0);
let ro: ResizeObserver | undefined;
/** Bề ngang ô của lá: không bè hơn dáng `DANG_LA` (4 cột trên máy rộng là ô rất ngang) — lá nằm giữa cột. */
const laW = computed(() => Math.min(oW.value, (oH.value - DEM_DOC) / DANG_LA + DEM_NGANG));
/** Phần chiều cao dư (giếng không chia chẵn thành ô vuông) để trống ở ĐỈNH — lá xếp từ đáy lên. */
const dinh = ref(0);
const coAnh = computed(() => chonCoAnh(Math.min(laW.value, oH.value) * 0.62));
function doGieng(): void {
  const el = gieng.value;
  if (!el) return;
  const w = el.clientWidth, h = el.clientHeight;
  const hang = van.value?.soHang ?? hangChoGieng(w, h, soCot.value);
  oW.value = w / soCot.value;
  // ô CAO đúng bằng cạnh lá (dáng DANG_LA) — không kéo giãn cho kín chiều cao, không thì lá thành chữ nhật đứng
  oH.value = Math.min(h / hang, (oW.value - DEM_NGANG) * DANG_LA + DEM_DOC);
  dinh.value = h - hang * oH.value;
}
watch(soCot, doGieng);

/** Phần trăm đường tới cấp kế (vạch dưới HUD) — nhìn là biết sắp lên cấp, không cần đọc số. */
const tienDoCap = computed(() => {
  void rev.value;
  const v = van.value;
  if (!v) return 0;
  const tu = mocCap(v.cap), den = mocCap(v.cap + 1);
  return Math.max(0, Math.min(1, (v.diem - tu) / (den - tu)));
});
const dsLa = computed(() => { void rev.value; return van.value ? [...van.value.la] : []; });

const elLa = new Map<number, HTMLElement>();
function ganEl(id: number, el: unknown): void {
  if (el instanceof HTMLElement) { elLa.set(id, el); datViTri(el, van.value?.la.find((l) => l.id === id)); } else elLa.delete(id);
}
function datViTri(el: HTMLElement, l: La | undefined): void {
  if (l) el.style.transform = `translate(${l.cot * oW.value + (oW.value - laW.value) / 2}px, ${dinh.value + l.y * oH.value}px)`;
}

/** Chữ ký những gì Vue vẽ — đổi thì mới vẽ lại. */
let chuKy = '';
function kyHieuVe(v: VanMuaThe): string {
  return v.la.map((l) => `${l.id}${v.ngua(l) ? 'u' : ''}${l.chon ? 'c' : ''}${l.an ? 'a' : ''}`).join() + v.cot.map((c) => c.length).join() + v.diem;
}

/* ---------- vòng lặp ---------- */
let raf = 0;
let truoc = 0;
let henDon: ReturnType<typeof setTimeout>[] = [];
function khung(ms: number): void {
  const dt = Math.min(0.05, (ms - truoc) / 1000);
  truoc = ms;
  const v = van.value;
  if (v && buoc.value === 'choi') {
    for (const e of v.buoc(dt)) {
      if (e.loai === 'cham-day') sfx.flip();
      else if (e.loai === 'len-cap') {
        banCap.value = e.cap; sfx.go();
        henDon.push(setTimeout(() => { if (banCap.value === e.cap) banCap.value = null; }, 1600));
      } else if (e.loai === 'thua') ketThuc();
    }
  }
  if (v) {
    for (const l of v.la) { const el = elLa.get(l.id); if (el) datViTri(el, l); }
    const k = kyHieuVe(v);
    if (k !== chuKy) { chuKy = k; rev.value++; }
  }
  raf = requestAnimationFrame(khung);
}

function batDau(): void {
  henDon.forEach(clearTimeout); henDon = [];
  const hinh = bocHinh();
  taiTruocAnh(hinh, coAnh.value);
  const g = gieng.value;
  van.value = new VanMuaThe(hinh, Math.random, soCot.value, g ? hangChoGieng(g.clientWidth, g.clientHeight, soCot.value) : undefined);
  doGieng();
  chuKy = ''; banCap.value = null; bay.value = []; no.value = []; kyLucMoi.value = false;
  buoc.value = 'choi';
  emit('bat-dau', soCot.value);
}

function ketThuc(): void {
  const v = van.value;
  if (!v) return;
  sfx.lifeLost();
  rung.sai();
  emit('ket-thuc', { diem: v.diem, cap: v.cap, soCap: v.soCap, soCot: v.soCot, giay: v.t });
  if (v.diem > kyLuc.value) {
    kyLuc.value = v.diem; kyLucMoi.value = true;
    try { localStorage.setItem(khoaKyLuc(v.soCot), String(v.diem)); } catch { /* chế độ riêng tư: chỉ mất kỷ lục */ }
  }
  henDon.push(setTimeout(() => { if (van.value === v) buoc.value = 'cuoi'; }, 900));
}

function cham(l: La): void {
  const v = van.value;
  if (!v || buoc.value !== 'choi') return;
  const kq = v.cham(l.id);
  if (kq === 'chon') sfx.select();
  else if (kq === 'sai') { sfx.miss(); rung.sai(); } else if (kq === 'an') {
    sfx.match(v.chuoi); rung.ghep(v.chuoi);
    for (const x of v.la) if (x.an && x.sym === l.sym) noTai(x, v.chuoi);
    const id = l.id;
    bay.value = [...bay.value, { id, x: (l.cot + 0.5) * oW.value, y: dinh.value + l.y * oH.value, chu: `+${num(v.vuaCong)}` }];
    henDon.push(setTimeout(() => v.donLaAn(), 350));   // khớp hiệu ứng nổ (.32s)
    henDon.push(setTimeout(() => { bay.value = bay.value.filter((b) => b.id !== id); }, 800));
  }
}

function tamDung(): void { if (buoc.value === 'choi') buoc.value = 'dung'; }
function anTrang(): void { if (document.hidden) tamDung(); }

onMounted(() => {
  ro = new ResizeObserver(doGieng);
  if (gieng.value) ro.observe(gieng.value);
  document.addEventListener('visibilitychange', anTrang);
  raf = requestAnimationFrame((ms) => { truoc = ms; raf = requestAnimationFrame(khung); });
});
onUnmounted(() => {
  ro?.disconnect();
  cancelAnimationFrame(raf);
  henDon.forEach(clearTimeout);
  document.removeEventListener('visibilitychange', anTrang);
});

/** Back của máy / nút thoát: đang chơi thì dừng trước, đứng ở lớp phủ thì ra hẳn. */
defineExpose({ veLai: () => { if (buoc.value === 'choi') tamDung(); else emit('thoat'); } });
</script>

<template>
  <section class="mua-the" :class="{ dau: buoc === 'dau' }">
    <div class="mt-hud">
      <div class="vien diem" :title="t('mt.diem')"><DongXu :size="22" /><b>{{ num(van?.diem ?? 0) }}</b></div>
      <div v-if="van" class="vien cap">{{ t('mt.cap', { n: van.cap }) }}</div>
      <div v-if="van && van.chuoi > 1 && buoc === 'choi'" :key="van.soCap" class="vien combo">×{{ comboMultiplier(van.chuoi).toLocaleString(bcp()) }}</div>
      <span class="gian" />
      <div class="vien nhat" :title="t('mt.kyLuc')"><span aria-hidden="true">🏆</span><b>{{ num(kyLuc) }}</b></div>
      <button class="thach th-nho nut-dung" type="button" :aria-label="t('hud.tamDung')" :disabled="buoc !== 'choi'" @click="tamDung">⏸</button>
    </div>
    <div class="vach-cap" role="progressbar" :aria-label="t('mt.cap', { n: (van?.cap ?? 1) + 1 })" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(tienDoCap * 100)">
      <i :style="{ width: `${tienDoCap * 100}%` }" />
    </div>

    <div ref="gieng" class="gieng" :class="{ dang: buoc === 'choi' }" :style="{ '--o-w': `${oW}px`, '--o-h': `${oH}px`, '--la-w': `${laW}px` }">
      <span class="mua-nen" aria-hidden="true" />
      <span class="san" aria-hidden="true" />
      <div v-for="l in dsLa" :key="l.id" :ref="(el) => ganEl(l.id, el)" class="o" :class="{ roi: l.roi }">
        <button
          class="card" type="button" data-nosfx
          :class="{ lat: van?.ngua(l), chon: l.chon, an: l.an, sai: !!van?.sai(l) }"
          :aria-label="van?.ngua(l) ? l.sym : t('mt.laUp')"
          @pointerdown.prevent="cham(l)"
        >
          <span class="inner">
            <span class="face back" aria-hidden="true" />
            <span class="face front" aria-hidden="true">
              <img v-if="anhEmoji(l.sym, undefined, coAnh)" class="emoji" :src="anhEmoji(l.sym, undefined, coAnh)!" alt="" draggable="false">
              <span v-else class="emoji chu">{{ l.sym }}</span>
            </span>
          </span>
        </button>
      </div>
      <div v-for="x in no" :key="x.id" class="no" :class="{ to: x.to }" :style="{ left: `${x.x}px`, top: `${x.y}px` }" aria-hidden="true">
        <span class="song" /><span class="loe" />
        <span
          v-for="(m, i) in x.manh" :key="i" class="manh" :class="{ sao: m.sao }"
          :style="{ '--dx': `${m.dx}px`, '--dy': `${m.dy}px`, '--co': `${m.co}px`, '--mau': m.mau, '--quay': `${m.quay}deg` }"
        />
      </div>
      <span v-for="b in bay" :key="b.id" class="diem-bay" :style="{ left: `${b.x}px`, top: `${b.y}px` }">{{ b.chu }}</span>
      <!-- KẾT QUẢ: phủ trong khung bàn — bài đã lộ hết vẫn thấy phía sau -->
      <div v-if="buoc === 'cuoi'" class="mt-phu ket" role="dialog" aria-modal="true" aria-labelledby="mtCuoi">
        <div class="hop khay">
          <h2 id="mtCuoi">{{ kyLucMoi ? t('mt.kyLucMoi') : t('mt.thua') }}</h2>
          <p class="so-to"><DongXu :size="40" />{{ num(van?.diem ?? 0) }}</p>
          <p class="phu-chu">{{ t('mt.ketQua', { n: van?.cap ?? 1, cap: van?.soCap ?? 0 }) }}</p>
          <p class="phu-chu">🏆 {{ t('mt.kyLuc') }}: <b>{{ num(kyLuc) }}</b></p>
          <button class="thach th-xanh th-to" type="button" @click="batDau">{{ t('hud.choiLai') }}</button>
          <div class="hang-nut">
            <button class="thach" type="button" @click="van = null; buoc = 'dau'">{{ t('mt.doiCot') }}</button>
            <button class="thach" type="button" @click="emit('thoat')">{{ t('hud.thoat') }}</button>
          </div>
          <p class="mt-goi-y">{{ t('mt.goiY') }}</p>
        </div>
      </div>
      <div v-if="banCap" :key="banCap" class="ban-cap" role="status">
        <b>{{ t('mt.cap', { n: banCap }) }}</b><span>{{ t('mt.nhanhHon') }}</span>
      </div>
    </div>

    <!-- MỞ ĐẦU: trang riêng trên nền Kẹo (không phủ lên bàn trống — bản phủ xám bị chê "lỗi"). Bàn vẫn
         dựng ở dưới (ẩn bằng visibility) để đo được giếng trước khi chia lá. -->
    <div v-if="buoc === 'dau'" class="mt-mo" role="dialog" aria-modal="true" aria-labelledby="mtDau">
      <div class="hop khay mo">
        <button class="thach th-nho nut-x" type="button" :aria-label="t('hud.thoat')" @click="emit('thoat')"><X :size="18" /></button>
        <div class="mua" aria-hidden="true">
          <span v-for="(e, i) in LA_MINH_HOA" :key="e" class="mua-la" :style="{ '--i': i }">
            <img v-if="anhNho(e)" :src="anhNho(e)!" alt=""><template v-else>{{ e }}</template>
          </span>
        </div>
        <h2 id="mtDau" class="mt-ten">{{ t('mt.ten') }}</h2>
        <p class="kl-vien">🏆 <b>{{ num(kyLuc) }}</b></p>
        <!-- Luật MỘT câu (chủ dự án 27.10.2026: "không cần giải thích rườm rà") -->
        <p class="mt-luat">{{ t('mt.moTa') }}</p>
        <div class="chon-cot" role="group" :aria-labelledby="'mtSoCot'">
          <span id="mtSoCot" class="nhan">{{ t('mt.soCot') }}</span>
          <span class="ranh">
            <button
              v-for="n in COT_CHON" :key="n" class="nut-cot" data-phang type="button"
              :aria-pressed="soCot === n" :aria-label="t('mt.cot', { n })" @click="chonCot(n)"
            >
              <b>{{ n }}</b>
            </button>
          </span>
        </div>
        <button class="thach th-xanh th-to" type="button" @click="batDau">{{ t('mt.choi') }}</button>
      </div>
    </div>
    <!-- TẠM DỪNG: phủ KÍN bằng nền đặc (luật chung: kính mờ để lộ bàn bị chê thiếu chuyên nghiệp) -->
    <div v-else-if="buoc === 'dung'" class="mt-phu dac" role="dialog" aria-modal="true" aria-labelledby="mtDung">
      <div class="hop khay">
          <h2 id="mtDung">{{ t('hud.tamDung') }}</h2>
          <button class="thach th-xanh th-to" type="button" @click="buoc = 'choi'">{{ t('hud.choiTiep') }}</button>
          <button class="thach" type="button" @click="emit('thoat')">{{ t('hud.thoat') }}</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mua-the { position: relative; height: 100%; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.mt-hud { display: flex; align-items: center; gap: 6px; flex: none; }
/* Viên số: thạch trắng (điểm, kỷ lục), thạch vàng (cấp), thạch hồng (combo) — cùng chất nút Kẹo */
.vien {
  display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 999px;
  font-family: var(--font-display); font-size: 18px; font-weight: 900; font-variant-numeric: tabular-nums;
  background: linear-gradient(#fff 20%, #e9effc); color: #1d2a5a;
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, .8), 0 3px 0 #b9c6e6, 0 6px 10px rgba(20, 30, 70, .15);
}
.vien.cap { background: linear-gradient(#ffe98a, #ffc21a); color: #5a3500; box-shadow: inset 0 2px 0 rgba(255, 255, 255, .6), 0 3px 0 #d99400, 0 6px 10px rgba(20, 30, 70, .15); }
.vien.nhat { font-size: 15px; padding: 0 12px; }
.vien.combo { background: linear-gradient(#ff9cb2, #ee3a5e); color: #fff; box-shadow: 0 3px 0 #c21f42, 0 6px 10px rgba(20, 30, 70, .15); animation: nay .3s; }
@keyframes nay { 40% { transform: scale(1.25); } }
.gian { flex: 1; }
.nut-dung { min-width: 44px; }

.vach-cap {
  flex: none; height: 10px; margin: -4px 4px 0; border-radius: 999px; overflow: hidden;
  background: color-mix(in srgb, var(--panel, #fff) 55%, transparent); box-shadow: inset 0 2px 3px rgba(20, 30, 70, .2);
}
.vach-cap i {
  display: block; height: 100%; border-radius: inherit; transition: width .35s cubic-bezier(.3, 1.3, .5, 1);
  background: linear-gradient(#ffe98a, #ffc21a 60%, #e9a400); box-shadow: inset 0 2px 0 rgba(255, 255, 255, .6);
}
.gieng {
  position: relative; flex: 1; min-height: 0; overflow: hidden; border-radius: 22px;
  /* giếng trời: trong suốt nhẹ trên nền Kẹo, lõm vào (bóng trong) — không khung trắng đặc */
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel, #fff) 35%, transparent), color-mix(in srgb, var(--panel, #fff) 65%, transparent));
  border: 2px solid color-mix(in srgb, var(--panel, #fff) 80%, transparent);
  box-shadow: inset 0 4px 14px rgba(20, 30, 70, .14);
}
/* mưa nhẹ ở nền — một lớp vẽ sẵn, chỉ TRƯỢT bằng transform (lớp ghép, không vẽ lại mỗi khung) */
.mua-nen {
  position: absolute; left: 0; right: 0; top: -100%; height: 200%; pointer-events: none; opacity: .5;
  /* giọt mưa = elip DỌC nhỏ trong từng ô lặp (linear-gradient vẽ ra sọc NGANG cả bề rộng — đã bị chê) */
  background-image:
    radial-gradient(1.2px 8px at 50% 50%, color-mix(in srgb, #4cc9f0 70%, transparent) 95%, transparent),
    radial-gradient(1px 6px at 50% 50%, color-mix(in srgb, #9fc0ff 70%, transparent) 95%, transparent);
  background-size: 41px 83px, 59px 127px; background-position: 0 0, 23px 47px;
  -webkit-mask: linear-gradient(#000, transparent 85%); mask: linear-gradient(#000, transparent 85%);
}
.gieng.dang .mua-nen { animation: mua-nen 2.4s linear infinite; }
@keyframes mua-nen { to { transform: translateY(50%); } }
/* mép đáy: một gờ thạch mỏng, lá như rơi xuống nền */
.san {
  position: absolute; left: 0; right: 0; bottom: 0; height: 6px; z-index: 1; pointer-events: none;
  background: linear-gradient(color-mix(in srgb, var(--panel, #fff) 90%, transparent), color-mix(in srgb, var(--panel, #fff) 60%, transparent));
  box-shadow: 0 -2px 6px rgba(20, 30, 70, .12);
}
/* lá đang rơi nổi hơn: bóng là lớp RIÊNG dưới lá — `filter` trên lá làm phẳng cú lật 3D (nguy cơ lộ mặt bài) */
.o.roi::before {
  content: ''; position: absolute; left: 10%; right: 10%; bottom: -4px; height: 10px; border-radius: 50%;
  background: rgba(20, 30, 70, .22); filter: blur(4px); z-index: -1;
}

.o { position: absolute; left: 0; top: 0; width: var(--la-w); height: var(--o-h); padding: 2px 4px; box-sizing: border-box; z-index: 2; }
.card {
  position: relative; display: block; width: 100%; height: 100%; padding: 0; border: 0; background: none;
  perspective: 600px; container-type: size; cursor: pointer; touch-action: none; -webkit-tap-highlight-color: transparent;
}
.inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .26s ease; border-radius: inherit; }
.card.lat .inner { transform: rotateY(180deg); }
.face { position: absolute; inset: 0; box-sizing: border-box; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: grid; place-items: center; }
.face.front { transform: rotateY(180deg); }
.emoji { width: 62%; height: 62%; object-fit: contain; pointer-events: none; }
.emoji.chu { width: auto; height: auto; font-size: min(48cqw, 58cqh); line-height: 1; }
.card.chon { box-shadow: 0 0 0 4px #ffc21a, 0 0 16px 4px rgba(255, 194, 26, .7) !important; border-radius: 13px; }
.card.sai { box-shadow: 0 0 0 4px var(--bad, #ff4d6d) !important; }
.card.sai .inner { animation: lac .45s; }
@keyframes lac {
  20% { transform: rotateY(180deg) translateX(-6px); } 40% { transform: rotateY(180deg) translateX(6px); }
  60% { transform: rotateY(180deg) translateX(-4px); } 80% { transform: rotateY(180deg) translateX(3px); }
}
.card.an { pointer-events: none; }
.card.an { z-index: 3; }
/* lá đang nổ: BỎ bóng/viền của chính khung lá (skin Kẹo đặt box-shadow !important trên .card) — nó không co
   theo .inner nên từng nằm lại thành cái viền trống tới khi lá bị gỡ. `.o` để thắng độ đặc hiệu của skin. */
.o .card.an, .o .card.an.chon { box-shadow: none !important; }
.card.an .inner { animation: phong .32s cubic-bezier(.3, 1.4, .5, 1) forwards; }
.card.an .face.front { animation: sang .32s forwards; }
@keyframes phong { 35% { transform: rotateY(180deg) scale(1.22); } 100% { transform: rotateY(180deg) scale(.2); opacity: 0; } }
@keyframes sang { 30% { filter: brightness(1.6) saturate(1.3); } 100% { filter: brightness(2); } }

/* vụ nổ: tâm ở (left, top) */
.no { position: absolute; width: 0; height: 0; z-index: 4; pointer-events: none; }
.no .song {
  position: absolute; left: 0; top: 0; width: calc(var(--o-w) * 1.4); aspect-ratio: 1; translate: -50% -50%; border-radius: 50%;
  border: 5px solid #fff; box-shadow: 0 0 12px #ffe66b, inset 0 0 10px #ffe66b; animation: song .45s ease-out forwards;
}
.no.to .song { border-color: #ffe66b; width: calc(var(--o-w) * 2); }
@keyframes song { from { scale: .2; opacity: 1; } to { scale: 1.6; opacity: 0; } }
.no .loe {
  position: absolute; left: 0; top: 0; width: calc(var(--o-w) * 1.3); aspect-ratio: 1; translate: -50% -50%; border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, #fff6b0 35%, transparent 70%); animation: loe .3s ease-out forwards;
}
@keyframes loe { from { scale: .3; opacity: 1; } to { scale: 1.4; opacity: 0; } }
.no .manh {
  position: absolute; left: 0; top: 0; width: var(--co); height: var(--co); translate: -50% -50%; border-radius: 50%;
  background: var(--mau); box-shadow: inset 0 -2px 0 rgba(0, 0, 0, .18), inset 0 2px 0 rgba(255, 255, 255, .5);
  animation: manh .65s cubic-bezier(.15, .7, .4, 1) forwards;
}
.no .manh.sao {
  border-radius: 0; box-shadow: none;
  clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
}
@keyframes manh {
  0% { transform: translate(0, 0) rotate(0) scale(.4); opacity: 1; }
  60% { opacity: 1; }
  100% { transform: translate(var(--dx), calc(var(--dy) + var(--o-h) * .35)) rotate(var(--quay)) scale(1); opacity: 0; }
}

.diem-bay {
  position: absolute; z-index: 5; translate: -50% 0; pointer-events: none; color: #fff; font-size: 24px; font-weight: 900;
  -webkit-text-stroke: 2px #c22a63; paint-order: stroke; animation: bay .8s forwards;
}
@keyframes bay { to { transform: translateY(-50px); opacity: 0; } }
.ban-cap {
  position: absolute; left: 50%; top: 38%; z-index: 6; translate: -50% -50%; pointer-events: none;
  display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px 22px; border-radius: 20px;
  background: var(--nhan-nen, #ffc21a); color: var(--nhan-chu, #1d2a5a); box-shadow: 0 5px 0 rgba(20, 30, 70, .25);
  animation: hien-cap 1.6s forwards;
}
.ban-cap b { font-size: 30px; line-height: 1; }
.ban-cap span { font-weight: 800; }
@keyframes hien-cap { 0% { scale: .4; opacity: 0; } 15% { scale: 1.1; opacity: 1; } 25%, 80% { scale: 1; opacity: 1; } 100% { scale: 1; opacity: 0; } }

/* màn mở đầu: bàn + HUD vẫn dựng (để đo) nhưng ẩn */
.mua-the.dau > :not(.mt-mo) { visibility: hidden; }
.mt-mo { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; }
.mt-phu { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; padding: 10px; }
.mt-phu.dac { inset: -12px; padding: 22px; background: var(--canh, var(--nen-man, var(--bg))); background-size: cover; }
.mt-phu.ket { border-radius: inherit; background: color-mix(in srgb, #0d1838 35%, transparent); }
.mua-the .thach { border-radius: 16px; }
.mua-the .th-nho { border-radius: 12px; }
.hop {
  width: 100%; max-width: 380px; max-height: 100%; overflow: hidden; box-sizing: border-box;
  display: flex; flex-direction: column; gap: clamp(6px, 1.6vh, 12px); padding: 18px 18px 16px; text-align: center;
}
.hop h2 { margin: 0; font-size: 30px; line-height: 1.1; text-wrap: balance; }
.hop .thach { min-height: 48px; font-size: 17px; }
.hop .th-to { min-height: 56px; font-size: 22px; }
.hang-nut { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mt-ten { font-family: var(--font-display); font-size: clamp(34px, 6vh, 46px) !important; color: #2f4fa6; letter-spacing: .01em; }
:root[data-theme='dark'] .mt-ten { color: #9fc0ff; }

/* ba lá rơi lơ lửng trên tiêu đề */
.mua { position: relative; height: clamp(56px, 11vh, 86px); margin: -4px 0 -6px; }
.mua-la {
  position: absolute; top: 0; left: calc(50% + (var(--i) - 1) * 62px); width: clamp(40px, 8vh, 58px); aspect-ratio: 1;
  translate: -50% 0; display: grid; place-items: center; border-radius: 12px; font-size: 26px;
  background: radial-gradient(110% 80% at 50% 35%, #fffdf2, #fff1c9 90%); border: 2.5px solid #6d8fdc;
  box-shadow: 0 2px 0 #4563ad, 0 6px 10px rgba(20, 30, 70, .2);
  rotate: calc((var(--i) - 1) * 10deg); animation: troi 2.4s ease-in-out infinite alternate; animation-delay: calc(var(--i) * -.8s);
}
.mua-la:nth-child(2) { top: 10px; }
.mua-la img { width: 66%; height: 66%; object-fit: contain; }
@keyframes troi { from { transform: translateY(-4px); } to { transform: translateY(8px); } }

.hop.mo { position: relative; gap: clamp(10px, 2.2vh, 16px); padding-top: 14px; }
.nut-x { position: absolute; top: 10px; right: 10px; width: 36px; height: 36px; min-width: 0; min-height: 0 !important; padding: 0; display: grid; place-items: center; border-radius: 50% !important; }
.nut-x::after { content: ''; position: absolute; inset: -4px; }
.kl-vien {
  align-self: center; margin: -6px 0 0; padding: 3px 14px; border-radius: 999px; font-weight: 800; font-size: 15px;
  background: color-mix(in srgb, #ffc21a 22%, transparent); color: var(--fg);
}
.mt-luat { margin: 0; font-weight: 800; font-size: 17px; line-height: 1.3; text-wrap: balance; }
/* chọn số cột: nhãn trên, rãnh rộng hết khung, ba nút chia đều */
.chon-cot { display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
.chon-cot .nhan { font-weight: 800; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.ranh {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px; padding: 3px; border-radius: 999px;
  background: var(--k-mem, var(--panel-soft)); border: 2px solid var(--t3, var(--line));
  box-shadow: inset 0 2px 4px rgba(29, 42, 90, .14);
}
.nut-cot {
  position: relative; display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; padding: 0 8px;
  border: 1.5px solid transparent; border-radius: 999px; background: none; color: var(--fg); font: inherit; cursor: pointer;
}
.nut-cot[aria-pressed='true'] {
  border-color: #33861a; color: #fff; background: linear-gradient(#a3ec72 -40%, #46ad22 70%); text-shadow: 0 1px 0 #23600f;
  box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, .45), 0 2px 0 #33861a, 0 3px 5px rgba(10, 20, 60, .18);
}
.nut-cot b { font-size: 18px; font-weight: 900; }
.so-to { margin: 0; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 56px; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
.phu-chu { margin: 0; font-weight: 700; color: var(--muted); }
.phu-chu b { color: var(--fg); }
.mt-goi-y { margin: 0; font-size: 12px; color: var(--muted); }
@media (prefers-reduced-motion: reduce) {
  .inner { transition-duration: .01s; }
    .no .manh, .no .song { display: none; }
  .mua-la { animation: none; }
  .gieng.dang .mua-nen { animation: none; }
}
</style>
