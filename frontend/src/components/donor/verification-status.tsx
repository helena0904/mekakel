import type {
  VerificationStatusValue,
} from '../../services/donor.service'

function badgeClass(status: VerificationStatusValue): string {
  switch (status) {
    case 'VERIFIED':
      return 'status-badge status-badge-approved'
    case 'REJECTED':
      return 'status-badge status-badge-rejected'
    case 'ADDITIONAL_INFO_REQUIRED':
      return 'status-badge status-badge-info'
    default:
      return 'status-badge status-badge-pending'
  }
}

function statusLabel(status: VerificationStatusValue): string {
  switch (status) {
    case 'VERIFIED':
      return 'Approved'
    case 'REJECTED':
      return 'Rejected'
    case 'ADDITIONAL_INFO_REQUIRED':
      return 'More information required'
    default:
      return 'Pending review'
  }
}

interface VerificationStatusProps {
  status: VerificationStatusValue
  notes?: string | null
  verifiedAt?: string | null
}

function VerificationStatus({
  status,
  notes,
  verifiedAt,
}: VerificationStatusProps) {
  return (
    <div className="verification-status">
      <div className="verification-status-header">
        <h2>Medical verification</h2>

        <span className={badgeClass(status)}>
          {statusLabel(status)}
        </span>
      </div>

      <p className="medical-note">
        Medical approval is decided by an authorized
        healthcare verifier after reviewing your medical
        report. Mock Fayda identity verification is separate
        and never establishes donation eligibility by itself.
      </p>

      {verifiedAt && status === 'VERIFIED' && (
        <p>
          Approved on{' '}
          {new Date(verifiedAt).toISOString().slice(0, 10)}.
        </p>
      )}

      {notes && (
        <p className="verification-notes">
          Reviewer note: {notes}
        </p>
      )}

      {status === 'ADDITIONAL_INFO_REQUIRED' && (
        <p>
          Please upload an updated medical report from the
          medical reports page.
        </p>
      )}

      {status === 'REJECTED' && (
        <p>
          Contact the reviewing facility before submitting a
          new report.
        </p>
      )}
    </div>
  )
}

export default VerificationStatus
