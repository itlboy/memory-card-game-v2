/**
 * SMOKE HỒ SƠ NGƯỜI CHƠI (25.11.2026): server CÓ MySQL thật (CI) — nâng bảng thêm cột `mat`/`mau`, khách gửi điểm
 * kèm avatar + màu, bảng xếp hạng (mọi lúc + tuần) trả đúng; gửi lại KHÔNG kèm hồ sơ (app cũ) thì giữ nguyên;
 * avatar/màu ngoài danh sách bị bỏ. Đỏ = thoát mã 1.
 *   MM_SERVER=http://127.0.0.1:8093 node tools/smoke-ho-so.mjs
 */
const B = process.env.MM_SERVER ?? 'http://127.0.0.1:8093';
const id = `smokehoso${Date.now()}abcdefghijk`;
const post = async (p, body) => {
  const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${p} → ${r.status} ${await r.text()}`);
  return r.json();
};
const loi = [];
const kiem = (dk, msg) => { if (!dk) loi.push(msg); };

await post('/api/khach', { id, name: 'Smoke Hồ Sơ', totalScore: 900000, wins: 1, matches: 1, mat: '🦒', mau: '#2f8ff0' });
let b = await post('/api/bxh', { khach: id });
const toi = (bang) => [...(bang.top ?? []), ...(bang.cuoi ?? []), bang.toi].find((d) => d && d.toi);
kiem(toi(b)?.mat === '🦒', `mọi lúc: mat = ${toi(b)?.mat}`);
kiem(toi(b)?.mau === '#2f8ff0', `mọi lúc: mau = ${toi(b)?.mau}`);
const tuan = await post('/api/bxh', { khach: id, loai: 'tuan' });
kiem(toi(tuan)?.mat === '🦒' && toi(tuan)?.mau === '#2f8ff0', `tuần: ${JSON.stringify(toi(tuan))}`);

// App cũ gửi điểm không kèm hồ sơ → giữ nguyên
await post('/api/khach', { id, name: 'Smoke Hồ Sơ', totalScore: 900100, wins: 1, matches: 2 });
// Avatar/màu rác → bỏ, giữ nguyên
await post('/api/khach', { id, name: 'Smoke Hồ Sơ', totalScore: 900200, wins: 1, matches: 3, mat: '💩', mau: 'red' });
await new Promise((x) => setTimeout(x, 100));
b = await post('/api/bxh', { khach: id, tu: 20 }).catch(() => null);   // trang (không cache) — chỉ cần không lỗi
b = await post('/api/bxh', { khach: id });
const t2 = toi(b);
kiem(t2?.mat === '🦒' && t2?.mau === '#2f8ff0', `sau khi gửi không hồ sơ / rác: ${JSON.stringify(t2)}`);

// Ẩn dòng smoke khỏi bảng
await post('/api/khach/xoa', { id });
if (loi.length) { console.error('SMOKE HỒ SƠ ĐỎ:\n- ' + loi.join('\n- ')); process.exit(1); }
console.log('smoke hồ sơ: xanh');
