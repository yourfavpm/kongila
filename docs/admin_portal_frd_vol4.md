# Kongila Admin Portal FRD

Source: `FRD Vol4 AdminPortal.pdf`
Total pages: 27

This file is a page-ordered text extraction of the FRD for long-term reference during implementation. Line wrapping and table spacing reflect the source PDF extraction.

## Metadata
- title: Kongila & Remotan FRD — Volume 4 of 5 — Kongila Admin Portal
- author: Kongila Product Team
- subject: 
- keywords: 
- creator: Writer
- producer: LibreOffice 24.2
- creationDate: D:20260630194115Z'
- modDate: 
- format: PDF 1.7

## Page 1

KONGILA & REMOTAN
Functional Requirements Document — v2.0
  Volume 4 of 5 — Kongila Admin Portal 
All 10 Admin Portal modules, fully specified

## Page 2

6. Kongila Admin Portal — Module-by-Module 
Specification
The Admin Portal sidebar (visible per role, per the permission matrix in Section 2.2.4) contains 10 distinct 
modules. Each is treated below as its own complete module. Admin Portal modules are where the 
operational actions referenced from the Talent and Client Portals (e.g., Stage 1 review, matching, 
contract generation) are actually performed.
#
Sidebar Item
Module Code
Section
Primary Roles
1
Talent Management
KA-TALENT
6.1
Talent Manager, Ops 
Manager
2
Client Management
KA-CLIENT
6.2
Account Manager, Ops 
Manager
3
Service Requests
KA-REQUESTS
6.3
Account Manager, Ops 
Manager
4
Matching Engine
KA-MATCH
6.4
Talent Manager, Ops 
Manager
5
Contracts & Compliance
KA-CONTRACTS
6.5
Account Manager, Ops 
Manager
6
Financial System
KA-FINANCE
6.6
Finance Admin
7
Analytics Dashboard
KA-ANALYTICS
6.7
All admin roles (scoped)
8
User Management
KA-USERS
6.8
Super Admin only
9
System Settings
KA-SETTINGS
6.9
Super Admin only
1
0
Audit Logs
KA-AUDIT
6.10
Super Admin, Ops 
Manager

## Page 3

6.1 Module: Talent Management (KA-TALENT)
Talent Management is the admin control center for the entire vetting pipeline (Section 4.4) and talent 
pool. Every admin-side action referenced throughout the talent vetting flow — scoring, approving, 
rejecting, classifying — is performed here. This module is the single largest admin workspace in Kongila 
by action volume.
Screen / Field Specification
View
Content
Primary Actions
Pipeline (Kanban)
7 columns, one per vetting stage. Each card: 
talent name, role category, country, days in 
stage, SLA indicator color, score (if scored)
Drag-and-drop or click-
through to stage action 
panel
Talent List (Table)
All talent, sortable/filterable by skill, stage, score 
range, availability, country, status, grade, 
engagement route
Bulk actions: assign 
assessor, export filtered 
list
Individual Talent 
Record
Full profile read access plus all 7 stage panels 
with scoring forms, internal notes, document 
status
Approve/Reject/Clarify per 
stage, enter scores, assign 
tests/interviews/simulation
s, finalize classification
Question Bank 
Manager
CRUD interface for skill assessment questions, 
behavioural interview question sets, simulation 
task library — organized by role category
Add/Edit/Delete/Archive 
question or task entries
Talent Tag 
Dictionary
Manage the master list of auto-suggestable tags 
and their trigger conditions
Add/Edit tag definitions 
and trigger logic
Data Model
Field
Type
Notes
Pipeline view query
N/A
Aggregates talent_profiles + vetting_stage_records filtered by 
stage and status
sla_breached flag
Boolean 
(computed)
Drives the red/amber/green SLA indicators on every talent 
card
Admin Flow — Working the Stage 1 Application Queue
1.
Talent Manager opens Talent Management → Pipeline view, Stage 1 column.
2.
Cards are sorted by days-in-stage descending by default, surfacing the oldest unreviewed 
applications first.
3.
Talent Manager clicks a card, opening the Application Review panel: CV preview, profile 
summary, declared skills, bio.
4.
Talent Manager applies the Stage 1 criteria (relevant experience match, gap check, English 
proficiency) and selects Approve / Reject / Request Clarification.
5.
On Reject: a mandatory reason dropdown appears (per the reasons list in Section 4.3.3). Talent 
Manager selects one and confirms.
6.
System logs the decision, updates the talent's stage record, fires the appropriate notification, and 
removes the card from the Stage 1 column (moving it to Stage 2 or marking Rejected).
Admin Flow — Question Bank Management

## Page 4

7.
Talent Manager (or Super Admin) navigates to Question Bank Manager.
8.
Selects role category 'Customer Support' and assessment type 'Skill Assessment'.
9.
Clicks '+ Add Question', selects question type (Multiple Choice / Written Response / File Upload / 
Scenario Judgment), enters the question text, options/rubric, and point value.
10. Saves. The new question becomes available for the Skill Assessor to include the next time a 
Customer Support assessment is assigned.
11. Talent Manager can also archive outdated questions (soft delete — retained for historical scoring 
integrity but no longer assignable) rather than hard-deleting them.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KA-101
Pipeline Kanban with 
SLA Sort
The system shall display the vetting pipeline as a 7-column 
Kanban board, sorting cards within each column by days-in-
stage descending by default.
REQ-KA-102
Mandatory Rejection 
Reason
The system shall require selection of a rejection reason from a 
predefined dropdown before allowing any stage rejection action 
to be confirmed.
REQ-KA-103
Stage Action Audit 
Logging
The system shall log every stage decision 
(approve/reject/clarify/score entry) with the acting admin's user 
ID, timestamp, and full before/after state.
REQ-KA-104
Question Bank Soft-
Delete
The system shall archive (not hard-delete) question bank entries, 
retaining them for historical scoring audit while removing them 
from future assignment availability.
REQ-KA-105
Bulk Talent Actions
The system shall support bulk actions (assign assessor, export) 
on multi-selected talent records in the Talent List table view.
REQ-KA-106
Internal Notes Field
The system shall provide an internal notes field on every talent 
record, visible only to admin roles and never exposed to the 
talent or any client.
User Stories & Acceptance Criteria
  US-KA-101
  As a Talent Manager, I want to work through the Stage 1 application queue in priority order, so that no 
application sits unreviewed longer than necessary and SLA commitments are met
  Acceptance Criteria
  Scenario 1: Reviewing the oldest application first
Given  I open the Stage 1 Kanban column with 12 pending applications
When  I view the column
Then  Cards are sorted with the application waiting longest at the top, with an SLA indicator turning amber past 
24 hours and red past 48 hours
  Scenario 2: Rejecting with mandatory reason
Given  I am reviewing an application with insufficient experience
When  I click Reject without selecting a reason
Then  The system blocks confirmation and highlights the required reason dropdown
  US-KA-102

## Page 5

  As a Talent Manager, I want to manage the skill assessment question bank per role category, so that 
assessments stay current and role-relevant without needing engineering involvement
  Acceptance Criteria
  Scenario 1: Adding a new assessment question
Given  I want to add a scenario-judgment question to the Customer Support skill assessment
When  I complete the question form and save
Then  The question is immediately available for future Customer Support assessment assignments, without 
affecting any assessment already in progress
Business Rules & Validations
•
A talent cannot be simultaneously in two different stages — the system enforces single-stage-at-
a-time state machine integrity at the database level.
•
Score entry fields are locked (read-only) once a stage decision has been finalized, requiring a 
formal correction workflow (with audit trail) rather than silent edits.
•
Fast-tracking (skipping a stage) is only available to Ops Lead and Super Admin roles, and always 
requires a logged justification.
Notifications
Trigger Event
Recipient(s)
Channel(s)
SLA breach on any stage (internal)
Talent Manager + Ops 
Manager
In-app + Email
Question bank entry archived
Other Talent Managers 
(informational)
In-app

## Page 6

6.2 Module: Client Management (KA-CLIENT)
Client Management is the admin-side CRM for every client organization — the counterpart to the client's 
own My Company module (Section 5.2), but with full administrative visibility and control across all clients 
assigned to or visible by the admin's role.
Screen / Field Specification
View
Content
Primary Actions
Client List
All client organizations: name, contact, service 
type(s), active hires, monthly revenue, 
assigned Account Manager, status, last 
activity
Filter, search, export, bulk-
assign Account Manager
Individual Client 
Record — Overview 
Tab
Company info, primary contact, all assigned 
account managers, account health score, 
internal notes
Edit company info, 
reassign Account 
Manager, add internal note
Individual Client 
Record — Requests 
Tab
All service requests from this client with status 
and linked talent
Open request in Service 
Requests module
Individual Client 
Record — Active 
Talent Tab
All talent currently working for this client with 
contract details and performance score
Open contract, open 
Remotan workspace view
Individual Client 
Record — Contracts 
Tab
All contracts (active/completed/terminated) 
with download links
Generate new contract, 
void/amend
Individual Client 
Record — Billing Tab
Invoice history, payment status, outstanding 
balance, subscription tier
Generate invoice, mark 
paid (manual 
reconciliation)
Individual Client 
Record — 
Communication Log
Full history of admin-client messages across 
all conversation threads for this client
Read only, click-through to 
live thread
Admin Flow — Reassigning an Account Manager
12. Ops Manager identifies that a client's current Account Manager is overloaded and needs 
rebalancing.
13. Ops Manager opens the client record, clicks 'Reassign Account Manager', and selects a new 
Account Manager from the dropdown of available staff.
14. System requires a reason note (e.g., 'Workload rebalancing', 'AM departure', 'Client request').
15. On confirmation: the new Account Manager is notified and gains full access to the client's record; 
the previous Account Manager loses default visibility but their historical actions remain in the audit 
log.
16. The client receives a notification introducing their new Account Manager with contact details, and 
the change is reflected immediately in the client's own My Company screen (Section 5.2).
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KA-201
Account Manager 
Reassignment with 
The system shall require a reason note when reassigning a 
client's Account Manager, logging the change and notifying both

## Page 7

REQ-ID
Requirement
Specification
Reason
the outgoing and incoming Account Manager plus the client.
REQ-KA-202
Account Health Score 
Calculation
The system shall calculate and display an account health score 
per client based on factors including: payment timeliness, 
support ticket volume/sentiment, contract renewal history, and 
replacement request frequency.
REQ-KA-203
Cross-Tab Data 
Consistency
The system shall ensure the client record's Active Talent, 
Contracts, and Billing tabs remain in real-time sync with their 
respective source modules, never displaying stale cached data 
older than 5 minutes.
REQ-KA-204
Scoped Visibility by 
Role
The system shall restrict Account Managers to viewing only their 
assigned clients by default, while Ops Manager and Super Admin 
see all clients regardless of assignment.
User Stories & Acceptance Criteria
  US-KA-201
  As a Ops Manager, I want to see an at-a-glance health score for every client account, so that I can 
proactively intervene before a client becomes a churn risk
  Acceptance Criteria
  Scenario 1: Identifying an at-risk client
Given  A client has 2 overdue invoices, 3 recent performance-concern tickets, and declined their last contract 
renewal
When  I view the client list
Then  This client's health score is visibly low (red indicator) and appears in the 'At-Risk Accounts' filtered view
Business Rules & Validations
•
Reassigning an Account Manager never alters the client's historical communication log — all prior 
messages remain attributed to their original sender.
•
A client cannot be permanently deleted from the system, only deactivated, to preserve financial 
and compliance audit history.
Notifications
Trigger Event
Recipient(s)
Channel(s)
Account Manager reassigned
Outgoing AM + Incoming 
AM + Client
In-app + Email
Client health score drops to 'At Risk' 
threshold
Ops Manager
In-app + Email

## Page 8

6.3 Module: Service Requests — Admin Pipeline View (KA-REQUESTS)
While clients submit and track requests via their own My Requests module (Section 5.4), admins need a 
cross-client operational view: every open request across all clients, prioritized by urgency and SLA, to 
drive the daily work of Account Managers and Ops Manager.
Screen / Field Specification
View
Content
Primary Actions
Request Queue 
(Kanban)
Columns per status (New → Reviewing → 
Matching → Candidates Ready → Interviewing 
→ Hired). Cards show client name, role/project 
title, urgency badge, days since submission
Drag/click to advance 
status, assign to 
self/colleague
Request Detail (Admin 
View)
Full submitted data, internal SLA timer, assigned 
Account Manager, linked matches, linked 
interviews, linked contract
Edit internal fields (e.g., 
assigned Talent Manager 
for matching), advance 
status, message client
Urgent/Overdue Filter
Requests flagged ASAP or past their expected 
response SLA
Triage and reassign
Admin Flow — Triaging a New Request
17. A new service request notification arrives for Ops Manager and the relevant Account Manager.
18. Account Manager opens the request from the New column, reviews the submitted details (role, 
budget, urgency, skills).
19. Account Manager validates completeness — if budget was marked 'Not Sure', schedules a 
discovery call (logged as an internal task, not a separate module in MVP).
20. Account Manager advances the request to 'Reviewing' and assigns it for matching by selecting a 
Talent Manager from the dropdown.
21. Talent Manager receives a notification and the request appears in their personal queue within the 
Matching Engine module (Section 6.4).
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KA-301
Cross-Client 
Aggregated Queue
The system shall display all open service requests across all 
clients in a single Kanban view, accessible to Ops Manager and 
assigned Account Managers per their scoping rules.
REQ-KA-302
Urgency-Based Visual 
Priority
The system shall visually distinguish ASAP-urgency requests 
(e.g., red flag icon) from standard requests within every queue 
view.
REQ-KA-303
SLA Timer Per 
Request
The system shall display a running SLA timer on each request 
card, calculated from submission timestamp against the 
configured response SLA (default 48 business hours), turning 
amber/red as the deadline approaches/passes.
REQ-KA-304
Assignment for 
Matching
The system shall allow an Account Manager to formally assign a 
request to a specific Talent Manager for matching, triggering a 
notification and adding it to that Talent Manager's personal 
matching queue.

## Page 9

User Stories & Acceptance Criteria
  US-KA-301
  As a Account Manager, I want to see all my assigned requests prioritized by urgency and SLA risk, so 
that I never miss a response commitment to a client
  Acceptance Criteria
  Scenario 1: Viewing the prioritized queue
Given  I have 8 open requests assigned to me, 2 marked ASAP
When  I open the Request Queue
Then  The 2 ASAP requests appear with a red flag icon and are sorted to the top regardless of submission 
order, with SLA timers visible on every card
Business Rules & Validations
•
A request cannot be advanced to 'Matching' status without an assigned Talent Manager — the 
system blocks this transition with an inline prompt to assign one first.
•
Internal triage notes (e.g., discovery call scheduling) are stored on the request record but never 
surfaced to the client.
Notifications
Trigger Event
Recipient(s)
Channel(s)
New request requires triage
Account Manager + Ops 
Manager
In-app + Email
Request assigned for matching
Talent Manager
In-app + Email
Request SLA breach
Account Manager's 
supervisor (Ops 
Manager)
In-app + Email

## Page 10

6.4 Module: Matching Engine (KA-MATCH)
The Matching Engine is where Talent Managers and Ops Managers translate an open service request 
into a shortlist of candidates submitted to the client. It surfaces system-calculated match scores to assist 
(not replace) human judgement, per the platform's manual-first, AI-ready design principle.
Screen / Field Specification
View
Content
Primary Actions
My Matching Queue
Requests assigned to the current Talent 
Manager for matching, sorted by urgency/SLA
Open a request to begin 
matching
Matching Workspace 
(per request)
Request requirements summary at top; ranked 
list of eligible talent below with match score 
breakdown per candidate
Select candidates, view full 
profile inline, submit to 
client
Candidate 
Comparison View
Side-by-side comparison of selected candidates 
across all match score components
Finalize shortlist
Data Model
Field
Type
Notes
match_score formula
Computed
Skill Fit (40%) + Behaviour Fit (20%) + Personality Fit (15%) + 
Availability (15%) + Past Performance (10%)
matches table rows
Per request
One row created per talent considered, retained even if not 
ultimately submitted, for matching-quality analysis
Admin Flow — Matching a Request to Candidates
22. Talent Manager opens an assigned request in the Matching Engine.
23. System queries the deployable talent pool (status = vetted_available), filters to those whose skills 
overlap the request's required skills, and calculates match_score for each eligible candidate.
24. Talent Manager reviews the ranked list (system recommends top 5 by default, expandable to view 
all eligible).
25. Talent Manager opens full profiles inline for the top 3-4 candidates to apply human judgement 
beyond the raw score.
26. Talent Manager selects 2-3 candidates for submission (system requires a reason note if fewer 
than 2 are selected, e.g., 'limited pool for this niche skill').
27. Talent Manager clicks 'Submit Candidates to Client'. System creates/updates match records with 
status = submitted_to_client, sets the request status to 'candidates_ready', and notifies the client.
28. If no suitable candidates exist: Talent Manager marks the request 'Sourcing Required', which 
triggers an internal task to the talent acquisition function and notifies the client of an expected 
delay.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KA-401
Eligible Pool Filtering
The system shall restrict the matching candidate pool to talent 
with status = vetted_available and availability matching the 
request's engagement type before calculating match scores.

## Page 11

REQ-ID
Requirement
Specification
REQ-KA-402
Match Score 
Calculation on 
Demand
The system shall calculate match_score for every eligible 
candidate against the specific request's requirements in real time 
when the matching workspace is opened, not from a stale 
precomputed value.
REQ-KA-403
Minimum Candidate 
Justification
The system shall require a written reason if fewer than 2 
candidates are selected for submission to a client.
REQ-KA-404
No Duplicate Active 
Submission
The system shall prevent a talent from being submitted as an 
active candidate to two different clients' competing requests 
simultaneously, blocking the second submission attempt with a 
clear conflict message.
REQ-KA-405
Sourcing Required 
Fallback
The system shall provide a 'Sourcing Required' action that flags 
the request, notifies the talent acquisition function, and auto-
generates a client-facing delay notification.
REQ-KA-406
Match Override 
Logging
The system shall allow a Talent Manager to manually select and 
submit a candidate regardless of their match score ranking, but 
shall require and log an override reason.
User Stories & Acceptance Criteria
  US-KA-401
  As a Talent Manager, I want to see a ranked, scored list of eligible candidates for an open request, so 
that I can quickly identify the strongest matches without manually reviewing the entire talent pool
  Acceptance Criteria
  Scenario 1: Matching a request with strong candidates available
Given  A request for a Customer Support role has 14 eligible talent in the pool
When  I open the Matching Workspace
Then  I see the top 5 ranked by match score with full breakdown (Skill Fit, Behaviour Fit, etc.) for each, and can 
expand to see all 14 if needed
  Scenario 2: Preventing a double-submission conflict
Given  Talent X is already submitted as an active candidate to Client A for a similar role
When  I attempt to also submit Talent X to Client B's competing request
Then  The system blocks the submission with: 'This talent is already an active candidate for another client. 
Resolve that match first.'
Business Rules & Validations
•
Match scores are never shown to the client with their underlying formula weights exposed — only 
the final percentage and component labels are surfaced client-side, per Section 5.5.
•
A 'Sourcing Required' flag automatically expires after 14 days if unresolved, escalating to Ops 
Manager for direct intervention.
Notifications
Trigger Event
Recipient(s)
Channel(s)
Request assigned to matching queue
Talent Manager
In-app + Email
Candidates submitted to client
Account Manager 
(informational)
In-app

## Page 12

Trigger Event
Recipient(s)
Channel(s)
Sourcing Required flagged
Talent Acquisition 
function + Ops Manager
In-app + Email
Sourcing Required unresolved after 14 
days
Ops Manager
In-app + Email

## Page 13

6.5 Module: Contracts & Compliance (KA-CONTRACTS)
This module manages contract template administration, generation, e-signature tracking, and the broader 
compliance document lifecycle across every talent and client relationship. It is the admin engine behind 
both the talent-side Contracts module (Section 4.8) and the client-side hiring flow (Section 5.7).
Screen / Field Specification
View
Content
Primary Actions
Contract Templates 
Manager
All templates by type (Contractor Agreement, 
Client Service Agreement, NDA, Engagement 
Contract, DPA, IT Policy, Project SOW) with 
version history
Create/edit/archive 
template, manage merge-
field variables
Active Contracts 
Queue
All contracts pending signature, sorted by days-
pending, with reminder status
Resend signature request, 
manually mark signed 
(rare/exception cases with 
justification), void
Compliance Document 
Tracker
Per-talent and per-client compliance status grid 
— which mandatory documents are 
signed/pending/expired
Trigger re-send, flag for 
manual follow-up
Expiry Monitor
Documents approaching or past expiry (e.g., 
annual Contractor Agreement renewal)
Trigger renewal document 
generation
Admin Flow — Managing a Stalled Signature
29. System has sent automated reminders on Day 3 and Day 7 of an unsigned contract per Section 
4.5.1/5.7.1 rules.
30. By Day 14, the contract remains unsigned. Account Manager is alerted via the Active Contracts 
Queue, which flags it in red.
31. Account Manager opens the contract record, sees the full reminder history and signature status 
for each party.
32. Account Manager contacts the non-signing party directly (via Messages or phone, logged as an 
internal note).
33. If resolved: party signs normally through their portal, and the contract activates per standard flow.
34. If the party is unreachable or has clearly declined: Account Manager voids the contract with a 
logged reason, which reverts the linked service request to 'candidates_ready' so an alternative 
candidate or client decision can proceed.
Admin Flow — Updating a Contract Template
35. Super Admin (or delegated Account Manager with template permission) opens Contract 
Templates Manager.
36. Selects 'Engagement Contract — Managed Workforce' and clicks 'New Version'.
37. Edits the template body in the rich-text editor, using merge-field syntax (e.g., {{talent_name}}, 
{{client_company}}, {{monthly_rate}}) for dynamic fields.
38. Saves as a draft, previews with sample data to verify merge fields render correctly, then 
publishes.
39. All contracts generated from this point forward use the new version; previously generated/signed 
contracts retain their original version for legal integrity — never retroactively altered.

## Page 14

Functional Requirements
REQ-ID
Requirement
Specification
REQ-KA-501
Versioned Template 
Management
The system shall maintain a full version history for every contract 
template, with each generated contract permanently linked to the 
specific template version used at generation time.
REQ-KA-502
Merge Field Validation
The system shall validate that all merge-field variables in a 
template correspond to actual system data fields before allowing 
the template to be published.
REQ-KA-503
Stalled Signature 
Escalation
The system shall flag any contract unsigned for 14+ days in the 
Active Contracts Queue with a red indicator and notify the 
assigned Account Manager.
REQ-KA-504
Contract Void with 
Reason
The system shall require a logged reason when an admin voids a 
pending contract, and shall automatically revert the linked service 
request to its prior actionable status.
REQ-KA-505
Compliance Grid Real-
Time Status
The system shall display a real-time compliance status grid 
(signed/pending/expired) for every mandatory document type, 
per talent and per client, refreshing immediately on any signature 
event.
REQ-KA-506
Expiry Renewal 
Trigger
The system shall surface documents within 30 days of expiry in 
the Expiry Monitor and provide a one-click action to generate and 
send the renewal document.
User Stories & Acceptance Criteria
  US-KA-501
  As a Account Manager, I want to see exactly which contracts are stalled on signature and why, so that I 
can intervene proactively rather than waiting for a client to ask why their hire hasn't started
  Acceptance Criteria
  Scenario 1: Identifying a stalled contract
Given  A contract has been awaiting talent signature for 16 days despite 2 automated reminders
When  I open the Active Contracts Queue
Then  I see this contract flagged in red with its full reminder history, and a clear 'Awaiting Talent Signature' 
status
  US-KA-502
  As a Super Admin, I want to update a contract template without affecting contracts already signed 
under the old version, so that legal and pricing changes can be rolled out safely without retroactive disputes
  Acceptance Criteria
  Scenario 1: Publishing a new template version
Given  I have edited the Managed Workforce contract template to update the standard payment terms clause
When  I publish the new version
Then  All new contracts use the updated terms, while every previously signed contract remains exactly as 
originally signed and viewable in its original form
Business Rules & Validations
•
Signed contract PDFs are immutable. Any legal correction requires a formal amendment 
document referencing the original, never an edit to the signed file itself.

## Page 15

•
A contract cannot be voided once both parties have signed — at that point, termination (not 
voiding) is the only available action, following the proper termination workflow.
•
Manual 'mark as signed' (bypassing e-signature) is restricted to Super Admin and requires a 
justification note, intended only for rare edge cases (e.g., a legally required wet-ink signature 
scanned and uploaded).
Notifications
Trigger Event
Recipient(s)
Channel(s)
Contract unsigned 14+ days
Account Manager
In-app + Email
Contract voided
All parties + Ops 
Manager
In-app + Email
Document expiring within 30 days
Talent Manager / 
Account Manager (per 
document type)
In-app + Email
New template version published
Other admins with 
template access 
(informational)
In-app

## Page 16

6.6 Module: Financial System (KA-FINANCE)
The Financial System is Finance Admin's complete operational workspace: generating and tracking client 
invoices, processing talent payouts, and monitoring overall platform revenue and margin health. This 
module is the admin engine behind both the client-side Billing module (Section 5.8) and the talent-side 
Earnings module (Section 4.9).
Screen / Field Specification
View
Content
Primary Actions
Invoice Queue
All invoices by status 
(Draft/Sent/Paid/Overdue/Void), client name, 
amount, due date
Generate, send, mark paid 
(manual reconciliation), 
void, resend
Payout Queue
All pending/approved/processing talent payouts 
for the current cycle
Approve individual/bulk, 
view breakdown, retry 
failed payouts
Overdue Escalation 
Tracker
Invoices past due, with current escalation stage 
and next scheduled action
Manually trigger next 
escalation step, pause 
escalation (e.g., for 
disputes)
Revenue Dashboard
MRR, revenue by service line, revenue by client, 
margin per engagement
Export reports, set date 
range filters
Fee & Commission 
Configuration
Global and per-contract-type fee percentages, 
talent commission rates
Edit rates (Super Admin 
approval may be required 
per setting)
Admin Flow — Monthly Invoice Generation Cycle
40. On the 1st of each month, the system automation (Section 8) auto-generates draft invoices for all 
active recurring contracts.
41. Finance Admin opens the Invoice Queue, filtered to 'Draft' status, and reviews each for accuracy 
(correct rate, correct fee %, correct line items).
42. Finance Admin clicks 'Send' on each validated invoice (or uses bulk-send for a multi-select of 
validated invoices).
43. System updates status to 'Sent', generates the PDF, and notifies the client.
44. Finance Admin monitors the Overdue Escalation Tracker daily; for invoices reaching Day 3 
overdue, system has already auto-triggered the first escalation per Section 6.6.1.
Admin Flow — Processing Monthly Talent Payouts
45. On the configured monthly payout date, system populates the Payout Queue with all eligible 
payouts (talent with active contracts, no compliance holds, and corresponding client invoice paid).
46. Finance Admin reviews the queue: each row shows talent name, contract, gross amount, 
commission %, net amount, and payment method.
47. Finance Admin spot-checks a sample and clicks 'Approve All' for bulk processing, or approves 
individually for high-value payouts requiring closer review (configurable threshold).
48. On approval, system triggers the payment via the talent's configured payment rail 
(Wise/Paystack/Payoneer/Bank Transfer).
49. System polls for payment confirmation; on success, status updates to 'Paid' and the talent is 
notified. On failure, status updates to 'Failed', Finance Admin is alerted, and the talent's Earnings 
screen reflects the issue.

## Page 17

Functional Requirements
REQ-ID
Requirement
Specification
REQ-KA-601
Automated Monthly 
Invoice Draft 
Generation
The system shall automatically generate draft invoices for all 
contracts with recurring billing on the 1st of each month, requiring 
Finance Admin review before sending.
REQ-KA-602
Overdue Escalation 
Automation
The system shall automatically progress an unpaid invoice 
through the configured escalation sequence (Day 3 reminder, 
Day 7 WhatsApp, Day 14 Account Manager alert, Day 30 
suspension warning) without requiring manual triggering at each 
step, while allowing manual pause for disputed invoices.
REQ-KA-603
Payout Eligibility 
Gating
The system shall only populate the Payout Queue with talent 
who have no active compliance hold and whose corresponding 
client invoice has been marked paid, unless an admin override is 
explicitly applied with a logged reason.
REQ-KA-604
Bulk and Individual 
Payout Approval
The system shall support both bulk approval of multiple payouts 
and individual approval, with a configurable value threshold 
above which individual review is mandatory.
REQ-KA-605
Payout Failure 
Handling
The system shall set a failed payout to status = failed, alert 
Finance Admin immediately, and surface the issue transparently 
on the talent's Earnings screen rather than leaving it silently 
pending.
REQ-KA-606
Fee Configuration with 
Audit Trail
The system shall log every change to fee percentages or 
commission rates with the previous value, new value, changing 
admin, and timestamp, given the direct financial impact of these 
settings.
REQ-KA-607
Revenue Dashboard 
Real-Time 
Aggregation
The system shall calculate MRR, revenue by service line, and 
revenue by client in real time from underlying invoice and payout 
data, not from a periodically-refreshed snapshot older than 1 
hour.
User Stories & Acceptance Criteria
  US-KA-601
  As a Finance Admin, I want to review and send all monthly invoices efficiently in one sitting, so that 
billing happens accurately and on schedule every month without manual data entry errors
  Acceptance Criteria
  Scenario 1: Bulk-sending validated invoices
Given  20 draft invoices have been auto-generated on the 1st of the month, and I have spot-checked them for 
accuracy
When  I select all 20 and click 'Bulk Send'
Then  All 20 invoices are sent simultaneously, each client is notified, and the Invoice Queue updates to show 
all 20 as 'Sent'
  US-KA-602
  As a Finance Admin, I want to process talent payouts in bulk while still catching the rare failed 
payment, so that the team's monthly payroll-equivalent runs efficiently without manual per-talent processing
  Acceptance Criteria
  Scenario 1: Bulk approval with one failure

## Page 18

Given  I bulk-approve 40 payouts for the month
When  39 succeed and 1 fails due to invalid bank details
Then  The 39 successful payouts complete normally and notify their talent, while the 1 failure is clearly flagged 
in the queue with a reason, and I am alerted to follow up
Business Rules & Validations
•
A payout can never be approved for a talent with an unresolved compliance hold (e.g., expired 
Contractor Agreement) — this is a hard system block, not merely a warning.
•
Fee percentage changes only apply to contracts created after the change date; existing active 
contracts retain their original locked-in fee percentage for the duration of that contract.
•
All financial transactions marked 'Paid' are immutable — any correction requires a formal void-
and-reissue workflow with full audit trail, never a direct edit.
Notifications
Trigger Event
Recipient(s)
Channel(s)
Draft invoices ready for review 
(monthly)
Finance Admin
In-app + Email
Invoice overdue escalation triggered
Per Section 6.6 
escalation map
Per escalation stage
Payout batch ready for approval
Finance Admin
In-app + Email
Payout failed
Finance Admin + Talent
In-app + Email
Fee/commission rate changed
Super Admin 
(informational, if changed 
by delegated Finance 
Admin)
In-app + Email
6.6.1 Overdue Invoice Escalation Schedule (Reference)
Day
Action
Recipient(s)
Channel
Due Date
Friendly reminder
Client
Email
Day 3
First overdue reminder
Client
In-app + Email
Day 7
Second reminder, more direct 
tone
Client
In-app + Email + 
WhatsApp
Day 14
Account Manager personally 
alerted to intervene directly
Client + Account 
Manager + Finance 
Admin
In-app + Email
Day 21
Formal notice — service 
continuation at risk
Client + Account 
Manager
Email (formal tone)
Day 30
Suspension warning — final 
notice before Remotan 
access restriction
Client + Account 
Manager + Ops Manager
In-app + Email
Day 35 (if still 
unpaid and 
Remotan access restricted 
per Section 5.10 rules
Client + Account 
Manager
In-app + Email

## Page 19

Day
Action
Recipient(s)
Channel
suspension 
enabled)

## Page 20

6.7 Module: Analytics Dashboard — Control Tower (KA-ANALYTICS)
The Analytics Dashboard is the cross-module reporting and business intelligence layer. Content is 
scoped by role — Super Admin and Ops Manager see the full Control Tower; Talent Manager sees 
talent-specific analytics; Account Manager sees client-specific analytics; Finance Admin sees financial 
analytics.
Screen / Field Specification
Report
Metrics Included
Visible To
Control Tower 
Overview
Active clients, active talent, monthly revenue, talent 
utilisation %, service request pipeline summary, at-risk 
accounts
Super Admin, Ops 
Manager
Talent Vetting Funnel
Applications per stage, pass rate per stage, average 
time-in-stage, rejection reasons breakdown
Super Admin, Ops 
Manager, Talent 
Manager
Client Pipeline
New clients, active clients, churn rate, conversion rate 
(request to hire), revenue per client
Super Admin, Ops 
Manager, Account 
Manager (own 
clients)
Service Request 
Analytics
Requests received/matched/hired, average time-to-
match, average time-to-hire, by service line
Super Admin, Ops 
Manager, Account 
Manager (own)
Talent Utilisation
Total vetted talent, deployed vs available ratio, average 
time-to-deploy, by skill/country/grade
Super Admin, Ops 
Manager, Talent 
Manager
Financial P&L
Gross revenue, talent payouts, net margin by service 
line, MRR trend
Super Admin, 
Finance Admin
Admin Flow — Investigating a Vetting Funnel Drop-Off
50. Ops Manager notices in the Control Tower Overview that talent_utilisation has been declining 
month-over-month.
51. Ops Manager clicks through to the Talent Vetting Funnel report to investigate the cause.
52. Report shows pass rates per stage: Stage 1: 85%, Stage 2: 78%, Stage 3: 81%, Stage 4: N/A, 
Stage 5: 45%, Stage 6: 88%, Stage 7: 92%.
53. Ops Manager identifies Stage 5 (Remote Work Readiness) as the bottleneck — a 45% pass rate 
is significantly below the others.
54. Ops Manager drills into the rejection reasons breakdown for Stage 5, finding 'Internet speed 
below minimum' is the dominant cause, concentrated in a specific country.
55. Ops Manager exports this finding to share with the Talent Acquisition function for targeted 
sourcing/coaching in that market.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KA-701
Role-Scoped Report 
Visibility
The system shall restrict each analytics report's visibility per the 
role mapping in Section 6.7 screen specification, hiding reports 
entirely from unauthorized roles rather than merely restricting 
drill-down.

## Page 21

REQ-ID
Requirement
Specification
REQ-KA-702
Drill-Down from 
Summary to Detail
The system shall allow every summary metric on the Control 
Tower Overview to be clicked through to its corresponding 
detailed report.
REQ-KA-703
Custom Date Range 
Filtering
The system shall allow every report to be filtered by a custom 
date range, in addition to default presets (Last 7 days / 30 days / 
90 days / This Year).
REQ-KA-704
Export to CSV/PDF
The system shall provide an export action on every report, 
generating a CSV or PDF matching the currently applied filters.
REQ-KA-705
Near Real-Time Data
The system shall ensure all dashboard metrics reflect data no 
more than 5 minutes stale, per the platform's near-real-time 
design principle.
User Stories & Acceptance Criteria
  US-KA-701
  As a Ops Manager, I want to drill from a high-level metric down into the specific cause of a trend, so 
that I can take targeted corrective action rather than guessing at root causes
  Acceptance Criteria
  Scenario 1: Drilling into a utilisation decline
Given  I notice talent utilisation has declined 8% this month on the Control Tower
When  I click through to the Talent Vetting Funnel report and filter to the last 30 days
Then  I see stage-by-stage pass rates and can identify exactly which stage is causing the bottleneck, with 
rejection reason breakdowns available for further drill-down
Business Rules & Validations
•
Account Managers and Talent Managers never see platform-wide financial totals (gross revenue, 
margin) — these remain restricted to Super Admin and Finance Admin regardless of any other 
permission granted.
•
Exported reports include a watermark/footer noting the export timestamp and the exporting user, 
for internal data governance.
Notifications
Trigger Event
Recipient(s)
Channel(s)
Key metric crosses a configured alert 
threshold (e.g., utilisation drops below 
70%)
Super Admin + Ops 
Manager
In-app + Email

## Page 22

6.8 Module: User Management (KA-USERS)
User Management is restricted exclusively to Super Admin. It governs the creation, role assignment, and 
deactivation of every internal admin account (Ops Manager, Talent Manager, Account Manager, Finance 
Admin, additional Super Admins). It does not manage talent or client accounts, which are self-service per 
Sections 4.2 and 5.2.
Screen / Field Specification
View
Content
Primary Actions
Admin User List
All internal staff accounts: name, email, role, 
status (active/suspended), last login
Search, filter by role, 
deactivate
Create User
Form: full name, email, role selection, initial 
password (or send setup link)
Create account, send 
welcome email
Individual User Record
Full profile, role, permission overrides (if any), 
login history, actions taken (link to Audit Logs 
filtered to this user)
Edit role, force password 
reset, deactivate, view 
audit trail
Data Model
Field
Type
Notes
admin user record
Per users table
role field restricted to admin role enum values; talent/client 
roles are never assignable here
login_history
Computed view
Sourced from authentication audit log, filtered per user
Admin Flow — Onboarding a New Account Manager
56. Super Admin navigates to User Management → Create User.
57. Enters the new hire's full name and company email, selects role = Account Manager.
58. Chooses 'Send Setup Link' (rather than setting a temporary password directly) — system emails 
a secure, time-limited link for the new admin to set their own password and configure MFA if 
desired.
59. New Account Manager completes setup via the link. Account status updates from 'pending_setup' 
to 'active'.
60. Super Admin (or Ops Manager, if delegated) then assigns specific clients to this new Account 
Manager via the Client Management module (Section 6.2).
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KA-801
Super Admin 
Exclusivity
The system shall restrict all User Management actions (create, 
edit role, deactivate) to the Super Admin role exclusively, with no 
delegation possible even to Ops Manager.
REQ-KA-802
Secure Setup Link 
Flow
The system shall support account creation via a secure, single-
use, time-limited setup link rather than admin-set temporary 
passwords, reducing credential handling risk.
REQ-KA-803
Deactivation 
Preserves History
The system shall preserve all historical actions and audit log 
entries for a deactivated admin user, never deleting the account

## Page 23

REQ-ID
Requirement
Specification
record itself — only revoking active access.
REQ-KA-804
Role Change Audit
The system shall log every role change with previous role, new 
role, changing Super Admin, and timestamp, per REQ-RBAC-
005.
User Stories & Acceptance Criteria
  US-KA-801
  As a Super Admin, I want to onboard a new admin staff member securely without ever knowing their 
password, so that credential security is maintained even during account creation
  Acceptance Criteria
  Scenario 1: Creating a new admin via setup link
Given  I am onboarding a new Talent Manager
When  I create their account and select 'Send Setup Link'
Then  They receive a secure email link to set their own password; I never see or set their password directly
Business Rules & Validations
•
A deactivated admin account cannot be reactivated by simply toggling status — reactivation 
requires Super Admin to explicitly review and confirm, logged as a distinct audit event.
•
There must always be at least one active Super Admin account in the system — the system 
blocks deactivation of the last remaining Super Admin.
Notifications
Trigger Event
Recipient(s)
Channel(s)
New admin account created
New admin (setup link)
Email
Admin role changed
Affected admin
In-app + Email
Admin account deactivated
Affected admin (if 
reachable) + Ops 
Manager
Email

## Page 24

6.9 Module: System Settings (KA-SETTINGS)
System Settings is the Super-Admin-only configuration center for every platform-wide tunable parameter 
referenced throughout this FRD — fee percentages, SLA windows, scoring thresholds, feature toggles, 
and integration credentials.
Screen / Field Specification
Settings Category
Configurable Items
Fee & Commission 
Defaults
Default management fee % per service type, default talent commission %, 
placement fee structure
Vetting Configuration
Minimum pass scores per stage, SLA windows per stage, composite score 
category weights, reapplication windows
Score Visibility
Global setting: full breakdown / grade-and-tags-only / hidden, for both talent 
and client views
Notification Defaults
Default channel enablement per notification category, WhatsApp Business 
API credentials, email sending domain configuration
Payment Integration
API credentials for Stripe, Paystack, Wise, Payoneer (encrypted storage, 
masked display)
Contract Defaults
Default invoice payment terms (Net 7/14/30), default minimum engagement 
period before replacement eligibility, default replacement guarantee window
Feature Toggles
Enable/disable: multi-user client accounts, direct client hire without interview, 
Remotan standalone subscriptions, GDPR compliance mode
Branding
Platform name display, logo URLs, support contact details, sending email 
addresses
Admin Flow — Adjusting a Vetting Pass Threshold
61. Super Admin determines, based on Analytics Dashboard data, that the Stage 2 skill assessment 
pass threshold (currently 50/100) is producing too many false negatives for a specific role 
category.
62. Super Admin navigates to System Settings → Vetting Configuration.
63. Locates the Stage 2 minimum pass score setting and updates it from 50 to 45, with a required 
justification note.
64. System validates the new value is within an acceptable range (e.g., 0-100) and saves, logging the 
change with old value, new value, admin, timestamp, and justification.
65. The new threshold applies to all assessments scored from this point forward; previously scored 
(and already decided) assessments are not retroactively re-evaluated.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KA-901
Super Admin 
Exclusivity
The system shall restrict all System Settings modifications to the 
Super Admin role exclusively.
REQ-KA-902
Mandatory Change 
Justification
The system shall require a justification note for every settings 
change with direct financial or vetting-outcome impact (fees, 
commissions, pass thresholds).

## Page 25

REQ-ID
Requirement
Specification
REQ-KA-903
Settings Change Audit 
Trail
The system shall log every settings change with the setting 
name, previous value, new value, changing admin, timestamp, 
and justification note.
REQ-KA-904
Non-Retroactive 
Application
The system shall apply vetting threshold and fee percentage 
changes only to records created/scored after the change, never 
retroactively altering already-finalized decisions.
REQ-KA-905
Encrypted Credential 
Storage
The system shall store all third-party API credentials (payment 
processors, WhatsApp Business API) using field-level 
encryption, displaying only masked values in the UI.
REQ-KA-906
Setting Value Range 
Validation
The system shall validate that numeric settings (percentages, 
scores, day counts) fall within sensible defined ranges before 
allowing save, rejecting out-of-range values with a clear error.
User Stories & Acceptance Criteria
  US-KA-901
  As a Super Admin, I want to adjust platform-wide configuration values with a full audit trail, so that I can 
tune the business rules as the platform matures while maintaining accountability for every change
  Acceptance Criteria
  Scenario 1: Adjusting a fee percentage
Given  I am updating the default Managed Workforce management fee from 20% to 18%
When  I save the change with a justification note
Then  The change is logged with old/new values and my justification, and applies only to contracts created after 
this point — existing active contracts retain 20%
Business Rules & Validations
•
Critical settings (payment integration credentials, fee structures) require the admin to re-enter 
their password before the change is saved, as an additional confirmation step beyond standard 
session authentication.
•
Feature toggles that affect client-facing behavior (e.g., enabling multi-user accounts) take effect 
immediately upon save, with no scheduled/delayed activation option in MVP.
Notifications
Trigger Event
Recipient(s)
Channel(s)
Critical setting changed (fees, 
integrations)
All Super Admins 
(informational, if multiple 
exist)
Email

## Page 26

6.10 Module: Audit Logs (KA-AUDIT)
Audit Logs is the immutable, queryable record of every significant action taken across the entire Kongila 
platform. It is the foundation of the platform's auditability-by-default design principle and the primary tool 
for compliance review, dispute resolution, and security investigation.
Screen / Field Specification
View
Content
Primary Actions
Log Search
Filterable by user, action type, entity type, date 
range, IP address
Search, filter, export
Entity Timeline View
All audit events for a single specific record (e.g., 
one talent's full history) in chronological order
Read only, accessible via 
'View Audit Trail' links 
throughout other admin 
modules
Security Events Filter
Pre-filtered view: failed logins, account lockouts, 
permission changes, unauthorized access 
attempts (403 responses)
Read only, flagged for 
security review
Data Model
Field
Type
Notes
audit_log_id
UUID (PK)
Per audit_logs table, Section 13
user_id, action, 
entity_type, entity_id
Mixed
Who did what, to which record
old_value, new_value
JSONB
Full before/after state for update actions
ip_address, 
user_agent
String
Security forensics fields
created_at
Timestamp
Immutable — never updated after creation
Admin Flow — Investigating a Disputed Score Change
66. A talent disputes their Stage 2 skill assessment score via a Support ticket, claiming it was 
changed after initial scoring.
67. Ops Manager opens Audit Logs and filters by entity_type = vetting_stage_records, entity_id = the 
specific talent's Stage 2 record.
68. System displays the complete timeline: initial score entry by the Skill Assessor, timestamp, and 
any subsequent edits with old/new values and the editing admin's identity.
69. Ops Manager confirms whether a change occurred, by whom, and when — resolving the dispute 
with factual evidence rather than relying on staff recollection.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KA-
1001
Comprehensive Action 
Logging
The system shall log every create, update, delete, approve, 
reject, and sign action across all modules to the audit_logs table, 
per REQ-AUTH-008, REQ-RBAC-005, and the equivalent 
requirements defined throughout this FRD.

## Page 27

REQ-ID
Requirement
Specification
REQ-KA-
1002
Immutability
The system shall ensure audit_logs records can never be edited 
or deleted by any user or role, including Super Admin, enforced 
at the database permission level.
REQ-KA-
1003
Entity Timeline 
Reconstruction
The system shall allow reconstruction of a complete 
chronological timeline for any single entity (talent, client, contract, 
invoice) by filtering audit logs to that entity_id.
REQ-KA-
1004
Security Event Pre-
Filtering
The system shall provide a pre-built filter surfacing security-
relevant events (failed logins, lockouts, permission changes, 403 
responses) for proactive security review.
REQ-KA-
1005
Export for Compliance
The system shall support exporting filtered audit log results to 
CSV, including all fields, for compliance reporting and legal 
discovery purposes.
User Stories & Acceptance Criteria
  US-KA-1001
  As a Ops Manager, I want to reconstruct the complete history of any disputed record, so that I can 
resolve disputes and compliance questions with factual, immutable evidence
  Acceptance Criteria
  Scenario 1: Investigating a score dispute
Given  A talent claims their assessment score was altered after initial entry
When  I filter Audit Logs to that specific vetting stage record
Then  I see every action taken on that record in order, with the acting admin, exact timestamp, and old/new 
values for any change — providing a definitive answer
Business Rules & Validations
•
Audit log entries are never deleted, even when the underlying record they reference (e.g., a 
deactivated user) is later removed from active use.
•
Audit log access is restricted to Super Admin and Ops Manager — no other role can view raw 
audit logs, though they may see scoped 'Activity Log' views within specific modules (e.g., a single 
service request's own activity tab).
