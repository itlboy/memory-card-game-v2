// Nạp ĐỦ 15 từ điển trước mọi test: app nạp theo nhu cầu (lib/i18n.ts napTuDien), còn test đặt
// `ngonNgu.value = 'en'` rồi đọc chữ ngay.
import { ganTuDien, type NgonNgu, type TuDien } from '@/lib/i18n';

const tat = import.meta.glob<{ default: TuDien }>(['../src/locales/*.ts', '!../src/locales/vi.ts'], { eager: true });
for (const [p, m] of Object.entries(tat)) ganTuDien(p.match(/([\w-]+)\.ts$/)![1] as NgonNgu, m.default);
