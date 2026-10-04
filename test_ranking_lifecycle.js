/* 最小 DOM/事件 stub：加载真实 static/app.js，端到端验证名次表与罚秒生命周期。
   与 test_review_lifecycle.js 的差异：结果区 innerHTML 会解析为子节点，
   以便通过 querySelector 找到名次表槽位与罚秒编辑器并模拟真实点击。 */
"use strict";
const fs = require("fs");
const path = require("path");

/* ---------------- mini DOM ---------------- */

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
    this.children = [];
    // 解析为子节点：名次表槽位、罚秒编辑器等都可被 querySelector 找到。
    if (html) parseHtml(html).forEach((n) => this.appendChild(n));
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
    if (closing) {
      // 保留原始 innerHTML 字符串（含文本），便于测试直接断言内容。
      const el = stack.pop();
      if (el && el._contentStart !== undefined) {
        el._html = html.slice(el._contentStart, tok.index);
      }
      continue;
    }
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
      else if (k.startsWith("data-")) {
        // 与真实 DOM 一致：data-key-index 同时映射为 dataset.keyIndex。
        const dk = k.slice(5);
        el.dataset[dk] = v;
        el.dataset[dk.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
      }
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = true;
      else if (k === "hidden") el.hidden = true;
      else if (k === "name") el.name = v;
      else if (k === "type") el.type = v;
    }
    stack[stack.length - 1].appendChild(el);
    if (!selfClose && !VOID_TAGS.has(tag)) {
      el._contentStart = tok.index + t.length;
      stack.push(el);
    }
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
const results = mk("results");
for (const id of ["smMin", "smMax", "mfMin", "mfMax"]) mk(id, "input");
mk("sample-btn", "button"); mk("clear-btn", "button");

for (const id of ["smMin", "smMax", "mfMin", "mfMax"]) form.appendChild(byId.get(id));
form.appendChild(runnerRows);
form.appendChild(recordRows);

global.document = {
  getElementById: (id) => byId.get(id),
};

/* ---------------- fetch stub（可切换：合法 / 422 / 挂起），并计数 ---------------- */

function lap(s, m, f, st, mt, ft) {
  return {
    start: { id: s, time: st }, middle: { id: m, time: mt }, finish: { id: f, time: ft },
    smTime: mt - st, mfTime: ft - mt, totalTime: ft - st,
  };
}
// 三名选手均有完整计次：20 / 22 / 30 秒。
const fixtureA = {
  runners: [
    { runner: 101, lapCount: 1, totalTime: 20, laps: [lap("a1", "b1", "c1", 0, 10, 20)], unused: [] },
    { runner: 102, lapCount: 1, totalTime: 22, laps: [lap("d1", "e1", "f1", 0, 11, 22)], unused: [] },
    { runner: 103, lapCount: 1, totalTime: 30, laps: [lap("g1", "h1", "i1", 0, 15, 30)], unused: [] },
  ],
};
// 101、103 零次，102 一次。
const fixtureB = {
  runners: [
    { runner: 101, lapCount: 0, totalTime: 0, laps: [], unused: [{ id: "a1", gate: "S", time: 0 }] },
    { runner: 102, lapCount: 1, totalTime: 20, laps: [lap("d1", "e1", "f1", 0, 10, 20)], unused: [] },
    { runner: 103, lapCount: 0, totalTime: 0, laps: [], unused: [{ id: "g1", gate: "S", time: 0 }] },
  ],
};

const server = { mode: "valid", result: fixtureA, hold: null };
let fetchCount = 0;
global.fetch = async (_url, opts) => {
  fetchCount++;
  JSON.parse(opts.body); // 前端始终发送合法 JSON
  if (server.mode === "invalid") {
    return { ok: false, status: 422, json: async () => ({ ok: false, error: "模拟非法输入" }) };
  }
  if (server.mode === "hold") {
    const data = await server.hold;
    return { ok: true, status: 200, json: async () => data };
  }
  return { ok: true, status: 200, json: async () => ({ ok: true, result: server.result }) };
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

function setRow(ids, runner, gate, time) {
  const rows = recordRows.querySelectorAll(".record-row");
  for (const row of rows) {
    if (row.querySelector(".rec-id").value === "") {
      row.querySelector(".rec-id").value = ids;
      row.querySelector(".rec-runner").value = runner;
      row.querySelector(".rec-gate").value = gate;
      row.querySelector(".rec-time").value = time;
      return row;
    }
  }
  throw new Error("no empty row");
}
function findRow(id) {
  return recordRows.querySelectorAll(".record-row").find((r) => r.querySelector(".rec-id").value === id);
}
const numInputs = () => [...runnerRows.querySelectorAll(".runner-number")];

// 名次表槽位的实时 HTML（罚秒保存后会被原地重排）。
const slotHtml = () => results.querySelector(".ranking-table-slot").innerHTML;
const rowHtml = (runner, laps, total, pen, adj, rank) =>
  `<td>${runner}</td><td>${laps}</td><td>${total} 秒</td><td>${pen} 秒</td><td>${adj} 秒</td><td>${rank}</td>`;
const rowOrder = (...nums) => {
  const h = slotHtml();
  const idx = nums.map((n) => h.indexOf(`<td>${n}</td>`));
  return idx.every((i) => i >= 0) && idx.every((v, i) => i === 0 || idx[i - 1] < v);
};

function editorOf(runner) {
  return results.querySelectorAll(".penalty-editor").find((e) => e.dataset.runner === String(runner));
}
// 通过真实的 resultsBox click 监听保存罚秒。
function savePenalty(runner, seconds, reason) {
  const ed = editorOf(runner);
  ed.querySelector(".penalty-seconds").value = seconds;
  ed.querySelector(".penalty-reason").value = reason;
  fire(ed.querySelector(".penalty-save"), "click");
  return {
    error: ed.querySelector(".penalty-error"),
    current: ed.querySelector(".penalty-current"),
  };
}

/* ---------------- 场景 ---------------- */

async function main() {
  // 初始合法输入：区间 10~60 / 10~60，选手 101/102/103，各一趟。
  setVal("smMin", "10"); setVal("smMax", "60"); setVal("mfMin", "10"); setVal("mfMax", "60");
  fire(addRunner, "click"); fire(addRunner, "click"); // 共 3 行选手
  numInputs()[0].value = "101"; numInputs()[1].value = "102"; numInputs()[2].value = "103";
  for (let i = 0; i < 7; i++) fire(addRecord, "click"); // 共 9 行记录
  [
    ["a1", "101", "S", "0"], ["b1", "101", "M", "10"], ["c1", "101", "F", "20"],
    ["d1", "102", "S", "0"], ["e1", "102", "M", "11"], ["f1", "102", "F", "22"],
    ["g1", "103", "S", "0"], ["h1", "103", "M", "15"], ["i1", "103", "F", "30"],
  ].forEach((r) => setRow(...r));
  server.result = fixtureA;
  await adjudicate();

  console.log("名次表初始渲染（无罚秒，默认 0）");
  assert(
    slotHtml().includes("<th>选手编号</th><th>计次数</th><th>原总用时</th><th>罚秒</th><th>调整后用时</th><th>名次</th>"),
    "表头包含选手编号/计次数/原总用时/罚秒/调整后用时/名次"
  );
  assert(slotHtml().includes(rowHtml(101, 1, 20, 0, 20, "第 1 名")), "101：1 次、20 秒、第 1 名");
  assert(slotHtml().includes(rowHtml(102, 1, 22, 0, 22, "第 2 名")), "102：1 次、22 秒、第 2 名");
  assert(slotHtml().includes(rowHtml(103, 1, 30, 0, 30, "第 3 名")), "103：1 次、30 秒、第 3 名");
  assert(results.querySelectorAll(".penalty-editor").length === 3, "每名选手都有罚秒编辑区");
  assert(editorOf(101).querySelector(".penalty-seconds").value === "0", "默认罚秒为 0");

  console.log("保存罚秒立即重排名次，无需重算");
  let before = fetchCount;
  let r = savePenalty(102, "2", "踩线");
  assert(fetchCount === before, "保存罚秒未发起重新裁决");
  assert(slotHtml().includes(rowHtml(102, 1, 22, 2, 24, "第 2 名")), "102 罚秒 2、调整后 24 立即生效");
  assert(
    r.current.innerHTML.includes("当前已保存：2 秒") && r.current.innerHTML.includes("踩线"),
    "已保存罚秒与原因回显"
  );
  assert(r.error.hidden, "合法保存无错误提示");

  console.log("并列共享名次并跳号（1、1、3），并列按编号升序展示");
  savePenalty(101, "4", "抢跑"); // 101 调整后 24，与 102 并列
  assert(slotHtml().includes(rowHtml(101, 1, 20, 4, 24, "第 1 名")), "101 并列第 1 名");
  assert(slotHtml().includes(rowHtml(102, 1, 22, 2, 24, "第 1 名")), "102 并列第 1 名");
  assert(slotHtml().includes(rowHtml(103, 1, 30, 0, 30, "第 3 名")), "103 跳号为第 3 名");
  assert(!slotHtml().includes("第 2 名"), "名次跳号：不存在第 2 名");
  assert(rowOrder(101, 102, 103), "并列者按编号升序展示");

  console.log("非法罚秒保存失败并保留原罚秒和原因");
  const snapshot = slotHtml();
  r = savePenalty(103, "abc", "原因");
  assert(!r.error.hidden && r.error.textContent.includes("非负整数"), "非数字罚秒被拒绝");
  r = savePenalty(103, "-1", "原因");
  assert(!r.error.hidden && r.error.textContent.includes("非负整数"), "负数罚秒被拒绝");
  r = savePenalty(103, "", "原因");
  assert(!r.error.hidden && r.error.textContent.includes("非负整数"), "空罚秒被拒绝");
  r = savePenalty(103, "5", "");
  assert(!r.error.hidden && r.error.textContent.includes("原因"), "罚秒大于 0 时原因必填");
  r = savePenalty(103, "5", "x".repeat(201));
  assert(!r.error.hidden && r.error.textContent.includes("200"), "原因至多 200 字");
  assert(r.error.textContent.includes("已保留原罚秒和原因"), "失败提示保留原值");
  assert(slotHtml() === snapshot, "保存失败不改变名次表");
  assert(slotHtml().includes(rowHtml(103, 1, 30, 0, 30, "第 3 名")), "103 罚秒仍为 0");

  console.log("罚秒 0 允许空原因；原因做 HTML 转义");
  r = savePenalty(103, "5", "迟到");
  assert(slotHtml().includes(rowHtml(103, 1, 30, 5, 35, "第 3 名")), "103 罚秒 5、调整后 35");
  r = savePenalty(103, "1", "违规<抢跑>");
  assert(r.current.innerHTML.includes("违规&lt;抢跑&gt;"), "原因中的尖括号被转义");
  r = savePenalty(103, "0", "");
  assert(r.error.hidden && slotHtml().includes(rowHtml(103, 1, 30, 0, 30, "第 3 名")), "罚秒 0 空原因保存成功");

  console.log("罚秒只影响名次表，不改变采纳记录、裁决用时与人工复核");
  const reviewBox = results.querySelector(".review-box");
  const passRadio = [...reviewBox.querySelectorAll("input[type=radio]")].find((x) => x.value === "pass");
  passRadio.checked = true;
  reviewBox.querySelector(".review-note").value = "复核备注";
  fire(reviewBox.querySelector(".review-save"), "click");
  savePenalty(103, "3", "绕行");
  assert(results.innerHTML.includes("各趟用时之和：20 秒"), "选手卡仍显示原裁决用时");
  assert(
    results.querySelector(".review-current").innerHTML.includes("复核备注"),
    "保存罚秒后复核内容不变"
  );
  savePenalty(103, "0", "");

  console.log("记录或区间编辑保留罚秒");
  // 当前罚秒：101→4，102→2
  findRow("a1").querySelector(".rec-time").value = "1";
  fire(findRow("a1").querySelector(".rec-time"), "input");
  await adjudicate();
  assert(slotHtml().includes(rowHtml(101, 1, 20, 4, 24, "第 1 名")), "修改记录后 101 罚秒保留");
  setVal("smMin", "5"); fire($("smMin"), "input");
  await adjudicate();
  assert(slotHtml().includes(rowHtml(102, 1, 22, 2, 24, "第 1 名")), "修改区间后 102 罚秒保留");
  setVal("smMin", "10"); fire($("smMin"), "input");
  await adjudicate();

  console.log("修改选手编号立即清除对应罚秒，改回不恢复");
  numInputs().find((e) => e.value === "102").value = "105";
  fire(runnerRows, "input"); // 此刻即应清除 102 的罚秒
  numInputs().find((e) => e.value === "105").value = "102";
  fire(runnerRows, "input"); // 改回不恢复
  await adjudicate();
  assert(slotHtml().includes(rowHtml(102, 1, 22, 0, 22, "第 1 名")), "102 罚秒被清除且不恢复（22 秒重回第 1）");
  assert(slotHtml().includes(rowHtml(101, 1, 20, 4, 24, "第 2 名")), "101 罚秒不受影响");

  console.log("删除选手立即清除其罚秒，补回同编号不恢复");
  const row101 = [...runnerRows.querySelectorAll(".runner-row")].find(
    (x) => x.querySelector(".runner-number").value === "101"
  );
  fire(row101.querySelector(".remove-runner"), "click"); // 此刻即应清除 101 的罚秒
  fire(addRunner, "click");
  numInputs().find((e) => e.value === "").value = "101";
  fire(runnerRows, "input");
  await adjudicate();
  assert(slotHtml().includes(rowHtml(101, 1, 20, 0, 20, "第 1 名")), "101 罚秒被清除且不恢复");
  assert(slotHtml().includes(rowHtml(102, 1, 22, 0, 22, "第 2 名")), "102 同样无罚秒");

  console.log("零次者排末尾、按编号升序且无名次");
  server.result = fixtureB;
  await adjudicate();
  assert(rowOrder(102, 101, 103), "有计次的 102 在前，零次者 101、103 按编号升序排末尾");
  assert(slotHtml().includes(rowHtml(102, 1, 20, 0, 20, "第 1 名")), "102 第 1 名");
  assert(slotHtml().includes(rowHtml(101, 0, 0, 0, 0, "—")), "101 零次、无名次");
  assert(slotHtml().includes(rowHtml(103, 0, 0, 0, 0, "—")), "103 零次、无名次");
  r = savePenalty(101, "3", "设备故障");
  assert(slotHtml().includes(rowHtml(101, 0, 0, 3, 3, "—")), "零次者可保存罚秒但仍无名次");
  assert(rowOrder(102, 101, 103), "零次者顺序不受罚秒影响");

  console.log("输入非法或重算期间隐藏名次，旧响应不能恢复");
  server.mode = "invalid";
  setVal("smMin", ""); fire($("smMin"), "input");
  await adjudicate();
  assert(results.innerHTML === "" && !$("error-box").hidden, "非法输入：名次表隐藏，只显示错误");
  setVal("smMin", "10"); fire($("smMin"), "input");
  server.mode = "hold";
  let resolveHold;
  server.hold = new Promise((res) => { resolveHold = res; });
  fire(form, "submit"); // 请求在途
  setVal("smMin", "5"); fire($("smMin"), "input"); // 输入已变，名次隐藏
  assert(results.innerHTML === "", "重算期间名次表隐藏");
  resolveHold({ ok: true, result: fixtureB }); // 旧响应回来
  await flush();
  assert(results.innerHTML === "", "过期响应未恢复名次表");
  server.mode = "valid";
  setVal("smMin", "10"); fire($("smMin"), "input");
  await adjudicate();
  assert(
    slotHtml().includes(rowHtml(101, 0, 0, 3, 3, "—")),
    "最新合法结果套用当时已保存的罚秒（区间编辑保留罚秒）"
  );

  console.log("填入示例与清空清除全部罚秒");
  savePenalty(102, "7", "绕行");
  assert(slotHtml().includes(rowHtml(102, 1, 20, 7, 27, "第 1 名")), "102 罚秒 7 已生效");
  fire($("sample-btn"), "click");
  await new Promise((res) => setTimeout(res, 450)); // 超过 350ms 防抖，自动重算
  await flush();
  assert(slotHtml().includes(rowHtml(102, 1, 20, 0, 20, "第 1 名")), "填入示例后全部罚秒被清除");
  fire($("clear-btn"), "click");
  await flush();
  assert(results.innerHTML === "" && $("error-box").hidden, "清空后名次表立即隐藏");

  console.log(failures === 0 ? "\nALL RANKING SCENARIOS PASSED" : `\n${failures} ASSERTION(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
