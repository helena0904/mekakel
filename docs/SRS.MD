# MEKAKEL — Software Requirements Specification (SRS)

| Field | Value |
| --- | --- |
| Document | Software Requirements Specification |
| Project | MEKAKEL — Blood Coordination Platform |
| Version | 1.1 |
| Status | Living document |
| Repository | `helena0904/mekakel` |
| Author | Helen Tesfaye |
| Last updated | October 24, 2026 |

## Revision history

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | — | First version |
| 1.1 | 2026-10-24 | Added priorities, business rules with values, permission matrix, status lifecycles, measurable quality targets, notification list, upload limits, traceability and references |

Priority key used in the requirement tables: **M** = Must have, **S** = Should have, **C** = Could have.
Items marked **†** were not found in the code reviewed on October 23, 2026 (see Section 11). Confirm them against the current repository before submission.

## 1. Introduction

### 1.1 Purpose

This document defines the functional and non-functional requirements for MEKAKEL, a web-based platform that helps healthcare facilities coordinate blood resources and verified volunteer donors. It describes what the system must do, who uses it, and the constraints under which it operates.

### 1.2 Scope

MEKAKEL provides:

- Account registration and authentication for individuals, hospitals, doctors, and administrators.
- Donor profiles, donation availability, eligibility checks, and medical report verification.
- Hospital profiles, staff management, and hospital approval workflows.
- Blood inventory management with screening, confirmation, expiry handling, and stock summaries.
- Blood requests, donor/unit matching, reservations, and hospital-to-hospital transfers.
- Email and in-app notifications.
- Administrative oversight, audit logging, and system settings.

MEKAKEL is a coordination platform. It does not physically test, collect, or transfuse blood, and it does not replace clinical judgment, cross-matching, or regulatory procedures. It records the blood units a hospital reports and tracks their status.

### 1.3 Intended Audience

- Project supervisors and evaluators
- Developers and maintainers
- Hospital staff, donors, doctors, and administrators using the system
- Testers and quality reviewers

### 1.4 Definitions

| Term | Meaning |
| --- | --- |
| Donor | An individual who registers to donate blood |
| Hospital | A healthcare facility that manages inventory and creates blood requests |
| Doctor | An authorized clinical reviewer who verifies donor medical reports |
| Admin | A platform administrator who manages users, hospitals, and settings |
| Blood unit | A specific bag of blood with type, component, dates, and status |
| Component | Whole blood, red cells, plasma, platelets, or cryoprecipitate |
| FEFO | First Expired, First Out inventory prioritization |
| Reservation | A temporary hold on a blood unit or a donor |
| Transfer | Movement of a blood unit between hospitals |
| Fayda | Ethiopian national digital identity (simulated in this project) |
| ABO/Rh | Blood group and Rh factor compatibility rules |
| JWT | JSON Web Token used as the session credential |
| SPA | Single-page application |

### 1.5 References

- `backend/prisma/schema.prisma` — data model
- MEKAKEL Database Design, System Architecture and UI Design documents
- IEEE Std 830 / ISO/IEC/IEEE 29148 — structure guidance for requirement specifications

## 2. Overall Description

### 2.1 Product Perspective

MEKAKEL is a full-stack web application:

- React + TypeScript single-page frontend.
- Node.js + Express + TypeScript REST API.
- PostgreSQL database accessed through Prisma.
- Email delivery through SMTP.

The system is a standalone product, not dependent on an existing hospital information system, although future integrations are possible.

### 2.2 Product Functions

1. Authentication and account management.
2. Donor registration, profile, availability, eligibility, and reports.
3. Hospital registration, approval, staff, and profile management.
4. Doctor registration and medical report verification.
5. Blood inventory management.
6. Blood request creation and lifecycle management.
7. Matching of compatible units and donors.
8. Reservations with expiry handling.
9. Hospital-to-hospital transfers.
10. Notifications (email and in-app).
11. Audit logging and administrative settings.
12. Dashboard views per role.

### 2.3 User Classes

| Actor | Description | Main capabilities |
| --- | --- | --- |
| Visitor | Unauthenticated user | View home page, register, log in, reset password |
| Donor | Individual account | Manage profile, availability, reports, history, respond to requests |
| Hospital staff | Account linked to a hospital | Manage profile, inventory, requests, matches, reservations, transfers, staff |
| Doctor | Authorized clinical reviewer | Review and approve/reject donor medical reports |
| Admin | Platform administrator | Approve hospitals, manage users, view audit logs, update settings |

### 2.4 Operating Environment

- Modern desktop and mobile browsers with JavaScript enabled.
- Node.js runtime for the backend.
- PostgreSQL database.
- Docker and Docker Compose supported for local and deployment environments. †
- SMTP server for outbound email.

### 2.5 Design Constraints

- The backend exposes a REST API under `/api`.
- Authentication uses JWT bearer tokens.
- Data access is mediated by Prisma.
- Medical reports are stored as private uploads outside public static hosting.
- Blood compatibility logic is advisory and must not be treated as clinical approval.
- Fayda identity verification is a controlled simulation in the current version.

## 3. Actors and Roles

| Role | Account type | Access scope |
| --- | --- | --- |
| `USER` | Individual | Limited default access before role assignment |
| `DONOR` | Individual | Donor dashboard and donor features |
| `HOSPITAL_STAFF` | Hospital | Hospital dashboard and hospital features |
| `DOCTOR` | Individual | Doctor dashboard and verification queue |
| `ADMIN` | Any | Administrative dashboard, user and hospital management |

Hospital staff also carry a staff role: `OWNER`, `ADMIN`, `MANAGER`, `TECHNICIAN`, or `VIEWER`. The staff role controls hospital-level permissions.

### 3.1 Permission matrix

Y = allowed, O = own data only, — = not allowed. Hospital columns apply to approved, active staff of the same hospital.

| Capability | Visitor | Donor | Doctor | Hospital Viewer | Hospital Technician / Manager | Hospital Owner / Admin | Platform Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Register, log in, reset password | Y | Y | Y | Y | Y | Y | Y |
| Manage own donor profile, availability, reports | — | O | — | — | — | — | — |
| Decide donor verification | — | — | Y | — | — | — | — |
| View inventory and requests | — | — | — | O | O | O | — |
| Create or edit units, requests, reservations | — | — | — | — | O | O | — |
| Request, approve, dispatch, receive transfers | — | — | — | — | O | O | — |
| Manage hospital staff | — | — | — | — | — | O | — |
| Approve hospitals, manage users, edit settings | — | — | — | — | — | — | Y |
| View audit log | — | — | — | — | — | — | Y |
| View notifications and preferences | — | O | O | O | O | O | O |

## 4. Functional Requirements

### 4.1 Authentication and Accounts

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-AUTH-01 | The system shall allow an individual to register as a donor. | M |
| FR-AUTH-02 | The system shall allow a hospital representative to register a hospital account. | M |
| FR-AUTH-03 | The system shall allow a doctor to register with license, specialization, institution, and phone details. | M |
| FR-AUTH-04 | The system shall validate registration input using schema validation (name of at least 2 characters, valid unique email, password of at least 8 characters). | M |
| FR-AUTH-05 | The system shall hash passwords and never store plaintext passwords. | M |
| FR-AUTH-06 | The system shall authenticate users with email and password and return a JWT. | M |
| FR-AUTH-07 | The system shall reject invalid, expired, or revoked tokens. | M |
| FR-AUTH-08 | The system shall allow a user to request a password reset by email. | M |
| FR-AUTH-09 | The system shall allow a user to reset a password using a valid, unexpired, single-use token. | M |
| FR-AUTH-10 | The system shall increment the password version on reset so existing sessions are invalidated. | M |
| FR-AUTH-11 | The system shall rate-limit login, registration, and reset attempts. | M |
| FR-AUTH-12 | The system shall enforce role- and account-type-based route protection in the frontend and backend. | M |
| FR-AUTH-13 | The system shall revoke the current token on logout so it cannot be reused. | M |
| FR-AUTH-14 | The system shall show a medical warning page and require acceptance before registration. | S |

### 4.2 Donor Management

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-DONOR-01 | The system shall maintain a donor profile including blood type, age, weight, height, phone, address, subcity, and wereda. | M |
| FR-DONOR-02 | The system shall support a unique 16-digit Fayda ID and consent preferences. | M |
| FR-DONOR-03 | The system shall verify donor identity through a simulated Fayda check. | S |
| FR-DONOR-04 | The system shall track donor verification status: pending, verified, rejected, or additional information required. | M |
| FR-DONOR-05 | The system shall let donors define weekly availability with a time for each day (one slot per weekday). | M |
| FR-DONOR-06 | The system shall compute donor eligibility from age, weight, last donation, interval, and medical verification, using the rules in Section 6. | M |
| FR-DONOR-07 | The system shall allow donors to upload medical reports as JPG, PNG, WEBP, or PDF files of at most 5 MB. | M |
| FR-DONOR-08 | The system shall keep medical reports private and require authorization to access them. | M |
| FR-DONOR-09 | The system shall maintain donation history. | S |
| FR-DONOR-10 | The system shall allow donors to opt out of matching and control contact and location sharing. | M |
| FR-DONOR-11 | The system shall restrict a doctor to viewing and deciding only donors explicitly assigned to that doctor by an administrator. † | S |

### 4.3 Hospital Management

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-HOSP-01 | The system shall maintain a hospital profile with name, address, phone, subcity, and wereda. | M |
| FR-HOSP-02 | The system shall assign hospital status: pending, approved, rejected, or suspended. | M |
| FR-HOSP-03 | The system shall allow admins to review and decide on hospital registration with review notes. | M |
| FR-HOSP-04 | The system shall allow approved hospitals to manage staff members. | M |
| FR-HOSP-05 | The system shall enforce hospital staff roles and active status. | M |
| FR-HOSP-06 | The system shall support hospital search for nearby donors and hospitals. | S |
| FR-HOSP-07 | The system shall return donor details with privacy-aware contact and location rules. | M |
| FR-HOSP-08 | The system shall expose donor medical reports to an approved hospital only when that hospital holds a confirmed, unexpired reservation that the donor accepted. † | S |

### 4.4 Blood Inventory

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-INV-01 | The system shall create blood units with bag ID, blood type, component, collection date, expiry date, and storage details. | M |
| FR-INV-02 | The system shall prevent duplicate bag IDs within a hospital. | M |
| FR-INV-03 | The system shall track screening status: not tested, pending, passed, or failed. | M |
| FR-INV-04 | The system shall track confirmation status and blood type confirmation. | M |
| FR-INV-05 | The system shall track unit status: pending, available, reserved, transferred, used, expired, or discarded, following the lifecycle in Section 7. | M |
| FR-INV-06 | The system shall list inventory with filtering and stock summaries by blood type and component. | M |
| FR-INV-07 | The system shall provide expiry alerts for units nearing expiry. | S |
| FR-INV-08 | The system shall automatically expire overdue units. | M |
| FR-INV-09 | The system shall record inventory changes in the audit log. | M |

### 4.5 Blood Requests

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-REQ-01 | The system shall allow an approved hospital to create a blood request. | M |
| FR-REQ-02 | A request shall include component, blood type, required units, urgency (routine, urgent, emergency), location, and optional notes. | M |
| FR-REQ-03 | The system shall list requests for the requesting hospital. | M |
| FR-REQ-04 | The system shall allow a hospital to view request details. | M |
| FR-REQ-05 | The system shall allow the hospital to update or cancel an open request. | M |
| FR-REQ-06 | The system shall track request status: open, fulfilled, or cancelled. | M |

### 4.6 Matching

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-MATCH-01 | The system shall match compatible blood units and donors to a request. | M |
| FR-MATCH-02 | Compatibility shall account for ABO/Rh direction and blood component, using the administrator-configurable rules in Section 6. | M |
| FR-MATCH-03 | The system shall rank eligible units using FEFO: earliest expiry, then earliest collection, then nearest location, then bag ID. | M |
| FR-MATCH-04 | The system shall rank donors using eligibility, availability, proximity, and time since last donation, and show the reasons for each score. | S |
| FR-MATCH-05 | The system shall report compatible counts, required units, and shortfall. | M |
| FR-MATCH-06 | The system shall provide a human-readable compatibility explanation. | S |
| FR-MATCH-07 | The system shall not expose donor contact details unless consent rules allow it, and shall exclude donors who opted out, are inactive, or are not eligible. | M |
| FR-MATCH-08 | The system shall only match units that passed screening, are blood-type confirmed, are available, and are not expired. | M |

### 4.7 Reservations

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-RES-01 | The system shall allow a hospital to reserve a compatible blood unit or request a donor response. | M |
| FR-RES-02 | Reservations shall have an expiry time. | M |
| FR-RES-03 | The system shall track reservation status: active, confirmed, cancelled, expired, released, or consumed. | M |
| FR-RES-04 | The system shall track donor response: pending, accepted, declined, or no-show. | M |
| FR-RES-05 | The system shall prevent double-booking of the same unit. | M |
| FR-RES-06 | The system shall expire overdue reservations automatically, checking at least once every 60 seconds. | M |
| FR-RES-07 | The system shall release reserved units when a reservation is cancelled or expired. | M |
| FR-RES-08 | The system shall record reservation transitions in the audit log and notify relevant users. | M |
| FR-RES-09 | Only the authenticated donor assigned to a reservation may accept or decline it; hospitals and other donors shall not record donor responses. † | S |

### 4.8 Transfers

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-TRANS-01 | The system shall allow a hospital to request transfer of an available blood unit from another hospital. | M |
| FR-TRANS-02 | Transfers shall track status: requested, approved, dispatched, received, completed, rejected, or cancelled. | M |
| FR-TRANS-03 | The system shall record transfer events with status changes, notes, and actor. | M |
| FR-TRANS-04 | The system shall enforce valid status transitions as defined in Section 7. | M |
| FR-TRANS-05 | The system shall notify both hospitals at each transfer step. | M |
| FR-TRANS-06 | The system shall update inventory ownership and status when a transfer completes. | M |

### 4.9 Notifications

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-NOT-01 | The system shall create notifications for donor, hospital, reservation, and transfer events (22 notification types, listed in Section 8). | M |
| FR-NOT-02 | The system shall send email notifications through SMTP. | M |
| FR-NOT-03 | The system shall retry failed notifications up to 3 attempts and record the last error. | M |
| FR-NOT-04 | The system shall avoid duplicate notifications using deduplication keys. | S |
| FR-NOT-05 | The system shall let users view in-app notifications and mark them as read. | M |
| FR-NOT-06 | The system shall let users configure notification preferences (email on or off, and per category). | S |

### 4.10 Administration and Audit

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-ADM-01 | The system shall let admins list and search users. | M |
| FR-ADM-02 | The system shall let admins change user roles and active status. | M |
| FR-ADM-03 | The system shall let admins approve, reject, or suspend hospitals. | M |
| FR-ADM-04 | The system shall record audit events for sensitive actions, including every medical report access. | M |
| FR-ADM-05 | The system shall let admins view audit logs with filters (action, actor, entity, date). | M |
| FR-ADM-06 | The system shall let admins view and update system settings (eligibility and compatibility rules). | M |
| FR-ADM-07 | The system shall prevent unauthorized users from accessing admin functions. | M |
| FR-ADM-08 | The system shall let admins assign or reassign a donor review to an active doctor and record the assignment in the audit log. † | S |

## 5. Non-Functional Requirements

Targets below are proposed acceptance values and should be confirmed by testing.

### 5.1 Security

| ID | Requirement |
| --- | --- |
| NFR-SEC-01 | Passwords shall be hashed with bcrypt. |
| NFR-SEC-02 | JWTs shall be signed with a secret from the environment and validated on every protected request. |
| NFR-SEC-03 | Password reset tokens shall be stored hashed and expire. |
| NFR-SEC-04 | Authorization shall be enforced server-side for every protected endpoint. |
| NFR-SEC-05 | CORS shall allow only configured origins. |
| NFR-SEC-06 | Login and sensitive endpoints shall be rate-limited. |
| NFR-SEC-07 | Medical reports and private uploads shall not be publicly accessible and shall be saved under random file names. |
| NFR-SEC-08 | Sensitive actions shall be written to an append-only audit log. |
| NFR-SEC-09 | Request bodies shall be limited to 1 MB (uploads to 5 MB). |

### 5.2 Performance

| ID | Requirement |
| --- | --- |
| NFR-PERF-01 | 95% of API requests should respond within 2 seconds with 50 concurrent users. |
| NFR-PERF-02 | Matching should return results within 3 seconds for an inventory of 10,000 units. |
| NFR-PERF-03 | Database indexes shall support frequent queries (status, blood type, expiry, ownership). |

### 5.3 Reliability and Availability

| ID | Requirement |
| --- | --- |
| NFR-REL-01 | Failed background jobs shall log errors without crashing the server. |
| NFR-REL-02 | Notification failures shall be retried up to 3 times. |
| NFR-REL-03 | The database shall be the source of truth for inventory and reservation state. |
| NFR-REL-04 | Docker Compose shall support reproducible local startup. † |
| NFR-REL-05 | Target availability is 99% during operating hours. |

### 5.4 Usability

| ID | Requirement |
| --- | --- |
| NFR-USE-01 | The interface shall be responsive from 360 px wide phones to desktop. |
| NFR-USE-02 | Forms shall show clear validation and error messages next to the field. |
| NFR-USE-03 | Destructive actions shall require confirmation. |
| NFR-USE-04 | The interface shall use consistent colors, typography, and spacing as defined in the UI Design document. |
| NFR-USE-05 | Text contrast shall be at least 4.5:1 and all forms shall be keyboard accessible. |

### 5.5 Maintainability

| ID | Requirement |
| --- | --- |
| NFR-MNT-01 | Backend code shall be separated into routes, controllers, services, validators, and middleware. |
| NFR-MNT-02 | Frontend code shall separate pages, components, services, context, and utilities. |
| NFR-MNT-03 | TypeScript shall be used across frontend and backend. |
| NFR-MNT-04 | Database changes shall be managed through Prisma migrations. |
| NFR-MNT-05 | Core business rules shall have automated tests (Jest and Supertest for the API, Playwright for end-to-end flows). |

### 5.6 Privacy and Compliance

| ID | Requirement |
| --- | --- |
| NFR-PRIV-01 | Donor contact details shall be visible only when consent and role rules allow. |
| NFR-PRIV-02 | Medical information shall be accessible only to authorized users. |
| NFR-PRIV-03 | Access to medical reports shall be authorized by role, hospital-donor relationship, or doctor assignment, and shall be audited. |
| NFR-PRIV-04 | The system shall state that compatibility results are advisory and not a clinical decision. |

## 6. Business Rules

| ID | Rule |
| --- | --- |
| BR-01 | A donor is eligible only if verified and active, at least 18 years old, weighs at least 50 kg, and has waited at least 90 days since the last donation. These values are defaults that an administrator can change in system settings. |
| BR-02 | Only units that passed screening, are blood-type confirmed, and are not expired can be matched, reserved, or transferred. |
| BR-03 | Expired units can never be issued; FEFO decides the issue order. |
| BR-04 | A hospital must be approved to create requests, manage inventory, or transfer units. |
| BR-05 | A unit has at most one active reservation at a time. |
| BR-06 | A Fayda ID belongs to one donor only. |
| BR-07 | A bag ID is unique within one hospital. |
| BR-08 | Deactivated users and suspended hospitals lose access immediately. |
| BR-09 | Compatibility enforces ABO and Rh rules by default; Rh enforcement and plasma compatibility direction are administrator settings. |
| BR-10 | Emergency requests are shown before urgent and routine requests. |

## 7. Status Lifecycles

| Entity | Allowed flow |
| --- | --- |
| Blood unit | Pending → Available → Reserved → Transferred → Used; or Expired or Discarded |
| Reservation | Active → Confirmed → Consumed; or Cancelled, Expired, or Released |
| Transfer | Requested → Approved → Dispatched → Received → Completed; or Rejected or Cancelled before completion |
| Donor verification | Pending → Verified; or Rejected or Additional information required |
| Hospital | Pending → Approved; or Rejected or Suspended |
| Blood request | Open → Fulfilled; or Cancelled |
| Notification | Pending → Sent; or Failed or Suppressed |

## 8. Notification Types

| Category | Types |
| --- | --- |
| Donor | Registered, verification approved, verification rejected, additional information required, blood requested |
| Hospital | Registered, approved, rejected, suspended, activated |
| Reservation | Confirmed, cancelled, released, expired, consumed |
| Transfer | Requested, approved, rejected, dispatched, received, completed, cancelled |

## 9. Data Requirements

Core entities include:

- `User`, `PasswordResetToken`, `RevokedToken`, `RateLimitCounter`
- `DonorProfile`, `DonorAvailabilitySchedule`, `MedicalReport`, `DonationRecord`
- `HospitalProfile`, `HospitalStaffMember`, `DoctorProfile`, `DoctorReviewAssignment` †
- `BloodUnit`, `BloodRequest`, `Reservation`, `Transfer`, `TransferEvent`
- `Notification`, `NotificationPreference`
- `AuditLog`, `SystemSetting`

Key relationships:

- A user has at most one donor, hospital, or doctor profile.
- A hospital has many staff members, blood units, requests, reservations, and transfers.
- A reservation references either a blood unit or a donor.
- A donor has at most one active doctor review assignment. †
- A transfer moves one blood unit between two hospitals.
- Notifications reference users; audit logs keep actor ids without foreign keys so history survives user deletion.

## 10. External Interfaces

| Interface | Description |
| --- | --- |
| Web UI | React SPA served on port 5173 in development |
| REST API | Express API under `/api`, default port 3000 |
| Database | PostgreSQL through Prisma |
| Email | SMTP via nodemailer |
| Fayda | Simulated identity verification service |
| Docker | Compose-managed Postgres, backend, and frontend services † |

## 11. Assumptions, Dependencies and Items to Confirm

- Users have valid email addresses and internet access.
- Hospitals and doctors are approved before performing privileged actions.
- A real Fayda integration will replace the current simulation in production.
- SMTP credentials are provided through environment variables.
- Clinical staff perform final cross-matching and compatibility checks.
- Docker is optional for development but recommended for reproducible environments.

**Items marked † to confirm.** The code reviewed on October 23, 2026 had no doctor-assignment model, no donor-only reservation response rule, no hospital access to donor reports through a reservation, and no Docker Compose file. If these exist in your current repository, remove the † marks; if they are planned, change them to "Planned" in the Status column or move them to a "Future work" list.

## 12. Out of Scope

- Real Fayda registry integration.
- Real payment processing.
- Blood testing, collection, or transfusion workflows.
- Mobile native applications.
- SMS notifications.
- Cross-border or multi-tenant deployment.
- Automated clinical decision-making.

## 13. Acceptance Criteria and Traceability

The system is acceptable when the following hold. Each criterion lists the requirements it covers and how it is verified (T = automated test, D = demonstration).

| # | Criterion | Requirements | Verify |
| --- | --- | --- | --- |
| 1 | A visitor can register and log in as a donor, hospital, or doctor. | FR-AUTH-01 to 07 | T, D |
| 2 | A donor can complete a profile, set availability, and upload a medical report. | FR-DONOR-01 to 08 | T, D |
| 3 | A doctor can review and decide on a donor report. | FR-DONOR-04, FR-ADM-04 | T, D |
| 4 | An admin can approve a hospital and manage users. | FR-HOSP-02, 03, FR-ADM-01 to 03 | T, D |
| 5 | A hospital can add inventory and create a blood request. | FR-INV-01 to 06, FR-REQ-01 to 06 | T, D |
| 6 | Matching returns compatible units and donors with FEFO ranking. | FR-MATCH-01 to 08 | T |
| 7 | A reservation can be created, confirmed, cancelled, and expired automatically. | FR-RES-01 to 08 | T |
| 8 | A transfer moves through requested, approved, dispatched, received, and completed. | FR-TRANS-01 to 06 | T, D |
| 9 | Notifications are created and emailed according to preferences. | FR-NOT-01 to 06 | T |
| 10 | Sensitive actions appear in the audit log. | FR-ADM-04, 05 | T |
| 11 | Unauthorized users cannot reach protected functions or private files. | FR-AUTH-12, NFR-SEC-04, 07 | T |
