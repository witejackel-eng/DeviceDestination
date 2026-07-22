# Product source audit

Verification date: 22 July 2026

The 19 existing catalogue identities were preserved. Two NVR model strings were corrected because exact CP Plus pages and the existing local documents agree on the `CP-UNR` identity. The first dome-camera route and five local image filenames were also corrected to the full `CP-UNC-DA41L3C-D-Q` identity after the files were byte-matched to the manufacturer product page.

| Product          | Old value                       | Corrected value                             | Official source                            | Reason                                                                                                                                         |
| ---------------- | ------------------------------- | ------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 8-channel NVR    | `CP-UNC-108F1`                  | `CP-UNR-108F1`                              | https://cpplusworld.com/cp-unr-108f1       | Official product page and exact datasheet use `UNR`; the old slug remains an alias.                                                            |
| 16-channel NVR   | `CP-UNC-4K2161`                 | `CP-UNR-4K2161-V2`                          | https://cpplusworld.com/cp-unr-4k2161-v2   | Official product page and exact datasheet identify the V2 NVR; the old slug remains an alias.                                                  |
| 4 MP dome camera | `cp-unc-da41l3c-q` route/assets | `CP-UNC-DA41L3C-D-Q` canonical route/assets | https://cpplusworld.com/cp-unc-da41l3c-d-q | The existing first image hash exactly matched the official D-Q asset; all five filenames now carry the full model and the old route redirects. |

No other product identity was silently replaced. Unsubstantiated star ratings, popularity labels and “authorised dealer” language from the reference implementation were not migrated.
