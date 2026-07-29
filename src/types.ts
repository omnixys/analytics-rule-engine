export type RuleScalar = string | number | boolean | null;
export type RuleValue = RuleScalar | RuleScalar[];

export type RuleComparisonOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "startsWith"
  | "exists"
  | "in"
  | "notIn";

export interface RuleComparison {
  operator: RuleComparisonOperator;
  left: { fact: string };
  right?: RuleValue;
}

export type RuleNode =
  | RuleComparison
  | { all: RuleNode[] }
  | { any: RuleNode[] }
  | { not: RuleNode };

export interface RuleEvaluation {
  matched: boolean;
  visitedNodes: number;
  missingFacts: string[];
}

export interface RuleEvaluationOptions {
  maxDepth?: number;
  maxNodes?: number;
}
