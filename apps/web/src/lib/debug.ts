import { ref } from 'vue';

/** Chế độ debug đang bật — App.vue là chủ (ghi), các lib chỉ đọc (vd lib/ten.ts gắn nhãn bot). */
export const dangDebug = ref(false);
