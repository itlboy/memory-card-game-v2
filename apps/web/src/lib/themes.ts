export interface CardTheme {
  id: string;
  name: string;
  /** Mốc điểm mở khoá cũ (mục 3.6) — NAY LUÔN 0: từ 14.10.2026 theme không mở
   *  bằng điểm nữa, chỉ còn miễn phí hoặc premium. Giữ trường để bản app cũ (đóng
   *  gói themes.json riêng nhưng đọc file mới qua mạng) không vỡ kiểu. */
  unlockAt: number;
  /** Theme trả phí — chỉ chơi được khi đã mua gói premium (`lib/premium.ts`). */
  premium?: boolean;
  symbols: string[];
}

/** Theme dự phòng — bảo đảm game chạy được cả khi không tải được JSON (offline). */
const FALLBACK: CardTheme[] = [{
  id: 'animals', name: 'Động vật', unlockAt: 0,
  symbols: ['🐶','🐱','🦊','🐻','🐼','🐨','🦁','🐯','🐵','🐷','🐸','🐧','🦉','🦋','🐢','🐬','🦄','🐔','🐴','🐝','🐞','🦀','🐙','🦑']
}];

/**
 * Xếp theme MIỄN PHÍ lên trước, premium sau (trước 14.10.2026: theo mốc điểm).
 *
 * Sắp ở đây chứ không dựa vào thứ tự trong file: theme thêm sau luôn nằm cuối
 * file, nên ba theme mở sẵn thêm gần đây hiện ra SAU nhóm còn khoá — người chơi
 * thấy ô sáng, ô mờ rồi lại ô sáng, tưởng ba ô cuối cũng bị khoá. Sắp bằng code
 * thì lần thêm theme sau không dẫm lại vết này.
 *
 * `sort` của JS là ỔN ĐỊNH, nên các theme cùng mốc giữ nguyên thứ tự trong file.
 */
const theoMocMo = (list: CardTheme[]): CardTheme[] =>
  [...list].sort((a, b) => Number(!!a.premium) - Number(!!b.premium));

/** Nội dung thẻ nằm ở data/themes.json — thêm theme mới không cần sửa code. */
export async function loadThemes(): Promise<CardTheme[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/themes.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { themes?: CardTheme[] };
    if (data.themes?.length) return theoMocMo(data.themes);
  } catch {
    /* dùng bản dự phòng */
  }
  return FALLBACK;
}
