import { moGoiTin } from './lib-view.mjs';
#!/usr/bin/env node
// Giả vờ nhiều người vào một phòng, để test đông người mà không cần mở 10 tab.
//
//   node tools/gia-nguoi.mjs "https://thebai2.hello314.com/?room=525473" --so 5
//
// Tuỳ chọn:
//   --so <n>        số người giả (mặc định 4; phòng tối đa 10 kể cả bạn)
//   --ten A,B,C     đặt tên tay thay vì tên mặc định
//   --ready         tự bấm sẵn sàng (mặc định BẬT; --no-ready để tắt)
//   --choi          tự chơi khi tới lượt (mặc định BẬT; --no-choi để tắt)
//   --nho           bot nhớ thẻ đã thấy (mặc định BẬT; --no-nho = lật bừa)
//   --tre <ms>      nghĩ bao lâu trước khi lật (mặc định 900)
//   --emoji <ms>    thỉnh thoảng thả emoji (0 = tắt, mặc định 0)
//   --choi-lai      hết ván tự bấm "Chơi lại" (mặc định BẬT; --no-choi-lai để tắt)
//   --tu-bat        nếu người giả đầu tiên là CHỦ phòng thì tự bấm Bắt đầu
//                   (dùng khi bạn chỉ muốn xem ván tự chạy, không tự vào chơi)
//
// GN_DEBUG=1 để in từng nước lật.
//
// Ctrl+C = mọi người giả rời phòng gọn gàng.

const argv = process.argv.slice(2);
const co = (t, mac) => { const i = argv.indexOf('--' + t); return i >= 0 ? argv[i + 1] : mac; };
const bat = (t, mac) => argv.includes('--' + t) ? true : argv.includes('--no-' + t) ? false : mac;

const link = argv.find((a) => !a.startsWith('--') && (a.includes('://') || /^\d{4,8}$/.test(a)));
if (!link) { console.error('Thiếu link phòng, ví dụ: node tools/gia-nguoi.mjs "https://.../?room=525473"'); process.exit(1); }

let SERVER, CODE;
if (/^\d{4,8}$/.test(link)) {
  SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
  CODE = link;
} else {
  const u = new URL(link);
  CODE = u.searchParams.get('room') ?? u.pathname.split('/').pop();
  SERVER = process.env.MM_SERVER ?? u.origin;
}
if (!CODE) { console.error('Link không có mã phòng (?room=...)'); process.exit(1); }
const WS = SERVER.replace(/^http/, 'ws');

const SO = Number(co('so', 4));
const TEN_MAC = ['Bốp', 'Cà Rốt', 'Dũng', 'Én', 'Phúc', 'Gấu', 'Hải', 'Ỉn', 'Khoai'];
const TENS = co('ten', '') ? co('ten', '').split(',').map((s) => s.trim()) : TEN_MAC;
const READY = bat('ready', true);
const CHOI = bat('choi', true);
const NHO = bat('nho', true);
const TRE = Number(co('tre', 900));
const EMOJI_MS = Number(co('emoji', 0));
const TU_BAT = bat('tu-bat', false);
const CHOI_LAI = bat('choi-lai', true);
// PHẢI nằm trong QUICK_EMOJIS của engine — server nuốt êm emoji lạ
const EMOJIS = ['😂', '🐔', '🐌', '💩', '😭', '😡', '🔥', '🎉'];

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

class NguoiGia {
  constructor(name) {
    this.name = name;
    this.kyUc = new Map();      // index -> symbol từng thấy
    this.predeal = null;        // bàn-biết-trước (nếu server bật), chỉ để lật cho nhanh
    this.dangNghi = false;
  }

  vao() {
    return new Promise((resolve, reject) => {
      const p = new URLSearchParams({ name: this.name });
      this.ws = new WebSocket(`${WS}/ws/${CODE}?${p}`);
      const hong = setTimeout(() => reject(new Error('quá hạn nối: ' + this.name)), 10000);
      this.ws.onmessage = (e) => {
        let msg; try { msg = moGoiTin(JSON.parse(e.data)); } catch { return; }
        if (msg.t === 'welcome') { clearTimeout(hong); this.id = msg.playerId; resolve(msg); }
        this.nhan(msg).catch(() => {});
      };
      this.ws.onerror = () => { clearTimeout(hong); reject(new Error('lỗi WS: ' + this.name)); };
      this.ws.onclose = () => { this.dong = true; };
    });
  }

  gui(msg) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)); }

  async nhan(msg) {
    if (msg.t === 'error') console.log(`  ! ${this.name}: ${msg.message ?? JSON.stringify(msg)}`);
    if (msg.t === 'predeal') { this.predeal = msg.symbols; return; }
    // Hết ván: bấm "Chơi lại". Server đòi MỌI người còn kết nối cùng bấm, nên
    // người thật cũng phải bấm — bot chỉ lo phần của mình. Bấm hơi trễ để màn
    // kết quả kịp hiện ra, và chỉ MỘT lần mỗi ván (`daXinLai`).
    const ketThuc = msg.room?.status === 'ended'
      || ((msg.t === 'state' || msg.t === 'events') && (msg.view?.status === 'won' || msg.view?.status === 'lost'));
    if (CHOI_LAI && ketThuc && !this.daXinLai) {
      this.daXinLai = true;
      setTimeout(() => this.gui({ t: 'again' }), 2500 + Math.random() * 1500);
    }

    if (msg.t === 'room' && msg.room?.status === 'lobby') {
      this.daXinLai = false;      // về phòng chờ = ván mới, cho phép xin lại lần sau
      this.kyUc.clear();
      this.predeal = null;
      this.daBat = false;
      const toi = msg.room.players.find((p) => p.id === this.id);
      if (READY && toi && !toi.ready) this.gui({ t: 'ready', ready: true });
      // Chủ phòng là người giả: chỉ bấm Bắt đầu khi MỌI người đang nối đã sẵn sàng
      if (TU_BAT && msg.room.hostId === this.id && !this.daBat) {
        const co_mat = msg.room.players.filter((p) => !p.disconnectedAt);
        if (co_mat.length >= 2 && co_mat.every((p) => p.ready || p.id === this.id)) {
          this.daBat = true;
          this.gui({ t: 'start' });
        }
      }
      return;
    }
    if ((msg.t === 'state' || msg.t === 'events') && msg.view) {
      if (this === nguoi[0]) {
        const v = msg.view, dau = `${v.status} ${v.matchedPairs}/${v.totalPairs}`;
        if (dau !== this.dauCu) { this.dauCu = dau; console.log('  ván:', dau); }
      }
      await this.xemBan(msg.view);
    }
  }

  async xemBan(view) {
    // VÁN MỚI = QUÊN SẠCH. Bàn mới xáo lại nhưng chỉ số ô vẫn 0..n, giữ ký ức cũ
    // là bot "nhớ" toàn thứ sai và lật trượt suốt ván.
    if (view.moves === 0 && this.kyUc.size) this.kyUc.clear();
    // Nhớ mọi thẻ đang ngửa — kể cả của người khác lật, y như người thật nhìn bàn
    if (NHO) for (const c of view.cards) {
      const s = c.symbol ?? (this.predeal && c.state !== 'down' ? this.predeal[c.index] : null);
      if (s) this.kyUc.set(c.index, s);
      if (c.state === 'matched') this.kyUc.delete(c.index);
    }
    if (!CHOI || view.status !== 'playing' || view.currentId !== this.id) return;
    if (this.dangNghi) return;
    this.dangNghi = true;
    try {
      const dang = view.cards.filter((c) => c.state === 'up').map((c) => c.index);
      if (dang.length >= 2) return;                       // đang chờ server xử cặp
      const up = new Set(dang);
      const con = view.cards.filter((c) => c.state === 'down' && !c.blank).map((c) => c.index);
      if (!con.length) return;

      let chon = null;
      if (NHO && dang.length === 1) {
        const can = this.kyUc.get(dang[0]) ?? this.predeal?.[dang[0]];
        if (can) chon = con.find((i) => (this.kyUc.get(i) ?? null) === can) ?? null;
      }
      if (NHO && chon === null && dang.length === 0) {
        // Tìm một cặp đã nhớ đủ hai lá
        const theo = new Map();
        for (const i of con) {
          const s = this.kyUc.get(i); if (!s) continue;
          if (theo.has(s)) { chon = theo.get(s); break; }
          theo.set(s, i);
        }
      }
      if (chon === null) chon = con[Math.floor(Math.random() * con.length)];

      await nghi(TRE + Math.random() * TRE);
      if (process.env.GN_DEBUG) console.log(`    ${this.name} lật ${chon}`);
      this.gui({ t: 'flip', index: chon });
    } finally {
      this.dangNghi = false;
    }
  }
}

const nguoi = [];
console.log(`Phòng ${CODE} tại ${SERVER} — thả ${SO} người giả`);
for (let i = 0; i < SO; i++) {
  const n = new NguoiGia(TENS[i % TENS.length] + (i >= TENS.length ? ' ' + (i + 1) : ''));
  try {
    await n.vao();
    nguoi.push(n);
    console.log(`  + ${n.name} đã vào`);
  } catch (e) {
    console.error(`  ✗ ${n.name}: ${e.message}`);
  }
  await nghi(250);   // vào rải ra, giống người thật, và tránh dồn cục
}
if (!nguoi.length) { console.error('Không ai vào được — phòng đầy, sai mã, hoặc ván đang chạy?'); process.exit(1); }

if (EMOJI_MS > 0) setInterval(() => {
  const n = nguoi[Math.floor(Math.random() * nguoi.length)];
  n?.gui({ t: 'emoji', emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)] });
}, EMOJI_MS);

// Giữ kết nối sống (server có mốc im lặng)
setInterval(() => { for (const n of nguoi) n.gui({ t: 'alive' }); }, 20000);

console.log('Đang chạy. Bạn mở link phòng, bấm Bắt đầu — họ tự chơi. Ctrl+C để cho họ rời.');

let dangThoat = false;
const thoat = async () => {
  if (dangThoat) return; dangThoat = true;
  console.log('\nCho mọi người rời phòng…');
  for (const n of nguoi) n.gui({ t: 'leave' });
  await nghi(600);
  for (const n of nguoi) n.ws?.close();
  process.exit(0);
};
process.on('SIGINT', thoat);
process.on('SIGTERM', thoat);
