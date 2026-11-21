<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { X } from 'lucide-vue-next';
import { moiNguoi, tenKhach, type NguoiOnline } from '@/lib/sanh';
import { t } from '@/lib/i18n';
import { sfx } from '@/lib/audio';
import { useBackCloser } from '@/composables/useBackGuard';
import MatNguoi from './MatNguoi.vue';

/**
 * DANH SÁCH NGƯỜI ĐANG ONLINE để chủ phòng mời (21.11.2026, mockup duyệt
 * https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU mục 3B). OnlineScreen tải danh sách (`ds`) và làm mới
 * khi bảng mở; bảng này chỉ lo bấm Mời + đếm ngược "Đã mời · 14s". Luật chống làm phiền nằm ở server.
 */
const p = defineProps<{ ds: NguoiOnline[]; ma: string; token: string }>();
const emit = defineEmits<{ dong: []; 'tai-lai': [] }>();

/** sid → mốc hết lời mời mình vừa gửi (đếm ngược ngay, không chờ lượt tải sau). */
const daMoi = ref<Record<string, number>>({});
const loi = ref<Record<string, string>>({});
const dangGui = ref<string | null>(null);
const bayGio = ref(Date.now());
let nhip: ReturnType<typeof setInterval> | undefined;
onMounted(() => { nhip = setInterval(() => { bayGio.value = Date.now(); }, 1000); });
onUnmounted(() => clearInterval(nhip));
useBackCloser(26, () => true, () => emit('dong'));

const dong = computed(() => p.ds.map((n) => {
  const het = Math.max(daMoi.value[n.sid] ?? 0, n.daMoi ? bayGio.value + n.daMoi : 0);
  return { ...n, giay: het > bayGio.value ? Math.ceil((het - bayGio.value) / 1000) : 0 };
}));

const LOI: Record<string, string> = { day: 'moi.loi.day', vuaMoi: 'moi.loi.vuaMoi', banMoi: 'moi.loi.banMoi', nhieuQua: 'moi.loi.nhieuQua', tuChoi: 'moi.tuChoi' };
async function moi(n: NguoiOnline): Promise<void> {
  if (dangGui.value) return;
  dangGui.value = n.sid;
  sfx.select();
  const kq = await moiNguoi(p.ma, p.token, n.sid);
  dangGui.value = null;
  if ('ok' in kq) {
    daMoi.value = { ...daMoi.value, [n.sid]: Date.now() + kq.han };
    loi.value = { ...loi.value, [n.sid]: '' };
  } else {
    loi.value = { ...loi.value, [n.sid]: t((LOI[kq.loi] ?? 'moi.loi.chung') as 'moi.loi.chung') };
    emit('tai-lai');
  }
}
</script>

<template>
  <Teleport to="#app">
    <div class="mo-phu" @click.self="emit('dong')">
      <section class="mo-bang khay" role="dialog" aria-modal="true" :aria-label="t('moi.dsTieuDe', { n: ds.length })">
        <header class="mo-dau">
          <h3>{{ t('moi.dsTieuDe', { n: ds.length }) }}</h3>
          <button class="btn mo-x" type="button" :aria-label="t('dhd.dong')" @click="emit('dong')"><X :size="20" /></button>
        </header>
        <p v-if="!ds.length" class="mo-trong">{{ t('moi.trong') }}</p>
        <ul v-else class="mo-ds">
          <li v-for="n in dong" :key="n.sid">
            <span class="mo-mat"><MatNguoi :mat="n.mat" /><i class="song" aria-hidden="true" /></span>
            <span class="mo-ten">
              <b>{{ n.ten || t('moi.khach', { so: tenKhach(n.sid) }) }}</b>
              <small :class="{ loi: !!loi[n.sid] }">{{ loi[n.sid] || (n.tuChoi ? t('moi.tuChoi') : n.tt === 'choi' ? t('moi.ttChoi') : t('moi.ttChu')) }}</small>
            </span>
            <span v-if="n.giay" class="mo-da" role="status">✓ {{ t('moi.daMoi', { n: n.giay }) }}</span>
            <button
              v-else class="thach th-xanh th-nho mo-nut" type="button"
              :disabled="!!n.tuChoi || dangGui === n.sid" :aria-label="t('moi.moiAria', { ten: n.ten || t('moi.khach', { so: tenKhach(n.sid) }) })"
              @click="moi(n)"
            >{{ t('moi.moi') }}</button>
          </li>
        </ul>
        <p class="mo-chu">{{ t('moi.ghiChu') }}</p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.mo-phu { position: absolute; inset: 0; z-index: 60; background: rgba(8, 10, 24, .45); display: flex; align-items: flex-end; justify-content: center; }
.mo-bang {
  width: 100%; max-width: 520px; max-height: 78%; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box;
  padding: 12px 12px calc(14px + env(safe-area-inset-bottom, 0px)); border-radius: 22px 22px 0 0;
  background: var(--panel-solid); color: var(--fg); box-shadow: 0 -8px 28px rgba(0, 0, 0, .25);
}
.mo-dau { display: flex; align-items: center; gap: 8px; }
.mo-dau h3 { flex: 1; margin: 0; font: 800 18px var(--font-display); }
.mo-x { width: 38px; height: 38px; display: grid; place-items: center; padding: 0; }
.mo-ds { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; overflow-y: auto; min-height: 0; }
.mo-ds li { display: flex; align-items: center; gap: 10px; padding: 7px 9px; border-radius: 14px; background: var(--panel-soft); }
.mo-mat { position: relative; flex: none; width: 34px; height: 34px; border-radius: 50%; background: var(--panel-solid); display: grid; place-items: center; font-size: 20px; line-height: 1; }
.song { position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 50%; background: #3ddc6e; box-shadow: 0 0 0 2px var(--panel-soft); }
.mo-ten { flex: 1; min-width: 0; display: grid; }
.mo-ten b { font-weight: 800; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mo-ten small { font-weight: 700; font-size: 12px; color: var(--muted); }
.mo-ten small.loi { color: var(--bad); }
.mo-nut { min-width: 64px; }
.mo-da { font: 800 12.5px var(--font-body); color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.mo-trong { margin: 10px 4px; color: var(--muted); font-size: var(--text-sm); line-height: 1.5; }
.mo-chu { margin: 2px 4px 0; font-size: 12px; color: var(--muted); line-height: 1.45; }
</style>
