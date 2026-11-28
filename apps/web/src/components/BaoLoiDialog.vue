<script setup lang="ts">
/**
 * BÁO LỖI / GÓP Ý (28.11.2026, mockup duyệt https://claude.ai/artifact/QUH5duZnNP6ZJ7kS8Q78BJ) — mở từ menu (hàng riêng
 * dưới "Luật chơi | Cập nhật"). CHẠM LÀ XONG: loại · ở đâu (chọn sẵn theo màn vừa rời) · chuyện gì xảy ra (nhiều ô). Chữ,
 * ảnh, email không bắt buộc. Gửi kèm tự động thông tin máy (lib/bao-loi.ts) — dòng "Gửi kèm tự động" nói rõ cho người chơi.
 */
import { Bug, Lightbulb, HelpCircle, ImagePlus, X, CircleCheck, Send } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { vChamNgoai } from '@/lib/cham-ngoai';
import { t } from '@/lib/i18n';
import { moChucNang, suKien } from '@/lib/phan-tich';
import { NOI_BL, VAN_DE_BL, guiBaoLoi, manVuaRoi, nenAnh, type LoaiBl, type NoiBl, type VanDeBl } from '@/lib/bao-loi';

const emit = defineEmits<{ xong: [] }>();

const loai = ref<LoaiBl>('loi');
const noi = ref<NoiBl>(manVuaRoi());
const vanDe = ref<VanDeBl[]>([]);
const noiDung = ref('');
const email = ref('');
const anh = ref<string | null>(null);
const trang = ref<'nhap' | 'gui' | 'xong'>('nhap');
const baoLoiGui = ref('');
const nhacChon = ref(false);

const dsVanDe = computed(() => VAN_DE_BL[loai.value]);
watch(loai, () => { vanDe.value = vanDe.value.filter((x) => dsVanDe.value.includes(x)); nhacChon.value = false; });
const duGui = computed(() => loai.value === 'hoi' ? noiDung.value.trim().length > 0 : vanDe.value.length > 0 || noiDung.value.trim().length > 0);

function batTat(k: VanDeBl): void {
  vanDe.value = vanDe.value.includes(k) ? vanDe.value.filter((x) => x !== k) : [...vanDe.value, k];
  nhacChon.value = false;
}

const oTep = ref<HTMLInputElement | null>(null);
async function chonAnh(e: Event): Promise<void> {
  const tep = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!tep) return;
  const url = await nenAnh(tep);
  if (url) { anh.value = url; baoLoiGui.value = ''; } else baoLoiGui.value = t('bl.anhLoi');
}

async function gui(): Promise<void> {
  if (!duGui.value) { nhacChon.value = true; return; }
  trang.value = 'gui'; baoLoiGui.value = '';
  const kq = await guiBaoLoi({ loai: loai.value, noi: noi.value, vanDe: vanDe.value, noiDung: noiDung.value, email: email.value, anh: anh.value });
  if (kq === 'ok') {
    trang.value = 'xong';
    suKien('bao_loi_gui', { loai: loai.value, noi: noi.value, so_o: vanDe.value.length, co_chu: noiDung.value.trim() ? 1 : 0, co_anh: anh.value ? 1 : 0 });
  } else {
    trang.value = 'nhap';
    baoLoiGui.value = kq === 'nhieuQua' ? t('bl.nhieuQua') : t('bl.loiGui');
  }
}

onMounted(() => moChucNang('bao_loi', { noi: noi.value }));   // THỐNG KÊ: số lần mở hộp (gửi: sự kiện bao_loi_gui)
function dong(): void { if (trang.value !== 'gui') emit('xong'); }
const ICON = { loi: Bug, gopy: Lightbulb, hoi: HelpCircle } as const;
</script>

<template>
  <div class="overlay bl-phu" role="dialog" aria-modal="true" aria-labelledby="blTieuDe" @keydown.esc="dong" @click.self="dong" v-cham-ngoai="dong">
    <div class="panel bl">
      <header class="bl-dau">
        <h2 id="blTieuDe">{{ t('bl.tieuDe') }}</h2>
        <button class="btn bl-dong" type="button" :aria-label="t('bl.dong')" @click="dong"><X :size="20" /></button>
      </header>

      <template v-if="trang !== 'xong'">
        <div class="loai" role="radiogroup" :aria-label="t('bl.loai')">
          <button
            v-for="l in (['loi', 'gopy', 'hoi'] as const)" :key="l" data-phang type="button" role="radio" class="o-loai"
            :class="[l, { chon: loai === l }]" :aria-checked="loai === l" @click="loai = l"
          ><component :is="ICON[l]" :size="19" :stroke-width="2.4" aria-hidden="true" />{{ t(`bl.l.${l}`) }}</button>
        </div>

        <p class="nhan">{{ t('bl.oDau') }}</p>
        <div class="bl-chips" role="radiogroup" :aria-label="t('bl.oDau')">
          <button
            v-for="n in NOI_BL" :key="n" data-phang type="button" role="radio" class="bl-chip"
            :class="{ chon: noi === n }" :aria-checked="noi === n" @click="noi = n"
          >{{ t(`bl.n.${n}`) }}</button>
        </div>

        <template v-if="dsVanDe.length">
          <p class="nhan">{{ loai === 'loi' ? t('bl.chuyenGi') : t('bl.gopYVe') }} <span>{{ t('bl.chonNhieu') }}</span></p>
          <div class="bl-chips" role="group" :aria-label="loai === 'loi' ? t('bl.chuyenGi') : t('bl.gopYVe')" :class="{ nhac: nhacChon }">
            <button
              v-for="v in dsVanDe" :key="v" data-phang type="button" class="bl-chip" :class="{ chon: vanDe.includes(v) }"
              :aria-pressed="vanDe.includes(v)" @click="batTat(v)"
            >{{ t(`bl.v.${v}`) }}</button>
          </div>
        </template>

        <label class="o-chu">
          <span class="nhan">{{ loai === 'hoi' ? t('bl.cauHoi') : t('bl.moTa') }}</span>
          <textarea v-model="noiDung" rows="3" maxlength="2000" :placeholder="loai === 'hoi' ? t('bl.cauHoiGoiY') : t('bl.moTaGoiY')" />
        </label>

        <div class="hang-anh">
          <button v-if="!anh" data-phang class="nut-anh" type="button" @click="oTep?.click()"><ImagePlus :size="19" :stroke-width="2.3" aria-hidden="true" />{{ t('bl.themAnh') }}</button>
          <div v-else class="anh-nho">
            <img :src="anh" alt="">
            <button data-phang type="button" class="bo-anh" :aria-label="t('bl.boAnh')" @click="anh = null"><X :size="14" :stroke-width="3" /></button>
          </div>
          <input ref="oTep" type="file" accept="image/*" hidden @change="chonAnh">
        </div>

        <label class="o-email">
          <span class="sr-only">{{ t('bl.email') }}</span>
          <input v-model="email" type="email" inputmode="email" autocomplete="email" maxlength="190" :placeholder="t('bl.email')">
        </label>

        <p class="kem">{{ t('bl.kem') }}</p>
        <p v-if="baoLoiGui" class="loi-gui" role="alert">{{ baoLoiGui }}</p>
        <p v-else-if="nhacChon" class="loi-gui" role="status">{{ loai === 'hoi' ? t('bl.canCauHoi') : t('bl.canChon') }}</p>

        <button class="btn btn-primary bl-gui" type="button" :class="{ tat: !duGui }" :aria-disabled="!duGui || trang === 'gui'" @click="gui">
          <Send v-if="trang !== 'gui'" :size="18" :stroke-width="2.4" aria-hidden="true" />{{ trang === 'gui' ? t('bl.dangGui') : t('bl.gui') }}
        </button>
      </template>

      <div v-else class="xong" role="status">
        <span class="vong-xong"><CircleCheck :size="44" :stroke-width="2.2" aria-hidden="true" /></span>
        <h3>{{ t('bl.xong') }}</h3>
        <p>{{ email.trim() ? t('bl.xongEmail') : t('bl.xongPhu') }}</p>
        <button class="btn btn-primary bl-gui" type="button" @click="emit('xong')">{{ t('bl.dong') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bl-phu {
  position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(10, 12, 32, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.bl {
  width: min(440px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
  padding: 16px 14px 14px; background: var(--panel-solid, #fff); border-radius: 26px;
}
.bl > * { flex-shrink: 0; }
.bl-dau { display: flex; align-items: center; min-height: 34px; position: relative; }
.bl-dau h2 { margin: 0; font-size: var(--text-xl, 22px); }
.bl-dong { position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; min-height: 36px; padding: 0; display: grid; place-items: center; }

.loai { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.o-loai {
  --c: #ef4444; display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 46px; padding: 0 6px; border-radius: 14px; cursor: pointer;
  font: 800 15px/1.1 var(--font-display); color: var(--fg); background: color-mix(in srgb, var(--fg) 6%, transparent); border: 2px solid transparent;
}
.o-loai.gopy { --c: #f59e0b; } .o-loai.hoi { --c: #3b82f6; }
.o-loai svg { color: var(--c); flex: none; }
.o-loai.chon { border-color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); box-shadow: 0 3px 0 color-mix(in srgb, var(--c) 55%, #000); }

.nhan { margin: 4px 0 -2px; font: 800 12px/1.2 var(--font-display); text-transform: uppercase; letter-spacing: .03em; color: var(--muted); }
.nhan span { text-transform: none; letter-spacing: 0; font-weight: 700; }
.bl-chips { display: flex; flex-wrap: wrap; gap: 7px; border-radius: 14px; transition: box-shadow .2s; }
.bl-chips.nhac { box-shadow: 0 0 0 3px color-mix(in srgb, #f59e0b 60%, transparent); }
.bl-chip {
  min-height: 38px; padding: 0 13px; border-radius: 999px; cursor: pointer; font: 700 14px/1.1 var(--font-body, inherit); color: var(--fg);
  background: color-mix(in srgb, var(--fg) 6%, transparent); border: 2px solid transparent;
}
.bl-chip.chon { border-color: var(--accent, #6a5cff); background: color-mix(in srgb, var(--accent, #6a5cff) 18%, transparent); font-weight: 800; }

.o-chu { display: flex; flex-direction: column; gap: 6px; }
.o-chu textarea, .o-email input {
  width: 100%; border-radius: 14px; border: 2px solid color-mix(in srgb, var(--fg) 14%, transparent); background: color-mix(in srgb, var(--fg) 4%, var(--panel-solid, #fff));
  color: var(--fg); font: 600 15px/1.4 var(--font-body, inherit); padding: 10px 12px; outline: none; resize: vertical;
}
.o-email input { height: 46px; }
.o-chu textarea:focus, .o-email input:focus { border-color: var(--accent, #6a5cff); }
.hang-anh { display: flex; }
.nut-anh {
  display: inline-flex; align-items: center; gap: 7px; min-height: 42px; padding: 0 14px; border-radius: 14px; cursor: pointer; color: var(--fg);
  font: 700 14px var(--font-body, inherit); background: none; border: 2px dashed color-mix(in srgb, var(--fg) 22%, transparent);
}
.anh-nho { position: relative; }
.anh-nho img { display: block; height: 84px; border-radius: 12px; border: 2px solid color-mix(in srgb, var(--fg) 14%, transparent); }
.bo-anh { position: absolute; top: -8px; right: -8px; width: 26px; height: 26px; min-height: 0; padding: 0; border-radius: 50%; display: grid; place-items: center; border: 0; cursor: pointer; background: #ef4444; color: #fff; }
.kem { margin: 0; font-size: 12px; line-height: 1.4; font-weight: 600; color: var(--muted); }
.loi-gui { margin: 0; font-size: 13px; font-weight: 800; color: #dc2626; }
.bl-gui { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 50px; font-size: 18px; margin-top: 2px; }
.bl-gui.tat { filter: grayscale(1); opacity: .55; }
.xong { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 10px 6px 2px; }
.vong-xong { width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center; color: #16a34a; background: color-mix(in srgb, #22c55e 18%, transparent); }
.xong h3 { margin: 4px 0 0; font-size: 20px; }
.xong p { margin: 0 0 6px; font-size: 14px; font-weight: 600; color: var(--muted); }
.xong .bl-gui { align-self: stretch; }
@media (prefers-reduced-motion: reduce) { .bl-chips { transition: none; } }
</style>
