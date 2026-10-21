# Roborock map fixtures

Real raw Roborock V1 maps (`RRMap` format), used by `tests/unit/roborock-map.test.ts`.

Copied unchanged from [python-roborock](https://github.com/Python-roborock/python-roborock)
(`tests/map/testdata/v1/`, commit `1868810d43`), which adapted them from
[Valetudo](https://github.com/Hypfer/Valetudo) (`backend/test/lib/robots/roborock/res/map/`).
Both projects are licensed under the Apache License 2.0.

| File | Robot | What it exercises |
| --- | --- | --- |
| `s5_fw2008_with_segments.bin` | Roborock S5, fw 2008 | rooms 1 and 2, charger, robot, path |
| `s5_fw1886_with_forbidden_zones_and_virtual_walls.bin` | Roborock S5, fw 1886 | virtual wall, no-go area, cleaned zone |
| `s6_fw2652_with_active_segment_and_no_mop_zone.bin` | Roborock S6, fw 2652 | six rooms, no-go and no-mop areas |

The expected values in the tests are the ones python-roborock's own snapshot
(`tests/map/__snapshots__/test_map_parser.ambr`) records for these files.
