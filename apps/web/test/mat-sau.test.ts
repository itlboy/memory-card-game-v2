import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BANG_MAU_BACK, CARD_BACKS, CARD_BACKS_CU, HOA_TIET_BACK, backForSeed, backVeCu
} from '@mm/engine';

/**
 * MẶT SAU = HOẠ TIẾT × BẢNG MÀU, và MỖI TÊN PHẢI CÓ CSS.
 *
 * Danh sách nằm ở engine (server suy mặt sau từ seed để cả phòng thấy giống
 * nhau), hình nằm ở `styles/card-backs.css`. Hai chỗ khác nhau nên thêm tên mà
 * quên hình là lá bài ra một ô TRẮNG TRƠN — không test nào khác đỏ.
 */
const doc = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');
const css = doc('src/styles/card-backs.css');
const tile = doc('src/components/CardTile.vue');

describe('danh sách mặt sau', () => {
  it('10 hoạ tiết × 7 bảng màu = 70 mặt sau', () => {
    expect(HOA_TIET_BACK.length).toBe(10);
    expect(BANG_MAU_BACK.length).toBe(7);
    expect(CARD_BACKS.length).toBe(70);
    expect(new Set(CARD_BACKS).size, 'id trùng nhau').toBe(70);
  });

  it('id trên dây có dạng `hoạ tiết.bảng màu`', () => {
    for (const id of CARD_BACKS) expect(id).toMatch(/^[a-z-]+\.[a-z]+$/);
  });
});

describe('mỗi tên có CSS', () => {
  for (const ht of HOA_TIET_BACK) {
    it(`hoạ tiết "${ht}" có mặt nạ`, () => {
      const i = css.indexOf(`.back.bk-ht-${ht} {`);
      expect(i, 'thiếu CSS thì mặt sau ra ô trắng trơn').toBeGreaterThan(-1);
      const khoi = css.slice(i, css.indexOf('}', i));
      expect(khoi, 'hoạ tiết phải là mặt nạ SVG').toContain('--bk-ht:');
      expect(khoi).toContain('data:image/svg+xml');
      // Cùng khuôn cho MỌI hoạ tiết: hình phải đứng đúng chỗ ở mọi cỡ thẻ.
      expect(khoi, 'khuôn SVG phải là 100×133').toContain('viewBox%3D%220%200%20100%20133%22');
    });
  }

  for (const mau of BANG_MAU_BACK) {
    it(`bảng màu "${mau}" có ba mốc gradient`, () => {
      const i = css.indexOf(`.back.bk-mau-${mau} {`);
      expect(i, 'thiếu CSS thì lá bài không có màu').toBeGreaterThan(-1);
      const khoi = css.slice(i, css.indexOf('}', i));
      for (const bien of ['--bk-1', '--bk-2', '--bk-3']) expect(khoi).toContain(bien);
    });
  }

  it('gradient dùng CHUNG một góc cho cả bảy bảng', () => {
    // Khác góc là bàn nào ra hướng sáng nào, nhìn không thành một bộ.
    expect(css.match(/linear-gradient\(162deg/g)?.length).toBe(1);
  });

  it('mực trắng cho CẢ BẢY bảng — không còn ngoại lệ', () => {
    const i = css.indexOf('.back::before {');
    const khoi = css.slice(i, css.indexOf('}', i));
    expect(khoi).toMatch(/background: rgba\(255, 255, 255/);
    expect(css, 'mực đậm riêng cho một bảng là bảng đó nhìn lạc hẳn')
      .not.toMatch(/bk-mau-\w+\s*\{[^}]*--bk-muc/);
  });

  it('KHÔNG có selector `.back` trần — `back` cũng là class của nút quay lại', () => {
    /*
     * Lỗi đã xảy ra thật: `.back::before` dính luôn `<button class="btn back">`
     * (nút quay lại), `--bk-ht` không có giá trị nên mask thành không hợp lệ và
     * cái ::before hoá một TẤM TRẮNG phủ kín panel — chữ mờ hết, ô nào hover
     * thì hiện rõ trở lại.
     */
    const trần = css.match(/(^|[\s,{}])\.back\b(?!\.)/gm) ?? [];
    expect(trần, 'phải viết `.face.back`, không được `.back` trần').toEqual([]);
    // Và mọi khối hoạ tiết / bảng màu cũng phải có `.face`
    expect(css.match(/\.bk-ht-/g)?.length).toBe(HOA_TIET_BACK.length);
    for (const m of css.match(/[^\s,{]*\.bk-(ht|mau)-[a-z-]+/g) ?? []) {
      expect(m, `selector ${m} thiếu .face`).toContain('.face.back');
    }
  });

  it('`--bk-ht` có mặc định là SVG RỖNG, nên khớp oan cũng không vẽ gì', () => {
    const i = css.indexOf(':root {');
    expect(i, 'thiếu mặc định thì một selector khớp oan là phủ trắng cả panel')
      .toBeGreaterThan(-1);
    const khoi = css.slice(i, css.indexOf('}', i));
    expect(khoi).toContain('--bk-ht:');
    // Rỗng thật: không có path/rect/circle nào bên trong
    expect(khoi).not.toMatch(/%3Cpath|%3Crect|%3Ccircle/);
  });

  it('hoạ tiết ở ::before, KHÔNG phải ::after', () => {
    // `::after` của .back đã là vệt sáng lướt ngang lúc hover — dùng trùng là
    // một trong hai biến mất.
    expect(css).toContain('.face.back::before');
    expect(css).not.toContain('.back::after');
    expect(tile, 'vệt sáng hover vẫn phải ở ::after').toContain('.back::after');
  });
});

describe('hoạ tiết PHẢI VẼ ĐƯỢC THẬT', () => {
  /*
   * Đây là lỗi vừa xảy ra: script sinh CSS encode `#` HAI LẦN (`%2523fff`), nên
   * SVG nhận màu `"%23fff"` — không hợp lệ. `stroke` không hợp lệ thì KHÔNG VẼ
   * GÌ, còn `fill` không hợp lệ thì rơi về đen (mà mặt nạ chỉ đọc alpha nên vẫn
   * hiện). Kết quả: 7 trong 10 hoạ tiết biến mất im lặng, Xoáy ốc chỉ còn đúng
   * cái chấm giữa, và không test nào đỏ. Người chơi báo "thẻ không có hoạ tiết".
   */
  const uris = [...css.matchAll(/\.face\.back\.bk-ht-([a-z-]+) \{ --bk-ht: url\("([^"]+)"\)/g)]
    .map(([, ten, uri]) => [ten, decodeURIComponent(uri)] as const);

  it('lấy được URI của cả 10 hoạ tiết', () => {
    expect(uris.map(([t]) => t).sort()).toEqual([...HOA_TIET_BACK].sort());
  });

  for (const ht of HOA_TIET_BACK) {
    it(`"${ht}": màu giải mã ra ĐÚNG #fff, và có nét để vẽ`, () => {
      const svg = uris.find(([t]) => t === ht)![1];
      // Sau khi giải mã một lần phải ra `#fff`. Nếu còn `%23` là đã encode hai lần.
      expect(svg, 'encode hai lần → màu không hợp lệ → hoạ tiết biến mất')
        .not.toMatch(/%23/);
      expect(svg).toMatch(/#fff/);
      // Có ít nhất một lệnh vẽ thật, không phải SVG rỗng.
      expect(svg).toMatch(/<(path|circle|rect|line|ellipse|g)\b/);
      // `stroke` mà không có `stroke-width` thì nét mảnh 1px, mất ở thẻ 34px.
      if (svg.includes('stroke="#fff"')) expect(svg).toMatch(/stroke-width="([2-9]|\d\d)/);
    });
  }

  /*
   * HOẠ TIẾT CHẠY RA MÉP PHẢI CÓ `preserveAspectRatio="none"`.
   *
   * Thẻ trên bàn tỉ lệ ~0,58 còn khuôn SVG là 100/133 = 0,7519, nên SVG mặc
   * định (giữ tỉ lệ, kiểu `meet`) bị letterbox — đo được 37,5px trống chia đôi
   * trên/dưới. Với hoạ tiết vẽ tới mép thì dải đó thành một VẠCH MÀU trơ ra ở
   * đáy lá, đúng điều người chơi báo. Hoạ tiết nằm giữa lá thì KHÔNG cần, vì
   * kéo giãn chỉ làm hình méo.
   */
  const RA_MEP = ['cuc-quang', 'thoi', 'khung'];
  for (const ht of RA_MEP) {
    it(`"${ht}" vẽ tới mép nên phải kéo giãn theo ô`, () => {
      const svg = uris.find(([t]) => t === ht)![1];
      expect(svg, 'thiếu là có một vạch màu trơ ra ở đáy lá')
        .toContain('preserveAspectRatio="none"');
    });
  }

  it('hoạ tiết nằm GIỮA lá thì không kéo giãn (giữ hình không méo)', () => {
    for (const [ten, svg] of uris) {
      if (RA_MEP.includes(ten)) continue;
      expect(svg, `${ten} bị kéo giãn oan — hình tròn sẽ thành bầu dục`)
        .not.toContain('preserveAspectRatio');
    }
  });

  it('tham chiếu nội bộ (`url(#id)`) cũng phải encode một lần', () => {
    // Kim cương dùng `<pattern id="dm">` + `fill="url(#dm)"`; encode hai lần là
    // mất cả nền lưới, chỉ còn hình thoi giữa.
    const thoi = uris.find(([t]) => t === 'thoi')![1];
    if (thoi.includes('<pattern')) expect(thoi).toMatch(/url\(#dm\)/);
  });
});

describe('bốc mặt sau theo seed', () => {
  it('chỉ trả id trong danh sách, và tất định', () => {
    for (let seed = 0; seed < 500; seed++) {
      expect(CARD_BACKS).toContain(backForSeed(seed));
      expect(backForSeed(seed)).toBe(backForSeed(seed));
    }
  });

  it('mọi hoạ tiết VÀ mọi bảng màu đều bốc được ra', () => {
    const ht = new Set<string>();
    const mau = new Set<string>();
    for (let seed = 0; seed < 5000; seed++) {
      const [a, b] = backForSeed(seed).split('.');
      ht.add(a!); mau.add(b!);
    }
    expect(ht.size, 'có hoạ tiết không bao giờ xuất hiện').toBe(HOA_TIET_BACK.length);
    expect(mau.size, 'có bảng màu không bao giờ xuất hiện').toBe(BANG_MAU_BACK.length);
  });

  it('hai chiều KHÔNG dính nhau', () => {
    // Băm một lần rồi `% 70` thì cùng một hoạ tiết luôn kéo theo đúng một bảng
    // màu ở những seed cách nhau bội số của 10 — mất gần hết sự đa dạng.
    const theoHt = new Map<string, Set<string>>();
    for (let seed = 0; seed < 3000; seed++) {
      const [a, b] = backForSeed(seed).split('.');
      (theoHt.get(a!) ?? theoHt.set(a!, new Set()).get(a!)!).add(b!);
    }
    for (const [ht, maus] of theoHt) {
      expect(maus.size, `hoạ tiết ${ht} chỉ đi với ${maus.size} bảng màu`)
        .toBe(BANG_MAU_BACK.length);
    }
  });
});

describe('tương thích client cũ', () => {
  it('mọi id mới hạ được về một trong sáu tên cũ', () => {
    for (const id of CARD_BACKS) expect(CARD_BACKS_CU).toContain(backVeCu(id));
  });

  it('tên cũ đi qua `backVeCu` thì giữ nguyên (gọi nhiều lần vẫn đúng)', () => {
    for (const cu of CARD_BACKS_CU) expect(backVeCu(cu)).toBe(cu);
  });

  it('id lạ hoặc rỗng cũng ra một tên HỢP LỆ, không ra rỗng', () => {
    for (const rac of ['', 'khong-co', 'a.b.c', '.tim']) {
      expect(CARD_BACKS_CU).toContain(backVeCu(rac));
    }
  });

  it('client mới KHAI `?bv=2` — server không tự quyết', () => {
    const online = doc('src/composables/useOnlineRoom.ts');
    expect(online, "thiếu khai là client cũ nhận id mới và mặt sau ra ô trắng")
      .toMatch(/params\.set\('bv', '2'\)/);
  });

  it('CardTile dịch được cả sáu tên cũ sang hoạ tiết + bảng màu', () => {
    for (const cu of CARD_BACKS_CU) expect(tile).toContain(`${cu}:`);
    // Và id lạ phải có đường lui, không để lớp rỗng `bk-ht-`
    expect(tile).toMatch(/bk-ht-\$\{ht \|\| 'sao'\}/);
    expect(tile).toMatch(/bk-mau-\$\{mau \|\| 'tim'\}/);
  });
});
