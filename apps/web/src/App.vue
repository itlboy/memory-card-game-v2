<script setup lang="ts">
import { maPhongDangDo } from '@/composables/useOnlineRoom';
import { boEmojiVeMacDinh } from '@/lib/emoji';
import { skinVeMacDinh } from '@/lib/skin';
import { datPingSo } from '@/lib/ping-so';
import { MemoryGame, presetConfig, configFromOptions, isDraw, CAMPAIGN_LEVELS, LEVEL_KEYS } from '@mm/engine';
import { baoTaiXong, batPhanTich, doiCaiDat, moChucNang, suKien, thamSoVanDau } from '@/lib/phan-tich';
import { BOARD_SIZES, BOT_SPECS, Rng, xoayNguoiDau } from '@mm/engine';
import type { BoardOptions, BotLevel, GameConfig, Mode, PlayerInit } from '@mm/engine';
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue';
import KetCucFx from './components/KetCucFx.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import GameScreen from './components/GameScreen.vue';
import MenuScreen from './components/MenuScreen.vue';
import OnlineScreen from './components/OnlineScreen.vue';
import ResultDialog from './components/ResultDialog.vue';
import RulesDialog from './components/RulesDialog.vue';
import DebugDialog from './components/DebugDialog.vue';
import { MUA_THE_MO } from './lib/mua-the';
import MuaThe from './components/MuaThe.vue';
import TimThe from './components/TimThe.vue';
import { TIM_THE_MO, cheDoGa, dangTimOnline, docChon, luuChon, type TimTheChon, type TimTheKetVan } from './lib/tim-the';
import SoTriNho from './components/SoTriNho.vue';
import BangPremium from './components/BangPremium.vue';
import LaRoi from './components/LaRoi.vue';
import ChonHinhNen from './components/ChonHinhNen.vue';
import ChonNhac from './components/ChonNhac.vue';
import ChonHuyHieu from './components/ChonHuyHieu.vue';
import GhepPremiumFx from './components/GhepPremiumFx.vue';
import { bocLungVan } from './lib/lung-la';
import { canhNgauNhien, doiCanhNgauNhien } from './lib/canh';
import { denGioDoi, ghiMocDoi } from './lib/ngau-nhien';
import { tenBaiNhac } from './lib/ten-bai-nhac';
import { ghiVuaThang, thuXinDanhGia } from './lib/xin-danh-gia';
import MatKhauDebug from './components/MatKhauDebug.vue';
import SaoBang from './components/SaoBang.vue';
import { dangDebug } from './lib/debug';
import { canh } from './lib/canh';
import HoSoDialog from './components/HoSoDialog.vue';
import BaoLoiDialog from './components/BaoLoiDialog.vue';
import { ghiManGanNhat, type NoiBl } from './lib/bao-loi';
import { guiHoSo } from '@/lib/taikhoan';
import { canMoChao, hoSo, mauTaiMay, tenToi } from '@/lib/ho-so';
import { ghiVanTriNho, hienTriNho } from './lib/tri-nho';
import CaiAppDialog from './components/CaiAppDialog.vue';
import { hienCai, moCai } from './lib/cai-app';
import type { XemFx } from './components/DebugMenu.vue';
import { useBackCloser } from '@/composables/useBackGuard';
import { ghiQuery, urlApp } from '@/lib/appUrl';
import { laApp } from '@/lib/native';
import { giuSang } from '@/lib/giu-sang';
import { ngonNgu, t } from '@/lib/i18n';
import { ganTenNeuChua } from '@/lib/ten-ngau-nhien';
import IconDefs from './components/IconDefs.vue';
/*
 * BẢNG ĐO chỉ nạp khi có `?debug=1` — `defineAsyncComponent` nên người chơi
 * thường không tải một byte nào của nó. Nó bọc `window.WebSocket` để biết gói
 * tin về lúc nào, nên KHÔNG được mount ngoài lúc đang soi lỗi.
 */
const DoNhip = defineAsyncComponent(() => import('./components/DoNhip.vue'));
/**
 * Bật bằng nút trong bảng hướng dẫn (nhớ trong localStorage) HOẶC bằng `?debug=1`
 * cho một lần. `?debug=1` cũng GHI vào bản lưu, để mở link một lần rồi chơi tiếp
 * mấy ván sau vẫn còn số đo — lỗi cần soi thường không xuất hiện ở ván đầu.
 */
/* MẬT KHẨU (25.11.2026): BẬT debug — 7 chạm hay `?debug=1` — đều phải qua MatKhauDebug; máy đã bật từ trước thì giữ. */
const debug = ref(!!store.prefs().debug);
const hoiMkDebug = ref(!debug.value && new URLSearchParams(location.search).get('debug') === '1');
function xinDebug(v: boolean): void { if (v) { if (!debug.value) hoiMkDebug.value = true; } else debug.value = false; }
// Skin khác Kẹo chỉ dành cho debug: debug tắt là về Kẹo, trừ lượt mở có `?skin=` (công cụ đo, chụp store)
const coSkinUrl = new URLSearchParams(location.search).has('skin');
watch(debug, (v) => {
  store.savePrefs({ debug: v });
  dangDebug.value = v;
  if (!v) { boEmojiVeMacDinh(); datPingSo(false); if (!coSkinUrl) skinVeMacDinh(); }
}, { immediate: true });
/** Bảng đo nhịp: công tắc riêng trong khu debug, mặc định tắt. */
const doNhip = ref(!!store.prefs().doNhip);
watch(doNhip, (v) => store.savePrefs({ doNhip: v }));
import TopBar from './components/TopBar.vue';
import LoiMoi from './components/LoiMoi.vue';
import ThiDau from './components/ThiDau.vue';
import { batDauSanh, choiMotMinh, dangChoiOffline, nhanMoi, thachCho, trongPhongOnline, type ThachDau } from './lib/sanh';
import { tdTran } from './lib/thidau';
import IconBay from './components/IconBay.vue';
import { BOT_ID, laBot, maBot, useGameSession } from './composables/useGameSession';
import {
  ACHIEVEMENTS, dhAn, dsHien, byId, daCo, dangKhoe, earned, earnedTim, vuaMo, goiY as chonGoiY, levelChoCells, moKhoa, napLaiDaCo, thongKeHienTai, xetThongKe,
  type Achievement
} from './lib/achievements';
import DanhHieuDialog from './components/DanhHieuDialog.vue';
import MoKhoaFx from './components/MoKhoaFx.vue';
import { HIEN_BANG_MS, chonCanh } from './lib/ketcuc-fx';
import { DEFAULT_OPTIONS } from '@mm/engine';
import TaiKhoanDialog from './components/TaiKhoanDialog.vue';
import type { PhaKyLuc } from '@/lib/taikhoan';
import BangXepHang from './components/BangXepHang.vue';
import { me as taiKhoanMe, san as taiKhoanSan, taiKhoan } from './lib/taikhoan';
import { sfx } from './lib/audio';
import { rung } from './lib/rung';
import { nhac, BAI_NHAC, BAI_PREMIUM, baiChoiDuoc, laBaiNhac, type BaiNhac } from './lib/nhac';
import { useViewportLock } from './composables/useViewportLock';
import { diemVuaCong, ngayMay, store, type SoundLevel } from './lib/storage';
import { loadThemes, type CardTheme } from './lib/themes';
import { batChiNutPremium, choiDuoc, daMuaPremium, hienPremium, hienVienPremium, kiemHetHanTang, tangTuDong, yeuCauPremium, type NoiMoPremium } from './lib/premium';

const prefs = store.prefs();
/*
 * NỀN SÁNG/TỐI của skin Neon (skin khác mang bảng màu riêng): mặc định THEO HỆ
 * ĐIỀU HÀNH (chủ dự án 16.10.2026), đổi được thành Sáng/Tối cố định. Bản lưu cũ
 * chỉ có `dark`: ai đã bật nền tối thì giữ Tối, còn lại (mặc định cũ) về Tự động.
 */
const nen = ref<'tu' | 'sang' | 'toi'>(prefs.nen ?? (prefs.dark ? 'toi' : 'tu'));
const mqToi = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const heToi = ref(!!mqToi?.matches);
mqToi?.addEventListener?.('change', (e) => { heToi.value = e.matches; });
const dark = computed(() => nen.value === 'toi' || (nen.value === 'tu' && heToi.value));
const soundLevel = ref<SoundLevel>(prefs.soundLevel);
/** Rung khi ghép thẻ — công tắc riêng cạnh âm thanh trong menu (lib/rung.ts). */
// Công tắc rung TRỞ LẠI (chủ dự án 17.10.2026, trước đó bỏ 14.10.2026). Bản lưu cũ
// `prefs.rung = false` từ thời đó cũng là lựa chọn thật của người chơi nên vẫn đọc.
const rungBat = ref(prefs.rung !== false);
watch(rungBat, (v) => { rung.bat = v; store.savePrefs({ rung: v }); }, { immediate: true });
/** Nhạc nền (lib/nhac.ts): menu vui, trong ván chậm và thưa. Tắt âm thanh là tắt luôn. */
const nhacBat = ref(prefs.nhac !== false);
/** Bài đang chọn. Bài premium mà gói chưa mua/hết hạn thì phát bài mặc định (`baiThat`)
 *  — vẫn giữ lựa chọn, mua lại là về đúng bài cũ. */
const baiNhac = ref<BaiNhac>(laBaiNhac(prefs.baiNhac) ? prefs.baiNhac : 'keo');
const baiThat = computed<BaiNhac>(() => (baiChoiDuoc(baiNhac.value) ? baiNhac.value : 'keo'));
/*
 * NHẠC NGẪU NHIÊN (26.11.2026, chủ dự án: "có thêm mục ngẫu nhiên… chúng ta sẽ đổi ngẫu nhiên"): bật thì khoảng 30 phút một
 * lần (nhịp chung với hình nền — `doiNgauNhienNeuDenGio` bên dưới) đổi sang một bài KHÁC trong các bài chơi được (bài Premium chỉ khi đã có Premium).
 * Chọn tay một bài hoặc Tắt là thôi ngẫu nhiên.
 */
// MẶC ĐỊNH BẬT (chủ dự án 26.11.2026: "settings mặc định là để ngẫu nhiên… về chủ đề và âm thanh"): máy chưa từng đụng mục
// này (`undefined`) thì ngẫu nhiên — trừ khi đang lưu một bài KHÁC bài mặc định, tức người chơi đã tự chọn bài từ trước.
const nhacNgauNhien = ref(prefs.nhacNgauNhien ?? (!laBaiNhac(prefs.baiNhac) || prefs.baiNhac === 'keo'));
function doiNhacNgauNhien(): void {
  if (!nhacNgauNhien.value || !nhacBat.value) return;
  const ung = BAI_NHAC.filter((b) => baiChoiDuoc(b) && b !== baiNhac.value);
  if (ung.length) baiNhac.value = ung[Math.floor(Math.random() * ung.length)]!;
}
function datNhac(v: 'off' | 'nn' | BaiNhac): void {
  if (v === 'off') { nhacBat.value = false; nhacNgauNhien.value = false; return; }
  nhacBat.value = true;
  if (v === 'nn') { nhacNgauNhien.value = true; doiNhacNgauNhien(); ghiMocDoi(); return; }   // 30 phút tính từ lúc bật
  nhacNgauNhien.value = false; baiNhac.value = v;
}
/*
 * VỪA CÓ PREMIUM → NHẠC NỀN NGẪU NHIÊN NGAY (28.11.2026, chủ dự án đồng ý — cùng cách hình nền ở lib/canh.ts): bật Ngẫu nhiên +
 * chuyển ngay sang một bài PREMIUM, để người chơi nghe quyền lợi mới luôn. Đang TẮT nhạc thì tôn trọng, không tự bật lại.
 */
watch(daMuaPremium, (co) => {
  if (!co || !nhacBat.value) return;
  nhacNgauNhien.value = true;
  const ung = BAI_NHAC.filter((b) => BAI_PREMIUM.has(b) && baiChoiDuoc(b) && b !== baiNhac.value);
  if (ung.length) baiNhac.value = ung[Math.floor(Math.random() * ung.length)]!;
  ghiMocDoi();
});
/** Độ to của từng mức. Loa điện thoại ở sát tai nên 3,5 (mức thử trên loa máy
 *  tính) là quá to; 2,6 nghe rõ mà không giật mình, "nhỏ" thì đủ để biết mình
 *  vừa bấm gì trong phòng yên tĩnh. */
const SOUND_GAIN: Record<SoundLevel, number> = { off: 0, low: 1, high: 2.6 };
/** Nút chạy con thoi tắt → nhỏ → to rồi to → nhỏ → tắt: không bao giờ nhảy
 *  thẳng từ to sang tắt, nên bấm quá tay vẫn còn nghe được. */
const soundUp = ref(true);
function cycleSound(): void {
  const cur = soundLevel.value;
  if (cur === 'low') soundLevel.value = soundUp.value ? 'high' : 'off';
  else {
    soundLevel.value = 'low';
    soundUp.value = cur === 'off';   // vừa ở tắt thì đi lên, vừa ở to thì đi xuống
  }
  // Áp mức MỚI trước khi phát, không thì tiếng xác nhận vẫn ở mức cũ
  applySound();
  sfx.select();   // mức tắt thì im — chính nó cũng là phản hồi
}

function applySound(): void {
  sfx.enabled = soundLevel.value !== 'off';
  if (soundLevel.value !== 'off') sfx.volume = SOUND_GAIN[soundLevel.value];
}
const mode = ref<Mode>(prefs.mode);
/** Tuỳ chọn bàn chơi — chỉ dùng cho "chơi nhanh"; Chiến dịch có luật riêng
 *  từng màn nên KHÔNG đi qua đây. */
const options = ref<BoardOptions>(prefs.options);
const level = ref(Math.min(LEVEL_KEYS, Math.max(1, prefs.level)));
const themeIds = ref<string[]>(prefs.themes);
const playerCount = ref(prefs.playerCount);
/** Đấu với máy: mức của máy, null là không đấu máy. KHÔNG lưu vào prefs — mở
 *  app lên phải là trang chủ bình thường, không tự nhảy vào ván đấu máy. */
const botLevel = ref<BotLevel | null>(null);
/** MÁY CHƠI CÙNG ở ván nhiều người chung máy: chỗ i (0..3) là máy mức nào, null = người.
 *  Chỗ 0 luôn là người. Không lưu prefs — như botLevel. */
const mayCung = ref<(BotLevel | null)[]>([]);
/** Mã người chơi → mức, cho session. Đấu máy: `{ bot }`; nhiều người: bot, bot2, bot3 theo thứ tự chỗ. */
function banDoMay(): Record<string, BotLevel> {
  if (botLevel.value) return { [BOT_ID]: botLevel.value };
  if (playerCount.value < 2) return {};
  const ra: Record<string, BotLevel> = {};
  let k = 0;
  for (let i = 1; i < playerCount.value; i++) {
    const l = mayCung.value[i];
    if (l) ra[maBot(k++)] = l;
  }
  return ra;
}
/**
 * Số đếm "tiến độ vừa đổi". Cần vì store đọc localStorage — computed nào gọi
 * store.unlockedLevel() không có phụ thuộc phản ứng nào, sẽ nhớ mãi giá trị cũ.
 * KHÔNG dùng totalScore làm mốc: ván đấu Bot dễ không cộng điểm, gán lại cùng
 * một số thì Vue không coi là thay đổi.
 */
const progressRev = ref(0);
const totalScore = ref(store.totalScore());
// Xu vừa được cộng ở BẤT KỲ đâu (kể cả ván online, cộng trong useOnlineRoom) → đọc lại tổng ngay, không chờ về trang chủ
watch(diemVuaCong, () => { totalScore.value = store.totalScore(); });

const themes = ref<CardTheme[]>([]);
/** 'mua-the' = chế độ thẻ rơi (components/MuaThe.vue) — ô ngang ở trang chủ + trang Debug; `?mua=1` trên URL. */
/** 'tim-the' = Tìm Thẻ (components/TimThe.vue, 26.11.2026) — bước Thể loại + trang Debug; `?tim=1` trên URL. */
const screen = ref<'menu' | 'game' | 'online' | 'mua-the' | 'tim-the'>('menu');
const muaTheRef = ref<InstanceType<typeof MuaThe> | null>(null);
const timTheRef = ref<InstanceType<typeof TimThe> | null>(null);
/** Màn chơi RIÊNG ngoài bàn ghép cặp (Mưa Thẻ, Tìm Thẻ): cùng cách dừng / hỏi / thoát — một chỗ cho mọi lối. */
const laManRieng = (sc: string = screen.value): boolean => sc === 'mua-the' || sc === 'tim-the';
const manRieng = (): { dangDo: () => boolean; tamDung: () => void; veLai: () => void } | null =>
  screen.value === 'mua-the' ? muaTheRef.value : screen.value === 'tim-the' ? timTheRef.value : null;
const onlineRef = ref<InstanceType<typeof OnlineScreen> | null>(null);
/**
 * VÁN ĐANG CHẠY (chưa có kết quả) — TopBar chỉ hoãn hỏi/diễn THỨ HẠNG trong lúc này. Hết ván (bảng kết quả đang hiện) là hỏi
 * hạng và cập nhật luôn, không chờ về trang chủ như trước (23.11.2026). Mưa Thẻ giữ cách cũ (không có cờ "đã xong" để đọc).
 */
const vanDangChay = computed(() => (screen.value === 'game' && !session.summary.value)
  || (screen.value === 'online' && !!onlineRef.value?.dangChoi)
  || laManRieng());
/** Đang trong VÁN (offline hoặc online đang chơi) — nhạc nền nhỏ dần rồi tắt (16.10.2026). */
const trongVan = computed(() => screen.value === 'game' || laManRieng() || (screen.value === 'online' && !!onlineRef.value?.dangChoi));

/*
 * MỜI NGƯỜI ONLINE (21.11.2026, lib/sanh.ts): mời được ai KHÔNG ở phòng online nào — trang chủ hay đang chơi
 * offline đều được. Nhận lời khi đang dở ván offline: DỪNG ván và hỏi lại ("Bỏ ván này để vào phòng?").
 */
const onlineKey = ref(0);
watchEffect(() => { trongPhongOnline.value = screen.value === 'online' && !!onlineRef.value?.trongPhong; });
watchEffect(() => { dangChoiOffline.value = screen.value === 'game' || laManRieng(); });
// MỘT người thật (một mình / đấu máy / Mưa Thẻ): thi đấu vẫn hỏi; chơi nhiều người cùng máy thì không
watchEffect(() => {
  choiMotMinh.value = laManRieng()
    || (screen.value === 'game' && (session.game.value?.players.filter((p) => !laBot(p.id)).length ?? 0) === 1);
});
// Trận thi đấu THÀNH giữa lúc đang chơi một mình: dừng ván ngay (lớp phủ trận che bàn); vào phòng thì `diVaoPhongMoi`
// dọn ván, trận bị huỷ thì người chơi bấm tiếp tục từ màn tạm dừng.
watch(() => tdTran.value?.id, (id) => {
  if (!id) return;
  if (screen.value === 'game' && session.game.value && !session.game.value.finished) session.pause();
  else if (manRieng()?.dangDo()) manRieng()!.tamDung();
});
if (import.meta.env.MODE !== 'test') onMounted(batDauSanh);
const hoiBoVanMoi = ref(false);
let maMoiCho = '';
/*
 * THÁCH ĐẤU từ bảng xếp hạng (lib/sanh.ts `thachCho`): đóng bảng, sang màn online — OnlineScreen tạo phòng rồi mời.
 * Đang dở ván offline: dừng và hỏi như khi nhận lời mời (cùng hộp thoại "Bỏ ván này…").
 */
let thachSau = false;
function thachDau(n: ThachDau): void {
  showBxh.value = false;
  thachCho.value = n;
  if (screen.value === 'game' && session.game.value && !session.game.value.finished) { session.pause(); thachSau = true; hoiBoVanMoi.value = true; return; }
  if (manRieng()?.dangDo()) { manRieng()!.tamDung(); thachSau = true; hoiBoVanMoi.value = true; return; }
  diThach();
}
function dongYBoVanMoi(): void { boVanDo('thoat'); if (thachSau) diThach(); else diVaoPhongMoi(); }
function huyBoVanMoi(): void { hoiBoVanMoi.value = false; maMoiCho = ''; thachSau = false; thachCho.value = null; }
function diThach(): void {
  hoiBoVanMoi.value = false;
  thachSau = false;
  if (screen.value === 'game' || laManRieng()) backToMenu();
  joinCode.value = '';
  onlineKey.value++;
  screen.value = 'online';
}
/** Thi đấu (ThiDau.vue): trận đã chốt bàn → vào phòng thi đấu bằng mã, cùng lối với "được mời". Chỉ tới từ trang chủ. */
function vaoPhongThiDau(ma: string): void {
  maMoiCho = ma;
  diVaoPhongMoi();
}
function vaoPhongMoi(): void {
  const ma = nhanMoi();
  if (!ma) return;
  maMoiCho = ma;
  sfx.select();
  if (screen.value === 'game' && session.game.value && !session.game.value.finished) { session.pause(); hoiBoVanMoi.value = true; return; }
  if (manRieng()?.dangDo()) { manRieng()!.tamDung(); hoiBoVanMoi.value = true; return; }
  diVaoPhongMoi();
}
function diVaoPhongMoi(): void {
  hoiBoVanMoi.value = false;
  if (!maMoiCho) return;
  // Đang ở ván offline / Mưa Thẻ (đã đồng ý bỏ) hay màn kết quả: dọn như lối "về trang chủ" rồi mới sang
  if (screen.value === 'game' || laManRieng()) backToMenu();
  joinCode.value = maMoiCho;
  maMoiCho = '';
  onlineKey.value++;          // đang ở danh sách phòng: dựng lại màn online theo lối "được mời"
  screen.value = 'online';
}
watch([nhacBat, baiNhac, baiThat, soundLevel, trongVan, nhacNgauNhien], () => {
  store.savePrefs({ nhac: nhacBat.value, baiNhac: baiNhac.value, nhacNgauNhien: nhacNgauNhien.value });
  sfx.trongBat = nhacBat.value;   // nhạc trống Tìm Thẻ đi theo nút Nhạc (tắt âm thanh thì sfx tự câm)
  if (!nhacBat.value || soundLevel.value === 'off') nhac.dung();
  else if (trongVan.value) nhac.nhoDanRoiTat();
  else nhac.chay('menu', baiThat.value);
}, { immediate: true });
/**
 * Mã phòng từ link mời (?room=ABC123).
 *
 * PHẢI XOÁ khi rời màn online (xem `@back` bên dưới). Trước đây nó chỉ được
 * đặt một lần lúc mount và giữ nguyên suốt phiên, nên: vào bằng link mời →
 * thoát ra menu → bấm "Chơi online" lại là màn online vẫn thấy `joinCode` cũ,
 * tự nối vào PHÒNG CŨ (đã chết) rồi báo lỗi — mà ô nhập mã thì bị ẩn vì đang ở
 * nhánh "được mời". Đúng lỗi đã bị phản ánh: không còn chỗ nào nhập mã mới.
 */
const joinCode = ref('');
const levelId = ref<number | null>(null);
const isRecord = ref(false);
/** Số ván THẮNG của từng người trong loạt đang chơi (nhiều người cùng máy).
 *  Khoá theo danh sách tên: đổi người hoặc đổi số người là loạt mới, tự về 0 —
 *  không thì tỷ số của nhóm cũ dính sang nhóm mới. */
const seriesKey = ref('');
const seriesWins = ref<Record<string, number>>({});
/** Số ván đã xong trong loạt (kể cả hoà) — dòng "Ván N" ở màn kết quả nhiều người. */
const soVanLoat = ref(0);
const freshAchievements = ref<string[]>([]);
/** Ăn mừng 5 giây trước rồi mới hiện popup kết quả. */
const showResult = ref(false);
let resultTimer: ReturnType<typeof setTimeout> | undefined;

const session = useGameSession();
/*
 * MẶT LƯNG THEO HÌNH NỀN: mỗi VÁN MỚI bốc một mặt lưng cho cả bàn (lib/lung-la.ts). Ván offline = `session.game` đổi sang
 * ván khác (bắt đầu, chơi lại, khôi phục sau F5); ván online = phòng chuyển sang đang chơi.
 */
watch(() => session.game.value, (g, cu) => { if (g && g !== cu) bocLungVan(); });
watch(() => !!onlineRef.value?.dangChoi, (v) => { if (v) bocLungVan(); });
/* Nhạc dồn dần về cuối ván: tiến độ cặp đã ghép, hoặc gấp nhất khi đồng hồ còn
   ≤ 15 giây. Làm tròn để watch không chạy mỗi khung hình theo đồng hồ. */
const doGapNhac = computed(() => {
  const g = session.game.value;
  if (!g || screen.value !== 'game') return 0;
  const left = session.timeLeft.value;
  if (left !== null && left <= 15) return 1;
  const tong = session.totalPairs.value;
  return tong ? Math.round((session.matchedCount.value / tong) * 20) / 20 : 0;
});
watch(doGapNhac, (v) => { nhac.gap = v; }, { immediate: true });
/* Khoá chiều cao thật + kéo document về 0 mỗi lần trang hiện lại — không có nó
   thì mở lại Chrome trên iPhone là header nằm ngoài màn hình. */
useViewportLock();
const confirmQuit = ref(false);
const showRules = ref(false);
/** Báo lỗi / góp ý (BaoLoiDialog) — mở từ menu. */
const showBaoLoi = ref(false);
/** Trang debug riêng (DebugDialog) — mở từ nút "🐞 Debug" cạnh chữ Cài đặt trong menu. */
const showDebug = ref(false);
useBackCloser(30, () => showDebug.value, () => { showDebug.value = false; });
const showSoTriNho = ref(false);
/** Bảng Premium — CHỈ mở từ menu debug cho tới khi bán thật (25.11.2026). */
const showPremium = ref(false);
/** Nơi người chơi bấm để mở bảng — bảng mở đầu bằng đúng thứ họ vừa chạm (lib/premium.ts `moPremium`). */
const premiumTu = ref<NoiMoPremium>('menu');
watch(yeuCauPremium, (y) => { if (y) { premiumTu.value = y.tu; showPremium.value = true; } });
/** Bảng chọn hình nền — dòng "Hình nền" trong menu ☰ (cùng cổng debug với Premium cho tới khi bán thật). */
const showHinhNen = ref(false);
useBackCloser(31, () => showHinhNen.value, () => { showHinhNen.value = false; });
/** Bảng chọn nhạc nền — dòng "Nhạc nền" trong menu ☰ khi có bài Premium để bày (ChonNhac.vue). */
const showNhac = ref(false);
/*
 * ĐÓNG BẢNG LÀ VỀ LẠI MENU ☰ (chủ dự án 26.11.2026: "các settings này nếu đóng thì vẫn hiện settings bên ngoài được chứ, hiện
 * đóng là mất luôn"). Hai bảng mở TỪ menu nên đóng (nút ✕, chạm ngoài, nút Back) phải trả người chơi về menu. Ngoại lệ: bảng
 * đóng để nhường chỗ cho bảng Premium (bấm mục khoá) — lúc đó `showPremium` đã bật, không mở menu chồng lên.
 */
const topBar = ref<{ moMenu: (trang?: 'cd') => void } | null>(null);
/** Bảng con mở từ mục "Cài đặt Premium" ở trang Cài đặt của menu ☰ — đóng lại thì về lại trang Cài đặt. */
let tuCaiDat = false;
function moTuCaiDat(muc: 'nen' | 'nhac' | 'hh'): void {
  tuCaiDat = true;
  if (muc === 'nen') showHinhNen.value = true; else if (muc === 'nhac') showNhac.value = true; else showHuyHieu.value = true;
}
/** Bảng Chủ đề / Nhạc nền vừa được mở TỪ BẢNG PREMIUM (dòng "Cài đặt Premium") — đóng lại thì về bảng Premium, không về menu. */
let tuPremium = false;
function moTuPremium(muc: 'nen' | 'nhac' | 'hh'): void {
  showPremium.value = false;
  tuPremium = true;
  if (muc === 'nen') showHinhNen.value = true; else if (muc === 'nhac') showNhac.value = true; else showHuyHieu.value = true;
}
/** Bảng chọn huy hiệu Premium — chỉ mở được từ bảng Premium (ChonHuyHieu.vue). */
const showHuyHieu = ref(false);
useBackCloser(31, () => showHuyHieu.value, () => { showHuyHieu.value = false; });
function veMenuKhiDong(mo: boolean, truoc: boolean): void {
  if (mo || !truoc) return;
  const vePremium = tuPremium, veCaiDat = tuCaiDat;
  tuPremium = false; tuCaiDat = false;
  void nextTick(() => {
    if (showPremium.value) return;
    if (vePremium) { premiumTu.value = 'trang-chu'; showPremium.value = true; } else topBar.value?.moMenu(veCaiDat ? 'cd' : undefined);
  });
}
/** Chữ ở dòng "Nhạc nền" của bảng Premium. */
const nhacHien = computed(() => (!nhacBat.value || soundLevel.value === 'off' ? t('tb.amNgan.off') : nhacNgauNhien.value ? t('cn.ngauNhien') : tenBaiNhac(baiThat.value)));
watch(showHinhNen, veMenuKhiDong);
watch(showNhac, veMenuKhiDong);
watch(showHuyHieu, veMenuKhiDong);
useBackCloser(31, () => showNhac.value, () => { showNhac.value = false; });
useBackCloser(31, () => showPremium.value, () => { showPremium.value = false; });
/** Tấm SỬA hồ sơ (mở từ menu). Màn chào bắt buộc thì theo `canMoChao`, không có cờ riêng. */
const showHoSo = ref(false);
useBackCloser(31, () => showHoSo.value, () => { showHoSo.value = false; });
useBackCloser(31, () => showSoTriNho.value, () => { showSoTriNho.value = false; });
/* ĐO LƯỢT DÙNG Chỉ số trí nhớ (25.11.2026, chủ dự án hỏi "có nhiều người dùng không" mà chưa có số): mở màn + bấm "Luyện ngay". */
watch(showSoTriNho, (mo) => { if (mo) moChucNang('tri_nho'); });
/** Đổi key để ép MenuScreen dựng lại — logo "về trang chủ" là về bước 1 của wizard. */
const menuKey = ref(0);

/* ---------- nút Back của trình duyệt ----------
 * Mục tiêu: lỡ bấm Back theo thói quen thì KHÔNG bị ném ra khỏi web. Mỗi thứ
 * đang mở chiếm một mục lịch sử; Back đóng cái trên cùng. Chỉ khi đứng ở trang
 * chủ, không còn gì mở, thì Back mới thật sự rời trang — đúng như mong đợi.
 */
// Hộp thoại đóng TRƯỚC mọi thứ bên dưới nó
useBackCloser(30, () => showRules.value, () => { showRules.value = false; });
useBackCloser(30, () => showBaoLoi.value, () => { showBaoLoi.value = false; });
const dongCai = (): void => { hienCai.value = false; };
useBackCloser(30, () => hienCai.value, dongCai);
/** Màn tài khoản (đăng nhập Google, điểm, danh hiệu). */
const showAccount = ref(false);
useBackCloser(30, () => showAccount.value, () => { showAccount.value = false; });
const showBxh = ref(false);
useBackCloser(30, () => showBxh.value, () => { showBxh.value = false; });
// Dò server có tài khoản không + nạp hồ sơ nếu còn phiên. Lỗi gì cũng nuốt
// trong đó — đây là lớp phủ, không được chặn trang chủ.
onMounted(() => {
  // Người mới chưa có tên → tên ngẫu nhiên "Sóc Đỏ Nhỏ" (lib/ten-ngau-nhien.ts); có server thì tránh tên đã dùng
  void taiKhoan.khoiDong().finally(() => {
    void ganTenNeuChua(ngonNgu.value, taiKhoan.san.value ? taiKhoan.tenTrong : undefined);
    void guiHoSo();   // hồ sơ (tên/avatar/màu) lên bảng xếp hạng — người đã lưu hồ sơ trước bản 1.9.53 cũng có
  });
  batPhanTich();
  // Màn đầu + thời gian tới khi khung đầu ĐÃ VẼ (hai rAF) — phễu người mới, lib/phan-tich.ts
  requestAnimationFrame(() => requestAnimationFrame(() => baoTaiXong(String(screen.value))));
});
// Hồ sơ đổi (đồng bộ từ máy khác về) → số trên thanh và theme mở theo điểm đổi
// theo; danh hiệu đếm (tổng điểm, số ván thắng của tài khoản) mở lặng lẽ.
watch(taiKhoanMe, (m) => {
  totalScore.value = store.totalScore();
  progressRev.value++;
  napLaiDaCo();
  moKhoa(xetThongKe(thongKeHienTai(m?.wins ?? 0)), { im: true });
});

/* ---------- danh hiệu ---------- */
const showDanhHieu = ref(false);

/* ---------- PHÂN TÍCH: chức năng nào được vào, cài đặt nào được đổi (13.11.2026) ----------
 * Theo dõi BIẾN TRẠNG THÁI chứ không gắn vào từng nút: mở bằng lối nào (nút, Back, chinh phục,
 * F5) cũng đếm, và thêm lối mới không phải nhớ gắn sự kiện. Tên cố định — xem `moChucNang`. */
watch(screen, (sc) => {
  if (sc === 'online') moChucNang('choi_online');
  else if (sc === 'mua-the') moChucNang('mua_the');
  else if (sc === 'tim-the') moChucNang('tim_the');
});
for (const [r, ten] of [
  [showRules, 'luat_choi'], [showAccount, 'tai_khoan'], [showBxh, 'xep_hang'], [showDanhHieu, 'danh_hieu'], [hienCai, 'cai_app']
] as const) watch(r, (v) => { if (v) moChucNang(ten); });
watch(nen, (v) => doiCaiDat('nen', v));
/* BÁO LỖI: nhớ màn chơi gần nhất để hộp báo lỗi chọn sẵn "Ở đâu" (người chơi thường báo SAU khi rời màn gặp lỗi). Trang
   chủ không ghi đè — mở menu từ trang chủ vẫn giữ màn vừa rời. */
watch([screen, mode, botLevel], () => {
  const n: NoiBl | null = screen.value === 'online' ? 'online' : screen.value === 'tim-the' ? 'timThe' : screen.value === 'mua-the' ? 'premium'
    : screen.value === 'game' ? (mode.value === 'campaign' ? 'chienDich' : botLevel.value ? 'may' : 'motMinh') : null;
  if (n) ghiManGanNhat(n);
}, { immediate: true });
watch(soundLevel, (v) => doiCaiDat('am_thanh', v));
// Đang ngẫu nhiên thì chỉ ghi MỘT lần 'ngau_nhien' — không ghi từng lần bài tự đổi (đó không phải người chơi đổi cài đặt)
watch(() => (!nhacBat.value ? 'off' : nhacNgauNhien.value ? 'ngau_nhien' : baiNhac.value), (v) => doiCaiDat('nhac', v));
watch(rungBat, (v) => doiCaiDat('rung', v));
useBackCloser(30, () => showDanhHieu.value, () => { showDanhHieu.value = false; });
const daCoSet = computed(() => new Set(daCo.value));
/** Số liệu tích luỹ — đọc lại mỗi khi tiến độ đổi (progressRev). */
const thongKe = computed(() => { void progressRev.value; return thongKeHienTai(taiKhoanMe.value?.wins ?? 0); });
/** Theme ĐANG KHOÁ (premium chưa mua) — danh hiệu của chúng không gợi ý "chinh phục". */
const themeKhoa = computed(() => new Set(themes.value.filter((t) => !choiDuoc(t)).map((t) => t.id)));
// Chưa bật bán Premium: danh hiệu của theme premium ẨN HẲN (lib/premium.ts banPremium)
watchEffect(() => {
  const prem = new Set(themes.value.filter((t) => t.premium).map((t) => t.id));
  dhAn.value = hienPremium.value ? new Set()
    : new Set(ACHIEVEMENTS.filter((a) => a.chinhPhuc?.theme && prem.has(a.chinhPhuc.theme)).map((a) => a.id));
});
const goiYVan = ref<Achievement | null>(null);

/* ---------- xem thử hiệu ứng (chế độ debug) ---------- */
const xemFx = ref<(XemFx & { key: number }) | null>(null);
let xemFxHen: ReturnType<typeof setTimeout> | undefined;
function xemThuFx(fx: XemFx): void {
  showRules.value = false;
  clearTimeout(xemFxHen);
  xemFx.value = { ...fx, key: (xemFx.value?.key ?? 0) + 1 };
  xemFxHen = setTimeout(() => { xemFx.value = null; }, 4500);
}

/* ---------- dải lối tắt trên trang chủ ---------- */
const goiYTrangChu = computed(() => {
  const a = chonGoiY(daCoSet.value, thongKe.value, themeKhoa.value);
  return a ? { id: a.id, name: a.name } : null;
});
/** Chuỗi ngày ĐANG GIỮ (không phải dài nhất): chơi hôm nay hoặc hôm qua mới còn. */
const chuoiNgayNay = computed(() => {
  void progressRev.value;
  const b = store.boDem();
  const homQua = new Date(); homQua.setDate(homQua.getDate() - 1);
  return b.ngayCuoi === ngayMay() || b.ngayCuoi === ngayMay(homQua) ? b.chuoi : 0;
});
/** Màn chiến dịch đang mở — chỉ hiện khi đã chơi chiến dịch. */
const manChienDich = computed(() => (thongKe.value.campaignMax > 0 ? store.unlockedLevel() : 0));
/**
 * Ván MỘT MÌNH (không máy, không người khác) — chỉ khi đó cảnh thua mới kèm dòng an
 * ủi "còn N cặp". Đọc BẢNG XẾP HẠNG, không cờ botLevel (cờ tắt được giữa ván).
 */
const motMinh = computed(() => (session.summary.value?.ranking.length ?? 0) <= 1);
/** Cảnh kết ván của ván vừa xong — quyết định lúc nào bảng kết quả hiện. */
const canhVan = () => chonCanh(session.loaiKetCuc.value, { kyLuc: isRecord.value });

/**
 * "CHINH PHỤC" một danh hiệu từ màn Tài khoản: dựng đúng bàn cần cho nó rồi
 * vào ván luôn. Tuỳ chọn còn lại về 0 (bàn trơn) để điều kiện là tối thiểu.
 */
function chinhPhuc(a: Achievement): void {
  moChucNang('chinh_phuc', { danh_hieu: a.id });
  showAccount.value = false;
  showDanhHieu.value = false;
  // Đang ở bảng kết quả: đóng nó trước, không thì nó nằm đè lên ván mới
  if (session.summary.value) { session.stop(); session.summary.value = null; }
  const c = a.chinhPhuc;
  if (!c) return;
  if (c.online) { screen.value = 'online'; return; }
  // Danh hiệu Tìm Thẻ: mở màn Tìm Thẻ với cỡ bàn / tốc độ / đối thủ của danh hiệu (người chơi vẫn đổi được trước khi bắt đầu)
  if (c.timThe) { luuChon({ ...docChon(), ...c.timThe }); screen.value = 'tim-the'; return; }
  if (c.campaign) {
    mode.value = 'campaign'; botLevel.value = null; playerCount.value = 1;
    startLevel(store.unlockedLevel());
    return;
  }
  mode.value = 'classic';
  botLevel.value = c.bot ?? null;
  playerCount.value = c.bot ? 2 : 1;
  options.value = { ...DEFAULT_OPTIONS, ...(c.options ?? {}) };
  // Danh hiệu theme: chơi ĐÚNG một theme. Lựa chọn này được lưu như mọi lựa
  // chọn theme khác — người chơi đổi lại ở bước chọn theme như thường.
  if (c.theme) themeIds.value = [c.theme];
  startLevel(levelChoCells(c.cells ?? 16));
}
/*
 * PHÁ KỶ LỤC từ trang Tài khoản (22.11.2026, mockup duyệt https://claude.ai/artifact/KzuWVG5QwHxQ13Hi7AUN3C): vào thẳng
 * đúng màn Chiến dịch / đúng cỡ bàn (một người, không máy, luật mặc định — kỷ lục ghi theo cỡ bàn).
 */
function phaKyLuc(r: PhaKyLuc): void {
  moChucNang('pha_ky_luc', { che_do: r.mode, so_the: r.cells });
  showAccount.value = false;
  if (session.summary.value) { session.stop(); session.summary.value = null; }
  botLevel.value = null; playerCount.value = 1;
  if (r.mode === 'campaign') { mode.value = 'campaign'; startLevel(r.cap); return; }
  mode.value = 'classic';
  options.value = { ...DEFAULT_OPTIONS };
  startLevel(levelChoCells(r.cells));
}
useBackCloser(30, () => confirmQuit.value, () => { confirmQuit.value = false; });
/**
 * Đang trong ván / phòng online: Back làm đúng việc của nút logo — tức là HỎI
 * trước khi bỏ ván dở, không lặng lẽ thoát. popstate không huỷ được nên phải
 * hỏi SAU khi đã lùi; `goHome()` tự lo chuyện đó, và hộp hỏi mà nó mở ra sẽ
 * thành chốt mới cho cú Back kế tiếp.
 */
useBackCloser(20, () => screen.value !== 'menu', () => {
  if (screen.value === 'game') thoatVan();
  else if (laManRieng()) manRieng()?.veLai();
  // Online: Back giữa ván về MÀN ONLINE chứ không ra trang chủ (23.11.2026) — OnlineScreen `requestBack`
  else if (screen.value === 'online') onlineRef.value?.requestBack();
  else goHome();
});

/** Bấm logo: về trang chủ — đang dở việc thì hỏi trước. */
function goHome(): void {
  if (laManRieng()) {
    // Ván Mưa Thẻ / Tìm Thẻ dở: dừng rồi HỎI như ván thường (bản đầu thoát thẳng — chủ dự án báo 27.10.2026).
    // Huỷ thì ở lại màn tạm dừng của Mưa Thẻ.
    if (manRieng()?.dangDo()) { manRieng()!.tamDung(); thoatVeBuoc.value = false; confirmQuit.value = true; return; }
    screen.value = 'menu'; return;
  }
  if (screen.value === 'online') {
    onlineRef.value?.requestHome();   // OnlineScreen tự hỏi đầu hàng / huỷ phòng
    return;
  }
  if (screen.value === 'game' && session.game.value && !session.game.value.finished) {
    thoatVeBuoc.value = false; confirmQuit.value = true;   // ván offline đang chơi (logo → trang chủ)
    return;
  }
  menuKey.value++;
  backToMenu();
}

/* ---------- state trên URL + khôi phục ván dở khi F5 ---------- */

const RESUME_KEY = 'mm.resume';

/** Ghi query state vào URL (không đẩy history mới) — xem lib/appUrl.ts. */
const setUrl = ghiQuery;

/** Lưu snapshot ván đang chơi — gọi sau mỗi biến động và trước khi rời trang. */
function persistGame(): void {
  const g = session.game.value;
  if (!g || g.finished) return;
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ snap: g.snapshot(), levelId: levelId.value, bot: botLevel.value, may: session.bots.value }));
  } catch { /* chế độ riêng tư */ }
}

function clearResume(): void {
  try { sessionStorage.removeItem(RESUME_KEY); } catch { /* bỏ qua */ }
  if (location.search) setUrl(null);
}

/** F5 giữa ván: dựng lại đúng ván từ snapshot. Trả về true nếu khôi phục được. */
function restoreGame(): boolean {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (!raw) return false;
    const blob = JSON.parse(raw) as { snap: string; levelId: number | null; bot?: BotLevel | null; may?: Record<string, BotLevel> };
    const g = MemoryGame.restore(blob.snap);
    // Ván đấu máy khôi phục sau F5: phải bật lại bộ điều khiển, không thì tới
    // lượt máy là ván treo vĩnh viễn. Mức lưu kèm snapshot.
    botLevel.value = blob.bot ?? null;
    // Máy chơi cùng (nhiều người) lưu theo mã; bản lưu cũ chỉ có `bot`
    session.setBots(blob.may ?? (botLevel.value ? { [BOT_ID]: botLevel.value } : {}));
    if (g.finished) return false;
    levelId.value = blob.levelId;
    session.adopt(g);
    screen.value = 'game';
    return true;
  } catch { return false; }
}

watch(
  () => [session.moves.value, session.faceUp.value.size, session.matchedCount.value],
  persistGame
);

void loadThemes().then((list) => {
  themes.value = list;
  // Bỏ cả theme premium chưa mua: bản lưu có thể chọn chúng từ hồi còn mở bằng
  // điểm (trước 14.10.2026), hoặc từ lúc gói premium còn hiệu lực.
  const valid = themeIds.value.filter((id) => list.some((t) => t.id === id && choiDuoc(t)));
  // Chưa từng chọn (hoặc bản lưu trỏ tới theme không còn tồn tại): lấy TẤT CẢ
  // theme đang mở khoá — bàn thẻ đa dạng ngay ván đầu, và người chơi thấy luôn
  // là chọn được nhiều. Đã chọn rồi thì tôn trọng lựa chọn của họ.
  themeIds.value = valid.length
    ? valid
    : list.filter(choiDuoc).map((t) => t.id);
});

onMounted(() => {
  // iOS/Android chỉ cho phát âm sau CỬ CHỈ người dùng. Quan trọng: sau khi thoát
  // ra home rồi vào lại, iOS đòi cử chỉ mới — nên phải gắn LẠI bộ mở khoá mỗi
  // lần trang hiện lại, không chỉ một lần lúc mở app (đó là lý do trước đây vào
  // lại vẫn mất tiếng: resume() gọi ngoài cử chỉ bị iOS từ chối).
  const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;
  const unlock = (): void => {
    sfx.unlock();
    nhac.daCham = true;
    armUnlock();   // tự gắn lại cho lần sau
  };
  function armUnlock(): void {
    for (const ev of GESTURES) {
      document.removeEventListener(ev, unlock);
      document.addEventListener(ev, unlock, { once: true, passive: true });
    }
  }
  armUnlock();
  // TRONG APP thì khỏi chờ chạm: Capacitor tắt luật "phải có cử chỉ mới phát"
  // của WebView ở cả hai nền (iOS mediaTypesRequiringUserActionForPlayback = [],
  // Android setMediaPlaybackRequiresUserGesture(false)), nên mở app là có nhạc
  // ngay — người chơi báo "phải chạm mới có nhạc" là cảm giác trang web, không
  // phải app. Trình duyệt vẫn giữ luật cũ: ở đó chạm trước là bắt buộc thật.
  if (laApp) {
    sfx.tuDungLai = true;   // quay lại từ nền: context hỏng thì dựng lại ngay, khỏi chờ chạm
    sfx.unlock();
    nhac.daCham = true;
  }

  /*
   * MỌI NÚT ĐỀU CÓ TIẾNG — gắn ở MỘT chỗ, không rải vào từng handler.
   *
   * Người chơi báo nút thoát bàn bấm mà im lặng; rà lại thì còn cả loạt nút
   * khác cùng cảnh (đóng hộp thoại, mũi tên quay lại, sao chép link, mở hướng
   * dẫn). Gắn tay từng nút không giải quyết được gốc: nút mới thêm sau này lại
   * im. Ở đây bắt trên `pointerdown` PHA CAPTURE của document nên không handler
   * nào chặn được, và `sfx.clickMacDinh()` tự im nếu nút đó có tiếng riêng.
   *
   * `data-nosfx` để một nút chủ đích không kêu (nút gạt âm lượng ở mức TẮT).
   */
  const KHONG_KEU = '[data-nosfx]';
  const nutKeuDuoc = (e: Event): boolean => {
    const el = (e.target as Element | null)?.closest?.('button, [role="button"], a[href]');
    if (!el || el.closest(KHONG_KEU)) return false;
    if (el instanceof HTMLButtonElement && el.disabled) return false;
    return el.getAttribute('aria-disabled') !== 'true';
  };
  /*
   * HAI NHỊP (18.10.2026, sửa lỗi "bấm Chơi nhanh kêu hai tiếng"): chạm xuống chỉ GHI MỐC,
   * còn quyết kêu hay không thì đợi `click` — lúc đó handler của nút đã chạy và tiếng riêng
   * (nếu có) đã phát. Quyết ngay từ pointerdown thì giữ tay lâu là tiếng mặc định kêu trước.
   */
  document.addEventListener('pointerdown', (e) => { if (nutKeuDuoc(e)) sfx.ghiMocCham(); }, { capture: true, passive: true });
  // Bàn phím: Enter/Space trên nút cũng ra `click`; ghi mốc lúc phím xuống cho cùng một luật.
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && nutKeuDuoc(e)) sfx.ghiMocCham();
  }, { capture: true, passive: true });
  const chamNut = (e: Event): void => { if (nutKeuDuoc(e)) sfx.clickMacDinh(); };
  document.addEventListener('click', chamNut, { capture: true, passive: true });

  // Quay lại app: thử chạy lại ngay (có khi được), đồng thời vũ trang cử chỉ để
  // lần chạm kế tiếp chắc chắn mở khoá được.
  const wake = (): void => { sfx.resume(); armUnlock(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  window.addEventListener('focus', wake);
  window.addEventListener('pageshow', wake);
  // iOS: WKWebView không phải lúc nào cũng bắn visibilitychange khi app trở lại từ nền, và có bắn
  // thì đôi khi SỚM hơn lúc phiên âm thanh bật lại → nghe thêm `resume` của Capacitor (như lib/ota.ts).
  if (laApp) void import('@capacitor/app').then(({ App }) => { void App.addListener('resume', wake); }).catch(() => undefined);
  // Khôi phục vị trí từ URL sau F5 / mở link mời
  const q = new URLSearchParams(location.search);
  const code = q.get('room');
  if (code && /^\d{6}$/.test(code)) {
    // Online: giữ ?room=CODE trên URL suốt phiên — F5 quay lại đúng phòng
    joinCode.value = code;
    screen.value = 'online';
  } else if (q.get('playing') === '1') {
    // Ván offline dở: URL chỉ là con trỏ, ruột ván nằm trong snapshot
    if (!restoreGame()) setUrl(null);
  } else if (q.get('online') === '1') {
    screen.value = 'online';           // F5 ở màn vào online
  } else if (q.get('mua') === '1' && (MUA_THE_MO || debug.value)) {
    screen.value = 'mua-the';          // F5 ở Mưa Thẻ: về màn mở đầu (ván dở không giữ — ván chỉ vài phút)
  } else if (q.get('tim') === '1' && (TIM_THE_MO || debug.value)) {
    screen.value = 'tim-the';          // F5 ở Tìm Thẻ: về màn cấu hình (ván ~2 phút, không giữ)
  } else if (q.get('w')) {
    /* bước wizard — MenuScreen tự khôi phục từ ?w= */
  } else if (q.get('cai') === '1') {
    // Link chia sẻ hướng dẫn cài lên màn hình chính (lib/cai-app.ts): mở hộp rồi lau URL
    moCai();
    setUrl(null);
  } else if (location.search) {
    setUrl(null);
  } else if (maPhongDangDo()) {
    /*
     * MỞ LẠI APP MÀ CÒN PHÒNG ONLINE DỞ: vào thẳng phòng. App nằm nền hay bị
     * iOS/Android tắt hẳn, mở lại là WebView nạp từ gốc — mất `?room=` — nên bản
     * cũ đưa người chơi về trang chủ và phòng (vẫn đang chờ ở server) trông như
     * đã mất. Phiên chỉ còn khi chưa chủ động rời phòng (rời = xoá phiên) và
     * chưa quá HAN_PHIEN_MS.
     */
    joinCode.value = maPhongDangDo()!;
    screen.value = 'online';
  }

  // Chốt snapshot lần cuối + hỏi confirm nếu đang dở việc (F5/đóng tab nhầm)
  window.addEventListener('beforeunload', (e) => {
    persistGame();
    const inGame = (screen.value === 'game' && !!session.game.value && !session.game.value.finished)
      || !!manRieng()?.dangDo();
    const inOnline = screen.value === 'online' && (onlineRef.value?.isBusy() ?? false);
    if (inGame || inOnline) {
      e.preventDefault();
      e.returnValue = '';   // trình duyệt hiện hộp thoại xác nhận chuẩn
    }
  });
});

// Màn online (chưa vào phòng) cũng đánh dấu lên URL để F5 quay lại đúng chỗ
// Rời menu là giữ màn hình sáng (người xem ván không chạm gì → máy tự tắt màn) — lib/giu-sang.ts
watch(screen, (sc) => giuSang(sc !== 'menu'), { immediate: true });
/*
 * NHỊP NGẪU NHIÊN (26.11.2026, chủ dự án: "đổi ngẫu nhiên khoảng 30 phút một lần, và không đổi khi trong ván"). Hỏi
 * `denGioDoi()` lúc mở app, lúc RỜI ván, mỗi phút, và lúc app hiện lại — nhưng chỉ khi đang NGOÀI ván (`trongVan` gồm
 * ván offline, Mưa Thẻ và phòng online đang chơi). Đủ 30 phút giữa ván thì chờ: vừa rời ván là đổi.
 */
function doiNgauNhienNeuDenGio(): void {
  if (trongVan.value || (!canhNgauNhien.value && !nhacNgauNhien.value)) return;
  if (!denGioDoi()) return;
  doiCanhNgauNhien(); doiNhacNgauNhien();
  ghiMocDoi();
}
watch(trongVan, (v) => { if (!v) doiNgauNhienNeuDenGio(); });
let henNgauNhien: ReturnType<typeof setInterval> | undefined;
const khiHienLai = (): void => { if (!document.hidden) doiNgauNhienNeuDenGio(); };
/*
 * THỐNG KÊ "NGƯỜI CHƠI CÓ THÍCH PREMIUM KHÔNG" (26.11.2026, chủ dự án: "cần đặt thống kê trước, mở tính năng sau" — trước đợt
 * tặng Premium dùng thử). Mỗi lần mở app ghi MỘT sự kiện `premium_trang_thai`: có Premium không, đang dùng chủ đề + bài nhạc
 * nào, có bật ngẫu nhiên không. Đếm theo ngày là biết bao nhiêu người có Premium THẬT SỰ dùng quyền lợi (chủ đề khác `goc`,
 * bài nhạc Premium) chứ không chỉ nhận rồi để đó. Các sự kiện hành động đã có sẵn: `hinh_nen`, `hinh_nen_mo`, `nhac_nen_mo`,
 * `lung_la` (mỗi ván), `premium_nen_khoa`, `premium_nhac_khoa`, `doi_cai_dat` (muc = nhac).
 */
function ghiTrangThaiPremium(): void {
  moChucNang('premium_trang_thai', {
    co: daMuaPremium.value,
    chu_de: canh.value,
    nhac: !nhacBat.value || soundLevel.value === 'off' ? 'off' : baiThat.value,
    nhac_premium: nhacBat.value && soundLevel.value !== 'off' && BAI_PREMIUM.has(baiThat.value),
    nn_chu_de: canhNgauNhien.value,
    nn_nhac: nhacNgauNhien.value
  }, true);
}
/** Tặng Premium luôn khi người chơi đã qua màn chào (người mới: ngay sau khi điền xong hồ sơ). */
function thuTangLuon(): void {
  if (!hoSo.value.xong || !tangTuDong()) return;
  moChucNang('premium_tang_tu_dong');
  premiumTu.value = 'qua'; showPremium.value = true;
}
watch(() => hoSo.value.xong, (x) => { if (x) thuTangLuon(); });
onMounted(() => {
  ghiTrangThaiPremium();
  thuTangLuon();
  doiNgauNhienNeuDenGio();
  // mỗi phút: nhịp ngẫu nhiên + gói quà tặng Premium hết hạn giữa lúc app đang mở thì về bản thường ngay
  henNgauNhien = setInterval(() => { kiemHetHanTang(); doiNgauNhienNeuDenGio(); }, 60_000);
  document.addEventListener('visibilitychange', khiHienLai);
});
onUnmounted(() => { clearInterval(henNgauNhien); document.removeEventListener('visibilitychange', khiHienLai); });
// Về trang chủ sau một ván THẮNG → có thể xin đánh giá (luật ở lib/xin-danh-gia.ts: đủ gắn bó, thưa, không giữa ván)
watch(screen, (sc, cu) => { if (sc === 'menu' && cu !== 'menu') setTimeout(() => { void thuXinDanhGia(); }, 900); });
watch(screen, (sc, cu) => {
  if (sc === 'online' && !location.search.includes('room=')) setUrl('online=1');
  if (sc === 'mua-the') setUrl('mua=1');
  else if (sc === 'tim-the') setUrl('tim=1');
  // logo về trang chủ: lau ?mua=1. Thoát bằng nút trong màn thì `veBuocTruoc` đã ghi ?w=kieu — giữ nguyên
  // đọc `urlApp()` (URL app MUỐN), không `location`: Back của trình duyệt đã kéo location lùi về mục cũ, rồi
  // useBackGuard ghi lại urlApp() — đọc location là bỏ sót và ?mua=1 sống lại (đo được 28.10.2026)
  else if (cu === 'mua-the' && sc === 'menu' && urlApp().includes('mua=1')) setUrl(null);
  else if (cu === 'tim-the' && sc === 'menu' && urlApp().includes('tim=1')) setUrl(null);
});

/** Hết ván Mưa Thẻ: điểm vào TỔNG XU như mọi ván một mình (không ghi kỷ lục theo cỡ bàn — Mưa Thẻ có
 *  kỷ lục riêng theo số cột trong MuaThe.vue) + một sự kiện GA4. */
function xongMuaThe(kq: { diem: number; cap: number; soCap: number; soCot: number; giay: number }): void {
  store.addScore(kq.diem);
  totalScore.value = store.totalScore();
  suKien('mua_the_ket_thuc', { diem: kq.diem, cap: kq.cap, so_cap: kq.soCap, so_cot: kq.soCot, giay: Math.round(kq.giay) });
}

/** Vào Tìm Thẻ: hình lấy từ BỘ THẺ đang chọn (chốt 26.11.2026); bộ đó ít hơn 12 hình thì trộn mọi theme chơi được. */
const hinhTimThe = computed(() => (symbols.value.length >= 12
  ? symbols.value
  : [...new Set(themes.value.filter(choiDuoc).flatMap((t) => t.symbols))]));

/** Bắt đầu ván Tìm Thẻ: CÙNG sự kiện `van_bat_dau` với ghép cặp — `che_do` tim_the / tim_the_may_<mức>, độ khó ở `tuy_chon`. */
function batDauTimThe(c: TimTheChon): void {
  suKien('van_bat_dau', {
    ...thamSoVanDau(), che_do: cheDoGa(c.doiThu), so_the: c.soThe, tuy_chon: c.doKho,
    so_nguoi: c.doiThu === 'mot' ? 1 : 2, theme: themeIds.value.join(',').slice(0, 100)
  });
}

/**
 * Hết ván Tìm Thẻ (luật thưởng chủ dự án duyệt 26.11.2026):
 *  · xu = điểm của mình, thua vẫn được; đấu Gà mờ 0 xu (cùng lý do với ghép cặp: chống cày máy dễ);
 *  · đấu máy lên sổ tài khoản + bộ đếm thắng máy như ghép cặp; ván MỘT MÌNH chỉ tính số ván / chuỗi ngày
 *    (không có thắng thua) và đồng bộ tổng xu lên tài khoản;
 *  · CHƯA tính Chỉ số trí nhớ (công thức dựa trên ghép cặp). DANH HIỆU nhóm Tìm Thẻ từ 29.11.2026 (`earnedTim`), khoe sau khi
 *    bảng kết quả hiện — cùng nhịp với ván ghép cặp.
 */
function xongTimThe(kq: TimTheKetVan): void {
  const may = kq.doiThu !== 'mot';
  const coXu = kq.doiThu !== 'easy';
  if (coXu) store.addScore(kq.diem);
  totalScore.value = store.totalScore();
  const tim = { dung: kq.dung };
  if (may) {
    const thang = kq.ketQua === 'thang';
    store.ghiVanBoDem({ thang, may: thang && coXu, tim });
    if (thang) ghiVuaThang();
    void taiKhoan.ghiVan({ ketQua: kq.ketQua === 'xong' ? 'hoa' : kq.ketQua, score: coXu ? kq.diem : 0 });
  } else {
    store.ghiVanBoDem({ thang: false, tim });
    void taiKhoan.dongBo();
  }
  const loai = kq.ketQua === 'xong' ? 'thang' : kq.ketQua;
  moKhoa(earnedTim({
    soThe: kq.soThe, doKho: kq.doKho, dung: kq.dung, soLuot: kq.soLuot, doiThu: kq.doiThu, ketQua: kq.ketQua,
    nhanhNhatMs: kq.nhanhNhatMs ?? null, thongKe: thongKeHienTai(taiKhoanMe.value?.wins ?? 0)
  }), { treMs: HIEN_BANG_MS[chonCanh(loai, { kyLuc: kq.kyLucMoi })] + 400 });
  suKien('van_ket_thuc', {
    che_do: cheDoGa(kq.doiThu), ket_qua: kq.ketQua, so_the: kq.soThe, tuy_chon: kq.doKho, giay: kq.giay,
    diem: kq.diem, so_dung: kq.dung, so_luot: kq.soLuot, chuoi_dai: kq.chuoiDai, ky_luc: kq.kyLucMoi
  });
}

/* ---------- tuỳ chọn hiển thị ---------- */
watchEffect(() => { document.documentElement.dataset.theme = dark.value ? 'dark' : 'light'; });
watchEffect(applySound);
watch([nen, dark, soundLevel, mode, level, themeIds, playerCount, options], () => {
  store.savePrefs({
    dark: dark.value, nen: nen.value, sound: soundLevel.value !== 'off', soundLevel: soundLevel.value, mode: mode.value,
    level: level.value, themes: themeIds.value, playerCount: playerCount.value,
    options: options.value
  });
});

/** Biểu tượng của MỌI theme đang mở khoá — trần trên của số cặp chơi được, để
 *  bản đồ cấp biết cấp nào không bộ theme nào gánh nổi. */
const maxSymbols = computed(() => new Set(
  themes.value.filter(choiDuoc).flatMap((t) => t.symbols)
).size);

/** Trộn biểu tượng của mọi theme đã chọn, loại trùng. */
const symbols = computed(() => [...new Set(
  themes.value.filter((t) => themeIds.value.includes(t.id)).flatMap((t) => t.symbols)
)]);

function playerList(): PlayerInit[] | undefined {
  // Đấu máy: người chơi luôn đi trước, máy là 'bot' — id này khớp với id mà
  // bộ điều khiển trong useGameSession chờ tới lượt
  if (botLevel.value) {
    const spec = BOT_SPECS[botLevel.value];
    return batDauLoat([
      // Đấu máy LUÔN là "Bạn", không lấy tên đã lưu: tên là chuyện của phòng
      // online (và của nhiều người cùng máy). Lôi tên sót lại từ đó sang đây thì
      // người chơi thấy một cái tên mình chưa từng đặt cho ván này, mà nhánh
      // đấu máy lại không có bước nhập tên để sửa (MenuScreen bỏ bước 'names').
      // Từ 25.11.2026 có HỒ SƠ (tên tự đặt ở màn chào bắt buộc): dùng tên + avatar của mình. Chưa có tên thì vẫn "Bạn".
      { id: 'p1', name: tenToi.value || 'Bạn', avatar: hoSo.value.mat }, // i18n-bo-qua — dữ liệu ván; tenNguoi() dịch lúc vẽ
      { id: 'bot', name: spec.name, avatar: spec.avatar }
    ]);
  }
  if (playerCount.value < 2) return undefined;
  const saved = store.playerNames();
  let k = 0;
  const list: PlayerInit[] = Array.from({ length: playerCount.value }, (_, i) => {
    const l = i > 0 ? mayCung.value[i] : null;
    if (l) return { id: maBot(k++), name: BOT_SPECS[l].name, avatar: BOT_SPECS[l].avatar };
    return { id: `p${i + 1}`, name: saved[i] || t('menu.nguoiN', { n: i + 1 }), ...(i === 0 ? { avatar: hoSo.value.mat } : {}) };   // '' = để trống; người 1 = mình (avatar hồ sơ)
  });
  return batDauLoat(list);
}

/** Nhóm khác (đổi tên, đổi số người, hay đổi MỨC MÁY) thì bắt đầu loạt mới từ 0.
 *  Nhánh đấu máy từng return sớm trước chỗ này, nên đổi từ Gà mờ sang Rồng thần
 *  vẫn mang theo số ván thắng của mức cũ. Khoá có id để "Bạn" vs máy không trùng
 *  với một nhóm người tình cờ cùng tên. */
function batDauLoat(list: PlayerInit[]): PlayerInit[] {
  const key = list.map((p) => `${p.id}:${p.name}`).join('|');
  if (key !== seriesKey.value) {
    seriesKey.value = key;
    seriesWins.value = {};
    soVanLoat.value = 0;
    matLoat = {};
  }
  // MẶT THÚ GIỮ NGUYÊN CẢ LOẠT (15.11.2026, chủ dự án): engine bốc ngẫu nhiên mỗi ván, nên chơi
  // lại là cả bàn đổi mặt. Bàn mới (danh sách đổi) thì bốc lại; bot có mặt cố định, không đụng.
  return list.map((p) => (p.avatar || !matLoat[p.id] ? p : { ...p, avatar: matLoat[p.id] }));
}
/** Mặt engine đã bốc cho từng người của loạt hiện tại — ghi sau mỗi lần vào ván (`launch`). */
let matLoat: Record<string, string> = {};

/** Seed lấy từ ngoài engine để engine giữ tính tất định (dùng chung với server sau này). */
const newSeed = (): number => Math.floor(Math.random() * 0xffffffff) || 1;

/**
 * Trạng thái không nhất quán thì tự chữa: `screen` báo đang chơi mà không có ván
 * nào là bế tắc — vùng chính rỗng và người chơi chỉ còn cách tải lại trang. Đưa
 * về menu và lau URL.
 */
watch(
  () => [screen.value, !!session.game.value] as const,
  ([sc, hasGame]) => {
    if (sc === 'game' && !hasGame) {
      screen.value = 'menu';
      setUrl(null);
    }
  }
);

/*
 * THOÁT VÁN = VỀ BƯỚC TRƯỚC KHI VÀO VÁN (chủ dự án 16.10.2026), không về tận trang chủ.
 * Vào ván thì URL thành `?playing=1` và mất `?w=<bước wizard>`, nên nhớ bước đó lại lúc
 * vào (sessionStorage: F5 giữa ván vẫn còn). Nút thoát trong ván + nút Back đi lối này;
 * bấm LOGO vẫn về trang chủ (luật cũ: logo lau sạch URL). Vào từ lối tắt trang chủ thì
 * không có bước nào → về trang chủ, cũng chính là "trang trước".
 */
const BUOC_TRUOC_KEY = 'mm.buocTruoc';
const docBuocTruoc = (): string | null => { try { return sessionStorage.getItem(BUOC_TRUOC_KEY); } catch { return null; } };
function nhoBuocTruoc(): void {
  const w = new URLSearchParams(location.search).get('w');
  try { if (w) sessionStorage.setItem(BUOC_TRUOC_KEY, w); else sessionStorage.removeItem(BUOC_TRUOC_KEY); } catch { /* bỏ qua */ }
}
/** Về menu, đứng ở bước wizard trước khi vào ván (cách làm như `doiBan`). */
function veBuocTruoc(): void {
  const w = docBuocTruoc();
  backToMenu();
  if (w) ghiQuery(`w=${w}`);
  menuKey.value++;
}
/** Nút thoát trong ván / nút Back: ván đang dở thì hỏi trước. */
const thoatVeBuoc = ref(false);
function thoatVan(): void {
  if (session.game.value && !session.game.value.finished) {
    thoatVeBuoc.value = true; confirmQuit.value = true;
    return;
  }
  veBuocTruoc();
}

function launch(config: GameConfig): void {
  nhoBuocTruoc();
  isRecord.value = false;
  freshAchievements.value = [];
  const g = session.start(config);
  if ((config.players?.length ?? 0) > 1) for (const p of g.players) if (p.avatar) matLoat[p.id] = p.avatar;
  screen.value = 'game';
  setUrl('playing=1');
  persistGame();
}

/**
 * "LUYỆN NGAY" ở màn Chỉ số trí nhớ (25.11.2026): vào thẳng một ván MỘT MÌNH kiểu Chơi nhanh, cỡ bàn gần `soThe`
 * nhất mà theme đang chọn đủ biểu tượng (thiếu thì `startLevel` nuốt lỗi và người chơi đứng yên ở trang chủ).
 */
function luyenTriNho(soThe: number): void {
  showSoTriNho.value = false;
  moChucNang('tri_nho_luyen');
  const du = BOARD_SIZES.filter((b) => b.pairs <= symbols.value.length);
  const ban = du.find((b) => b.pairs * 2 >= soThe) ?? du[du.length - 1];
  if (!ban) return;
  mode.value = 'classic';
  botLevel.value = null;
  playerCount.value = 1;
  startLevel(ban.level);
}

/** Màu hồ sơ ở bảng kết quả ván TRÊN MÁY — cùng nguồn với chip lượt. Ván một mình: không tô (bảng không có hàng người chơi). */
const mauKetQua = (id: string): string | undefined => {
  const ds = session.game.value?.players ?? [];
  return ds.length > 1 ? mauTaiMay(id, ds.map((p) => p.id)) : undefined;
};

/** Vào một cấp. MỌI chế độ đều qua đây, nên chế độ nào cũng có cấp tiếp theo
 *  để chơi tiếp — trước đây chỉ Chiến dịch có, các chế độ khác chơi xong chỉ
 *  còn "chơi lại" và "về trang chủ". */
function startLevel(id: number): void {
  // Engine ném lỗi nếu theme đang chọn không đủ biểu tượng cho bàn của cấp —
  // không bắt thì Vue chết giữa render và người chơi nhận màn hình trắng.
  // Bản đồ đã chặn các cấp đó, đây là lưới an toàn cuối.
  try {
    // Chiến dịch giữ nguyên presetConfig: luật của nó do TỪNG MÀN quyết định
    // (mốc sao, tỉ lệ thẻ đặc biệt tăng dần), không phải do người chơi đặt.
    const cfg = mode.value === 'campaign'
      ? presetConfig({ mode: 'campaign', level: id, symbols: symbols.value, seed: newSeed(), players: playerList() })
      : configFromOptions({ options: options.value, level: id, symbols: symbols.value, seed: newSeed(), players: playerList() });
    xoayLuotDau(cfg);
    suKien('van_bat_dau', {
      ...thamSoVanDau(),
      che_do: kieuVan(), so_the: (cfg.pairs ?? 0) * 2, man: mode.value === 'campaign' ? id : undefined,
      so_nguoi: playerCount.value, theme: themeIds.value.join(',').slice(0, 100),
      tuy_chon: mode.value === 'campaign' ? undefined : tomTatTuyChon()
    });
    levelId.value = id;
    // Màn Chiến dịch (1..60) và khoá cỡ bàn (1..50) là hai thang khác nhau —
    // ghi màn vào `level` là bước chọn số thẻ đọc ra cỡ bàn sai hoặc ném lỗi.
    if (mode.value !== 'campaign') level.value = id;
    // Ván CHƠI NHANH: nhớ cỡ bàn + số người để lần sau bấm ô Chơi nhanh là vào luôn (Prefs.nhanh)
    if (mode.value !== 'campaign' && !botLevel.value) store.savePrefs({ nhanh: { level: id, playerCount: playerCount.value } });
    // Ván ĐẤU MÁY: nhớ máy + cỡ bàn (Prefs.dauMay) — màn Đấu máy một trang điền sẵn lần sau
    if (mode.value !== 'campaign' && botLevel.value) store.savePrefs({ dauMay: { bot: botLevel.value, level: id } });
    session.setBots(banDoMay());
    launch(cfg);
  } catch { /* bản đồ hiện cảnh báo "cần thêm theme" */ }
}

/**
 * XOAY VÒNG NGƯỜI ĐI ĐẦU (chủ dự án yêu cầu 11.10.2026) — nhiều người cùng máy và
 * đấu máy. Giữ thứ tự người chơi như đã nhập, ván sau bắt đầu từ người ngay sau
 * người đi đầu ván trước. Ván đầu (hay đổi người) thì bốc ngẫu nhiên một lần.
 * Tắt `shufflePlayers` của engine: chính nó làm lượt đầu ngẫu nhiên mỗi ván.
 * Online làm cùng luật ở server (`prepareGame` trong room.ts).
 */
let nguoiDauTruoc: string | null = null;
function xoayLuotDau(cfg: GameConfig): void {
  if (!cfg.players || cfg.players.length < 2) return;
  // Ván đầu bốc theo SEED của ván (tất định: F5/khôi phục và test ra cùng người)
  cfg.players = xoayNguoiDau(cfg.players, nguoiDauTruoc, new Rng(cfg.seed).next());
  cfg.shufflePlayers = false;
  nguoiDauTruoc = cfg.players[0]!.id;
}

/** Cấp cuối của thang đang chơi: màn Chiến dịch hay khoá cỡ bàn. */
const tranCap = (): number => (mode.value === 'campaign' ? CAMPAIGN_LEVELS : LEVEL_KEYS);

/** Loại ván cho phân tích: chiến dịch · đấu máy (mức) · nhiều người · chơi nhanh một mình. */
function kieuVan(): string {
  if (mode.value === 'campaign') return 'chien_dich';
  if (botLevel.value) return `dau_may_${botLevel.value}`;
  if (playerCount.value > 1) return Object.keys(banDoMay()).length ? 'nhieu_nguoi_may' : 'nhieu_nguoi';
  return 'choi_nhanh';
}

/** Tuỳ chọn ván đang bật, gọn cho GA: `peek2,time1` — bàn trơn là `tron`. */
function tomTatTuyChon(): string {
  const bat = Object.entries(options.value).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k}${v}`);
  return bat.length ? bat.join(',').slice(0, 100) : 'tron';
}

/** Ván offline BỎ NGANG (thoát / chơi lại / đóng trang khi chưa xong) — biết người chơi nản ở đâu. */
function boVanDo(cach: string): void {
  const g = session.game.value;
  if (screen.value === 'mua-the') { if (cach !== 'choi_lai') suKien('mua_the_bo_do', { cach }); return; }
  if (screen.value === 'tim-the') {
    const d = timTheRef.value?.boDo();
    // CÙNG sự kiện `van_bo_do` với ghép cặp (che_do = tim_the…): so được tỉ lệ bỏ ngang hai kiểu trong một báo cáo
    if (d) suKien('van_bo_do', { che_do: cheDoGa(d.doiThu), cach, so_the: d.soThe, tuy_chon: d.doKho, tien_do: Math.round((d.luot / d.soLuot) * 100), giay: d.giay });
    return;
  }
  if (!g || g.finished || screen.value !== 'game') return;
  suKien('van_bo_do', {
    che_do: kieuVan(), cach, so_the: g.cards.length,
    man: g.config.mode === 'campaign' ? (levelId.value ?? undefined) : undefined,
    tien_do: Math.round((session.matchedCount.value / Math.max(1, session.totalPairs.value)) * 100),
    giay: Math.round(session.elapsed.value)
  });
}
const khiRoiTrang = (): void => { boVanDo('dong_trang'); };
onMounted(() => window.addEventListener('pagehide', khiRoiTrang));
onUnmounted(() => window.removeEventListener('pagehide', khiRoiTrang));

/** Nút người chơi bấm ở bảng kết quả. */
const chonKetQua = (h: string): void => { suKien('ket_qua_chon', { hanh_dong: h, che_do: kieuVan() }); };

function nextLevel(): void {
  if (levelId.value && levelId.value < tranCap()) startLevel(levelId.value + 1);
  else backToMenu();
}

function replay(): void {
  startLevel(levelId.value ?? level.value);
}

/** Nút ↻ trên HUD (ván một mình / đấu máy): LUÔN hỏi trước khi ván chưa xong (chủ dự án
 *  16.10.2026 — lỡ tay là mất ván). Dùng chung `replay()` với bảng kết quả. */
const confirmChoiLai = ref(false);
useBackCloser(30, () => confirmChoiLai.value, () => { confirmChoiLai.value = false; });
function choiLaiVan(): void {
  const g = session.game.value;
  if (g && !g.finished) { confirmChoiLai.value = true; return; }
  replay();
}

/** "Đổi bàn" ở bảng kết quả: về menu nhưng đứng sẵn ở bước chọn cỡ bàn (hoặc
 *  bản đồ màn nếu là Chiến dịch), giữ nguyên nhánh đang chơi. */
function doiBan(): void {
  backToMenu();
  ghiQuery('w=level');
  menuKey.value++;                     // dựng lại MenuScreen để nó đọc ?w=level
}

function backToMenu(): void {
  session.stop();
  session.summary.value = null;   // đóng dialog kết quả nếu đang mở
  screen.value = 'menu';
  totalScore.value = store.totalScore();
  clearResume();
}

/* ---------- ghi kết quả khi ván kết thúc ---------- */
watch(session.summary, (s) => {
  clearTimeout(resultTimer);
  showResult.value = false;
  const game = session.game.value;
  if (!s || !game) return;
  // Thắng: để pháo hoa + vỗ tay chiếm sóng 5 giây rồi popup mới vào
  // Cùng lý do với bản online (OnlineGame.vue): 5 giây nhìn bàn đứng im là lâu
  // thật, mà hiệu ứng vẫn chạy tiếp phía sau bảng nên rút xuống không mất gì.

  const player = game.players[0]!;
  suKien('van_ket_thuc', {
    che_do: kieuVan(), ket_qua: session.loaiKetCuc.value, so_the: game.cards.length,
    man: game.config.mode === 'campaign' ? (levelId.value ?? undefined) : undefined,
    sao: s.stars, hoan_hao: !!s.hoanHao, giay: s.seconds
  });
  if (!game.isMultiplayer) {
    const id = levelId.value ?? level.value;
    // Cấp và kỷ lục ghi RIÊNG: saveLevel mở cấp sau (chế độ không xếp sao thì
    // 1 sao = đã qua), saveResult giữ kỷ lục và cộng điểm vào tổng.
    if (s.status === 'won') store.saveLevel(game.config.mode, id, Math.max(1, s.stars), s.score, !!s.hoanHao);
    isRecord.value = s.status === 'won'
      && store.saveResult(game.config.mode, id, {
        score: s.score, moves: s.moves, seconds: s.seconds
      });
    store.ghiVanBoDem({ thang: s.status === 'won', hoanHao: s.status === 'won' && player.misses === 0 });
    if (s.status === 'won') ghiVuaThang();   // xin đánh giá lúc về trang chủ (lib/xin-danh-gia.ts)
    ghiVanTriNho(hienTriNho.value ? player : undefined, game.totalPairs);
    const dat = earned({
      summary: s,
      mode: game.config.mode,
      cells: game.cards.length,
      misses: player.misses,
      lives: game.config.lives ?? null,
      peekMs: game.config.peekMs ?? 0,
      livesLeft: player.lives,
      levelId: levelId.value ?? undefined,
      options: game.config.mode === 'campaign' ? null : options.value,
      themeIds: themeIds.value, timeLimit: game.config.timeLimit ?? null, gio: new Date().getHours(),
      thongKe: thongKeHienTai(taiKhoanMe.value?.wins ?? 0)
    });
    freshAchievements.value = moKhoa(dat, { treMs: HIEN_BANG_MS[canhVan()] + 400 });
    // Có tài khoản thì ván này đi lên sổ của người chơi — một lần, ở đây.
    void taiKhoan.ghiVan({
      ketQua: s.status === 'won' ? 'thang' : 'thua', score: s.score,
      boardKey: `${game.config.mode}:L${id}`, moves: s.moves, seconds: s.seconds, achievements: dat
    });
  } else {
    // Ván thi đấu cũng phải được cộng vào tổng tích luỹ, nếu không chơi nhiều
    // người cả buổi mà điểm vẫn đứng yên — và theme khoá theo điểm nên người
    // hay chơi cùng bạn bè không bao giờ mở được gì. Lấy điểm người dẫn đầu:
    // đây là thành tích của MÁY này, không phân biệt được ai đang cầm.
    // Đấu bot MỞ được cấp sau, nhưng chỉ khi NGƯỜI THẮNG (hoặc hoà).
    //
    // Vì sao không phải "bàn sạch là mở": trong ván đấu bot thì phần lớn bàn do
    // BOT dọn. Chọn Bot siêu đẳng rồi ngồi xem nó phá là mở hết cấp mà không
    // chơi gì — thang cấp mất nghĩa. Ngược lại, cấm hẳn thì ai chỉ đấu bot lại
    // mắc mãi ở cấp 1. Thắng bot là bằng chứng đã chơi được cấp này; muốn dễ
    // thì hạ mức bot xuống, vẫn phải tự lật đủ cặp.
    if (botLevel.value && session.thang.value) {   // `thang` xét cả trường hợp bot dẫn đầu
      store.saveLevel(game.config.mode, levelId.value ?? level.value, 1, 0);
    }
    // Đấu máy: chỉ cộng điểm CỦA NGƯỜI, và mức Dễ thì không tính — nếu tính,
    // cày máy dễ là cách nhanh nhất để mở hết theme, mọi mốc điểm mất nghĩa.
    if (botLevel.value) {
      const diemNguoi = s.ranking.find((r) => r.id !== 'bot')?.score ?? 0;
      if (botLevel.value !== 'easy') store.addScore(diemNguoi);
      // Đấu máy là ván CỦA MỘT NGƯỜI nên lên sổ tài khoản được; kết cục đọc
      // `loaiKetCuc` (hoà là kết cục thứ ba). Nhiều người chung máy thì KHÔNG:
      // không biết ai đang cầm máy.
      // Danh hiệu đấu máy (hạ gà cứng… rồng thần) xét theo KẾT CỤC CỦA NGƯỜI
      const thangMay = session.loaiKetCuc.value === 'thang';
      // Thắng Gà mờ không tính vào bộ đếm thắng máy (cùng lý do không cộng điểm)
      store.ghiVanBoDem({ thang: thangMay, may: thangMay && botLevel.value !== 'easy', hoanHao: thangMay && player.misses === 0 });
      if (thangMay) ghiVuaThang();   // xin đánh giá lúc về trang chủ (lib/xin-danh-gia.ts)
      // Trí nhớ chấm trên lượt của CHÍNH NGƯỜI nên đấu máy mức nào cũng ghi (kể cả Dễ)
      ghiVanTriNho(hienTriNho.value ? s.ranking.find((r) => !laBot(r.id)) : undefined, game.totalPairs);
      const dat = earned({
        summary: s, mode: game.config.mode, cells: game.cards.length,
        misses: player.misses, lives: game.config.lives ?? null, peekMs: game.config.peekMs ?? 0,
        livesLeft: player.lives, options: options.value, botLevel: botLevel.value,
        ketQua: session.loaiKetCuc.value,
        themeIds: themeIds.value, timeLimit: game.config.timeLimit ?? null, gio: new Date().getHours(),
        thongKe: thongKeHienTai(taiKhoanMe.value?.wins ?? 0)
      });
      freshAchievements.value = moKhoa(dat, { treMs: HIEN_BANG_MS[canhVan()] + 400 });
      void taiKhoan.ghiVan({
        ketQua: session.loaiKetCuc.value, score: botLevel.value === 'easy' ? 0 : diemNguoi, achievements: dat
      });
    } else store.addScore(s.ranking.find((r) => !laBot(r.id))?.score ?? 0);   // điểm MÁY không cộng vào tổng
    soVanLoat.value++;
    // Tỷ số loạt: hoà thì không ai được cộng
    const champ = s.ranking[0];
    if (champ && !isDraw(s.ranking)) {
      seriesWins.value = { ...seriesWins.value, [champ.name]: (seriesWins.value[champ.name] ?? 0) + 1 };
    }
  }
  totalScore.value = store.totalScore();
  progressRev.value++;
  // Bảng kết quả vào khi phần chính của cảnh đã chạy xong. Đặt SAU khi biết kỷ
  // lục (isRecord) vì cảnh kỷ lục dài hơn cảnh thắng thường.
  resultTimer = setTimeout(() => { showResult.value = true; }, HIEN_BANG_MS[canhVan()]);
  // Gợi ý tính SAU khi đã cộng ván này (điểm, bộ đếm, danh hiệu vừa mở)
  goiYVan.value = game.isMultiplayer && !botLevel.value
    ? null
    : chonGoiY(new Set(daCo.value), thongKeHienTai(taiKhoanMe.value?.wins ?? 0), themeKhoa.value);
  try { sessionStorage.removeItem(RESUME_KEY); } catch { /* bỏ qua */ }
});

/**
 * Có nút "Cấp tiếp theo" bấm được hay không.
 *
 * Chơi MỘT MÌNH thì phải hỏi store: thua thì cấp sau chưa mở, nút vẫn bấm được
 * là nhảy vào cấp bị khoá — bản đồ khoá nó nhưng nút thì không biết.
 *
 * Các nhánh khác (nhiều người cùng máy, đấu máy) mở sẵn hết cấp nên luôn đi tiếp
 * được, thắng hay thua cũng vậy — cùng luật với bản đồ cấp ở MenuScreen.
 */
const hasNext = computed(() => {
  void progressRev.value;                   // đếm để computed chạy lại sau mỗi ván
  const id = levelId.value;
  if (!id || id >= tranCap()) return false;
  const soloLadder = playerCount.value < 2 && !botLevel.value;
  if (!soloLadder) return true;
  return (mode.value === 'campaign' ? store.unlockedLevel() : store.unlockedKey()) > id;
});
</script>

<template>
  <!-- Icon bay lơ lửng sau các màn menu — KHÔNG có trong lúc chơi (xem IconBay.vue) -->
  <!-- …kể cả Mưa Thẻ: icon bay giữa các lá đang rơi trông như một lá nữa -->
  <IconBay v-if="screen !== 'game' && !laManRieng(screen) && !dangTimOnline" />
  <!-- Lá bài rơi như cánh hoa — riêng hình nền Hoa anh đào (LaRoi.vue), cùng luật với icon bay: không có lúc đang chơi -->
  <LaRoi v-if="canh === 'anh-dao' && screen !== 'game' && !laManRieng(screen)" />
  <!-- Sao băng thưa: chỉ đi kèm hình nền hành tinh (Premium), không có lúc đang chơi Mưa Thẻ -->
  <!-- Hiệu ứng ghép cặp Premium (lib/hieu-ung-premium.ts) — lớp vẽ chung cho ván offline + online -->
  <GhepPremiumFx />
  <SaoBang v-if="canh !== 'goc' && canh !== 'anh-dao' && screen !== 'mua-the'" />
  <TopBar
    ref="topBar"
    :debug="debug"
    @update:debug="xinDebug" @mo-debug="showDebug = true" @premium="premiumTu = 'menu'; showPremium = true" @hinh-nen="showHinhNen = true" @nhac-nen="showNhac = true" @mo-pm="moTuCaiDat"
    :nen="nen" :sound-level="soundLevel" :total-score="totalScore" :nhac="nhacBat" :bai-nhac="baiNhac" :nhac-ngau-nhien="nhacNgauNhien"
    :danh-hieu="{ co: Math.max(0, dsHien.filter((a) => daCo.includes(a.id)).length - vuaMo.length - dangKhoe), tong: dsHien.length }"
    @danh-hieu="showDanhHieu = true"
    :dung-yen="screen !== 'menu'"
    :trong-van="vanDangChay"
    @set-nhac="datNhac"
    :account="taiKhoanSan" :bxh-mo="showBxh" :signed-in="!!taiKhoanMe" :avatar="taiKhoanMe?.avatar"
    @set-nen="nen = $event"
    :rung="rungBat" :co-rung="rung.coTheRung()"
    @toggle-rung="rungBat = !rungBat; if (rungBat) rung.ghep(1)"
    @account="showAccount = true"
    @ho-so="showHoSo = true"
    @xep-hang="showBxh = true"
    @set-sound="(l: SoundLevel) => { soundLevel = l; applySound(); }"
    :ten-tk="taiKhoanMe?.name"
    @rules="showRules = true"
    @bao-loi="showBaoLoi = true"
    @cycle-sound="cycleSound"
    @home="goHome"
  />

  <!-- ĐỔI MÀN TỨC THÌ, KHÔNG HIỆU ỨNG (chủ dự án 16.10.2026: thoát ván mà còn thấy
       trang trượt/mờ là "không được nhanh"). Bản cũ mờ + trượt 10px ~0,3 giây, hai màn
       chồng nhau một nhịp — đừng dựng lại. -->
  <main>
    <MenuScreen
      @doi-nen="nen = dark ? 'sang' : 'toi'"
      v-if="screen === 'menu'"
      :key="menuKey"
      :themes="themes"
      :mode="mode"
      :level="level"
      :theme-ids="themeIds"
      :player-count="playerCount"
      :bot-level="botLevel"
      :may-cung="mayCung"
      :options="options"
      :total-score="totalScore"
      :symbol-count="symbols.length"
      :max-symbol-count="maxSymbols"
      @update:mode="mode = $event"
      @update:level="level = $event"
      @update:theme-ids="themeIds = $event"
      @update:player-count="playerCount = $event"
      @update:bot-level="botLevel = $event"
      @update:may-cung="mayCung = $event"
      @update:options="options = $event"
      @start-level="startLevel"
      @online="screen = 'online'"
      @mua-the="nhoBuocTruoc(); screen = 'mua-the'"
      @tim-the="nhoBuocTruoc(); screen = 'tim-the'"
      @so-tri-nho="showSoTriNho = true"
      :goi-y="goiYTrangChu" :chuoi-ngay="chuoiNgayNay" :man-chien-dich="manChienDich"
      @chinh-phuc="(id: string) => { const a = byId(id); if (a) chinhPhuc(a); }"
    />

    <OnlineScreen
      v-else-if="screen === 'online'"
      :key="onlineKey"
      ref="onlineRef"
      :join-code="joinCode"
      @back="screen = 'menu'; joinCode = ''"
    />

    <MuaThe
      v-else-if="screen === 'mua-the'"
      ref="muaTheRef"
      :themes="themes"
      @thoat="veBuocTruoc"
      @bat-dau="(soCot: number) => suKien('mua_the_bat_dau', { so_cot: soCot })"
      @ket-thuc="xongMuaThe"
    />

    <TimThe
      v-else-if="screen === 'tim-the'"
      ref="timTheRef"
      :hinh="hinhTimThe"
      @thoat="veBuocTruoc"
      @bat-dau="batDauTimThe"
      @ket-thuc="xongTimThe"
    />

    <GameScreen
      v-else-if="screen === 'game' && session.game.value"
      :session="session"
      :game="session.game.value"
      :level-id="levelId ?? undefined"
      :series-wins="seriesWins"
      @quit="thoatVan"
      @choi-lai="choiLaiVan"
    />

    <!-- Nhánh CUỐI bắt buộc phải có. Trước đây chuỗi kết thúc ở điều kiện
         `session.game.value`, nên trạng thái nào không khớp là vùng chính RỖNG:
         thanh trên vẫn hiện (nó ở ngoài) mà giữa trang trắng xoá, và không có
         đường nào thoát ngoài tải lại. Watcher bên dưới tự đưa về menu; khối này
         là lưới an toàn cho một frame giữa hai trạng thái. -->
    <MenuScreen
      @doi-nen="nen = dark ? 'sang' : 'toi'"
      v-else
      :key="`fallback-${menuKey}`"
      :themes="themes"
      :mode="mode"
      :level="level"
      :theme-ids="themeIds"
      :player-count="playerCount"
      :bot-level="botLevel"
      :may-cung="mayCung"
      :options="options"
      :total-score="totalScore"
      :symbol-count="symbols.length"
      :max-symbol-count="maxSymbols"
      @update:mode="mode = $event"
      @update:level="level = $event"
      @update:theme-ids="themeIds = $event"
      @update:player-count="playerCount = $event"
      @update:bot-level="botLevel = $event"
      @update:may-cung="mayCung = $event"
      @update:options="options = $event"
      @start-level="startLevel"
      @online="screen = 'online'"
      @mua-the="nhoBuocTruoc(); screen = 'mua-the'"
      @tim-the="nhoBuocTruoc(); screen = 'tim-the'"
      @so-tri-nho="showSoTriNho = true"
      :goi-y="goiYTrangChu" :chuoi-ngay="chuoiNgayNay" :man-chien-dich="manChienDich"
      @chinh-phuc="(id: string) => { const a = byId(id); if (a) chinhPhuc(a); }"
    />
  </main>

  <!-- Kho hình + gradient cho <OptionIcon>. Mount ĐÚNG MỘT LẦN: id gradient là
       toàn cục, nhiều bản sao thì mọi icon lấy chung một màu. -->
  <IconDefs />
  <DoNhip v-if="debug && doNhip" />

  <TaiKhoanDialog v-if="showAccount" @pha-ky-luc="phaKyLuc" @close="showAccount = false" @danh-hieu="showAccount = false; showDanhHieu = true" @xep-hang="showAccount = false; showBxh = true" />
  <BangXepHang v-if="showBxh" @close="showBxh = false" @thach="thachDau" />
  <DanhHieuDialog
    v-if="showDanhHieu" :da-co="daCoSet" :tk="thongKe" :theme-khoa="themeKhoa"
    @close="showDanhHieu = false" @chinh-phuc="chinhPhuc"
  />
  <MoKhoaFx />
  <!-- Xem thử hiệu ứng (chế độ debug): dựng cảnh 4,5 giây rồi tự gỡ -->
  <KetCucFx
    v-if="xemFx" :key="xemFx.key" xem-thu
    :loai="xemFx.loai" :bien-the="xemFx.bienThe ?? null" :ky-luc="xemFx.kyLuc" mot-minh
  />

  <DebugDialog
    v-if="showDebug && debug" :do-nhip="doNhip"
    @close="showDebug = false"
    @update:do-nhip="doNhip = $event"
    @xem-fx="(fx: XemFx) => { showDebug = false; xemThuFx(fx); }"
    @mua-the="showDebug = false; nhoBuocTruoc(); screen = 'mua-the'"
    @so-tri-nho="showDebug = false; showSoTriNho = true"
    @premium="showDebug = false; premiumTu = 'debug'; showPremium = true"
    @tat="debug = false; showDebug = false"
  />
  <SoTriNho v-if="showSoTriNho" @close="showSoTriNho = false" @luyen="luyenTriNho" />
  <MatKhauDebug v-if="hoiMkDebug" @dung="hoiMkDebug = false; debug = true" @dong="hoiMkDebug = false" />
  <BangPremium v-if="showPremium && (debug || hienVienPremium)" :tu="premiumTu" :nhac-hien="nhacHien" :nhac-dang="nhacBat && soundLevel !== 'off' ? baiThat : null" @close="if (premiumTu === 'qua') batChiNutPremium(); showPremium = false" @mo="moTuPremium" />
  <ChonHinhNen v-if="showHinhNen && (debug || hienPremium)" @close="showHinhNen = false" />
  <ChonHuyHieu v-if="showHuyHieu" @close="showHuyHieu = false" />
  <ChonNhac v-if="showNhac" :nhac="nhacBat" :bai="baiNhac" :ngau-nhien="nhacNgauNhien" @chon="datNhac" @close="showNhac = false" />
  <!-- HỒ SƠ NGƯỜI CHƠI (25.11.2026): màn chào BẮT BUỘC (chưa xong là chặn), tấm sửa mở từ menu -->
  <BaoLoiDialog v-if="showBaoLoi" @xong="showBaoLoi = false" />
  <HoSoDialog v-if="canMoChao" kieu="chao" />
  <HoSoDialog v-else-if="showHoSo" kieu="sua" @xong="showHoSo = false" @tai-khoan="showHoSo = false; showAccount = true" />

  <CaiAppDialog v-if="hienCai" @close="dongCai" />

  <RulesDialog
    v-if="showRules" :debug="debug"
    @close="showRules = false"
    @update:debug="xinDebug"
  />

  <ConfirmDialog
    v-if="confirmChoiLai"
    :title="t('choiLai.tieuDe')"
    :body="t('choiLai.than')"
    :confirm-label="t('choiLai.nut')"
    @confirm="boVanDo('choi_lai'); confirmChoiLai = false; replay()"
    @cancel="confirmChoiLai = false"
  />

  <LoiMoi @vao="vaoPhongMoi" />
  <ThiDau @vao="vaoPhongThiDau" />
  <ConfirmDialog
    v-if="hoiBoVanMoi"
    :title="t('moi.boVan.tieuDe')"
    :body="t('moi.boVan.than')"
    :confirm-label="t('moi.boVan.nut')"
    @confirm="dongYBoVanMoi"
    @cancel="huyBoVanMoi"
  />

  <ConfirmDialog
    v-if="confirmQuit"
    :title="t('thoat.tieuDe')"
    :body="t('thoat.than')"
    :confirm-label="t('thoat.nut')"
    @confirm="boVanDo('thoat'); confirmQuit = false; if (thoatVeBuoc) veBuocTruoc(); else { menuKey++; backToMenu(); }"
    @cancel="confirmQuit = false"
  />

  <!--
    THẮNG · THUA · HOÀ phải nhìn ra KHÁC NHAU. `status === 'won'` chỉ là "bàn
    đã sạch", nên thua bot cũng từng được pháo hoa — xem `session.loaiKetCuc`.
    Ván offline thua thì trước đây trống trơn, giống hệt một ván đang chơi dở.
    Hình cụ thể bốc theo seed trong `lib/ketcuc-fx.ts`, không nằm ở đây.
  -->
  <KetCucFx
    v-if="session.summary.value && screen === 'game'"
    :loai="session.loaiKetCuc.value"
    :seed="session.game.value?.config.seed"
    :ky-luc="isRecord"
    :mot-minh="motMinh"
  />

  <ResultDialog
    v-if="session.summary.value && showResult"
    :summary="session.summary.value"
    :is-record="isRecord"
    :star-misses="session.game.value?.config.starMisses"
    :so-cap="session.game.value?.totalPairs"
    :show-stars="!!levelId"
    :multiplayer="!!session.game.value?.isMultiplayer"
    :mau-cua="mauKetQua"
    :minh-ket-cuc="session.minhKetCuc.value"
    :fresh-achievements="freshAchievements"
    :goi-y="goiYVan"
    @chinh-phuc="chinhPhuc"
    :series-wins="seriesWins"
    :so-van="soVanLoat"
    :nguoi-choi="session.game.value?.players"
    :has-next="hasNext"
    :level-id="levelId ?? level"
    @replay="chonKetQua('choi_lai'); replay()"
    @next="chonKetQua('man_tiep'); nextLevel()"
    @menu="chonKetQua('ve_menu'); backToMenu()"
    @doi-ban="chonKetQua('doi_ban'); doiBan()"
  />
</template>

<style scoped>
main {
  /* position: relative để màn đang rời (.screen-leave-active, inset: 0) neo
     theo đây thay vì theo viewport */
  position: relative;
  flex: 1; min-height: 0; display: flex; justify-content: center;
  padding: 12px; overflow-y: auto;
}
/* Cột app đã cố định bề rộng (440px trên desktop, full trên mobile) nên panel
   chỉ cần chiếm trọn chỗ — không còn chặn 760px hay ghim 820px theo viewport. */
main > * { width: 100%; }
</style>
