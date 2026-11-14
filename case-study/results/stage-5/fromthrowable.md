# Stage 5: fromThrowable vs inline try/catch

3 runs of `node bench/run.mjs --time 500 --filter S5`, 2026-11-14T07:41Z, Apple M5 Pro, node v22.23.2, load 6.05 4.75 4.21.

S5 fromThrowable (10% throw) x 5,310.38 ops/sec ±0.75% (2656 runs sampled)
S5 inline try/catch (10% throw) x 6,260.51 ops/sec ±0.21% (3131 runs sampled)
S5 fromThrowable (no throw) x 358,949.54 ops/sec ±0.54% (179475 runs sampled)
S5 inline try/catch (no throw) x 385,893.03 ops/sec ±0.45% (192947 runs sampled)

S5 fromThrowable (10% throw) x 5,578.52 ops/sec ±0.30% (2790 runs sampled)
S5 inline try/catch (10% throw) x 6,213.32 ops/sec ±0.21% (3107 runs sampled)
S5 fromThrowable (no throw) x 359,164.94 ops/sec ±0.54% (179583 runs sampled)
S5 inline try/catch (no throw) x 382,548.44 ops/sec ±0.46% (191275 runs sampled)

S5 fromThrowable (10% throw) x 5,568.84 ops/sec ±0.32% (2785 runs sampled)
S5 inline try/catch (10% throw) x 6,192.41 ops/sec ±0.20% (3097 runs sampled)
S5 fromThrowable (no throw) x 357,894.92 ops/sec ±0.57% (178962 runs sampled)
S5 inline try/catch (no throw) x 382,591.56 ops/sec ±0.51% (191296 runs sampled)

