// Real game data, trimmed from the repo (public/data/themes.json, engine presets.ts).
window.MM_DATA = {
  grids: {
    '2x2': [2, 2], '2x3': [2, 3], '3x3': [3, 3], '3x4': [3, 4],
    '4x4': [4, 4], '4x5': [4, 5], '5x5': [5, 5], '5x6': [5, 6],
    '6x6': [6, 6], '6x8': [6, 8], '7x8': [7, 8], '8x8': [8, 8]
  },
  themes: [
    { id: 'animals', name: 'Động vật', unlockAt: 0, symbols: ['🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🦁', '🐯', '🐵', '🐷', '🐸', '🐧'] },
    { id: 'food', name: 'Đồ ăn', unlockAt: 0, symbols: ['🍔', '🍕', '🌭', '🍟', '🍿', '🥪', '🌮', '🌯', '🥗', '🍣', '🍙', '🍤'] },
    { id: 'fruits', name: 'Trái cây', unlockAt: 0, symbols: ['🍎', '🍌', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '🥑', '🍉', '🍋', '🥕'] },
    { id: 'nature', name: 'Thiên nhiên', unlockAt: 0, symbols: ['🌸', '🌻', '🌹', '🌷', '🌵', '🌴', '🍀', '🍁', '🌿', '🍄', '⛰️', '🌋'] },
    { id: 'smileys', name: 'Mặt cười', unlockAt: 0, symbols: ['😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '😘', '😜', '🤪'] },
    { id: 'sports', name: 'Thể thao', unlockAt: 0, symbols: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '⛳'] },
    { id: 'flags', name: 'Cờ quốc gia', unlockAt: 5000, symbols: ['🇻🇳', '🇯🇵', '🇰🇷', '🇺🇸', '🇬🇧', '🇫🇷', '🇩🇪', '🇮🇹', '🇪🇸', '🇧🇷', '🇦🇺', '🇨🇦'] },
    { id: 'ocean', name: 'Đại dương', unlockAt: 8000, symbols: ['🐳', '🐋', '🐬', '🦈', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟'] },
    { id: 'space', name: 'Vũ trụ', unlockAt: 10000, symbols: ['🚀', '🛸', '🪐', '🌍', '🌎', '🌏', '🌕', '☄️', '🌟', '✨', '👽', '🛰️'] },
    { id: 'tech', name: 'Công nghệ', unlockAt: 12000, symbols: ['💻', '🖥️', '⌨️', '🖱️', '📱', '🖨️', '💾', '💿', '🔌', '🔋', '📷', '🎮'] },
    { id: 'vehicles', name: 'Phương tiện', unlockAt: 15000, symbols: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚚', '🚜', '🛵'] },
    { id: 'letters', name: 'Chữ & số', unlockAt: 20000, symbols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M'] }
  ],
  modes: [
    { id: 'campaign', icon: 'map', tone: 'g-violet', name: 'Chiến dịch', desc: 'Đi từ dễ đến khó qua 20 màn · điểm cộng dồn' },
    { id: 'classic', icon: 'brain', tone: 'g-blue', name: 'Cổ điển', desc: 'Thong thả, không giới hạn thời gian' },
    { id: 'time', icon: 'timer', tone: 'g-amber', name: 'Đua thời gian', desc: 'Xong càng nhanh, thưởng càng nhiều' },
    { id: 'survival', icon: 'heart', tone: 'g-red', name: 'Sinh tồn', desc: '5 mạng — lật sai là mất mạng' },
    { id: 'peek', icon: 'eye', tone: 'g-teal', name: 'Chớp nhoáng', desc: 'Nhìn 4 giây, nhớ hết, rồi lật' }
  ],
  // Campaign ladder from packages/engine/src/campaign.ts
  levels: Array.from({ length: 20 }, (_, i) => {
    const ladder = [[2, 2], [3, 3], [3, 4], [4, 4], [4, 5], [5, 6], [6, 6], [6, 8]];
    const [cols, rows] = ladder[Math.min(ladder.length - 1, Math.floor((i * ladder.length) / 20))];
    return { id: i + 1, cols, rows };
  })
};
