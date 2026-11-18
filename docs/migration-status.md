# Django retirement · 18 November 2026

The active frontend runs solely against Express. Startup no longer installs Django, selects a backend mode, intercepts localStorage writes or polls shared state. Python is retained for face processing. The original Django source, database and media remain in `backend/` for recovery. Earlier frontend components are retained as reference and are outside the active route tree.

## Local cutover

The importer was rehearsed against a separate SQLite database. The local cutover started from a SQLite backup of the previous Express database. It imported five accounts, one event, one team, two submissions (including one checksum-verified PDF), one judge assignment and four scan logs. It also preserved the redeemed entry pass and all 15 raw shared-state records. The unchanged source can be imported again without overwriting account passwords or duplicating records.

The original event has no recorded owner. An internal archival identity with no usable credentials holds the event and represents unrecorded historical scanner identity. No real admin acquired access to that team's private data. New events use the authenticated organizer as owner. Imported accounts retain their original password hashes and rehash to bcrypt on eligible successful logins.

## Repeat on another installation

1. Freeze legacy writes, back up the source database, its media, the destination SQLite database, uploads and biometrics. Browser-only records must be exported separately from any unsynchronized clients.
2. From `backend-node/`, set `LEGACY_DATABASE_PATH` to the source SQLite file. Set `DB_FILE_NAME` and `UPLOAD_DIR` to **separate working copies**. The importer expects legacy PDFs beneath `media/` beside the source database.
3. Run `npm run import:legacy -- --dry-run` for the source inventory. Run `npm run db:migrate` and `npm run import:legacy` against the copies. A second identical import reports `already imported`. Conflicting accounts/IDs or unresolved dependencies stop the transaction. If inputs change after import, review the differences.
4. Verify foreign keys, record counts, password compatibility, PDF contents and permissions. Deploy the validated destination with its uploads. Keep the source offline. To roll back before accepting new writes, restore the previous application release **and its matching database and assets**. Reconcile any new writes before rolling back later.

## Coverage

Express serves event creation, team registration, PDF/repository submissions, pass redemption, event announcements, support threads, judge assignments and human-score results. The browser also supports photo registration and matching through the private vision service.

Legacy AI reviews, weighted scores, original rounds/criteria, cached posts and other unmodeled state remain in the private raw archive. They are not reconstructed as active features. No legacy embedding was promoted to an active face profile. Participants can enroll through the new service. The importer targets the observed legacy formats; review newly encountered raw keys or media before cutover elsewhere.
