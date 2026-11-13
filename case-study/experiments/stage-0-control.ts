// Positive control for Stage 0: a module with a macro, built through the same
// typesugar Rollup plugin instance as neverthrow. If this does not change,
// the plugin is not wired in and a byte-identical dist proves nothing.
import { comptime } from "typesugar";

export const answer = comptime(() => 6 * 7);
