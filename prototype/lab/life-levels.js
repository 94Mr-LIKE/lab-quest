/* 瘋狂實驗室・生活化學挑戰（老闆 10/20：「生活中的化學檢驗也可以啊，石蕊、廣用檢測清潔用品強弱 哪個對皮膚好? 化妝品、保養品……生活化啊！」）
 * 情境與規則照遊戲設計師 r8 第九節（9.1、9.3）。pH 有出處的寫出處；查不到的標「估計值，需老師確認」。
 * 安全：這兩關都沒有強酸強鹼；說明卡只寫「pH 跟皮膚比較接近」，不寫醫療效果。 */
(function (root) {
  'use strict';
  root.LIFE_LEVELS = [
    {
      id: 'CHEM-L01', no: 1, kind: 'sort', stage: '國小 酸鹼指示劑 INe-Ⅲ-5', diff: 'E2', title: '石蕊家庭大搜查', topic: '用石蕊試紙分酸性、中性、鹼性',
      story: ['家政課要整理家裡帶來的瓶瓶罐罐。', '老師說：先分出酸性、中性、鹼性，貼好標籤才能收進櫃子。', '桌上只有石蕊試紙、一支滴管、一杯清水。'],
      mission: '用滴管取一點樣品，滴在紅色和藍色石蕊試紙上看顏色，再把 8 樣東西拖進「酸性」「中性」「鹼性」三個籃子，全部分對就過關。滴管換樣品前要先在清水杯裡洗乾淨，不然結果會不準。',
      note: '點瓶子＝用滴管吸一點；點中間的試紙盤＝滴在一組新的紅、藍石蕊試紙上；點清水杯＝洗滴管。按住瓶子拖到籃子裡分類，分完按「交件」。',
      samples: [
        { key: 'vinegar', name: '白醋', img: 'vinegar.png', pH: 2.9, cat: 'acid', liquid: '#eef4f7', src: 'FDA 食品 pH 表：2.4～3.4' },
        { key: 'lemon', name: '檸檬汁', img: 'lemon.png', pH: 2.3, cat: 'acid', liquid: '#f7e98a', src: 'FDA 食品 pH 表：2.0～2.6' },
        { key: 'cola', name: '可樂', img: 'cola.png', pH: 2.4, cat: 'acid', liquid: '#5a2a12', src: 'Reddy 2016：2.37' },
        { key: 'milk', name: '牛奶', img: 'milk.png', pH: 6.6, cat: 'neutral', liquid: '#fbfbf5', src: 'FDA 食品 pH 表：6.4～6.8' },
        { key: 'water', name: '純水', img: 'water.png', pH: 7.0, cat: 'neutral', liquid: '#e6f3fb', src: '定義（25 °C）' },
        { key: 'soda', name: '小蘇打水', img: 'soda.png', pH: 8.3, cat: 'base', liquid: '#f2f4f4', src: 'USDA 技術報告：0.1 mol/L 約 8.3' },
        { key: 'handsoap', name: '肥皂水', img: 'handsoap.png', pH: 9.5, cat: 'base', liquid: '#b9eab0', src: 'Tarun 2014：多數肥皂 pH 9～10' },
        { key: 'shampoo', name: '洗髮精', img: 'shampoo.png', pH: 6.5, cat: 'neutral', liquid: '#cdb8f0', src: 'Tarun 2014：多數洗髮精 pH 6～7' }
      ],
      bins: [{ cat: 'acid', name: '酸性' }, { cat: 'neutral', name: '中性（接近中性）' }, { cat: 'base', name: '鹼性' }],
      stars: ['8 樣全部分對', '第一次交件就全對', '換樣品前每次都有洗滴管'],
      win: '標籤全部貼好。老師翻了翻：「連牛奶和洗髮精都放對了，你知道石蕊分不出強弱吧？」',
      fail: '藍色石蕊變紅＝酸性；紅色石蕊變藍＝鹼性；兩張都沒什麼變＝接近中性。石蕊在 pH 4.5～8.3 之間是過渡色，所以牛奶、洗髮精這種接近中性的，兩張都不太會變。',
      learn: '石蕊試紙只能分「酸、鹼」，不能分強弱：pH 4.5 以下藍色石蕊變紅，pH 8.3 以上紅色石蕊變藍，中間是過渡色。白醋、檸檬汁、可樂都是酸性（pH 2～3）；小蘇打水、肥皂水是鹼性；牛奶（6.4～6.8）、洗髮精（多數 6～7）、純水接近中性。想知道誰比較酸，要用廣用試紙或 pH 計。滴管沒洗就換樣品，上一樣東西會混進來：混在一起的那一滴只有一個 pH，試紙只會顯示一種（不準的）顏色；用沾過醋的滴管去吸小蘇打水，會冒泡、互相中和，兩張試紙都不太變，結果就騙了你。',
      src: '白醋、檸檬汁、牛奶：FDA Approximate pH of Foods（2007）；可樂 2.37：Reddy 等 2016, JADA 147(4)；肥皂、洗髮精：Tarun 等 2014, Indian J. Dermatol. 59(5)；小蘇打水約 8.3：USDA AMS 2025 技術報告；石蕊變色範圍 4.5～8.3：pH indicator 一覽表。查詢日 2026-10-20。'
    },
    {
      id: 'CHEM-L02', no: 2, kind: 'skin', stage: '國中 化妝保養品＋酸鹼・Jd-Ⅳ-3', diff: 'E3', title: '洗面乳對皮膚溫和嗎？', topic: '廣用試紙、pH 計：跟皮膚 pH 比一比',
      story: ['好朋友說洗完臉皮膚又乾又緊。', '浴室和廚房找到 5 種會起泡的清潔用品。', '健康皮膚表面是弱酸性（約 pH 4.7～5.9）。幫他找出 pH 最接近皮膚的那一瓶。'],
      mission: '每樣先用水稀釋成 10%，再用廣用試紙或 pH 計量 pH。找出最接近健康皮膚（約 pH 4.7～5.9）的那一瓶，按「選這瓶」再點它。稀釋要用純水；pH 計換樣品前要先洗。',
      note: '① 點一瓶水（純水或自來水）選好要用哪一種 → 點產品，就會稀釋到前面的小杯子。② 點右邊的量具（石蕊試紙、廣用試紙、pH 計）選好 → 點小杯子量。廣用試紙看顏色對比色卡；pH 計直接顯示數字。③ 按「選這瓶」，再點你的答案。',
      samples: [
        { key: 'foamwash', name: '皂基洗面乳', img: 'foamwash.png', pH: 9.5, liquid: '#f4f6f8', src: '估計值，需老師確認（依產品標示設定）' },
        { key: 'aminowash', name: '胺基酸洗面乳', img: 'aminowash.png', pH: 5.8, liquid: '#f2f8f4', src: '估計值，需老師確認（依產品標示設定）' },
        { key: 'barsoap', name: '香皂', img: 'barsoap.png', pH: 9.8, liquid: '#f6f1e3', src: 'Tarun 2014：多數肥皂 pH 9～10' },
        { key: 'shampoo2', name: '洗髮精', img: 'shampoo2.png', pH: 6.5, liquid: '#e2d6f6', src: 'Tarun 2014：多數洗髮精 pH 6～7' },
        { key: 'dishsoap', name: '洗碗精', img: 'dishsoap.png', pH: 7.5, liquid: '#fbe98a', src: '估計值，需老師確認' }
      ],
      answer: 'aminowash', skin: [4.7, 5.9], tapShift: 0.5, tapShiftHigh: 0.1,
      stars: ['找出最接近皮膚 pH 的那一瓶', '第一次就選對', '全程用純水稀釋，pH 計每次都有洗'],
      win: '你把量好的數字列給好朋友看：「這瓶 pH 跟皮膚比較接近。」',
      fail: '健康皮膚表面是弱酸性，約 pH 4.7～5.9。把 5 樣的 pH 都量出來，看誰離這個範圍最近。石蕊只能分酸鹼，排不出接近程度，要用廣用試紙或 pH 計。',
      learn: '健康皮膚表面是弱酸性（自然狀態平均約 pH 4.7，也有文獻寫 5.4～5.9）。多數香皂 pH 9～10，是鹼性，離皮膚的 pH 很遠；用鹼性的東西洗，皮膚表面的 pH 會升高一段時間。所以挑洗臉的產品可以看 pH 跟皮膚接不接近。稀釋要用純水：自來水本身偏鹼一點，會讓讀數偏高。pH 計的電極換樣品前要洗，不然上一杯的溶液會混進來。（這裡只比 pH，不是醫療建議；皮膚有狀況請看醫師。）',
      src: '皮膚 pH：Lambers 等 2006, Int. J. Cosmet. Sci. 28:359–370；香皂、洗髮精：Tarun 等 2014, Indian J. Dermatol. 59(5):442–444；皂基、胺基酸洗面乳、洗碗精的 pH 與自來水偏鹼的程度：估計值，需老師確認。查詢日 2026-10-20。'
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
