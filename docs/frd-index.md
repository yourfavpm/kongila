# FRD Index

This index ties the Kongila Talent Portal FRD and Kongila Admin Portal FRD together with the implementation checklist.

## Primary References

| Area | Document | Purpose |
| --- | --- | --- |
| Talent Portal | [docs/talent_portal_frd_vol2.md](./talent_portal_frd_vol2.md) | Source FRD for the talent-facing portal, module by module. |
| Admin Portal | [docs/admin_portal_frd_vol4.md](./admin_portal_frd_vol4.md) | Source FRD for the admin-facing portal, module by module. |
| Implementation Checklist | [docs/frd-implementation-checklist.md](./frd-implementation-checklist.md) | Working map from FRD requirements to current code surfaces. |

## Current Code Surfaces

| Portal | Code entry point | What it currently covers |
| --- | --- | --- |
| Talent Portal | [apps/kongila-web/components/TalentDashboard.tsx](/Users/oluwadammilola/benita/kongila/apps/kongila-web/components/TalentDashboard.tsx#L216) | Main talent dashboard shell and section router for the talent experience. |
| Admin Portal | [apps/admin-panel/pages/index.tsx](/Users/oluwadammilola/benita/kongila/apps/admin-panel/pages/index.tsx#L93) | Main admin shell, navigation, dashboard, talent, client, requests, matching, contracts, compliance, assessments, support, audit, and Remotan areas. |
| Admin Client Detail | [apps/admin-panel/pages/clients/[id].tsx](/Users/oluwadammilola/benita/kongila/apps/admin-panel/pages/clients/[id].tsx#L1) | Client drill-down page for request and contract review. |
| Admin Talent Detail | [apps/admin-panel/pages/talents/[id].tsx](/Users/oluwadammilola/benita/kongila/apps/admin-panel/pages/talents/[id].tsx#L1) | Talent drill-down page for detailed profile review and manager assignment. |

## Recommended Reading Order

1. Read the portal FRD that matches the area you are changing.
2. Open the implementation checklist and find the relevant module row.
3. Inspect the linked code surface before making any implementation decision.
4. Keep this index open when moving between Talent and Admin work so the references stay aligned.
