# Kongila FRD Implementation Checklist

This checklist maps the Talent Portal FRD and Admin Portal FRD to the current codebase so implementation work can be traced back to source requirements.

Source documents:
- [Talent Portal FRD](./talent_portal_frd_vol2.md)
- [Admin Portal FRD](./admin_portal_frd_vol4.md)

## Talent Portal

Current primary code surface:
- [apps/kongila-web/components/TalentDashboard.tsx](/Users/oluwadammilola/benita/kongila/apps/kongila-web/components/TalentDashboard.tsx#L216)

| FRD module | Implementation checklist | Current code surface | Notes |
| --- | --- | --- | --- |
| KT-HOME | Aggregated dashboard load, conditional widgets, top-priority profile completion bar, unread notification badge | `TalentDashboard.tsx` dashboard section and section router | Core shell exists; verify load aggregation and conditional rendering rules from the FRD. |
| KT-PROFILE | Editable profile sections, computed completion percentage, validation, scroll-to-first-missing-field behavior | `TalentDashboard.tsx` profile and profile detail sections | Check that save flow and completion calculation match the FRD exactly. |
| KT-DOCS | Document list, upload/versioning, mandatory signatures, document status tracking | `TalentDashboard.tsx` documents section | Must preserve version history and document lifecycle rules from the FRD. |
| KT-VETTING | Full 7-stage pipeline, stage-specific actions, reassessment rules, stage deadlines, assessment launch | `TalentDashboard.tsx` vetting section | Existing UI covers the pipeline; confirm the FRD-specific state transitions and escalation rules. |
| KT-SCORES | Composite score, grade bands, trend indicators, score breakdown | `TalentDashboard.tsx` scores section | Ensure score calculation weights and grade thresholds are sourced from the FRD. |
| KT-OPPS | Opportunity cards, shortlist states, client-request handling, hire outcomes | `TalentDashboard.tsx` opportunities section | Needs the FRD’s opportunity lifecycle and notification triggers. |
| KT-INTERVIEW | Interview confirmation window, timezone conversion, private notes, reminder handling | `TalentDashboard.tsx` interviews section | Timezone and confirmation rules are important acceptance points here. |
| KT-CONTRACTS | Contract history, active contract state, contract status transitions, employment history view | `TalentDashboard.tsx` contracts section | Make sure contract states and the employment-history model match the FRD. |
| KT-EARNINGS | Earnings summary, payout history, pending payout states, payment visibility rules | `TalentDashboard.tsx` earnings section | Read-only financial presentation should match the FRD’s timing and visibility rules. |
| KT-TASKS | Remotan workspace handoff, task access, task completion entry points | `TalentDashboard.tsx` tasks section | This is a link-out module rather than a reimplementation. |
| KT-MSG | Inbox view, message threads, attachment handling, escalation paths | `TalentDashboard.tsx` messages section | Confirm unread-count behavior and message thread rules. |
| KT-NOTIF | Notification history, unread/read transitions, filtering, badge synchronization | `TalentDashboard.tsx` notifications section | Badge accuracy across screens is a named FRD requirement. |
| KT-SETTINGS | Account settings, notification preferences, timezone preferences, security controls | `TalentDashboard.tsx` settings section | Confirm account-control surface and permission constraints. |
| KT-SUPPORT | Ticket creation, ticket status tracking, FAQ search, reopen window, SLA tracking | `TalentDashboard.tsx` support section | Make sure support routing, SLA behavior, and reopen rules are preserved. |

## Admin Portal

Current primary code surfaces:
- [apps/admin-panel/pages/index.tsx](/Users/oluwadammilola/benita/kongila/apps/admin-panel/pages/index.tsx#L93)
- [apps/admin-panel/pages/talents/[id].tsx](/Users/oluwadammilola/benita/kongila/apps/admin-panel/pages/talents/[id].tsx#L1)
- [apps/admin-panel/pages/clients/[id].tsx](/Users/oluwadammilola/benita/kongila/apps/admin-panel/pages/clients/[id].tsx#L1)

| FRD module | Implementation checklist | Current code surface | Notes |
| --- | --- | --- | --- |
| KA-TALENT | 7-stage pipeline kanban, stage review actions, scoring, question-bank management, audit logging | `index.tsx` talent pipeline and vetting blocks | Strongest current coverage; validate every stage action against the FRD workflow rules. |
| KA-CLIENT | Client list, client drill-down, request and contract visibility, org-level state | `index.tsx` client pipeline and `clients/[id].tsx` | Current code supports the view, but confirm it covers the FRD’s full management workflow. |
| KA-REQUESTS | Intake request queue, request status updates, re-hire approvals, request-to-match handoff | `index.tsx` hiring requests block and request handlers | Needs FRD-specific routing, priorities, and escalation handling. |
| KA-MATCH | Shortlist generation, match inspection, interview request acceptance, override actions | `index.tsx` matching block and match handlers | The workflow exists; verify match scoring and override rules from the FRD. |
| KA-CONTRACTS | Contract drafting, signing, activation, termination, contract history | `index.tsx` contracts block and contract handlers | Current UI is present; confirm the document lifecycle and approval semantics. |
| KA-FINANCE | Invoice tracking, payout records, payment status, financial summaries | `index.tsx` Remotan payroll block | Financial data exists under the Remotan area; the Admin FRD finance module may still need a dedicated surface. |
| KA-ANALYTICS | Operational metrics, live platform KPIs, dashboards, trend cards | `index.tsx` overview block and Remotan overview block | Existing overview screens provide a base; check whether FRD analytics scope is broader. |
| KA-USERS | User management, role and permission administration, account lifecycle | No dedicated current admin tab observed | This is a likely gap to plan for. |
| KA-SETTINGS | System settings, platform configuration, policy controls | No dedicated current admin tab observed | This is a likely gap to plan for. |
| KA-AUDIT | Immutable audit trail, chronological entity timeline, security event filtering, export | `index.tsx` audit log block plus audit writers in workflow handlers | Audit display exists; confirm the FRD’s immutability and export requirements. |

## Cross-Document Gaps To Confirm

- Talent FRD items that depend on timing, unread counts, timezone conversion, or conditional rendering should be verified against the current data flows before implementation starts.
- Admin FRD modules for user management and system settings do not appear as dedicated current tabs, so they may require new surfaces rather than a light refactor.
- The finance scope is partially represented in the Remotan payroll area; confirm whether the Admin FRD expects a separate Kongila finance workspace.
- Audit logging is present in the current admin shell, but the FRD may require stronger immutability, filtering, and export guarantees.
