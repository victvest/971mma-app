# Mindbody cost and launch audit — 4 September 2026

## Payment evidence and exact reconciliation

The supplied bank transaction is a **rejected attempt to collect USD 36.38**, displayed as **AED 133.65**. The bank gives “Wrong expiry date” as the rejection reason. It is not an itemized Mindbody invoice, and this transaction does not establish successful payment.

The current [Mindbody developer pricing page](https://developers.mindbodyonline.com/) displays:

- Site Access: USD 0.002 per call.
- Free API access for developers with **under 5,000 calls per billing cycle**. This wording does not establish a 5,000-call deduction once the threshold is crossed.
- Consumer Bookings: USD 15 per location per integration, USD 1.30 per class booking, USD 2.50 per appointment booking, and free virtual bookings. Do not add these to this gym’s bill without confirming the billing category.

USD 36.38 / USD 0.002 = **18,190 calls**, **only if the entire charge is Site Access call usage with no other adjustments**. This is a reconciliation hypothesis, not a finding that 18,190 calls were made. The bank’s displayed exchange rate is rounded and does not independently explain the exact AED amount.

The [current pricing FAQ](https://developers.mindbodyonline.com/ui/faq) says billing starts with live integration/API usage and repeats on the same calendar day. Closed testing against live gym data can therefore contribute before the app’s public launch. First receipt of a bank transaction since 20 June does not establish the invoiced period.

The old `/resources/faqs` page still describes 1,000 calls/day and one-third-cent overages. It conflicts with the current pricing page; do not use that older description to reconstruct this charge.

**Missing evidence:** Developer Portal → Reports → Invoice Details for the relevant billing cycle; also Activity by Studio and Booking Detail if applicable. These establish the actual cycle, call count, locations, bookings, and any adjustments/taxes. The app database cannot substitute for Mindbody’s billable-usage ledger.

## Read-only production observations

Queried the linked Supabase project without invoking live check-ins or changing production records.

| Observation | Result |
| --- | --- |
| Retained daily quota rows start | 27 July 2026 |
| July counted attempts in retained rows | 555 |
| August counted attempts | 5,446 |
| September 1 | 1,157 |
| September 2 | 611 |
| September 3 | 531 |
| September 4 at inspection | 144; incomplete day |
| Linked app accounts | 100; not daily active users |
| Webhook events currently recorded | 0 |
| Pending sync jobs | 32; oldest created 28 July |
| Failed visit jobs since September 1 | 24 quota errors; 449 unlinked-account errors |

These counters count **quota attempts**, including denied attempts before an HTTP request is sent. They are neither successful requests nor an exact billed-call count. They omit direct requests made outside this shared proxy, and retained rows do not cover the whole period since 20 June. Calendar-month totals may differ from the invoice’s billing cycle.

No deployed `MB_DAILY_QUOTA` override was listed. The shared code defaults to **1,000 attempts/day**, then rejects requests. Recorded job failures confirm that the quota error has occurred. Do not confuse this application cutoff with Mindbody’s current pricing threshold or vendor rate limits.

The scheduled membership-refresh function exists locally but was absent from the deployed function list. `gate-sync-jobs` is deployed. Pending jobs alone do not prove whether a worker scheduler is configured or why processing stalled; scheduler execution still needs inspection.

## Where the integration makes calls

| Work | Mindbody requests in the inspected code |
| --- | --- |
| Membership refresh | `/client/activeclientmemberships` + `/client/clientcontracts`: 2 calls |
| Class schedule refresh | `/class/classes`: 1 per 100-result page, subject to existing cache |
| Visit history refresh | `/client/clientvisits`: 1 per 100-result page over the existing 365-day range |
| Gate arrival | `/client/addarrival`; a payment-required rejection can trigger 2 live membership reads |
| Background membership refresh | The same 2 membership endpoints when the queued job runs |
| Class roster | `/class/classvisits`, followed by client-detail batches and possible individual fallback lookups |
| Linking/admin/member identity | `/client/clients` lookups |
| Programs/staff/diagnostics | Program, session-type, staff, and site endpoints |
| Authentication/retries | `/usertoken/issue` when needed; each actual retry is another outbound attempt |

The membership screen’s refresh path deliberately sends `force: true`. Preserving that is appropriate for the requested freshness. The current app source contains no `mb-book` invocation, although a deployed legacy `mb-book` function exists; this does not prove that no booking fees are billed elsewhere.

## Implemented locally

1. **Schedule requests share unfinished work** for the exact same normalized date range inside one Edge isolate. No completed response is retained by this mechanism. Explicit `force: true` requests bypass sharing. Different ranges remain separate. Existing empty-result behavior and the two-minute schedule cache policy remain in place.
2. **Token retry correction:** a 401-triggered token refresh is not repeated unnecessarily on subsequent 429 retries. Existing retry limits, read-only fallback, and authenticated arrival-write behavior are preserved.
3. **Schedule completion marker:** cache success is published after cancellation/tombstone updates succeed. A failed update can no longer create a new success marker.
4. **Actual outbound request logs:** structured `mindbody_request` events contain endpoint category, HTTP method, status, and elapsed time. Query strings, request/response bodies, credentials, and member identifiers are omitted. These logs are diagnostic evidence, not invoices or a permanent billing ledger; retention depends on the logging configuration.

No UI files, membership policy, gate eligibility rules, existing cache durations, quotas, or production configuration were changed. These improvements are **not deployed**; they have not reduced the live bill yet. Shared-module changes require redeploying each intended consuming function, not just editing `_shared` locally. Existing unrelated working-tree edits must be kept out of any deployment bundle.

## Verification and limits

- New Deno regression suite: **11 steps passed**, with type checking enabled.
- Changed production modules: **Deno type checks passed**.
- Existing gate suite: **11 runtime tests passed**, including QR reuse prevention, repeated facility entry, live membership fallback, and VIP access.
- Full type checking of the existing gate suite remains blocked by pre-existing nullable-client-ID and `unlimited` membership-source type errors in already modified files. Runtime results do not remove those errors.
- Concurrency test: **25 concurrent non-forced requests → 1 upstream call** in a single worker. This is not an estimate of whole-system savings: separate Edge isolates do not share this in-memory map, and explicit refreshes are intentionally excluded.
- Tests verified forced reads, changed membership data on subsequent reads, independent writes, pagination, failed shared-request cleanup, complete schedule mapping, cancellation failures, and log redaction. They use synthetic data and a fake HTTP/database boundary, not production load.

Reproduce with Deno installed:

```sh
deno check --no-lock supabase/functions/_shared/mindbody.ts supabase/functions/mb-schedule/index.ts
deno test --no-lock --allow-env supabase/functions/_shared/mindbody.test.ts
deno test --no-lock --no-check --allow-env supabase/functions/_shared/accessControl.test.ts
```

## Before the launch event

The priority is preventing quota-induced failures and confirming freshness, not merely shrinking this USD 36.38 charge:

1. Reconcile the invoice and correct the card expiry in the appropriate payment settings; payment was rejected.
2. Confirm the vendor’s burst/daily limits and choose an explicit application quota with sufficient launch headroom. The existing 1,000-attempt cutoff has already produced failures. No quota was silently raised in this patch.
3. Verify webhook subscription delivery and worker scheduling; investigate pending jobs. Zero recorded events is insufficient evidence for relying on webhooks for freshness.
4. Isolate deployment artifacts from unrelated edits, resolve the existing gate type errors, deploy the intended functions, and check live membership/schedule parity and error logs with a rollback available.

“Always up to date” is not currently an established guarantee: ordinary schedule reads already allow a two-minute cache, and webhook delivery is unverified. These changes do not add a longer freshness window. Literal zero regression cannot be proven by a finite test suite.

Illustrative Site Access costs at USD 0.002/call, using the bank’s displayed 3.67 conversion and excluding other charges:

| Monthly calls | USD | Approx. AED |
| --- | ---: | ---: |
| 30,000 | 60 | 220 |
| 100,000 | 200 | 734 |
| 300,000 | 600 | 2,202 |

User counts alone cannot forecast these costs. Measure refreshes, pages, retries, admin work, and background work, then estimate the launch traffic from that mix.
