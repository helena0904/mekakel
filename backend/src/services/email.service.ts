import nodemailer from 'nodemailer'

const RESET_EXPIRY_MINUTES = 15

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error('Missing email configuration: ' + name)
  }

  return value
}

function createEmailTransporter() {
  const host = requiredEnv('SMTP_HOST')
  const port = Number(requiredEnv('SMTP_PORT'))
  const user = requiredEnv('SMTP_USER')
  const pass = requiredEnv('SMTP_PASSWORD')

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('Invalid SMTP_PORT')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
      user,
      pass,
    },
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const from = requiredEnv('SMTP_FROM')
  const frontendUrl = requiredEnv('FRONTEND_URL')

  const resetUrl = new URL(
    '/reset-password',
    frontendUrl
  )

  resetUrl.searchParams.set('token', token)

  const resetLink = resetUrl.toString()
  const safeLink = escapeHtml(resetLink)

  const transporter = createEmailTransporter()

  const text = [
    'Hello,',
    '',
    'We received a request to reset your MEKAKEL password.',
    '',
    'Open this link to reset your password:',
    resetLink,
    '',
    'This link expires in ' +
      RESET_EXPIRY_MINUTES +
      ' minutes.',
    '',
    'If you did not request this change, ignore this email.',
    'Do not share this link with anyone.',
    '',
    'MEKAKEL Team',
  ].join('\n')

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; line-height: 1.6;">
      <h2>MEKAKEL Password Reset</h2>

      <p>
        We received a request to reset your MEKAKEL password.
      </p>

      <p>
        Click the button below to choose a new password.
      </p>

      <p>
        <a
          href="${safeLink}"
          style="display: inline-block; padding: 12px 20px; background-color: #b91c1c; color: white; text-decoration: none; border-radius: 6px;"
        >
          Reset Password
        </a>
      </p>

      <p>
        This link expires in ${RESET_EXPIRY_MINUTES} minutes.
      </p>

      <p>
        If you did not request a password reset,
        you can ignore this email.
      </p>

      <p>
        For your security, do not share this link with anyone.
      </p>

      <p>MEKAKEL Team</p>
    </div>
  `

  await transporter.sendMail({
    from,
    to: email,
    subject: 'MEKAKEL Password Reset',
    text,
    html,
  })
}

export async function verifyEmailConnection(): Promise<void> {
  const transporter = createEmailTransporter()

  await transporter.verify()
}