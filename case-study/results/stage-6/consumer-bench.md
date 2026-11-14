Consumer bench, 5 rounds, 500 ms per task; Apple M5 Pro, 18 cores, node v22.23.2; load 3.1/3.9/3.9 → 4.0/4.1/3.9. Batches of 1,000 per second.

| Case | Clean median | Spread | Polluted median | Spread |
| --- | ---: | ---: | ---: | ---: |
| S2 chain: methods | 57,073 | 26% | 56,738 | 22% |
| S2 chain: hand-compiled | 70,824 | 18% | 71,199 | 25% |
| S2 map x3: methods | 1,261,205 | 8% | 1,299,685 | 14% |
| S2 map x3: hand-compiled | 1,307,438 | 10% | 1,194,292 | 20% |
| S4 safeTry | 2,673 | 14% | 2,507 | 21% |
| S4 let: (typesugar) | 57,105 | 23% | 56,330 | 17% |
| S6 async safeTry (awaited) | 693 | 17% | 695 | 22% |
| S6 async let: (typesugar, awaited) | 7,101 | 9% | 7,043 | 29% |
| S6 async andThen/map (awaited) | 1,559 | 14% | 1,374 | 38% |
| S3 .match() method | 500,879 | 10% | 488,608 | 32% |
| S3 match() (typesugar) | 554,527 | 6% | 540,028 | 24% |
