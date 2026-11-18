# API contracts: Express migration foundation

The compatibility endpoints below are implemented in `backend-node/`. They run against a new SQLite database and are not yet the live Django backend.

The Express frontend uses these contracts for the connected event slice. Login additionally returns `id`. PDF upload additionally returns `id` for linking submissions; downloads require a bearer token and allow the uploader or the organizer of an event to which the document was submitted. `GET /api/hackathons/:id/submissions` returns submissions only to that event's organizer. Team and check-in lists have the same organizer restriction. Registration enforces the UTC calendar-date deadline and rejects member emails already registered in the event. Presentation links must use HTTPS.

Requesting another unused pass replaces its secret and invalidates the previous pass. A redeemed pass cannot be replaced. Redemption and its audit log commit in one transaction. Password creation enforces bcrypt's 72 UTF-8 byte limit; longer legacy passwords remain in their existing hash format after successful verification.

| Endpoint | Request | Response / rules |
| --- | --- | --- |
| `POST /api/auth/signup/` | Email, `username`, password, `role: "student"`, optional 10-digit `phone_number` | Creates a student. Judge/admin creation is intentionally rejected; these roles must be provisioned. |
| `POST /api/auth/login/` | Email, password, role | Returns `access`, role, email and username. Django PBKDF2-SHA256 hashes are verified, then upgraded after a successful login. |
| `GET /api/auth/me` | Bearer token | Returns the authenticated user. |
| `POST /api/auth/pdf-upload/` | Bearer token and one `file` multipart field | Requires a valid PDF signature and a maximum size of 10MB. Returns the legacy-compatible URL and filename shape. |
| `GET /media/:id` | Bearer token | Owner or admin can download a document. |
| `POST /api/face/register` | Bearer token and one image `file` | Express stores the biometric profile after the private service creates an embedding. |
| `POST /api/face/verify?email=` | Bearer token and one image `file` | A user can verify only their own profile; admins can verify a named profile. The threshold is server-owned. |
| `GET /api/hackathons` | None | Lists public hackathon records. |
| `POST /api/hackathons` | Admin bearer token and event dates/team limits | Creates a hackathon after date and team-size validation. |
| `POST /api/hackathons/:id/registrations` | Student bearer token, team name, members | Creates one led team per student/event in a database transaction. Member emails must be unique and fit the event team limits. |
| `GET /api/hackathons/:id/registrations/me` | Student bearer token | Returns the caller's led team and members. |
| `GET /api/hackathons/:id/registrations` | Admin bearer token | Lists teams and members for that event. |
| `POST /api/hackathons/:id/submissions/github` | Student bearer token, public GitHub URL | Creates or updates the student's repository submission. |
| `POST /api/hackathons/:id/submissions/presentation` | Student bearer token, link or owned PDF ID | Creates or updates one presentation submission for a round. |
| `GET /api/hackathons/:id/submissions/me` | Student bearer token | Lists the caller's submissions for an event. |
| `POST /api/hackathons/:id/check-ins/token` | Student bearer token, `entry` or meal purpose, day | Issues one opaque, 12-hour check-in token per purpose/day for the caller's team; only its hash is stored. |
| `POST /api/check-ins/redeem` | Admin bearer token and opaque token | Redeems a token atomically. Duplicate, expired, invalid, and meal-before-entry attempts are rejected and logged. |
| `GET /api/hackathons/:id/check-ins` | Admin bearer token | Returns server-side scan logs for an event. |

Every new error has `{ "error": { "code", "message", "fields?" } }`. `/api/auth/sync/` is deliberately absent from the new API; its source records are preserved in `LegacyState` during import until their domain migrations are complete.

Within `/api/hackathons/:id`, GET `/announcements` and GET `/leaderboard` are public. The event owner can POST `{message}` to `/announcements` or POST `{teamId,email}` to `/assignments` for an existing judge. Judges GET `/api/judge-assignments` and PUT `{score,feedback}` to `/api/judge-assignments/:id/score` on their own assignments. Scores are integers from 0 to 100.

Students POST `{subject,message}` to the event's `/tickets` endpoint. GET returns only the student's own threads or, for the event owner, all event threads. Both can POST `{message}` to `/tickets/:ticket/messages`. Only the event owner can PATCH `/tickets/:ticket` with `{status}` (Open, In Progress, Resolved).
