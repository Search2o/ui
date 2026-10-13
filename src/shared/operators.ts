import type { OperatorMappingAction, OperatorMappingModel } from "@/orval/search2o.schemas";

export type OperatorKey = keyof OperatorMappingModel;

export const OPERATOR_ROWS: { key: OperatorKey; label: string }[] = [
    { key: "add", label: "Addition (+)" },
    { key: "sub", label: "Subtraction (-)" },
    { key: "mult", label: "Multiplication (*)" },
    { key: "div", label: "Division (/)" },
    { key: "floordiv", label: "Floor division (//)" },
    { key: "mod", label: "Modulo (%)" },
    { key: "pow", label: "Power (**)" },
    { key: "lshift", label: "Left shift (<<)" },
    { key: "rshift", label: "Right shift (>>)" },
    { key: "matmult", label: "Matrix multiplication (@)" },
];

export function ruleOf(operators: OperatorMappingModel, key: OperatorKey): OperatorMappingAction {
    const rule = operators[key];
    return { allow: rule?.allow ?? true, rewrite: rule?.rewrite ?? "" };
}
