/* 最小 DOM/事件 stub：加载真实 static/app.js，端到端验证罚秒与名次表逻辑。 */
"use strict";
const fs = require("fs");
const path = require("path");

/* ---------------- mini DOM（与 test_review_lifecycle.js 同款最小桩） ---------------- */

class TokenList {
  constructor() { this._s = new Set(); }
  add(...names) { names.forEach((n) => n && this._s.add(n)); }
  remove(n) { this._s.delete(n); }
  contains(n) { return this._s.has(n); }
  [Symbol.iterator]() { return this._s[Symbol.iterator](); }
}

class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parent = null;
    this.attrs = {};
    this.classList = new TokenList();
    this.dataset = {};
    this.id = "";
    this.value = "";
    this.checked = false;
    this.hidden = false;
    this._text = "";
    this._html = "";
    this._listeners = new Map();
    this.name = "";
    this.type = "";
  }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text; }
  set innerHTML(html) {
    this._html = html;
    if (html === "") this.children = [];
  }
  get innerHTML() { return this._html; }
  appendChild(c) {
    if (c.parent) c.parent._remove(c);
    c.parent = this;
    this.children.push(c);
    return c;
  }
  _remove(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
  }
  remove() { if (this.parent) { this.parent._remove(this); this.parent = null; } }
  insertAdjacentHTML(_pos, html) { parseHtml(html).forEach((n) => this.appendChild(n)); }
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }
  dispatchEvent(evt) {
    let node = this;
    if (!evt.target) evt.target = this;
    if (!evt.preventDefault) evt.preventDefault = () => {};
    while (node) {
      const fns = node._listeners.get(evt.type) || [];
      for (const fn of fns) fn.call(node, evt);
      node = node.parent;
    }
  }
  _descendants(out = []) {
    for (const c of this.children) { out.push(c); c._descendants(out); }
    return out;
  }
  matches(sel) {
    let s = sel.trim();
    const checked = s.endsWith(":checked");
    if (checked) s = s.slice(0, -":checked".length);
    let m = s.match(/^([\w-]+)?(?:\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\])?$/);
    if (s.startsWith(".") || s.startsWith("#")) m = null;
    if (s.startsWith(".")) {
      if (checked && !this.checked) return false;
      return this.classList.contains(s.slice(1));
    }
    if (s.startsWith("#")) return this.id === s.slice(1);
    if (!m) return false;
    const [, tag, attr, val] = m;
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    if (attr) {
      const actual = attr === "class" ? [...this.classList].join(" ") : this.attrs[attr] ?? this[attr];
      if (val !== undefined && String(actual) !== val) return false;
      if (val === undefined && actual === undefined) return false;
    }
    if (checked && !this.checked) return false;
    return true;
  }
  querySelector(sel) { return this._descendants().find((n) => n.matches(sel)); }
  querySelectorAll(sel) { return this._descendants().filter((n) => n.matches(sel)); }
  closest(sel) {
    let n = this;
    while (n) { if (n.matches(sel)) return n; n = n.parent; }
    return null;
  }
}

const VOID_TAGS = new Set(["input", "br", "img", "hr", "meta", "link"]);

function parseHtml(html) {
  const root = new El("#root");
  const stack = [root];
  const tokenRe = /<\/?[a-zA-Z][\w-]*(?:[^<>]*?)\/?>|[^<]+/g;
  let tok;
  while ((tok = tokenRe.exec(html))) {
    const t = tok[0];
    if (t[0] !== "<") continue;
    const closing = t[1] === "/";
    const selfClose = t.endsWith("/>");
    const nameM = t.match(/^<\/?([\w-]+)/);
    const tag = nameM[1].toLowerCase();
    if (closing) { stack.pop(); continue; }
    const el = new El(tag);
    const attrRe = /([\w:-]+)(?:\s*=\s*"([^"]*)")?/g;
    let am;
    const raw = t.replace(/^<\/?[\w-]+/, "").replace(/\/?>$/, "");
    while ((am = attrRe.exec(raw))) {
      const [, k, v] = am;
      if (!k || k === "/") continue;
      if (v === undefined) { el.attrs[k] = true; continue; }
      el.attrs[k] = v;
      if (k === "class") v.split(/\s+/).forEach((c) => c && el.classList.add(c));
      else if (k === "id") el.id = v;
      else if (k.startsWith("data-")) el.dataset[k.slice(5)] = v;
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = true;
      else if (k === "hidden") el.hidden = true;
      else if (k === "name") el.name = v;
      else if (k === "type") el.type = v;
    }
    stack[stack.length - 1].appendChild(el);
    if (!selfClose && !VOID_TAGS.has(tag)) stack.push(el);
  }
  return root.children;
}

/* ---------------- document stub ---------------- */

const byId = new Map();
function mk(id, tag = "div") { const e = new El(tag); e.id = id; byId.set(id, e); return e; }

const form = mk("judge-form", "form");
const runnerRows = mk("runner-rows");
const recordRows = mk("record-rows");
const addRunner = mk("add-runner", "button");
const addRecord = mk("add-record", "button");
mk("record-count", "span");
mk("error-box"); mk("pending-hint");
const rankingBox = mk("ranking-box");
mk("results");
for (const id of ["smMin", "smMax", "mfMin", "mfMax"]) mk(id, "input");
mk("sample-btn", "button"); mk("clear-btn", "button");
mk("submit-btn", "button");

for (const id of ["smMin", "smMax", "mfMin", "mfMax"]) form.appendChild(byId.get(id));
form.appendChild(runnerRows);
form.appendChild(recordRows);

global.document = { getElementById: (id) => byId.get(id) };

/* ---------------- fetch stub（合法 / 422 / 挂起，可切换结果） ---------------- */

function lap(runner, s, m, f, st, mt, ft) {
  return {
    start: { id: s, time: st }, middle: { id: m, time: mt }, finish: { id: f, time: ft },
    smTime: mt - st, mfTime: ft - mt, totalTime: ft - st,
  };
}
function one(runner, laps, total) {
  return { runner, lapCount: laps.length, totalTime: total ?? laps.reduce((a, l) => a + l.totalTime, 0), laps, unused: [] };
}

const threeRunners = {
  runners: [
    one(101, [lap(101, "a1", "b1", "c1", 0, 12, 22)]),          // 1 次 22 秒
    one(102, [lap(102, "d1", "e1", "f1", 5, 15, 25)]),          // 1 次 20 秒
    one(103, [
      lap(103, "g1", "h1", "i1", 0, 11, 10),
      lap(103, "g2", "h2", "i2", 30, 42, 55),
    ]),                                                          // 2 次 35 秒
  ],
};
// 三名选手各 1 趟：原总用时 22 / 20 / 30。配合罚秒可构造 1、1、3。
const tieResult = {
  runners: [
    one(101, [lap(101, "a1", "b1", "c1", 0, 12, 22)]),
    one(102, [lap(102, "d1", "e1", "f1", 5, 15, 25)]),
    one(103, [lap(103, "g1", "h1", "i1", 0, 11, 30)]),
  ],
};

const zeroResult = {
  runners: [
    one(101, [lap(101, "a1", "b1", "c1", 0, 12, 22)]),
    { runner: 102, lapCount: 0, totalTime: 0, laps: [], unused: [] },
  ],
};
// 102 改号为 202 后，服务端按当前输入裁决：202 号选手一趟 20 秒。
const renamedResult = {
  runners: [
    one(101, [lap(101, "a1", "b1", "c1", 0, 12, 22)]),
    one(202, [lap(202, "d1", "e1", "f1", 5, 15, 25)]),
    one(103, [
      lap(103, "g1", "h1", "i1", 0, 11, 10),
      lap(103, "g2", "h2", "i2", 30, 42, 55),
    ]),
  ],
};
// 仅剩 102、103（101 被删除）。
const without101 = {
  runners: [
    one(102, [lap(102, "d1", "e1", "f1", 5, 15, 25)]),
    one(103, [
      lap(103, "g1", "h1", "i1", 0, 11, 10),
      lap(103, "g2", "h2", "i2", 30, 42, 55),
    ]),
  ],
};

const server = { mode: "valid", result: threeRunners, hold: null };
let lastBody = null;
let fetchCount = 0;
global.fetch = async (_url, opts) => {
  fetchCount++;
  lastBody = opts.body;
  JSON.parse(opts.body);
  const mode = server.mode;
  const resultAtRequest = server.result; // 请求发出时定格结果，模拟真实服务器
  if (mode === "invalid") {
    return { ok: false, status: 422, json: async () => ({ ok: false, error: "模拟非法输入" }) };
  }
  if (mode === "hold") {
    const data = await server.hold;
    return { ok: true, status: 200, json: async () => data };
  }
  return { ok: true, status: 200, json: async () => ({ ok: true, result: resultAtRequest }) };
};

/* ---------------- 加载真实 app.js ---------------- */

new Function(fs.readFileSync(path.join(__dirname, "static", "app.js"), "utf8"))();

/* ---------------- 测试辅助 ---------------- */

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("  ✓", msg); }
  else { failures++; console.error("  ✗", msg); }
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const $ = (id) => byId.get(id);
function setVal(id, v) { $(id).value = v; }
function fire(el, type) { el.dispatchEvent({ type, preventDefault() {}, target: el }); }
async function flush(n = 5) { for (let i = 0; i < n; i++) await tick(); }
async function adjudicate() { fire(form, "submit"); await flush(); }
// 合法裁决后手动把桩切回 valid，避免 invalid/hold 泄漏到后续场景。
async function adjudicateValid() { server.mode = "valid"; await adjudicate(); }

const renderedRanking = () => rankingBox.innerHTML;
function rankRows() {
  const out = [];
  const rowRe = /<tr class="rank-row([^"]*)" data-runner="(\d+)">([\s\S]*?)<\/tr>/g;
  // 名次表每行恰好 6 个顶层 <td>；罚秒单元格内部不再含 <td>。
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
  let m;
  while ((m = rowRe.exec(renderedRanking()))) {
    const cells = [...m[3].matchAll(cellRe)].map((x) => x[1]);
    out.push({
      cls: m[1].trim(),
      runner: Number(m[2]),
      rank: cells[0].replace(/<[^>]*>/g, "").trim(),
      laps: cells[2].trim(),
      total: cells[3].trim(),
      penaltyCell: cells[4],
      adjusted: cells[5].trim(),
    });
  }
  return out;
}
const order = () => rankRows().map((r) => r.runner);

// 通过真实的 rankingBox click 监听保存罚秒；返回错误提示元素与抓取到的当前值。
function savePenalty(runner, seconds, reason) {
  const tr = new El("tr");
  tr.classList.add("rank-row");
  tr.dataset.runner = String(runner);
  const secEl = { value: seconds };
  const reasonEl = { value: reason };
  const errEl = { hidden: false, textContent: "" };
  tr.querySelector = (sel) => {
    if (sel === ".penalty-seconds") return secEl;
    if (sel === ".penalty-reason") return reasonEl;
    if (sel === ".penalty-error") return errEl;
    return undefined;
  };
  const btn = new El("button");
  btn.classList.add("penalty-save");
  tr.appendChild(btn);
  rankingBox.appendChild(tr);
  // 真实 DOM 中成功保存会整表重渲染、错误 span 重置为 hidden；桩里显式模拟。
  errEl.hidden = true;
  fire(btn, "click"); // 校验失败时监听会把 hidden 置回 false
  tr.parent = null;
  return errEl;
}

function makeRunnerRow(n) {
  const row = new El("div");
  row.classList.add("runner-row");
  const idx = new El("span");
  idx.classList.add("row-index");
  row.appendChild(idx); // 真实删除处理会刷新 .row-index 文本
  const inp = new El("input");
  inp.classList.add("runner-number");
  inp.value = n === undefined ? "" : String(n);
  row.appendChild(inp); // 挂到行上，input 事件才能冒泡到 runnerRows / form
  const del = new El("button");
  del.classList.add("remove-runner");
  row.appendChild(del);
  return { row, inp };
}

function setupRunnerNumbers(nums) {
  runnerRows.innerHTML = "";
  nums.forEach((n) => runnerRows.appendChild(makeRunnerRow(n).row));
}

/* ---------------- 场景 ---------------- */

async function main() {
  setVal("smMin", "10"); setVal("smMax", "60"); setVal("mfMin", "10"); setVal("mfMax", "60");
  setupRunnerNumbers([101, 102, 103]);
  // 记录行（仅为 DOM 完备；裁决结果由 fetch 桩给出）。
  for (let i = 0; i < 9; i++) {
    const r = new El("tr"); r.classList.add("record-row");
    for (const cls of ["rec-id", "rec-runner", "rec-gate", "rec-time"]) {
      const inp = new El("input"); inp.classList.add(cls); r.appendChild(inp);
    }
    const btn = new El("button"); btn.classList.add("remove-record"); r.appendChild(btn);
    recordRows.appendChild(r);
  }

  console.log("场景1：合法裁决渲染名次表——计次数降序、用时升序、列齐全");
  await adjudicate();
  assert(!rankingBox.hidden, "合法结果后名次表可见");
  assert(JSON.stringify(order()) === JSON.stringify([103, 102, 101]),
    `名次顺序为 103(2次) → 102(20) → 101(22)，实际 ${JSON.stringify(order())}`);
  const rows1 = rankRows();
  assert(rows1.map((r) => `${r.rank}`).join(",") === "1,2,3", "名次为 1、2、3");
  assert(rows1[0].laps === "2" && rows1[0].total === "35" && rows1[0].adjusted === "35",
    "103 行：计次 2、原总用时 35、调整后 35");
  assert(renderedRanking().includes("选手编号") && renderedRanking().includes("调整后用时"),
    "表头含选手编号与调整后用时");
  assert(renderedRanking().includes("罚秒") && renderedRanking().includes("原因"),
    "表头含罚秒与原因列");

  console.log("场景2：保存罚秒后立即重排名次，无需重新请求");
  const beforeFetch = fetchCount;
  savePenalty(101, "5", "抢跑"); // 101: 22+5=27
  await flush();
  assert(fetchCount === beforeFetch, "保存罚秒不触发任何服务器请求");
  assert(JSON.stringify(order()) === JSON.stringify([103, 102, 101]), "101 加 5 秒后仍在末位");
  assert(rankRows()[2].adjusted === "27", "101 调整后用时为 27");
  assert(renderedRanking().includes("已保存：罚 5 秒"), "显示已保存罚 5 秒");
  assert(renderedRanking().includes("抢跑"), "显示保存原因");
  savePenalty(102, "20", "犯规"); // 102: 20+20=40 → 落到 101 之后
  assert(JSON.stringify(order()) === JSON.stringify([103, 101, 102]),
    `102 罚 20 后顺序变为 103、101、102，实际 ${JSON.stringify(order())}`);
  assert(rankRows()[2].adjusted === "40", "102 调整后用时为 40");

  console.log("场景3：并列共享名次并跳号（1、1、3），并列按编号升序展示");
  // 三名选手同计次：101(22)、102(20)、103(30)。罚 101 三秒 → 25；罚 102 五秒 → 25；
  // 103 保持 30。前两名调整后用时相同，应并列第 1，103 跳到第 3。
  server.result = tieResult;
  await adjudicate();
  savePenalty(101, "3", "并列甲");
  savePenalty(102, "5", "并列乙");
  const r3 = rankRows();
  assert(JSON.stringify(order()) === JSON.stringify([101, 102, 103]),
    `并列行按编号升序：101 在 102 前，实际 ${JSON.stringify(order())}`);
  assert(r3[0].rank === "1" && r3[1].rank === "1", "101 与 102 并列第 1");
  assert(r3[2].rank === "3" && r3[2].runner === 103, "103 跳到第 3 名（1、1、3）");
  assert(r3[0].adjusted === "25" && r3[1].adjusted === "25" && r3[2].adjusted === "30",
    "调整后用时分别为 25、25、30");
  server.result = threeRunners;
  await adjudicate();

  console.log("场景4：保存校验——非法罚秒 / 缺原因 / 超长原因均失败并保留原值");
  let err = savePenalty(103, "", "原因");
  assert(!err.hidden && /非负整数/.test(err.textContent), "空罚秒：报错");
  err = savePenalty(103, "-3", "原因");
  assert(!err.hidden && /非负整数/.test(err.textContent), "负数罚秒：报错");
  err = savePenalty(103, "1.5", "原因");
  assert(!err.hidden && /非负整数/.test(err.textContent), "小数罚秒：报错");
  err = savePenalty(103, "10", "   ");
  assert(!err.hidden && /原因/.test(err.textContent), "罚秒大于 0 且原因为空白：报错");
  err = savePenalty(103, "10", "");
  assert(!err.hidden && /原因/.test(err.textContent), "罚秒大于 0 且无原因：报错");
  err = savePenalty(103, "0", "x".repeat(201));
  assert(!err.hidden && /200 字/.test(err.textContent), "原因超 200 字：报错");
  assert(rankRows()[0].adjusted === "35", "保存失败后 103 罚秒仍为 0、名次未变");
  assert(renderedRanking().includes("已保存：罚 5 秒"), "保存失败不影响其他选手已保存罚秒");

  console.log("场景5：罚秒 0 可无原因保存（覆盖回默认）");
  err = savePenalty(101, "0", "");
  assert(err.hidden, "罚秒 0 + 空原因保存成功");
  assert(!rankRows().some((r) => r.runner === 101 && /已保存/.test(r.penaltyCell)),
    "101 罚秒归零后不再显示已保存罚秒");
  assert(rankRows().find((r) => r.runner === 101).adjusted === "22", "101 调整后恢复 22");

  console.log("场景6：非法输入与重算期间隐藏名次；改回合法后用已保存罚秒重算");
  savePenalty(102, "8", "保留罚秒H");
  server.mode = "invalid";
  setVal("smMin", "");
  fire($("smMin"), "input");
  await adjudicate();
  assert(rankingBox.hidden && renderedRanking() === "", "非法响应：名次表隐藏且清空");
  assert(!$("error-box").hidden, "非法时仍显示错误");
  setVal("smMin", "10");
  fire($("smMin"), "input");
  server.mode = "valid";
  await adjudicate();
  assert(!rankingBox.hidden, "恢复合法后名次表重新出现");
  assert(rankRows().find((r) => r.runner === 102).adjusted === "28",
    "最新合法结果使用此前已保存的罚秒（20+8=28）");

  console.log("场景7：手动重算期间立即隐藏名次");
  let resolveHold;
  server.hold = new Promise((res) => { resolveHold = res; });
  server.mode = "hold";
  fire(form, "submit");
  await flush();
  assert(rankingBox.hidden, "请求在途（手动重算）名次隐藏");
  resolveHold({ ok: true, result: threeRunners });
  await flush();
  server.mode = "valid";
  assert(!rankingBox.hidden, "在途响应返回且仍最新时名次恢复");

  console.log("场景8：过期响应不能恢复名次");
  server.hold = new Promise((res) => { resolveHold = res; });
  server.mode = "hold";
  fire(form, "submit");
  await flush();
  setVal("smMax", "70");
  fire($("smMax"), "input"); // 版本递增；区间绑定改变不影响罚秒
  resolveHold({ ok: true, result: threeRunners }); // 旧请求晚到
  await flush();
  assert(rankingBox.hidden, "过期响应未恢复名次（仍等待新版本重算）");
  setVal("smMax", "60");
  fire($("smMax"), "input");
  await new Promise((r) => setTimeout(r, 450));
  await flush();
  assert(!rankingBox.hidden, "新版本合法结果到达后名次恢复");
  assert(rankRows().find((r) => r.runner === 102).adjusted === "28", "罚秒仍然保留（区间编辑不清除）");

  console.log("场景9：编号改变立即清除对应罚秒，改回不恢复；删除同理");
  const runnerInputs = () => [...runnerRows.querySelectorAll(".runner-number")];
  const inp102 = runnerInputs().find((e) => e.value === "102");
  inp102.value = "202";
  fire(inp102, "input"); // 旧编号 102 消失：罚秒立即删除
  server.result = renamedResult;
  server.mode = "valid";
  await adjudicate();
  assert(rankRows().find((r) => r.runner === 202).adjusted === "20",
    "改号后 202 按默认罚秒 0 计（旧 102 罚秒不迁移）");
  inp102.value = "102";
  fire(inp102, "input"); // 改回不恢复
  server.result = threeRunners;
  await adjudicate();
  const row102 = rankRows().find((r) => r.runner === 102);
  assert(row102.adjusted === "20", `编号改走再改回后罚秒不恢复（调整后应为 20，实际 ${row102.adjusted}）`);

  // 删除整行：删 101 → 裁决结果只剩 102、103；补回同编号 101 后罚秒不恢复。
  savePenalty(101, "9", "删除前罚秒");
  const row101El = [...runnerRows.querySelectorAll(".runner-row")].find(
    (r) => r.querySelector(".runner-number").value === "101"
  );
  fire(row101El.querySelector(".remove-runner"), "click");
  assert(rankingBox.hidden, "删除选手后名次表立即隐藏（重算期间）");
  server.result = without101;
  await adjudicate();
  assert(!rankRows().some((r) => r.runner === 101), "删除后 101 不在名次表中");
  const added = makeRunnerRow("101");
  runnerRows.appendChild(added.row);
  fire(added.inp, "input");
  server.result = threeRunners;
  await adjudicate();
  const back101 = rankRows().find((r) => r.runner === 101);
  assert(back101 && back101.adjusted === "22", "删除选手后补回同编号，罚秒不恢复");

  console.log("场景10：记录/区间编辑保留罚秒（不随重算丢失）");
  savePenalty(103, "4", "记录编辑前");
  server.mode = "valid";
  await adjudicate();
  assert(rankRows().find((r) => r.runner === 103).adjusted === "39", "重算后 103 罚秒保留（35+4）");

  console.log("场景11：罚秒不发送到服务器、不改采纳记录与复核");
  await adjudicate();
  const body = JSON.parse(lastBody);
  assert(!("penalties" in body), "请求体不含罚秒字段");
  assert(!body.runners.some((r) => "penalty" in r || "penaltySeconds" in r),
    "runners 中无罚秒字段");
  assert($("results").innerHTML.includes("a1"), "采纳记录照常渲染");

  console.log("场景12：零次者排末尾、按编号升序且无名次（—），仍可保存罚秒");
  setupRunnerNumbers([101, 102]);
  server.result = zeroResult;
  await adjudicate();
  const rz = rankRows();
  assert(rz[0].runner === 101 && rz[0].rank === "1", "有完整计次者 101 列前、名次 1");
  assert(rz[1].runner === 102 && rz[1].rank === "—" && rz[1].cls.includes("rank-zero"),
    "零次者 102 排末尾、无名次（—）");
  assert(rz[1].laps === "0" && rz[1].total === "0", "零次者计次与原总用时为 0");
  // 零次者罚秒 3 秒：保存成功且不产生名次
  const e2 = savePenalty(102, "3", "零次也罚");
  assert(e2.hidden, "零次者罚秒大于 0 且有原因可保存");
  const z2 = rankRows().find((r) => r.runner === 102);
  assert(z2.adjusted === "3" && z2.rank === "—", "零次者显示调整后用时但依旧无名次");
  const e3 = savePenalty(102, "3", "");
  assert(!e3.hidden, "零次者罚秒大于 0 无原因同样保存失败");

  console.log("场景13：清空与填入示例清除全部罚秒");
  server.result = threeRunners;
  setupRunnerNumbers([101, 102, 103]);
  server.mode = "valid";
  await adjudicate();
  savePenalty(101, "6", "清空前");
  fire($("clear-btn"), "click");
  await flush();
  assert(rankingBox.hidden && renderedRanking() === "", "清空后名次表立即隐藏");
  fire($("sample-btn"), "click");
  await new Promise((r) => setTimeout(r, 450));
  await flush();
  // 示例数据桩结果为 threeRunners 不变；101 若仍有罚秒则调整后非 22
  assert(!rankingBox.hidden, "填入示例后重算完成、名次表出现");
  assert(rankRows().find((r) => r.runner === 101).adjusted === "22",
    "填入示例后旧罚秒已全部清除");

  console.log(failures === 0 ? "\nALL PENALTY/RANKING SCENARIOS PASSED" : `\n${failures} ASSERTION(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
