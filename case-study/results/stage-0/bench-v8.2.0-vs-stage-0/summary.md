# Bench A/B: v8.2.0 vs stage-0

- A: `1d4cc19ed2e6`; B: `81e22c0edb57`
- Machine: Apple M5 Pro, 18 cores, 64 GB, darwin 25.6.0 arm64; Node v22.23.2
- Date: 2026-11-13T09:08:34.697Z to 2026-11-13T09:10:27.614Z
- Load average (1/5/15 min): start 18.03 12.52 7.85, end 13.11 13.35 8.81
- 5 rounds, 500 ms per task, fresh process per side, order alternating. Spread is the larger side's (max-min)/median. Ops/sec are batches of 1,000 inputs per second.

| Benchmark | A median ops/s | B median ops/s | Δ % | Spread % (A / B) | IQR % (A / B) | |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| map x3 on Ok | 227,688 | 229,832 | +0.9 | 5.8 / 8.9 | 1.3 / 3.3 | noise: spread > Δ |
| map x3 on Err (skipped) | 206,190 | 195,693 | -5.1 | 19.2 / 14.6 | 10.2 / 6.0 | noise: spread > Δ |
| andThen pipeline: parse, validate, map, mapErr (80% Ok) | 59,569 | 62,629 | +5.1 | 20.1 / 13.3 | 8.3 / 5.2 | noise: spread > Δ |
| andThen pipeline + match | 61,591 | 66,406 | +7.8 | 6.4 / 15.2 | 4.4 / 10.4 | noise: spread > Δ |
| isOk() narrowing over existing Results | 1,176,919 | 1,238,525 | +5.2 | 12.7 / 14.9 | 2.8 / 5.0 | noise: spread > Δ |
| unwrapOr over existing Results | 1,418,598 | 1,492,951 | +5.2 | 13.7 / 12.0 | 5.6 / 4.2 | noise: spread > Δ |
| Result.combine (1,000 Ok) | 398,151 | 407,913 | +2.5 | 9.7 / 7.3 | 5.8 / 5.2 | noise: spread > Δ |
| Result.combineWithAllErrors (1,000, 10% Err) | 475,471 | 499,984 | +5.2 | 12.4 / 12.6 | 0.4 / 6.0 | noise: spread > Δ |
| safeTry: 2 yields, 80% Ok | 2,268 | 2,451 | +8.1 | 13.6 / 15.9 | 10.0 / 5.2 | noise: spread > Δ |
| fromThrowable wrapper (10% throw) | 4,601 | 4,838 | +5.2 | 17.7 / 18.1 | 13.7 / 10.8 | noise: spread > Δ |
| reference: hand-written tagged union pipeline | 63,357 | 64,065 | +1.1 | 10.1 / 14.4 | 5.1 / 2.0 | noise: spread > Δ |
| reference: hand-written map x3 | 221,607 | 231,453 | +4.4 | 7.2 / 15.3 | 1.0 / 3.2 | noise: spread > Δ |
| ResultAsync: okAsync, map, andThen, map (awaited) | 707 | 754 | +6.7 | 14.9 / 20.0 | 4.1 / 1.7 | noise: spread > Δ |
| Result.asyncAndThen + map (awaited) | 1,429 | 1,425 | -0.3 | 7.4 / 19.4 | 3.7 / 6.9 | noise: spread > Δ |

14 of 14 deltas are smaller than their spread.
