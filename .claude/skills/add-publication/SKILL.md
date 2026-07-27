---
name: add-publication
description: Add or update a paper on publications.html using verified bibliographic metadata. Use whenever the user mentions a new paper, asks to update publications, or asks about his citation list. Enforces the rule that no citation is ever written from memory or guessed.
---

# Adding a publication

**No citation goes on the site unless it was verified against a real record.**
Titles, venues, page numbers and years are exactly the kind of detail that is
easy to get subtly wrong, and this is a professional CV page.

## Sources, in order

1. **OpenAlex** — full works list, no auth, no rate limit worth worrying about:
   ```bash
   curl -s "https://api.openalex.org/works?filter=author.id:A5073995173&per-page=100&sort=publication_date:desc&mailto=issamsayyaf97@gmail.com"
   ```
2. **Semantic Scholar** — independent cross-check (author id `2213316182`):
   ```bash
   curl -s "https://api.semanticscholar.org/graph/v1/author/2213316182/papers?fields=title,year,venue,externalIds,authors&limit=100"
   ```
3. **Crossref** — the authoritative container title for a DOI:
   ```bash
   curl -s "https://api.crossref.org/works/<DOI>"
   ```

**Google Scholar serves a captcha** to automated fetches (profile
`user=lFrypJ8AAAAJ`). Do not burn turns on it — use the APIs.

If a paper appears in none of them, it is probably too recent to be indexed.
**Ask the user for the exact title and venue.** Do not reconstruct it.

## Writing the entry

`publications.html` groups by year with `archive__subtitle` headings, then one
`list__row` per paper:

```html
<div class="list__row">
  <div class="list__row-side"><span class="page__taxonomy-item">Journal</span></div>
  <div>
    <h3>Exact Title As Published</h3>
    <p style="margin:.4em 0 0;font-size:.88em"><strong>M. I. Sayyaf</strong>, N. Zhu, V. Renaudin</p>
    <p class="venue">Venue, vol. X, no. Y, pp. A–B, Month Year</p>
    <p style="margin:.4em 0 0;font-size:.85em">
      <a href="https://doi.org/10.xxxx/yyy" target="_blank" rel="noopener">doi.org/10.xxxx/yyy</a></p>
  </div>
</div>
```

Conventions already in use:

- Kind tag is `Journal`, `Conference` or `Dataset`.
- Authors are initials + surname, in publication order, with **his name bolded**.
  He is indexed as *Mohamad Issam Sayyaf*; render `M. I. Sayyaf`.
- En-dash for page ranges (`43603–43619`).
- Omit the DOI paragraph entirely when there is no DOI (e.g. workshop papers).
- Newest year first; within a year, journals before conferences.

## Known state

8 papers are indexed and listed. His CV claims "10+" and names **IEEE I2MTC
2026** and **IPIN 2026**, neither of which is indexed anywhere — they are
deliberately absent. If the user supplies those titles, add them.

The page **does not print a publication count**, on purpose: a "10+" claim above
a list of 8 contradicts itself. Do not reintroduce a number unless the list
supports it.

There is **no ORCID id on file** — never link a bare `orcid.org` placeholder.

## After editing

Screenshot the page and confirm the year grouping and DOI links render, then run
the `verify-site` sweep.
