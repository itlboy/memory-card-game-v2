/**
 * "CÓ GÌ MỚI" của bản App Store đang nộp (Apple BẮT BUỘC với mọi bản cập nhật). Sửa ở đây mỗi lần
 * ra bản store mới; khoá theo mã ảnh (`anh` trong NGON_NGU của asc-store.mjs). Google Play dùng CÙNG
 * nội dung làm ghi chú phát hành khi đưa build lên production (tools/play-track.mjs).
 * Bản 1.10.42 (26.11.2026, bản native có lớp thanh toán RevenueCat CHƯA bật + xin đánh giá): nhạc phối khí đổi theo lượt + tự đổi
 * bài, câu chat mới + bong bóng trong suốt, giữ màn hình sáng, âm thanh khi quay lại app, cập nhật mở lại đúng trang. KHÔNG ghi Premium
 * (còn sau cửa debug).
 * Bản 1.9.66 (25.11.2026): hồ sơ người chơi (tên + 93 avatar + màu), Chỉ số trí nhớ (5 chặng, bậc Đồng→Kim cương), Luyện ngay,
 * Cài đặt trong menu + nút cập nhật, bảng xếp hạng hiện tên/hình đã chọn.
 * Bản 1.8.27 (19.11.2026): chuông báo phòng (push), xem trận, phòng chờ/màn cuối mới, ảnh chia sẻ có tỷ số.
 * Bản 1.8.16 (17.11.2026, thay lượt 1.8.15 đang chờ duyệt): thêm Đấu máy một trang + iPhone Duo / bàn tự xoay.
 * Bản 1.8.15 (17.11.2026): thay đổi từ 1.8.1 (bản công khai iOS trước; 1.8.8 rút khỏi hàng duyệt để
 * nộp bản này) — bảng kết quả mới, mặt thú ngẫu nhiên, tự cập nhật + hiệu ứng xong, màn Chơi nhanh.
 * Google Play giới hạn 500 ký tự mỗi ngôn ngữ.
 */
export const MOI = {
  vi: "• Nhạc nền phong phú hơn: mỗi bài đổi cách phối theo từng lượt và tự đổi bài sau khoảng 30 phút\n• Chat trong ván: thêm câu nói nhanh, bong bóng chat trong suốt để không che lá bài\n• Màn hình không tự tắt khi bạn đang chơi hoặc xem ván\n• Quay lại app là có âm thanh ngay, cập nhật xong mở lại đúng trang đang xem\n• Màn Chơi online gọn hơn cùng nhiều sửa lỗi nhỏ",
  en: "• Richer music: each track changes its arrangement as it plays and switches about every 30 minutes\n• In-game chat: more quick phrases, and see-through chat bubbles that don't cover the cards\n• The screen stays on while you play or watch a game\n• Sound comes back right away when you return, and updates reopen the page you were on\n• A tidier Play online screen and many small fixes",
  es: "• Música más variada: cada pista cambia de arreglo mientras suena y cambia de canción cada 30 minutos aprox.\n• Chat en partida: más frases rápidas y burbujas transparentes que no tapan las cartas\n• La pantalla no se apaga mientras juegas o ves una partida\n• El sonido vuelve al instante al regresar, y tras actualizar se abre la misma página\n• Pantalla en línea más ordenada y muchos arreglos pequeños",
  pt: "• Música mais variada: cada faixa muda o arranjo enquanto toca e troca a cada 30 minutos aprox.\n• Chat na partida: mais frases rápidas e balões transparentes que não cobrem as cartas\n• A tela não apaga enquanto você joga ou assiste a uma partida\n• O som volta na hora ao retornar, e após atualizar abre a mesma página\n• Tela online mais organizada e várias pequenas correções",
  fr: "• Musique plus riche : chaque morceau change d'arrangement en jouant et change toutes les 30 minutes environ\n• Chat en partie : plus de phrases rapides et des bulles transparentes qui ne cachent pas les cartes\n• L'écran reste allumé pendant que tu joues ou regardes une partie\n• Le son revient tout de suite à ton retour, et après une mise à jour la même page se rouvre\n• Écran en ligne plus clair et beaucoup de petites corrections",
  de: "• Abwechslungsreichere Musik: Jeder Titel ändert beim Spielen sein Arrangement und wechselt etwa alle 30 Minuten\n• Chat im Spiel: mehr Schnellsätze und durchsichtige Sprechblasen, die keine Karten verdecken\n• Der Bildschirm bleibt an, während du spielst oder zuschaust\n• Ton ist nach der Rückkehr sofort da, nach Updates öffnet sich dieselbe Seite\n• Aufgeräumter Online-Bildschirm und viele kleine Fehlerbehebungen",
  ja: "• BGMがもっと多彩に：曲の途中で編曲が変わり、約30分ごとに曲が切り替わります\n• 対戦中のチャット：クイックフレーズを追加、カードを隠さない半透明の吹き出し\n• プレイ中や観戦中は画面が消えません\n• アプリに戻るとすぐに音が鳴り、更新後は見ていたページに戻ります\n• オンライン画面をすっきり整理、その他細かな修正",
  ko: "• 더 다채로운 배경 음악: 곡이 흐르며 편곡이 바뀌고 약 30분마다 다른 곡으로 바뀌어요\n• 게임 중 채팅: 빠른 문구 추가, 카드를 가리지 않는 반투명 말풍선\n• 게임을 하거나 관전하는 동안 화면이 꺼지지 않아요\n• 앱으로 돌아오면 바로 소리가 나고, 업데이트 후 보던 화면이 다시 열려요\n• 더 깔끔해진 온라인 화면과 여러 작은 수정",
  zh: "• 背景音乐更丰富：每首曲子边播放边变换编曲，约每 30 分钟换一首\n• 对局聊天：新增快捷短语，半透明气泡不再遮挡卡片\n• 游戏或观战时屏幕不会自动熄灭\n• 回到应用立即有声音，更新后重新打开原来的页面\n• 在线界面更简洁，并修复了许多小问题",
  ru: "• Музыка разнообразнее: аранжировка меняется по ходу трека, а сам трек — примерно каждые 30 минут\n• Чат в игре: больше быстрых фраз и полупрозрачные облачка, которые не закрывают карты\n• Экран не гаснет, пока вы играете или смотрите партию\n• Звук сразу возвращается при входе в приложение, после обновления открывается та же страница\n• Более аккуратный онлайн-экран и много мелких исправлений",
  id: "• Musik lebih beragam: aransemen berubah selama lagu diputar dan lagu berganti sekitar tiap 30 menit\n• Chat dalam permainan: lebih banyak frasa cepat dan gelembung transparan yang tidak menutupi kartu\n• Layar tidak mati saat kamu bermain atau menonton\n• Suara langsung kembali saat membuka aplikasi lagi, setelah pembaruan halaman yang sama terbuka\n• Layar online lebih rapi dan banyak perbaikan kecil",
  th: "• เพลงพื้นหลังหลากหลายขึ้น: เปลี่ยนการเรียบเรียงระหว่างเล่น และเปลี่ยนเพลงทุกราว 30 นาที\n• แชตในเกม: เพิ่มประโยคด่วน และฟองแชตโปร่งใสไม่บังไพ่\n• หน้าจอไม่ดับระหว่างเล่นหรือดูเกม\n• กลับเข้าแอปแล้วมีเสียงทันที อัปเดตเสร็จเปิดหน้าเดิมให้\n• หน้าจอออนไลน์เรียบร้อยขึ้น และแก้ไขเล็กน้อยอีกมาก",
  it: "• Musica più varia: ogni brano cambia arrangiamento mentre suona e cambia brano ogni 30 minuti circa\n• Chat in partita: più frasi rapide e fumetti trasparenti che non coprono le carte\n• Lo schermo resta acceso mentre giochi o guardi una partita\n• Il suono torna subito al rientro, e dopo un aggiornamento si riapre la stessa pagina\n• Schermata online più ordinata e tante piccole correzioni",
  tr: "• Daha zengin müzik: parça çalarken düzenlemesi değişir ve yaklaşık 30 dakikada bir parça değişir\n• Oyun içi sohbet: daha fazla hızlı ifade ve kartları kapatmayan yarı saydam baloncuklar\n• Oynarken ya da izlerken ekran kapanmaz\n• Uygulamaya dönünce ses hemen gelir, güncellemeden sonra aynı sayfa açılır\n• Daha düzenli çevrim içi ekran ve birçok küçük düzeltme",
  "zh-TW": "• 背景音樂更豐富：每首曲子邊播放邊變換編曲，約每 30 分鐘換一首\n• 對局聊天：新增快捷短語，半透明對話泡泡不再遮住卡片\n• 遊戲或觀戰時螢幕不會自動關閉\n• 回到 App 立刻有聲音，更新後重新開啟原本的頁面\n• 線上畫面更簡潔，並修正許多小問題",
};
