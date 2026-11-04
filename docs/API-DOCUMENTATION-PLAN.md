# Kongila API documentation and testing plan

This is the API contract plan for the Kongila client portal, talent portal, and admin portal. Remotan is excluded from this launch and this documentation.

## Contract rule

OpenAPI must describe the server API contract, not the current React implementation. An endpoint is production-ready only when it:

- Reads and writes Supabase data.
- Does not depend on browser-side business writes.
- Verifies the bearer token.
- Enforces role and ownership checks on the server.
- Validates its request body.
- Returns documented success and error responses.
- Has an automated test and a Postman staging test.

The browser may use Supabase Auth for sign-in, sign-out, and session refresh. Business mutations must go through application API routes.

## API resource layout

The portals should use resource-specific APIs instead of posting a whole database snapshot.

```text
Identity and organization
GET/PATCH  /api/profile
GET/PATCH  /api/organization
POST       /api/company/invite
POST       /api/company/verify-invite

Talent and documents
GET/PATCH  /api/profile/talent
GET/POST   /api/documents
PATCH/DELETE /api/documents/:id
GET/POST   /api/documents/:id/versions
POST       /api/vetting/:talentId/decision

Requests and matching
GET/POST   /api/requests
GET/PATCH  /api/requests/:id
POST       admin /api/requests/status
GET/POST   /api/requests/:id/matches
PATCH      /api/matches/:id

Support
GET/POST   /api/support/tickets
GET        /api/support/tickets/:id
POST       /api/support/tickets/:id/messages
PATCH      /api/support/tickets/:id

Interviews
GET/POST   /api/interviews
POST       /api/interviews/:id/respond
POST       /api/interviews/:id/reschedule
POST       /api/interviews/:id/cancel
POST       /api/interviews/:id/rate

Messaging and notifications
GET/POST   /api/messages
GET        /api/notifications
POST       /api/notifications/read

Offers, contracts, signatures, and finance
GET/POST   /api/offers
POST       /api/offers/:id/respond
POST       /api/offers/:id/decide
GET/POST   /api/contracts
PATCH      /api/contracts/:id
POST       /api/contracts/:id/sign
GET/POST   /api/signatures
GET        /api/finance/invoices
POST       /api/finance/payment-intents
GET/POST   /api/finance/payroll
```

These are the target contracts. Existing routes should be migrated into them before being marked production-ready.

## Authentication

Every protected request uses the Supabase access token:

```http
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

The server derives the user ID, role, organization, and talent identity from the verified session. Clients must not be trusted to submit those values.

Recommended statuses:

| Status | Meaning |
| --- | --- |
| `200` | Successful read or update |
| `201` | Resource created |
| `204` | Successful operation with no body |
| `400` | Malformed request |
| `401` | Missing or invalid session |
| `403` | Authenticated but forbidden |
| `404` | Resource does not exist or is not visible |
| `409` | Duplicate or business conflict |
| `422` | Invalid business values |
| `429` | Rate limit exceeded |
| `500` | Unexpected server failure |

Use one error shape everywhere:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be saved.",
    "fields": { "serviceType": "This field is required." }
  },
  "requestId": "request-id"
}
```

Never return raw Supabase errors, SQL, stack traces, service-role details, or secrets.

## OpenAPI / Swagger

Create the canonical specification at:

```text
docs/api/openapi.yaml
```

It must contain:

- OpenAPI 3.1.
- Staging and production server variables.
- A bearer security scheme named `supabaseBearer`.
- Reusable schemas under `components.schemas`.
- Reusable error responses under `components.responses`.
- Pagination parameters and response schemas.
- Stable `operationId` values.
- Role requirements in operation descriptions.
- Request and response examples taken from staging.
- No `/api/db` POST operation.
- No Remotan operation.

Swagger UI can later render this file from an admin-only documentation page or a versioned documentation site. Swagger must never contain a service-role key; its Authorize button should accept only a temporary staging token.

## Postman collection

Create:

```text
docs/api/kongila.postman_collection.json
docs/api/kongila.postman_environment.json
```

The environment should contain:

```text
baseUrl       http://localhost:3000
adminBaseUrl  http://localhost:3002
accessToken   <temporary staging token>
requestId     <saved by a create-request test>
ticketId      <saved by a create-ticket test>
interviewId   <saved by a schedule-interview test>
```

Organize the collection into:

- Authentication setup
- Client workflows
- Talent workflows
- Admin workflows
- Support
- Interviews
- Messaging
- Offers and contracts
- Finance
- Negative authorization tests

Every protected request includes:

```http
Authorization: Bearer {{accessToken}}
```

Postman tests should assert the expected status, required response fields, acceptable response time, and that a created record can be read after a new request.

## Staging rehearsal

1. Sign in as a staging client and store the access token.
2. Create or load the client's organization.
3. Create a client request.
4. Sign in as admin and verify the request is visible.
5. Advance a talent through approved vetting stages.
6. Create and approve a match.
7. Verify the client sees only the approved match.
8. Schedule an interview and verify it as client, talent, and admin.
9. Create a support ticket as client.
10. Create a support ticket as talent.
11. Reply and resolve both tickets as admin.
12. Run the negative authorization tests with the wrong user token.
13. Repeat reads after refresh and sign-out/sign-in.

## Migration checklist before publishing the API

- [ ] Replace direct browser table writes with server APIs.
- [ ] Replace whole-database `/api/db` POST writes.
- [ ] Stop swallowing Supabase write errors.
- [ ] Stop returning empty or stale data as if it were current.
- [ ] Add resource-specific request and response types.
- [ ] Add API integration tests.
- [ ] Add the canonical `docs/api/openapi.yaml`.
- [x] Add the Postman collection and environment template under `docs/api/`.
- [x] Publish the canonical OpenAPI artifact under `docs/api/openapi.yaml`.
- [ ] Add Swagger UI or publish the OpenAPI artifact through the production docs site.
- [ ] Version breaking API changes.

## API release gate

- [ ] `pnpm test` passes with zero failures.
- [ ] `pnpm build` passes with zero failures.
- [ ] Every documented endpoint has an automated test.
- [ ] Every mutation returns a confirmed database result.
- [ ] Invalid tokens are rejected.
- [ ] Role and ownership restrictions have negative tests.
- [ ] The Postman staging rehearsal passes from a clean environment.
- [ ] Swagger examples match actual staging responses.
- [ ] No undocumented browser-side business write remains.
