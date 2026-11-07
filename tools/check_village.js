// 驗算「科學復興 第一章」三關：用遊戲同一份 model.js，掃過所有選項
// 執行：node tools/check_village.js
const M = require("../prototype/village/model.js");
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log("  ✗ " + msg); } };

console.log("== 第 1 關 斜面 ==");
for (const L of M.RAMP.planks) {
  const r = M.evalRamp(L);
  console.log(`  ${L} m：角度 ${r.angle.toFixed(1)}°，底端 x=${r.footX.toFixed(2)}，需要 ${r.Freq.toFixed(1)} N，做功 ${r.work.toFixed(0)} J（mgh=${r.mgh.toFixed(0)} J）→ ${r.reason}`);
  // 獨立重算：F = mg(sinθ + μcosθ)
  const th = Math.asin(1.2 / L), F = 60 * 9.8 * (Math.sin(th) + 0.03 * Math.cos(th));
  ok(Math.abs(F - r.Freq) < 1e-9, "斜面力公式不一致");
  // 功 ≥ mgh（多的是阻力做的功），且 功 − mgh = μmg cosθ · L
  ok(Math.abs(r.work - r.mgh - 0.03 * 60 * 9.8 * Math.cos(th) * L) < 1e-6, "斜面功不守恆");
}
const rampOK = M.RAMP.planks.filter(L => M.evalRamp(L).ok);
console.log("  可過關：" + rampOK.join("、") + " m");
ok(rampOK.length >= 2, "斜面至少要有兩種解");

console.log("== 第 2 關 槓桿 ==");
let total = 0, pass = 0, byKey = {};
for (const p of M.LEVER.planks) for (const fu of M.LEVER.fulcrums) for (const box of [false, true]) {
  const sols = [];
  for (let i = 1; i < p.L / M.LEVER.step; i++) {
    const dl = +(i * M.LEVER.step).toFixed(2);
    const r = M.evalLever({ L: p.L, pm: p.m, hf: fu.h, dl, box });
    total++;
    if (r.reason !== "noreach_stone" && r.reason !== "short_arm") {
      // 能量：小禾做的功 = 石頭位能增加 + 木板位能增加（理想槓桿）
      ok(Math.abs(r.kidWork - (r.stoneGain + r.plankGain)) < 1e-6 || r.Freq <= 0, `槓桿功不守恆 ${p.L}/${fu.h}/${dl}`);
      // 獨立重算力矩
      const Fq = (50 * 9.8 * dl - p.m * 9.8 * (p.L / 2 - dl)) / (p.L - dl);
      ok(Math.abs(Fq - r.Freq) < 1e-9, "力矩公式不一致");
    }
    if (r.ok) { pass++; sols.push(dl); }
  }
  const k = `${p.L}m ${fu.name}${box ? "＋木箱" : ""}`;
  byKey[k] = sols.length ? `${sols[0]}～${sols[sols.length - 1]} m（${sols.length} 個位置）` : "沒有解";
}
for (const k in byKey) console.log(`  ${k}：${byKey[k]}`);
console.log(`  全部組合 ${total}，可過關 ${pass}（亂放過關機率約 ${(100 * pass / total).toFixed(1)}%）`);
ok(byKey["4m 中石頭"] !== "沒有解" && byKey["3m 中石頭"] !== "沒有解", "不用木箱應該有解");
ok(byKey["4m 小石頭"] === "沒有解" && byKey["4m 小石頭＋木箱"] === "沒有解", "小石頭應該永遠抬不夠高");
ok(byKey["4m 大石頭"] === "沒有解", "大石頭不用木箱應該無解（搆得到就壓不動）");
ok(byKey["4m 大石頭＋木箱"] !== "沒有解", "大石頭＋木箱應該有解");

console.log("== 第 3 關 滑輪 ==");
const pul = [];
for (let f = 0; f <= 3; f++) for (let m = 0; m <= 3; m++) {
  if (f + m > M.PULLEY.have) continue;
  const r = M.evalPulley(f, m);
  pul.push(`  定${f} 動${m}：撐住的繩子 ${r.n} 段，需要 ${r.Freq.toFixed(1)} N，要拉 ${r.pull.toFixed(1)} m → ${r.reason}`);
  ok(Math.abs(r.kidWork - r.gain) < 1e-6, "滑輪功不守恆");
  if (r.ok) ok(m === 2 && f >= 2, "只有 定≥2、動=2 應該過關");
}
console.log(pul.join("\n"));

console.log(fail ? `\n結果：${fail} 項不通過` : "\n結果：全部通過");
process.exit(fail ? 1 : 0);
