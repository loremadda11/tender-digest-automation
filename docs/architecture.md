# Architecture notes

## Components

| Component | Responsibility |
| --- | --- |
| Mail flow | Lightweight filtering and attachment acquisition |
| Shared document library | Durable hand-off between cloud and local processing |
| Folder processor | Stability checks, exclusive locking, output-collision handling, and archiving |
| Report generator | Text extraction, parsing, ranking, and DOCX generation |
| Delivery flow | Filename validation, file retrieval, and email delivery |

## Failure strategy

The processor exposes a file to the output folder only after report generation succeeds. Failed inputs stay available for inspection, while successful inputs are archived. A stale lock can be removed after a configurable interval.

## Production hardening ideas

- use a service account and a dedicated always-on host;
- add structured JSON logging and centralized alerts;
- store a source hash instead of relying only on the report date;
- add malware scanning before local processing;
- replace folder synchronization with a queue or serverless function at larger scale;
- validate PDFs by MIME type and signature, not only by extension;
- add integration tests against a disposable Microsoft 365 environment.
