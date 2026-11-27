<script setup lang="ts">
import { vChamNgoai } from '@/lib/cham-ngoai';
/**
 * CHỈ SỐ TRÍ NHỚ — màn GỌN (bản 4, 25.11.2026: mockup B duyệt https://claude.ai/artifact/MPUFzw758MSrAqUN4osP3t,
 * chủ dự án: "giao diện hơi xấu… đừng quá nhiều thứ làm loạn"; chọn B và "điểm số cho nhỏ bớt đi, 50%").
 * MỞ CHO MỌI NGƯỜI từ 1.9.66 (cổng `hienTriNho` ở lib/tri-nho.ts, nay luôn bật). Công thức 5 chặng nhớ: engine `chiSoTriNho`.
 * Chủ dự án chốt từ trước: tên "Chỉ số trí nhớ"; biểu tượng BIỂU ĐỒ (không bao giờ cái não); không có khái niệm "cặp";
 * bậc Đồng → Kim cương mốc cố định, KHÔNG so với bot.
 *
 * CHỈ BA KHỐI: (1) huy chương mang màu bậc, điểm nằm TRONG huy chương + THANH 5 BẬC (mình đang ở đâu) + còn bao nhiêu tới bậc kế;
 * (2) một hình, hai tab: "5 chặng nhớ" (5 cột — nhìn ra "càng lâu càng quên") / "14 ngày" (bấm cột = xem điểm RIÊNG ngày đó — từ 27.11.2026 mỗi ngày một điểm; trước đó kỳ 7 ngày
 * kết thúc ở ngày đó; nhãn tab thành "14 ngày · 20/11", bấm cột cuối là về hôm nay); (3) nút "Luyện ngay".
 * ĐÃ BỎ (bản 3 có, bị chê rối): vòng điểm + "/ 1000", điểm từng chặng "116/150", ba tiêu đề chữ hoa, 14 nhãn ngày,
 * dòng "so với tuần trước", dòng chú thích cuối, dòng "bấm cột để xem".
 * BỐ CỤC ĐỨNG YÊN: hai tab cùng chiều cao, khối huy chương cùng chiều cao dù có điểm hay chưa, nút luôn hiện — đổi
 * tab / đổi ngày CHỈ ĐỔI SỐ (chủ dự án: "bấm cột khác… giao diện thì nhảy, tại sao phải làm thế?").
 * MÀU: phần chính lấy màu của BẬC; ngọc chỉ còn ở các cột — hai tông (đậm nền sáng, sáng nền tối) vì một tông chỉ đạt 2,7–3,0.
 */
import { ChartColumn, Crown, Play, Share2, X } from 'lucide-vue-next';
import { LAN_MO_CHANG } from '@mm/engine';
import { computed, onMounted, ref } from 'vue';
import { moChucNang } from '@/lib/phan-tich';
import { t, td } from '@/lib/i18n';
import { num } from '@/lib/format';
import { store } from '@/lib/storage';
import { MOC_CO_DIEM, chiSo, chiSoTai, daXemTriNho, dayNgay, ngayTuKhoa, theNenLuyen, vanConThieu } from '@/lib/tri-nho';
import { ngayMay } from '@/lib/storage';
import { daMuaPremium, moPremium, moiNangCap } from '@/lib/premium';
import { veAnhTriNho } from '@/lib/anh-ket-qua';
import { hoSo, tenToi } from '@/lib/ho-so';
import { SITE_URL } from '@/lib/native';
import LuuChiaSe from './LuuChiaSe.vue';

const emit = defineEmits<{ close: []; luyen: [soThe: number] }>();
const nutDong = ref<HTMLButtonElement | null>(null);
onMounted(() => { nutDong.value?.focus(); daXemTriNho(); });

const nhatKy = store.nhatKyTriNho();
const SO_COT = 14;
const ngay = dayNgay(SO_COT);
const homNay = ngay[SO_COT - 1]!;
/** Ngày đang xem (khoá `YYYY-MM-DD`) — mặc định hôm nay; bấm cột ở tab 14 ngày để đổi. */
const chon = ref(homNay);
const laHomNay = computed(() => chon.value === homNay);
/*
 * HAI BIỂU ĐỒ CÙNG LÚC (26.11.2026, chủ dự án: "thêm 14 ngày vào cả trong app" — trước là hai tab, chỉ thấy một hình): "Theo số
 * lượt" (5 chặng) luôn hiện, ngay dưới là "Theo thời gian" (14 ngày). `tab` giờ chỉ đổi biểu đồ THỜI GIAN: 14 ngày ↔ Cả năm
 * (Premium). Mockup https://claude.ai/artifact/WLMtGi289WrYicB9N3wYb3 (bản ảnh chia sẻ) — chủ dự án cho tự duyệt.
 */
const tab = ref<'ngay' | 'nam'>('ngay');

const ky = computed(() => chiSoTai(nhatKy, ngayTuKhoa(chon.value)));
const conVan = computed(() => vanConThieu(ky.value));
/** Gợi ý luyện LUÔN theo số liệu HÔM NAY (luyện là luyện bây giờ) — đang xem ngày cũ nút vẫn hiện, vẫn đúng một con số. */
const theLuyen = theNenLuyen(chiSoTai(nhatKy).chang);
const tenBac = (b: number): string => td(`tn.bac.${b}`);
const SO_BAC = 5;
/** Đoạn của bậc `b` trên thanh 5 bậc tô bao nhiêu %: bậc đã qua = đầy, bậc đang ở = tới chỗ mình đứng, bậc chưa tới = trống. */
const doDay = (b: number): number => {
  const k = ky.value;
  return k.bac === null || b > k.bac ? 0 : b < k.bac ? 100 : Math.round(k.tienBac * 100);
};

const cot = ngay.map((k) => {
  const van = Object.values(nhatKy[k]?.ban ?? {}).reduce((a, b) => a + b.van, 0);
  return { k, diem: chiSoTai(nhatKy, ngayTuKhoa(k)).diem, choi: van > 0 };
});
/** Đỉnh của biểu đồ = ngày cao nhất đang hiện (tối thiểu 200): chia theo 1000 thì người 300–500 điểm chỉ thấy một dải
 *  cột lùn. Mục đích của biểu đồ là XU HƯỚNG; con số tuyệt đối đã nằm trong huy chương. */
const dinh = Math.max(200, ...cot.map((c) => c.diem ?? 0));
/**
 * Chiều cao một cột theo tỉ lệ 0..1 của PHẦN CÒN LẠI sau khi trừ chỗ cho con số: con số nằm NGAY TRÊN ĐỈNH cột (25.11.2026,
 * chủ dự án gửi ảnh: số % xếp một hàng trên cùng, cột thấp như 28% cách số của nó cả khoảng) — số và cột chung một
 * khung xếp từ đáy lên, nên cột cao nhất vẫn phải chừa `CHO_SO` px cho số của nó.
 */
const CHO_SO = 21;
const caoThan = (tiLe: number): string => `calc((100% - ${CHO_SO}px) * ${Math.min(1, tiLe).toFixed(3)})`;
const caoCot = (d: number | null): string => (d === null ? '4px' : caoThan(Math.max(0.1, d / dinh)));
const ngayThang = (k: string): string => `${Number(k.slice(8))}/${Number(k.slice(5, 7))}`;
/**
 * Chỉ ghi ngày ở cột ĐẦU, cột CUỐI và cột ĐANG CHỌN — 14 nhãn là 14 con số không ai đọc. Nhãn ("24/11") rộng hơn cột,
 * nên nhãn đầu/cuối NHƯỜNG khi cột đang chọn nằm sát nó (cách dưới 2 cột): chủ dự án gửi ảnh 25.11.2026 — chọn 24/11
 * thì "24/11" đè lên "25/11".
 */
const viTriChon = computed(() => ngay.indexOf(chon.value));
/*
 * TAB "CẢ NĂM" — QUYỀN LỢI PREMIUM (26.11.2026, mockup duyệt https://claude.ai/artifact/ALpRKG88kcozoAgRgw9gCh mục 3).
 * 12 cột = 12 tháng gần nhất (tháng này ở cuối), mỗi cột là chỉ số GỘP CẢ THÁNG (cùng công thức `chiSo`, gộp mọi ngày
 * của tháng). Máy giữ 400 ngày nhật ký (`TRI_NHO_GIU_NGAY`) nên đủ số liệu. Tab đeo vương miện; chưa có Premium thì bấm vào
 * là mở bảng Premium. Chỉ bày khi có Premium hoặc đang được mời nâng cấp (cùng cổng mọi đồ Premium).
 */
const hienTabNam = computed(() => daMuaPremium.value || moiNangCap.value);
const nayD = new Date();
const thang = Array.from({ length: 12 }, (_, i) => {
  const dau = new Date(nayD.getFullYear(), nayD.getMonth() - 11 + i, 1, 12);
  const soNgay = new Date(dau.getFullYear(), dau.getMonth() + 1, 0).getDate();
  const cacNgay = Array.from({ length: soNgay }, (_, d) => nhatKy[ngayMay(new Date(dau.getFullYear(), dau.getMonth(), d + 1, 12))]);
  return { k: `${dau.getFullYear()}-${dau.getMonth() + 1}`, thang: dau.getMonth() + 1, diem: chiSo(cacNgay).diem };
});
const dinhNam = Math.max(200, ...thang.map((c) => c.diem ?? 0));
const thangChon = ref(thang.length - 1);
function moTabNam(): void {
  if (!daMuaPremium.value) { moChucNang('premium_tri_nho_khoa'); emit('close'); moPremium('tri-nho'); return; }
  tab.value = 'nam';
  moChucNang('tri_nho_ca_nam', {}, true);
}
/*
 * CHIA SẺ (26.11.2026, chủ dự án: "làm tính năng chia sẻ chỉ số trí nhớ… nhớ kèm link để người dùng cài app"; "vừa có text vừa
 * có ảnh"). Nút ở đầu bảng, cạnh nút đóng; chỉ hiện khi đã có điểm. Mở bảng xem trước ảnh (LuuChiaSe) với Lưu / Chia sẻ —
 * chia sẻ gửi ẢNH + CÂU + LINK `/tai` (trang tự chuyển tới App Store / Google Play theo máy người bấm, máy tính thì hiện cả
 * hai nút và "chơi trên web"). Link cũng in trên ảnh vì Facebook / Instagram bỏ phần chữ đi kèm.
 * App Android cũ chưa có plugin chia sẻ file: bảng chia sẻ không mở được thì chép câu + link (lib/anh-ket-qua.ts).
 */
const LINK_TAI = `${SITE_URL}/tai`;
const moChiaSe = ref(false);
function chiaSe(): void { moChucNang('tri_nho_chia_se'); moChiaSe.value = true; }
const veAnh = (): Promise<Blob> => {
  const k = ky.value;
  return veAnhTriNho({
    tenApp: t('tb.thuongHieu'), tieuDe: hoSo.value.xong && tenToi.value ? t('tn.cs.cua', { ten: tenToi.value }) : t('tn.ten'), diem: k.diem ?? 0, bac: k.bac ?? 0, tenBac: tenBac(k.bac ?? 0),
    cacBac: Array.from({ length: SO_BAC }, (_, i) => tenBac(i)),
    chang: k.chang.map((c, i) => ({ nhan: td(`tn.chang.${i}`), tiLe: c.mo ? c.tiLe : null })),
    cau: t('tn.cs.cau'), taiApp: t('tn.cs.taiApp'), link: LINK_TAI,
    nguoi: hoSo.value.xong ? { ten: tenToi.value, mat: hoSo.value.mat, mau: hoSo.value.mau } : undefined,
    ngay14: cot.map((c) => c.diem), nhan14: [ngayThang(cot[0]!.k), ngayThang(cot[cot.length - 1]!.k)],
    muc5: t('tn.tab5'), muc14: t('tn.cs.muc14'), lech: lechTuan.value
  });
};
/** "▲ 32 điểm so với hôm trước" — so điểm ngày đang xem với NGÀY CÓ ĐIỂM gần nhất trước nó (cả hai đủ số liệu mới hiện). */
const lechTuan = computed(() => {
  const nay = ky.value.diem;
  const truoc = [...cot].reverse().find((c) => c.k < chon.value && c.diem !== null)?.diem ?? null;
  if (truoc === null || nay === null || nay === truoc) return undefined;
  return t(nay > truoc ? 'tn.cs.tang' : 'tn.cs.giam', { n: Math.abs(nay - truoc) });
});
const chuChiaSe = computed(() => t('tn.cs.chu', { diem: ky.value.diem ?? 0, bac: tenBac(ky.value.bac ?? 0) }));
const coNhan = (k: string, i: number): boolean =>
  k === chon.value || ((i === 0 || i === SO_COT - 1) && Math.abs(i - viTriChon.value) >= 2);
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="tnTitle" @keydown.esc="emit('close')" @click.self="emit('close')" v-cham-ngoai="() => { emit('close'); }">
    <div class="panel tn">
      <header class="tn-head">
        <h2 id="tnTitle"><ChartColumn :size="22" :stroke-width="2.4" aria-hidden="true" /> {{ t('tn.ten') }}</h2>
        <span class="tn-nut">
          <button v-if="ky.diem !== null && laHomNay" class="btn chia-se" :aria-label="t('tn.cs.nut')" type="button" @click="chiaSe"><Share2 :size="19" :stroke-width="2.4" /></button>
          <button ref="nutDong" class="btn" :aria-label="t('dhd.dong')" type="button" @click="emit('close')"><X :size="20" /></button>
        </span>
      </header>
      <Teleport to="body"><LuuChiaSe v-if="moChiaSe" :ve="veAnh" :chu="chuChiaSe" :url="`${LINK_TAI}?utm_source=chia_se&utm_medium=tri_nho`" @close="moChiaSe = false" /></Teleport>

      <!-- (1) TÔI Ở ĐÂU: điểm trong huy chương màu bậc -->
      <section v-if="ky.diem !== null" class="giua">
        <span class="huy" :class="`b${ky.bac}`" role="img" :aria-label="`${num(ky.diem)}`"><b :class="{ dai: ky.diem >= 1000 }">{{ ky.diem }}</b></span>
        <!-- GHI RÕ điểm của NGÀY NÀO và tính trên bao nhiêu ngày (26.11.2026, chủ dự án: "ghi rõ điểm số hôm nay"; trước đó hỏi
             "điểm hiện tại là trung bình của bao nhiêu ngày?") — từ 27.11.2026 điểm là của RIÊNG ngày đó ("hôm nào hiện điểm
             hôm đó"), xem lại các ngày trước ở biểu đồ -->
        <p class="huy-chu"><b>{{ laHomNay ? t('tn.diemHomNay') : t('tn.diemNgay', { ngay: ngayThang(chon) }) }}</b></p>
        <!-- THANH 5 BẬC (25.11.2026, mockup kiểu 1 duyệt https://claude.ai/artifact/SkY2LJDiSgiKde8yQLfbRF; chủ dự án: "chưa
             biểu thị được các bậc… thanh ngang hiển thị mình đang ở đâu"): mỗi bậc một đoạn mang màu của nó, đoạn đã qua
             tô đầy, đoạn đang ở tô tới chỗ mình đứng + vạch đánh dấu; tên 5 bậc ngay dưới, bậc của mình in đậm — thay
             dòng chữ to "Bậc Vàng" và thanh ngắn tới bậc kế. -->
        <div class="thang" role="img" :aria-label="t('tn.bacTen', { ten: tenBac(ky.bac!) })">
          <div class="doan">
            <i v-for="b in SO_BAC" :key="b" :class="`b${b - 1}`">
              <u :style="{ width: `${doDay(b - 1)}%` }" />
              <s v-if="b - 1 === ky.bac" :style="{ left: `${doDay(b - 1)}%` }" />
            </i>
          </div>
          <div class="ten5" aria-hidden="true"><span v-for="b in SO_BAC" :key="b" :class="{ day: b - 1 === ky.bac }">{{ tenBac(b - 1) }}</span></div>
        </div>
        <p class="toi-bac">
          <span v-if="ky.conToiBac !== null">{{ t('tn.conBac', { n: num(ky.conToiBac) }) }} {{ tenBac(ky.bac! + 1) }}</span>
          <span v-else>{{ t('tn.bacCaoNhat') }}</span>
        </p>
      </section>
      <section v-else class="giua">
        <span class="huy khoa" aria-hidden="true"><ChartColumn :size="26" :stroke-width="2.6" /></span>
        <strong>{{ t('tn.khoa', { n: conVan }) }}</strong>
        <p class="toi-bac">
          <span class="ray khoa" role="img" :aria-label="`${ky.coHoi} / ${MOC_CO_DIEM}`"><i :style="{ width: `${Math.min(100, Math.round((ky.coHoi / MOC_CO_DIEM) * 100))}%` }" /></span>
          <span>{{ t('tn.khoaMo') }}</span>
        </p>
      </section>

      <!-- (2a) THEO SỐ LƯỢT — luôn hiện -->
      <section class="khoi" :aria-label="t('tn.tab5')">
        <h3 class="dau-khoi">{{ t('tn.tab5') }}</h3>
        <div class="hinh tru">
          <div v-for="(c, i) in ky.chang" :key="i" class="c" :class="{ khoa: !c.mo }">
            <span class="than">
              <b>{{ c.mo ? `${Math.round(c.tiLe! * 100)}%` : `${c.n}/${LAN_MO_CHANG}` }}</b>
              <i :style="c.mo ? { height: caoThan(Math.max(0.04, c.tiLe!)) } : undefined" />
            </span>
            <small>{{ td(`tn.chang.${i}`) }}</small>
          </div>
        </div>
      </section>

      <!-- (2b) THEO THỜI GIAN — 14 ngày; Premium đổi được sang Cả năm -->
      <section class="khoi" :aria-label="t('tn.tab14')">
        <div class="dau-khoi hang">
          <h3>{{ t('tn.tab14') }}</h3>
          <span v-if="hienTabNam" class="doi" role="tablist">
            <button class="thach th-nho" :class="{ 'th-ngoc': tab === 'ngay' }" type="button" role="tab" :aria-selected="tab === 'ngay'" @click="tab = 'ngay'">{{ t('tn.mot14') }}</button>
            <button class="thach th-nho tab-nam" :class="{ 'th-ngoc': tab === 'nam', khoa: !daMuaPremium }" type="button" role="tab" :aria-selected="tab === 'nam'" :aria-label="`${t('tn.tabNam')} — ${t('tp.premium')}`" @click="moTabNam">
              {{ t('tn.tabNam') }}<span class="vm" aria-hidden="true"><Crown :size="10" :stroke-width="3" /></span>
            </button>
          </span>
        </div>
        <!-- NGÀY ĐANG XEM ở dòng RIÊNG, kèm nút về hôm nay -->
        <p v-if="tab === 'ngay' && !laHomNay" class="ngay-xem">{{ t('tn.dangXem', { ngay: ngayThang(chon) }) }}<button data-phang type="button" @click="chon = homNay">{{ t('tn.veHomNay') }}</button></p>
      <!-- Ngày CHƯA CÓ ĐIỂM thì không bấm được (trừ hôm nay): bấm vào quá khứ mà ra "Chơi thêm 4 ván để có điểm" là vô
           nghĩa (chủ dự án gửi ảnh 25.11.2026) — quá khứ thì không chơi thêm được. Bấm ngày cũ luôn ra một con số thật. -->
      <div v-if="tab === 'nam'" class="hinh nam" role="tabpanel">
        <button
          v-for="(c, i) in thang" :key="c.k" data-phang type="button" class="c" :class="{ chon: i === thangChon, trong: c.diem === null }"
          :disabled="c.diem === null" :aria-pressed="i === thangChon" :aria-label="`${t('tn.thang', { n: c.thang })}: ${c.diem === null ? t('tn.chuaDu') : num(c.diem)}`" @click="thangChon = i"
        >
          <span class="than">
            <b>{{ i === thangChon && c.diem !== null ? c.diem : '' }}</b>
            <i :style="{ height: c.diem === null ? '4px' : caoThan(Math.max(0.1, c.diem / dinhNam)) }" />
          </span>
          <small>{{ c.thang }}</small>
        </button>
      </div>
      <div v-else class="hinh ngay" role="tabpanel">
        <button
          v-for="(c, i) in cot" :key="c.k" data-phang type="button" class="c" :class="{ chon: c.k === chon, nghi: !c.choi, trong: c.diem === null }"
          :disabled="c.diem === null && c.k !== homNay"
          :aria-pressed="c.k === chon" :aria-label="`${ngayThang(c.k)}: ${c.diem === null ? t('tn.chuaDu') : num(c.diem)}`" @click="chon = c.k; moChucNang('tri_nho_14_ngay', {}, true)"
        >
          <span class="than">
            <b>{{ c.k === chon && c.diem !== null ? c.diem : '' }}</b>
            <i :style="{ height: caoCot(c.diem) }" />
          </span>
          <small>{{ coNhan(c.k, i) ? ngayThang(c.k) : '' }}</small>
        </button>
      </div>
      </section>

      <!-- (3) HÀNH ĐỘNG — luôn hiện -->
      <button class="btn btn-primary luyen" type="button" @click="emit('luyen', theLuyen)">
        <Play :size="16" :stroke-width="0" fill="currentColor" aria-hidden="true" />{{ t('tn.luyen', { n: theLuyen }) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(10, 12, 32, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
/* Ngọc ĐẬM trên nền sáng · ngọc SÁNG trên nền tối (xem đầu file) */
.tn {
  --tn: #0b7468; --tn-chu: #ffffff; --ray: #e3e7f5; --o: #f1f3fb;
  width: min(410px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;
  padding: 16px 16px 18px; background: var(--panel-solid, #fff); border-radius: 28px;
}
:global([data-theme='dark'] .tn) { --tn: #4fd6c4; --tn-chu: #06302b; --ray: #343c80; --o: #2a3170; }
.tn > * { flex-shrink: 0; }
.tn-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tn-head h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--text-xl, 22px); }
.tn-head h2 svg { color: var(--tn); }
.tn-nut { display: flex; gap: 8px; flex: none; }
.tn-nut .chia-se { color: var(--tn); }
.tn-head .btn { width: 38px; height: 38px; min-height: 38px; padding: 0; display: grid; place-items: center; }

/* (1) Huy chương 60px — nhỏ bằng nửa mockup (chủ dự án: "điểm số cũng cho nhỏ bớt đi, 50%") */
.giua { display: flex; flex-direction: column; align-items: center; gap: 7px; min-height: 142px; }
.huy {
  --h1: #fff0a8; --h2: #f0b400; --h3: #a87400; --hc: #4a3600;
  flex: none; width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; color: var(--hc);
  background: radial-gradient(circle at 34% 28%, var(--h1), var(--h2) 68%); border: 3px solid var(--h3);
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .38), 0 3px 0 var(--h3);
}
.huy b { font: 800 21px/1 var(--font-display); font-variant-numeric: tabular-nums; text-shadow: 0 1px 0 rgba(255, 255, 255, .45); }
.huy b.dai { font-size: 17px; }
.huy-chu { margin: -2px 0 0; font: 700 12.5px/1.3 var(--font-body); color: var(--muted); text-align: center; }
.huy-chu b { color: var(--fg); font-weight: 800; }
.b0 { --h1: #f6d0aa; --h2: #c98345; --h3: #8a4a18; --hc: #45220a; }
.b1 { --h1: #ffffff; --h2: #b3bccd; --h3: #6f7a90; --hc: #2b3346; }
.b2 { --h1: #fff0a8; --h2: #f0b400; --h3: #a87400; --hc: #4a3600; }
.b3 { --h1: #f0fbff; --h2: #86c9ea; --h3: #3f84ad; --hc: #0d3b57; }
.b4 { --h1: #e9e0ff; --h2: #8a6df2; --h3: #4a34b0; --hc: #ffffff; }
.huy.b4 b { text-shadow: 0 1px 0 rgba(0, 0, 0, .35); }
.huy.khoa { --h1: var(--o); --h2: var(--ray); --h3: var(--ray); color: var(--muted); box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .25); }
.giua strong { margin-top: 3px; font: 800 19px/1.15 var(--font-display); color: var(--fg); text-align: center; }
/* Thanh 5 bậc: 5 đoạn bằng nhau (mỗi bậc 200 điểm). <u> = phần tô, <s> = vạch "mình ở đây" (cao hơn thanh, nên đoạn KHÔNG overflow hidden) */
.thang { align-self: stretch; display: flex; flex-direction: column; gap: 6px; margin-top: 5px; }
.doan { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; }
.doan i { position: relative; height: 12px; background: var(--ray); }
.doan i:first-child { border-radius: 6px 0 0 6px; }
.doan i:last-child { border-radius: 0 6px 6px 0; }
.doan u { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--h2); }
.doan s { position: absolute; top: -5px; width: 4px; height: 22px; margin-left: -2px; border-radius: 2px; background: var(--fg); box-shadow: 0 0 0 2px var(--panel-solid, #fff); }
.ten5 { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; }
.ten5 span { font-size: 10.5px; font-weight: 800; line-height: 1.2; text-align: center; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ten5 span.day { color: var(--fg); font-weight: 900; }
.toi-bac { margin: 0; min-height: 20px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 8px;
  font-size: 13px; font-weight: 700; line-height: 1.3; color: var(--muted); text-align: center; }
.toi-bac .ray { flex: none; width: 92px; height: 8px; border-radius: 4px; background: var(--ray); overflow: hidden; }
.toi-bac .ray i { display: block; height: 100%; border-radius: 4px; background: var(--h2); }
.toi-bac .ray.khoa i { background: var(--tn); }

/* (2) Nút chuyển hai tab */
.khoi { display: flex; flex-direction: column; gap: 8px; }
/* Máy thấp (iPhone SE): hai biểu đồ thấp lại cho cả màn vừa một khung, nút Luyện ngay không bị đẩy khuất */
@media (max-height: 700px) { .tn .hinh { height: 92px; } .tn .khoi { gap: 4px; } .tn { gap: 10px !important; } .tn .giua { min-height: 0; } }
.dau-khoi, .dau-khoi h3 { margin: 0; font: 800 12px/1.2 var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.dau-khoi.hang { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 30px; }
.doi { display: flex; gap: 6px; }
/* Tab đang chọn = nút thạch NGỌC (`th-ngoc`): tự đặt nền bằng CSS thường thì kiểu thạch của skin đè mất, hai tab trông y nhau */
.doi button { min-height: 30px; padding: 0 12px; font: 800 12.5px/1 var(--font-body); text-transform: none; letter-spacing: 0; }

/* Hai tab CÙNG chiều cao: [thân co giãn: số 16 + cột] [nhãn 24] */
/* BA TAB (có tab Cả năm): chia đều cả bề ngang, chữ một dòng — để tự co là "Theo thời gian" xuống hai dòng (chụp 26.11.2026) */
.ngay-xem { margin: -6px 0 0; display: flex; align-items: center; justify-content: center; gap: 10px; font: 700 13px/1.3 var(--font-body); color: var(--muted); }
.ngay-xem button { border: 0; background: none; padding: 4px 0; min-height: 28px; color: var(--accent); font: 800 13px/1.2 var(--font-body); text-decoration: underline; cursor: pointer; }
.hinh { height: 128px; display: grid; align-items: stretch; }
.hinh.tru { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.hinh.ngay { grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 3px; }
.hinh.nam { grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 4px; }
/* Tab Cả năm: vương miện nhỏ cạnh chữ; chưa có Premium thì tab hơi mờ (bấm vẫn mở bảng Premium) */
.tab-nam { display: inline-flex; align-items: center; gap: 5px; }
.tab-nam.khoa { opacity: .7; }
.tab-nam .vm { display: grid; place-items: center; width: 15px; height: 15px; border-radius: 50%; background: linear-gradient(180deg, #ffe08a, #f5b324); color: #5b3d00; }
.hinh .c { min-width: 0; min-height: 0; height: 100%; padding: 0; border: 0; background: none; color: var(--fg);
  display: flex; flex-direction: column; align-items: stretch; gap: 5px; }
.hinh button.c { cursor: pointer; }
.hinh button.c:disabled { cursor: default; }
.hinh .c b { flex: none; height: 16px; font: 800 13px/16px var(--font-display); font-variant-numeric: tabular-nums; text-align: center; white-space: nowrap; }
/* Số + cột xếp TỪ ĐÁY LÊN trong cùng một khung → số luôn nằm ngay trên đỉnh cột của nó */
.hinh .than { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: flex-end; align-items: stretch; gap: 5px; }
.hinh .than i { flex: none; display: block; background: var(--tn); }
.hinh .c small { height: 24px; font-size: 11px; font-weight: 800; line-height: 1.15; text-align: center; color: var(--muted); overflow: hidden; }
.tru .than i { border-radius: 10px 10px 6px 6px; }
.tru .khoa .than i { height: 22px; background: repeating-linear-gradient(135deg, var(--ray) 0 5px, transparent 5px 10px); box-shadow: inset 0 0 0 1.5px var(--ray); }
.tru .khoa b { color: var(--muted); font-size: 11.5px; }
.ngay .than i { border-radius: 4px 4px 2px 2px; opacity: .5; }
.ngay .nghi .than i { opacity: .26; }
.ngay .trong .than i { background: var(--ray); opacity: 1; border-radius: 2px; }
.ngay .chon .than i { opacity: 1; }
/* Con số + ngày của cột đang chọn rộng hơn cột (cột chỉ ~22px): cho tràn hai bên, không xuống dòng */
.ngay .c b, .ngay .c small { overflow: visible; display: flex; justify-content: center; white-space: nowrap; }
.ngay .c small { height: 24px; align-items: flex-start; font-variant-numeric: tabular-nums; }
.ngay .chon small { color: var(--tn); }

.luyen { min-height: 50px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 17px; }
</style>
