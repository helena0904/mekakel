import nodemailer from 'nodemailer'

import { isUndeliverableEmail } from '../lib/email-domain'
import type { NotificationTypeValue } from '../validators/notification.schema'

const RESET_EXPIRY_MINUTES = 15

function cannotReceiveEmail(email: string): boolean {
  return (
    process.env.NODE_ENV !== 'test' &&
    isUndeliverableEmail(email)
  )
}

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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

/**
 * Sends a single, pre-rendered message through the configured SMTP
 * transport. Workflow notifications are persisted first (see
 * notification.service) and delivered through this function so delivery
 * failures can be tracked and retried.
 */
export async function sendEmail(
  message: EmailMessage
): Promise<void> {
  if (cannotReceiveEmail(message.to)) {
    return
  }

  const from = requiredEnv('SMTP_FROM')
  const transporter = createEmailTransporter()

  await transporter.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
  })
}

export interface WorkflowEmailContext {
  recipientName?: string
  hospitalName?: string
  hospitalPhone?: string
  hospitalAddress?: string
  otherHospitalName?: string
  unitBagId?: string
  bloodType?: string
  component?: string
  reservationId?: number
  transferId?: number
  reason?: string
  notes?: string
}

export interface WorkflowEmail {
  subject: string
  text: string
  html: string
}

function humanizeEnum(value?: string): string {
  if (!value) {
    return ''
  }

  return value
    .toLowerCase()
    .split('_')
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(' ')
}

function describeUnit(
  context: WorkflowEmailContext
): string {
  return [
    context.unitBagId,
    humanizeEnum(context.bloodType),
    humanizeEnum(context.component),
  ]
    .filter(Boolean)
    .join(' · ')
}

function describeTransfer(
  context: WorkflowEmailContext
): string {
  return [
    `Transfer #${context.transferId ?? '—'}`,
    describeUnit(context),
  ]
    .filter(Boolean)
    .join(' · ')
}

function describeReservation(
  context: WorkflowEmailContext
): string {
  return [
    `Reservation #${context.reservationId ?? '—'}`,
    describeUnit(context),
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Renders the subject/text/html body for a workflow event. Kept in the
 * email service so all outbound copy lives in one place.
 */
export function renderWorkflowEmail(
  type: NotificationTypeValue,
  context: WorkflowEmailContext = {}
): WorkflowEmail {
  const greeting = context.recipientName
    ? `Hello ${context.recipientName},`
    : 'Hello,'

  const hospital = context.hospitalName ?? 'your hospital'

  let subject = 'MEKAKEL notification'
  let lines: string[] = []

  switch (type) {
    case 'DONOR_REGISTERED':
      subject = 'Welcome to MEKAKEL'
      lines = [
        'Your donor registration has been received.',
        'Your Fayda identity check is complete and your medical review is now pending.',
        'You can upload a medical report from your donor dashboard to speed up verification.',
      ]
      break

    case 'DONOR_VERIFICATION_APPROVED':
      subject = 'Your MEKAKEL donor account is verified'
      lines = [
        'Your donor verification is complete.',
        'You can now be matched with blood requests from hospitals.',
      ]
      break

    case 'DONOR_VERIFICATION_REJECTED':
      subject = 'Donor verification update'
      lines = [
        'Your donor verification could not be approved.',
        ...(context.reason
          ? [`Reason: ${context.reason}`]
          : []),
        'Please review your details and upload a valid medical report.',
      ]
      break

    case 'DONOR_ADDITIONAL_INFO_REQUIRED':
      subject = 'More information needed for donor verification'
      lines = [
        'We need additional information before we can verify your donor account.',
        ...(context.notes
          ? [`Reviewer note: ${context.notes}`]
          : []),
        'Please update your profile or medical report in your donor dashboard.',
      ]
      break

    case 'DONOR_BLOOD_REQUESTED':
      subject = 'Urgent blood donation request'
      lines = [
        `${context.hospitalName ?? 'A hospital'} needs blood now and has requested your help.`,
        describeUnit(context),
        ...(context.hospitalAddress
          ? [`Hospital address: ${context.hospitalAddress}`]
          : []),
        ...(context.hospitalPhone
          ? [`Please contact the hospital on ${context.hospitalPhone} as soon as you can.`]
          : [
              'Please check the hospital details in your MEKAKEL notifications and contact them as soon as you can.',
            ]),
      ].filter(Boolean)
      break

    case 'HOSPITAL_REGISTERED':
      subject = 'Welcome to MEKAKEL'
      lines = [
        `Your hospital registration for ${hospital} has been received.`,
        'An administrator will review your hospital details before your account is activated.',
        'You can sign in now to review your profile while the review is pending.',
        'You will receive another email once your hospital is approved.',
      ]
      break

    case 'HOSPITAL_APPROVED':
      subject = 'Your hospital is approved on MEKAKEL'
      lines = [
        `Your hospital account for ${hospital} has been approved.`,
        'You can now manage inventory, requests, reservations and transfers.',
      ]
      break

    case 'HOSPITAL_REJECTED':
      subject = 'Hospital registration update'
      lines = [
        `Your hospital registration for ${hospital} was not approved.`,
        ...(context.reason
          ? [`Reason: ${context.reason}`]
          : []),
        'Please correct the details and submit a new registration if needed.',
      ]
      break

    case 'HOSPITAL_SUSPENDED':
      subject = 'Hospital account suspended'
      lines = [
        `Your hospital account for ${hospital} has been suspended.`,
        ...(context.reason
          ? [`Reason: ${context.reason}`]
          : []),
        'Contact MEKAKEL support if you believe this is a mistake.',
      ]
      break

    case 'HOSPITAL_ACTIVATED':
      subject = 'Hospital account reactivated'
      lines = [
        `Your hospital account for ${hospital} has been reactivated.`,
      ]
      break

    case 'RESERVATION_CONFIRMED':
      subject = 'Blood reservation confirmed'
      lines = [
        `The reservation is confirmed for ${hospital}.`,
        describeReservation(context),
      ]
      break

    case 'RESERVATION_CANCELLED':
      subject = 'Blood reservation cancelled'
      lines = [
        `A blood reservation was cancelled for ${hospital}.`,
        describeReservation(context),
        ...(context.reason
          ? [`Reason: ${context.reason}`]
          : []),
      ]
      break

    case 'RESERVATION_RELEASED':
      subject = 'Blood reservation released'
      lines = [
        `A blood reservation was released back to inventory for ${hospital}.`,
        describeReservation(context),
      ]
      break

    case 'RESERVATION_EXPIRED':
      subject = 'Blood reservation expired'
      lines = [
        `A blood reservation expired for ${hospital} and the unit was released.`,
        describeReservation(context),
      ]
      break

    case 'RESERVATION_CONSUMED':
      subject = 'Reserved blood unit marked as used'
      lines = [
        `A reserved blood unit was recorded as used for ${hospital}.`,
        describeReservation(context),
      ]
      break

    case 'TRANSFER_REQUESTED':
      subject = 'Incoming blood transfer request'
      lines = [
        `${context.otherHospitalName ?? 'A hospital'} requested a blood unit transfer to ${hospital}.`,
        describeTransfer(context),
        'Review it from your transfers page to approve or reject it.',
      ]
      break

    case 'TRANSFER_APPROVED':
      subject = 'Transfer request approved'
      lines = [
        `${context.otherHospitalName ?? 'The receiving hospital'} approved the transfer.`,
        describeTransfer(context),
      ]
      break

    case 'TRANSFER_REJECTED':
      subject = 'Transfer request rejected'
      lines = [
        `${context.otherHospitalName ?? 'The receiving hospital'} rejected the transfer request.`,
        describeTransfer(context),
        ...(context.reason
          ? [`Reason: ${context.reason}`]
          : []),
      ]
      break

    case 'TRANSFER_DISPATCHED':
      subject = 'Blood unit dispatched'
      lines = [
        `${context.otherHospitalName ?? 'The source hospital'} dispatched the blood unit.`,
        describeTransfer(context),
      ]
      break

    case 'TRANSFER_RECEIVED':
      subject = 'Blood unit received'
      lines = [
        `${context.otherHospitalName ?? 'The receiving hospital'} confirmed receipt of the blood unit.`,
        describeTransfer(context),
      ]
      break

    case 'TRANSFER_COMPLETED':
      subject = 'Blood transfer completed'
      lines = [
        'The blood unit transfer has been completed.',
        describeTransfer(context),
      ]
      break

    case 'TRANSFER_CANCELLED':
      subject = 'Transfer cancelled'
      lines = [
        `${context.otherHospitalName ?? 'The other hospital'} cancelled the transfer.`,
        describeTransfer(context),
      ]
      break
  }

  const text = [greeting, '', ...lines, '', 'MEKAKEL Team'].join(
    '\n'
  )

  const html = [
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; line-height: 1.6;">',
    `  <h2>${escapeHtml(subject)}</h2>`,
    `  <p>${escapeHtml(greeting)}</p>`,
    ...lines.map((line) => `  <p>${escapeHtml(line)}</p>`),
    '  <p>MEKAKEL Team</p>',
    '</div>',
  ].join('\n')

  return { subject, text, html }
}

export async function sendWorkflowEmail(
  to: string,
  type: NotificationTypeValue,
  context: WorkflowEmailContext = {}
): Promise<void> {
  const rendered = renderWorkflowEmail(type, context)

  await sendEmail({ to, ...rendered })
}

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  if (cannotReceiveEmail(email)) {
    return
  }

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