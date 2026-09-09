# 18 — WordPress integration

ART's public website is WordPress. ART Admin reads from it and writes a deliberately narrow set of tour fields back to it.

## Credentials and access

`WORDPRESS_BASE_URL`, `WORDPRESS_USERNAME`, `WORDPRESS_APPLICATION_PASSWORD` (an application password, not the account password). All calls go through the REST API. `wp-content-proxy` exists for content reads from the browser side without exposing credentials.

## Code

| Path | Role |
| --- | --- |
| `src/lib/mcp/wordpress/_client.ts` | REST client |
| `fieldMap.ts`, `editableFields.ts` | Which WordPress fields exist and which ART is allowed to write |
| `itinerary.ts`, `_itineraryArt.ts` | Itinerary read/preview/push |
| `inclusions.ts`, `_inclusionsArt.ts` | Inclusions/exclusions read/preview/push |
| `_media.ts` | Media search and upload |
| `_analyzer.ts`, `_audit.ts` | Diff analysis and audit logging |
| `artSources.ts` | Mapping ART content to website shapes |

| Table | Role |
| --- | --- |
| `wordpress_tour_links` | Links an ART tour to a WordPress tour post (32 links live) |
| `wordpress_field_mappings` | Field-level mapping configuration |
| `wordpress_integration_audit_logs` | Every read/write attempt with outcome |

## Write safety

- Only fields on the allowlist (`editableFields.ts`) can be written. Everything else on the website is read-only from ART's point of view.
- Pushes are preview-first: staff see a diff (`wordpress_preview_tour_itinerary`, `wordpress_preview_tour_inclusions`, `WordpressBulkDiffSection`) before anything is sent.
- Every write is recorded in `wordpress_integration_audit_logs`.
- Itinerary day photos sync **one way** into the website day gallery, maximum 3 photos per day.
- Initial reconciliation runs when a tour is first linked, so ART sees existing website content rather than overwriting it.

## Interfaces

Staff use the WordPress screens (`/wordpress`, `src/components/wordpress/*`) for linking, bulk matching, diffing and field mapping. The MCP server exposes the same operations as tools (see [19-mcp-current-state.md](19-mcp-current-state.md)).

## Limits and cautions

- WordPress is the public source of truth for marketing copy; ART is the source of truth for operational itinerary/inclusion content. Pushing overwrites the website field, so always review the diff.
- Application passwords can be revoked in WordPress without notice; failures surface as audit-log errors.
- Rate limiting and plugin behaviour on the WordPress host are outside ART's control; large bulk pushes should be done in batches.
- Whether every currently linked tour is fully reconciled is `UNVERIFIED`; check the audit log per tour.
