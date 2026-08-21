// Theme thẻ nạp từ data/themes.json (thêm theme mới không cần sửa code).
// Có bản dự phòng nội tuyến để chạy được cả khi mở bằng file://
const FALLBACK_THEMES = [
  { id: 'animals', name: 'Động vật',
    symbols: ['🐶','🐱','🦊','🐻','🐼','🐨','🦁','🐯','🐵','🐷','🐸','🐧','🦉','🦋','🐢','🐬','🦄','🐔'] },
  { id: 'fruits', name: 'Trái cây',
    symbols: ['🍎','🍌','🍇','🍓','🍒','🍑','🍍','🥝','🥑','🍉','🍋','🥕','🌽','🍆','🥔','🫐','🥭','🍐'] }
];

async function loadThemes() {
  try {
    const res = await fetch('data/themes.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (Array.isArray(data.themes) && data.themes.length) return data.themes;
  } catch (_) { /* dùng bản dự phòng */ }
  return FALLBACK_THEMES;
}
