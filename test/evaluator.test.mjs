import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateRule,
  RuleEvaluationLimitError,
} from "../dist/index.js";

test("evaluates nested boolean conditions deterministically", () => {
  const result = evaluateRule({
    all: [
      { operator: "eq", left: { fact: "country" }, right: "DE" },
      { any: [
        { operator: "gte", left: { fact: "metrics.conversions" }, right: 10 },
        { operator: "in", left: { fact: "plan" }, right: ["enterprise"] },
      ] },
    ],
  }, {
    country: "DE",
    metrics: { conversions: 12 },
    plan: "free",
  });

  assert.equal(result.matched, true);
  assert.equal(result.visitedNodes, 4);
});

test("reports missing facts without throwing", () => {
  const result = evaluateRule(
    { operator: "eq", left: { fact: "identity.country" }, right: "DE" },
    {},
  );
  assert.equal(result.matched, false);
  assert.deepEqual(result.missingFacts, ["identity.country"]);
});

test("does not traverse object prototypes", () => {
  const result = evaluateRule(
    { operator: "exists", left: { fact: "__proto__.polluted" } },
    {},
  );
  assert.equal(result.matched, false);
});

test("enforces evaluation limits", () => {
  assert.throws(
    () => evaluateRule(
      { not: { not: { operator: "exists", left: { fact: "value" } } } },
      { value: true },
      { maxDepth: 1 },
    ),
    RuleEvaluationLimitError,
  );
});
