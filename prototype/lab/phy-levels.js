/* 瘋狂實驗室・物理實驗台的關卡（老闆 10/19：難度拉到國三～高中、要像《憤怒鳥》有挑戰性和自由度）
 * 座標 dm，實驗桌面 y = 0；statics 是固定的牆、架子；zones 是可以擺器材的區域；shelf 是器材櫃（數量）。 */
(function (root) {
  'use strict';
  function R(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  var BENCH = { pts: R(-3, -1.2, 15, 0), mat: 'bench', look: 'bench' };

  root.PHY_LEVELS = [
    {
      id: 'PHY-1', no: 1, stage: '國三 物理・功與能', diff: 'E3', title: '越過擋板，送進高台的燒杯',
      mission: '用彈簧發射器把球射過擋板，掉進高台上的燒杯 B。只有 3 發。',
      note: '拖住發射器尾端的紅色推桿往後拉，放手就發射；拉越多，彈簧存的能量越多。點發射器可以轉角度、左右移。球可以換：把器材櫃的球拖到發射器上。',
      world: { w: 12, h: 7 },
      statics: [BENCH,
        { pts: R(5.2, 0, 5.5, 3.0), mat: 'wood', look: 'board' },
        { pts: R(8.4, 2.05, 11.8, 2.2), mat: 'wood', look: 'shelf' },
        { pts: R(11.4, 0, 11.6, 2.05), mat: 'wood', look: 'leg' }],
      cups: [{ x: 10.0, y: 2.2, w: 1.0, h: 0.9, label: 'B' }],
      zones: [{ x0: 0.4, y0: 0, x1: 4.2, y1: 4 }],
      fixed: [{ type: 'launcher', x: 1.2, y: 0.55, deg: 30, slideY: true, props: { k: 250, x: 0, ball: 'steel' } }],
      shelf: { steel: 99, wood: 99, pingpong: 99 },
      shots: 3,
      stars: ['過關', '3 發內第 2 發以前過關', '第 1 發就過關'],
      learn: '彈簧壓縮 x，存的彈性位能是 ½kx²；放手後變成球（和推桿）的動能：½(m+M)v² = ½kx²，所以 v = x√(k ÷ (m+M))。壓縮加倍，速度加倍，飛得遠很多。換成比較輕的木球，同樣壓縮會更快；乒乓球雖然最快，但很輕又大，空氣阻力讓它飛不遠。'
    },
    {
      id: 'PHY-2', no: 2, stage: '國三 物理・力與運動', diff: 'E4', title: '牆後的燒杯（擦板球）',
      mission: '燒杯 C 緊貼在牆後面。發射器最多只能抬到 45°，球飛過牆就落得太遠。在牆後擺一塊板子當「籃板」，讓球撞板後掉進燒杯。只有 3 發。',
      note: '從器材櫃把板子拖到牆後的虛線區；點板子會出現選取框：拖上面的圓鈕旋轉，拖兩端的方塊改長短。三種板子反彈的程度不一樣。',
      world: { w: 12, h: 7 },
      statics: [BENCH,
        { pts: R(6.0, 0, 6.35, 4.0), mat: 'wood', look: 'wall' },
        { pts: R(-3, 6.75, 15, 7.2), mat: 'wood', look: 'ceiling' }],
      cups: [{ x: 7.45, y: 0, w: 1.0, h: 0.9, label: 'C' }],
      zones: [{ x0: 6.5, y0: 1.0, x1: 11.6, y1: 6.6 }],
      fixed: [{ type: 'launcher', x: 1.0, y: 0.55, deg: 35, lockMove: true, rotMax: 45, props: { k: 250, x: 0, ball: 'steel' } }],
      shelf: { plank: 2, bumper: 1, sponge: 1, steel: 99, wood: 99 },
      shots: 3,
      stars: ['過關', '第 2 發以前過關', '只用 1 塊板子'],
      learn: '球撞到板子會反彈：沿著板面的速度大致不變，垂直板面的速度反向、再乘上恢復係數 e。彈力板 e 大，球會彈回牆那邊；海綿的 e 很小，球撞上去幾乎停住、直直掉下來。板子轉 θ，反彈方向就轉 2θ。'
    },
    {
      id: 'PHY-3', no: 3, stage: '國三 物理・功與能・槓桿', diff: 'E4', title: '翹翹板投石器',
      mission: '把翹翹板擺好，用上方的釋放夾讓鐵球砸在翹起的一端，把左端的小球拋進高台上的燒杯 D。只有 3 次。',
      note: '翹翹板拖到桌上；拖板子中間的黃色支點可以改兩邊的長短。釋放夾可以左右拖、往下拖改高度，點「放開」鐵球就掉下去。鐵球有三種重量，拖到釋放夾上換。',
      world: { w: 12, h: 7 },
      statics: [BENCH,
        { pts: R(7.6, 0, 7.85, 1.6), mat: 'wood', look: 'board' },
        { pts: R(8.6, 2.45, 11.8, 2.6), mat: 'wood', look: 'shelf' },
        { pts: R(11.4, 0, 11.6, 2.45), mat: 'wood', look: 'leg' },
        { pts: R(-3, 6.55, 9.5, 6.7), mat: 'steel', look: 'rail' }],
      cups: [{ x: 10.1, y: 2.6, w: 1.0, h: 0.9, label: 'D' }],
      zones: [{ x0: 0.8, y0: 0, x1: 7.2, y1: 1.4, kind: 'seesaw' }, { x0: 0.3, y0: 6.3, x1: 7.4, y1: 6.6, kind: 'dropper' }],
      fixed: [{ type: 'dropper', x: 5.2, y: 6.55, lockRot: true, slideY: true, props: { h: 1.0, ball: 'iron1' } }],
      shelf: { seesaw: 1, steel: 99, wood: 99, iron05: 99, iron1: 99, iron2: 99 },
      shots: 3,
      stars: ['過關', '第 2 次以前過關', '第 1 次就過關'],
      learn: '鐵球從高處掉下，重力位能變成動能；砸在翹翹板上時，板子繞支點轉，另一端把小球往上拋。支點離小球越遠（小球那邊的力臂越長），小球那端轉得越快、拋得越高；但力臂太長，鐵球那邊推不動。鐵球越重、掉得越高，能量越多。'
    },
    {
      id: 'PHY-4', no: 4, stage: '高中基礎物理・拋體運動', diff: 'E5', title: '一發入魂',
      mission: '壓縮空氣砲的出口速度固定 2.80 m/s。燒杯 E 的杯口中心離砲口水平 0.700 m、高 0.050 m，中間的牆只留一個窗口。先算好仰角再發射，只有 2 發。',
      note: '點空氣砲會出現選取框：拖圓鈕轉角度，或用工具列的「−0.5°」「+0.5°」微調。這關沒有提示，請用拋體公式先算。',
      world: { w: 12, h: 7 },
      statics: [BENCH,
        { pts: R(4.6, 0, 4.85, 1.75), mat: 'wood', look: 'wall' },
        { pts: R(4.6, 2.9, 4.85, 6.6), mat: 'wood', look: 'wall' },
        { pts: R(-3, 6.6, 15, 7.2), mat: 'wood', look: 'ceiling' },
        { pts: R(7.6, 0, 8.6, 0.78), mat: 'wood', look: 'block' }],
      cups: [{ x: 8.1, y: 0.78, w: 1.0, h: 0.9, label: 'E' }],
      zones: [],
      fixed: [{ type: 'cannon', x: 1.1, y: 1.18, deg: 20, lockMove: true, props: { v: 2.8, ball: 'steel' } }],
      shelf: {},
      shots: 2,
      stars: ['過關', '過關', '第 1 發就過關'],
      learn: '水平：x = v₀cosθ·t；鉛直：y = v₀sinθ·t − ½gt²。消去 t：y = x·tanθ − g·x² ÷ (2v₀²cos²θ)。代入 x = 0.700 m、y = 0.050 m、v₀ = 2.80 m/s、g = 9.8 m/s²，解出兩個仰角；窗口擋住了高拋那一個，只能用低的那個。'
    },
    {
      id: 'PHY-5', no: 5, stage: '高中選修物理・動量與碰撞', diff: 'E5', title: '動量接力',
      mission: '氣墊軌道上，讓最後一台滑車以 1.25 m/s 以上通過光電閘。彈簧發射器只推得動第一台，直接推最輕的也不夠快。只有 3 次。',
      note: '把器材櫃的滑車拖到軌道上（會自動吸附），左右拖可以排順序；拖發射器的紅色推桿往後拉、放手發射。滑車上寫了質量；有一台裝的是魔鬼氈。',
      world: { w: 12, h: 5 },
      statics: [BENCH],
      track: { y: 1.0, startX: 0.9, endX: 11.6, gateX: 10.4, k: 60, plungerM: 1.0, maxX: 8 },
      shelf: { car1000: 1, car500: 1, car200: 1, car100: 1, car50: 1, carVelcro: 1 },
      shots: 3,
      target: 1.25,
      stars: ['過關', '第 2 次以前過關', '最後一台超過 1.30 m/s'],
      learn: '彈性碰撞中，重的撞輕的，輕的會以比原來更快的速度彈出（最多快到接近 2 倍）：v₂ = (1+e)·m₁ ÷ (m₁+m₂)·v₁。所以由重到輕排成一列，速度一棒一棒放大。魔鬼氈讓兩台黏在一起（完全非彈性碰撞），動量守恆但動能損失最多。'
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
