# Kongila Talent Portal FRD

Source: `FRD Vol2 TalentPortal.pdf`
Total pages: 39

This file is a page-ordered text extraction of the FRD for long-term reference during implementation. Line wrapping and table spacing reflect the source PDF extraction.

## Metadata
- title: Kongila & Remotan FRD — Volume 2 of 5 — Kongila Talent Portal
- author: Kongila Product Team
- subject: 
- keywords: 
- creator: Writer
- producer: LibreOffice 24.2
- creationDate: D:20260630194112Z'
- modDate: 
- format: PDF 1.7

## Page 1

KONGILA & REMOTAN
Functional Requirements Document — v2.0
  Volume 2 of 5 — Kongila Talent Portal 
All 14 Talent Portal modules, fully specified

## Page 2

4. Kongila Talent Portal — Module-by-Module 
Specification
The Talent Portal sidebar contains 14 distinct navigation items. Per the standard set in this FRD, each 
item below is treated as its own complete module with its own data model, screen specification, user 
flows, functional requirements, user stories with acceptance criteria, business rules, and notification 
triggers. No item is summarized or folded into a generic parent section.
#
Sidebar Item
Module Code
Section
1
Home / Overview
KT-HOME
4.1
2
My Profile
KT-PROFILE
4.2
3
Documents
KT-DOCS
4.3
4
Vetting Progress
KT-VETTING
4.4
5
Scores & Grade
KT-SCORES
4.5
6
Opportunities
KT-OPPS
4.6
7
Interviews
KT-INTERVIEW
4.7
8
Contracts & Employment History
KT-CONTRACTS
4.8
9
Earnings
KT-EARNINGS
4.9
10
Tasks (Remotan link)
KT-TASKS
4.10
11
Messages
KT-MSG
4.11
12
Notifications
KT-NOTIF
4.12
13
Settings
KT-SETTINGS
4.13
14
Support
KT-SUPPORT
4.14

## Page 3

4.1 Module: Home / Overview Dashboard (KT-HOME)
The Home dashboard is the talent's landing screen on every login. It surfaces the single most relevant 
action at any point in the talent's lifecycle — completing a profile, awaiting a vetting decision, preparing 
for an interview, or reviewing earnings — without requiring the talent to navigate elsewhere to understand 
their status.
Screen / Field Specification
Widget
Data Displayed
Visible When
Click-Through
Profile Completion 
Bar
% complete; list of incomplete 
sections below the bar
Always until 
100%
→ My Profile, scrolled to 
first incomplete field
Vetting Stage Card
Stage name (X of 7), status label, 
days in stage, next action text
Always pre-
deployment
→ Vetting Progress
Active Contract 
Card
Client name (masked per admin 
setting), role, start date, next 
review date, performance score
Only if active 
contract exists
→ Contracts
Upcoming 
Interviews Widget
Next 3 interviews: date, time (local 
TZ), type, with whom
After vetting 
passed
→ Interviews
Recent Notifications 
Widget
Last 5 notifications, timestamp, 
category icon
Always
→ Notifications
Earnings Summary 
Widget
Total earned, pending payout, last 
payment date/amount
After first payout
→ Earnings
Performance Score 
Widget
Current score, trend arrow vs 
previous review, grade badge
After first 
performance 
review (deployed)
→ Scores & Grade
User Flow — Dashboard Load Sequence
1.
Talent logs in successfully and is redirected to /dashboard/home.
2.
System fetches talent's current state in a single aggregated API call: profile completion %, vetting 
stage, active contract (if any), next 3 interviews, last 5 notifications, payout summary (if any), 
latest performance score (if any).
3.
Dashboard renders widgets conditionally — widgets with no applicable data (e.g., Earnings 
before first payout) are not shown, and the layout reflows to fill the space with the next applicable 
widget.
4.
If profile completion < 100%, the Profile Completion Bar is always rendered at the very top 
regardless of other widget priority.
5.
If any notification is unread, a red badge count appears on the sidebar 'Notifications' nav item, 
visible from every screen including Home.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-101
Aggregated 
Dashboard Load
The system shall load all Home dashboard widget data in a 
single API call to minimize load time, targeting under 1.5 seconds 
on a 4G connection.
REQ-KT-102
Conditional Widget 
Rendering
The system shall hide any widget whose underlying data does 
not yet exist for the talent (e.g., Earnings Summary before any

## Page 4

REQ-ID
Requirement
Specification
payout has occurred) rather than showing an empty state.
REQ-KT-103
Profile Completion 
Priority
The system shall always render the Profile Completion Bar at the 
top of the Home dashboard whenever completion is below 100%, 
regardless of other widget content.
REQ-KT-104
Unread Notification 
Badge
The system shall display a live unread-count badge on the 
Notifications sidebar item, visible and accurate from every screen 
in the talent portal.
User Stories & Acceptance Criteria
  US-KT-101
  As a talent, I want to see a single dashboard summarizing exactly where I stand, so that I don't have to 
dig through multiple screens to understand what I need to do next
  Acceptance Criteria
  Scenario 1: Dashboard shows the right widgets pre-vetting
Given  I have a 60%-complete profile and have not started vetting
When  I log in and land on Home
Then  I see the Profile Completion Bar at the top and the Vetting Stage Card showing 'Not Started', with no 
Earnings or Contract widgets shown
  Scenario 2: Dashboard updates after deployment
Given  I have an active contract and have completed one performance review
When  I open Home
Then  I see the Active Contract Card, the Performance Score Widget with my latest score and trend arrow, and 
the Earnings Summary Widget with my totals
Business Rules & Validations
•
The Home dashboard never shows raw composite vetting scores unless the global score-visibility 
admin setting permits it — even on the summary widget.
•
Widget order is fixed and not user-customizable in MVP; personalization/reordering is a Phase 2 
feature.

## Page 5

4.2 Module: My Profile (KT-PROFILE)
My Profile is the structured editor for all talent-declared information: personal details, professional 
background, skills, availability, and preferences. It is the single source of truth that feeds the matching 
engine, the client-facing talent card, and the full profile page. Profile data quality directly determines 
match accuracy.
Screen / Field Specification
Section
Edit Mode
Validation Behaviour
Personal Information
Inline edit, save per section
Real-time field validation; phone format 
checked against selected country code
Professional Details
Inline edit, save per section
Years of experience cross-checked 
against seniority level (warning, not 
blocking)
Skills
Tag-based multi-select with 
proficiency dropdown per tag
Primary skills capped at 5; system 
blocks adding a 6th with a tooltip 
explaining the cap
Availability & 
Preferences
Inline edit, save per section
Max salary must be ≥ min salary; 
system blocks save otherwise
Social & Online 
Presence
Inline edit, save per section
URL format validated per field; LinkedIn 
URL pattern specifically checked
Data Model
Field
Type
Notes
talent_id
UUID (FK)
Links to talent_profiles.id — one profile per talent
full_name, dob, 
gender, nationality, 
country, city, phone, 
photo_url
Mixed
Personal Information section — see field spec table
current_job_title, 
primary_role_category
, seniority_level, 
years_of_experience, 
bio, industries
Mixed
Professional Details section
primary_skills[], 
secondary_skills[], 
tools[], languages[]
Array (JSON)
Skills section — each skill entry includes proficiency level
availability_type, 
hours_per_week, 
preferred_timezones[], 
available_from_date, 
salary_min, 
salary_max, 
currency_pref
Mixed
Availability & Preferences section
linkedin_url, 
github_url, 
website_url, 
twitter_handle
String
Social & Online Presence section (optional)

## Page 6

Field
Type
Notes
profile_completion_pct
Integer 
(computed)
Recalculated on every save
requires_re_review
Boolean
Set true if a core field is edited post-classification
User Flow — Editing a Profile Field Post-Classification
6.
Talent (already Grade A, deployed or in pool) navigates to My Profile and opens the Skills 
section.
7.
Talent adds a new primary skill or changes proficiency level on an existing one and clicks Save.
8.
System detects this is a 'core field' (skills, seniority level, or CV) and sets requires_re_review = 
true on the talent record.
9.
System displays a banner to the talent: 'This change will be reviewed by our team before it affects 
your matching profile. Your current classification remains active in the meantime.'
10. Talent Manager receives a notification and reviews the change in the admin Talent Management 
panel.
11. Talent Manager either clears the flag (change accepted, no re-vetting needed) or, for significant 
changes (e.g., a completely new skill category), schedules a partial re-assessment.
12. Talent's deployment status and pool visibility remain unaffected throughout this review — the flag 
does not block matching.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-201
Section-Based Inline 
Editing
The system shall allow each profile section to be edited and 
saved independently, without requiring the entire profile form to 
be resubmitted.
REQ-KT-202
Real-Time Field 
Validation
The system shall validate each field in real time as the talent 
types or selects, displaying inline errors before save is 
attempted.
REQ-KT-203
Primary Skill Cap 
Enforcement
The system shall prevent a talent from adding more than 5 
primary skills, displaying an explanatory tooltip when the cap is 
reached.
REQ-KT-204
Core Field Change 
Flagging
The system shall set requires_re_review = true and notify the 
Talent Manager whenever a talent edits skills, seniority level, or 
re-uploads their CV after Stage 7 classification.
REQ-KT-205
Profile Completion 
Recalculation
The system shall recalculate profile_completion_pct immediately 
after every section save and reflect the updated percentage 
across all dashboard widgets without requiring a page refresh.
REQ-KT-206
Currency Display 
Conversion
The system shall display salary expectation fields in the talent's 
selected currency preference, converting from the internally 
stored USD value using a daily-refreshed exchange rate.
User Stories & Acceptance Criteria
  US-KT-201
  As a talent, I want to edit my profile information in clearly separated sections, so that I can update one 
part of my profile without re-entering everything else

## Page 7

  Acceptance Criteria
  Scenario 1: Saving a single section
Given  I am editing my Availability & Preferences section
When  I update my available start date and click Save
Then  Only the Availability & Preferences section is updated; my Skills and Personal Information sections 
remain unchanged and untouched
  Scenario 2: Blocking an invalid salary range
Given  I am editing my salary expectations
When  I set my maximum salary lower than my minimum salary and click Save
Then  The system blocks the save and shows 'Maximum must be greater than or equal to minimum' next to the 
relevant field
Business Rules & Validations
•
A talent cannot remove their CV without uploading a replacement in the same action — the 
system never allows a state with zero CV on file post-Stage-1.
•
Editing personal information fields (name, DOB, gender, nationality) after Stage 7 classification 
does not trigger re-review — only skills, seniority, and CV are 'core fields' for this purpose.
•
Country of residence changes after deployment require Talent Manager approval, since this may 
affect compliance documentation and tax treatment.
Notifications
Trigger Event
Recipient(s)
Channel(s)
Core field edited post-classification
Talent Manager
In-app + Email
Re-review flag cleared by admin
Talent
In-app

## Page 8

4.3 Module: Documents (KT-DOCS)
The Documents module is the talent's personal document vault — distinct from the Vetting and Contracts 
modules — covering CV, portfolio, certifications, and a read-only view of signed compliance documents. 
It is the single place a talent goes to manage anything they have uploaded or signed.
Screen / Field Specification
Tab
Content
Actions Available
My Documents
CV (with version history), Portfolio file/link, 
Certifications list
Upload new, replace existing, 
delete (CV cannot be deleted 
without replacement), download
Compliance 
Documents
Read-only list of all compliance documents 
with signature status badge
View PDF, download signed copy. 
No edit/delete — these are 
managed via the 
Vetting/Contracts flow
Document History
Chronological log of every upload, 
replacement, and signature event
Read only
Data Model
Field
Type
Notes
document_id
UUID (PK)
Per Section 13 documents table
user_id
UUID (FK)
Owner of the document
type
Enum
cv, portfolio, certification, nda, contractor_agreement, it_policy, 
data_protection_agreement, other
file_url, file_name, 
file_size_bytes
Mixed
Storage reference and metadata
status
Enum
uploaded, sent_for_signature, partially_signed, signed, 
expired, rejected
version_number
Integer
Incremented on re-upload of a document with the same 
type+name
certification_name, 
issuing_body, 
issue_date, 
expiry_date
Mixed
Only populated for type = certification
User Flow — Uploading or Replacing a CV
13. Talent navigates to Documents → My Documents tab.
14. Talent clicks 'Replace CV' next to the existing CV entry (or 'Upload CV' if none exists).
15. System opens a file picker restricted to PDF files up to 5MB.
16. Talent selects a file. System validates format and size client-side before upload.
17. On successful upload, system stores the new file, increments version_number, and retains the 
previous version in storage (not deleted).
18. If the talent has already passed Stage 2 (Skill Assessment) or beyond, the system sets 
requires_re_review = true and notifies the Talent Manager, per the cross-module rule defined in 
Section 4.2.

## Page 9

19. Talent sees a confirmation: 'Your CV has been updated (Version 3). Our team will review this 
change.'
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-301
CV Format & Size 
Enforcement
The system shall accept only PDF format for CV uploads with a 
maximum size of 5MB, rejecting other formats or oversized files 
with a clear inline error.
REQ-KT-302
Document Version 
Retention
The system shall retain all previous versions of a re-uploaded 
document (CV, portfolio) rather than overwriting them, 
incrementing a visible version number.
REQ-KT-303
Compliance Document 
Read-Only 
Enforcement
The system shall render all documents of type nda, 
contractor_agreement, it_policy, and data_protection_agreement 
as read-only in the Documents module — these can only be 
created or modified via the Vetting or Contracts workflow, never 
edited directly here.
REQ-KT-304
Certification Metadata 
Capture
The system shall require certification_name, issuing_body, and 
issue_date for every certification upload, with expiry_date 
optional but triggering an expiry reminder if provided.
REQ-KT-305
Certification Expiry 
Alerts
The system shall notify the talent 30 days before a stored 
certification's expiry_date, if one was provided.
User Stories & Acceptance Criteria
  US-KT-301
  As a talent, I want to manage all my documents — CV, portfolio, and certifications — in one place, so 
that clients and admins always see my most current materials
  Acceptance Criteria
  Scenario 1: Uploading a new certification
Given  I have completed a new Google Analytics certification
When  I upload the certificate PDF and enter the issuing body and issue date
Then  The certification appears in my Documents list and on my profile (visible to admins and, on shortlist, to 
clients)
  Scenario 2: Attempting to delete the only CV on file
Given  I have one CV on file and no replacement queued
When  I click 'Delete' on my CV
Then  The system blocks the deletion and shows: 'You must upload a replacement CV before removing this 
one.'
Business Rules & Validations
•
A talent's CV is never permanently deleted — even 'removed' versions remain retrievable by 
admin for compliance and dispute purposes.
•
Compliance documents (NDA, Contractor Agreement, etc.) only ever appear in this module after 
being generated and signed via the Vetting/Contracts workflow — there is no manual upload path 
for these document types.
•
Maximum total storage per talent across all document types is capped at 100MB; the system 
warns at 90MB usage.

## Page 10

Notifications
Trigger Event
Recipient(s)
Channel(s)
New document version uploaded (post 
Stage 2)
Talent Manager
In-app
Certification expiring in 30 days
Talent
In-app + Email

## Page 11

4.4 Module: Vetting Progress (KT-VETTING)
This is the core quality engine of the Talent Portal and the most operationally complex module in Kongila. 
It governs the talent-facing view of the 7-stage vetting pipeline. The corresponding admin-side actions for 
each stage are specified in the Admin Portal, Section 6.1 (Talent Management). This section specifies 
what the talent sees and can do at each stage, plus the requirements, stories, rules, and notifications 
scoped to the talent-facing experience.
4.4.1 Vetting Progress — Data Model
Field
Type
Notes
talent_id
UUID (FK)
Owner of the vetting record
stage_number
Integer (1–7)
Current or historical stage
stage_name
String
Application Screening / Skill Assessment / Behavioural 
Interview / Personality Test / Remote Work Readiness / Work 
Simulation / Final Review
status
Enum
pending, in_progress, passed, rejected, needs_clarification
score
Decimal (0–
100)
Nullable for Stage 4 (no pass/fail score) and Stage 1 (judgement 
only)
assessor_id
UUID (FK)
Admin user who scored/reviewed this stage
started_at, 
completed_at
Timestamp
Stage timing for SLA tracking
sla_deadline
Timestamp 
(computed)
started_at + stage SLA period
sla_breached
Boolean 
(computed)
True if current time exceeds sla_deadline and stage is not yet 
complete
4.4.2 Screen Specification — Vetting Progress Tracker
State
Visual Treatment
Information Shown to Talent
Completed (Passed)
Green background, 
checkmark icon
Stage name, completion date, 'Passed' label. Score 
shown only if global score-visibility setting permits.
Current (In 
Progress)
Blue border, pulsing 
indicator
Stage name, current status label, days in stage, specific 
next-action instruction (e.g., 'Complete your skill 
assessment by 14 Feb, 5:00 PM').
Upcoming (Locked)
Grey, lock icon
Stage name only — no dates, no detail.
Rejected
Red background, X 
icon
Stage name, rejection date, 'Not Passed'. Reason shown 
only if rejection-transparency admin setting is enabled.
Needs Clarification
Amber background, 
message icon
Stage name, 'Action Required' label, link to the specific 
message thread requesting clarification.
4.4.3 Talent-Facing Flow Per Stage
  Stage 1: Application Screening

## Page 12

20. Talent submits a complete profile (100% on required fields) and clicks 'Submit for Vetting Review' 
on the Vetting Progress screen.
21. Stage 1 record is created with status = in_progress, started_at = now. SLA clock starts (48 
business hours).
22. Talent sees: 'Your application is under review. We typically respond within 2 business days.'
23. On Talent Manager decision (see Admin Portal Section 6.1.1): talent receives Approve / Reject / 
Clarification outcome.
24. If 'Needs Clarification': talent sees a message in their Messages inbox with the specific request, 
and the Vetting Progress card shows 'Action Required' until the talent responds.
25. If Approved: Stage 1 turns green, Stage 2 (Skill Assessment) immediately becomes the active 
stage.
  Stage 2: Skill Assessment
26. Talent receives notification that a skill assessment has been assigned, with the deadline clearly 
stated.
27. Talent navigates to Vetting Progress, sees Stage 2 card with a 'Start Assessment' button and a 
live countdown timer once started.
28. Talent clicks 'Start Assessment'. A full-screen, distraction-minimized assessment interface 
launches, showing total questions and remaining time.
29. Talent answers all questions (multiple choice, written response, file upload, or scenario judgment 
per the question bank) and submits before the deadline.
30. If the browser is closed mid-assessment: talent has a 15-minute grace period to resume from 
where they left off via a 'Resume Assessment' button on the Vetting Progress screen.
31. After submission, the card shows: 'Submitted — awaiting review (typically within 48 hours).'
32. On scoring: talent sees Pass (advances to Stage 3) or Fail (rejected, reapplication eligibility date 
shown).
  Stage 3: Behavioural Interview
33. Talent receives an interview invitation notification with a 'View & Confirm' button.
34. Talent opens the Vetting Progress screen, sees Stage 3 card with proposed date/time (in their 
local timezone) and a video call link.
35. Talent can Confirm, or click 'Request Different Time' which opens a message to the Talent 
Manager.
36. Reminder notifications arrive 24hrs and 1hr before the interview.
37. Post-interview, the card shows 'Interview Complete — awaiting scoring' until the Talent Manager 
submits scores (within 4 hours per SLA).
38. On scoring: Pass advances to Stage 4. Fail shows rejection with reapplication date.
  Stage 4: Personality Test
39. Immediately after Stage 3 passes, talent receives a notification with a 'Take Personality Test' 
button.
40. Talent clicks through to the test interface (estimated 15–20 minutes, no hard time limit).
41. Talent completes and submits the test. Card shows 'Completed' immediately — no waiting period 
since this stage is automated and non-blocking.
42. If not completed within 24hrs: one reminder is sent. After 48hrs, the talent automatically advances 
to Stage 5 regardless (this stage cannot block the pipeline).

## Page 13

  Stage 5: Remote Work Readiness
43. Talent receives the Remote Readiness self-assessment form notification.
44. Talent completes the in-platform checklist: internet speed test screenshot upload, hardware 
confirmation checkboxes, power backup confirmation, tool familiarity checklist, optional 60-
second workspace video upload.
45. Talent submits. Card shows 'Submitted — awaiting Ops review (typically within 48 hours).'
46. On scoring: Pass advances to Stage 6. Fail shows the specific gaps identified (e.g., 'Internet 
speed below minimum requirement') and a 30-day reapplication-for-this-stage-only date.
  Stage 6: Work Simulation
47. Talent receives notification that a simulation task has been assigned, with the time window stated 
(e.g., '3-hour window, must start within 24 hours').
48. Talent opens Vetting Progress, reviews the simulation brief, and clicks 'Start Simulation' when 
ready to begin — this starts the countdown timer.
49. Talent completes the task and submits (file upload, URL, or text response) within the window via 
the same screen.
50. Late submissions (up to 30 minutes past window) are accepted with a visible warning that a 
timeliness deduction will apply.
51. Card shows 'Submitted — awaiting evaluation (typically within 48 hours)' after submission.
52. On scoring: Pass advances to Stage 7 (Final Review). Fail shows rejection with reapplication 
date.
  Stage 7: Final Review & Classification
53. Talent sees Stage 7 card as 'Under Final Review' — this stage has no talent-facing action; it is 
purely an Ops Lead review of all aggregated data.
54. On classification completion: talent receives their grade (A+, A, B, or Reject) and, per visibility 
settings, their composite score and talent tags.
55. If Grade A or A+: Vetting Progress shows all 7 stages green, and a new banner appears: 'You're 
fully vetted! Compliance documents are on their way for signature.'
56. If Grade B: talent sees: 'You've been classified as Trainable. You'll be re-assessed automatically 
in 4 weeks.' with optional link to training resources if configured.
57. If Reject: talent sees the rejection and the earliest eligible reapplication date (default 90 days).
4.4.4 Vetting Progress — Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-401
Always-Visible 
Pipeline
The system shall display the Vetting Progress screen with all 7 
stages visible at all times regardless of current stage, using the 
visual treatment defined in Section 4.4.2.
REQ-KT-402
Stage-Specific Action 
Buttons
The system shall render the correct action button on the current 
stage's card based on stage type: 'Start Assessment' (Stage 2), 
'Confirm Interview' (Stage 3), 'Take Personality Test' (Stage 4), 
'Submit Readiness Form' (Stage 5), 'Start Simulation' (Stage 6), 
or no button (Stages 1 and 7, which are admin-driven).
REQ-KT-403
Assessment Session 
Resume
The system shall allow a talent to resume an in-progress Stage 2 
assessment within a 15-minute grace period after an unexpected 
session interruption, preserving previously answered questions.

## Page 14

REQ-ID
Requirement
Specification
REQ-KT-404
Stage 4 Non-Blocking 
Auto-Advance
The system shall automatically advance a talent from Stage 4 to 
Stage 5 after 48 hours regardless of personality test completion 
status.
REQ-KT-405
Simulation Timer 
Start-on-Click
The system shall not start the Stage 6 simulation countdown 
timer until the talent explicitly clicks 'Start Simulation', even if the 
task was assigned earlier.
REQ-KT-406
SLA Breach Indicator
The system shall visually flag (amber/red) any stage where the 
configured SLA has been exceeded without the responsible 
admin taking action, both on the talent's card (generic 'taking 
longer than usual' message) and the admin panel (specific SLA 
breach alert).
REQ-KT-407
Classification 
Notification Content
The system shall notify the talent of their final classification 
(grade, and score/tags per visibility settings) within 5 minutes of 
the Ops Lead finalizing Stage 7.
4.4.5 Vetting Progress — User Stories & Acceptance Criteria
  US-KT-401
  As a talent, I want to always see exactly which vetting stage I'm in and what specific action is needed 
from me, so that I never have to guess or contact support to find out my status
  Acceptance Criteria
  Scenario 1: Viewing the action needed mid-pipeline
Given  I am at Stage 2 with an assessment assigned and 18 hours remaining
When  I open Vetting Progress
Then  I see the Stage 2 card highlighted with 'Start Assessment' button, a countdown showing '18 hours 
remaining', and all other stages shown per their correct visual state
  Scenario 2: Resuming an interrupted assessment
Given  My browser crashed 5 minutes into my Stage 2 assessment
When  I reopen the assessment within the 15-minute grace period
Then  I am returned to the exact question I was on with my previous answers intact and the original countdown 
continuing (not reset)
  US-KT-402
  As a talent, I want to be automatically moved forward if the personality test (Stage 4) doesn't require 
my urgent attention, so that a single non-critical stage doesn't delay my entire vetting process
  Acceptance Criteria
  Scenario 1: Auto-advance after 48 hours
Given  I have not completed the Stage 4 personality test 48 hours after it was assigned
When  The 48-hour window elapses
Then  I am automatically advanced to Stage 5 and the Remote Work Readiness form notification is sent to me, 
with Stage 4 remaining marked as 'incomplete' but non-blocking in my history
4.4.6 Vetting Progress — Business Rules & Validations
•
Stage transitions visible to the talent are strictly sequential and one-directional — a talent cannot 
see or access a future stage before the current one is resolved.

## Page 15

•
A talent cannot self-initiate a stage retry. All retries (e.g., a second attempt after a failed Stage 5) 
must be re-triggered by an admin per the reapplication window rules.
•
The Stage 6 simulation timer, once started by the talent, cannot be paused or restarted — if the 
browser closes mid-simulation, the original countdown continues server-side.
•
Talent never see the names or identities of the admin staff scoring their stages — only role titles 
where relevant (e.g., 'Talent Manager') are shown in communications.
4.4.7 Vetting Progress — Notifications
Trigger Event
Recipient(s)
Channel(s)
Stage 1 decision 
(Approve/Reject/Clarify)
Talent
In-app + Email + WhatsApp
Stage 2 assessment assigned
Talent
In-app + Email + WhatsApp
Stage 2 deadline — 24hrs remaining
Talent
In-app + WhatsApp
Stage 2 score result
Talent
In-app + Email
Stage 3 interview proposed
Talent
In-app + Email + WhatsApp
Stage 3 interview reminder (24hr / 1hr)
Talent
In-app + Email / WhatsApp
Stage 3 score result
Talent
In-app + Email
Stage 4 test assigned
Talent
In-app + Email
Stage 4 auto-advance (48hr non-
completion)
Talent
In-app
Stage 5 form assigned
Talent
In-app + Email + WhatsApp
Stage 5 score result
Talent
In-app + Email
Stage 6 simulation assigned
Talent
In-app + Email + WhatsApp
Stage 6 window closing — 30 min 
remaining
Talent
WhatsApp
Stage 6 score result
Talent
In-app + Email
Stage 7 classification complete
Talent
In-app + Email
Any stage SLA breach (internal)
Responsible Admin Role
In-app + Email

## Page 16

4.5 Module: Scores & Grade (KT-SCORES)
Distinct from the Vetting Progress tracker, Scores & Grade is the permanent post-classification scorecard 
— a read-only reference screen the talent can return to at any time to see their standing, understand 
their tags, and (for deployed talent) track how their Remotan performance score trends over time 
alongside their original vetting score.
Screen / Field Specification
Section
Content
Visible When
Vetting Scorecard
Composite score (if visibility enabled), grade badge, 
per-category score bars (if breakdown visibility 
enabled)
After Stage 7 
classification
Talent Tags
Full list of assigned tags with a one-line plain-English 
explanation of each
After Stage 7 
classification
Personality Snapshot
Work style label, communication preference, top 3 
strengths from the Stage 4 test
After Stage 7 
classification
Performance Trend 
(deployed only)
Line chart of performance score across all completed 
Remotan review cycles
After first Remotan 
performance review
Classification History
If re-assessed (e.g., Grade B → re-tested), a history 
of all classification events with dates
If more than one 
classification event 
exists
User Flow — Viewing the Scorecard
58. Talent navigates to Scores & Grade from the sidebar (only visible/enabled after Stage 7 
completion — greyed out with a tooltip pre-classification).
59. System checks the global score-visibility admin setting: full breakdown / grade-and-tags-only / 
hidden entirely.
60. If full breakdown enabled: talent sees the composite score, a bar chart of all 7 category scores, 
grade badge, and full tag list.
61. If grade-and-tags-only: talent sees the grade badge and tags, but no numerical scores anywhere 
on the screen.
62. If hidden: the sidebar item does not appear at all for talent (admin setting applies globally to all 
talent).
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-501
Score Visibility Setting 
Enforcement
The system shall render the Scores & Grade screen content 
according to the global score-visibility admin setting (full / grade-
only / hidden), applying identically to every talent account with no 
per-talent override.
REQ-KT-502
Performance Trend 
Chart
The system shall render a line chart of the talent's performance 
composite score across all completed Remotan review cycles, 
updating automatically as new reviews are scored.
REQ-KT-503
Tag Explanation Text
The system shall display a one-line plain-English explanation 
alongside each assigned talent tag, sourced from an admin-
managed tag dictionary.

## Page 17

REQ-ID
Requirement
Specification
REQ-KT-504
Sidebar Lock Pre-
Classification
The system shall display the Scores & Grade sidebar item in a 
locked/disabled state with an explanatory tooltip until Stage 7 
classification is complete.
User Stories & Acceptance Criteria
  US-KT-501
  As a deployed talent, I want to see how my performance score has trended since I started, so that I can 
understand whether I'm improving and take action if I'm declining
  Acceptance Criteria
  Scenario 1: Viewing performance trend after 3 reviews
Given  I have completed 3 monthly performance reviews with scores 72, 78, 85
When  I open Scores & Grade
Then  I see a line chart showing the upward trend across the 3 review dates, with my current score and a green 
up-arrow indicator
Business Rules & Validations
•
Score visibility setting changes by Super Admin apply retroactively and immediately to all talent 
— there is no grandfathering of a previous visibility state.
•
Grade B (Trainable) talent see a clear, encouraging explanation of what is needed to reach Grade 
A, sourced from their specific stage score gaps — never just a flat 'Trainable' label with no 
context.

## Page 18

4.6 Module: Opportunities (KT-OPPS)
Opportunities is the talent-facing view of the matches created by the Matching Engine (Kongila Module: 
Section 7). It shows every client service request the talent has been put forward for as a candidate, and 
the status of that candidacy through to outcome. This module only becomes visible after the talent 
passes Stage 7 and is added to the deployable pool.
Screen / Field Specification
Status Shown to 
Talent
Underlying Status
Talent Sees
Being Considered
proposed, shortlisted 
(internal)
'You're being considered for a [Role Title] 
opportunity.' No client identity revealed.
Submitted to Client
submitted_to_client
'Your profile has been shared with a client for [Role 
Title]. We'll update you on next steps.'
Interview Requested
(interview record 
created)
'A client would like to interview you!' — links directly 
to the Interviews module.
Hired
accepted
'Congratulations — you've been hired for [Role Title]!' 
— links to the new Contract.
Not Selected
rejected_by_admin, 
rejected_by_client
'This particular opportunity has moved forward with 
another candidate. You remain in our active pool for 
future matches.'
Data Model
Field
Type
Notes
match_id
UUID (FK)
Links to the matches table — one row per talent-request 
pairing
request_id
UUID (FK)
The client service request this match is for
match_score
Decimal
The calculated match % for this specific pairing — shown to 
talent as context
status
Enum
proposed, shortlisted, submitted_to_client, rejected_by_admin, 
rejected_by_client, accepted
client_role_title
String
Denormalized for display — role title the client is hiring for 
(client identity remains confidential pre-interview)
submitted_to_client_at
Timestamp
When the talent was actually presented to the client
User Flow — Opportunity Lifecycle (Talent View)
63. Talent Manager or Ops Manager matches the talent to an open client request in the Matching 
Engine (admin-side).
64. A new card appears in the talent's Opportunities list with status 'Being Considered'.
65. When the admin formally submits the talent as a candidate to the client, the card updates to 
'Submitted to Client' and the talent receives a notification.
66. If the client requests an interview: the card updates to 'Interview Requested' and a deep-link 
appears to the Interviews module to confirm a time.

## Page 19

67. If the client hires the talent: the card updates to 'Hired', a confirmation notification is sent, and a 
link to the new Contract (once generated) appears on the card.
68. If the client or admin passes on the talent for this specific request: the card updates to 'Not 
Selected' with the reassurance message, and the talent remains fully visible in the pool for other 
requests.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-601
Opportunities Visible 
Post-Pool-Entry Only
The system shall only display the Opportunities sidebar item and 
its content to talent with deployment_status = vetted_available or 
assigned.
REQ-KT-602
Client Identity 
Confidentiality Pre-
Hire
The system shall never reveal the client's company name or 
identifying details to the talent on an Opportunities card until a 
contract is activated.
REQ-KT-603
Status Mapping 
Abstraction
The system shall translate internal match statuses into the talent-
friendly labels defined in Section 4.6 screen specification, never 
exposing raw internal status enum values to the talent UI.
REQ-KT-604
Real-Time Status 
Sync
The system shall update an Opportunity card's status within 1 
minute of the corresponding admin or client action (e.g., interview 
request, hire decision).
User Stories & Acceptance Criteria
  US-KT-601
  As a vetted talent, I want to see every opportunity I've been put forward for and its current status, so 
that I always know what's in motion without needing to ask my Talent Manager directly
  Acceptance Criteria
  Scenario 1: Viewing an active opportunity
Given  I have been submitted as a candidate for a Customer Support role
When  I open Opportunities
Then  I see a card showing 'Submitted to Client — Customer Support', without any client company name 
shown
  Scenario 2: Opportunity moves to interview
Given  My card shows 'Submitted to Client'
When  The client requests an interview with me
Then  The card updates to 'Interview Requested' with a button 'View Interview Details' linking to the Interviews 
module
Business Rules & Validations
•
A talent cannot decline an opportunity from this screen directly in MVP — if a talent is unavailable 
for a specific opportunity, they must message their Talent Manager, who updates the match 
status manually.
•
Opportunities marked 'Not Selected' remain visible in the talent's history for 90 days, then are 
archived (not deleted) from the default view.
Notifications

## Page 20

Trigger Event
Recipient(s)
Channel(s)
Talent submitted to client as a 
candidate
Talent
In-app + Email
Client requests interview
Talent
In-app + Email + WhatsApp
Talent hired for an opportunity
Talent
In-app + Email + WhatsApp
Talent not selected for an opportunity
Talent
In-app

## Page 21

4.7 Module: Interviews (KT-INTERVIEW)
The talent-facing Interviews module manages the talent's side of the client interview scheduling flow 
defined in the Client Portal (Section 5.6). While the client initiates the request, this module is where the 
talent confirms availability, accesses call details, and provides their own post-interview reflection.
Screen / Field Specification
Tab
Content
Upcoming
All scheduled interviews: client role title (no company name pre-hire), date/time in 
talent's local timezone, video call link, 'Add to Calendar' button.
Past
Completed interviews with outcome (if shared by admin): Proceeded / Not Selected / 
Pending Decision.
Action Required
Interviews proposed by a client that the talent has not yet confirmed — requires a 
response within 24 hours.
User Flow — Confirming a Proposed Interview Slot
69. Talent receives a notification: 'A client has requested to interview you for [Role Title].'
70. Talent opens Interviews → Action Required tab. Sees the proposed date/time (already converted 
to their local timezone) and an estimated duration.
71. Talent clicks 'Confirm' to accept, or 'Request Different Time' which opens a message thread with 
their assigned Account Officer to renegotiate.
72. On Confirm: interview status updates to 'scheduled', moves to the Upcoming tab, and both the 
client and Account Manager are notified of confirmation.
73. 24hrs and 1hr before the interview, the talent receives reminder notifications with the call link 
prominently included.
74. After the interview, the talent can optionally add private notes for their own reference (not shared 
with the client or admin) via a 'My Notes' field on the interview record.
75. Once the admin records the official outcome, the interview moves to the Past tab with the 
outcome label (if the admin has enabled outcome-sharing with talent).
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-701
24-Hour Confirmation 
Window
The system shall require talent to confirm or request changes to 
a proposed interview slot within 24 hours, escalating to the 
Account Manager if no response is received.
REQ-KT-702
Timezone Auto-
Conversion
The system shall always display interview times in the talent's 
profile-configured timezone, regardless of which timezone the 
client or admin used when scheduling.
REQ-KT-703
Private Talent Notes
The system shall allow talent to add private notes to any 
interview record, visible only to that talent and never to clients or 
admin.
REQ-KT-704
Outcome Visibility 
Setting
The system shall only display interview outcomes (Proceeded / 
Not Selected) to talent if the admin has enabled outcome-sharing 
in system settings; otherwise the Past tab shows 'Completed' 
only.

## Page 22

User Stories & Acceptance Criteria
  US-KT-701
  As a talent, I want to confirm or reschedule a proposed interview directly from my dashboard, so that I 
don't have to coordinate scheduling exclusively through email
  Acceptance Criteria
  Scenario 1: Confirming a proposed slot
Given  A client has proposed an interview for Thursday at 3:00 PM in my local time
When  I click 'Confirm' in the Action Required tab
Then  The interview moves to my Upcoming tab, the client and my Account Manager are notified, and I receive 
calendar reminder notifications at 24hrs and 1hr before
Business Rules & Validations
•
If a talent does not respond to a proposed interview within 24 hours, the Account Manager is 
alerted to follow up directly — the system does not auto-cancel the interview request.
•
A talent can have a maximum of 5 upcoming interviews simultaneously across all opportunities.
Notifications
Trigger Event
Recipient(s)
Channel(s)
Interview proposed — action required
Talent
In-app + Email + WhatsApp
24hr no-response escalation
Account Manager
In-app + Email
Interview confirmed by talent
Client + Account 
Manager
In-app
Interview reminder (24hr / 1hr)
Talent
In-app + Email / WhatsApp

## Page 23

4.8 Module: Contracts & Employment History (KT-CONTRACTS)
This module is the talent's permanent employment record within Kongila — every contract they have 
ever signed, its current status, and the performance history associated with it. It is the talent-side 
counterpart to the Client Portal's 'My Team' module and the Admin Portal's Contracts & Compliance 
module.
Screen / Field Specification
View
Content
Actions
Active Contract(s)
Client name (now visible, since contract is active), 
role, start date, monthly rate, current performance 
score, next review date
View Contract PDF, Open 
Remotan Workspace
Pending Signature
Contracts awaiting the talent's signature
Review & Sign (opens e-
signature flow)
Past Contracts
All completed or terminated contracts with final 
performance rating and duration
View Contract PDF, View 
Performance Summary
Data Model
Field
Type
Notes
contract_id
UUID (FK)
Per the contracts table, Section 13
reference_number
String
Format KNG-CON-YYYYMMDD-NNNN
service_type, 
role_title, start_date, 
end_date, 
engagement_type
Mixed
Core contract terms
status
Enum
draft, pending_signatures, client_signed, talent_signed, active, 
completed, terminated
monthly_rate_usd
Decimal
Talent's gross monthly rate — shown to talent in their preferred 
currency
performance_score
Decimal 
(computed)
Latest aggregated performance score from Remotan for this 
contract
talent_signed_at, 
talent_sign_ip
Mixed
Signature audit trail for this talent's signature event
User Flow — Signing a New Contract
76. Talent receives notification: 'A client wants to hire you! Please review and sign your contract.'
77. Talent opens Contracts → Pending Signature tab and clicks 'Review & Sign' on the relevant 
contract.
78. Contract PDF is displayed in-platform. Talent must scroll to the bottom before the 'Sign' button 
activates.
79. Talent enters their full legal name as a typed signature and clicks 'Sign Contract'.
80. System captures: typed name, timestamp, IP address, and a hash of the exact document version 
signed.
81. If the client has not yet signed: contract status shows 'Awaiting Client Signature'. If the client has 
already signed: contract status immediately updates to 'active'.

## Page 24

82. On full activation: the contract moves to the Active Contracts view, the client's identity is now fully 
visible, and a 'Open Remotan Workspace' button appears.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-801
Scroll-to-Bottom 
Signature Gate
The system shall disable the 'Sign' button until the talent has 
scrolled through the entire contract document.
REQ-KT-802
Signature Capture 
Completeness
The system shall capture and permanently store the typed 
signature name, timestamp, IP address, and document hash for 
every talent signature event.
REQ-KT-803
Client Identity Reveal 
on Activation
The system shall reveal the client's full company name and 
contact details to the talent only once the contract reaches status 
= active (both signatures complete).
REQ-KT-804
Performance Score 
Real-Time Link
The system shall display the latest performance_score for each 
active contract, sourced live from Remotan's performance review 
records, updating without requiring talent action.
REQ-KT-805
Contract PDF Always 
Downloadable
The system shall provide a 'Download PDF' action for every 
contract regardless of status, generating a watermarked draft 
PDF for unsigned contracts and the final signed PDF for 
active/completed contracts.
User Stories & Acceptance Criteria
  US-KT-801
  As a talent, I want to review and sign my employment contract directly within the platform, so that I can 
start working without needing external tools or printing/scanning documents
  Acceptance Criteria
  Scenario 1: Signing a contract awaiting only my signature
Given  The client has already signed my contract for a Virtual Assistant role
When  I review the full document, scroll to the bottom, and sign with my typed name
Then  The contract immediately moves to status = active, I see the client's company name for the first time, and 
I receive a confirmation notification with a button to open my new Remotan workspace
Business Rules & Validations
•
A talent can hold only one active contract at a time in MVP. The system blocks signing a second 
contract while one is already active, directing the talent to contact their Talent Manager.
•
Contract documents, once signed, are immutable. Any correction requires a formal amendment 
contract, never an edit to the original signed PDF.
Notifications
Trigger Event
Recipient(s)
Channel(s)
New contract ready for signature
Talent
In-app + Email + WhatsApp
Contract activated (both parties signed)
Talent
In-app + Email + WhatsApp
Contract renewal approaching (30 
days)
Talent
In-app + Email

## Page 25

Trigger Event
Recipient(s)
Channel(s)
Contract terminated
Talent
In-app + Email

## Page 26

4.9 Module: Earnings (KT-EARNINGS)
Earnings is the talent's financial transparency module — a complete view of what they have been paid, 
what is pending, and when their next payout is expected. This module reads from the talent_payouts 
table (Section 13) but never allows talent to initiate or modify payout records.
Screen / Field Specification
Section
Content
Summary Bar
Total earned (all time), pending payout amount, next expected payout date
Payout History Table
Each row: period, gross amount, commission deducted, net amount 
received, payment method, status, date paid. Sortable by date.
Payment Method on File
Talent's configured payout method and masked account details. 'Update 
Payment Details' button → opens a secure form.
Earnings by Contract (if 
multiple historical 
contracts)
Breakdown of total earnings per past/active contract
Data Model
Field
Type
Notes
payout_id
UUID (FK)
Per talent_payouts table
payout_month
Date
Period this payout covers
gross_amount_usd, 
commission_deducted
_usd, net_amount_usd
Decimal
Full breakdown shown to talent for transparency
payment_method
Enum
paystack, wise, payoneer, bank_transfer
status
Enum
pending, approved, processing, paid, failed
paid_at
Timestamp
Actual payment completion time
User Flow — Updating Payment Details
83. Talent navigates to Earnings and clicks 'Update Payment Details'.
84. A secure form opens showing the current payout method (masked) and allowing selection of a 
new method: Wise / Paystack / Payoneer / Bank Transfer.
85. Talent enters the required fields for the selected method (e.g., Wise email, bank account number 
+ routing details).
86. On submission, the new details are stored encrypted and a confirmation notification is sent to 
both the talent and Finance Admin.
87. The new payment method takes effect from the next payout cycle — it does not retroactively 
affect payouts already in 'processing' status.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-901
Read-Only Payout 
The system shall display the talent's complete payout history as

## Page 27

REQ-ID
Requirement
Specification
History
read-only — no edit, delete, or dispute action is available directly 
on a payout record from this screen.
REQ-KT-902
Full Payout 
Breakdown 
Transparency
The system shall show gross amount, commission deducted 
(with percentage), and net amount for every payout record, never 
displaying only the net figure.
REQ-KT-903
Encrypted Payment 
Detail Storage
The system shall store all bank account and payout method 
details using field-level encryption, masking all but the last 4 
digits in any UI display.
REQ-KT-904
Payment Method 
Update Confirmation
The system shall notify both the talent and Finance Admin 
whenever payout method details are changed, and shall apply 
the change only to future payout cycles.
REQ-KT-905
Next Payout Date 
Display
The system shall display the next expected payout date on the 
Earnings summary bar, calculated from the talent's active 
contract's configured payout schedule.
User Stories & Acceptance Criteria
  US-KT-901
  As a deployed talent, I want to see a full transparent breakdown of every payment I've received, so that I 
can verify my pay is correct and understand exactly what was deducted and why
  Acceptance Criteria
  Scenario 1: Viewing a payout breakdown
Given  I received a payout for January with a gross amount of $1,000 and a 15% commission
When  I open my Earnings history and click the January payout
Then  I see: Gross $1,000.00, Commission Deducted (15%) $150.00, Net Received $850.00, Payment Method: 
Wise, Paid: 31 Jan 2026
  Scenario 2: Updating payout method
Given  I want to switch from Wise to Payoneer
When  I update my payment details and submit
Then  I see a confirmation that my new method will apply from the next payout cycle, and my current pending 
payout (if any) is unaffected and processed via the original method
Business Rules & Validations
•
A talent cannot view or access another talent's payout information under any circumstance, 
enforced at the API layer in addition to the UI.
•
If a payout fails (status = failed), the talent sees a clear notice with an instruction to verify their 
payment details, and Finance Admin is automatically alerted to investigate.
•
Payout history is permanent and never deleted, even if a talent's contract is later terminated.
Notifications
Trigger Event
Recipient(s)
Channel(s)
Payout processed successfully
Talent
In-app + Email
Payout failed
Talent + Finance Admin
In-app + Email
Payment method updated
Talent + Finance Admin
In-app + Email

## Page 28

Trigger Event
Recipient(s)
Channel(s)
Upcoming payout in 3 days
Talent
In-app

## Page 29

4.10 Module: Tasks — Remotan Workspace Link (KT-TASKS)
Tasks is not a re-implementation of task management within Kongila — it is a governed deep-link into the 
talent's Remotan workspace, where the actual task and project management functionality lives (see 
Section 7.2, Remotan Task & Project Management). This module's responsibility within Kongila is purely 
to gate access correctly and provide a lightweight preview before the talent leaves the Kongila portal.
Screen / Field Specification
Element
Behaviour
Sidebar Item Visibility
Hidden entirely until the talent has an active contract with a Remotan-
enabled client. Once visible, always shown.
Preview Card
Shows: number of open tasks assigned to the talent, number overdue, next 
deadline — pulled live from Remotan via the shared data layer.
'Open Workspace' 
Button
Single-sign-on deep-link that authenticates the talent directly into their 
Remotan workspace without a second login.
User Flow — Accessing Remotan from Kongila
88. Talent's contract reaches status = active. System provisions a Remotan workspace seat for the 
talent (see Section 7.1).
89. The 'Tasks' sidebar item becomes visible in the talent's Kongila portal, previously hidden.
90. Talent clicks 'Tasks'. System displays the lightweight preview card (open tasks, overdue count, 
next deadline) sourced via a real-time API call to Remotan.
91. Talent clicks 'Open Workspace'. System generates a short-lived SSO token and redirects the 
talent to their Remotan workspace, authenticated without re-entering credentials.
92. If the talent's contract later ends (status = completed or terminated): the Tasks sidebar item is 
hidden again, and the talent's Remotan seat access is revoked per Section 7.1 offboarding rules.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-
1001
Conditional Sidebar 
Visibility
The system shall show the Tasks sidebar item only when the 
talent has at least one contract with status = active linked to a 
Remotan-enabled client.
REQ-KT-
1002
Live Preview Data
The system shall display real-time open task count, overdue 
count, and next deadline on the Tasks preview card, sourced 
directly from Remotan's task data without caching delay 
exceeding 2 minutes.
REQ-KT-
1003
Single Sign-On Deep 
Link
The system shall authenticate the talent into Remotan via a 
short-lived SSO token when 'Open Workspace' is clicked, without 
requiring a second login.
REQ-KT-
1004
Access Revocation on 
Contract End
The system shall hide the Tasks sidebar item and revoke the 
talent's Remotan SSO access within 5 minutes of a contract's 
status changing to completed or terminated.
User Stories & Acceptance Criteria
  US-KT-1001

## Page 30

  As a deployed talent, I want to jump straight into my Remotan task workspace from my Kongila 
dashboard, so that I don't need to manage two separate logins for two connected platforms
  Acceptance Criteria
  Scenario 1: Accessing Remotan for the first time
Given  My contract was just activated and I have never opened Remotan before
When  I click 'Tasks' then 'Open Workspace'
Then  I am taken directly into my Remotan workspace, already logged in, with my profile and assigned client 
team visible
Business Rules & Validations
•
Kongila never duplicates or caches actual task content (titles, descriptions, comments) — only 
summary counts are surfaced in the preview card; the full experience lives exclusively in 
Remotan.
•
SSO tokens for the Kongila-to-Remotan handoff expire after 60 seconds if unused, to prevent 
token leakage.

## Page 31

4.11 Module: Messages (KT-MSG)
Messages is the talent's in-platform inbox for structured communication with Kongila staff — primarily 
their assigned Talent Manager during vetting and their assigned Account Officer post-deployment. This is 
distinct from Remotan's workspace messaging (Section 7.7), which is for day-to-day work communication 
with clients and supervisors.
Screen / Field Specification
Element
Behaviour
Conversation List
All threads sorted by most recent activity. Unread threads bolded with a 
count badge.
Thread View
Full message history with timestamps. Read receipts shown as 'Seen' once 
the admin has opened the message.
Composer
Text input with markdown support, file attachment (max 10MB), send button.
Context Banner
If the conversation is linked to a specific stage/request/contract, a banner at 
the top of the thread shows that context (e.g., 'Re: Stage 1 Application 
Review').
Data Model
Field
Type
Notes
conversation_id
UUID (FK)
Per conversations table, type = talent_admin
participant_ids
UUID[]
Talent + one or more admin staff
context_type, 
context_id
Mixed
Optional link to a specific vetting stage, request, or contract 
that the conversation relates to
User Flow — Responding to a Clarification Request
93. Talent Manager requests clarification at Stage 1, which automatically creates or appends to a 
conversation thread with context_type = vetting, context_id = the Stage 1 record.
94. Talent receives a notification and opens Messages, sees the thread highlighted with a 'Vetting — 
Action Required' context banner.
95. Talent reads the specific request, types a response, optionally attaches a supporting file, and 
clicks Send.
96. Talent Manager receives the response notification, reviews, and either resolves the clarification 
(advancing the talent) or asks a follow-up question in the same thread.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-
1101
Context-Linked 
Conversations
The system shall automatically link a conversation to its 
originating context (vetting stage, service request, or contract) 
when created from within an admin workflow action, displaying 
this context as a banner in the thread.
REQ-KT-
1102
Read Receipts
The system shall display a 'Seen' indicator with timestamp on a 
message once the recipient has opened the conversation thread.

## Page 32

REQ-ID
Requirement
Specification
REQ-KT-
1103
File Attachment 
Support
The system shall allow file attachments up to 10MB per 
message, supporting PDF, DOC, JPG, and PNG formats.
REQ-KT-
1104
Unread Count 
Accuracy
The system shall maintain an accurate unread message count on 
the Messages sidebar item, decrementing immediately when a 
thread is opened.
User Stories & Acceptance Criteria
  US-KT-1101
  As a talent, I want to communicate directly with my Talent Manager about my vetting status, so that I 
can resolve questions quickly without needing to email an external address
  Acceptance Criteria
  Scenario 1: Responding to a clarification request
Given  My Talent Manager has requested clarification about a gap in my CV
When  I open the linked conversation thread and submit my explanation with a supporting reference letter 
attached
Then  My Talent Manager receives a notification, can view my attached file, and the Stage 1 review can 
proceed
Business Rules & Validations
•
A talent cannot initiate a brand-new conversation with an arbitrary admin user — conversations 
are only created in response to an admin-initiated thread or via the Support module's ticket 
system.
•
Messages are retained for the lifetime of the account plus 12 months after account closure, for 
dispute resolution purposes.
Notifications
Trigger Event
Recipient(s)
Channel(s)
New message received
Talent
In-app + Email (if unread after 2 
hours)

## Page 33

4.12 Module: Notifications Centre (KT-NOTIF)
The Notifications Centre is the comprehensive, permanent log of every system-generated notification 
sent to the talent across every module — vetting, interviews, contracts, payouts, and messages. It is 
distinct from the individual toast/banner notifications shown contextually within each module; this is the 
canonical historical record.
Screen / Field Specification
Element
Behaviour
Filter Tabs
All / Unread / by category (Vetting, Interviews, Contracts, Payments, 
Messages)
Notification Row
Icon (category-coded), title, brief description, timestamp, read/unread dot 
indicator
Click-Through
Clicking any notification navigates directly to the relevant record/screen (e.g., 
a payout notification opens Earnings at that specific payout)
Mark All as Read
Single action to clear all unread indicators without navigating to each item
User Flow — Reviewing and Clearing Notifications
97. Talent clicks the Notifications sidebar item (or the bell icon badge from any screen).
98. System displays all notifications in reverse chronological order, with unread ones visually distinct 
(bold text, coloured dot).
99. Talent clicks a specific notification (e.g., 'Your Stage 2 assessment has been scored').
100.
System marks that notification as read and navigates the talent to the relevant screen 
(Vetting Progress, in this example).
101.
Talent can alternatively click 'Mark All as Read' to clear all unread indicators without 
leaving the Notifications Centre.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-
1201
Complete Notification 
Log
The system shall log every notification event defined across all 
talent-facing modules into a single permanent, queryable 
Notifications Centre, regardless of which delivery channels 
(email/WhatsApp) were also used.
REQ-KT-
1202
Category Filtering
The system shall allow filtering of the notification list by category: 
Vetting, Interviews, Contracts, Payments, Messages, and 
General.
REQ-KT-
1203
Click-Through 
Navigation
The system shall navigate the talent to the specific relevant 
record or screen when a notification is clicked, not merely to the 
parent module's default view.
REQ-KT-
1204
Bulk Mark-as-Read
The system shall provide a single action to mark all unread 
notifications as read without requiring individual interaction with 
each one.
User Stories & Acceptance Criteria
  US-KT-1201

## Page 34

  As a talent, I want to see a complete history of every notification I've ever received in one place, so that 
I can find something I may have missed without searching my email
  Acceptance Criteria
  Scenario 1: Filtering by category
Given  I want to review only payment-related notifications
When  I select the 'Payments' filter tab in the Notifications Centre
Then  I see only payout-related notifications, in reverse chronological order
Business Rules & Validations
•
Notifications older than 12 months are archived from the default view but remain accessible via a 
'Load Older' action — never permanently deleted.
•
The Notifications Centre always reflects the true read/unread state synced across web sessions 
— opening a notification on mobile marks it read on desktop too.

## Page 35

4.13 Module: Account Settings (KT-SETTINGS)
Settings governs the talent's account-level preferences: security (password, MFA), notification channel 
preferences per event category, and account deletion requests. This is distinct from My Profile, which 
governs professional/matching data.
Screen / Field Specification
Section
Content
Actions
Security
Current email (read-only, change requires support 
ticket), password change form, MFA enable/disable 
toggle with QR setup flow
Change Password, 
Enable/Disable MFA
Notification 
Preferences
Per-category toggle (Vetting Updates, Interview Alerts, 
Payment Alerts, Messages, Marketing) for each 
channel (Email, WhatsApp) independently
Toggle switches, auto-
saved on change
Language 
Preference
Display language for the platform UI (Phase 2: multi-
language support)
Dropdown, English 
only at MVP
Account Deletion
Request permanent account deletion — explains data 
retention policy and consequences
Request Deletion 
(requires confirmation 
+ reason)
User Flow — Disabling Non-Critical Notification Channels
102.
Talent navigates to Settings → Notification Preferences.
103.
Talent toggles off WhatsApp notifications for the 'Marketing' category while leaving Email 
and 'Vetting Updates' WhatsApp untouched.
104.
Change is saved immediately (no separate Save button — each toggle auto-saves).
105.
From this point forward, the talent receives no WhatsApp marketing messages, but 
continues receiving all critical operational notifications (vetting, interviews, payments) per their 
other settings.
Functional Requirements
REQ-ID
Requirement
Specification
REQ-KT-
1301
Granular Notification 
Preferences
The system shall allow talent to independently toggle Email and 
WhatsApp delivery for each notification category, with changes 
taking effect immediately.
REQ-KT-
1302
Critical Notification 
Floor
The system shall not allow talent to fully disable notifications 
related to active vetting stage actions, interview scheduling, or 
payment failures — these categories always retain at least in-app 
delivery regardless of preference settings.
REQ-KT-
1303
MFA Self-Service 
Setup
The system shall provide a self-service TOTP MFA setup flow 
including QR code generation and a verification step before 
activation.
REQ-KT-
1304
Account Deletion 
Request Flow
The system shall require talent to provide a reason and confirm 
understanding of data retention policy before submitting an 
account deletion request, which is then routed to Super Admin 
for manual processing within 30 days per GDPR-aligned 
timelines.

## Page 36

User Stories & Acceptance Criteria
  US-KT-1301
  As a talent, I want to control which notification channels I receive for non-urgent updates, so that I'm 
not overwhelmed by WhatsApp messages while still never missing anything important
  Acceptance Criteria
  Scenario 1: Disabling marketing WhatsApp messages
Given  I am being sent WhatsApp messages I consider promotional
When  I toggle off WhatsApp for the Marketing category in Settings
Then  I stop receiving WhatsApp marketing messages immediately, while continuing to receive WhatsApp 
alerts for interview scheduling and payment events
  Scenario 2: Attempting to disable critical alerts
Given  I try to toggle off all channels for 'Vetting Updates'
When  I attempt to disable the last remaining channel (in-app)
Then  The system prevents this and shows: 'At least one notification channel must remain active for vetting 
updates.'
Business Rules & Validations
•
Email address changes are never self-service in MVP — they require a support ticket with identity 
verification, to prevent account takeover via email change.
•
Account deletion requests do not immediately delete data — per the platform's data retention 
policy (Section 11), processing takes up to 30 days and is handled manually by Super Admin.
Notifications
Trigger Event
Recipient(s)
Channel(s)
Password changed
Talent
Email
MFA enabled/disabled
Talent
Email
Account deletion requested
Super Admin
In-app + Email

## Page 37

4.14 Module: Support (KT-SUPPORT)
Support provides talent with a direct channel to raise issues, ask questions, and track resolution — 
separate from the Messages module, which is for ongoing relationship communication with assigned 
staff. Support is ticket-based with SLA tracking.
Screen / Field Specification
Tab
Content
Open Tickets
All tickets not yet resolved, with status badge and last update timestamp
Resolved Tickets
Historical tickets, searchable
FAQ
Searchable knowledge base organized by category (Vetting, Payments, 
Contracts, Technical)
Live Chat (if staffed)
Real-time chat widget connecting to an available support agent during business 
hours; falls back to ticket creation outside hours
Data Model
Field
Type
Notes
ticket_id
UUID (PK)
Unique support ticket identifier
talent_id
UUID (FK)
Ticket owner
category
Enum
Account Access, Vetting Question, Payment Issue, Technical 
Bug, Other
subject, description
Text
Ticket content
status
Enum
open, in_progress, awaiting_talent_response, resolved, closed
priority
Enum
Low, Medium, High, Urgent — auto-set by category, 
escalatable by support staff
assigned_to
UUID (FK)
Support staff member handling the ticket
User Flow — Raising a Payment Support Ticket
106.
Talent navigates to Support and clicks 'New Ticket'.
107.
Talent selects category 'Payment Issue' from the dropdown — system auto-sets priority to 
High based on category-priority mapping.
108.
Talent enters a subject and detailed description, optionally attaching a screenshot.
109.
Talent submits. System creates the ticket, auto-routes it to the Finance Admin support 
queue (category-based routing), and shows the talent a ticket reference number.
110.
Finance Admin responds within the SLA for High priority (4 business hours). Talent 
receives a notification and can respond within the same ticket thread.
111.
Once resolved, Finance Admin marks status = resolved. Talent receives a notification and 
can reopen within 7 days if the issue persists, after which a new ticket is required.
Functional Requirements

## Page 38

REQ-ID
Requirement
Specification
REQ-KT-
1401
Category-Based Auto-
Routing
The system shall automatically route a new support ticket to the 
appropriate admin role based on its category (e.g., Payment 
Issue → Finance Admin, Vetting Question → Talent Manager).
REQ-KT-
1402
Category-Based 
Priority Defaults
The system shall auto-assign a default priority level based on 
ticket category, with support staff able to manually escalate or 
de-escalate.
REQ-KT-
1403
SLA Tracking Per 
Priority
The system shall track and display time-to-first-response against 
the defined SLA per priority level (Urgent: 1hr, High: 4hrs, 
Medium: 24hrs, Low: 48hrs), flagging breaches to the assigned 
admin's supervisor.
REQ-KT-
1404
Ticket Reopening 
Window
The system shall allow a talent to reopen a resolved ticket within 
7 days of resolution; after this window, a new ticket must be 
created.
REQ-KT-
1405
FAQ Search
The system shall provide a searchable FAQ knowledge base, 
organized by category, accessible without creating a support 
ticket.
User Stories & Acceptance Criteria
  US-KT-1401
  As a talent, I want to raise a support ticket and track its resolution status, so that I know my issue is 
being handled and can follow up if needed
  Acceptance Criteria
  Scenario 1: Raising and tracking a payment issue
Given  I have not received my expected payout
When  I submit a 'Payment Issue' ticket with details
Then  I receive a ticket reference number, the ticket is auto-routed to Finance Admin with High priority, and I 
can track its status from 'open' through to 'resolved' in my Open Tickets tab
  Scenario 2: SLA breach escalation
Given  My High priority ticket has not received a first response within 4 business hours
When  The SLA window elapses
Then  The assigned Finance Admin's supervisor (Ops Manager) is automatically alerted to the breach
Business Rules & Validations
•
A talent cannot submit more than 5 open tickets simultaneously — the system displays a 
message directing them to consolidate related issues into existing open tickets.
•
Tickets categorized as 'Account Access' bypass the normal routing and go directly to Super 
Admin, given the security sensitivity.
Notifications
Trigger Event
Recipient(s)
Channel(s)
Ticket created — confirmation
Talent
In-app + Email
Ticket response received
Talent
In-app + Email
Ticket resolved
Talent
In-app + Email

## Page 39

Trigger Event
Recipient(s)
Channel(s)
SLA breach (internal)
Assigned admin's 
supervisor
In-app + Email
