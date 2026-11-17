/**
 * "CÓ GÌ MỚI" của bản App Store đang nộp (Apple BẮT BUỘC với mọi bản cập nhật). Sửa ở đây mỗi lần
 * ra bản store mới; khoá theo mã ảnh (`anh` trong NGON_NGU của asc-store.mjs). Google Play dùng CÙNG
 * nội dung làm ghi chú phát hành khi đưa build lên production (tools/play-track.mjs).
 * Bản 1.8.15 (17.11.2026): thay đổi từ 1.8.1 (bản công khai iOS trước; 1.8.8 rút khỏi hàng duyệt để
 * nộp bản này) — bảng kết quả mới, mặt thú ngẫu nhiên, tự cập nhật + hiệu ứng xong, màn Chơi nhanh.
 * Google Play giới hạn 500 ký tự mỗi ngôn ngữ.
 */
export const MOI = {
  vi: "• Bảng kết quả gọn và dễ nhìn: tỷ số cả loạt nổi bật, xem chi tiết ván khi cần\n• Mỗi bàn chơi một mặt thú ngẫu nhiên\n• App tự cập nhật ở trang chủ, có hiệu ứng báo cập nhật xong và nút “Kiểm tra cập nhật”\n• Chơi nhanh có màn chọn trước khi bắt đầu\n• Sửa lỗi, giao diện mượt hơn",
  en: "• A cleaner, calmer results board: the series score up front, game details when you want them\n• A random animal face for each table\n• The app updates itself on the home screen, with a little “done” animation and a “Check for updates” menu item\n• Quick Play now lets you choose settings before starting\n• Fixes and a smoother interface",
  es: "• Tablero de resultados más limpio: el marcador de la serie primero y los detalles de la partida cuando quieras\n• Una cara de animal al azar en cada mesa\n• La app se actualiza sola en la pantalla de inicio, con una animación al terminar y “Buscar actualizaciones” en el menú\n• Partida rápida ahora te deja elegir la configuración antes de empezar\n• Correcciones e interfaz más fluida",
  pt: "• Quadro de resultados mais limpo: o placar da série em destaque e os detalhes da partida quando quiser\n• Um rosto de animal aleatório em cada mesa\n• O app se atualiza sozinho na tela inicial, com uma animação ao concluir e “Verificar atualizações” no menu\n• Jogo rápido agora permite escolher as opções antes de começar\n• Correções e interface mais fluida",
  fr: "• Tableau des résultats plus clair : le score de la série en grand, le détail de la partie si besoin\n• Un visage d’animal au hasard à chaque table\n• L’app se met à jour seule sur l’écran d’accueil, avec une animation à la fin et « Rechercher des mises à jour » dans le menu\n• Partie rapide : choisissez vos réglages avant de commencer\n• Corrections et interface plus fluide",
  de: "• Übersichtlichere Ergebnistafel: der Serienstand im Mittelpunkt, Spieldetails bei Bedarf\n• Für jeden Tisch ein zufälliges Tiergesicht\n• Die App aktualisiert sich auf dem Startbildschirm, mit kleiner Fertig-Animation und „Nach Updates suchen“ im Menü\n• Schnelles Spiel: Einstellungen vor dem Start wählen\n• Fehlerbehebungen und flüssigere Oberfläche",
  ja: "• 結果画面をすっきり：通算スコアを大きく表示、対局の詳細は必要なときに\n• テーブルごとにランダムな動物の顔\n• ホーム画面でアプリが自動更新、完了アニメーションとメニューの「アップデートを確認」\n• クイックプレイは開始前に設定を選べるように\n• 不具合の修正と操作性の向上",
  ko: "• 결과 화면이 더 깔끔해짐: 시리즈 점수를 크게, 판 상세는 필요할 때\n• 테이블마다 무작위 동물 얼굴\n• 홈 화면에서 앱이 자동 업데이트, 완료 애니메이션과 메뉴의 ‘업데이트 확인’\n• 빠른 게임에서 시작 전에 설정 선택 가능\n• 버그 수정 및 더 부드러운 화면",
  zh: "• 结果面板更简洁：系列比分一目了然，需要时再看本局详情\n• 每桌随机分配动物头像\n• 应用在主页自动更新，完成时有小动画，菜单新增“检查更新”\n• 快速游戏可先选择设置再开始\n• 问题修复，界面更流畅",
  ru: "• Понятнее таблица результатов: счёт серии крупно, подробности партии по желанию\n• Случайная мордочка животного за каждым столом\n• Приложение обновляется само на главном экране, с анимацией по завершении и «Проверить обновления» в меню\n• Быстрая игра: выбор настроек перед началом\n• Исправления и более плавный интерфейс",
  id: "• Papan hasil lebih rapi: skor seri ditonjolkan, detail permainan saat diperlukan\n• Wajah hewan acak di setiap meja\n• Aplikasi memperbarui diri di layar utama, dengan animasi selesai dan menu “Periksa pembaruan”\n• Main cepat kini bisa memilih pengaturan sebelum mulai\n• Perbaikan dan tampilan lebih mulus",
  th: "• หน้าผลการแข่งขันสะอาดตาขึ้น: สกอร์รวมทั้งซีรีส์เด่นชัด ดูรายละเอียดเกมได้เมื่อต้องการ\n• หน้าสัตว์แบบสุ่มในแต่ละโต๊ะ\n• แอปอัปเดตเองที่หน้าแรก มีแอนิเมชันเมื่อเสร็จ และเมนู “ตรวจหาอัปเดต”\n• เล่นด่วนเลือกการตั้งค่าได้ก่อนเริ่ม\n• แก้ไขปัญหาและหน้าตาลื่นไหลขึ้น",
  it: "• Tabellone dei risultati più pulito: il punteggio della serie in primo piano, i dettagli della partita quando servono\n• Un muso di animale a caso per ogni tavolo\n• L’app si aggiorna da sola nella schermata iniziale, con un’animazione a fine aggiornamento e “Cerca aggiornamenti” nel menu\n• Partita rapida: scegli le impostazioni prima di iniziare\n• Correzioni e interfaccia più fluida",
  tr: "• Daha sade sonuç tablosu: seri skoru öne çıkıyor, oyun ayrıntıları istediğinizde\n• Her masada rastgele bir hayvan yüzü\n• Uygulama ana ekranda kendini günceller; bitince küçük bir animasyon ve menüde “Güncellemeleri denetle”\n• Hızlı oyunda başlamadan önce ayarları seçebilirsiniz\n• Hata düzeltmeleri ve daha akıcı arayüz",
  'zh-TW': "• 結果面板更簡潔：系列比分一目了然，需要時再看本局詳情\n• 每桌隨機分配動物頭像\n• App 在主頁自動更新，完成時有小動畫，選單新增「檢查更新」\n• 快速遊戲可先選擇設定再開始\n• 問題修正，介面更流暢"
};
