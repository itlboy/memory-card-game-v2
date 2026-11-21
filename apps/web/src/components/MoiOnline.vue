<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { CACH_MOI_LAI_MS, moiNguoi, tenKhach, type NguoiOnline } from '@/lib/sanh';
import { t } from '@/lib/i18n';
import { sfx } from '@/lib/audio';
import { useBackCloser } from '@/composables/useBackGuard';
import MatNguoi from './MatNguoi.vue';
import VachCho from './VachCho.vue';

/**
 * DANH SÁCH NGƯỜI ĐANG ONLINE để chủ phòng mời (21.11.2026, mockup duyệt
 * https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU mục 3B). OnlineScreen tải danh sách (`ds`) và làm mới
 * khi bảng mở; bảng này chỉ lo bấm Mời + đếm ngược. Luật chống làm phiền nằm ở server.
 *
 * ĐẾM NGƯỢC TỚI LÚC MỜI LẠI (21.11.2026, mockup duyệt https://claude.ai/artifact/9DrmCWLCmnfSRy3JYnNiiG mục 3): trước đây
 * hết 20 giây treo là nút "Mời" sáng lại, mà server còn chặn thêm tới hết 2 phút → bấm chỉ ra lỗi "vừa mời". Nay nút
 * thành `VachCho` suốt khoảng chờ. Mốc là thời điểm TUYỆT ĐỐI đổi từ số "còn bao lâu" của server ngay lúc nhận
 * (bản đầu cộng `bayGio + daMoi` mỗi nhịp nên số đứng yên tới lượt tải sau).
 */
const p = defineProps<{ ds: NguoiOnline[]; ma: string; token: string }>();
const emit = defineEmits<{ dong: []; 'tai-lai': [] }>();

interface Cho { moiDen: number; het: number }
/** sid → mốc hết lời mời đang treo (`moiDen`) và mốc mời lại được (`het`). */
const cho = ref<Record<string, Cho>>({});
const tong = ref(CACH_MOI_LAI_MS);
const loi = ref<Record<string, string>>({});
const dangGui = ref<string | null>(null);
useBackCloser(26, () => true, () => emit('dong'));

function ghiCho(sid: string, moiDen: number, het: number): void {
  const c = cho.value[sid];
  cho.value = { ...cho.value, [sid]: { moiDen: Math.max(c?.moiDen ?? 0, moiDen), het: Math.max(c?.het ?? 0, het) } };
}
// Số của server ("còn N ms") → mốc tuyệt đối ngay lúc danh sách về
watch(() => p.ds, (ds) => {
  const bay = Date.now();
  for (const n of ds) if (n.choMoi || n.daMoi) ghiCho(n.sid, n.daMoi ? bay + n.daMoi : 0, bay + (n.choMoi ?? n.daMoi ?? 0));
}, { immediate: true });
const nhip = ref(0);
const dong = computed(() => {
  void nhip.value;
  const bay = Date.now();
  return p.ds.map((n) => {
    const c = cho.value[n.sid];
    return { ...n, cho: c && c.het > bay ? c : null };
  });
});

const LOI: Record<string, string> = { day: 'moi.loi.day', vuaMoi: 'moi.loi.vuaMoi', banMoi: 'moi.loi.banMoi', nhieuQua: 'moi.loi.nhieuQua', tuChoi: 'moi.tuChoi' };
async function moi(n: NguoiOnline): Promise<void> {
  if (dangGui.value) return;
  dangGui.value = n.sid;
  sfx.select();
  const kq = await moiNguoi(p.ma, p.token, n.sid);
  dangGui.value = null;
  if ('ok' in kq) {
    if (kq.cach) tong.value = kq.cach;
    ghiCho(n.sid, Date.now() + kq.han, Date.now() + (kq.cach ?? CACH_MOI_LAI_MS));
    loi.value = { ...loi.value, [n.sid]: '' };
  } else {
    if (kq.loi === 'vuaMoi' && kq.con) { ghiCho(n.sid, 0, Date.now() + kq.con); return; }
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
            <!-- Đã bấm "Để sau": phòng này không mời lại được nữa — không còn nút -->
            <span v-if="n.tuChoi" class="mo-tc">{{ t('moi.deSau') }}</span>
            <VachCho v-else-if="n.cho" :het="n.cho.het" :moi-den="n.cho.moiDen" :tong="tong" @xong="nhip++" />
            <button
              v-else class="thach th-xanh th-nho mo-nut" type="button"
              :disabled="dangGui === n.sid" :aria-label="t('moi.moiAria', { ten: n.ten || t('moi.khach', { so: tenKhach(n.sid) }) })"
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
.mo-nut { min-width: 104px; min-height: 34px; }
.mo-tc { min-width: 104px; text-align: center; font: 800 12.5px var(--font-body); color: var(--muted); white-space: nowrap; }
.mo-trong { margin: 10px 4px; color: var(--muted); font-size: var(--text-sm); line-height: 1.5; }
.mo-chu { margin: 2px 4px 0; font-size: 12px; color: var(--muted); line-height: 1.45; }
</style>
