# MEKAKEL — Entity Relationship Diagram

Source: `backend/prisma/schema.prisma` (PostgreSQL, Prisma). 20 models.
PK = primary key, FK = foreign key, UK = unique. Only key columns are shown; see the Database Design document for every column.

## 1. Full ERD

```mermaid
erDiagram
    USER ||--o| DONOR_PROFILE : "has"
    USER ||--o| HOSPITAL_PROFILE : "has"
    USER ||--o| DOCTOR_PROFILE : "has"
    USER ||--o| HOSPITAL_STAFF_MEMBER : "works as"
    USER ||--o| PASSWORD_RESET_TOKEN : "requests"
    USER ||--o| NOTIFICATION_PREFERENCE : "sets"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ MEDICAL_REPORT : "uploads"

    DONOR_PROFILE ||--o{ DONOR_AVAILABILITY_SCHEDULE : "defines"
    DONOR_PROFILE ||--o{ MEDICAL_REPORT : "submits"
    DONOR_PROFILE ||--o{ DONATION_RECORD : "records"
    DONOR_PROFILE |o--o{ RESERVATION : "is reserved in"

    HOSPITAL_PROFILE ||--o{ HOSPITAL_STAFF_MEMBER : "employs"
    HOSPITAL_PROFILE ||--o{ BLOOD_UNIT : "stores"
    HOSPITAL_PROFILE ||--o{ BLOOD_REQUEST : "raises"
    HOSPITAL_PROFILE ||--o{ RESERVATION : "owns"
    HOSPITAL_PROFILE ||--o{ TRANSFER : "sends"
    HOSPITAL_PROFILE ||--o{ TRANSFER : "receives"

    BLOOD_UNIT |o--o{ RESERVATION : "held by"
    BLOOD_UNIT ||--o{ TRANSFER : "moved by"
    BLOOD_REQUEST |o--o{ RESERVATION : "fulfilled by"
    RESERVATION |o--o{ TRANSFER : "leads to"
    TRANSFER ||--o{ TRANSFER_EVENT : "logs"

    USER {
        int id PK
        string email UK
        string passwordHash
        int passwordVersion
        string name
        enum accountType
        enum role
        boolean isActive
    }
    PASSWORD_RESET_TOKEN {
        int id PK
        int userId FK
        string tokenHash UK
        datetime expiresAt
    }
    NOTIFICATION_PREFERENCE {
        int id PK
        int userId FK
        boolean emailEnabled
    }
    NOTIFICATION {
        int id PK
        int userId FK
        enum type
        enum category
        enum status
        string dedupeKey UK
        int attempts
        datetime readAt
    }
    DONOR_PROFILE {
        int id PK
        int userId FK
        string faydaId UK
        enum bloodType
        enum verificationStatus
        enum activeStatus
        enum currentAvailability
        datetime lastDonation
        boolean consentToContact
        boolean shareLocation
        boolean matchingOptOut
    }
    DONOR_AVAILABILITY_SCHEDULE {
        int id PK
        int donorProfileId FK
        enum day
        string time
    }
    MEDICAL_REPORT {
        int id PK
        int donorProfileId FK
        int uploadedByUserId FK
        enum reportType
        string fileUrl
        enum verificationStatus
    }
    DONATION_RECORD {
        int id PK
        int donorProfileId FK
        datetime donatedAt
        float units
    }
    HOSPITAL_PROFILE {
        int id PK
        int userId FK
        string hospitalName
        enum status
        boolean isVerified
    }
    HOSPITAL_STAFF_MEMBER {
        int id PK
        int hospitalProfileId FK
        int userId FK
        enum staffRole
        boolean isActive
    }
    DOCTOR_PROFILE {
        int id PK
        int userId FK
        string licenseNumber UK
        string specialization
        boolean isVerified
    }
    BLOOD_UNIT {
        int id PK
        int hospitalProfileId FK
        string bagId "UK per hospital"
        enum bloodType
        enum component
        datetime expiryDate
        enum screeningStatus
        enum confirmationStatus
        enum status
    }
    BLOOD_REQUEST {
        int id PK
        int hospitalProfileId FK
        enum bloodType
        enum component
        int requiredUnits
        enum urgency
        enum status
    }
    RESERVATION {
        int id PK
        int hospitalProfileId FK
        int bloodUnitId FK
        int bloodRequestId FK
        int donorProfileId FK
        enum kind
        enum status
        enum donorResponse
        datetime expiresAt
    }
    TRANSFER {
        int id PK
        int bloodUnitId FK
        int fromHospitalProfileId FK
        int toHospitalProfileId FK
        int reservationId FK
        enum status
    }
    TRANSFER_EVENT {
        int id PK
        int transferId FK
        enum fromStatus
        enum toStatus
        int actorUserId
        datetime createdAt
    }
    AUDIT_LOG {
        int id PK
        int actorUserId
        enum action
        string entityType
        int entityId
        json metadata
        datetime createdAt
    }
    SYSTEM_SETTING {
        int id PK
        string key UK
        json value
        int updatedByUserId
    }
    REVOKED_TOKEN {
        int id PK
        string jti UK
        datetime expiresAt
    }
    RATE_LIMIT_COUNTER {
        string key PK
        int count
        datetime expiresAt
    }
```

## 2. Relationship summary

| Parent | Child | Cardinality | On delete |
|---|---|---|---|
| User | DonorProfile, HospitalProfile, DoctorProfile, HospitalStaffMember | 1 to 0..1 | Cascade |
| User | PasswordResetToken, NotificationPreference | 1 to 0..1 | Cascade |
| User | Notification | 1 to many | Cascade |
| User | MedicalReport (uploader) | 1 to many | Cascade |
| DonorProfile | DonorAvailabilitySchedule, MedicalReport, DonationRecord | 1 to many | Cascade |
| DonorProfile | Reservation | 1 to many (optional) | Set null |
| HospitalProfile | HospitalStaffMember, BloodUnit, BloodRequest, Reservation | 1 to many | Cascade |
| HospitalProfile | Transfer (sender and receiver) | 1 to many, twice | Cascade |
| BloodUnit | Reservation | 1 to many (optional) | Cascade |
| BloodUnit | Transfer | 1 to many | Cascade |
| BloodRequest | Reservation | 1 to many (optional) | Set null |
| Reservation | Transfer | 1 to many (optional) | Set null |
| Transfer | TransferEvent | 1 to many | Cascade |

## 3. Notes

- **No foreign key, by design:** `AuditLog`, `SystemSetting`, `RevokedToken` and `RateLimitCounter` stand alone. Actor ids on `AuditLog`, `SystemSetting`, `TransferEvent` and `BloodRequest.createdByUserId` are plain integers, so history survives user deletion.
- **Reservation target:** a reservation points to either a blood unit or a donor, depending on `kind` (`BLOOD_UNIT` or `DONOR`).
- **Unique rules:** one profile per user per role, one availability slot per donor per weekday, and one bag ID per hospital.
