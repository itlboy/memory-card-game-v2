<script setup lang="ts">
/**
 * HỒ SƠ NGƯỜI CHƠI (25.11.2026, mockup duyệt https://claude.ai/artifact/TEoguR6Vy3GDoLpFcyx8go) — tên + avatar + màu.
 *  · `kieu = 'chao'`: màn chào BẮT BUỘC trước trang chủ — không nút đóng, không Back; "Vào chơi" chỉ bấm được khi đã
 *    gõ tên. Ô tên trống với người mới và người cũ còn mang tên tự sinh (`tenDienSan`).
 *  · `kieu = 'sua'`: tấm trượt từ đáy để đổi lại bất cứ lúc nào (mở từ menu).
 * Lưới avatar CHIA TRANG 18 con, VUỐT NGANG (scroll-snap, mép phải ló trang sau để biết còn nữa); chạm chấm để nhảy
 * trang; máy dùng chuột có thêm hai nút nhỏ ‹ › ở hai đầu hàng chấm (chủ dự án: nút to xấu, chỉ cho trình duyệt).
 */
import { ChevronLeft, ChevronRight, Pencil, Check, X } from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref } from 'vue';
import { t } from '@/lib/i18n';
import { AVATAR_HO_SO, MAU_HO_SO, hoSo, luuHoSo, tenDienSan } from '@/lib/ho-so';
import { DO_DAI_TOI_DA } from '@/lib/ten-goc';
import { guiHoSo, me, san } from '@/lib/taikhoan';
import { ChevronRight as Toi } from 'lucide-vue-next';

const props = defineProps<{ kieu: 'chao' | 'sua' }>();
const emit = defineEmits<{ xong: []; 'tai-khoan': [] }>();

const ten = ref(tenDienSan());
const mat = ref(hoSo.value.mat);
const mau = ref(hoSo.value.mau);
const coTen = computed(() => ten.value.trim().length > 0);

const MOI = 18;
const trang = Array.from({ length: Math.ceil(AVATAR_HO_SO.length / MOI) }, (_, k) => AVATAR_HO_SO.slice(k * MOI, k * MOI + MOI));
const truot = ref<HTMLElement | null>(null);
const trangHien = ref(0);
const buoc = (): number => {
  const el = truot.value;
  const ls = el?.children;
  return ls && ls.length > 1 ? (ls[1] as HTMLElement).offsetLeft - (ls[0] as HTMLElement).offsetLeft : 1;
};
function khiCuon(): void {
  if (truot.value) trangHien.value = Math.round(truot.value.scrollLeft / buoc());
}
function den(k: number, muot = true): void {
  const n = Math.min(trang.length - 1, Math.max(0, k));
  truot.value?.scrollTo({ left: n * buoc(), behavior: muot ? 'smooth' : 'auto' });
}

const oTen = ref<HTMLInputElement | null>(null);
onMounted(async () => {
  await nextTick();
  den(Math.floor(Math.max(0, AVATAR_HO_SO.indexOf(mat.value)) / MOI), false);
  khiCuon();
  if (props.kieu === 'chao' && !coTen.value) oTen.value?.focus({ preventScroll: true });
});

function luu(): void {
  if (!coTen.value) { oTen.value?.focus(); return; }
  luuHoSo(ten.value, mat.value, mau.value);
  void guiHoSo();   // lên bảng xếp hạng (khách: kèm lần gửi điểm; đăng nhập: /api/me/ho-so)
  emit('xong');
}
function dong(): void { if (props.kieu === 'sua') emit('xong'); }
</script>

<template>
  <div class="overlay hs-phu" :class="kieu" role="dialog" aria-modal="true" aria-labelledby="hsTieuDe" @keydown.esc="dong" @click.self="dong">
    <div class="panel hs" :style="{ '--m': mau }">
      <span v-if="kieu === 'sua'" class="keo" aria-hidden="true" />
      <header class="hs-dau">
        <h2 id="hsTieuDe">{{ kieu === 'chao' ? t('hs.chao') : t('hs.hoSo') }}</h2>
        <button v-if="kieu === 'sua'" class="btn hs-dong" type="button" :aria-label="t('dhd.dong')" @click="dong"><X :size="20" /></button>
      </header>
      <p v-if="kieu === 'chao'" class="hs-phu-de">{{ t('hs.chaoPhu') }}</p>

      <div class="hs-dau-hang">
        <span class="av-lon" aria-hidden="true">{{ mat }}<i v-if="kieu === 'chao'" class="huy"><Pencil :size="14" :stroke-width="2.8" /></i></span>
        <label class="o-ten">
          <span class="sr-only">{{ t('hs.ten') }}</span>
          <input
            ref="oTen" v-model="ten" type="text" :maxlength="DO_DAI_TOI_DA" autocomplete="nickname" enterkeyhint="done"
            :placeholder="t('hs.nhapTen')" @keydown.enter.prevent="luu"
          >
          <i aria-hidden="true">{{ ten.length }}/{{ DO_DAI_TOI_DA }}</i>
        </label>
      </div>

      <p class="nhan">{{ t('hs.avatar') }} <span>· {{ AVATAR_HO_SO.length }}</span></p>
      <div ref="truot" class="truot" @scroll.passive="khiCuon">
        <div v-for="(ds, k) in trang" :key="k" class="luoi" role="radiogroup" :aria-label="t('hs.trangN', { n: k + 1 })">
          <button
            v-for="a in ds" :key="a" data-phang type="button" role="radio" class="o-av" :class="{ chon: a === mat }"
            :aria-checked="a === mat" :aria-label="a" @click="mat = a"
          >{{ a }}</button>
        </div>
      </div>
      <div class="cham">
        <button data-phang class="lat-nho" type="button" :aria-label="t('hs.trangTruoc')" :disabled="trangHien === 0" @click="den(trangHien - 1)"><ChevronLeft :size="13" :stroke-width="3" /></button>
        <button
          v-for="(_, k) in trang" :key="k" data-phang type="button" class="ch" :class="{ on: k === trangHien }"
          :aria-label="t('hs.trangN', { n: k + 1 })" :aria-current="k === trangHien" @click="den(k)"
        />
        <button data-phang class="lat-nho" type="button" :aria-label="t('hs.trangSau')" :disabled="trangHien === trang.length - 1" @click="den(trangHien + 1)"><ChevronRight :size="13" :stroke-width="3" /></button>
      </div>

      <p class="nhan">{{ t('hs.mau') }}</p>
      <div class="mau" role="radiogroup" :aria-label="t('hs.mau')">
        <button
          v-for="c in MAU_HO_SO" :key="c" data-phang type="button" role="radio" class="o-mau" :class="{ chon: c === mau }"
          :style="{ '--c': c }" :aria-checked="c === mau" :aria-label="c" @click="mau = c"
        ><Check v-if="c === mau" :size="15" :stroke-width="3.4" aria-hidden="true" /></button>
      </div>

      <!-- TÀI KHOẢN (25.11.2026, mockup A): gộp vào đây — đã đăng nhập: ảnh + tên Google → trang tài khoản; chưa: nút đăng nhập -->
      <button v-if="kieu === 'sua' && san" class="hs-tk thach" type="button" @click="emit('tai-khoan')">
        <img v-if="me?.avatar" class="hs-tk-anh" :src="me.avatar" alt="" referrerpolicy="no-referrer">
        <span class="hs-tk-chu"><b>{{ me ? me.name : t('hs.dangNhapLuu') }}</b><small>{{ me ? t('hs.tkPhu') : t('tb.giuDiem') }}</small></span>
        <Toi :size="18" aria-hidden="true" />
      </button>

      <button class="btn btn-primary hs-vao" type="button" :class="{ tat: !coTen }" :aria-disabled="!coTen" @click="luu">
        {{ kieu === 'chao' ? t('hs.vaoChoi') : t('hs.luu') }}
      </button>
      <p v-if="!coTen" class="hs-goi-y" role="status">{{ t('hs.goTen') }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Lớp phủ RIÊNG (`.overlay` của mỗi hộp thoại là scoped, không có luật chung) — thiếu nó thì hộp nằm thẳng trong
   trang, không phủ, không mờ, rơi xuống cuối (chủ dự án gửi ảnh 25.11.2026). Màn chào ở GIỮA, nền mờ hẳn. */
.hs-phu {
  position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(10, 12, 32, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.hs-phu.sua { align-items: flex-end; padding: 0; }
.hs {
  width: min(420px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
  padding: 16px 14px 14px; background: var(--panel-solid, #fff); border-radius: 26px;
}
/* Hộp thấp hơn nội dung thì CUỘN, không bóp con (ô tên từng bị bẹp còn ~36px) */
.hs > * { flex-shrink: 0; }
.sua .hs { border-radius: 24px 24px 0 0; padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px)); }
.keo { align-self: center; width: 40px; height: 5px; border-radius: 3px; background: color-mix(in srgb, var(--fg) 18%, transparent); margin: -6px 0 -2px; }
.hs-dau { display: flex; align-items: center; justify-content: center; gap: 8px; position: relative; min-height: 32px; }
.sua .hs-dau { justify-content: flex-start; }
.hs-dau h2 { margin: 0; font-size: var(--text-xl, 22px); }
.hs-dong { position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; min-height: 36px; padding: 0; display: grid; place-items: center; }
.hs-phu-de { margin: -6px 0 0; text-align: center; font-size: 13px; font-weight: 700; color: var(--muted); }

.hs-dau-hang { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.sua .hs-dau-hang { flex-direction: row; }
.av-lon {
  position: relative; flex: none; width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; font-size: 40px; line-height: 1;
  background: color-mix(in srgb, var(--m) 18%, var(--panel-solid, #fff));
  box-shadow: 0 0 0 5px var(--m), 0 5px 0 5px color-mix(in srgb, var(--m) 60%, #000);
  margin: 6px 0 8px;
}
.sua .av-lon { width: 60px; height: 60px; font-size: 34px; margin: 4px 6px 8px 4px; }
.huy { position: absolute; right: -6px; bottom: -4px; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--m); color: #fff; border: 3px solid var(--panel-solid, #fff); }
.o-ten { align-self: stretch; flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 14px 0 16px; border-radius: 16px;
  background: color-mix(in srgb, var(--fg) 6%, var(--panel-solid, #fff));
  border: 2px solid color-mix(in srgb, var(--m) 55%, transparent);
  box-shadow: inset 0 2px 0 color-mix(in srgb, var(--fg) 8%, transparent); transition: border-color .15s, box-shadow .15s; }
.chao .o-ten { flex: none; }   /* cột dọc: `flex: 1` (basis 0) bóp mất chiều cao 52px — chủ dự án: "input bé hơn cả text" */
.o-ten:focus-within { border-color: var(--m); box-shadow: inset 0 2px 0 color-mix(in srgb, var(--fg) 8%, transparent), 0 0 0 4px color-mix(in srgb, var(--m) 25%, transparent); }
.o-ten input { flex: 1; min-width: 0; height: 100%; border: 0; background: none; outline: none; color: var(--fg); font: 800 19px/1.2 var(--font-display); padding: 0; }
.o-ten input::placeholder { color: var(--muted); font-weight: 700; font-size: 15px; }
.o-ten i { flex: none; font-style: normal; font-size: 11px; font-weight: 800; color: var(--muted); }

.nhan { margin: 2px 0 -4px; font: 800 12px/1 var(--font-display); text-transform: uppercase; letter-spacing: .03em; color: var(--muted); }
.nhan span { text-transform: none; letter-spacing: 0; }
.truot { display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain;
  margin: 0 -14px; padding: 2px 14px; scroll-padding-inline: 14px; }
.truot::-webkit-scrollbar { display: none; }
.luoi { flex: 0 0 88%; scroll-snap-align: start; display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; }
.o-av { aspect-ratio: 1; min-width: 0; min-height: 0; padding: 0; border-radius: 11px; display: grid; place-items: center; font-size: 22px; line-height: 1; cursor: pointer;
  background: color-mix(in srgb, var(--fg) 6%, transparent); border: 2px solid transparent; }
.o-av.chon { border-color: var(--m); background: color-mix(in srgb, var(--m) 22%, transparent); box-shadow: 0 3px 0 color-mix(in srgb, var(--m) 55%, #000); }
.cham { display: flex; justify-content: center; align-items: center; gap: 6px; min-height: 22px; }
.ch { width: 7px; height: 7px; min-width: 0; min-height: 0; padding: 0; border: 0; border-radius: 50%; cursor: pointer; transition: width .2s;
  background: color-mix(in srgb, var(--fg) 20%, transparent); }
.ch.on { width: 18px; border-radius: 4px; background: var(--m); }
.lat-nho { display: none; width: 22px; height: 22px; min-width: 0; min-height: 0; padding: 0; border-radius: 50%; place-items: center; cursor: pointer; margin: 0 6px;
  color: var(--muted); background: color-mix(in srgb, var(--fg) 5%, transparent); border: 1.5px solid color-mix(in srgb, var(--fg) 15%, transparent); }
.lat-nho:disabled { opacity: .3; cursor: default; }
.lat-nho:not(:disabled):hover { color: var(--fg); border-color: var(--m); }
@media (hover: hover) and (pointer: fine) { .lat-nho { display: grid; } }

.mau { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px 14px; padding: 0 12px; }
.o-mau { aspect-ratio: 1; min-width: 0; min-height: 0; padding: 0; border: 0; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: #fff;
  background: var(--c); box-shadow: 0 3px 0 color-mix(in srgb, var(--c) 55%, #000); }
.o-mau.chon { outline: 3px solid var(--fg); outline-offset: 2px; }

.hs-tk { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 8px 12px; border-radius: 14px; text-align: left; cursor: pointer; color: var(--fg); }
.hs-tk-anh { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex: none; }
.hs-tk-chu { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.hs-tk-chu b { font: 800 15px/1.2 var(--font-display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hs-tk-chu small { font-size: 12px; font-weight: 700; color: var(--muted); }
.hs-vao { margin-top: 6px; min-height: 50px; font-size: 19px; }
.hs-vao.tat { filter: grayscale(1); opacity: .55; }
.hs-goi-y { margin: -4px 0 0; text-align: center; font-size: 12px; font-weight: 800; color: var(--muted); }
@media (prefers-reduced-motion: reduce) { .ch { transition: none; } }
</style>
