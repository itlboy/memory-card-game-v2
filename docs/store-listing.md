# Store listing — Flip Match (Lật Thẻ)

Bản chép-dán cho App Store Connect và Google Play Console — 15 ngôn ngữ, ngôn ngữ chính
English (U.S.). `tools/asc-store.mjs` và `tools/play-store.mjs` đọc thẳng file này. Con số
trong mô tả (60 màn, 15 ngôn ngữ, 36 bộ hình…) theo [`ban-do.md`](ban-do.md). Số ký tự đã đếm (giới hạn ghi trong ngoặc);
sửa nội dung thì chạy `python3 tools/dem-ky-tu-store.py` để soát lại.

Đổi luật chơi hay thêm tính năng thì sửa cả file này — cùng lý do với
`RulesDialog.vue` (CLAUDE.md: "Đổi thể thức chơi thì PHẢI cập nhật hướng dẫn").

## Ảnh chụp màn hình

`node tools/chup-store.mjs <url server> <thư mục ra> <en|vi>` chụp 7 cảnh ở khung
iPhone 6.9" (1320×2868 — cỡ App Store bắt buộc; Google Play nhận luôn). Server
phải chạy bản build mới (`pnpm node:dev`) vì cảnh phòng online cần API thật.
Kịch bản ở `tools/chup-store-kichban.mjs`; thêm ngôn ngữ = thêm một dòng `NHAN`.
**Google Play cần bộ riêng**: `KHUNG=android node tools/chup-store.mjs …` ra 1080×1920
— Play từ chối ảnh dài hơn 2:1, mà khung iPhone 6.9" là 2,17:1. Play còn bắt buộc
ảnh bìa (feature graphic) 1024×500 — dựng từ `tools/og/og.html` đổi chữ sang tiếng
Anh — và icon 512×512 (`apps/web/public/icon-512.png`).

## Chung

| Trường | Giá trị |
|---|---|
| Support URL | https://flipmatch.cozypi.com/support.html |
| Marketing URL | https://flipmatch.cozypi.com/about.html (trang công khai của app; trang studio cozypi.com là repo riêng `itlboy/cozypi-site`) |
| Privacy Policy URL | https://flipmatch.cozypi.com/privacy.html |
| Category (Apple) | Games → Primary **Puzzle**, Secondary **Board** |
| Category (Google) | Game → **Puzzle** |
| Copyright | 2026 Cozy Pi |
| Price | Free, no in-app purchases, no ads |

## English (U.S.)

**Name** (30) — App Store
```
Flip Match: Memory Cards
```

**Subtitle** (30) — App Store
```
Memory game with friends & bot
```

**Promotional text** (170) — App Store, sửa được bất cứ lúc nào không cần duyệt
```
Flip cards, match pairs, train your memory. Play solo, take on a 5-level bot, pass the phone around, or open an online room and invite friends with a 6-digit code.
```

**Keywords** (100) — App Store, phẩy không cách, KHÔNG lặp từ đã có trong Name
```
concentration,pairs,match,brain,training,puzzle,card,game,kids,family,multiplayer,online,offline
```

**Short description** (80) — Google Play
```
Flip cards, match pairs, train your memory. Solo, vs bot or online with friends.
```

**Description** (4000) — cả hai store
```
Flip Match is the classic memory card game, rebuilt for quick fun alone or with friends.

Flip two cards. Same picture? It's a match. Different? Remember where they were and try again. Clear the board in as few moves as you can.

PLAY YOUR WAY
• Solo — beat your own best time and move count
• Versus bot — five levels, from Wobbly Chick to Divine Dragon
• Same device — pass the phone around, up to 4 players
• Online rooms — create a room, share the 6-digit code or link, up to 10 players
• Campaign — a 60-level journey where every stage has its own twist

MAKE THE BOARD YOURS
• 12 board sizes, from a 4-card warm-up to a brutal 88-card challenge
• 5 optional rules, each with 4 levels: timer, lives, peek, shuffle and special cards
• 36 card themes: animals, food, flags, numbers and more
• 3 looks to switch anytime: Candy, Wood or Neon

KEEP COMING BACK
• 100+ achievements to unlock
• Records for every board size
• Optional Sign in with Apple or Google to sync progress across devices and climb the leaderboard

MADE TO FEEL GOOD
• Smooth card flips with haptic feedback
• Pause anytime — the clock stops and the board hides until you're back
• Satisfying win effects and sounds
• Works offline — no connection needed for solo, bot or same-device games
• 15 languages
• No ads. No in-app purchases.
```

## Tiếng Việt

**Name** (30)
```
Lật Thẻ: Trò Chơi Trí Nhớ
```

**Subtitle** (30)
```
Lật thẻ ghép cặp cùng bạn bè
```

**Promotional text** (170)
```
Lật thẻ, ghép cặp, rèn trí nhớ. Chơi một mình, đấu máy 5 mức, chuyền máy cho cả nhóm, hoặc mở phòng online và mời bạn bè bằng mã 6 số.
```

**Keywords** (100)
```
lật thẻ,ghép cặp,trí nhớ,trò chơi,giải đố,thẻ bài,trẻ em,gia đình,nhiều người,online,offline
```

**Short description** (80) — Google Play
```
Lật thẻ ghép cặp rèn trí nhớ. Chơi một mình, đấu máy, hoặc online cùng bạn bè.
```

**Description** (4000)
```
Lật Thẻ là trò chơi trí nhớ kinh điển, làm mới để chơi nhanh một mình hay vui cùng bạn bè.

Lật hai lá. Cùng hình? Ghép được! Khác hình? Nhớ vị trí rồi thử lại. Dọn sạch bàn với ít lượt nhất có thể.

CHƠI THEO CÁCH CỦA BẠN
• Một mình — phá kỷ lục thời gian và số lượt của chính mình
• Đấu máy — năm mức, từ Gà Mờ tới Rồng Thần
• Chung một máy — chuyền điện thoại, tối đa 4 người
• Phòng online — tạo phòng, gửi mã 6 số hoặc link, tối đa 10 người
• Chiến dịch — hành trình 60 màn, màn nào cũng có luật riêng

BÀN CHƠI CỦA RIÊNG BẠN
• 12 cỡ bàn, từ 4 thẻ khởi động tới 88 thẻ siêu khó
• 5 luật tuỳ chọn, mỗi luật 4 mức: đồng hồ, số mạng, xem trước, xáo thẻ, thẻ đặc biệt
• 36 bộ hình: con vật, đồ ăn, cờ các nước, chữ số và nhiều nữa
• 3 giao diện đổi tuỳ thích: Kẹo, Gỗ hoặc Neon

MUỐN CHƠI MÃI
• Hơn 100 danh hiệu để chinh phục
• Kỷ lục riêng cho từng cỡ bàn
• Đăng nhập Apple hoặc Google (tuỳ chọn) để đồng bộ giữa các máy và lên bảng xếp hạng

CHƠI LÀ SƯỚNG
• Lật thẻ mượt, có rung phản hồi
• Tạm dừng bất cứ lúc nào — đồng hồ đứng, bàn được che cho tới khi bạn quay lại
• Hiệu ứng và âm thanh thắng ván đã tai đã mắt
• Chơi không cần mạng — một mình, đấu máy, chung máy đều chạy offline
• 15 ngôn ngữ
• Không quảng cáo. Không mua trong app.
```

## Español

**Name** (30)
```
Flip Match: Juego de Memoria
```

**Subtitle** (30)
```
Encuentra parejas con amigos
```

**Promotional text** (170)
```
Voltea cartas, encuentra parejas y entrena tu memoria. Juega solo, reta a un bot de 5 niveles, pasa el móvil o crea una sala online e invita con un código de 6 dígitos.
```

**Keywords** (100)
```
parejas,cartas,concentración,mente,cerebro,puzzle,niños,familia,multijugador,online,sin conexión
```

**Short description** (80) — Google Play
```
Voltea cartas y encuentra parejas. Solo, contra el bot u online con tus amigos.
```

**Description** (4000)
```
Flip Match es el clásico juego de memoria con cartas, renovado para echar una partida rápida solo o con amigos.

Voltea dos cartas. ¿Mismo dibujo? ¡Pareja! ¿Distinto? Recuerda dónde estaban y vuelve a intentarlo. Limpia el tablero con el menor número de movimientos posible.

JUEGA A TU MANERA
• Solo: supera tu mejor tiempo y tu récord de movimientos
• Contra el bot: cinco niveles, del Pollito Torpe al Dragón Divino
• Mismo dispositivo: pasa el móvil, hasta 4 jugadores
• Salas online: crea una sala, comparte el código de 6 dígitos o el enlace, hasta 10 jugadores
• Campaña: un viaje de 60 niveles, cada uno con su propio giro

UN TABLERO A TU MEDIDA
• 12 tamaños de tablero, desde un calentamiento de 4 cartas hasta un desafío brutal de 88
• 5 reglas opcionales con 4 niveles cada una: tiempo, vidas, vistazo, barajar y cartas especiales
• 36 temas de cartas: animales, comida, banderas, números y mucho más
• 3 estilos para cambiar cuando quieras: Dulce, Madera o Neón

SIEMPRE HAY UN MOTIVO PARA VOLVER
• Más de 100 logros por desbloquear
• Récords para cada tamaño de tablero
• Inicia sesión con Apple o Google (opcional) para sincronizar tu progreso entre dispositivos y subir en la clasificación

HECHO PARA DISFRUTAR
• Volteos suaves con respuesta háptica
• Pausa cuando quieras: el reloj se detiene y el tablero se oculta hasta que vuelvas
• Efectos y sonidos de victoria muy satisfactorios
• Funciona sin conexión: no necesitas internet para jugar solo, contra el bot o en el mismo dispositivo
• 15 idiomas
• Sin anuncios. Sin compras dentro de la app.
```

## Português (Brasil)

**Name** (30)
```
Flip Match: Jogo da Memória
```

**Subtitle** (30)
```
Ache os pares com os amigos
```

**Promotional text** (170)
```
Vire cartas, ache os pares e treine a memória. Jogue sozinho, enfrente um bot de 5 níveis, passe o celular ou crie uma sala online com um código de 6 dígitos.
```

**Keywords** (100)
```
pares,cartas,concentração,cérebro,treino,quebra-cabeça,crianças,família,multiplayer,online,offline
```

**Short description** (80) — Google Play
```
Vire cartas, ache os pares e treine a memória. Sozinho, contra o bot ou online.
```

**Description** (4000)
```
Flip Match é o clássico jogo da memória, repaginado para partidas rápidas sozinho ou com os amigos.

Vire duas cartas. Mesma figura? Par formado! Diferentes? Lembre onde estavam e tente de novo. Limpe o tabuleiro com o mínimo de jogadas possível.

JOGUE DO SEU JEITO
• Sozinho — bata seu próprio recorde de tempo e de jogadas
• Contra o bot — cinco níveis, do Pintinho Tonto ao Dragão Divino
• Mesmo aparelho — passe o celular, até 4 jogadores
• Salas online — crie uma sala, compartilhe o código de 6 dígitos ou o link, até 10 jogadores
• Campanha — uma jornada de 60 fases, cada uma com uma regra diferente

UM TABULEIRO DO SEU JEITO
• 12 tamanhos de tabuleiro, de um aquecimento com 4 cartas a um desafio brutal com 88
• 5 regras opcionais, cada uma com 4 níveis: tempo, vidas, espiadinha, embaralhar e cartas especiais
• 36 temas de cartas: animais, comidas, bandeiras, números e muito mais
• 3 visuais para trocar quando quiser: Doce, Madeira ou Néon

SEMPRE TEM MOTIVO PARA VOLTAR
• Mais de 100 conquistas para desbloquear
• Recordes para cada tamanho de tabuleiro
• Entre com Apple ou Google (opcional) para sincronizar o progresso entre aparelhos e subir no ranking

FEITO PARA SER GOSTOSO DE JOGAR
• Cartas que viram suave, com resposta tátil
• Pause quando quiser — o relógio para e o tabuleiro fica escondido até você voltar
• Efeitos e sons de vitória caprichados
• Funciona offline — sem internet para jogar sozinho, contra o bot ou no mesmo aparelho
• 15 idiomas
• Sem anúncios. Sem compras no app.
```

## Français

**Name** (30)
```
Flip Match : Jeu de Mémoire
```

**Subtitle** (30)
```
Trouvez les paires entre amis
```

**Promotional text** (170)
```
Retournez les cartes, trouvez les paires, musclez votre mémoire. En solo, contre un bot à 5 niveaux, en se passant le téléphone ou en ligne avec un code à 6 chiffres.
```

**Keywords** (100)
```
paires,cartes,concentration,cerveau,entraînement,puzzle,enfants,famille,multijoueur,hors ligne
```

**Short description** (80) — Google Play
```
Retournez les cartes, trouvez les paires. En solo, contre le bot ou en ligne.
```

**Description** (4000)
```
Flip Match, c'est le grand classique du jeu de mémoire, remis au goût du jour pour des parties rapides en solo ou entre amis.

Retournez deux cartes. Même image ? C'est une paire ! Images différentes ? Retenez leur place et réessayez. Videz le plateau en un minimum de coups.

JOUEZ COMME VOUS VOULEZ
• Solo — battez votre meilleur temps et votre record de coups
• Contre le bot — cinq niveaux, du Poussin Pataud au Dragon Divin
• Sur le même appareil — passez-vous le téléphone, jusqu'à 4 joueurs
• Salons en ligne — créez un salon, partagez le code à 6 chiffres ou le lien, jusqu'à 10 joueurs
• Campagne — un parcours de 60 niveaux, chacune avec sa propre surprise

UN PLATEAU À VOTRE IMAGE
• 12 tailles de plateau, de l'échauffement à 4 cartes au défi redoutable de 88 cartes
• 5 règles au choix, chacune sur 4 niveaux : chrono, vies, aperçu, mélange et cartes spéciales
• 36 thèmes de cartes : animaux, nourriture, drapeaux, chiffres et bien plus
• 3 styles à changer quand vous voulez : Bonbon, Bois ou Néon

TOUJOURS UNE RAISON DE REVENIR
• Plus de 100 succès à débloquer
• Des records pour chaque taille de plateau
• Connexion avec Apple ou Google (facultative) pour synchroniser votre progression entre appareils et grimper au classement

UN VRAI PLAISIR À JOUER
• Des cartes qui se retournent en douceur, avec retour haptique
• Pause à tout moment — le chrono s'arrête et le plateau se cache jusqu'à votre retour
• Des effets et des sons de victoire jubilatoires
• Fonctionne hors ligne — pas besoin de connexion en solo, contre le bot ou sur le même appareil
• 15 langues
• Sans pub. Sans achats intégrés.
```

## Deutsch

**Name** (30)
```
Flip Match: Gedächtnisspiel
```

**Subtitle** (30)
```
Paare finden mit Freunden
```

**Promotional text** (170)
```
Karten umdrehen, Paare finden, Gedächtnis trainieren. Allein, gegen einen Bot mit 5 Stufen, reihum am selben Handy oder online mit Freunden per 6-stelligem Code.
```

**Keywords** (100)
```
paare,karten,konzentration,gehirnjogging,merkspiel,denkspiel,kinder,familie,mehrspieler,online
```

**Short description** (80) — Google Play
```
Karten umdrehen, Paare finden. Allein, gegen den Bot oder online mit Freunden.
```

**Description** (4000)
```
Flip Match ist das klassische Gedächtnisspiel mit Karten – neu gemacht für schnellen Spaß allein oder mit Freunden.

Dreh zwei Karten um. Gleiches Bild? Ein Paar! Unterschiedlich? Merk dir, wo sie lagen, und versuch es noch einmal. Räum das Spielfeld mit so wenigen Zügen wie möglich ab.

SPIEL, WIE DU WILLST
• Allein – schlag deine eigene Bestzeit und deinen Zugrekord
• Gegen den Bot – fünf Stufen, vom Wackelküken bis zum Götterdrachen
• Am selben Gerät – reich das Handy weiter, bis zu 4 Spieler
• Online-Räume – Raum erstellen, 6-stelligen Code oder Link teilen, bis zu 10 Spieler
• Kampagne – eine Reise über 60 Level, jede mit eigenem Kniff

DEIN SPIELFELD, DEINE REGELN
• 12 Spielfeldgrößen, vom Aufwärmen mit 4 Karten bis zur knallharten Herausforderung mit 88
• 5 optionale Regeln mit je 4 Stufen: Zeit, Leben, Vorschau, Mischen und Spezialkarten
• 36 Kartenthemen: Tiere, Essen, Flaggen, Zahlen und vieles mehr
• 3 Looks zum jederzeit Wechseln: Bonbon, Holz oder Neon

IMMER WIEDER GERN
• Über 100 Erfolge zum Freischalten
• Rekorde für jede Spielfeldgröße
• Optional mit Apple oder Google anmelden, um den Fortschritt geräteübergreifend zu synchronisieren und in der Bestenliste aufzusteigen

EINFACH SCHÖN ZU SPIELEN
• Flüssige Kartenanimationen mit haptischem Feedback
• Jederzeit pausieren – die Uhr stoppt und das Spielfeld bleibt verdeckt, bis du zurück bist
• Befriedigende Sieg-Effekte und Sounds
• Funktioniert offline – allein, gegen den Bot oder am selben Gerät ganz ohne Internet
• 15 Sprachen
• Keine Werbung. Keine In-App-Käufe.
```

## 日本語

**Name** (30)
```
Flip Match: 神経衰弱カードゲーム
```

**Subtitle** (30)
```
友達やCPUと遊べる記憶力ゲーム
```

**Promotional text** (170)
```
カードをめくって同じ絵をそろえよう。ひとりで記録に挑戦、5段階のCPUと対戦、1台をみんなで回して遊ぶ、6桁のコードで友達とオンライン対戦も。
```

**Keywords** (100)
```
記憶力,脳トレ,ペア,絵合わせ,トランプ,パズル,子供,家族,マルチプレイ,オンライン,オフライン,暇つぶし
```

**Short description** (80) — Google Play
```
カードをめくってペアをそろえる記憶力ゲーム。ひとりでも、CPU対戦でも、友達とオンラインでも。
```

**Description** (4000)
```
Flip Match は、おなじみの神経衰弱をひとりでも友達とでもサクッと楽しめるように作り直したカードゲームです。

カードを2枚めくって、同じ絵ならペア成立！ ちがったら場所を覚えてもう一度。できるだけ少ない手数で場をすべて取りきろう。

好きなスタイルで遊べる
• ひとりで ― 自己ベストのタイムと手数に挑戦
• CPU対戦 ― よちよちヒヨコから神龍まで5段階
• 1台でみんなで ― スマホを回して最大4人
• オンラインルーム ― ルームを作って6桁のコードやリンクを送るだけ、最大10人
• キャンペーン ― ステージごとに違うルールが待つ全60ステージの冒険

自分好みの盤面に
• 4枚のウォームアップから88枚の超難関まで、12種類の盤面サイズ
• 5つのオプションルール（各4段階）：制限時間・ライフ・先読み・シャッフル・特殊カード
• 36種類のカードテーマ：動物、食べ物、国旗、数字など
• いつでも切り替えられる3つの見た目：キャンディ・木目・ネオン

何度でも遊びたくなる
• 100以上の実績を解除しよう
• 盤面サイズごとの自己記録
• Apple または Google でサインイン（任意）すれば、機種をまたいで進行を同期してランキングにも参加

気持ちよく遊べる
• なめらかなカードめくりと触覚フィードバック
• いつでも一時停止 ― 時計が止まり、戻るまで盤面は隠れたまま
• 爽快な勝利演出とサウンド
• オフラインOK ― ひとり、CPU対戦、1台でのプレイは通信不要
• 15言語に対応
• 広告なし。アプリ内課金なし。
```

## 한국어

**Name** (30)
```
Flip Match: 카드 짝맞추기 게임
```

**Subtitle** (30)
```
친구, 봇과 함께하는 기억력 게임
```

**Promotional text** (170)
```
카드를 뒤집어 같은 그림을 찾고 기억력을 키우세요. 혼자서, 5단계 봇과 대결, 폰 하나로 다 같이, 또는 6자리 코드로 친구를 초대해 온라인으로 즐겨요.
```

**Keywords** (100)
```
기억력,두뇌,훈련,같은그림찾기,퍼즐,보드게임,어린이,가족,멀티플레이,온라인,오프라인,집중력
```

**Short description** (80) — Google Play
```
카드를 뒤집어 짝을 맞추는 기억력 게임. 혼자, 봇과 대결, 친구와 온라인으로.
```

**Description** (4000)
```
Flip Match는 클래식 카드 짝맞추기 게임을 혼자서도, 친구와도 가볍게 즐길 수 있게 새로 만든 게임입니다.

카드 두 장을 뒤집어 보세요. 같은 그림이면 짝 완성! 다르면 위치를 기억해 두고 다시 도전하세요. 최대한 적은 횟수로 판을 모두 비워 보세요.

원하는 방식으로 플레이
• 혼자서 — 내 최고 기록(시간, 횟수)에 도전
• 봇 대결 — 아장아장 병아리부터 신룡까지 5단계
• 한 기기로 함께 — 폰을 돌려 가며 최대 4명
• 온라인 방 — 방을 만들고 6자리 코드나 링크만 보내면 끝, 최대 10명
• 캠페인 — 스테이지마다 새로운 규칙이 기다리는 60스테이지 여정

나만의 게임판
• 4장짜리 워밍업부터 88장짜리 극악 난이도까지 12가지 판 크기
• 각각 4단계인 5가지 선택 규칙: 시간 제한, 목숨, 미리 보기, 섞기, 특수 카드
• 동물, 음식, 국기, 숫자 등 36가지 카드 테마
• 언제든 바꿀 수 있는 3가지 스킨: 캔디, 나무, 네온

자꾸 생각나는 게임
• 잠금 해제할 수 있는 100개 이상의 업적
• 판 크기별 개인 기록
• Apple 또는 Google 로그인(선택)으로 기기 간 진행 상황 동기화 및 랭킹 도전

손맛이 좋은 게임
• 부드러운 카드 뒤집기와 햅틱 피드백
• 언제든 일시정지 — 시계가 멈추고 돌아올 때까지 판이 가려져요
• 짜릿한 승리 효과와 사운드
• 오프라인 지원 — 혼자, 봇 대결, 한 기기 플레이는 인터넷 없이도 OK
• 15개 언어 지원
• 광고 없음. 인앱 결제 없음.
```

## 简体中文

**Name** (30)
```
Flip Match: 记忆翻牌配对
```

**Subtitle** (30)
```
和好友或电脑一起玩的记忆游戏
```

**Promotional text** (170)
```
翻开卡牌，找出相同的一对，锻炼记忆力。单人挑战、对战5个难度的电脑、一台手机轮流玩，或开个在线房间，用6位房间号邀请好友。
```

**Keywords** (100)
```
找对子,专注力,连连看,找相同,脑力,训练,益智,卡牌,儿童,亲子,家庭,多人,联机,单机,休闲
```

**Short description** (80) — Google Play
```
翻牌找对子，锻炼记忆力。单人、对战电脑，或和好友在线一起玩。
```

**Description** (4000)
```
Flip Match 是经典的翻牌记忆游戏，全新打造，一个人玩或和朋友一起玩都轻松上手。

翻开两张牌。图案相同？配对成功！不同？记住它们的位置，再试一次。用尽可能少的步数清空整个牌桌。

想怎么玩就怎么玩
• 单人 — 挑战自己的最佳用时和最少步数
• 人机对战 — 五个难度，从菜鸟小鸡到神龙
• 同屏多人 — 一台手机轮流玩，最多 4 人
• 在线房间 — 创建房间，分享 6 位房间号或链接，最多 10 人
• 战役 — 60 关的冒险旅程，每一关都有独特玩法

打造你的专属牌桌
• 12 种牌桌尺寸，从 4 张热身到 88 张极限挑战
• 5 种可选规则，每种 4 个等级：限时、生命、预览、洗牌、特殊卡
• 36 套卡牌主题：动物、美食、国旗、数字等等
• 3 种外观随时切换：糖果、木纹或霓虹

越玩越上瘾
• 100 多个成就等你解锁
• 每种牌桌尺寸都有独立纪录
• 可选使用 Apple 或 Google 登录，跨设备同步进度并冲击排行榜

玩起来就是舒服
• 流畅的翻牌动画，配合触感反馈
• 随时暂停 — 时钟停止，牌桌隐藏，等你回来再继续
• 爽快的胜利特效和音效
• 支持离线 — 单人、人机对战和同屏多人都无需联网
• 支持 15 种语言
• 无广告。无内购。
```

## Русский

**Name** (30)
```
Flip Match: Игра на память
```

**Subtitle** (30)
```
Найди пары вместе с друзьями
```

**Promotional text** (170)
```
Переворачивай карточки, находи пары, тренируй память. Играй один, против бота с 5 уровнями, по очереди на одном телефоне или онлайн с друзьями по 6-значному коду.
```

**Keywords** (100)
```
пары,карточки,мемори,внимание,мозг,тренировка,головоломка,дети,семья,мультиплеер,онлайн,офлайн
```

**Short description** (80) — Google Play
```
Переворачивай карточки и находи пары. Один, против бота или онлайн с друзьями.
```

**Description** (4000)
```
Flip Match — классическая игра на память с карточками, обновлённая для быстрых партий в одиночку или с друзьями.

Переверни две карточки. Одинаковые картинки? Пара найдена! Разные? Запомни, где они лежат, и попробуй снова. Очисти поле за как можно меньшее число ходов.

ИГРАЙ ПО-СВОЕМУ
• Один — побей свой лучший результат по времени и ходам
• Против бота — пять уровней, от Цыплёнка до Дракона
• На одном устройстве — передавай телефон по кругу, до 4 игроков
• Онлайн-комнаты — создай комнату, поделись 6-значным кодом или ссылкой, до 10 игроков
• Кампания — путешествие из 60 уровней, и в каждом своя особенность

ПОЛЕ ПОД ТЕБЯ
• 12 размеров поля: от разминки на 4 карточки до суровых 88
• 5 дополнительных правил, у каждого 4 уровня: время, жизни, подсказка, перемешивание и особые карточки
• 36 темы карточек: животные, еда, флаги, цифры и многое другое
• 3 оформления, которые можно сменить в любой момент: Конфета, Дерево или Неон

ХОЧЕТСЯ ВОЗВРАЩАТЬСЯ
• Более 100 достижений
• Рекорды для каждого размера поля
• Вход через Apple или Google (по желанию), чтобы синхронизировать прогресс между устройствами и подниматься в рейтинге

ПРИЯТНО ИГРАТЬ
• Плавный переворот карточек с тактильной отдачей
• Пауза в любой момент — часы останавливаются, а поле скрыто, пока ты не вернёшься
• Эффектные победные анимации и звуки
• Работает без интернета — в одиночку, против бота и на одном устройстве
• 15 языков
• Без рекламы. Без встроенных покупок.
```

## Bahasa Indonesia

**Name** (30)
```
Flip Match: Game Ingatan
```

**Subtitle** (30)
```
Cocokkan kartu bareng teman
```

**Promotional text** (170)
```
Balik kartu, cari pasangannya, latih ingatanmu. Main sendiri, lawan bot 5 level, gantian di satu HP, atau buka room online dan ajak teman pakai kode 6 digit.
```

**Keywords** (100)
```
memori,kartu,pasangan,cocokkan,otak,asah,puzzle,anak,keluarga,multiplayer,online,offline
```

**Short description** (80) — Google Play
```
Balik kartu, cari pasangan, latih ingatan. Main sendiri, lawan bot, atau online.
```

**Description** (4000)
```
Flip Match adalah game ingatan kartu klasik yang dibuat ulang untuk main cepat sendirian atau bareng teman.

Balik dua kartu. Gambarnya sama? Cocok! Beda? Ingat posisinya lalu coba lagi. Bersihkan papan dengan langkah sesedikit mungkin.

MAIN SESUKAMU
• Sendiri — kalahkan rekor waktu dan jumlah langkahmu sendiri
• Lawan bot — lima level, dari Anak Ayam sampai Naga Dewa
• Satu perangkat — gantian pegang HP, sampai 4 pemain
• Room online — buat room, bagikan kode 6 digit atau link, sampai 10 pemain
• Kampanye — petualangan 60 level, tiap tahap punya aturan unik

PAPAN SESUAI SELERAMU
• 12 ukuran papan, dari pemanasan 4 kartu sampai tantangan berat 88 kartu
• 5 aturan opsional, masing-masing 4 level: waktu, nyawa, intip, kocok, dan kartu spesial
• 36 tema kartu: hewan, makanan, bendera, angka, dan banyak lagi
• 3 tampilan yang bisa diganti kapan saja: Permen, Kayu, atau Neon

BIKIN BALIK LAGI
• Lebih dari 100 pencapaian untuk dibuka
• Rekor untuk setiap ukuran papan
• Masuk dengan Apple atau Google (opsional) untuk sinkronkan progres antar perangkat dan naik di papan peringkat

ASYIK DIMAINKAN
• Kartu terbalik mulus dengan getaran haptik
• Jeda kapan saja — waktu berhenti dan papan tertutup sampai kamu kembali
• Efek dan suara kemenangan yang memuaskan
• Bisa offline — main sendiri, lawan bot, atau satu perangkat tanpa internet
• 15 bahasa
• Tanpa iklan. Tanpa pembelian dalam aplikasi.
```

## ไทย

**Name** (30)
```
Flip Match: เกมจับคู่ความจำ
```

**Subtitle** (30)
```
เปิดไพ่จับคู่กับเพื่อนและบอท
```

**Promotional text** (170)
```
เปิดไพ่ จับคู่ภาพเหมือน ฝึกความจำ เล่นคนเดียว ท้าบอท 5 ระดับ ผลัดกันเล่นในเครื่องเดียว หรือเปิดห้องออนไลน์ชวนเพื่อนด้วยรหัส 6 หลัก
```

**Keywords** (100)
```
เปิดไพ่,ฝึกสมอง,จำภาพ,ปริศนา,การ์ด,เด็ก,ครอบครัว,หลายคน,ออนไลน์,ออฟไลน์
```

**Short description** (80) — Google Play
```
เปิดไพ่จับคู่ ฝึกความจำ เล่นคนเดียว ท้าบอท หรือออนไลน์กับเพื่อน
```

**Description** (4000)
```
Flip Match คือเกมเปิดไพ่จับคู่ฝึกความจำสุดคลาสสิก ทำใหม่ให้เล่นสนุกได้ทันทีทั้งคนเดียวและกับเพื่อน

เปิดไพ่สองใบ ภาพเหมือนกัน? จับคู่สำเร็จ! ไม่เหมือน? จำตำแหน่งไว้แล้วลองใหม่ เคลียร์กระดานให้หมดโดยใช้จำนวนตาให้น้อยที่สุด

เล่นแบบที่คุณชอบ
• คนเดียว — ทำลายสถิติเวลาและจำนวนตาของตัวเอง
• ท้าบอท — ห้าระดับ ตั้งแต่ลูกเจี๊ยบไปจนถึงมังกรเทพ
• เครื่องเดียวกัน — ส่งโทรศัพท์ต่อกัน สูงสุด 4 คน
• ห้องออนไลน์ — สร้างห้อง แชร์รหัส 6 หลักหรือลิงก์ สูงสุด 10 คน
• แคมเปญ — การผจญภัย 60 ด่าน แต่ละด่านมีกติกาเฉพาะ

กระดานในแบบของคุณ
• กระดาน 12 ขนาด ตั้งแต่วอร์มอัป 4 ใบไปจนถึงสุดโหด 88 ใบ
• กติกาเสริม 5 แบบ แบบละ 4 ระดับ: จับเวลา ชีวิต แอบดู สับไพ่ และการ์ดพิเศษ
• ธีมการ์ด 36 แบบ: สัตว์ อาหาร ธงชาติ ตัวเลข และอีกมากมาย
• 3 หน้าตาให้สลับได้ทุกเมื่อ: ลูกกวาด ไม้ หรือนีออน

เล่นแล้วอยากกลับมาอีก
• ความสำเร็จให้ปลดล็อกกว่า 100 รายการ
• สถิติแยกสำหรับกระดานทุกขนาด
• ลงชื่อเข้าใช้ด้วย Apple หรือ Google (ไม่บังคับ) เพื่อซิงค์ความคืบหน้าข้ามอุปกรณ์และไต่อันดับ

เล่นแล้วฟิน
• เปิดไพ่ลื่นไหล พร้อมการสั่นตอบสนอง
• หยุดพักได้ทุกเมื่อ — นาฬิกาหยุด และกระดานถูกซ่อนจนกว่าคุณจะกลับมา
• เอฟเฟกต์และเสียงฉลองชัยชนะสุดสะใจ
• เล่นออฟไลน์ได้ — เล่นคนเดียว ท้าบอท หรือเล่นในเครื่องเดียวกันโดยไม่ต้องใช้เน็ต
• รองรับ 15 ภาษา
• ไม่มีโฆษณา ไม่มีการซื้อในแอป
```

## Italiano

**Name** (30) — App Store
```
Flip Match: Gioco di memoria
```

**Subtitle** (30) — App Store
```
Trova le coppie con gli amici
```

**Promotional text** (170) — App Store, sửa được bất cứ lúc nào không cần duyệt
```
Gira le carte, trova le coppie, allena la memoria. Gioca da solo, sfida un bot a 5 livelli, passa il telefono o apri una stanza online e invita con un codice di 6 cifre.
```

**Keywords** (100) — App Store, phẩy không cách, KHÔNG lặp từ đã có trong Name
```
coppie,carte,concentrazione,cervello,allenamento,puzzle,bambini,famiglia,multigiocatore,online
```

**Short description** (80) — Google Play
```
Gira le carte e trova le coppie. Da solo, contro il bot o online con gli amici.
```

**Description** (4000) — cả hai store
```
Flip Match è il classico gioco di memoria con le carte, rinnovato per partite veloci da solo o con gli amici.

Gira due carte. Stesso disegno? È una coppia! Diverse? Ricorda dov'erano e riprova. Svuota il tabellone con meno mosse possibile.

GIOCA COME VUOI
• Da solo: batti il tuo miglior tempo e il tuo record di mosse
• Contro il bot: cinque livelli, dal Pulcino Goffo al Drago Divino
• Stesso dispositivo: passa il telefono, fino a 4 giocatori
• Stanze online: crea una stanza, condividi il codice di 6 cifre o il link, fino a 10 giocatori
• Campagna: un viaggio di 60 livelli, ognuna con la sua sorpresa

UN TABELLONE TUTTO TUO
• 12 dimensioni del tabellone, da un riscaldamento con 4 carte a una sfida tremenda con 88
• 5 regole facoltative, ognuna con 4 livelli: tempo, vite, anteprima, mescolamento e carte speciali
• 36 temi di carte: animali, cibo, bandiere, numeri e tanto altro
• 3 stili da cambiare quando vuoi: Caramella, Legno o Neon

SEMPRE UN MOTIVO PER TORNARE
• Oltre 100 obiettivi da sbloccare
• Record per ogni dimensione del tabellone
• Accesso facoltativo con Apple o Google per sincronizzare i progressi tra i dispositivi e scalare la classifica

FATTO PER FARTI STARE BENE
• Carte che si girano in modo fluido, con feedback aptico
• Pausa quando vuoi: il cronometro si ferma e il tabellone si nasconde finché non torni
• Effetti e suoni di vittoria appaganti
• Funziona offline: niente connessione per le partite da solo, contro il bot o sullo stesso dispositivo
• 15 lingue
• Niente pubblicità. Nessun acquisto in-app.
```

## Türkçe

**Name** (30) — App Store
```
Flip Match: Hafıza Kartları
```

**Subtitle** (30) — App Store
```
Arkadaşlarınla hafıza oyunu
```

**Promotional text** (170) — App Store, sửa được bất cứ lúc nào không cần duyệt
```
Kartları çevir, çiftleri bul, hafızanı çalıştır. Tek başına oyna, 5 seviyeli bota meydan oku, telefonu elden ele dolaştır ya da 6 haneli kodla arkadaşlarını davet et.
```

**Keywords** (100) — App Store, phẩy không cách, KHÔNG lặp từ đã có trong Name
```
eşleştirme,çift,beyin,zeka,bulmaca,dikkat,çocuk,aile,çok oyunculu,çevrimiçi,çevrimdışı,oyun
```

**Short description** (80) — Google Play
```
Kartları çevir, çiftleri bul. Tek başına, bota karşı ya da arkadaşlarınla oyna.
```

**Description** (4000) — cả hai store
```
Flip Match, klasik hafıza kartı oyununun tek başına ya da arkadaşlarla hızlı eğlence için yeniden tasarlanmış hâli.

İki kart çevir. Aynı resim mi? Eşleşme! Farklı mı? Yerlerini aklında tut ve yeniden dene. Tahtayı olabildiğince az hamlede temizle.

İSTEDİĞİN GİBİ OYNA
• Tek başına — kendi en iyi süreni ve hamle sayını geç
• Bota karşı — Sakar Civciv'den İlahi Ejderha'ya beş seviye
• Aynı cihazda — telefonu elden ele dolaştır, en fazla 4 oyuncu
• Çevrim içi odalar — oda kur, 6 haneli kodu ya da bağlantıyı paylaş, en fazla 10 oyuncu
• Kampanya — her aşamanın kendine özgü bir sürprizi olduğu 60 seviyelik bir yolculuk

TAHTAN, KURALLARIN
• 4 kartlık ısınmadan 88 kartlık zorlu bir meydan okumaya kadar 12 tahta boyutu
• Her biri 4 seviyeli 5 isteğe bağlı kural: süre, can, ön izleme, karıştırma ve özel kartlar
• 36 kart teması: hayvanlar, yemekler, bayraklar, sayılar ve daha fazlası
• İstediğin an değiştirebileceğin 3 görünüm: Şeker, Ahşap ya da Neon

HEP GERİ DÖN
• Açılacak 100'den fazla başarım
• Her tahta boyutu için rekorlar
• İlerlemeni cihazlar arasında eşitlemek ve liderlik tablosunda yükselmek için isteğe bağlı Apple ya da Google ile giriş

İÇİNİ ISITAN BİR OYUN
• Dokunsal geri bildirimli akıcı kart çevirme
• İstediğin an duraklat — sen dönene kadar saat durur, tahta gizlenir
• Tatmin edici zafer efektleri ve sesleri
• Çevrim dışı çalışır — tek başına, bota karşı ya da aynı cihazdaki oyunlar için internet gerekmez
• 15 dil
• Reklam yok. Uygulama içi satın alma yok.
```

## 繁體中文

**Name** (30) — App Store
```
Flip Match：記憶翻牌配對
```

**Subtitle** (30) — App Store
```
和好友或電腦一起玩的記憶遊戲
```

**Promotional text** (170) — App Store, sửa được bất cứ lúc nào không cần duyệt
```
翻開卡牌、找出相同的一對，訓練記憶力！可以單人挑戰、對戰 5 種難度的電腦、一支手機輪流玩，或開個線上房間，用 6 位數房號邀請好友。
```

**Keywords** (100) — App Store, phẩy không cách, KHÔNG lặp từ đã có trong Name
```
找相同,專注力,連連看,腦力,訓練,益智,卡牌,兒童,親子,家庭,多人,連線,單機,休閒,桌遊
```

**Short description** (80) — Google Play
```
翻牌找相同，訓練記憶力。單人、對戰電腦，或和好友線上一起玩。
```

**Description** (4000) — cả hai store
```
Flip Match 是經典的記憶翻牌遊戲，全新打造，一個人玩或和朋友一起玩都輕鬆上手。

翻開兩張牌。圖案相同？配對成功！不一樣？記住它們的位置，再試一次。用最少的步數清空整個牌桌。

想怎麼玩就怎麼玩
• 單人 — 挑戰自己的最佳時間和最少步數
• 對戰電腦 — 五種難度，從菜鳥小雞到神龍
• 同一支手機 — 輪流傳手機，最多 4 人
• 線上房間 — 建立房間，分享 6 位數房號或連結，最多 10 人
• 闖關模式 — 60 關的冒險旅程，每一關都有獨特玩法

打造專屬牌桌
• 12 種牌桌大小，從 4 張暖身到 88 張極限挑戰
• 5 種選用規則，各有 4 個等級：計時、生命、預覽、洗牌和特殊牌
• 36 套卡牌主題：動物、美食、國旗、數字等等
• 3 種外觀隨時切換：糖果、木紋或霓虹

越玩越想玩
• 100 多項成就等你解鎖
• 每種牌桌大小都有獨立紀錄
• 可選擇使用 Apple 或 Google 登入，跨裝置同步進度並挑戰排行榜

玩起來就是舒服
• 流暢的翻牌動畫，搭配觸覺回饋
• 隨時暫停 — 時鐘停止、牌桌隱藏，等你回來再繼續
• 爽快的勝利特效和音效
• 支援離線 — 單人、對戰電腦和同一支手機輪流玩都不需要連網
• 支援 15 種語言
• 沒有廣告。沒有 App 內購買。
```

## App Review

Điền vào mục **App Review Information** của phiên bản (`tools/asc-store.mjs`). Số điện
thoại KHÔNG nằm ở đây (repo công khai) — lấy từ secret `ASC_REVIEW_PHONE`.

**First name** (100)
```
Kien
```

**Last name** (100)
```
Nguyen
```

**Email** (100)
```
support@cozypi.com
```

**Notes** (4000)
```
Thank you for reviewing Flip Match.

NO ACCOUNT NEEDED
Every feature can be tested without signing in. No demo account is required.

WHAT TO TRY
- Home screen > "Quick play" > "Solo" > pick a board size > "Next" > "Start". Flip two cards to find matching pairs.
- "Play the computer" plays against a built-in opponent, fully offline.
- During a game, the Pause button (top right) stops the clock and hides the board.
- Menu (top right) > "Style" switches between three visual skins: Candy, Wood and Neon.

ONLINE MULTIPLAYER
- "Play online" > "Create new room" creates a room with a 6-digit code.
- To join from a second device, open "Play online" and enter the code, or open https://flipmatch.cozypi.com in Safari on any device. A second player is needed to start a match.

SIGN IN (OPTIONAL)
- Menu > "Sign in" offers Sign in with Apple. Signing in only syncs scores and achievements across devices.
- Account deletion is available in the app: Menu > Account > "Delete account". It permanently deletes the account and its server data.

OTHER
- No in-app purchases, no ads. Google Analytics measures aggregate usage only (advertising features off, no cross-app tracking).
- Haptics are used for match/miss feedback on supported devices.
- Privacy policy: https://flipmatch.cozypi.com/privacy.html
```

## Phân loại độ tuổi (Apple) / Content rating (Google)

Trả lời "None" cho mọi mục bạo lực, tình dục, cờ bạc, thuốc… Hai mục cần chú ý:
- **User-generated content / Unrestricted web access**: KHÔNG. Chat online chỉ là
  danh sách emoji đóng (ON-08); thứ người chơi tự gõ duy nhất là tên hiển thị.
- **Social media / interacts with others online**: CÓ — phòng online cho người lạ
  vào cùng ván (phòng công khai), có bảng xếp hạng hiện tên.
Kết quả mong đợi: Apple 4+ / 9+, Google PEGI 3 / Everyone. Đặt độ tuổi mục tiêu
(Google, Target audience) là **13+** để không rơi vào chính sách Families.

## App Privacy (Apple) / Data safety (Google)

Khớp với `apps/web/public/privacy.html`:

| Dữ liệu | Thu khi | Gắn danh tính | Mục đích |
|---|---|---|---|
| Email, Name | đăng nhập (tuỳ chọn) | Có | App functionality (tài khoản) |
| User ID (mã Apple/Google) | đăng nhập | Có | App functionality |
| Gameplay content (điểm, kỷ lục, danh hiệu) | đăng nhập | Có | App functionality |
| Other user content (tên hiển thị online) | chơi online | Không | App functionality |
| Device ID (mã ngẫu nhiên do app tạo) | chơi online + Google Analytics | Không | Analytics |
| Product interaction (màn đã xem, ván bắt đầu/kết thúc, chế độ) | luôn (Google Analytics) | Không | Analytics |
| Coarse location (vùng, suy từ IP bởi Google Analytics) | luôn | Không | Analytics |
| Other diagnostic data (phiên bản app, loại máy) | luôn (Google Analytics) | Không | Analytics |

- Có **Google Analytics 4** từ 15.10.2026 (`lib/phan-tich.ts`): tắt Google Signals + quảng cáo,
  không ghép với dữ liệu app/web khác để quảng cáo → theo định nghĩa của Apple vẫn KHÔNG là
  "tracking" → không cần App Tracking Transparency. Bật quảng cáo/Google Signals là phải xét lại.
- **CẦN KHAI LẠI** ở lần nộp kế tiếp: App Privacy (App Store Connect) và Data safety (Play)
  thêm 3 hàng Analytics ở trên — chỉ làm được trên giao diện.
- Dữ liệu mã hoá khi truyền: CÓ. Người dùng xoá được: CÓ (trong app).
