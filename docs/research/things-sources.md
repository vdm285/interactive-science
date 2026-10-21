# Things per element: minerals, ores, objects. Sources, what worked, what did not

Date: 2026-10-21. Pipeline: `tools/build-things.mjs` -> `public/data/things/{z}.json` (cap 30 KB each) and
`public/data/things/index.json`. Curation: `data/overrides/things.json`. Caches under `data/cache/things/`,
`data/cache/wiki-category/`, `data/cache/wikidata-entities/`, `data/cache/commons-info/`.

Goal: for each element, the minerals and ores it comes from and the everyday objects and materials it is
made into, each with a Commons photograph and Spanish and English labels. Nothing is written by hand: every
item is a Wikidata item, every label is a Wikidata label, every photo is that item's own P18 image.

## What we ship

Per element: `minerals[]` and `objects[]`, at most 12 each, each item `{ qid, es, en, formula?, via?, photo, wiki }`.
`photo` is `{ file, thumb (500 px), src (1280 px), artist, license, licenseUrl, page }`, thumbnails through
`commonsThumb` at standard widths only. `wiki` holds the eswiki and enwiki article titles (or null).
`via` on objects says which route found it (`made`, `alloy`, `made:Q34095` = made of bronze, `part`, `use`, `uses`,
`override`). Labels fall back es -> mul -> en and en -> mul -> es; the run prints how many Spanish labels are
really English (`esFallback`).

Coverage of the 2026-10-21 run, all 118 elements: 739 minerals for 72 elements (55 of them at the cap of 12)
and 197 objects for 40 elements (11 at the cap: C, Al, Fe, Ni, Cu, Zn, Ag, Sn, Au, Pb, Ti). 936 items in all,
697 KB over 119 files, the largest 18.7 KB (titanium), index 3.9 KB. Minerals are absent where nature has none
with a photo in Wikidata: He, Ne, Ar, Kr, Xe, Tc, Pm, most lanthanides past Nd, Po-Ac, Pa and everything past
U. Objects are absent for 78 elements; that is Wikidata's "made from material" coverage, not a filter artefact
(see the thin list below). 174 of the 936 items have no Spanish label in Wikidata and show the English or
language-neutral one.

Test elements (minerals / objects, first three of each):

| Z | minerals | objects |
|---|---|---|
| 26 Fe | 12: hematite, pyrite, magnetite | 12: anvil, pickaxe, iron ore |
| 29 Cu | 12: turquoise, malachite, azurite | 12: bronze, brass, integrated circuit |
| 79 Au | 12: electrum, sylvanite, calaverite | 12: fountain pen, gold medal, inkwell |
| 6 C | 12: diamond, coal (override), graphite | 12: cast iron, cogwheel, carbon nanotube |
| 14 Si | 12: quartz, amethyst, topaz | 10: integrated circuit, SIM card, processor |
| 13 Al | 12: clay, ruby, sapphire | 12: Airbus A380, integrated circuit, iPhone 5 |
| 16 S | 12: gypsum, pyrite, cinnabar | 2: gunpowder (override), flare |
| 80 Hg | 12: cinnabar, calomel, metacinnabar | 2: mercury switch, McLeod gauge |
| 74 W | 12: wolframite, scheelite, ferberite | 2: electric light, electrical filament |

## Sources tested (on Fe, Cu, Au, C, Si, Al, S, Hg, W)

### Minerals

| route | result | verdict |
|---|---|---|
| A. Wikidata items `P31/P279* mineral (Q7946)` with `P527 has part` or `P186 made from` = the element | 0 to 3 hits per element, all museum specimen records ("Native gold-MCG 79456", 1 sitelink) | junk, dropped |
| B. Items typed mineral species (Q12089225), mineral variety (Q429795), mineral series (Q3965281), mineral group (Q1936581) or mineral (Q7946) whose chemical formula `P274` contains the symbol | 5,745 items have a formula; iron matches 1,244, tungsten 30, gold 30; the famous ones lead once ranked by sitelinks (hematite 73, pyrite 72, magnetite 68) | **used**: the backbone |
| C. enwiki `Category:<Element> minerals` and eswiki `Categoría:Minerales de <elemento>` via `generator=categorymembers` + `pageprops.wikibase_item` | enwiki has 61 by-element categories (`Category:Minerals by element`); eswiki has them for most metals but no parent category; sizes: Fe 105 en / 279 es, Al 246 / 234, W 18 / 10 (`tungsteno`; `wolframio` has 1), none for C, S, O, N, H | **used** as a supplement: it is the only route to rocks and mixtures with no formula (bauxite, limonite, clay, wolframite, tourmaline) |

Notes on B. The match is `Symbol(?![a-z])` after removing superscripts and parenthesised Roman valences, so S does
not match Si/Sb/Sr, C does not match Ca/Cu/Cl, and I does not match Fe(III). It is deliberately literal: for
carbon it returns every carbonate (calcite, dolomite, malachite) after diamond and graphite; for oxygen and
hydrogen it returns oxides and hydrates (ruby, quartz, gypsum). That is true, if not what a geologist would
call "oxygen minerals"; the overrides file is where to prune. `P31/P279*` paths were avoided: the mineral
class tree answered 0 rows for a formula query in 440 ms (the species class is not reachable from Q7946 by
P279 in the current graph), so the five types are listed explicitly.

Filters on minerals: the item is not a chemical element (the "Mercury minerals" category contains mercury),
not a chemistry metaclass duplicate (Q113145171 "type of chemical entity", e.g. a second chalcopyrite with 1
sitelink), has a P18 image, has at least 3 sitelinks. The top 24 by sitelinks are fetched in detail; the first
12 whose photo passes `licenseOk` are kept.

### Objects and uses

| route | result | verdict |
|---|---|---|
| `P366 use` on the element item | 0 to 4 values per element (Fe: ferroalloy; Cu: heat sink, copper conductor; Al: dye; He, N, O: "food additive", their E-numbers) | thin but genuine, **used** |
| inverse `P186 made from material` = element | Cu 16,022 items (2,000 with an image), Fe 6,181, Au 16,013, W 5, Hg 6. Top of the list: anvil, pickaxe, fountain pen, gold medal, integrated circuit, SIM card, electric light, Statue of Liberty, Burj Khalifa, Eastern Ghats | **used**, the main route, after the class/instance split below |
| alloys: items with `P527`/`P186` = element under `P279+ alloy (Q37756)` | Cu: bronze (135 sitelinks), brass (114), nickel silver, Nordic gold; C: cast iron (80), invar; Fe: invar, iron-nickel alloy only (steel is not linked to iron by P527 or P186 in Wikidata) | **used**; the alloy itself is an object entry |
| objects made from the famous alloys (sitelinks >= 20) | brass instrument, bronze medal, sestertius, door knocker, 2 euro coin, cogwheel, kettlebell, cylinder block | **used** (`via: made:Q...`) |
| inverse `P527 has part` = element | gunpowder, iron ore, neodymium magnet, mercury switch, nickel-iron battery, but for carbon every organic substance: glucose, opium, starch, chlorophyll, kerosene, MDMA, casein, shellac | **used only for items under artificial physical object or ore**; gunpowder is a curated include |
| `P2283 uses` = element | wrought iron (Fe), goldsmithing (Au), Krytron (N), "organism" (O), Googie (Ne) | **used**, with the class test below |
| `P279* material (Q214609)` as the alloy hop | timed out at WDQS (60 s, 504) every time | dropped; `P279+ alloy` is fast |

Class versus instance. The inverse routes mix generic things (anvil: has `P279`) with specific instances
(Burj Khalifa: has only `P31`). The script keeps generic classes first, ranked by sitelinks, then at most four
instances, and an instance passes only if one of its `P31` types is under sculpture, monument, bridge, coin or
archaeological artefact (one `P279*` query on the type set per element). Buildings were tried and removed:
skyscrapers tagged "made from aluminium" (the facade) pushed aluminium foil, beverage cans and baseball bats
out of the top 12. Every generic class must itself be under artificial physical object, product, material,
alloy, ore, award or one of the landmark roots; that is what removes "organism" (uses oxygen), "Googie"
(uses neon), "H II region" (made of hydrogen) and "tap dance" (made of brass).

Blocked `P31` types, any route: human, taxon, chemical element, isotope, chemical compound, type of chemical
entity, structural class of chemical entities, group or class of chemical substances, periodic-table group,
geosphere, medication, remedy, the five mineral types, fictional, mythical and biblical objects, lost and
destroyed works, trademark, brand, mountain range, time capsule, specimen, sample, Wikimedia duplicate,
category and list items. "Type of mixture of chemical entities" is deliberately not blocked: it is cast iron,
pig iron, bronze and gunpowder.

Junk that the filters remove, from the test elements: Kahlúa (trademark, "made from silicon"), Eastern Ghats
(mountain range, "made from iron"), Apollo 11 goodwill messages (time capsule, silicon), The Crystal Palace
(destroyed building, iron), Madrid Atocha station (railway station made of iron; instance type not allowed),
Romaine lettuce (taxon, "has part iron"), ethanol and 450 other compounds with "has part carbon", glucose,
opium and starch (substances, not things), portland cement (typed brand).

What is still thin after all routes: sulfur (gunpowder, flare), mercury (mercury switch, McLeod gauge),
tungsten (electric light, filament), the noble gases, the halogens, the alkali metals and everything past
bismuth. Wikidata simply does not link thermometers, matches, fluorescent lamps, fireworks, salt shakers or
smoke detectors to their elements. That is curation work, not query work (see below).

## Licensing

- Wikidata statements, labels and sitelinks: CC0 1.0. The `source` block of every file says so and links the
  element item.
- Commons photographs: per file. The script reads `extmetadata` for every candidate P18 and keeps the first
  of up to three that is a raster image (no SVG, no GIF) and passes `licenseOk` (CC0, CC BY, CC BY-SA, public
  domain, FAL, GFDL; never NC or ND). Artist, license name, license URL and the file page travel with each
  item so the app can credit them. In the full run 2 candidates
  were dropped for their license and 15 for being SVG/GIF or not an image; the 936 kept photos are CC BY-SA 3.0
  (390), CC BY-SA 4.0 (250), public domain (129), CC BY 4.0 (48), CC BY 2.0/2.5/3.0 (54), ported CC BY-SA
  variants (33), CC0 (15), FAL (2), GFDL 1.2 (1), "Attribution" (1).
- Wikipedia categories are used only as a list of article titles joined to Wikidata; no prose is copied.
  Category membership itself is not creative expression.

## Cost and robustness

Zero cost, no keys. One cold run is about 40 minutes: 5 universe queries, then per element 2 to 4 category
calls, 5 object SPARQL queries (a single UNION query answered 504), 2 or 3 `P279*` set queries, a `wbgetentities`
batch for up to 48 items and up to 144 Commons metadata calls, all cached on disk; a warm run is minutes.
`THINGS_ONLY=26,29` limits a run; the index merges with the one on disk so a partial run never erases counts.

## What a future session should do

1. Curate the thin elements through `data/overrides/things.json` `include` lists, with the QIDs of things
   everyone knows: thermometer and fluorescent lamp (Hg), match and vulcanized rubber (S), light bulb and
   tungsten carbide drill bit (W), neon sign (Ne), balloon (He), table salt (Na, Cl), toothpaste (F), banana
   (K) is a taxon so no, pencil (C), battery (Li), glass (Si), steel (Fe: `Q11427` has no P527 iron in Wikidata).
   Each still needs a P18 photo with an accepted license, so the script stays the gatekeeper. Keep the
   `_note` per change.
2. Consider adding the enwiki anion categories (Carbonate minerals, Sulfide minerals, Sulfate minerals,
   Phosphate minerals, Oxide minerals, Halide minerals, Nitrate minerals, Borate minerals) as a route for C, S,
   P, O, Cl/F/Br/I, N and B; the formula route already covers them, so this would only change ranking.
3. Spanish labels: `esFallback` counts items whose Spanish label is really the English or mul one (obscure
   minerals: "aktashite", "christite"). Those could be set in Wikidata itself, which fixes every reuser.
4. Show `via` in the UI only as a tooltip; it is provenance, not prose. Rank display: minerals by the
   script's order (sitelinks), objects the same, which already puts bronze and brass before coins.
5. Do not add text or numbers from any other mineral site; Mindat and webmineral are copyrighted databases,
   and RRUFF/IMA list formulas but no photographs we may use.
