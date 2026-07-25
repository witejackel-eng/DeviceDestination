# DeviceDestination catalogue completion report

Generated 2026-07-22. The supplier/base-price inputs and margin calculations are intentionally not stored in this public repository. Customer-facing prices use integer paise, include GST under the site's central pricing policy, and do not display fabricated MRP or discounts.

## 1. Catalogue summary

- Original product count: 19
- Final product count: 30
- New exact-model products added: 11
- Existing source matches reviewed or updated: 10
- Duplicate source entries avoided: 13
- Unresolved and excluded: 26

## 2. Product-by-product status

| Supplied description                  | Verified model     | Site action       | Official source                                                                                    | Image         | Datasheet             | Manual                | Pricing                      | Notes                                                                                                              |
| ------------------------------------- | ------------------ | ----------------- | -------------------------------------------------------------------------------------------------- | ------------- | --------------------- | --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Netgear 120 W PoE switch              | GS108PP            | added             | [Official](https://www.netgear.com/in/business/wired/switches/unmanaged/gs108pp/)                  | Downloaded    | Downloaded            | Downloaded            | ₹10,980 incl. GST (verified) | Official model is rated for a 123 W PoE budget, not 120 W.                                                         |
| Netgear PoE switch                    | GS116PP            | added             | [Official](https://www.netgear.com/in/business/wired/switches/unmanaged/gs116pp/)                  | Downloaded    | Downloaded            | Downloaded            | ₹18,900 incl. GST (verified) | Exact 16-port, 183 W FlexPoE model verified.                                                                       |
| Netgear PoE switch                    | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | No current official GS716LP record found; GS116LP exists but was not substituted.                                  |
| CP Plus 2 MP camera                   | CP-UNC-DA21L3C-Q   | updated           | [Official](https://cpplusworld.com/cp-unc-da21l3c-q)                                               | Downloaded    | Downloaded            | Downloaded            | ₹2,537 incl. GST (verified)  | Existing exact-model product retained.                                                                             |
| CP Plus 8-channel NVR                 | CP-UNR-108F1       | updated           | [Official](https://cpplusworld.com/cp-unr-108f1)                                                   | Downloaded    | Downloaded            | Downloaded            | ₹4,708 incl. GST (verified)  | Existing exact-model product retained.                                                                             |
| CP Plus 8-port PoE switch             | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | The transcription does not match a current official SKU; similar 8-port models are not exact substitutes.          |
| Western Digital 4 TB surveillance HDD | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Capacity and product family are insufficient to establish an exact manufacturer part number.                       |
| Prama 2 MP dome camera                | PT-NC123D3-N(D2)   | added             | [Official](https://www.pramaindia.in/product/pt-nc123d3-nd2/)                                      | Downloaded    | Not available locally | Not available locally | ₹2,550 incl. GST (verified)  | Current official D2 turret model verified.                                                                         |
| Prama 4 MP dome camera                | PT-NC143D3-N(D2)   | added             | [Official](https://www.pramaindia.in/product/pt-nc143d3-nd2/)                                      | Downloaded    | Not available locally | Not available locally | ₹3,360 incl. GST (verified)  | Current official D2 turret model verified.                                                                         |
| Prama 32-channel NVR                  | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Official listings use PT-NRAS2A32-K2; the missing S was not silently corrected.                                    |
| Prama 4 MP bullet camera              | PT-NC140D3-N(D2)   | added             | [Official](https://www.pramaindia.in/product/pt-nc140d3-nd2/)                                      | Downloaded    | Not available locally | Not available locally | ₹3,360 incl. GST (verified)  | Current official D2 bullet model verified.                                                                         |
| Prama 4 MP colour dome camera         | —                  | unresolved        | [Official](https://www.pramaindia.in/product-category/network-camera/value-series-network-camera/) | Not published | Not applicable        | Not applicable        | Not published                | Current official model includes the (D2) generation suffix; source did not.                                        |
| Prama 4 MP colour bullet camera       | —                  | unresolved        | [Official](https://www.pramaindia.in/product-category/network-camera/value-series-network-camera/) | Not published | Not applicable        | Not applicable        | Not published                | Current official model includes the (D2) generation suffix; source did not.                                        |
| Prama 16-channel NVR                  | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Official model naming appears to include NRAS; exact source transcription needs confirmation.                      |
| CP Plus PTZ camera                    | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | The unreadable character cannot be resolved to one current official PTZ SKU.                                       |
| CP Plus 64-channel NVR, 8 SATA        | —                  | unresolved        | [Official](https://cpplusworld.com/cp-unr-4k564r8-fi)                                              | Not published | Not applicable        | Not applicable        | Not published                | Current official SKU ends FI; numeral 1 was not substituted for letter I.                                          |
| CP Plus 6 MP bullet camera            | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | No current official -G model found; the verified -LQ colour model is a separate catalogue entry.                   |
| eSSL X990                             | X990               | updated           | [Official](https://esslsecurity.com/fingerprint/x990)                                              | Downloaded    | Downloaded            | Downloaded            | ₹12,990 incl. GST (verified) | Removed the unsupported hyphen from the public model field while preserving the route.                             |
| eSSL F18                              | F18                | updated           | [Official](https://esslsecurity.com/fingerprint/f18)                                               | Downloaded    | Downloaded            | Downloaded            | ₹14,958 incl. GST (verified) | Existing exact model retained.                                                                                     |
| eSSL Vega with Wi-Fi and PoE          | VEGA+W+POE         | added             | [Official](https://esslsecurity.com/fingerprint/vegawpoe)                                          | Downloaded    | Downloaded            | Downloaded            | ₹16,470 incl. GST (verified) | Exact Wi-Fi and PoE variant verified.                                                                              |
| eSSL K30 Pro                          | K30 Pro            | updated           | [Official](https://esslsecurity.com/fingerprint/k30)                                               | Downloaded    | Downloaded            | Not available locally | ₹5,949 incl. GST (verified)  | Existing exact model retained.                                                                                     |
| eSSL K90 Pro                          | K90 Pro            | updated           | [Official](https://esslsecurity.com/fingerprint/k90-pro)                                           | Downloaded    | Downloaded            | Not available locally | ₹5,600 incl. GST (verified)  | Existing exact model retained.                                                                                     |
| eSSL F22                              | F22+ID+WIFI        | updated           | [Official](https://esslsecurity.com/fingerprint/f22)                                               | Downloaded    | Downloaded            | Downloaded            | ₹10,240 incl. GST (verified) | Official product name identifies the ID and Wi-Fi variant; route redirect retained.                                |
| eSSL AiFace Mars                      | AiFace Mars        | updated           | [Official](https://esslsecurity.com/face/aiface-mars)                                              | Downloaded    | Downloaded            | Downloaded            | ₹17,500 incl. GST (verified) | Existing exact model retained.                                                                                     |
| eSSL Face Magnum MB160                | MB160              | added             | [Official](https://esslsecurity.com/face/mb160)                                                    | Downloaded    | Downloaded            | Downloaded            | ₹11,850 incl. GST (verified) | Official model is MB160; 'Face Magnum' was treated as source description, not model text.                          |
| eSSL MB20                             | MB20               | added             | [Official](https://esslsecurity.com/face/mb20)                                                     | Downloaded    | Downloaded            | Downloaded            | ₹12,100 incl. GST (verified) | Exact face and fingerprint model verified.                                                                         |
| eSSL AiFace Mercury                   | AiFace Mercury     | added             | [Official](https://esslsecurity.com/face/aiface-mercury)                                           | Downloaded    | Downloaded            | Downloaded            | ₹12,450 incl. GST (verified) | Exact Wi-Fi/TCP-IP access variant verified.                                                                        |
| eSSL Face Neptune                     | AiFace Neptune     | added             | [Official](https://esslsecurity.com/face/aiface-neptune)                                           | Downloaded    | Downloaded            | Downloaded            | ₹15,850 incl. GST (verified) | Official product family is AiFace Neptune.                                                                         |
| U bracket                             | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | No manufacturer or compatible device was supplied; former store branding was not used as a physical-product brand. |
| CP Plus 4-channel NVR                 | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Multiple current 4-channel official SKUs exist.                                                                    |
| CP Plus 8-channel NVR                 | CP-UNR-108F1       | duplicate-avoided | [Official](https://cpplusworld.com/cp-unr-108f1)                                                   | Downloaded    | Downloaded            | Downloaded            | ₹4,708 incl. GST (verified)  | Matched the priced exact-model entry.                                                                              |
| CP Plus 16-channel NVR, 1 or 2 SATA   | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | SATA alternatives map to different exact SKUs.                                                                     |
| CP Plus 32-channel NVR, 2 or 4 SATA   | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | SATA alternatives map to different exact SKUs.                                                                     |
| CP Plus 2 MP dome IP camera           | CP-UNC-DA21L3C-Q   | duplicate-avoided | [Official](https://cpplusworld.com/cp-unc-da21l3c-q)                                               | Downloaded    | Downloaded            | Downloaded            | ₹2,537 incl. GST (verified)  | Matched existing exact IR dome model.                                                                              |
| CP Plus 2 MP bullet camera            | CP-UNC-TA21L3C-Q   | duplicate-avoided | [Official](https://cpplusworld.com/cp-unc-ta21l3c-q)                                               | Downloaded    | Downloaded            | Downloaded            | ₹2,537 incl. GST (verified)  | Matched existing exact IR bullet model.                                                                            |
| CP Plus 2 MP colour dome camera       | CP-UNC-DA21L3C-LQ  | duplicate-avoided | [Official](https://cpplusworld.com/cp-unc-da21l3c-lq)                                              | Downloaded    | Downloaded            | Downloaded            | ₹2,938 incl. GST (verified)  | Matched existing exact dual-light dome model.                                                                      |
| CP Plus 2 MP colour bullet camera     | CP-UNC-TA21L3C-LQ  | duplicate-avoided | [Official](https://cpplusworld.com/cp-unc-ta21l3c-lq)                                              | Downloaded    | Downloaded            | Downloaded            | ₹3,021 incl. GST (verified)  | Matched existing exact dual-light bullet model.                                                                    |
| CP Plus 4 MP dome camera              | CP-UNC-DA41L3C-D-Q | duplicate-avoided | [Official](https://cpplusworld.com/cp-unc-da41l3c-d-q)                                             | Downloaded    | Downloaded            | Downloaded            | ₹3,658 incl. GST (verified)  | Matched existing exact IR dome model.                                                                              |
| CP Plus 4 MP bullet camera            | CP-UNC-TA41L3C-Q   | duplicate-avoided | [Official](https://cpplusworld.com/cp-unc-ta41l3c-q)                                               | Downloaded    | Downloaded            | Downloaded            | ₹3,788 incl. GST (verified)  | Matched existing exact IR bullet model.                                                                            |
| CP Plus 4 MP colour dome camera       | CP-UNC-DA41L3C-LQ  | duplicate-avoided | [Official](https://cpplusworld.com/cp-unc-da41l3c-lq)                                              | Downloaded    | Downloaded            | Downloaded            | ₹3,953 incl. GST (verified)  | Matched existing exact dual-light dome model.                                                                      |
| CP Plus 4 MP colour bullet camera     | CP-UNC-TA41L3C-LQ  | duplicate-avoided | [Official](https://cpplusworld.com/cp-unc-ta41l3c-lq)                                              | Downloaded    | Downloaded            | Downloaded            | ₹4,024 incl. GST (verified)  | Matched existing exact dual-light bullet model.                                                                    |
| CP Plus 6 MP bullet camera            | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Generic IR description does not establish one SKU; supplied -G transcription was not verified.                     |
| CP Plus 6 MP colour bullet camera     | CP-UNC-TA61L3C-LQ  | added             | [Official](https://cpplusworld.com/cp-unc-ta61l3c-lq)                                              | Downloaded    | Downloaded            | Downloaded            | ₹5,129 incl. GST (verified)  | Current official catalogue resolves this description to one 6 MP dual-light bullet model.                          |
| CP Plus Cat 6 cable bundle            | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Official catalogue contains multiple Cat 6 conductor, jacket and length variants.                                  |
| Prama 2 MP dome camera                | PT-NC123D3-N(D2)   | duplicate-avoided | [Official](https://www.pramaindia.in/product/pt-nc123d3-nd2/)                                      | Downloaded    | Not available locally | Not available locally | ₹2,550 incl. GST (verified)  | Matched the priced exact-model entry.                                                                              |
| Prama 2 MP bullet camera              | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Multiple fixed, dual-light and smart official bullet SKUs exist.                                                   |
| Prama 2 MP colour dome camera         | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Current catalogue contains multiple WNM and WNMS variants.                                                         |
| Prama 2 MP colour bullet camera       | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Current catalogue contains multiple WNM and WNMS variants.                                                         |
| Prama 4 MP dome camera                | PT-NC143D3-N(D2)   | duplicate-avoided | [Official](https://www.pramaindia.in/product/pt-nc143d3-nd2/)                                      | Downloaded    | Not available locally | Not available locally | ₹3,360 incl. GST (verified)  | Matched the priced exact-model entry.                                                                              |
| Prama 4 MP bullet camera              | PT-NC140D3-N(D2)   | duplicate-avoided | [Official](https://www.pramaindia.in/product/pt-nc140d3-nd2/)                                      | Downloaded    | Not available locally | Not available locally | ₹3,360 incl. GST (verified)  | Matched the priced exact-model entry.                                                                              |
| Prama 4 MP colour dome camera         | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Likely WNM(D2), but the source omits the generation suffix.                                                        |
| Prama 4 MP colour bullet camera       | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Likely WNM(D2), but the source omits the generation suffix.                                                        |
| Prama 4-channel NVR                   | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Multiple official value and pro-series SKUs exist.                                                                 |
| Prama 8-channel NVR                   | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Multiple official value and pro-series SKUs exist.                                                                 |
| Prama 16-channel NVR, 2 or 4 SATA     | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | SATA alternatives and the typed priced entry do not establish one exact model.                                     |
| Prama 32-channel NVR, 2 or 4 SATA     | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | SATA alternatives and the typed priced entry do not establish one exact model.                                     |
| D-Link Cat 6 cable bundle             | —                  | unresolved        | —                                                                                                  | Not published | Not applicable        | Not applicable        | Not published                | Length, conductor, jacket and exact part number were not supplied.                                                 |
| eSSL F22 ID + Wi-Fi                   | F22+ID+WIFI        | duplicate-avoided | [Official](https://esslsecurity.com/fingerprint/f22)                                               | Downloaded    | Downloaded            | Downloaded            | ₹10,240 incl. GST (verified) | Same official product as the corrected existing F22 record.                                                        |
| eSSL SF100                            | SF100              | updated           | [Official](https://esslsecurity.com/fingerprint/sf100)                                             | Downloaded    | Not available locally | Not available locally | ₹8,250 incl. GST (verified)  | Price researched and checkout re-enabled with a fresh public listing.                                              |
| eSSL FR1200                           | FR1200             | updated           | [Official](https://esslsecurity.com/fingerprint/fr1200)                                            | Downloaded    | Downloaded            | Not available locally | ₹5,899 incl. GST (verified)  | Exact reader and current tax-inclusive price reverified.                                                           |

## 3. Ambiguous and unresolved products

- **Netgear PoE switch (GS716LP):** No current official GS716LP record found; GS116LP exists but was not substituted.
- **CP Plus 8-port PoE switch (CP-DNW-GPU8G2-96):** The transcription does not match a current official SKU; similar 8-port models are not exact substitutes.
- **Western Digital 4 TB surveillance HDD:** Capacity and product family are insufficient to establish an exact manufacturer part number.
- **Prama 32-channel NVR (PT-NRA52A32-K2):** Official listings use PT-NRAS2A32-K2; the missing S was not silently corrected.
- **Prama 4 MP colour dome camera (PT-NC143D3-WNM):** Current official model includes the (D2) generation suffix; source did not.
- **Prama 4 MP colour bullet camera (PT-NC140D3-WNM):** Current official model includes the (D2) generation suffix; source did not.
- **Prama 16-channel NVR (PT-NRA52A16-K2):** Official model naming appears to include NRAS; exact source transcription needs confirmation.
- **CP Plus PTZ camera (CP-UNC-DA52?L10-DAP):** The unreadable character cannot be resolved to one current official PTZ SKU.
- **CP Plus 64-channel NVR, 8 SATA (CP-UNR-4K564R8-F1):** Current official SKU ends FI; numeral 1 was not substituted for letter I.
- **CP Plus 6 MP bullet camera (CP-UNC-TA61L3C-G):** No current official -G model found; the verified -LQ colour model is a separate catalogue entry.
- **U bracket:** No manufacturer or compatible device was supplied; former store branding was not used as a physical-product brand.
- **CP Plus 4-channel NVR:** Multiple current 4-channel official SKUs exist.
- **CP Plus 16-channel NVR, 1 or 2 SATA:** SATA alternatives map to different exact SKUs.
- **CP Plus 32-channel NVR, 2 or 4 SATA:** SATA alternatives map to different exact SKUs.
- **CP Plus 6 MP bullet camera:** Generic IR description does not establish one SKU; supplied -G transcription was not verified.
- **CP Plus Cat 6 cable bundle:** Official catalogue contains multiple Cat 6 conductor, jacket and length variants.
- **Prama 2 MP bullet camera:** Multiple fixed, dual-light and smart official bullet SKUs exist.
- **Prama 2 MP colour dome camera:** Current catalogue contains multiple WNM and WNMS variants.
- **Prama 2 MP colour bullet camera:** Current catalogue contains multiple WNM and WNMS variants.
- **Prama 4 MP colour dome camera:** Likely WNM(D2), but the source omits the generation suffix.
- **Prama 4 MP colour bullet camera:** Likely WNM(D2), but the source omits the generation suffix.
- **Prama 4-channel NVR:** Multiple official value and pro-series SKUs exist.
- **Prama 8-channel NVR:** Multiple official value and pro-series SKUs exist.
- **Prama 16-channel NVR, 2 or 4 SATA:** SATA alternatives and the typed priced entry do not establish one exact model.
- **Prama 32-channel NVR, 2 or 4 SATA:** SATA alternatives and the typed priced entry do not establish one exact model.
- **D-Link Cat 6 cable bundle:** Length, conductor, jacket and exact part number were not supplied.

## 4. Published pricing report

No source cost or margin data is shipped to the client bundle. New sale prices were calculated offline from the supplied source inputs using the requested approximately 22% commercial markup and clean rupee rounding; public retailer prices were used as a reasonableness check. Existing approved storefront prices were retained except where the task supplied a verified current public-price correction. All compare-at values remain empty unless independently verifiable.

| Model              | Published price | Status   | Verified at              | Treatment                                    |
| ------------------ | --------------: | -------- | ------------------------ | -------------------------------------------- |
| CP-UNC-DA41L3C-D-Q |          ₹3,658 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| CP-UNC-TA41L3C-Q   |          ₹3,788 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| CP-UNC-DA41L3C-LQ  |          ₹3,953 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| CP-UNC-TA41L3C-LQ  |          ₹4,024 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| CP-UNC-DA21L3C-Q   |          ₹2,537 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| CP-UNC-TA21L3C-Q   |          ₹2,537 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| CP-UNC-DA21L3C-LQ  |          ₹2,938 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| CP-UNC-TA21L3C-LQ  |          ₹3,021 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| CP-UNR-108F1       |          ₹4,708 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| CP-UNR-4K2161-V2   |          ₹7,422 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| X990               |         ₹12,990 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| F22+ID+WIFI        |         ₹10,240 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| F18                |         ₹14,958 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| SF100              |          ₹8,250 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| K30 Pro            |          ₹5,949 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| FR1200             |          ₹5,899 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| K90 Pro            |          ₹5,600 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| AiFace Mars        |         ₹17,500 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| AiFace Mars + HID  |         ₹19,900 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| GS108PP            |         ₹10,980 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| GS116PP            |         ₹18,900 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| PT-NC123D3-N(D2)   |          ₹2,550 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| PT-NC143D3-N(D2)   |          ₹3,360 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| PT-NC140D3-N(D2)   |          ₹3,360 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| CP-UNC-TA61L3C-LQ  |          ₹5,129 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| VEGA+W+POE         |         ₹16,470 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| MB160              |         ₹11,850 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| MB20               |         ₹12,100 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| AiFace Mercury     |         ₹12,450 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |
| AiFace Neptune     |         ₹15,850 | verified | 2026-07-22T00:00:00.000Z | GST included; no unverified compare-at price |

## 5. Asset report

- New official product images downloaded: 11
- New official datasheet files downloaded: 7
- New official manual/installation files downloaded: 8
- Published products without a local datasheet: SF100, PT-NC123D3-N(D2), PT-NC143D3-N(D2), PT-NC140D3-N(D2)
- Published products without a local manual/installation guide: SF100, K30 Pro, FR1200, K90 Pro, AiFace Mars + HID, PT-NC123D3-N(D2), PT-NC143D3-N(D2), PT-NC140D3-N(D2)
- Rejected assets: reseller-watermarked images, screenshots, remote hotlinks and family documents that did not name the exact model.

## 6. Duplicate and correction report

- Thirteen generic or repeated source entries were matched to exact records and were not duplicated.
- CP Plus NVR records were kept under their verified UNR identifiers, with legacy routes retained.
- X-990 was corrected to X990.
- F22 was corrected to the exact F22+ID+WIFI variant while preserving its old route.
- The unresolved CP Plus -G camera was not silently changed; CP-UNC-TA61L3C-LQ is a separately verified exact product.
- Similar Prama NRAS and CP Plus FI model codes were not substituted for mistyped source strings.

## 7. Important files changed

- `src/data/catalogue-expansion.ts`: eleven exact-model product records and sale prices.
- `src/data/catalogue-research-manifest.ts`: disposition and evidence for all 60 source entries.
- `reports/catalogue-audit-2026-07-22.json`: machine-readable pre-migration audit.
- `src/data/catalog.ts`: merged catalogue, corrections, current public-price overrides and expanded search.
- `src/app/products/page.tsx`: relevant resolution, PoE, authentication, availability and price filters.
- `src/components/home-motion.tsx`: decorative brand and section entrance animations at the time of this migration. These were removed in 0569a48 along with GSAP and Anime.js; the component is now a no-op.
- `src/components/hero-products.tsx`: Motion carousel with reduced-motion handling at the time of this migration. Since replaced by `src/lib/home/hero-products.ts`.
- `src/lib/compare-store.ts`: same-product-group comparison enforcement.

## 8. Test results

- `npm run products:validate`: passed for 30 products with zero duplicate IDs, slugs or models; zero missing assets, model mismatches or broken references.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 4 files and 26 tests.
- `npm run build`: passed; all 30 product routes generated.
- `SKIP_BUILD=1 npm run test:e2e`: passed full desktop/mobile workflows, WCAG serious/critical checks and responsive layout checks at 320, 375, 430, 768, 1024 and 1440 px.

## 9. Required business confirmations

- Confirm that the storefront's centrally configured GST-inclusive policy remains correct for every new SKU.
- Confirm warranty terms before making stronger claims than the OEM documents.
- Confirm official MRP before enabling any compare-at price or discount badge.
- Confirm the mistyped/unclear CP Plus and Prama model numbers listed above.
- Confirm the physical manufacturer of the U bracket; the retired KonnectEdge brand was not published.
- Supply exact manufacturer part numbers for the Western Digital drive, generic cameras, NVRs and cable bundles.
