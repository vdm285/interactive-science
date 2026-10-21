# EDITORIAL.md — how a screen speaks

Updated 2026-10-21. This is the rule the app follows.

We do not promise a neutral voice. We promise that every claim can be traced.

- **Numbers** come from the files under `public/data/`, each with a `source` block naming the dataset, its license and the retrieval or build date. The Datos panel shows the source id next to every row. A number that no source has is absent, never estimated.
- **Photographs of elements** are Wikimedia Commons files, shown with the author, the license and a link to the file page. Most are from the "Images of elements" collection (FAL or CC BY-SA 3.0 de). When Commons has no photograph of a sample, the Bohr drawing stands in and the screen says so; for the synthetic elements it says why.
- **Spectra** are drawn from NIST ASD line lists: each bar is an observed wavelength, its brightness is NIST's relative intensity normalized to the element's strongest visible line. NIST's intensities are not comparable between elements and the caption says so. No line is added for looks.
- **Isotopes** are the IAEA Live Chart's ground states (NUBASE2020, ENSDF). "Stable" means the source says so; bismuth-209 is therefore radioactive on our screen, with a note. Half-lives keep the source's unit.
- **History** is Wikidata, CC0. When Wikidata has several dates we show the earliest and list the rest; when it has none we say so and fall back to PubChem's year with that credit. Ancient elements are "known since antiquity", and Wikidata's "circa 5000 BCE" appears as what it is.
- **Abundance** figures are quoted one per medium from the references Wikipedia's data page cites (CRC Handbook, Anders & Grevesse, Croswell, the human-body composition table); the panel names the reference per bar and links the page.
- **Long paragraphs** are Wikipedia's introductions, in the interface language when that article exists, linked and credited CC BY-SA 4.0. The Materia panel keeps them one tap away behind "Leer"; the Datos panel shows both languages.
- **Gallery images** are the ones the Wikipedia articles themselves use, with their captions (Spanish first), author and license. Diagrams of the periodic table, electron shells, icons and anything under 400 px are filtered out at build time.
- **Minerals and objects** are what Wikidata files under the element: minerals whose formula carries it, objects and alloys made from it. The panel shows them as Wikidata's own labels with each photo's Commons license, ranked by how many Wikipedias describe them, and says so. Wikidata is a filing cabinet: an odd item is a curation entry in `data/overrides/things.json`, not a hand edit.
- **Videos** are the Periodic Videos episodes (University of Nottingham, Brady Haran), embedded from YouTube through the privacy-enhanced player only after the reader taps the poster. We name the channel and link the site. Nothing is downloaded or re-hosted. They are in English and the panel says so.
- **Interface words** are ours, Spanish first, and never carry a fact that the data does not. Hooks and "did you know" lines were removed on purpose: if we cannot cite it, we do not say it.
- **The Bohr drawing** is labeled a simplified model, always.
- **The "ask an AI" link** opens the reader's own browser on Google AI Mode with a prepared prompt. Nothing is sent until the reader clicks; the app makes no AI calls.
- Media is genuine, never synthetic. No generated images, no synthesized voices, no "artist's impression" presented as the element.
