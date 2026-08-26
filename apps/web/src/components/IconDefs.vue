<script setup lang="ts">
/**
 * Kho hình + gradient cho <OptionIcon>. Mount ĐÚNG MỘT LẦN ở App.vue.
 *
 * Vì sao gom về một chỗ: id của <linearGradient> là toàn cục trong tài liệu.
 * Để mỗi icon tự mang <defs> riêng thì mọi bản sao dùng chung id, trình duyệt
 * lấy cái xuất hiện đầu tiên, và cả bàn ra đúng một màu — lỗi im lặng, chỉ nhìn
 * mới thấy.
 *
 * Tiền tố `mmi-` để không đụng id nào khác trong trang (ResultDialog cũng có
 * một gradient tên mmStarBig).
 */
</script>

<template>
  <svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
    <defs>
      <linearGradient id="mmg-time" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f59e0b" /><stop offset="1" stop-color="#ff7b45" />
      </linearGradient>
      <linearGradient id="mmg-lives" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ef4458" /><stop offset="1" stop-color="#ff5fa2" />
      </linearGradient>
      <linearGradient id="mmg-peek" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#12a696" /><stop offset="1" stop-color="#22d3ee" />
      </linearGradient>
      <linearGradient id="mmg-shuffle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6a5cff" /><stop offset="1" stop-color="#a855f7" />
      </linearGradient>
      <linearGradient id="mmg-special" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4c7dff" /><stop offset="1" stop-color="#5fb0ff" />
      </linearGradient>
      <linearGradient id="mmg-swap" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8b5cf6" /><stop offset="1" stop-color="#c44cf0" />
      </linearGradient>
      <linearGradient id="mmg-x2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f7c948" /><stop offset="1" stop-color="#f59e0b" />
      </linearGradient>
      <linearGradient id="mmg-eye" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6366f1" /><stop offset="1" stop-color="#818cf8" />
      </linearGradient>
      <linearGradient id="mmg-freeze" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#38bdf8" /><stop offset="1" stop-color="#a5f3fc" />
      </linearGradient>
      <linearGradient id="mmg-campaign" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6a5cff" /><stop offset="1" stop-color="#8b5cf6" />
      </linearGradient>

      <!-- ── Tuỳ chọn bàn chơi ── -->
      <symbol id="mmi-time" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="12" fill="url(#mmg-time)" />
        <circle cx="20" cy="20.5" r="10.5" fill="none" stroke="#fff" stroke-width="2.6" opacity=".95" />
        <path d="M20 14v7l4.6 2.8" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
      </symbol>
      <symbol id="mmi-lives" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="12" fill="url(#mmg-lives)" />
        <path d="M20 30.2s-9.4-5.6-9.4-12.1a5.3 5.3 0 0 1 9.4-3.4 5.3 5.3 0 0 1 9.4 3.4c0 6.5-9.4 12.1-9.4 12.1Z" fill="#fff" />
      </symbol>
      <symbol id="mmi-peek" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="12" fill="url(#mmg-peek)" />
        <path d="M8.5 20.5S13 13.4 20 13.4s11.5 7.1 11.5 7.1S27 27.6 20 27.6 8.5 20.5 8.5 20.5Z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" />
        <circle cx="20" cy="20.5" r="3.9" fill="#fff" />
      </symbol>
      <symbol id="mmi-shuffle" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="12" fill="url(#mmg-shuffle)" />
        <path d="M10 14h5.2c2 0 3.2 1.1 4.4 2.9l3.4 5.4c1.2 1.8 2.4 2.9 4.4 2.9H30" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
        <path d="M10 25.2h5.2c2 0 3.2-1.1 4.4-2.9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
        <path d="M23.6 15.1 27 14l-1.2 3.4M23.6 27.4 27 26.3l-1.2-3.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
      </symbol>
      <symbol id="mmi-special" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="12" fill="url(#mmg-special)" />
        <path d="M18.6 9.6c.4-1.2 2.1-1.2 2.5 0l1.7 5a3 3 0 0 0 1.9 1.9l5 1.7c1.2.4 1.2 2.1 0 2.5l-5 1.7a3 3 0 0 0-1.9 1.9l-1.7 5c-.4 1.2-2.1 1.2-2.5 0l-1.7-5a3 3 0 0 0-1.9-1.9l-5-1.7c-1.2-.4-1.2-2.1 0-2.5l5-1.7a3 3 0 0 0 1.9-1.9Z" fill="#fff" />
        <circle cx="30.4" cy="11.2" r="2.3" fill="#fff" opacity=".9" />
      </symbol>

      <!-- ── Thẻ đặc biệt ── -->
      <symbol id="mmi-swap" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="12" fill="url(#mmg-swap)" />
        <rect x="9" y="11.5" width="9.5" height="13" rx="2.6" fill="#fff" opacity=".95" />
        <rect x="21.5" y="15.5" width="9.5" height="13" rx="2.6" fill="#fff" opacity=".95" />
        <path d="M15.5 30.5h9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" />
      </symbol>
      <symbol id="mmi-x2" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="12" fill="url(#mmg-x2)" />
        <text
          x="20" y="27" text-anchor="middle" fill="#fff"
          font-family="'Baloo 2', sans-serif" font-weight="800" font-size="19"
        >×2</text>
      </symbol>
      <symbol id="mmi-eye" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="12" fill="url(#mmg-eye)" />
        <path d="M9 21S13.2 14.6 20 14.6 31 21 31 21s-4.2 6.4-11 6.4S9 21 9 21Z" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" />
        <circle cx="20" cy="21" r="3.6" fill="#fff" />
        <path d="M29.4 9.2l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9Z" fill="#fff" />
      </symbol>
      <symbol id="mmi-freeze" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="12" fill="url(#mmg-freeze)" />
        <g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round">
          <path d="M20 9.5v21M11 14.7l18 10.6M29 14.7 11 25.3" />
          <path d="M17 12.2 20 14l3-1.8M17 27.8 20 26l3 1.8" />
        </g>
      </symbol>
      <symbol id="mmi-campaign" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="12" fill="url(#mmg-campaign)" />
        <path d="M10 13.4 16.4 11l7.2 2.6L30 11v16l-6.4 2.4-7.2-2.6L10 29.4Z" fill="#fff" opacity=".95" />
        <path d="M16.4 11v18.4M23.6 13.6V30" fill="none" stroke="#8b5cf6" stroke-width="1.9" />
      </symbol>
    </defs>
  </svg>
</template>
