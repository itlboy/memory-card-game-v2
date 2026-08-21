export const clock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const starText = (n: number): string => '★'.repeat(n) + '☆'.repeat(3 - n);
