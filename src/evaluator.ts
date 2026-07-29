import type {
  RuleComparison,
  RuleEvaluation,
  RuleEvaluationOptions,
  RuleNode,
  RuleScalar,
  RuleValue,
} from "./types.js";

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

export class RuleEvaluationLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = RuleEvaluationLimitError.name;
  }
}

export function evaluateRule(
  rule: RuleNode,
  facts: Readonly<Record<string, unknown>>,
  options: RuleEvaluationOptions = {},
): RuleEvaluation {
  const state = {
    visitedNodes: 0,
    missingFacts: new Set<string>(),
    maxDepth: options.maxDepth ?? 20,
    maxNodes: options.maxNodes ?? 1_000,
  };

  const matched = evaluateNode(rule, facts, state, 0);
  return {
    matched,
    visitedNodes: state.visitedNodes,
    missingFacts: [...state.missingFacts].sort(),
  };
}

function evaluateNode(
  node: RuleNode,
  facts: Readonly<Record<string, unknown>>,
  state: EvaluationState,
  depth: number,
): boolean {
  if (depth > state.maxDepth) {
    throw new RuleEvaluationLimitError("Rule exceeds maximum nesting depth");
  }
  state.visitedNodes += 1;
  if (state.visitedNodes > state.maxNodes) {
    throw new RuleEvaluationLimitError("Rule exceeds maximum node count");
  }

  if ("all" in node) {
    return node.all.every((child) =>
      evaluateNode(child, facts, state, depth + 1),
    );
  }
  if ("any" in node) {
    return node.any.some((child) =>
      evaluateNode(child, facts, state, depth + 1),
    );
  }
  if ("not" in node) {
    return !evaluateNode(node.not, facts, state, depth + 1);
  }
  return compare(node, facts, state);
}

function compare(
  comparison: RuleComparison,
  facts: Readonly<Record<string, unknown>>,
  state: EvaluationState,
): boolean {
  const resolved = resolveFact(facts, comparison.left.fact);
  if (!resolved.found) state.missingFacts.add(comparison.left.fact);
  if (comparison.operator === "exists") return resolved.found;
  if (!resolved.found) return false;

  const left = resolved.value;
  const right = comparison.right;
  switch (comparison.operator) {
    case "eq":
      return scalarEquals(left, right);
    case "neq":
      return !scalarEquals(left, right);
    case "gt":
      return numeric(left, right, (a, b) => a > b);
    case "gte":
      return numeric(left, right, (a, b) => a >= b);
    case "lt":
      return numeric(left, right, (a, b) => a < b);
    case "lte":
      return numeric(left, right, (a, b) => a <= b);
    case "contains":
      return contains(left, right);
    case "startsWith":
      return (
        typeof left === "string" &&
        typeof right === "string" &&
        left.startsWith(right)
      );
    case "in":
      return Array.isArray(right) && right.some((value) => scalarEquals(left, value));
    case "notIn":
      return Array.isArray(right) && !right.some((value) => scalarEquals(left, value));
    default:
      return false;
  }
}

function resolveFact(
  facts: Readonly<Record<string, unknown>>,
  path: string,
): { found: boolean; value?: unknown } {
  const segments = path.split(".");
  if (
    segments.length === 0 ||
    segments.some((segment) => !segment || FORBIDDEN_SEGMENTS.has(segment))
  ) {
    return { found: false };
  }

  let value: unknown = facts;
  for (const segment of segments) {
    if (
      typeof value !== "object" ||
      value === null ||
      !Object.prototype.hasOwnProperty.call(value, segment)
    ) {
      return { found: false };
    }
    value = (value as Record<string, unknown>)[segment];
  }
  return { found: true, value };
}

function scalarEquals(left: unknown, right: RuleValue | undefined): boolean {
  return (
    !Array.isArray(left) &&
    !Array.isArray(right) &&
    (typeof left === "string" ||
      typeof left === "number" ||
      typeof left === "boolean" ||
      left === null) &&
    left === right
  );
}

function numeric(
  left: unknown,
  right: RuleValue | undefined,
  predicate: (left: number, right: number) => boolean,
): boolean {
  return (
    typeof left === "number" &&
    typeof right === "number" &&
    Number.isFinite(left) &&
    Number.isFinite(right) &&
    predicate(left, right)
  );
}

function contains(left: unknown, right: RuleValue | undefined): boolean {
  if (typeof left === "string" && typeof right === "string") {
    return left.includes(right);
  }
  if (Array.isArray(left) && !Array.isArray(right)) {
    return left.some((value) => value === (right as RuleScalar));
  }
  return false;
}

interface EvaluationState {
  visitedNodes: number;
  missingFacts: Set<string>;
  maxDepth: number;
  maxNodes: number;
}
