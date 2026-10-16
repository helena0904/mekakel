import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'

import {
  fetchReportFile,
  formatDate,
  getReports,
  uploadReport,
  verificationLabel,
} from '../../services/donor.service'
import type {
  MedicalReport,
  ReportType,
  VerificationStatusValue,
} from '../../services/donor.service'

function statusClass(
  status: VerificationStatusValue
): string {
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

function DonorMedicalReportsPage() {
  const [reports, setReports] = useState<MedicalReport[]>([])
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState<
    ReportType | ''
  >('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  async function refresh() {
    setReports(await getReports())
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getReports()

        if (!cancelled) {
          setReports(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load your reports'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleUpload(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (uploading) {
      return
    }

    setError('')
    setSuccess('')

    if (!reportType || !file) {
      setError('Please select a report type and a file.')
      return
    }

    setUploading(true)

    try {
      await uploadReport(reportType, file)
      setSuccess(
        'Report uploaded. A verifier will review it shortly.'
      )
      setReportType('')
      setFile(null)

      if (fileInput.current) {
        fileInput.current.value = ''
      }

      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to upload the report'
      )
    } finally {
      setUploading(false)
    }
  }

  async function handleView(reportId: number) {
    setError('')

    try {
      const blob = await fetchReportFile(reportId)
      const url = URL.createObjectURL(blob)

      window.open(url, '_blank', 'noopener,noreferrer')

      window.setTimeout(
        () => URL.revokeObjectURL(url),
        60_000
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to open the report'
      )
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link
          to="/donor-dashboard"
          className="back-link"
        >
          ← Back to dashboard
        </Link>

        <h1>Medical Reports</h1>

        <p className="section-description">
          Reports are stored privately. Only you and authorized
          healthcare verifiers can access them.
        </p>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="register-success" role="status">
            {success}
          </p>
        )}

        <form
          className="register-form"
          onSubmit={handleUpload}
        >
          <section className="form-section">
            <h2>Upload a new report</h2>

            <div className="form-group">
              <label htmlFor="report-type">
                Report type
              </label>
              <select
                id="report-type"
                value={reportType}
                onChange={(event) =>
                  setReportType(
                    event.target.value as ReportType | ''
                  )
                }
                disabled={uploading}
              >
                <option value="">Select report type</option>
                <option value="IMAGE">Image (JPG/PNG/WEBP)</option>
                <option value="PDF">PDF document</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="report-file">
                Report file
              </label>
              <input
                id="report-file"
                ref={fileInput}
                type="file"
                accept={
                  reportType === 'IMAGE'
                    ? 'image/jpeg,image/png,image/webp'
                    : reportType === 'PDF'
                      ? '.pdf,application/pdf'
                      : 'image/jpeg,image/png,image/webp,application/pdf'
                }
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
                disabled={uploading || !reportType}
              />
              <small>Maximum size 5 MB.</small>
            </div>

            <button
              type="submit"
              className="register-button"
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload report'}
            </button>
          </section>
        </form>

        <section className="form-section">
          <h2>Your reports</h2>

          {loading && <p role="status">Loading…</p>}

          {!loading && reports.length === 0 && (
            <p>You have not uploaded any reports yet.</p>
          )}

          {reports.length > 0 && (
            <ul className="report-list">
              {reports.map((report) => (
                <li key={report.id} className="report-item">
                  <div>
                    <strong>{report.reportType}</strong>

                    <span className={statusClass(report.verificationStatus)}>
                      {verificationLabel(
                        report.verificationStatus
                      )}
                    </span>

                    <p>
                      Uploaded {formatDate(report.createdAt)}
                    </p>

                    {report.rejectionReason && (
                      <p className="verification-notes">
                        Reason: {report.rejectionReason}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleView(report.id)}
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

export default DonorMedicalReportsPage
