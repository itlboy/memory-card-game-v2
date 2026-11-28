<script setup lang="ts">
/**
 * BẢN ĐỒ CHIẾN DỊCH TÌM THẺ (28.11.2026, mockup duyệt https://claude.ai/artifact/BZWf4m2Ma6Tp6rGvnBWJrV): 3 chặng × 10 màn,
 * lưới 5 cột như LevelMap. Ô: số màn + số thẻ; góc dưới phải = tốc độ (Chậm/Vừa/Nhanh) hoặc máy; màn trùm đội vương miện.
 * Luật / mốc sao nói ở tờ "Trước khi chơi" của TimThe.vue.
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import { Bot, Lock, Timer, Turtle, Zap } from 'lucide-vue-next';
import Sao3D from './Sao3D.vue';
import { CHANG_TIM, MAN_TIM, SO_MAN_TIM, tongSaoTim, type ManTim } from '@/lib/chien-dich-tim';
import type { LevelProgress } from '@/lib/storage';
import { anhEmoji } from '@/lib/emoji';
import { t, td } from '@/lib/i18n';

const props = defineProps<{ progress: Record<string, LevelProgress>; unlocked: number }>();
const emit = defineEmits<{ play: [id: number] }>();

const VUONG_MIEN = anhEmoji('👑', true, 128);
const ICON = { de: Turtle, vua: Timer, kho: Zap } as const;
const starsOf = (id: number): number => props.progress[String(id)]?.stars ?? 0;
const cleared = (id: number): boolean => starsOf(id) > 0;
const nextLevel = computed(() => MAN_TIM.find((m) => m.id <= props.unlocked && !cleared(m.id))?.id ?? null);
const tongSao = computed(() => tongSaoTim(props.progress));

const chapters = computed(() => CHANG_TIM.map((c) => {
  const list = MAN_TIM.filter((m) => m.id >= c.from && m.id <= c.to);
  return {
    ...c, list, done: list.filter((m) => cleared(m.id)).length,
    active: nextLevel.value != null && nextLevel.value >= c.from && nextLevel.value <= c.to,
    locked: c.from > props.unlocked,
    name: td(`ctd.chang.${c.id}`), moTa: td(`ctd.moTa.${c.id}`)
  };
}));
const tenTocDo = (m: ManTim): string => t(m.doKho === 'de' ? 'tt.de' : m.doKho === 'vua' ? 'tt.vua' : 'tt.kho');

const list = ref<HTMLElement | null>(null);
onMounted(async () => {
  await nextTick();
  const khung = list.value;
  const el = khung?.querySelector<HTMLElement>('.node.next');
  if (!el || !khung) return;
  const k = khung.getBoundingClientRect(), r = el.getBoundingClientRect();
  khung.scrollTop += (r.top + r.height / 2) - (k.top + k.height / 2);
});
</script>

<template>
  <div class="wrap">
    <p class="summary">{{ t('cd.daDat') }}<b>{{ tongSao }}</b>{{ t('cd.daDatSau', { tong: SO_MAN_TIM * 3 }) }}</p>
    <p class="chu-giai">
      <span><i class="bd de"><Turtle :size="11" :stroke-width="2.6" /></i>{{ t('tt.de') }}</span>
      <span><i class="bd vua"><Timer :size="11" :stroke-width="2.6" /></i>{{ t('tt.vua') }}</span>
      <span><i class="bd kho"><Zap :size="11" :stroke-width="2.6" /></i>{{ t('tt.kho') }}</span>
      <span><i class="bd may"><Bot :size="11" :stroke-width="2.6" /></i>{{ t('ctd.dauMay') }}</span>
      <span><img v-if="VUONG_MIEN" class="vm" :src="VUONG_MIEN" alt="" /><template v-else>👑</template>{{ t('cd.trum') }}</span>
    </p>

    <div ref="list" class="chapters">
      <section
        v-for="c in chapters" :key="c.id"
        class="chapter" :class="{ active: c.active, locked: c.locked, done: c.done === c.list.length }"
      >
        <header>
          <h3>{{ t('cd.chang', { n: c.id, ten: c.name }) }}</h3>
          <Lock v-if="c.locked" class="ch-lock" :size="15" />
          <b v-else class="tally">{{ c.done }}/{{ c.list.length }}</b>
        </header>
        <ol class="nodes">
          <li v-for="m in c.list" :key="m.id">
            <button
              class="node thach" :class="{ locked: m.id > unlocked, cleared: cleared(m.id), next: m.id === nextLevel }"
              :disabled="m.id > unlocked" type="button"
              :aria-label="t('cd.oAria', { id: m.id, n: m.soThe }) + ` · ${tenTocDo(m)}` + (m.may ? ` · ${t('ctd.dauMay')}` : '') + (m.id > unlocked ? t('cd.oAriaKhoa') : '')"
              @click="emit('play', m.id)"
            >
              <b>{{ m.id }}</b>
              <small>{{ t('cd.theN', { n: m.soThe }) }}</small>
              <span v-if="cleared(m.id)" class="stars" aria-hidden="true">
                <Sao3D v-for="k in 3" :key="k" :loai="k <= starsOf(m.id) ? 'sang' : 'tat'" />
              </span>
              <Lock v-if="m.id > unlocked" class="node-lock" :size="10" aria-hidden="true" />
              <span v-if="m.trum" class="luat vm" aria-hidden="true">
                <img v-if="VUONG_MIEN" :src="VUONG_MIEN" alt="" /><template v-else>👑</template>
              </span>
              <span class="luat" aria-hidden="true">
                <i v-if="m.may" class="bd may"><Bot :size="11" :stroke-width="2.6" /></i>
                <i v-else class="bd" :class="m.doKho"><component :is="ICON[m.doKho]" :size="11" :stroke-width="2.6" /></i>
              </span>
            </button>
          </li>
        </ol>
        <footer><span>{{ c.moTa }}</span></footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.summary { margin: 0 0 8px; color: var(--muted); font-size: var(--text-sm); }
.chu-giai {
  margin: -2px 0 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px;
  font-size: var(--text-xs); font-weight: 600; color: var(--muted);
}
.chu-giai span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.chu-giai .vm { width: 16px; height: 16px; }
.chapters {
  flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px;
  overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
  padding: 2px 8px; margin-inline: -6px;
}
.chapter {
  border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--panel-soft); padding: 12px;
  display: flex; flex-direction: column; gap: 10px;
}
.chapter.active { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); box-shadow: var(--elev-1); }
.chapter.done { border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
.chapter.locked { opacity: .62; }
.chapter header { display: flex; align-items: center; gap: 8px; }
.chapter h3 { margin: 0; flex: 1; min-width: 0; font-family: var(--font-display); font-weight: 700; font-size: var(--text-md); }
.chapter.done h3 { color: var(--ok); }
.tally { font-size: var(--text-xs); font-weight: 800; color: var(--muted); }
.chapter.active .tally { color: var(--accent); }
.chapter.done .tally { color: var(--ok); }
.ch-lock { color: var(--muted); flex-shrink: 0; }
.chapter footer { font-size: var(--text-xs); color: var(--muted); }

.nodes { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; list-style: none; margin: 0; padding: 0; }
.nodes li { display: flex; }
.node {
  position: relative; width: 100%; aspect-ratio: 1; min-height: 44px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 2px; overflow: visible;
  border: 2px solid var(--line); border-radius: var(--r-md); background: var(--panel-solid); color: var(--fg);
  container-type: inline-size;
}
.node b { font-family: var(--font-display); font-weight: 800; font-size: clamp(15px, 38cqw, 21px); line-height: 1.05; }
.node.cleared b { margin-top: 13px; }
.node small { color: var(--muted); font-size: clamp(8px, 22cqw, 11px); white-space: nowrap; }
.node .stars {
  position: absolute; top: 6px; left: 0; right: 0;
  font-size: clamp(7px, 19cqw, 10px); color: var(--gold); line-height: 1.2; white-space: nowrap;
}
.node.cleared { border-color: color-mix(in srgb, var(--ok) 50%, transparent); background: color-mix(in srgb, var(--ok) 12%, var(--panel-solid)); }
.node.next { border-color: transparent; color: var(--chon-chu); background: var(--chon-nen); box-shadow: 0 0 0 3px var(--accent-soft), var(--elev-1); }
.node.next small { color: var(--chon-chu); opacity: .85; font-weight: 700; }
.node.locked { background: transparent; color: var(--muted); opacity: .72; }
.node-lock { position: absolute; top: 2px; right: 2px; color: var(--muted); }
.luat { position: absolute; right: -6px; bottom: -6px; z-index: 1; line-height: 0; filter: drop-shadow(0 1px 1px rgba(10, 20, 60, .25)); }
.luat.vm { right: auto; bottom: auto; left: -6px; top: -6px; rotate: -18deg; font-size: 16px; line-height: 1; }
.luat.vm img { width: 20px; height: 20px; }
.node.locked .luat { opacity: .75; }
/* Huy hiệu tốc độ / máy: Lucide trắng trong ô màu theo nghĩa (không emoji hệ thống) */
.bd {
  display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 5px; color: #fff; font-style: normal;
}
.luat .bd { outline: 2px solid #fff; }
.bd.de { background: linear-gradient(#4fd1a5, #24a07a); }
.bd.vua { background: linear-gradient(#ffb04a, #f07d12); }
.bd.kho { background: linear-gradient(#ff6f8a, #dd3456); }
.bd.may { background: linear-gradient(#a07bff, #7044e0); }
@media (hover: hover) { .node:not(:disabled):hover { border-color: var(--accent); transform: translateY(-1px); } }
</style>
