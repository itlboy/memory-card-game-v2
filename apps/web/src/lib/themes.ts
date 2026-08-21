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

/** Nội dung thẻ nằm ở data/themes.json — thêm theme mới không cần sửa code. */
export async function loadThemes(): Promise<CardTheme[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/themes.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { themes?: CardTheme[] };
    if (data.themes?.length) return data.themes;
  } catch {
    /* dùng bản dự phòng */
  }
  return FALLBACK;
}
