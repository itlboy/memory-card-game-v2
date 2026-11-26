<script setup lang="ts">
import { vChamNgoai } from '@/lib/cham-ngoai';
/**
 * CHỌN NHẠC NỀN (26.11.2026) — mở từ dòng "Nhạc nền" trong menu ☰, Y NHƯ bảng "Hình nền" (ChonHinhNen.vue). Chủ dự án:
 * "nhạc nền bấm vào tôi cũng muốn ra trang settings giống như hình nền để người dùng chọn các bản premium".
 * Thay bộ lật ‹ bài › trong menu: lật từng bài một thì người chơi không thấy cả danh sách, bài Premium nằm khuất.
 *
 * Bày ĐỦ mọi bài (kể cả bài Premium chưa mua — như bảng hình nền bày đủ ba hình), không theo `baiHien`.
 * Bấm bài chơi được → ĐỔI NHẠC NGAY (nghe luôn), bảng vẫn mở để thử bài khác. Bài KHOÁ (đeo vương miện) → đóng bảng
 * này, mở bảng Premium ở mục nhạc. Tên bài lấy lại từ nhãn aria sẵn có (`tb.nhacBai.*` = "Nhạc nền: Vui (marimba)"),
 * cắt phần trước dấu hai chấm — khỏi thêm 5 khoá × 15 ngôn ngữ chỉ để lặp lại cùng một chữ.
 */
import { Check, Crown, Shuffle, VolumeX, X } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { moChucNang } from '@/lib/phan-tich';
import { t, td } from '@/lib/i18n';
import { moPremium } from '@/lib/premium';
import { BAI_NHAC, BAI_PREMIUM, ICON_BAI, baiChoiDuoc, type BaiNhac } from '@/lib/nhac';

const props = defineProps<{ nhac: boolean; bai: BaiNhac; ngauNhien?: boolean }>();
const emit = defineEmits<{ close: []; chon: ['off' | 'nn' | BaiNhac] }>();
const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => { nutDong.value?.focus(); moChucNang('nhac_nen_mo'); });

const dangChon = (b: 'off' | BaiNhac): boolean => (b === 'off' ? !props.nhac : props.nhac && props.bai === b);
/** "Nhạc nền: Vui (marimba)" → "Vui": bỏ phần trước dấu hai chấm (Latin lẫn toàn chiều 日本語/中文) VÀ phần trong ngoặc
 *  (chủ dự án 26.11.2026: "bỏ cái trong ngoặc đi" — tên nhạc cụ làm dòng dài mà không giúp chọn). Nhãn aria vẫn đủ. */
const ten = (b: BaiNhac): string => {
  const s = td(`tb.nhacBai.${b}`).replace(/^[^:：]*[:：]\s*/, '').replace(/\s*[（(][^）)]*[）)]\s*$/, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
function chon(b: 'off' | 'nn' | BaiNhac): void {
  if (b !== 'off' && b !== 'nn' && !baiChoiDuoc(b)) { moChucNang('premium_nhac_khoa', { bai: b }); emit('close'); moPremium('nhac', b); return; }
  emit('chon', b);
}
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="cnTitle" @keydown.esc="emit('close')" @click.self="emit('close')" v-cham-ngoai="() => emit('close')">
    <div class="panel cn">
      <header>
        <h2 id="cnTitle">{{ t('tb.nhacNen') }}</h2>
        <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')"><X :size="20" /></button>
      </header>
      <div class="cn-ds" role="radiogroup" :aria-labelledby="'cnTitle'">
        <button class="dong thach" :class="{ chon: dangChon('off') }" type="button" role="radio" :aria-checked="dangChon('off')" @click="chon('off')">
          <span class="ic tat" aria-hidden="true"><VolumeX :size="20" :stroke-width="2.4" /></span>
          <b>{{ td('tb.amNgan.off') }}</b>
          <span v-if="dangChon('off')" class="dang" aria-hidden="true"><Check :size="14" :stroke-width="3.4" /></span>
        </button>
        <!-- NGẪU NHIÊN (26.11.2026): mỗi lần mở app / về trang chủ sau một ván đổi sang một bài khác trong các bài CHƠI ĐƯỢC
             (App.vue `doiNhacNgauNhien`). Đang bật: dấu ✓ ở dòng này, bài đang phát chỉ còn viền vàng. -->
        <button class="dong thach" :class="{ chon: nhac && ngauNhien }" type="button" role="radio" :aria-checked="nhac && !!ngauNhien" @click="chon('nn')">
          <span class="ic nn" aria-hidden="true"><Shuffle :size="20" :stroke-width="2.4" /></span>
          <span class="hai"><b>{{ t('cn.ngauNhien') }}</b><small>{{ t('cn.ngauNhienNhac') }}</small></span>
          <span v-if="nhac && ngauNhien" class="dang" aria-hidden="true"><Check :size="14" :stroke-width="3.4" /></span>
        </button>
        <button
          v-for="b in BAI_NHAC" :key="b" class="dong thach" :class="{ chon: dangChon(b) }" type="button" role="radio"
          :aria-checked="dangChon(b)" :aria-label="BAI_PREMIUM.has(b) ? `${td(`tb.nhacBai.${b}`)} — ${t('tp.premium')}` : td(`tb.nhacBai.${b}`)" @click="chon(b)"
        >
          <span class="ic" :class="b" aria-hidden="true"><component :is="ICON_BAI[b]" :size="20" :stroke-width="2.4" /></span>
          <b>{{ ten(b) }}</b>
          <!-- Vương miện ở MỌI bài Premium, kể cả khi đã có Premium (chủ dự án 26.11.2026: "tính năng premium nào cần có dấu
               premium để người dùng biết, ngay cả người dùng premium — để họ hiểu quyền lợi của mình"). -->
          <span v-if="BAI_PREMIUM.has(b)" class="vm" aria-hidden="true"><Crown :size="13" :stroke-width="2.8" /></span>
          <span v-if="dangChon(b) && !ngauNhien" class="dang" aria-hidden="true"><Check :size="14" :stroke-width="3.4" /></span>
        </button>
      </div>
      <p class="cn-chu"><Crown :size="14" :stroke-width="2.8" aria-hidden="true" />{{ t('cn.canPremium') }}</p>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(10, 12, 32, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.cn {
  --vang: #f0b429;
  width: min(380px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
  padding: 16px; background: var(--panel-solid, #fff); border-radius: 28px;
}
.cn > * { flex-shrink: 0; }
.cn header { display: flex; align-items: center; justify-content: space-between; }
.cn h2 { margin: 0; font-size: var(--text-xl); }
.cn-ds { display: flex; flex-direction: column; gap: 9px; }
.dong {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 54px; padding: 7px 12px 7px 8px;
  border-radius: 16px; color: inherit; cursor: pointer; text-align: left;
}
.dong b { flex: 1; min-width: 0; font: 800 15px/1.25 var(--font-body); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Bài đang phát: viền vàng như ô hình nền đang chọn */
.dong.chon { outline: 2.5px solid var(--vang); outline-offset: 1px; }
.ic { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; color: #fff; }
.ic.tat { background: #8b93ad; }
.ic.nn { background: #7a5af0; }
.hai { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.hai b { flex: none; }
.hai small { font: 600 12px/1.3 var(--font-body); color: var(--muted); }
.ic.keo { background: #ff8a3c; }
.ic.dem { background: #5b62d6; }
.ic.sau { background: #1c9bc9; }
.ic.vuon { background: #2faa5f; }
.ic.chuong { background: #d05aa8; }
.vm, .dang { flex: none; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; }
.vm { background: linear-gradient(180deg, #ffe08a, #f5b324); color: #5b3d00; box-shadow: 0 2px 0 #c98f12; }
.dang { background: #1f9d6b; color: #fff; }
.cn-chu { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 0; color: var(--muted); font: 700 12.5px/1.35 var(--font-body); text-align: center; }
.cn-chu svg { flex: none; color: #d99a00; }
</style>
