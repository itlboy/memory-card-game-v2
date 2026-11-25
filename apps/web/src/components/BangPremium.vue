<script setup lang="ts">
import { vChamNgoai } from '@/lib/cham-ngoai';
/**
 * BẢNG PREMIUM — màn giới thiệu gói + chọn gói THÁNG / NĂM (chủ dự án 25.11.2026: "làm luôn bảng premium đi. Chỉ bật
 * với chế độ debug").
 *
 * CHƯA BÁN THẬT: chỉ mở được từ menu debug (App.vue chặn thêm bằng cờ `debug`). Nút mua ở đây KHÔNG thu tiền — nó bật
 * cờ thử `mm.premium` (lib/premium.ts `datPremiumThu`), đúng cái công tắc "Mở Premium để thử" sẵn có, để đi hết luồng
 * "chưa mua → chọn gói → đã có Premium" trên máy thật. Khi nối In-App Purchase thì chỉ thay thân hàm `mua()`.
 *
 * GIÁ LÀ SỐ TẠM (`GIA`) — chủ dự án chưa chốt; lúc bán thật giá phải đọc từ store (đã quy đổi theo nước), không viết cứng.
 * Ba quyền lợi cuối (lịch sử trí nhớ, tuỳ chỉnh âm thanh, hiệu ứng bàn chơi) là DỰ KIẾN, chưa có tính năng thật đằng sau.
 */
import { ChartColumn, Check, Crown, Palette, Sparkles, SlidersHorizontal, LayoutGrid, X } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { moChucNang } from '@/lib/phan-tich';
import { t } from '@/lib/i18n';
import { num } from '@/lib/format';
import { daMuaPremium, datPremiumThu } from '@/lib/premium';

const props = defineProps<{ soTheme: number }>();
const emit = defineEmits<{ close: [] }>();

/** Giá TẠM (đồng) — xem đầu file. */
const GIA = { thang: 29000, nam: 199000 } as const;
type Goi = keyof typeof GIA;
const goi = ref<Goi>('nam');
const tien = (v: number): string => `${num(v)}đ`;
const tietKiem = Math.round((1 - GIA.nam / (GIA.thang * 12)) * 100);

/* Hiện chưa theme nào gắn cờ premium (soát 25.11.2026: bảng ghi "Tất cả 0 theme") — không có thì không khoe dòng đó. */
const LOI = computed(() => [
  ...(props.soTheme > 0 ? [{ ic: LayoutGrid, chu: t('pm.l.theme', { n: props.soTheme }) }] : []),
  { ic: Palette, chu: t('pm.l.skin') },
  { ic: ChartColumn, chu: t('pm.l.triNho') },
  { ic: SlidersHorizontal, chu: t('pm.l.amThanh') },
  { ic: Sparkles, chu: t('pm.l.hieuUng') }
]);

const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => { nutDong.value?.focus(); moChucNang('premium'); });

function chonGoi(g: Goi): void {
  if (goi.value === g) return;
  goi.value = g;
  moChucNang('premium_chon_goi', { goi: g });
}
function mua(): void {
  moChucNang('premium_mua', { goi: goi.value });
  datPremiumThu(true);
}
function tat(): void { datPremiumThu(false); }
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="pmTitle" @keydown.esc="emit('close')" @click.self="emit('close')" v-cham-ngoai="() => { emit('close'); }">
    <div class="panel pm">
      <header class="pm-head">
        <h2 id="pmTitle"><span class="pm-vm" aria-hidden="true"><Crown :size="20" :stroke-width="2.5" /></span>{{ t('tp.premium') }}</h2>
        <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')"><X :size="20" /></button>
      </header>
      <p class="pm-mo">{{ t('pm.moTa') }}</p>

      <ul class="pm-loi">
        <li v-for="l in LOI" :key="l.chu"><span aria-hidden="true"><component :is="l.ic" :size="18" :stroke-width="2.4" /></span>{{ l.chu }}</li>
      </ul>

      <template v-if="!daMuaPremium">
        <div class="pm-goi" role="group" :aria-label="t('tp.premium')">
          <button class="thach th-chon pm-o" type="button" :aria-pressed="goi === 'nam'" @click="chonGoi('nam')">
            <em>{{ t('pm.tietKiem', { pct: tietKiem }) }}</em>
            <b>{{ t('pm.nam') }}</b>
            <strong>{{ tien(GIA.nam) }}</strong>
            <small>{{ t('pm.moiThang', { gia: tien(Math.round(GIA.nam / 12 / 100) * 100) }) }}</small>
          </button>
          <button class="thach th-chon pm-o" type="button" :aria-pressed="goi === 'thang'" @click="chonGoi('thang')">
            <b>{{ t('pm.thang') }}</b>
            <strong>{{ tien(GIA.thang) }}</strong>
          </button>
        </div>
        <button class="thach th-vang pm-mua" type="button" @click="mua">{{ t('pm.mua') }}</button>
      </template>
      <template v-else>
        <p class="pm-co" role="status"><Check :size="20" :stroke-width="3" aria-hidden="true" />{{ t('pm.daCo') }}</p>
        <button class="thach th-nho pm-tat" type="button" @click="tat">{{ t('pm.tat') }}</button>
      </template>
      <p class="pm-thu">{{ t('pm.thu') }}</p>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(10, 12, 32, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
/* Vàng ĐẬM trên nền sáng · vàng SÁNG trên nền tối — một tông không đạt tương phản ở cả hai */
.pm {
  --pm: #8a5a00; --pm-nen: #fff3cf; --pm-vien: #f0cf7a; --o: #f1f3fb;
  width: min(410px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;
  padding: 16px 16px 18px; background: var(--panel-solid, #fff); border-radius: 28px;
}
:global([data-theme='dark'] .pm) { --pm: #ffd36b; --pm-nen: #3a3160; --pm-vien: #7a6530; --o: #2a3170; }
.pm > * { flex-shrink: 0; }
.pm-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pm-head h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: var(--text-xl); }
.pm-vm { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(180deg, #ffd96a, #f5b324); color: #6b4a00; }
.pm-mo { margin: -6px 0 0; color: var(--muted); font-size: var(--text-md); line-height: 1.4; }

.pm-loi { list-style: none; margin: 0; padding: 4px 12px; border-radius: 18px; background: var(--o); }
.pm-loi li { display: flex; align-items: center; gap: 12px; padding: 9px 0; font: 700 14.5px/1.3 var(--font-body); }
.pm-loi li + li { border-top: 1px solid color-mix(in srgb, var(--muted) 22%, transparent); }
.pm-loi li span { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 10px; background: var(--pm-nen); color: var(--pm); }

.pm-goi { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 10px; }
.pm-o { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 104px; padding: 16px 6px 12px; border-radius: 20px; line-height: 1.2; }
.pm-o b { font: 800 13.5px/1.2 var(--font-body); }
.pm-o strong { font-size: 22px; font-weight: 900; }
.pm-o small { font: 700 12px/1.2 var(--font-body); opacity: .8; }
.pm-o em {
  position: absolute; top: -11px; left: 50%; transform: translateX(-50%); padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  background: #ffd36b; color: #6b4a00; font: 900 11px/1.3 var(--font-body); font-style: normal; box-shadow: 0 2px 0 #c98f12;
}
.pm-mua { min-height: 54px; border-radius: 18px; font: 900 18px/1.2 var(--font-body); }
.pm-co { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 4px 0 0; padding: 14px; border-radius: 18px; background: var(--pm-nen); color: var(--pm); font: 800 16px/1.2 var(--font-body); border: 2px solid var(--pm-vien); }
.pm-tat { align-self: center; font: 800 14px/1.2 var(--font-body); }
.pm-thu { margin: 0; text-align: center; color: var(--muted); font: 600 12px/1.4 var(--font-body); }
</style>
