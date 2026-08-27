export interface CardTheme {
  id: string;
  name: string;
  /** Điểm tích lũy cần có để mở khoá (mục 3.6). 0 = mở sẵn. */
  unlockAt: number;
  symbols: string[];
}

/** Theme dự phòng — bảo đảm game chạy được cả khi không tải được JSON (offline). */
const FALLBACK: CardTheme[] = [{
  id: 'animals', name: 'Động vật', unlockAt: 0,
  symbols: ['🐶','🐱','🦊','🐻','🐼','🐨','🦁','🐯','🐵','🐷','🐸','🐧','🦉','🦋','🐢','🐬','🦄','🐔','🐴','🐝','🐞','🦀','🐙','🦑']
}];

/**
 * Xếp theme MỞ SẴN lên trước, rồi theo mốc điểm tăng dần.
 *
 * Sắp ở đây chứ không dựa vào thứ tự trong file: theme thêm sau luôn nằm cuối
 * file, nên ba theme mở sẵn thêm gần đây hiện ra SAU nhóm còn khoá — người chơi
 * thấy ô sáng, ô mờ rồi lại ô sáng, tưởng ba ô cuối cũng bị khoá. Sắp bằng code
 * thì lần thêm theme sau không dẫm lại vết này.
 *
 * `sort` của JS là ỔN ĐỊNH, nên các theme cùng mốc giữ nguyên thứ tự trong file.
 */
const theoMocMo = (list: CardTheme[]): CardTheme[] =>
  [...list].sort((a, b) => a.unlockAt - b.unlockAt);

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
