<script setup lang="ts">
/**
 * Hộp CHIA SẺ PHÒNG: mã QR + mã 6 số + hai nút copy.
 *
 * Vì sao là hộp riêng chứ không phải khối bung ra như trước: mã QR cần chỗ, mà
 * phòng chờ là màn KHÔNG ĐƯỢC SCROLL và phải nhường chỗ cho tới 10 người chơi.
 * Đưa vào hộp thì lúc cần mới chiếm màn hình, xong thì trả lại hết.
 *
 * QR vẽ ra canvas TẠI CHỖ, không gọi dịch vụ sinh QR nào bên ngoài: link phòng
 * là thứ riêng của nhóm bạn, không có lý do gì để nó đi qua máy chủ người khác.
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { Check, Copy, Link2, X } from 'lucide-vue-next';
import QRCode from 'qrcode';

const props = defineProps<{ code: string; link: string; inviteText: string }>();
const emit = defineEmits<{ close: [] }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const nutDong = ref<HTMLButtonElement | null>(null);
const daCopyMa = ref(false);
const daCopyLink = ref(false);
const loiQR = ref(false);

async function copy(text: string, cua: 'ma' | 'link'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    const co = cua === 'ma' ? daCopyMa : daCopyLink;
    co.value = true;
    setTimeout(() => { co.value = false; }, 1600);
  } catch { /* trình duyệt chặn clipboard */ }
}

function phim(e: KeyboardEvent): void { if (e.key === 'Escape') emit('close'); }

onMounted(async () => {
  nutDong.value?.focus();
  document.addEventListener('keydown', phim);
  try {
    // Màu lấy từ token thật để QR hợp với phần còn lại, và ĐỦ TƯƠNG PHẢN cho
    // máy quét: nền trắng đặc, không dùng nền trong suốt.
    await QRCode.toCanvas(canvas.value, props.link, {
      width: 200, margin: 1,
      color: { dark: '#1c1f36', light: '#ffffff' }
    });
  } catch { loiQR.value = true; }
});
onUnmounted(() => document.removeEventListener('keydown', phim));
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-label="Chia sẻ phòng" @click.self="emit('close')">
    <div class="hop">
      <header>
        <h2>Mời bạn vào phòng</h2>
        <button ref="nutDong" class="dong" type="button" aria-label="Đóng" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>

      <!-- QR quét được là vào thẳng phòng: bạn bè khỏi gõ mã, khỏi gõ link -->
      <div class="qr">
        <canvas v-show="!loiQR" ref="canvas" aria-label="Mã QR dẫn vào phòng"></canvas>
        <p v-if="loiQR" class="loi">Không vẽ được mã QR — dùng mã hoặc link bên dưới.</p>
      </div>

      <p class="ma-lon">{{ code }}</p>
      <p class="giai-thich">Quét mã, hoặc đọc 6 số này cho bạn bè</p>

      <div class="nut">
        <button class="btn" type="button" @click="copy(code, 'ma')">
          <Check v-if="daCopyMa" :size="17" /><Copy v-else :size="17" />
          {{ daCopyMa ? 'Đã copy mã' : 'Copy mã' }}
        </button>
        <button class="btn chinh" type="button" :title="inviteText" @click="copy(inviteText, 'link')">
          <Check v-if="daCopyLink" :size="17" /><Link2 v-else :size="17" />
          {{ daCopyLink ? 'Đã copy link' : 'Copy link' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; padding: 20px;
  background: rgba(6, 9, 18, .62);
}
.hop {
  width: 100%; max-width: 320px; padding: 14px 16px 16px;
  border-radius: var(--r-lg); background: var(--panel-solid);
  box-shadow: var(--elev-2);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
header { display: flex; align-items: center; gap: 10px; width: 100%; }
h2 { flex: 1; margin: 0; font-size: var(--text-lg); }
/* Nút đóng: hình 32px nhưng vùng chạm 44px (NF-07), nới bằng ::after */
.dong {
  position: relative; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; min-width: 0; min-height: 0; padding: 0;
  border: 0; border-radius: 10px; background: var(--panel-soft); color: var(--muted);
}
.dong::after { content: ''; position: absolute; inset: -6px; }

.qr {
  display: flex; align-items: center; justify-content: center;
  padding: 8px; border-radius: var(--r-md); background: #fff;
  min-height: 120px;
}
.qr canvas { display: block; width: 200px; height: 200px; }
.loi { margin: 0; padding: 0 8px; color: var(--muted); font-size: var(--text-sm); text-align: center; }

.ma-lon {
  margin: 0; font-family: var(--font-display); font-weight: 800;
  font-size: 30px; letter-spacing: .16em; line-height: 1;
  color: var(--accent); font-variant-numeric: tabular-nums;
}
.giai-thich { margin: 0; color: var(--muted); font-size: var(--text-xs); text-align: center; }

.nut { display: flex; gap: 8px; width: 100%; }
.nut .btn { flex: 1; gap: 6px; font-size: var(--text-sm); font-weight: 700; }
.nut .chinh {
  border: 0; color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 6px 16px var(--card-back-glow);
}
</style>
