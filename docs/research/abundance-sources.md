# Abundance data: sources, licenses, choices

Date: 2026-10-21. Pipeline: `tools/build-abundance.mjs` -> `public/data/abundance.json` (cap 60 KB).
Companion pipeline for discovery history: `tools/build-history.mjs` (Wikidata, CC0; nothing to research there).

## What we ship

Five media per element, one number or `null` each. Every column is a single named column from a
Wikipedia table, and the `source.columns` block in the JSON names the handbook or paper that
Wikipedia itself cites for that column.

| key | medium | unit in JSON | page and column | reference the page cites | coverage |
|---|---|---|---|---|---|
| `crust` | continental crust | mg/kg | *Abundances of the elements (data page)*, column C1 | CRC Handbook of Chemistry and Physics, 85th ed. (2005), sec. 14 "Abundance of Elements in the Earth's Crust and in the Sea" (median of reported measurements) | 88/118 |
| `ocean` | sea water near the surface | mg/L | same page, column W1 | CRC Handbook, same table | 81/118 |
| `sun` | Solar System (CI chondrites + photosphere) | atoms per 10^6 Si atoms | same page, column Y2 | Anders & Grevesse 1989, *Geochim. Cosmochim. Acta* 53, 197-214 | 83/118 |
| `human` | adult human body | mg/kg (ppm by mass) | *Composition of the human body*, column "Fraction of mass" | Chang *Chemistry* 9th ed. p. 52; Frausto da Silva & Williams 2001; Zumdahl *Chemistry* 5th ed. p. 894; Cohn et al. 1976; Aloia et al. 1997 | 51/118 |
| `universe` | Milky Way, spectroscopic | mg/kg (ppm by mass) | *Abundance of the chemical elements*, table "Ten most common elements" | Croswell, *Alchemy of the Heavens* (1996) | 10/118 |

Revision ids and retrieval date are recorded in `source.pages` of the JSON. Page HTML is cached under
`data/cache/wikipedia-html/`; delete the cache to pick up newer revisions.

### Unit conversions done by the script

- The data page normalizes every column to a mass fraction (it says so in its Notes). C1 is multiplied by 10^6 to give mg/kg.
- CRC's sea-water table is in mg/L; the data page divided by 10^6 treating 1 L as 1 kg. Multiplying back by 10^6 recovers CRC's mg/L figures. The 2.5% density error is already inside Wikipedia's normalization and is far below the stated uncertainty of these medians.
- Y2 is normalized to Si = 1 on the page; multiplied by 10^6 to recover the conventional cosmochemical scale (Si = 10^6 atoms). This is an atom ratio, not a mass fraction.
- Human "Fraction of mass" is a mass fraction (some cells are `{{val}}` templates such as 60e-6); multiplied by 10^6 to give mg/kg.
- Universe percentages are divided by 100 and multiplied by 10^6 (73.97% -> 739 700 mg/kg).

### Why these columns

- CRC is the column the task asked to prefer and the one most other tables derive from. C2 (Turekian 1970 via Kaye & Laby), C3 (Greenwood & Earnshaw), C4-C6 and U1-U2 (Taylor & McLennan, Shaw, Wänke, Weaver) are kept out to avoid mixing definitions of "crust".
- For the Sun / Solar System the data page has no CRC column. Y2 (Anders & Grevesse 1989) is the canonical meteoritic + photospheric compilation, covers more elements than S1 (Grevesse/Anders 1988 via Kaye & Laby, with several values marked "about"), and carries per-element uncertainties on the page.
- Human: the data page has no human column. *Composition of the human body* has the only element-by-element table with explicit references; the alternative table on *Abundance of the chemical elements* has no citation.
- Universe: only ten elements exist as cited numbers on Wikipedia (Croswell 1996). Everything else is `null` rather than borrowed from the Solar System column, which is a different quantity (atom ratio vs. mass fraction) in a different medium.

### Values deliberately left null

- Human N ("0.02–0.03") and Ca ("0.011–0.015") are ranges on the page; a midpoint would be an invented number. Also null: Y, Bi, Tl, In, Sc, Ta, Th, U, Sm, W, Be, Ra (rows exist, fraction cell blank).
- Any blank cell on the data page (it still carries `data-sort-value="0.0"` for sorting; the script treats blank text as null, so Tc, Pm and the transuranics are null, not zero).
- `universe` for the 108 elements Croswell's table does not list.

## Licensing reasoning

Facts and measurements are not copyrightable (US: *Feist v. Rural*, 1991; the EU database right does not
apply to a handful of numbers copied from a US handbook, and this is a non-commercial educational site).
What is protected is the expression around them: Wikipedia's prose and table arrangement are
CC BY-SA 4.0; the CRC Handbook, Kaye & Laby, Greenwood & Earnshaw and the journal papers are
copyrighted works whose *selection and text* we do not copy. We quote one number per element per
medium, we attribute Wikipedia (page name, revision, link) and the handbook or paper by name, exactly
as the page does, and the JSON `source` block carries both. The pipeline copies no Wikipedia prose,
so the CC BY-SA share-alike obligation attaches at most to the table arrangement, and our arrangement
(one column per medium, re-unitized) is our own. Conclusion: ship the numbers with the two-level
attribution already in the JSON; show "Fuente: CRC Handbook vía Wikipedia (CC BY-SA)" style credits
in the app, and link the page.

## Other sources checked (2026-10-21)

- **Wikidata**: the only relevant-sounding property is P2374 "natural abundance", which is *isotopic*
  abundance. There is no property for crust / ocean / body / cosmic abundance. Not a source here.
- **CRC Handbook online** (hbcp.chemnetbase.com): subscription, proprietary. Not usable directly.
- **Kaye & Laby online** (NPL): the free site was retired in 2019; mirrors exist but the license was
  Crown copyright with permission to use, not an open license. The data page already carries its columns (C2, W2, S1, Y1).
- **USGS**: publishes mineral commodity data, not a complete crustal-abundance table under a free license.
  Rudnick & Gao (2003, *Treatise on Geochemistry*) is the modern standard for the crust but is Elsevier-copyrighted and not freely hosted.
- **Solar System**: Lodders (2003, *ApJ*), Lodders, Palme & Gail (2009), Asplund et al. (2009, 2021,
  *A&A*) are the modern references and are on arXiv (open access to read; the tables remain the authors'/publisher's
  expression, same facts reasoning as above). Asplund 2021 would replace Anders & Grevesse 1989 if a future
  session wants the newest photospheric values.
- **Human body**: Emsley, *Nature's Building Blocks* (OUP) is the usual popular reference (the "Mass (kg)" column
  on the Wikipedia page cites it). No permissively licensed element-by-element table was found; NIH/FDA
  publish dietary reference intakes, not body composition.
- **Universe**: no keyless tabular source beyond Croswell via Wikipedia. Asplund 2021 protosolar mass
  fractions or the NASA/IPAC-hosted compilations would be the upgrade.
- **PubChem Periodic Table** (NIH, public domain): has discovery year, melting point, etc. but no abundance columns.
- **Los Alamos periodic table**: prose, no table.

## Known weaknesses

- "Crust" means different things (bulk continental, upper continental, whole crust). We use CRC's
  continental-crust medians only; do not mix in other columns without changing the `ref`.
- Sea-water values are medians of surface measurements; trace metals vary by orders of magnitude with location and depth.
- The human column mixes five references with different body models (70 kg reference man); values are
  rounded to one or two significant figures on the page.
- The universe column is the Milky Way, not the observable universe, and is a 1996 popular-science book's table.
- Wikipedia tables can change; the revision ids pin what we parsed. Re-running against a new revision may
  change column positions. The parser locates columns by header text (C1, W1, Y2, "Fraction of mass", "Mass fraction"), so header renames break it loudly rather than silently.

## For a future session

1. Decide whether N and Ca in the human column should carry a range (`[lo, hi]`) instead of null; the app
   would need to render ranges.
2. Consider Asplund et al. 2021 for `sun` (mass fractions, newest) and derive `universe` from its protosolar
   values with an explicit "protosolar, not galactic" label.
3. If the owner wants a single consistent crust model, Rudnick & Gao 2003 via a secondary free source
   (e.g. the GERM reservoir database at earthref.org, which republishes compiled reservoir compositions) is the candidate; check its terms first.
4. Re-run `npm run abundance` after clearing `data/cache/wikipedia-html/` to refresh revisions; diff the JSON.
