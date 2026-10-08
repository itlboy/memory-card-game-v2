<script setup lang="ts">
import { sizeForLevel } from '@mm/engine';
import { LogOut, X } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { num } from '@/lib/format';
import { bangXepHang, dangTai, dangXuat, me, veNutGoogle, type DongBxh } from '@/lib/taikhoan';

/**
 * MÀN TÀI KHOẢN: chưa đăng nhập thì một nút Google; đã đăng nhập thì hồ sơ
 * (điểm, số ván, thắng/thua/hoà), danh hiệu, kỷ lục theo cỡ bàn và bảng xếp
 * hạng. Khung giống RulesDialog: tiêu đề + nút đóng đứng yên, RUỘT cuộn —
 * nên không phá luật KHÔNG SCROLL của trang.
 */
const emit = defineEmits<{ close: [] }>();
const closeBtn = ref<HTMLButtonElement | null>(null);
const nutGoogle = ref<HTMLElement | null>(null);
const loi = ref('');
const tab = ref<'hoso' | 'bxh'>('hoso');
const bxh = ref<DongBxh[] | null>(null);
const loiBxh = ref('');

onMounted(() => { closeBtn.value?.focus(); veNut(); });
watch(me, (m) => { if (!m) veNut(); });

async function veNut(): Promise<void> {
  if (me.value) return;
  await Promise.resolve();            // chờ v-if dựng xong ô chứa nút
  const el = nutGoogle.value;
  if (!el) return;
  try {
    await veNutGoogle(el, () => { loi.value = ''; }, (e) => { loi.value = e.message === '401' ? 'Google không xác nhận được đăng nhập này.' : 'Đăng nhập không thành — thử lại sau.'; });
  } catch { loi.value = 'Không tải được nút Google. Kiểm tra mạng rồi mở lại.'; }
}

async function moBxh(): Promise<void> {
  tab.value = 'bxh';
  if (bxh.value) return;
  try { bxh.value = await bangXepHang(); } catch { loiBxh.value = 'Không tải được bảng xếp hạng.'; }
}

const tiLeThang = computed(() => {
  const m = me.value;
  return m && m.matches ? Math.round((m.wins / m.matches) * 100) : 0;
});

/** Kỷ lục, đọc tên cỡ bàn từ khoá `mode:L<cấp>`. */
const kyLuc = computed(() => {
  const m = me.value;
  if (!m) return [];
  return Object.entries(m.best)
    .map(([k, r]) => {
      const mm = /^([a-z]+):L(\d+)$/.exec(k);
      const cap = mm ? Number(mm[2]) : 0;
      const sz = cap ? sizeForLevel(cap) : null;
      const ten = mm?.[1] === 'campaign' ? `Chiến dịch màn ${cap}` : sz ? `Bàn ${sz.cols * sz.rows} thẻ` : k;
      return { k, ten, cap, ...r };
    })
    .sort((a, b) => a.cap - b.cap);
});

const daCo = computed(() => new Set(me.value?.achievements ?? []));
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-label="Tài khoản" @keydown.esc="emit('close')">
    <div class="panel">
      <header class="head">
        <h2>Tài khoản</h2>
        <button ref="closeBtn" class="btn" aria-label="Đóng" type="button" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>

      <div class="body">
        <!-- Chưa đăng nhập -->
        <div v-if="!me" class="chua">
          <p class="lead">
            Đăng nhập để <b>điểm, kỷ lục và danh hiệu</b> đi theo bạn sang máy khác
            và có tên trên bảng xếp hạng. Không đăng nhập vẫn chơi bình thường.
          </p>
          <div ref="nutGoogle" class="nut-google" data-nosfx />
          <p v-if="dangTai" class="muted">Đang đăng nhập…</p>
          <p v-if="loi" class="loi" role="alert">{{ loi }}</p>
          <button class="btn-link" type="button" @click="moBxh">Xem bảng xếp hạng</button>
          <ol v-if="tab === 'bxh' && bxh" class="bxh">
            <li v-for="(d, i) in bxh" :key="d.id">
              <span class="hang">{{ i + 1 }}</span>
              <img v-if="d.avatar" :src="d.avatar" alt="" referrerpolicy="no-referrer">
              <span class="ten">{{ d.name }}</span>
              <b>{{ num(d.totalScore) }}</b>
            </li>
            <li v-if="!bxh.length" class="muted">Chưa có ai trên bảng.</li>
          </ol>
          <p v-if="loiBxh" class="loi">{{ loiBxh }}</p>
        </div>

        <!-- Đã đăng nhập -->
        <template v-else>
          <div class="hoso">
            <img v-if="me.avatar" class="avatar" :src="me.avatar" alt="" referrerpolicy="no-referrer">
            <span v-else class="avatar chu">{{ me.name.slice(0, 1) }}</span>
            <div class="ten-khoi">
              <b class="ten">{{ me.name }}</b>
              <span class="muted">{{ num(me.totalScore) }} điểm tích luỹ</span>
            </div>
            <button class="btn" type="button" aria-label="Đăng xuất" title="Đăng xuất" @click="dangXuat(); emit('close')">
              <LogOut :size="18" />
            </button>
          </div>

          <div class="tabs" role="tablist">
            <button class="tab" role="tab" type="button" :aria-selected="tab === 'hoso'" @click="tab = 'hoso'">Hồ sơ</button>
            <button class="tab" role="tab" type="button" :aria-selected="tab === 'bxh'" @click="moBxh">Xếp hạng</button>
          </div>

          <template v-if="tab === 'hoso'">
            <dl class="so">
              <div><dt>Ván</dt><dd>{{ num(me.matches) }}</dd></div>
              <div><dt>Thắng</dt><dd>{{ num(me.wins) }}</dd></div>
              <div><dt>Thua</dt><dd>{{ num(me.losses) }}</dd></div>
              <div><dt>Hoà</dt><dd>{{ num(me.draws) }}</dd></div>
              <div><dt>Tỉ lệ thắng</dt><dd>{{ tiLeThang }}%</dd></div>
            </dl>

            <h3>Danh hiệu <small>{{ daCo.size }}/{{ ACHIEVEMENTS.length }}</small></h3>
            <ul class="danh-hieu">
              <li v-for="a in ACHIEVEMENTS" :key="a.id" :class="{ co: daCo.has(a.id) }">
                <span class="huy" aria-hidden="true">{{ daCo.has(a.id) ? '🏅' : '🔒' }}</span>
                <span><b>{{ a.name }}</b><br><small>{{ a.hint }}</small></span>
              </li>
            </ul>

            <h3>Kỷ lục</h3>
            <ul v-if="kyLuc.length" class="ky-luc">
              <li v-for="r in kyLuc" :key="r.k">
                <span>{{ r.ten }}</span>
                <b>{{ num(r.score) }}</b>
                <small>{{ r.moves }} lượt · {{ r.seconds }}s</small>
              </li>
            </ul>
            <p v-else class="muted">Chưa có kỷ lục nào — chơi một mình xong ván là có.</p>
          </template>

          <template v-else>
            <ol v-if="bxh" class="bxh">
              <li v-for="(d, i) in bxh" :key="d.id" :class="{ toi: d.id === me.id }">
                <span class="hang">{{ i + 1 }}</span>
                <img v-if="d.avatar" :src="d.avatar" alt="" referrerpolicy="no-referrer">
                <span class="ten">{{ d.name }}</span>
                <small>{{ d.wins }}/{{ d.matches }} thắng</small>
                <b>{{ num(d.totalScore) }}</b>
              </li>
              <li v-if="!bxh.length" class="muted">Chưa có ai trên bảng — chơi một ván là bạn đứng đầu.</li>
            </ol>
            <p v-else-if="loiBxh" class="loi">{{ loiBxh }}</p>
            <p v-else class="muted">Đang tải…</p>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; padding: 12px;
  background: rgba(12, 14, 28, .45);
  backdrop-filter: blur(4px);
}
.panel {
  width: 100%; max-width: var(--col-w); max-height: calc(100dvh - 24px);
  display: flex; flex-direction: column; min-height: 0;
  padding: 16px; border-radius: 16px;
  background: var(--panel-solid); border: 1px solid var(--line);
  box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
}
.head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.head h2 { flex: 1; margin: 0; font-size: var(--text-xl); }
.body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.lead { margin: 0 0 14px; font-size: var(--text-md); line-height: 1.5; }
.muted { color: var(--muted); font-size: var(--text-sm); margin: 6px 0 0; }
.loi { color: var(--bad); font-size: var(--text-sm); margin: 8px 0 0; }
.chua { display: flex; flex-direction: column; align-items: center; text-align: center; }
.nut-google { min-height: 44px; display: flex; justify-content: center; }
.btn-link {
  margin-top: 14px; border: 0; background: none; color: var(--accent);
  font: inherit; font-weight: 700; text-decoration: underline; min-height: 44px; cursor: pointer;
}

.hoso { display: flex; align-items: center; gap: 10px; }
.avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex: 0 0 44px; }
.avatar.chu {
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; font-weight: 800;
}
.ten-khoi { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ten { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ten-khoi .muted { margin: 0; }

.tabs { display: flex; gap: 6px; margin: 12px 0 10px; }
.tab {
  flex: 1; min-height: 40px; border-radius: 10px; border: 1px solid var(--line);
  background: transparent; color: var(--muted); font: inherit; font-weight: 700; cursor: pointer;
}
.tab[aria-selected='true'] {
  background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; border-color: transparent;
}

.so { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 0; }
.so div { text-align: center; padding: 8px 2px; border-radius: 10px; background: color-mix(in srgb, var(--fg) 6%, transparent); }
.so dt { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.so dd { margin: 2px 0 0; font-weight: 800; font-variant-numeric: tabular-nums; }

h3 {
  margin: 14px 0 6px; font-size: var(--text-sm);
  text-transform: uppercase; letter-spacing: .08em; color: var(--muted);
}
h3 small { font-weight: 400; letter-spacing: 0; text-transform: none; }

.danh-hieu, .ky-luc, .bxh { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.danh-hieu li {
  display: flex; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 10px;
  background: color-mix(in srgb, var(--fg) 5%, transparent); opacity: .55; font-size: var(--text-sm);
}
.danh-hieu li.co { opacity: 1; background: color-mix(in srgb, var(--warn) 14%, transparent); }
.danh-hieu .huy { font-size: 22px; flex: 0 0 auto; }
.danh-hieu small { color: var(--muted); }

.ky-luc li { display: grid; grid-template-columns: 1fr auto; gap: 0 10px; padding: 6px 10px; border-radius: 10px;
  background: color-mix(in srgb, var(--fg) 5%, transparent); font-size: var(--text-sm); }
.ky-luc b { font-variant-numeric: tabular-nums; }
.ky-luc small { grid-column: 1 / -1; color: var(--muted); }

.bxh li { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px;
  background: color-mix(in srgb, var(--fg) 5%, transparent); font-size: var(--text-sm); }
.bxh li.toi { background: color-mix(in srgb, var(--accent) 18%, transparent); }
.bxh .hang { width: 22px; text-align: center; font-weight: 800; color: var(--muted); }
.bxh img { width: 26px; height: 26px; border-radius: 50%; }
.bxh .ten { flex: 1; min-width: 0; }
.bxh small { color: var(--muted); }
.bxh b { font-variant-numeric: tabular-nums; }
</style>
