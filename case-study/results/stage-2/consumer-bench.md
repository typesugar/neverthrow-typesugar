Consumer bench, 5 rounds, 500 ms per task; Apple M5 Pro, 18 cores, node v22.23.2; load 4.7/4.9/4.1 → 4.5/4.9/4.1. Batches of 1,000 per second.

| Case | Clean median | Spread | Polluted median | Spread |
| --- | ---: | ---: | ---: | ---: |
| S2 chain: methods | 58,853 | 13% | 59,114 | 5% |
| S2 chain: hand-compiled | 70,249 | 15% | 74,709 | 8% |
| S2 map x3: methods | 1,108,117 | 25% | 1,188,157 | 21% |
| S2 map x3: hand-compiled | 1,165,812 | 27% | 1,205,303 | 23% |
| S4 safeTry | 2,768 | 23% | 2,678 | 10% |
| S4 let: (typesugar) | 60,822 | 6% | 60,991 | 9% |
| S3 .match() method | 510,338 | 2% | 510,773 | 4% |
| S3 match() (typesugar) | 554,971 | 9% | 556,996 | 2% |
