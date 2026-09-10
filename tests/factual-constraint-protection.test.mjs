import assert from "node:assert/strict";
import test from "node:test";
import { analyzeFactualConstraints, evaluateFactualConstraints } from "../factual-constraint-protection.mjs";

function evaluate(source, translation) {
  return evaluateFactualConstraints(translation, analyzeFactualConstraints(source));
}

test("accepts equivalent amount, quantity, and localized date formatting", () => {
  assert.deepEqual(evaluate("Send 1,000 USDT on 2026-09-10", "请在2026年9月10日发送一千USDT"), []);
  assert.deepEqual(evaluate("Please send 3 files", "请发送三份文件"), []);
  assert.deepEqual(evaluate("请发送一百USDT", "Please send one hundred USDT"), []);
  assert.deepEqual(evaluate("请发送三份文件", "Please send three files"), []);
});

test("blocks changed amounts, currencies, quantities, and explicit dates", () => {
  assert.ok(evaluate("Send 100 USDT", "发送200 USDT").some((item) => item.ruleId === "FACT-CURRENCY-001" && item.severity === "block"));
  assert.ok(evaluate("Send 100 USDT", "发送100 USD").some((item) => item.ruleId === "FACT-CURRENCY-001" && item.severity === "block"));
  assert.ok(evaluate("Please send 3 files", "请发送4份文件").some((item) => item.ruleId === "FACT-NUMBER-001" && item.severity === "block"));
  assert.ok(evaluate("Send it on 2026-09-10", "请在2026年9月11日发送").some((item) => item.ruleId === "FACT-DATE-001" && item.severity === "block"));
});

test("marks an unrecognized date expression as uncertain instead of fabricating certainty", () => {
  const findings = evaluate("Send it on September 10, 2026", "请在下个结算日发送");
  assert.deepEqual(findings, [{ code: "date_expression_unverified", ruleId: "FACT-DATE-002", severity: "warning" }]);
});

test("recognizes spelled-out quantities across nouns and prefix currency codes", () => {
  const source = "Each of the three employees should receive NGN 20,000, making NGN 60,000 in total.";
  assert.deepEqual(evaluate(source, "三名员工每人应领20,000奈拉，总共60,000奈拉"), []);
  assert.deepEqual(evaluate(source, "这三位员工每人应得NGN20,000，总计NGN60,000"), []);
  assert.ok(evaluate(source, "三名员工每人应领20,000奈拉，总共50,000奈拉").some(f => f.severity === "block"));
  assert.deepEqual(evaluate("Four contractors receive USD 1,200", "四名承包商收到1,200美元"), []);
  assert.deepEqual(evaluate("We paid them USD 1,250.50, but they refunded only USD 1,205.50.", "我们付给他们USD1,250.50，但他们只退还USD1,205.50"), []);
});

test("incomplete numeric extraction is uncertain, not a proven value reversal", () => {
  const result = evaluate("Send three files", "把文件发过来");
  assert.deepEqual(result, [{code:"numeric_expression_unverified",ruleId:"FACT-NUMBER-002",severity:"warning"}]);
  assert.ok(evaluate("Send three files", "发四份文件").some(f=>f.severity==="block"));
});

test("mixed coefficients and Chinese scale units preserve currency values", () => {
  for (const amount of ["2万5千", "2.5万", "25千"]) {
    assert.deepEqual(evaluate("I owe you NGN 25,000.", `我欠你${amount}奈拉。`), [], amount);
  }
  assert.deepEqual(evaluate("Each of the three employees should receive NGN 20,000, making NGN 60,000 in total.", "每位员工应获得2万奈拉，三人共6万奈拉。"), []);
  assert.ok(evaluate("I owe you NGN 25,000.", "我欠你2万6千奈拉。").some(f => f.severity === "block"));
  assert.ok(evaluate("I owe you NGN 25,000.", "我欠你2.5万美元。").some(f => f.severity === "block"));
  assert.deepEqual(evaluate("Pay NGN 20100", "付2.01万奈拉"), []);
  assert.deepEqual(evaluate("Pay USD 1250.50", "付1.2505千美元"), []);
});
