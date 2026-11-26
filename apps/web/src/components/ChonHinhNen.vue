<script setup lang="ts">
import { vChamNgoai } from '@/lib/cham-ngoai';
/**
 * CHỌN HÌNH NỀN (26.11.2026) — mở từ dòng "Hình nền" trong menu ☰ (chủ dự án duyệt: đặt ngay dưới "Giao diện" cho dễ
 * thấy). Hai CẢNH TRỌN BỘ (Thiên hà, Hoa anh đào) là hai ô lớn ở trên; hành tinh + mặc định là lưới nhỏ bên dưới.
 * NGƯỜI CHƯA CÓ PREMIUM bấm hình khoá (đeo vương miện) → đóng bảng này, mở bảng Premium với đúng hình đó ở đầu bảng
 * (chủ dự án: "người dùng free bấm vào sẽ yêu cầu nâng cấp"). Có Premium thì áp ngay, bảng vẫn mở để đổi tiếp.
 */
import { Check, Crown, X } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { moChucNang } from '@/lib/phan-tich';
import { t, td } from '@/lib/i18n';
import { daMuaPremium, moPremium } from '@/lib/premium';
import { CANH, CANH_TRON_BO, canh, datCanh, type Canh } from '@/lib/canh';

const emit = defineEmits<{ close: [] }>();
const TRON_BO = CANH.filter((c) => CANH_TRON_BO.has(c));
const CON_LAI = CANH.filter((c) => !CANH_TRON_BO.has(c));
const khoa = (c: Canh): boolean => c !== 'goc' && !daMuaPremium.value;
const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => { nutDong.value?.focus(); moChucNang('hinh_nen_mo'); });

function chon(c: Canh): void {
  if (khoa(c)) { moChucNang('premium_nen_khoa', { canh: c }); emit('close'); moPremium('nen', c); return; }
  if (canh.value !== c) datCanh(c);
}
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="hnTitle" @keydown.esc="emit('close')" @click.self="emit('close')" v-cham-ngoai="() => emit('close')">
    <div class="panel hn">
      <header>
        <h2 id="hnTitle">{{ t('pm.s.nen') }}</h2>
        <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')"><X :size="20" /></button>
      </header>
      <div class="hn-lon">
        <button v-for="c in TRON_BO" :key="c" data-phang class="o lon" type="button" :aria-pressed="canh === c" @click="chon(c)">
          <span class="anh" :class="c" aria-hidden="true"><i class="l1" /><i class="l2" /><i class="l3" /></span>
          <span class="ten"><b>{{ td(`pm.nen.${c}`) }}</b><small>{{ td(`hn.mt.${c}`) }}</small></span>
          <span v-if="khoa(c)" class="vm" :aria-label="t('tp.premium')"><Crown :size="13" :stroke-width="2.8" aria-hidden="true" /></span>
          <span v-else-if="canh === c" class="dang" aria-hidden="true"><Check :size="14" :stroke-width="3.4" /></span>
        </button>
      </div>
      <div class="hn-nho">
        <button v-for="c in CON_LAI" :key="c" data-phang class="o" type="button" :aria-pressed="canh === c" @click="chon(c)">
          <span class="anh" :class="c" :style="c !== 'goc' ? { '--ht': `var(--ht-${c})` } : undefined" aria-hidden="true" />
          <span class="ten"><b>{{ td(`pm.nen.${c}`) }}</b></span>
          <span v-if="khoa(c)" class="vm" :aria-label="t('tp.premium')"><Crown :size="12" :stroke-width="2.8" aria-hidden="true" /></span>
          <span v-else-if="canh === c" class="dang" aria-hidden="true"><Check :size="13" :stroke-width="3.4" /></span>
        </button>
      </div>
      <p v-if="!daMuaPremium" class="hn-chu"><Crown :size="14" :stroke-width="2.8" aria-hidden="true" />{{ t('hn.canPremium') }}</p>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(10, 12, 32, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.hn {
  --vang: #f0b429; --ke: #e3e7f5;
  width: min(410px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
  padding: 16px; background: var(--panel-solid, #fff); border-radius: 28px;
}
:global([data-theme='dark'] .hn) { --ke: #343c80; }
.hn > * { flex-shrink: 0; }
.hn header { display: flex; align-items: center; justify-content: space-between; }
.hn h2 { margin: 0; font-size: var(--text-xl); }
.hn-lon { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.hn-nho { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.o { position: relative; display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 5px 5px 8px; border: 2px solid var(--ke); border-radius: 18px; background: none; color: inherit; cursor: pointer; text-align: center; }
.o[aria-pressed='true'] { border-color: var(--vang); box-shadow: 0 3px 0 color-mix(in srgb, var(--vang) 55%, transparent); }
.anh { position: relative; display: block; overflow: hidden; border-radius: 13px; aspect-ratio: 5 / 4; background: linear-gradient(#0a1238, #1c2a70); }
.o.lon .anh { aspect-ratio: 4 / 5; }
.anh i { position: absolute; }
.ten { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding-inline: 2px; }
.ten b { font: 800 13px/1.2 var(--font-body); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.o.lon .ten b { font-size: 15px; }
.ten small { font: 600 11.5px/1.3 var(--font-body); color: var(--muted); text-wrap: balance; }
.vm, .dang { position: absolute; top: 10px; right: 10px; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; }
.vm { background: linear-gradient(180deg, #ffe08a, #f5b324); color: #5b3d00; box-shadow: 0 2px 0 #c98f12; }
.dang { background: #1f9d6b; color: #fff; }
/* Hành tinh: đĩa hành tinh trên trời đêm · Mặc định: mặt trời trên trời xanh */
.hn-nho .anh { background: var(--ht) center / 62% no-repeat, linear-gradient(#0a1238, #1c2a70); }
.hn-nho .anh.sao-tho { background-size: 88%, auto; }
.hn-nho .anh.goc { background: radial-gradient(circle at 70% 34%, #ffe066 0 15%, rgba(255, 232, 130, .5) 16% 26%, transparent 27%), radial-gradient(90% 50% at 30% 118%, #5cc23f 60%, transparent 61%), linear-gradient(#45b3ef, #b5e8ff); }
/* THIÊN HÀ thu nhỏ: trời xanh thẳm, Sao Thổ, một lá bài trong quỹ đạo */
.anh.thien-ha { background: radial-gradient(60% 30% at 20% 30%, rgba(60, 200, 255, .3), transparent 72%), radial-gradient(70% 30% at 90% 60%, rgba(80, 110, 255, .35), transparent 72%), linear-gradient(#030719, #0d2466 70%, #153a8c); }
.anh.thien-ha .l1 { right: -14%; top: 4%; width: 74%; aspect-ratio: 3 / 2; background: var(--ht-sao-tho) center / contain no-repeat; }
.anh.thien-ha .l2 { left: 8%; top: 52%; width: 84%; aspect-ratio: 3 / 1; border-radius: 50%; border: 2px solid rgba(255, 255, 255, .7); rotate: -14deg; box-shadow: 0 0 8px rgba(130, 200, 255, .9); }
.anh.thien-ha .l3 { left: 36%; top: 44%; width: 28%; aspect-ratio: 3 / 4; border-radius: 16%; border: 2px solid #5f9bff; background: linear-gradient(#fffdf2, #fff1c9); rotate: 4deg; box-shadow: 0 0 10px rgba(130, 200, 255, .9); }
/* HOA ANH ĐÀO thu nhỏ: trời hồng, mặt trời, núi tuyết, hai lá bài đang rơi */
.anh.anh-dao { background: radial-gradient(circle at 78% 20%, #fffbe8 0 9%, rgba(255, 248, 214, .6) 10% 20%, transparent 21%), linear-gradient(#ff9fc0, #ffc1d4 45%, #ffe9d6); }
.anh.anh-dao .l1 { left: 10%; bottom: 0; width: 80%; aspect-ratio: 2 / 1; background: linear-gradient(#d98ab6, rgba(246, 195, 216, 0)); clip-path: polygon(0 100%, 30% 40%, 43% 15%, 50% 11%, 57% 15%, 70% 40%, 100% 100%); }
.anh.anh-dao .l2 { left: 14%; top: 22%; width: 22%; aspect-ratio: 3 / 4; border-radius: 16%; border: 2px solid #fff; background: linear-gradient(155deg, #ff9dc0, #e2558c); rotate: -22deg; }
.anh.anh-dao .l3 { left: 56%; top: 46%; width: 16%; aspect-ratio: 3 / 4; border-radius: 16%; border: 2px solid #fff; background: linear-gradient(155deg, #ff9dc0, #e2558c); rotate: 26deg; opacity: .85; }
.hn-chu { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 0; color: var(--muted); font: 700 12.5px/1.35 var(--font-body); text-align: center; }
.hn-chu svg { flex: none; color: #d99a00; }
</style>
