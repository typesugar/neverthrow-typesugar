# Bench A/B: v8.2.0 vs v8.2.0

- A: `1d4cc19ed2e6`; B: `1d4cc19ed2e6`
- Machine: Apple M5 Pro, 18 cores, 64 GB, darwin 25.6.0 arm64; Node v22.23.2
- Date: 2026-11-14T08:08:07.057Z to 2026-11-14T08:09:57.562Z
- Load average (1/5/15 min): start 4.42 4.80 4.94, end 5.99 5.39 5.17
- 5 rounds, 500 ms per task, fresh process per side, order alternating. Spread is the larger side's (max-min)/median. Ops/sec are batches of 1,000 inputs per second.

| Benchmark | A median ops/s | B median ops/s | Δ % | Spread % (A / B) | IQR % (A / B) | |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| map x3 on Ok | 241,951 | 241,626 | -0.1 | 1.3 / 1.6 | 0.3 / 0.1 | noise: spread > Δ |
| map x3 on Err (skipped) | 205,518 | 210,025 | +2.2 | 8.1 / 5.5 | 6.9 / 2.4 | noise: spread > Δ |
| andThen pipeline: parse, validate, map, mapErr (80% Ok) | 65,587 | 67,960 | +3.6 | 2.6 / 2.5 | 1.9 / 1.6 |  |
| andThen pipeline + match | 68,825 | 70,659 | +2.7 | 14.2 / 10.7 | 5.7 / 2.6 | noise: spread > Δ |
| isOk() narrowing over existing Results | 1,344,682 | 1,341,518 | -0.2 | 3.8 / 10.0 | 1.0 / 1.4 | noise: spread > Δ |
| unwrapOr over existing Results | 1,627,302 | 1,513,527 | -7.0 | 7.6 / 17.0 | 2.4 / 7.3 | noise: spread > Δ |
| Result.combine (1,000 Ok) | 438,014 | 439,008 | +0.2 | 2.2 / 12.3 | 0.1 / 8.7 | noise: spread > Δ |
| Result.combineWithAllErrors (1,000, 10% Err) | 520,825 | 499,863 | -4.0 | 2.1 / 8.6 | 1.1 / 7.4 | noise: spread > Δ |
| safeTry: 2 yields, 80% Ok | 2,686 | 2,444 | -9.0 | 3.0 / 15.4 | 1.0 / 11.2 | noise: spread > Δ |
| fromThrowable wrapper (10% throw) | 5,405 | 5,090 | -5.8 | 2.6 / 6.9 | 1.8 / 3.9 | noise: spread > Δ |
| reference: hand-written tagged union pipeline | 72,687 | 72,490 | -0.3 | 4.3 / 15.1 | 0.7 / 7.7 | noise: spread > Δ |
| reference: hand-written map x3 | 243,125 | 240,980 | -0.9 | 0.6 / 7.5 | 0.1 / 2.8 | noise: spread > Δ |
| ResultAsync: okAsync, map, andThen, map (awaited) | 839 | 816 | -2.8 | 3.2 / 12.9 | 2.4 / 6.6 | noise: spread > Δ |
| Result.asyncAndThen + map (awaited) | 1,671 | 1,657 | -0.9 | 2.9 / 2.7 | 2.0 / 2.0 | noise: spread > Δ |

13 of 14 deltas are smaller than their spread.
