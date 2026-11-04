# Kongila API artifacts

These files are safe to share with developers and import into API clients:

- `openapi.yaml` is the canonical OpenAPI 3.1 contract.
- `kongila.postman_collection.json` is a smoke-test collection.
- `kongila.postman_environment.json` contains placeholder variables only.

## Postman

1. Import the collection and the environment.
2. Select **Kongila staging**.
3. Set `baseUrl` and `adminBaseUrl` to the actual staging application URLs.
4. Sign in through Supabase Auth using a test account for the role being tested.
5. Copy that user's short-lived access token into `accessToken`.
6. Run **Authentication and health** first, then the role-specific folders.
7. Never put a Supabase service-role key in Postman or a browser.

The collection deliberately tests the server routes directly. It does not call Supabase tables from the browser and it does not include the deprecated `/api/db` write contract.

## Swagger UI

The OpenAPI file can be loaded into Swagger UI, Redoc, Insomnia, or Postman's OpenAPI importer. Before publishing a public documentation site, replace the example staging server URLs and add an authenticated staging-only documentation environment. Do not publish real access tokens, service-role keys, or production credentials.

## Release gate

The artifacts are created, but production readiness still requires:

- authenticated integration tests for each role;
- a clean staging Postman rehearsal;
- response examples checked against live staging;
- publishing Swagger UI or another protected documentation site.

