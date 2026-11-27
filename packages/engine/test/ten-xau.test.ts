import { describe, expect, it } from 'vitest';
import { TEN_CHE, laTenXau, tenAnToan } from '../src/index.js';

describe('chặn tên bậy (28.11.2026)', () => {
  it('chặn chữ bậy, kể cả viết lách / có dấu / chèn dấu chấm / chữ lặp', () => {
    for (const t of ['Địt mẹ', 'ditme123', 'Đ.M.M', 'dcm', 'VCL', 'con cặc', 'concac', 'cái lồn', 'loz', 'Óc chó', 'FUUUCK', 'f.u.c.k', 'sh1t', 'b1tch', 'Fuck you', 'lồn', 'Lon', 'buoi', 'dit', 'đéo', 'x x x', 'đ m', 'Đ.M', 'đit', 'Dm', 'L.O.N'])
      expect(laTenXau(t), t).toBe(true);
  });
  it('KHÔNG chặn oan tên người thật', () => {
    for (const t of ['Long', 'Hoàng Long', 'Lan', 'Cúc', 'Các bạn', 'Buổi', 'Đi chơi', 'Dick Lee', 'Đức Minh', 'Mai Anh', 'Kiên', 'Nguyễn Minh Anh', 'Bố', 'Na', 'Dogs game', 'Vy', 'Dewi', 'Laura', 'Mia Zoe Miller', 'Tiago Alves', 'Carmen Torres', 'Cassie', 'Assia', 'Dieu', 'Cao', 'Lôc', 'Châu', 'Thảo', 'Đức', 'Đi chơi', 'Đông', 'Adam', 'Edmund', 'Ocho', 'Xuân', 'Cường'])
      expect(laTenXau(t), t).toBe(false);
  });
  it('đủ 15 ngôn ngữ của app — cả chữ không phải Latin', () => {
    for (const t of ['puta madre', 'gilipollas', 'Coño', 'caralho', 'buceta', 'putain', 'enculé', 'Hurensohn', 'Fotze', 'vaffanculo', 'cazzo',
      'хуй', 'Пиздец', 'сука', 'blyat', 'kontol', 'anjing lu', 'siktir', 'orospu çocuğu', 'amk', '操你妈', '傻逼', '幹你娘', '他媽的',
      'ちんこ', 'セックス', '死ね', '씨발', '병 신', '개새끼', 'เหี้ย', 'ควย', 'suka', 's u k a', 'shit', 'bullshit', 'sh1thead', 'nazi', 'fuk'])
      expect(laTenXau(t), t).toBe(true);
    for (const t of ['Sukarno', 'Monique', 'Hamka', 'Сергей', 'Анна', 'Наташа', '王小明', '李华', '陈美玲', '張偉', 'さくら', 'たろう', 'ゆうき',
      '김민준', '이서연', '박지훈', 'สมชาย', 'มาลี', 'Şükrü', 'Ayşe', 'Gökhan', 'Pıçak', 'José', 'Müller', 'François', 'Giuseppe', 'Budi Santoso', 'Siti', 'Hugo', 'Huy', 'Quốc Huy', 'Sophia', 'Amina', 'Fukuda', 'Ishita', 'Nazir', 'Vergara', 'Porras', 'Scott', 'Pietro'])
      expect(laTenXau(t), t).toBe(false);
  });
  it('tenAnToan che tên bậy bằng ***, giữ nguyên tên sạch', () => {
    expect(tenAnToan('dcm')).toBe(TEN_CHE);
    expect(tenAnToan('Hoàng Long')).toBe('Hoàng Long');
  });
});
