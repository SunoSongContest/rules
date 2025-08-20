# SSC Data Files Management

## CSV Files Structure

### Votes List (SSC6_Votes_list.csv)
Required columns:
- Song name
- Week 
- Points
- Weekly rank
- Result (Finalist/2nd Chance/Winner/2nd-place/3rd-place/BBN)
- Voting details (12,10,8,7,6,5,4,3,2,1 points)
- Number of voters
- Average points

### Submissions List (SSC6_submissions.csv) 
Required columns:
- Discord username
- Discord display name
- Suno username
- Song title
- Song URL
- Country
- Brand new
- Week
- Voting code
- Votes
- Finalist
- Welcome message

## Adding New SSC Edition

1. Create two CSV files following the naming convention:

Where x is the edition number

2. Update csv-manifest.js:
```javascript
window.CSV_MANIFEST = {
    editions: {
        6: {
            votes: 'SSC6_Votes_list.csv',
            submissions: 'SSC6_submissions.csv'
        },
        7: {
            votes: 'SSC7_Votes_list.csv', 
            submissions: 'SSC7_submissions.csv'
        }
        // Add new editions here
    }
};

## Edition-config schema (edition-config / csv-manifest)

The site uses an edition-specific configuration (the "edition-config") to describe how CSVs for each SSC edition are laid out and how the normalization/advancement logic should treat the data. The canonical manifest object lives in [`assets/js/csv-manifest.js`](assets/js/csv-manifest.js:14) and is consumed by the loader in [`assets/js/data-handlers.js`](assets/js/data-handlers.js:62).

Key fields in an edition-config:
- `formatVersion` — numeric version used to detect parsing compatibility. See the SSC7 example in [`assets/js/csv-manifest.js`](assets/js/csv-manifest.js:51).
- `files` — object with `votes` and `submissions` filenames (relative to `assets/csv/`) used by the loader.
- `columnMap` (optional) — maps canonical field names to CSV column indexes for editions with different CSV column orders. Example keys: `id`, `songName`, `stageLabel`/`week`, `pointsRaw`, `votes12` .. `votes1`, `numVoters`, `avgPoints`, `weeklyRank`, `result`, `bonusPoints`. See the sample map in [`assets/js/csv-manifest.js`](assets/js/csv-manifest.js:57).
- `orderedStages` (optional) — UI ordering metadata used to present weeks/stages in a non-numeric order (bunks, showcases, track save, 2nd chance, finals). See the example in [`assets/js/csv-manifest.js`](assets/js/csv-manifest.js:79).
- `rules` (optional) — data-driven advancement and special rules (bunk advancement, track save behavior, second-chance rules, bonus handling). See the SSC7 `rules` example in [`assets/js/csv-manifest.js`](assets/js/csv-manifest.js:87).

How the manifest is used
- The loader calls `window.CSV_MANIFEST.getEditionConfig(edition)` to obtain the edition configuration: see [`assets/js/csv-manifest.js`](assets/js/csv-manifest.js:125).
- `loadEditionData` in [`assets/js/data-handlers.js`](assets/js/data-handlers.js:62) fetches the CSVs specified in `files` and then calls the parsing/normalization functions.
- The app exposes canonical votes objects to the rest of the UI. The canonical fields expected by the UI are listed in the normalization step in [`assets/js/data-handlers.js`](assets/js/data-handlers.js:97). Typical canonical fields:
  - `id`, `songName`, `stage` (or `week`), `pointsRaw`, `bonusPoints`, `pointsFinal`, `numVoters`, `avgPoints`, `weeklyRank`, `result`, and `votes12`..`votes1`.

Bonus points handling

The manifest supports edition-specific bonus handling configuration so the UI and normalization layer know whether to include bonus points in displayed totals and advancement calculations.

Relevant example from the SSC7 sample manifest:
- [`rules.bonusHandling`](assets/js/csv-manifest.js:105) contains:
  - `enabled` (boolean) — whether a bonus column is present and should be considered.
  - `columnName` (string) — the canonical column name mapped in `columnMap` where bonus points exist (e.g., `bonusPoints`). See the sample at [`assets/js/csv-manifest.js`](assets/js/csv-manifest.js:105).
  - `pointsIncludeBonus` (boolean) — when true, the normalization should add the bonus value to the base points to produce `pointsFinal`. When false, `pointsFinal` should equal `pointsRaw` and `bonusPoints` should be shown separately.

Normalization behavior (implementation notes)
- If `rules.bonusHandling.enabled` is true and `columnMap` points to a bonus column index, the parser will read the bonus value (if present) and store it on the canonical object under `bonusPoints`. The parser code that reads CSV rows lives in [`assets/js/data-handlers.js`](assets/js/data-handlers.js:149).
- Default behavior when no bonus column exists:
  - `bonusPoints` is set to 0.
  - `pointsFinal` falls back to `pointsRaw`.
- If `pointsIncludeBonus === true`, normalization should compute:
  - `pointsFinal = parseInt(pointsRaw) + parseInt(bonusPoints || 0)`
  - otherwise `pointsFinal = parseInt(pointsRaw)`
- All numeric fields should be parsed into numbers before sorting/advancement comparisons (see parsing and the usage in charts/podium code in [`assets/js/data-handlers.js`](assets/js/data-handlers.js:466)).

Practical guidance for adding a new edition with bonus points
1. Add your CSV files into `assets/csv/` (votes + submissions).
2. Update the manifest in [`assets/js/csv-manifest.js`](assets/js/csv-manifest.js:14) with:
   - `files.votes` and `files.submissions` filenames.
   - A `columnMap` mapping canonical keys to the correct zero-based column indexes in your CSV. If your CSV has a bonus column, include `bonusPoints` mapping to the bonus column index (see sample at [`assets/js/csv-manifest.js`](assets/js/csv-manifest.js:57)).
   - Under `rules`, set `bonusHandling.enabled: true` and `bonusHandling.pointsIncludeBonus: true|false` depending on whether you want bonus points to be added into totals used for ranking and advancement.
3. The loader will parse and normalize rows based on `columnMap` and `rules` and the UI will use the canonical `pointsFinal` and `bonusPoints` fields for display and advancement decisions.

Notes and troubleshooting
- If your CSV layout differs significantly from the canonical expectations, add a precise `columnMap`. The parser expects zero-based column indexes.
- If the manifest is missing or incorrectly configured for an edition, `loadEditionData` will log a warning and skip that edition (see [`assets/js/data-handlers.js`](assets/js/data-handlers.js:66)).
- To inspect how the canonical object looks after normalization, check the place where `window.votes` is assigned: [`assets/js/data-handlers.js`](assets/js/data-handlers.js:98).

If you want, I can also add a short example showing a concrete `columnMap` + `rules` JSON snippet for a new edition (copyable into `assets/js/csv-manifest.js`) and a short test CSV row illustrating how bonus points are parsed.
