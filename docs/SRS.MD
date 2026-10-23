# MEKAKEL — Software Requirements Specification (SRS)

| Field | Value |
| --- | --- |
| Document | Software Requirements Specification |
| Project | MEKAKEL — Blood Coordination Platform |
| Version | 1.0 |
| Status | Living document |
| Repository | `helena0904/mekakel` |

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

MEKAKEL is a coordination platform. It does not test, collect, store, or transfuse blood, and it does not replace clinical judgment, cross-matching, or regulatory procedures.

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
| Reservation | A temporary hold on a blood unit or donor response |
| Transfer | Movement of a blood unit between hospitals |
| Fayda | Ethiopian national digital identity (simulated in this project) |
| ABO/Rh | Blood group and Rh factor compatibility rules |

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
- Node.js runtime for backend.
- PostgreSQL 16 database.
- Docker and Docker Compose supported for local and deployment environments.
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

## 4. Functional Requirements

### 4.1 Authentication and Accounts

| ID | Requirement |
| --- | --- |
| FR-AUTH-01 | The system shall allow an individual to register as a donor. |
| FR-AUTH-02 | The system shall allow a hospital representative to register a hospital account. |
| FR-AUTH-03 | The system shall allow a doctor to register with license, specialization, institution, and phone details. |
| FR-AUTH-04 | The system shall validate registration input using schema validation. |
| FR-AUTH-05 | The system shall hash passwords and never store plaintext passwords. |
| FR-AUTH-06 | The system shall authenticate users with email and password and return a JWT. |
| FR-AUTH-07 | The system shall reject invalid, expired, or revoked tokens. |
| FR-AUTH-08 | The system shall allow a user to request a password reset by email. |
| FR-AUTH-09 | The system shall allow a user to reset a password using a valid, unexpired token. |
| FR-AUTH-10 | The system shall increment the password version on reset so existing sessions are invalidated. |
| FR-AUTH-11 | The system shall rate-limit login attempts. |
| FR-AUTH-12 | The system shall enforce role- and account-type-based route protection in the frontend and backend. |

### 4.2 Donor Management

| ID | Requirement |
| --- | --- |
| FR-DONOR-01 | The system shall maintain a donor profile including blood type, age, weight, height, phone, address, subcity, and wereda. |
| FR-DONOR-02 | The system shall support a Fayda ID and consent preferences. |
| FR-DONOR-03 | The system shall verify donor identity through a simulated Fayda check. |
| FR-DONOR-04 | The system shall track donor verification status: pending, verified, rejected, or additional information required. |
| FR-DONOR-05 | The system shall let donors define weekly availability with time ranges. |
| FR-DONOR-06 | The system shall compute donor eligibility from age, weight, last donation, interval, and medical verification. |
| FR-DONOR-07 | The system shall allow donors to upload medical reports (image or PDF). |
| FR-DONOR-08 | The system shall keep medical reports private and require authorization to access them. |
| FR-DONOR-09 | The system shall maintain donation history. |
| FR-DONOR-10 | The system shall allow donors to opt out of matching and control contact/location sharing. |

### 4.3 Hospital Management

| ID | Requirement |
| --- | --- |
| FR-HOSP-01 | The system shall maintain a hospital profile with name, address, phone, subcity, and wereda. |
| FR-HOSP-02 | The system shall assign hospital status: pending, approved, rejected, or suspended. |
| FR-HOSP-03 | The system shall allow admins to review and decide on hospital registration. |
| FR-HOSP-04 | The system shall allow approved hospitals to manage staff members. |
| FR-HOSP-05 | The system shall enforce hospital staff roles and active status. |
| FR-HOSP-06 | The system shall support hospital search for nearby donors and hospitals. |
| FR-HOSP-07 | The system shall return donor details with privacy-aware contact and location rules. |

### 4.4 Blood Inventory

| ID | Requirement |
| --- | --- |
| FR-INV-01 | The system shall create blood units with bag ID, blood type, component, collection date, expiry date, and storage details. |
| FR-INV-02 | The system shall prevent duplicate bag IDs within a hospital. |
| FR-INV-03 | The system shall track screening status: not tested, pending, passed, or failed. |
| FR-INV-04 | The system shall track confirmation status and blood type confirmation. |
| FR-INV-05 | The system shall track unit status: pending, available, reserved, transferred, used, expired, or discarded. |
| FR-INV-06 | The system shall list inventory with filtering and stock summaries. |
| FR-INV-07 | The system shall provide expiry alerts for units nearing expiry. |
| FR-INV-08 | The system shall automatically expire overdue units. |
| FR-INV-09 | The system shall record inventory changes in the audit log. |

### 4.5 Blood Requests

| ID | Requirement |
| --- | --- |
| FR-REQ-01 | The system shall allow an approved hospital to create a blood request. |
| FR-REQ-02 | A request shall include component, blood type, required units, urgency, location, and optional notes. |
| FR-REQ-03 | The system shall list requests for the requesting hospital. |
| FR-REQ-04 | The system shall allow a hospital to view request details. |
| FR-REQ-05 | The system shall allow the hospital to update or cancel an open request. |
| FR-REQ-06 | The system shall track request status: open, fulfilled, or cancelled. |

### 4.6 Matching

| ID | Requirement |
| --- | --- |
| FR-MATCH-01 | The system shall match compatible blood units and donors to a request. |
| FR-MATCH-02 | Compatibility shall account for ABO/Rh direction and blood component. |
| FR-MATCH-03 | The system shall rank eligible units using FEFO. |
| FR-MATCH-04 | The system shall rank donors using eligibility, availability, proximity, and reliability factors. |
| FR-MATCH-05 | The system shall report compatible counts, required units, and shortfall. |
| FR-MATCH-06 | The system shall provide a human-readable compatibility explanation. |
| FR-MATCH-07 | The system shall not expose donor contact details unless consent rules allow it. |

### 4.7 Reservations

| ID | Requirement |
| --- | --- |
| FR-RES-01 | The system shall allow a hospital to reserve a compatible blood unit or request a donor response. |
| FR-RES-02 | Reservations shall have an expiry time. |
| FR-RES-03 | The system shall track reservation status: active, confirmed, cancelled, expired, released, or consumed. |
| FR-RES-04 | The system shall track donor response: pending, accepted, declined, or no-show. |
| FR-RES-05 | The system shall prevent double-booking of the same unit. |
| FR-RES-06 | The system shall expire overdue reservations automatically. |
| FR-RES-07 | The system shall release reserved units when a reservation is cancelled or expired. |
| FR-RES-08 | The system shall record reservation transitions in the audit log and notify relevant users. |

### 4.8 Transfers

| ID | Requirement |
| --- | --- |
| FR-TRANS-01 | The system shall allow a hospital to request transfer of a blood unit from another hospital. |
| FR-TRANS-02 | Transfers shall track status: requested, approved, dispatched, received, completed, rejected, or cancelled. |
| FR-TRANS-03 | The system shall record transfer events with status changes, notes, and actor. |
| FR-TRANS-04 | The system shall enforce valid status transitions. |
| FR-TRANS-05 | The system shall notify both hospitals at each transfer step. |
| FR-TRANS-06 | The system shall update inventory ownership/status when a transfer completes. |

### 4.9 Notifications

| ID | Requirement |
| --- | --- |
| FR-NOT-01 | The system shall create notifications for donor, hospital, reservation, and transfer events. |
| FR-NOT-02 | The system shall send email notifications through SMTP. |
| FR-NOT-03 | The system shall retry failed notifications up to a configured maximum. |
| FR-NOT-04 | The system shall avoid duplicate notifications using deduplication keys. |
| FR-NOT-05 | The system shall let users view in-app notifications and mark them as read. |
| FR-NOT-06 | The system shall let users configure notification preferences. |

### 4.10 Administration and Audit

| ID | Requirement |
| --- | --- |
| FR-ADM-01 | The system shall let admins list and search users. |
| FR-ADM-02 | The system shall let admins change user roles and active status. |
| FR-ADM-03 | The system shall let admins approve, reject, or suspend hospitals. |
| FR-ADM-04 | The system shall record audit events for sensitive actions. |
| FR-ADM-05 | The system shall let admins view audit logs with filters. |
| FR-ADM-06 | The system shall let admins view and update system settings. |
| FR-ADM-07 | The system shall prevent unauthorized users from accessing admin functions. |

## 5. Non-Functional Requirements

### 5.1 Security

| ID | Requirement |
| --- | --- |
| NFR-SEC-01 | Passwords shall be hashed with bcrypt. |
| NFR-SEC-02 | JWTs shall be signed with a strong secret and validated on every protected request. |
| NFR-SEC-03 | Password reset tokens shall be stored hashed and expire. |
| NFR-SEC-04 | Authorization shall be enforced server-side for every protected endpoint. |
| NFR-SEC-05 | CORS shall allow only configured origins. |
| NFR-SEC-06 | Login and sensitive endpoints shall be rate-limited. |
| NFR-SEC-07 | Medical reports and private uploads shall not be publicly accessible. |
| NFR-SEC-08 | Sensitive actions shall be written to the audit log. |

### 5.2 Performance

| ID | Requirement |
| --- | --- |
| NFR-PERF-01 | Common API requests should respond within 2 seconds under normal load. |
| NFR-PERF-02 | Matching should handle typical hospital inventory sizes without noticeable delay. |
| NFR-PERF-03 | Database indexes shall support frequent queries (status, blood type, expiry, ownership). |

### 5.3 Reliability and Availability

| ID | Requirement |
| --- | --- |
| NFR-REL-01 | Failed background jobs shall log errors without crashing the server. |
| NFR-REL-02 | Notification failures shall be retried. |
| NFR-REL-03 | The database shall be the source of truth for inventory and reservation state. |
| NFR-REL-04 | Docker Compose shall support reproducible local startup. |

### 5.4 Usability

| ID | Requirement |
| --- | --- |
| NFR-USE-01 | The interface shall be responsive on desktop and mobile. |
| NFR-USE-02 | Forms shall show clear validation and error messages. |
| NFR-USE-03 | Destructive actions shall require confirmation. |
| NFR-USE-04 | The interface shall use consistent colors, typography, and spacing. |

### 5.5 Maintainability

| ID | Requirement |
| --- | --- |
| NFR-MNT-01 | Backend code shall be separated into routes, controllers, services, validators, and middleware. |
| NFR-MNT-02 | Frontend code shall separate pages, components, services, context, and utilities. |
| NFR-MNT-03 | TypeScript shall be used across frontend and backend. |
| NFR-MNT-04 | Database changes shall be managed through Prisma migrations. |
| NFR-MNT-05 | Core business rules shall have automated tests. |

### 5.6 Privacy and Compliance

| ID | Requirement |
| --- | --- |
| NFR-PRIV-01 | Donor contact details shall be visible only when consent and role rules allow. |
| NFR-PRIV-02 | Medical information shall be accessible only to authorized users. |
| NFR-PRIV-03 | Access to medical reports shall be audited. |
| NFR-PRIV-04 | The system shall state that compatibility results are advisory and not a clinical decision. |

## 6. Data Requirements

Core entities include:

- `User`, `PasswordResetToken`, `RevokedToken`, `RateLimitCounter`
- `DonorProfile`, `DonorAvailabilitySchedule`, `MedicalReport`, `DonationRecord`
- `HospitalProfile`, `HospitalStaffMember`, `DoctorProfile`
- `BloodUnit`, `BloodRequest`, `Reservation`, `Transfer`, `TransferEvent`
- `Notification`, `NotificationPreference`
- `AuditLog`, `SystemSetting`

Key relationships:

- A user has at most one donor, hospital, or doctor profile.
- A hospital has many staff members, blood units, requests, reservations, and transfers.
- A reservation may reference a blood unit and/or a donor.
- A transfer moves one blood unit between two hospitals.
- Notifications and audit logs reference users and related entities.

## 7. External Interfaces

| Interface | Description |
| --- | --- |
| Web UI | React SPA served on port 5173 in development |
| REST API | Express API under `/api`, default port 3000 |
| Database | PostgreSQL through Prisma |
| Email | SMTP via nodemailer |
| Fayda | Simulated identity verification service |
| Docker | Compose-managed Postgres, backend, and frontend services |

## 8. Assumptions and Dependencies

- Users have valid email addresses and internet access.
- Hospitals and doctors are approved before performing privileged actions.
- A real Fayda integration will replace the current simulation in production.
- SMTP credentials are provided through environment variables.
- Clinical staff perform final cross-matching and compatibility checks.
- Docker is optional for development but recommended for reproducible environments.

## 9. Out of Scope

- Real Fayda registry integration.
- Real payment processing.
- Blood testing, collection, or transfusion workflows.
- Mobile native applications.
- SMS notifications.
- Cross-border or multi-tenant deployment.
- Automated clinical decision-making.

## 10. Acceptance Criteria

The system is acceptable when:

1. A visitor can register and log in as a donor, hospital, or doctor.
2. A donor can complete a profile, set availability, and upload a medical report.
3. A doctor can review and decide on a donor report.
4. An admin can approve a hospital and manage users.
5. A hospital can add inventory and create a blood request.
6. Matching returns compatible units/donors with FEFO ranking.
7. A reservation can be created, confirmed, cancelled, and expired automatically.
8. A transfer can move through requested, approved, dispatched, received, and completed states.
9. Notifications are created and emailed according to preferences.
10. Sensitive actions appear in the audit log.
