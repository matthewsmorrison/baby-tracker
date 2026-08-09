# WHO Child Growth Standards — reference data

Verbatim extracts of the official WHO Child Growth Standards tables, vendored so
that the LMS parameters in `lib/whoWeight.ts` and `lib/whoGrowth.ts` can be
verified offline and without trusting a hand transcription:

```
node --experimental-strip-types scripts/verify-who-tables.mjs
```

Nothing in the app reads these files at runtime — they exist only for that check.

## Contents

One CSV per indicator, sex and age resolution. Columns are the source columns
unchanged: age, then `L`, `M`, `S` (the Box-Cox power, median and coefficient of
variation) and the `SD3neg`…`SD3` z-score values WHO publishes alongside them.

| Prefix | Indicator |
| --- | --- |
| `wfa-` | weight-for-age (kg) |
| `lhfa-` | length/height-for-age (cm) |
| `hcfa-` | head-circumference-for-age (cm) |

| Suffix | Ages | Published precision |
| --- | --- | --- |
| `-days` | 0–91 days | L/M to 4dp, S to 5dp, z-score values to 3dp |
| `-weeks` | 0–13 weeks | z-score values to 1dp |
| `-months` | 0–24 months | z-score values to 1dp |

The `-days` files are truncated to 91 days and `-months` to 24 months, the range
the app charts. The `-weeks` and `-months` rows are the authoritative source for
the tables in `lib/`; the finer-grained `-days` files exist so the derived
centile maths can be checked against a 3dp reference in the newborn window.

Note that WHO's weekly and monthly tables are computed at exact week/month ages,
so a monthly row is *not* the same as the daily row at `month × 30.4375` days —
the two differ in the third decimal place. The `lib/` tables follow WHO's own
weekly and monthly tables.

## Provenance

Retrieved 2026-07-28 from the WHO Child Growth Standards site, under
`https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/`:

- weight-for-age: `weight-for-age/expanded-tables/wfa-{boys,girls}-zscore-expanded-tables.xlsx`,
  `weight-for-age/wfa_{boys,girls}_0-to-13-weeks_zscores.xlsx`,
  `weight-for-age/wfa_{boys,girls}_0-to-5-years_zscores.xlsx`
- length/height-for-age: `length-height-for-age/expandable-tables/lhfa-{boys,girls}-zscore-expanded-tables.xlsx`,
  `length-height-for-age/lhfa_{boys,girls}_0-to-13-weeks_zscores.xlsx`,
  `length-height-for-age/lhfa_{boys,girls}_0-to-2-years_zscores.xlsx`
- head-circumference-for-age: `head-circumference-for-age/expanded-tables/hcfa-{boys,girls}-zscore-expanded-tables.xlsx`,
  `head-circumference-for-age/hcfa-{boys,girls}-0-13-zscores.xlsx`,
  `head-circumference-for-age/hcfa-{boys,girls}-0-5-zscores.xlsx`

Landing pages: <https://www.who.int/tools/child-growth-standards/standards>

The values are reproduced unaltered save for conversion to CSV and truncation to
the age ranges above. The WHO Child Growth Standards are published by the World
Health Organization; WHO is not affiliated with this project and does not endorse
it. The UK-WHO growth charts printed in the red book are derived from these same
standards, combined with UK90 reference data outside the WHO age range.
