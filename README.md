# SHDS — Smart Hospital Digitalization System

A hospital management system (HMS) for Indian hospitals and hospital chains. A single install covers:

- the front desk and the lobby kiosk;
- OPD with its token queue;
- in-patient admission through to discharge, including nursing and shift handover;
- pharmacy, lab and radiology, diet and meals;
- billing and the insurance/TPA desk;
- a full audit trail of who did what.

It is designed to be white-labelled. Any hospital, nursing home or institute can set its own name and UHID prefix.

This file is the only documentation. A slide-style overview for presenting the project is in [docs/presentation.html](docs/presentation.html); open it in any browser and use the arrow keys.

**Contents**

1. [Quick start](#1-quick-start)
2. [Tech stack and architecture](#2-tech-stack-and-architecture)
3. [Roles and how people sign in](#3-roles-and-how-people-sign-in)
4. [Modules](#4-modules)
5. [Patient journey, A to Z](#5-patient-journey-a-to-z)
6. [The interface (Wayfinder)](#6-the-interface-wayfinder)
7. [Phases and status](#7-phases-and-status)
8. [What still needs fixing](#8-what-still-needs-fixing)
9. [Testing](#9-testing)
10. [Demo accounts](#10-demo-accounts)
11. [UAT scripts](#11-uat-scripts)
12. [Deployment](#12-deployment)
13. [Developer conventions](#13-developer-conventions)
14. [Future scope, including AI](#14-future-scope-including-ai)

---

## 1. Quick start

**Requirements:** Node.js 20.9+, npm 10+, PostgreSQL 15+ (local, Supabase or any managed Postgres), and Google Chrome (only needed for the browser system test).

```bash
npm install                      # also generates the Prisma client
cp .env.example .env             # then fill in the values below
createdb smart_hospital          # or point DATABASE_URL at a hosted database
npx prisma migrate deploy        # creates every table and loads the starter price list, formulary, tests and menu
npm run dev                      # http://localhost:3000 → sign-in page
```

### Environment variables

| Variable | Needed | Purpose |
|---|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Yes | Postgres connection. For Supabase, use the pooler (6543) and direct (5432) URLs. Percent-encode special characters in passwords. |
| `JWT_SECRET` | Yes | Signs sign-in cookies. Use a long random string, and always set it in production. |
| `JWT_ALGORITHM`, `JWT_EXPIRES_IN_MINUTES` | — | Defaults: `HS256`, `12506`. |
| `NEXT_PUBLIC_HOSPITAL_NAME` | — | Name shown on screens, bills and summaries. |
| `UHID_PREFIX` | — | Prefix for patient numbers, e.g. `SHDS` gives `SHDS-00000042`. |
| `SUPER_ADMIN_EMAIL` | — | Email address that is always treated as super admin. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional | Google sign-in. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `PASSWORD_RESET_TOKEN_EXPIRES_MINUTES` | Optional | Password-reset emails. |
| `OTP_STATIC_CODE` | Dev only | Fixed mobile OTP for testing. Production always generates a random code. |
| `CRON_SECRET` | Optional | Protects `/api/cron/escalate` (grievance escalation). |
| `TEST_DATABASE_URL` | Tests | Defaults to `postgresql://localhost:5432/smart_hospital_test`. The name must contain `_test`. |
| `NEXT_PUBLIC_APP_URL` | — | Public URL used in links. |

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server (Turbopack). |
| `npm run build` / `npm start` | Production build and serve. |
| `npm run lint` | ESLint. |
| `npm run db:migrate` / `db:push` / `db:generate` / `db:studio` | Prisma helpers. |
| `npm test` | Every unit and integration test. |
| `npm run test:unit` | Unit tests; no database needed. |
| `npm run test:integration` | Integration tests against the test database. |
| `npm run test:db:prepare` | Creates the schema in the test database. |
| `npm run test:system` | Browser walk-through of the running app, covering every role. |

---

## 2. Tech stack and architecture

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router, Turbopack), React 19, Server Components and Server Actions |
| Database | PostgreSQL through Prisma 7 (`prisma-client` generator → `app/generated/prisma`, `@prisma/adapter-pg`) |
| UI | Tailwind CSS 4, shadcn/ui on Base UI, Lucide icons, Figtree and Noto Sans Devanagari fonts |
| Auth | JWT in an HTTP-only cookie (`jose`), bcrypt, mobile OTP, Google OAuth, registration codes for staff |
| Validation | Zod and React Hook Form |
| Tests | Vitest (unit and integration projects) and Puppeteer (system walk-through) |

### Folder layout

```
actions/            Server actions, one file per domain (admissions, nursing, pharmacy, lab, meals, insurance, …)
app/(auth)/         Sign-in, sign-up, forgot / reset password
app/(dashboard)/    Every signed-in screen (one folder per module)
app/kiosk, queue-display   Full-screen lobby kiosk and waiting-room TV
app/api/            OAuth callback, cron, small JSON endpoints
components/         UI by module (inpatient, pharmacy, lab, meals, queue, kiosk, admin, shell, ui)
lib/                Business rules with no UI: permissions, navigation, audit, billing maths, dosing,
                    drug safety, lab flags, meal cut-offs, IST dates, identifiers, guards, auth
prisma/             schema.prisma and migrations (each migration also seeds its starter data)
proxy.js            Route protection and role home pages (Next.js middleware)
tests/              unit/, integration/, system/, helpers/
docs/presentation.html   Slide-style project overview
```

### Rules the code relies on

- **Every change is audited centrally.** A Prisma client extension (`lib/audit/extension.js`) writes an audit row for every create, update and delete, recording who did it, their role, the time, and the values before and after, with secrets redacted. No screen can skip it.
- **Numbers come from one sequence table:**

  | Number | Format |
  |---|---|
  | UHID | `SHDS-00000001` |
  | Admission | `IP-2026-000001` |
  | Receipt | `RCP-…` |
  | Bill | `BL-…` |
  | Claim | `CLM-…` |
  | Prescription | `RX-…` |
  | Lab order | `LAB-…` |
  | Sample | `S20261025-0001` |

- **Permissions live in one matrix** (`lib/permissions`). Page guards, action guards (`guardAction`), menus and the proxy all read the same table.
- **Every export of a `"use server"` file is a public endpoint.** Shared helpers therefore live in `lib/`, never in `actions/`.
- **Dates are in IST** (`lib/dates.js`). Appointment dates are stored at UTC midnight of the calendar date.
- **Starter data ships with the migrations:** 22 tariffs, a 20-medicine formulary, 12 lab tests and a 30-dish menu. They are samples for each hospital to review before go-live.

---

## 3. Roles and how people sign in

| Role | Home screen | Typical work |
|---|---|---|
| Super Admin | Dashboard | Everything, including registration codes and the activity log |
| Admin | Dashboard | Staff, departments, beds, tariffs, test catalogue, audit log |
| Receptionist | Dashboard | Registration, appointments, OPD queue, admissions, billing |
| Doctor | Dashboard | OPD queue, consultations, prescriptions, in-patients, orders, discharge |
| Nurse | Ward dashboard | Vitals, notes, medicines given, samples, meals, shift handover |
| Ward Attendant | Ward dashboard | Beds to clean and meal delivery |
| Insurance / TPA Desk | `/insurance` | Pre-authorisation, enhancements, final approval, claims |
| Pharmacist | `/pharmacy` | Prescription queue, ward indents, formulary and stock |
| Lab / Radiology Tech | `/lab` | Samples, results, second-person verification |
| Kitchen / Dietitian | `/kitchen` | Meal lists, preparation counts, menu |
| Kiosk (device) | `/kiosk` | Lobby self-service: register, check in, walk-in token |
| Patient | Dashboard | Own appointments, stays, prescriptions, lab reports, meals, bills |

- **Patients** sign up with their mobile number, or sign in with an OTP or Google.
- **Staff** sign up with a registration code issued by an admin. The code's prefix sets the role:

  | Prefix | Role |
  |---|---|
  | `ADM` | Admin |
  | `DOC` | Doctor |
  | `REC` | Receptionist |
  | `NUR` | Nurse |
  | `WAT` | Ward attendant |
  | `INS` | Insurance desk |
  | `PHA` | Pharmacist |
  | `LAB` | Lab technician |
  | `KIT` | Kitchen |
  | `KSK` | Kiosk |

- **Entry pages:** there is no landing page. `/` goes to sign-in, or to the user's own home screen if they are already signed in.

---

## 4. Modules

Status key: ✅ done · 🟡 partial · ⬜ not started

| # | Module | What it does | Status |
|---|---|---|---|
| M1 | Identity and access | Roles, registration codes, permission matrix, page and action guards, OTP, Google | ✅ |
| M2 | Audit trail | Every change and sign-in, including failed ones, with values before and after. The Activity Log screen has filters by record, action, date and person. | ✅ |
| M3 | Registration and UHID | A UHID valid across the whole chain, issued however the patient registers; search by UHID, phone or name; allergies recorded | ✅ (ABHA later) |
| M4 | Appointments and OPD | Booking with clash checks, check-in tokens, doctor queue (*Call next* / *Done*), waiting-room TV, consultations, e-prescriptions | ✅ |
| M5 | Beds | Bed board by ward with status and housekeeping. A bed is filled only by an admission and freed only by a discharge. | ✅ |
| M6 | Admission → discharge | Admission number, bed, department, attending doctor, reason; discharge with a plain-language summary, bed sent for cleaning, follow-up booked | ✅ |
| M7 | Nursing | Vitals with automatic alerts, nursing and round notes, SBAR handover per patient acknowledged by the next shift, printable ward handover sheet, medication chart | ✅ |
| M8 | Ward support | Bed cleaning and meal delivery | 🟡 (general task list later) |
| M9 | Lobby kiosk | OTP identity, self-registration, check-in, walk-in token, printed slip, English and Hindi, idle reset, Sign out | ✅ |
| M10 | Billing | Tariffs, a running in-patient bill (daily room charges plus auto-posted pharmacy, lab and meal extras), deposits, payments and refunds with receipts, final bill with GST and discount | ✅ |
| M11 | Lab and radiology | Orders from the chart or OPD, sample numbers, results flagged against ranges, second-person verification, critical alerts with acknowledgement, patient reports | ✅ |
| M12 | Pharmacy | Formulary with batch and expiry stock, allergy, interaction and duplicate warnings, OPD prescription → pickup with a UHID check, ward indents → bill | ✅ |
| M13 | Patient communication | Printable summary with one-tap WhatsApp and email links | 🟡 (automatic SMS/WhatsApp needs a provider) |
| M14 | Patient portal | Own appointments, stays, prescriptions with pickup status, lab reports, meals, bills | ✅ |
| M15 | Multi-branch chain | Branch master, staff and beds per branch, records shared across the chain | ⬜ |
| M16 | Rostering | Duty roster, assigning nurses to wards | ⬜ |
| M17 | Feedback and grievances | Complaints with SLA and multi-level escalation | ✅ |
| M18 | Compliance | ABDM/ABHA, NABH documents, DPDP consent and record-view logs | ⬜ |
| M19 | Analytics / MIS | Occupancy, ALOS, revenue, chain comparisons | ⬜ |
| M20 | Insurance / TPA desk | Payer at admission, pre-authorisation → enhancements → final approval, cashless discharge hold, claim, settlement with explained deductions | ✅ (recorded in the system, not yet sent through NHCX) |
| M21 | Diet and meals | Doctor's diet order, menu by diet, choice by the patient or nurse with cut-offs, kitchen lists and prep counts, delivery, extras billed, intake | ✅ |

---

## 5. Patient journey, A to Z

```
Arrive ─► Kiosk or front desk: registration, UHID ─► OPD token ─► Doctor calls next ─► Consultation
      ─► Prescription ─► Pharmacy prepares ─► UHID check ─► Collected
      ─► Tests ordered ─► Sample collected ─► Result ─► Second person verifies ─► Doctor / patient
      ─► Admission (bed, department, doctor, payer) ─► Insurance pre-authorisation
      ─► Ward: vitals ◄─► notes ◄─► medicines given ◄─► meals by diet ◄─► SBAR handover every shift
      ─► Running bill grows (room, pharmacy, lab, meal extras) ─► 80% of approval → enhancement
      ─► Final bill ─► Insurer final approval ─► Discharge summary on WhatsApp / email ─► Bed cleaned
      ─► Claim ─► Settlement ─► Follow-up visit with full history
```

**How the main handoffs work in the software**

- **Shift handover.** The outgoing nurse records Situation, Background, Assessment, Recommendation and pending tasks for each patient. The incoming nurse sees one card per patient with the latest vitals and alerts and acknowledges it; nobody can acknowledge their own handover. The ward sheet prints.
- **Prescription to pharmacy.** Saving an OPD prescription sends it to the pharmacy queue, with quantities worked out from frequency × duration (including the 1-0-1 style). The pharmacist prepares it, substituting with a reason if needed, and takes stock earliest-expiry first. The medicines are handed over only when the patient's UHID matches. The patient can follow the status: Sent → Being prepared → Ready → Collected.
- **Insurance.** An insured patient cannot be discharged until the insurer's final approval is recorded. The Discharge tab tells the doctor why.
- **Critical lab values.** These show as a banner on the chart and on the doctor's and nurse's dashboards until someone acknowledges them. The system records who acknowledged it and when.

---

## 6. The interface (Wayfinder)

There is no sidebar or top bar.

- **The dock.** Each role gets a small floating dock at the bottom of the screen. It holds the few places that role uses all day, plus **Find**, notifications and the person's profile, from which they sign out.
- **"Where to?".** Pressing **Find**, `Ctrl/⌘ K` or `/` opens a full-screen "Where to?" panel. It lists quick actions (e.g. *Admit a patient*), every place the role can open, and live search across patients (name, UHID, phone), in-patient stays (IP number) and doctors. Recent places are remembered on the device.
- **Readability.** Pages use a 16 px base, calm solid colours, light and dark themes, and Devanagari support. Loading shows a thin progress line with a faint outline of the page, not a spinner, and motion is reduced when the device asks for it.
- **Phones and print.** Every screen was checked at 390 px width with no sideways scrolling. Charts, bills and summaries print cleanly.

---

## 7. Phases and status

| Phase | Theme | Status |
|---|---|---|
| 0 | Stabilise: bug fixes, security, test harness | ✅ |
| 1 | In-patient core: nurse and ward roles, audit trail, UHID, admission → vitals and notes → SBAR handover → discharge | ✅ |
| 2 | Front office: new sign-in, no landing page, kiosk, OPD token queue, waiting-room display, global search | ✅ |
| 3 | Revenue and insurance: tariffs, running bill, receipts, final bill, insurance/TPA desk | ✅ |
| 4a | Medicines: formulary and stock, prescribing safety, prescription → pharmacy → pickup, ward orders, medication chart | ✅ |
| 4b | Lab and radiology | ✅ |
| 4c | Diet and meals | ✅ |
| — | Wayfinder interface redesign | ✅ |
| 4d | Operation theatre: OT schedule, pre-op checklist, WHO safety checklist, anaesthesia notes, implants | ⬜ |
| 4e | AI consultation notes and AI-drafted handover | ⬜ (needs a speech-to-text and LLM provider) |
| 4f | Emergency and ICU: triage, MLC, ICU flowsheet | ⬜ |
| 5 | Operations and chain: branches, roster, bed transfer, ward tasks, purchase orders | ⬜ |
| 6 | Patient engagement: automatic WhatsApp/SMS, regional languages, reminders, family access | ⬜ |
| 7 | Compliance and insight: ABDM/ABHA, NABH, DPDP, MIS, AI assistance | ⬜ |

**Needs something outside the code** (a contract, a device or a hospital decision):

- SMS/WhatsApp gateway with DLT templates (MSG91, Gupshup, …);
- payment gateway (Razorpay, …);
- NHCX or TPA portal access;
- lab analyser interfacing (HL7/ASTM);
- PACS;
- barcode printers;
- ABDM sandbox registration;
- the hospital's own tariffs, formulary, reference ranges and menu.

---

## 8. What still needs fixing

P1 = fix before go-live · P2 = soon · P3 = tidy-up

| # | Pri | Issue | Suggested fix |
|---|---|---|---|
| 1 | P1 | `lib/auth/jwt.js` falls back to a built-in secret when `JWT_SECRET` is missing | Refuse to start in production without it |
| 2 | P1 | OTP codes are generated but never sent by SMS | Connect an SMS provider with a DLT template |
| 3 | P1 | Doctors can edit other doctors' records and prescriptions | Limit edits to the author or the attending doctor, with an audited override |
| 4 | P1 | `npm audit` reports dependency issues | Review and upgrade |
| 5 | P2 | Audit rows are written outside the business transaction | Write them inside the same transaction |
| 6 | P2 | Viewing a record is not logged (DPDP/NABH requirement) | Add read logging for patient records |
| 7 | P2 | The admit form loads at most 500 patients | Server-side search |
| 8 | P2 | Nurses see every ward | Assign nurses to wards (comes with rostering) |
| 9 | P2 | Follow-up booking ignores doctors' working hours | Check the schedule |
| 10 | P3 | Some older pages are restyled centrally rather than rebuilt | Rework as each module grows |
| 11 | P3 | Some lint errors pre-date this work (`setState` in effects) | Clean up |
| 12 | P3 | Notification "read" state is stored per browser | Store it on the server |
| 13 | P3 | The UHID back-fill used the fixed prefix `SHDS-` | Re-number before go-live if the chain uses another prefix |

---

## 9. Testing

| Level | What it proves | Where | Count |
|---|---|---|---|
| Unit | Pure rules: permissions, menus and dock, proxy routing, vitals alerts, dosing, drug safety, stock allocation, bill maths, lab flags, meal cut-offs, IST dates, identifiers, audit redaction, password strength | `tests/unit/` | 175 |
| Integration | Real server actions against a real Postgres test database, covering every module above | `tests/integration/` | 152 |
| System | The running app in Chrome: admission → nursing → handover → discharge → audit, for every role | `tests/system/phase1-walkthrough.mjs` | 26 checks |
| UAT | A hospital user follows the scripts in section 11 | — | 17 scripts |
| Regression | Everything above on every change; a red test means no merge | — | `npm test && npm run test:system` |

All features were built test-first: a failing test was written, then the code that makes it pass. The integration database is wiped before every test and must have `_test` in its name.

```bash
createdb smart_hospital_test
npm run test:db:prepare
npm test                         # 327 / 327 passing
npm run dev & npm run test:system
```

**Results, 25 Oct 2026:**

- All 327 automated tests pass.
- The 26-check system walk-through passes.
- Browser UAT walk-throughs pass for each phase:

  | Phase | Checks passed |
  |---|---|
  | 2 | 20 |
  | 3 | 23 |
  | 4a | 20 |
  | 4b | 19 |
  | 4c | 19 |

- A 390 px phone sweep of every screen found no sideways scrolling and no console errors.
- The production build succeeds.

---

## 10. Demo accounts

The local demo database uses the password `Test@1234` for every account except the super admin.

| Role | Email | Notes |
|---|---|---|
| Super admin | admin@shds.com / `Admin@123` | Sees everything |
| Admin | admin@test.com | |
| Receptionist | reception@test.com | |
| Doctor | doctor@test.com | Dr. Rahul Mehta, Cardiology |
| Doctor | doctor2@test.com | Dr. Sneha Iyer, General Medicine |
| Nurse | nurse@test.com, nurse2@test.com | Anita Das (day), Rekha Paul (night) |
| Ward attendant | ward@test.com | Ramesh Yadav |
| Insurance desk | tpa@test.com | Farah Khan |
| Pharmacist | pharmacy@test.com | Ravi Menon |
| Lab technicians | lab@test.com, lab2@test.com | Two people, so each can verify the other's results |
| Kitchen | kitchen@test.com | Meena Iyer |
| Kiosk | kiosk@test.com | Opens on the lobby kiosk |
| Patient | patient@test.com | Amit Kumar, admitted in CCU-01, penicillin allergy, diabetic diet |

---

## 11. UAT scripts

Mark each step ✅ or ❌. Note anything confusing, because confusion counts as a defect.

1. **Receptionist admits a patient.** Bed board → green bed → *Admit a patient to this bed* → search the patient → pick the department and doctor → reason → *Admit*. ✅ The chart shows the UHID, IP number and bed, and the bed turns red. Admitting the same patient again is refused.
2. **Nurse charting.** Enter vitals T 101.6, P 112. ✅ *Fever* and *Tachycardia* alerts appear. SpO₂ 140 is refused. Add a nursing note, then record an SBAR handover.
3. **Incoming nurse.** nurse2 → *Shift Handover* → one card per patient → *Acknowledge*. ✅ The card shows "Received by Rekha Paul" and the time. The author cannot acknowledge their own handover.
4. **Doctor rounds and discharge.** Add a round note → discharge with diagnosis, medicines, advice and follow-up. ✅ The bed goes to *Needs cleaning*, the follow-up is booked, and the summary offers WhatsApp, Email and Print.
5. **Ward attendant.** Mark a cleaned bed *Vacant*. ✅ Allowed. An occupied bed cannot be released.
6. **Patient.** *Hospital Stays*. ✅ Only their own stay appears; staff notes and handovers are hidden.
7. **Administrator.** *Activity Log*. ✅ Every change and sign-in, with before → after values; filters work.
8. **Kiosk.** Mobile number → OTP → returning patient → *Check in* → token. Then a new number → registration → walk-in token. ✅ After a minute idle the kiosk returns to Welcome, and *Sign out* leaves kiosk mode.
9. **OPD queue.** Doctor *Call next* → *Done*. ✅ The TV display shows only first name and last initial.
10. **Find.** Press `Ctrl/⌘ K` and type a name, UHID, phone or IP number. ✅ Results are limited to the role and Enter opens one.
11. **Billing.** Insured admission → room charge added automatically → add CBC and saline → ₹2,000 UPI deposit. ✅ A receipt number is issued. A cancelled line stays visible with the reason.
12. **Insurance desk.** Pre-auth → approval. Charges reach 80% of the approved amount. ✅ A warning appears. The doctor's discharge is refused until final approval. Final bill → final approval → discharge → claim → settle with a deduction reason and UTR.
13. **Tariffs.** Edit a price. ✅ New charges use the new price and old bills stay unchanged.
14. **Prescription → pickup.** Prescribe Mox 500 to a penicillin-allergic patient. ✅ An allergy warning appears. Pharmacist → prepare → ready → a wrong UHID is refused → hand over. ✅ The patient sees *Collected*.
15. **Ward medicines.** Order Dolo 650 BD. Nurse marks a dose *Given* and another *Not given* with a reason. Pharmacist → *Issue to ward*. ✅ The medicines appear on the bill.
16. **Lab.** Urgent CBC and X-ray → nurse collects (✅ sample number issued) → lab enters Hb 6.4 (✅ marked CRITICAL; the technician cannot verify their own result) → lab2 verifies → doctor sees the banner and acknowledges → patient sees the report.
17. **Meals.** Doctor sets a Diabetic diet. Patient → *My Meals* (✅ only diabetic dishes). Nurse adds an extra. Kitchen list and prep count are correct. Attendant marks it *Delivered* (✅ the extra is billed). Nurse records *Ate half*. Doctor sets Nil by mouth. ✅ The kitchen shows *Do not serve*.

---

## 12. Deployment

1. Set `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NEXT_PUBLIC_HOSPITAL_NAME` and `UHID_PREFIX` on the host (for example Vercel or a VM with Node).
2. Run `npx prisma migrate deploy`.
3. Review the starter tariffs, formulary, lab reference ranges and menu. Then receive opening stock for every medicine.
4. Create the first admin and issue registration codes to staff.
5. For each lobby kiosk, issue a *Self-service Kiosk* code and sign the device up once. Then set its browser to open `/kiosk` full-screen.
6. Open `/queue-display` on the waiting-room TV from a front-desk account.
7. Run `npm test` and `npm run test:system` against staging before go-live.

---

## 13. Developer conventions

- **Adding a feature:**
  1. Write a failing test in `tests/unit` or `tests/integration`.
  2. Change `prisma/schema.prisma` and add a migration (`npm run db:migrate`).
  3. Put the rules in `lib/`.
  4. Add the server action in `actions/`, wrapped in `guardAction(resource, operation)`.
  5. Build the page in `app/(dashboard)/`.
  6. Add the permission to `lib/permissions` and the place to `lib/navigation`.
- **Server actions** return `{ success, message, data }` and call `revalidatePath` after writes.
- **Never add a non-action helper to an `actions/` file.** Put it in `lib/`.
- **Client components** cannot export helpers for server components to use. Shared formatting lives in `lib/format.js`.
- **Every date the user sees** goes through `lib/dates.js` (IST).
- **Every new table** is audited automatically. Add it to `TABLES` in `tests/helpers/db.js` so tests truncate it.

---

## 14. Future scope, including AI

All of these build on data the system already records: vitals, notes, orders, bills and the audit trail.

| Idea | What it does | Data it uses |
|---|---|---|
| Ambient AI scribe | Listens to the consultation (with consent) and drafts the history, examination, diagnosis and prescription for the doctor to approve | Speech-to-text and an LLM; Hindi and regional languages |
| AI shift handover | Drafts each patient's SBAR from the last shift's vitals, notes, medicines and results; the nurse edits and signs | Charts, MAR, lab |
| Discharge summary drafting | Writes the summary, plus a plain-language version in the patient's language | The whole stay |
| Early-warning score | NEWS2 now, then a learned model that flags deterioration hours earlier | Vitals and lab trends |
| Clinical decision support | Dose checks by weight and kidney function, wider interaction checks, antibiotic stewardship | Formulary, lab |
| Coding assistant | Suggests ICD-10 and procedure codes for bills and claims | Diagnoses, notes |
| Claim-denial prediction | Flags missing documents and likely deductions before submission; auto-builds NHCX bundles | Claims history |
| Bed and staff forecasting | Predicts admissions and discharges by ward and day, and suggests roster levels | ADT history |
| Pharmacy forecasting | Reorder points, expiry risk, purchase suggestions | Dispensing and stock |
| Smart triage and symptom chat | WhatsApp or kiosk chat that suggests the department and books a token | OPD data |
| Patient companion | Explains reports, medicine times and diet in simple Hindi, Bengali or Tamil; sends reminders | Records, meals |
| Lab intelligence | Delta checks and auto-verification of normal results under rules | Lab results |
| Radiology AI | Second reader for chest X-ray and CT once PACS is connected | Images |
| Revenue and quality MIS | ALOS, readmissions, infection rates, revenue leakage, branch comparisons | Every module |

---

Developed as part of the **Xeta Labs Internship Program**. All rights reserved.
