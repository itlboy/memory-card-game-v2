<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Check, Dices, Hourglass, Swords, X } from 'lucide-vue-next';
import { t } from '@/lib/i18n';
import { sfx } from '@/lib/audio';
import { tenKhach, trongPhongOnline } from '@/lib/sanh';
import { chonSoThe, roiTran, tdBao, tdCho, tdGom, tdHoi, tdTran, thoiThiDau, traLoiHoi } from '@/lib/thidau';
import MatNguoi from './MatNguoi.vue';

/**
 * THI ĐẤU (22.11.2026, mockup duyệt https://claude.ai/artifact/74bGgXpFDdDXSEXVwEWe6k mục 4). Mount MỘT lần ở App.vue.
 *  - THẺ ở đầu màn (cùng dáng thẻ lời mời): hỏi "Thi đấu online?" → "Đang gom người" → báo ngắn (chưa đủ / hết chờ / huỷ).
 *  - VIÊN "Đang chờ người": chỉ mình bạn tham gia, server giữ 10 phút; vẫn dùng app bình thường bên dưới.
 *  - LỚP PHỦ trận: "Trận của bạn" (xem mặt) → "Chọn số thẻ" → "Bàn N thẻ" đếm 3 giây → emit `vao` (App.vue vào phòng).
 * KHÔNG có chủ phòng: không nút bắt đầu, không mời, không đuổi — máy chủ dẫn từng bước theo đồng hồ.
 */
const emit = defineEmits<{ vao: [ma: string] }>();

const now = ref(Date.now());
let nhip: ReturnType<typeof setInterval> | undefined;
const canNhip = computed(() => !!(tdGom.value || tdCho.value || tdTran.value));
watch(canNhip, (c) => {
  clearInterval(nhip);
  if (c) { now.value = Date.now(); nhip = setInterval(() => { now.value = Date.now(); }, 250); }
}, { immediate: true });
onBeforeUnmount(() => clearInterval(nhip));

const giay = (het: number): number => Math.max(0, Math.ceil((het - now.value) / 1000));
const phutGiay = (het: number): string => { const s = giay(het); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const ten = (n: { sid: string; ten: string }): string => n.ten || tenKhach(n.sid);

// Hết chờ theo đồng hồ máy (server cũng báo `td_het_cho`; đây là lưới khi tin đó rơi)
watch(now, (n) => { if (tdCho.value && tdCho.value <= n) tdCho.value = 0; });

/* ---------- trận ---------- */
const tr = computed(() => tdTran.value);
const buoc = computed<'xem' | 'chon' | 'kq' | null>(() => {
  const x = tr.value;
  if (!x) return null;
  if (x.kq) return 'kq';
  return now.value < x.hetXem ? 'xem' : 'chon';
});
const toiChon = computed(() => (tr.value ? tr.value.chon[tr.value.toi] ?? 0 : 0));
const nhap = ref(0);
watch(() => tr.value?.id, () => { nhap.value = 0; });
const dangChon = computed(() => nhap.value || toiChon.value);
/** Ai (trừ mình) đã chốt số `n` — hiện mặt trên ô. */
const aiChon = (n: number): string[] => (tr.value ? tr.value.nguoi.filter((p) => p.sid !== tr.value!.toi && tr.value!.chon[p.sid] === n).map((p) => p.mat) : []);
function chot(): void {
  if (!dangChon.value || toiChon.value) return;
  sfx.select();
  chonSoThe(dangChon.value);
}
// Chốt bàn xong: đếm 3 giây rồi vào phòng
const hetKq = ref(0);
let henVao: ReturnType<typeof setTimeout> | undefined;
watch(() => tr.value?.kq?.ma, (ma) => {
  clearTimeout(henVao);
  if (!ma) return;
  hetKq.value = Date.now() + 3000;
  henVao = setTimeout(() => { const m = tdTran.value?.kq?.ma; tdTran.value = null; if (m) emit('vao', m); }, 3000);
});
onBeforeUnmount(() => clearTimeout(henVao));
const bocTu = computed(() => (tr.value ? tr.value.nguoi.map((p) => tr.value!.chon[p.sid]).filter(Boolean).join(' · ') : ''));
</script>

<template>
  <Teleport to="body">
    <Transition name="td-the">
      <!-- 1. Thẻ hỏi -->
      <div v-if="tdHoi && !trongPhongOnline && !tr" :key="`h${tdHoi.id}`" class="td-the" role="alertdialog" :aria-label="t('td.hoi')">
        <div class="td-tren">
          <span v-if="tdHoi.cho" class="td-mat"><MatNguoi :mat="tdHoi.cho.mat" /><span class="td-kiem" aria-hidden="true"><Swords :size="11" :stroke-width="2.8" /></span></span>
          <span v-else class="td-vong" aria-hidden="true"><Swords :size="17" :stroke-width="2.5" /></span>
          <span class="td-chu">
            <b>{{ tdHoi.cho ? t('td.choTen', { ten: tdHoi.cho.ten || t('td.aiDo') }) : t('td.hoi') }}</b>
            <small><i class="td-cham" aria-hidden="true" />{{ tdHoi.cho ? t('td.choNho') : t('td.hoiNho', { n: tdHoi.n }) }}</small>
          </span>
          <button class="thach th-nho td-b td-sau td-x" type="button" :aria-label="t('td.deSau')" @click="traLoiHoi(false)"><X :size="16" :stroke-width="2.8" /></button>
          <button class="thach th-nho th-xanh td-b" type="button" @click="sfx.select(); traLoiHoi(true)">{{ t('td.thamGia') }}</button>
        </div>
        <div class="td-vach" aria-hidden="true"><i :style="{ animationDuration: `${tdHoi.han}ms` }" /></div>
      </div>
      <!-- 2. Đang gom người -->
      <div v-else-if="tdGom && !tr" key="gom" class="td-the" role="status">
        <div class="td-tren">
          <span class="td-vong" aria-hidden="true"><Swords :size="17" :stroke-width="2.5" /></span>
          <span class="td-chu"><b>{{ t('td.gom') }}</b><small>{{ t('td.gomNho', { s: giay(tdGom.het) }) }}</small></span>
          <span v-if="tdGom.ds.length" class="td-mats" aria-hidden="true"><i v-for="(m, i) in tdGom.ds" :key="i">{{ m }}</i><em>{{ tdGom.n }}</em></span>
          <button class="thach th-nho td-b td-sau" type="button" @click="thoiThiDau()">{{ t('td.roi') }}</button>
        </div>
        <div class="td-vach" aria-hidden="true"><i :style="{ animationDuration: `${Math.max(0, tdGom.het - Date.now())}ms` }" /></div>
      </div>
      <!-- Báo ngắn: chưa đủ người / hết chờ / trận bị huỷ -->
      <div v-else-if="tdBao && !tr" :key="tdBao" class="td-the" role="status">
        <div class="td-tren">
          <span class="td-vong xam" aria-hidden="true"><Hourglass :size="18" :stroke-width="2.4" /></span>
          <span class="td-chu"><b>{{ t(`td.bao.${tdBao}`) }}</b><small>{{ t(`td.bao.${tdBao}Nho`) }}</small></span>
          <button class="thach th-nho td-x" type="button" :aria-label="t('dhd.dong')" @click="tdBao = null"><X :size="16" :stroke-width="2.8" /></button>
        </div>
      </div>
    </Transition>
    <!-- Viên chờ: nhỏ, không che nút -->
    <Transition name="td-the">
      <div v-if="tdCho && !tdHoi && !tdGom && !tdBao && !tr && !trongPhongOnline" class="td-vien" role="status">
        <Swords :size="14" :stroke-width="2.6" aria-hidden="true" /><span class="sr-only">{{ t('td.dangCho') }}</span><span class="td-gio">{{ phutGiay(tdCho) }}</span>
        <button class="thach th-nho td-huy" type="button" :aria-label="t('td.thoi')" @click="thoiThiDau()"><X :size="13" :stroke-width="3" /></button>
      </div>
    </Transition>

    <!-- 3–5. Trận: xem mặt → chọn số thẻ → chốt bàn -->
    <div v-if="tr && buoc" class="td-phu" role="dialog" aria-modal="true" :aria-label="buoc === 'xem' ? t('td.tran') : t('td.chonThe')">
      <section class="panel td-hop">
        <template v-if="buoc === 'xem'">
          <h2>{{ t('td.tran') }}</h2>
          <div class="td-tran" :class="`n${tr.nguoi.length}`">
            <template v-for="(p, i) in tr.nguoi" :key="p.sid">
              <span v-if="i" class="td-vs" aria-hidden="true"><template v-if="tr.nguoi.length === 2">VS</template><Swords v-else :size="13" :stroke-width="2.8" /></span>
              <div class="td-ng"><span class="td-av"><MatNguoi :mat="p.mat" /></span><b>{{ ten(p) }}</b><small>{{ p.sid === tr.toi ? t('td.ban') : ' ' }}</small></div>
            </template>
          </div>
          <div class="td-dem"><span>{{ t('td.vaoBan') }}</span><b>{{ Math.max(1, giay(tr.hetXem)) }}</b></div>
          <button class="thach td-rong td-xam" type="button" @click="roiTran()">{{ t('td.roi') }}</button>
        </template>

        <template v-else>
          <h2>{{ t('td.chonThe') }}</h2>
          <div class="td-chips" :class="`n${tr.nguoi.length}`">
            <span v-for="p in tr.nguoi" :key="p.sid" class="td-chip">
              <span class="td-cm"><MatNguoi :mat="p.mat" /></span><b>{{ p.sid === tr.toi ? t('td.ban') : ten(p) }}</b>
              <i v-if="tr.chon[p.sid]" class="td-tt xong"><Check :size="13" :stroke-width="3.2" aria-hidden="true" />{{ tr.chon[p.sid] }}</i>
              <i v-else class="td-tt">{{ t('td.dangChon') }}</i>
            </span>
          </div>
          <div v-if="buoc === 'chon'" class="td-vach to" aria-hidden="true"><i :style="{ animationDuration: `${tr.hanChon}ms` }" /></div>
          <div class="td-luoi" role="radiogroup" :aria-label="t('td.chonThe')">
            <button
              v-for="n in tr.soThe" :key="n" type="button" class="thach td-o" role="radio"
              :class="{ 'th-vang': dangChon === n, ban: aiChon(n).length > 0, trung: tr.kq?.soThe === n }"
              :aria-checked="dangChon === n" :disabled="buoc === 'kq' || !!toiChon"
              @click="sfx.select(); nhap = n"
            >
              <span v-if="dangChon === n" class="td-nhan toi">{{ t('td.ban') }}</span>
              <span v-if="aiChon(n).length" class="td-nhan kia" aria-hidden="true">{{ aiChon(n).join('') }}</span>
              <strong>{{ n }}</strong><small>{{ t('td.the') }}</small>
            </button>
          </div>
          <template v-if="buoc === 'chon'">
            <p class="td-luat"><Dices :size="18" :stroke-width="2.4" aria-hidden="true" /><span>{{ t('td.luat', { n: tr.nguoi.length, min: tr.soThe[0] ?? 0 }) }}</span></p>
            <button class="btn-primary td-rong" type="button" :disabled="!dangChon || !!toiChon" @click="chot()">
              {{ toiChon ? t('td.daChot', { n: toiChon }) : dangChon ? t('td.chot', { n: dangChon }) : t('td.chonThe') }}
            </button>
          </template>
          <template v-else-if="tr.kq">
            <div class="td-kq"><span class="td-kq-ic" aria-hidden="true"><Dices :size="20" :stroke-width="2.4" /></span><div><b>{{ t('td.banThe', { n: tr.kq.soThe }) }}</b><small v-if="bocTu">{{ t('td.bocTu', { ds: bocTu }) }}</small></div></div>
            <div class="td-dem"><span>{{ t('td.batDau') }}</span><b>{{ Math.max(1, giay(hetKq)) }}</b></div>
          </template>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
/* Thẻ ở đầu màn — cùng dáng thẻ lời mời (LoiMoi.vue) */
.td-the {
  position: fixed; z-index: 95; left: 12px; right: 12px; top: calc(env(safe-area-inset-top, 0px) + 10px);
  /* GỌN MỘT HÀNG (23.11.2026, chủ dự án: "thanh thông báo thi đấu online có thể làm nhỏ hơn"): icon · chữ · ✕ · Tham gia
     cùng dòng, vạch đếm mảnh ở dưới — cao ~58px thay vì ~130px (bản đầu có hàng nút riêng). */
  max-width: 460px; margin: 0 auto; box-sizing: border-box; display: grid; gap: 6px; padding: 7px 8px 8px 9px;
  border-radius: 16px; border: 2px solid #9c8cff; background: #f1eeff; color: #2a2160;
  box-shadow: 0 4px 0 #c3b9ff, 0 10px 26px rgba(14, 26, 58, .22); font-family: var(--font-body);
}
:global([data-theme='dark'] .td-the) { background: #221d48; border-color: #6a5cd6; color: #e4e0ff; box-shadow: 0 4px 0 #120f2c, 0 10px 26px rgba(0, 0, 0, .5); }
.td-tren { display: flex; align-items: center; gap: 8px; min-width: 0; }
.td-mat { position: relative; flex: none; width: 32px; height: 32px; border-radius: 50%; background: #fff; display: grid; place-items: center; font-size: 20px; line-height: 1; }
:global([data-theme='dark'] .td-the .td-mat) { background: #332c66; }
.td-kiem { position: absolute; right: -4px; bottom: -3px; width: 19px; height: 19px; border-radius: 50%; background: #6a5cff; color: #fff; display: grid; place-items: center; }
.td-vong { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: linear-gradient(#9d8fff, #6a5cff); box-shadow: 0 2px 0 #4b3fd1; }
.td-vong.xam { background: linear-gradient(#aab3cc, #7d88a8); box-shadow: 0 2px 0 #646f8f; }
.td-chu { min-width: 0; display: grid; flex: 1; }
.td-chu b { font: 800 14.5px/1.2 var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-chu small { display: flex; align-items: center; gap: 5px; font-weight: 700; font-size: 11.5px; opacity: .78; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.td-cham { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #2fb85f; box-shadow: 0 0 0 3px rgba(47, 184, 95, .25); }
.td-vach { height: 3px; border-radius: 3px; background: rgba(106, 92, 255, .18); overflow: hidden; }
.td-vach.to { height: 6px; margin: 0 0 10px; }
.td-vach i { display: block; height: 100%; width: 100%; border-radius: 4px; background: #6a5cff; animation: td-can linear forwards; }
:global([data-theme='dark'] .td-vach i) { background: #a99cff; }
@keyframes td-can { to { width: 0; } }
.td-b { flex: none; min-height: 34px; padding: 0 13px 2px; font: 800 13.5px var(--font-body); border-radius: 11px; white-space: nowrap; }
.td-sau { color: inherit; }
.td-mats { margin-left: auto; display: flex; align-items: center; flex: none; padding-left: 8px; }
.td-mats i { width: 26px; height: 26px; margin-left: -8px; border-radius: 50%; display: grid; place-items: center; font-size: 15px; font-style: normal; background: #fff; border: 2px solid #9c8cff; }
:global([data-theme='dark'] .td-mats i) { background: #332c66; border-color: #6a5cd6; }
.td-mats em { margin-left: 6px; font: 800 15px var(--font-display); font-style: normal; }
.td-x { flex: none; width: 34px; min-height: 34px; padding: 0 0 2px; display: grid; place-items: center; border-radius: 50%; }
/* Viên chờ */
.td-vien {
  /* CHIP NHỎ GÓC TRÁI (23.11.2026, chủ dự án: "cái nút chờ ấy nó hơi cản trở nội dung"): chỉ icon kiếm + đồng hồ + ✕, nằm sát
     mép trái dưới thanh trên cùng — trước là viên dài có chữ, đứng giữa màn, đè lên đồng hồ ván và tiêu đề. */
  /* z 14: DƯỚI thanh trên cùng (15) và mọi hộp thoại (≥ 17) — chụp kiểm 23.11: z 94 làm chip đè lên bảng xếp hạng đang mở */
  position: fixed; z-index: 14; left: calc(env(safe-area-inset-left, 0px) + 8px); top: calc(env(safe-area-inset-top, 0px) + 60px);
  display: flex; align-items: center; gap: 6px; padding: 3px 4px 5px 9px; border-radius: 999px; white-space: nowrap;
  border: 2px solid #9c8cff; background: #f1eeff; color: #2a2160; box-shadow: 0 4px 0 #c3b9ff, 0 8px 18px rgba(14, 26, 58, .2);
  font: 800 12.5px var(--font-body);
}
:global([data-theme='dark'] .td-vien) { background: #221d48; border-color: #6a5cd6; color: #e4e0ff; box-shadow: 0 4px 0 #120f2c, 0 8px 18px rgba(0, 0, 0, .5); }
.td-gio { opacity: .7; font-variant-numeric: tabular-nums; }
.td-huy { width: 24px; min-height: 24px; padding: 0 0 1px; display: grid; place-items: center; border-radius: 50%; }
.td-the-enter-active, .td-the-leave-active { transition: transform .24s cubic-bezier(.3, 1.4, .5, 1), opacity .18s; }
.td-the-enter-from, .td-the-leave-to { transform: translateY(-18px); opacity: 0; }
.td-vien.td-the-enter-from, .td-vien.td-the-leave-to { transform: translateY(-18px); }
/* Lớp phủ trận */
.td-phu {
  position: fixed; inset: 0; z-index: 96; display: flex; align-items: flex-start; justify-content: center; background: rgba(6, 9, 18, .62);
  padding: calc(env(safe-area-inset-top, 0px) + 70px) 12px calc(env(safe-area-inset-bottom, 0px) + 16px); overflow-y: auto;
}
.td-hop { width: 100%; max-width: 420px; box-sizing: border-box; }
.td-hop h2 { margin: 2px 0 12px; font: 800 20px var(--font-display); }
.td-tran { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 30px 0 26px; }
.td-ng { flex: 1; min-width: 0; display: grid; justify-items: center; gap: 4px; text-align: center; }
.td-ng b { max-width: 100%; font: 800 16px var(--font-display); color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-ng small { min-height: 1.2em; font: 700 12px var(--font-body); color: var(--muted); }
.td-av { width: 76px; height: 76px; margin-bottom: 6px; border-radius: 50%; display: grid; place-items: center; font-size: 46px; line-height: 1; background: var(--panel-solid); border: 3px solid #9c8cff; box-shadow: 0 5px 0 #c3b9ff; }
:global([data-theme='dark'] .td-av) { box-shadow: 0 5px 0 #120f2c; }
.td-tran.n3 .td-av { width: 64px; height: 64px; font-size: 38px; } .td-tran.n3 .td-ng b { font-size: 13.5px; }
.td-vs { flex: none; width: 46px; height: 46px; margin-top: -40px; border-radius: 50%; display: grid; place-items: center; font: 800 17px var(--font-display); color: #fff; background: linear-gradient(#ff8f70, #e0533a); box-shadow: 0 4px 0 #b13c27; }
.td-tran.n3 .td-vs { width: 26px; height: 26px; box-shadow: 0 3px 0 #b13c27; }
.td-dem { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 8px 0 10px; font: 700 15px var(--font-body); color: var(--muted); }
.td-dem b { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font: 800 24px var(--font-display); color: #fff; background: linear-gradient(#5fd27f, #2f9e57); box-shadow: 0 4px 0 #227a41; }
.td-rong { width: 100%; min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 8px; font: 800 16px var(--font-display); border-radius: 14px; margin-top: 9px; }
.td-xam { color: var(--muted); min-height: 42px; font-size: 15px; }
.td-chips { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin: 2px 0 10px; }
.td-chips.n3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.td-chip { display: grid; justify-items: center; gap: 2px; min-width: 0; padding: 7px 4px 9px; border-radius: 14px; background: var(--panel-solid); border: 2px solid var(--line); box-shadow: 0 3px 0 var(--line); }
.td-cm { font-size: 24px; line-height: 1.1; }
.td-chip b { max-width: 100%; font: 800 12.5px var(--font-display); color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-tt { margin-top: 2px; font: 800 11.5px var(--font-body); font-style: normal; color: var(--muted); white-space: nowrap; }
.td-tt.xong { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px 3px 6px; border-radius: 999px; font-size: 13px; color: #fff; background: linear-gradient(#5fd27f, #2f9e57); box-shadow: 0 2px 0 #227a41; }
.td-luoi { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 9px; margin-bottom: 12px; }
.td-o { position: relative; min-height: 64px; display: grid; place-content: center; justify-items: center; gap: 0; border-radius: 16px; padding: 4px 0 8px; }
.td-o strong { font: 800 24px/1 var(--font-display); } .td-o small { font: 700 11.5px var(--font-body); opacity: .7; }
.td-o:disabled { opacity: 1; cursor: default; }
.td-o.ban:not(.th-vang) { outline: 3px solid #9c8cff; outline-offset: -3px; }
.td-o.trung { outline: 4px solid #2f9e57; outline-offset: 2px; }
.td-nhan { position: absolute; top: -8px; display: grid; place-items: center; height: 20px; border-radius: 999px; font: 800 10.5px var(--font-body); box-shadow: 0 2px 0 rgba(0, 0, 0, .18); }
.td-nhan.toi { left: -4px; padding: 0 8px; background: #2f9e57; color: #fff; }
.td-nhan.kia { right: -4px; top: -10px; min-width: 24px; height: 24px; padding: 0 3px; font-size: 15px; letter-spacing: -2px; background: #fff; border: 2px solid #9c8cff; }
.td-luat { display: flex; align-items: flex-start; gap: 8px; margin: 0 2px 4px; font: 600 13px/1.4 var(--font-body); color: var(--muted); }
.td-luat svg { flex: none; margin-top: 1px; color: #6a5cff; }
:global([data-theme='dark'] .td-luat svg) { color: #a99cff; }
.td-kq { display: flex; align-items: center; gap: 11px; padding: 10px 12px 12px; border-radius: 16px; background: #e9f9ee; border: 2px solid #8fd9a6; box-shadow: 0 3px 0 #b9e8c7; color: #14532d; }
:global([data-theme='dark'] .td-kq) { background: #143524; border-color: #2f7d4b; box-shadow: 0 3px 0 #0b2015; color: #c9f5d7; }
.td-kq-ic { flex: none; width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: #fff; background: linear-gradient(#5fd27f, #2f9e57); box-shadow: 0 3px 0 #227a41; }
.td-kq b { display: block; font: 800 19px/1.15 var(--font-display); } .td-kq small { font: 700 12.5px var(--font-body); opacity: .8; }
@media (prefers-reduced-motion: reduce) {
  .td-vach i { animation: none; }
  .td-the-enter-active, .td-the-leave-active { transition: opacity .15s; }
  .td-the-enter-from, .td-the-leave-to { transform: none; }
  .td-vien.td-the-enter-from, .td-vien.td-the-leave-to { transform: none; }
}
</style>
