# MEKAKEL — UI Design Guidelines

## 1. Design Vision

MEKAKEL is a healthcare coordination platform. The interface should feel:

- Trustworthy and calm
- Clinical but approachable
- Fast to scan for busy hospital staff
- Clear about what is safe, pending, or urgent

The visual identity uses a warm red accent to reference blood donation, balanced by generous white space and soft neutral surfaces so the product does not feel alarming.

## 2. Brand Identity

### 2.1 Logo

- The MEKAKEL logo appears in the navigation bar inside a white circular badge.
- The wordmark is uppercase in the heading font with slight letter spacing.
- The logo is also used as the browser favicon.

### 2.2 Color Palette

| Token | Value | Usage |
| --- | --- | --- |
| `--red` | `#be463d` | Primary actions, links, accents, navbar |
| `--red-dark` | `#a01208` | Hover and pressed states |
| `--red-soft` | `#fdeceb` | Highlights, alerts, unread notifications |
| `--text` | `#0e0e0e` | Headings and primary text |
| `--muted` | `#666666` | Secondary text and descriptions |
| `--bg-soft` | `#f7f7f7` | Page sections and cards |
| `--border` | `#e6e6e6` | Dividers and input borders |
| White | `#ffffff` | Page background and cards |

Status colors:

| Status | Background | Text |
| --- | --- | --- |
| Pending | `#fff3cd` | `#8a6d3b` |
| Approved / success | `#e8f5e9` | `#198754` |
| Rejected / error | `#ffebee` | `#d32f2f` |
| Informational | `--red-soft` | `--red` |

### 2.3 Typography

| Role | Font | Weight |
| --- | --- | --- |
| Headings | Montserrat | 600–800 |
| Body | Poppins | 400–600 |

Type scale:

- Page title: 30–44px
- Section heading: 30px
- Card heading: 18–20px
- Body: 14–17px
- Helper text: 13–14px

## 3. Layout System

### 3.1 Global Structure

```text
Navbar (red)
Page content
Footer (dark gray with red top border)
```

- Maximum content width is typically 800–900px for forms and reading-heavy pages.
- Sections use 4.5rem vertical padding on desktop and 3rem on mobile.
- Cards use white backgrounds, 8px radii, and soft shadows.

### 3.2 Navigation Bar

- Single red bar with the logo on the left.
- Links are white, 13px, medium weight.
- Hover state uses a white underline.
- Primary registration action is visually emphasized.
- On small screens, links wrap and center below the logo.

### 3.3 Footer

- Dark gray background with a red top border.
- Centered text in a muted light color.
- Used for project identity and supporting links.

### 3.4 Hero Section

- Split layout: text content on the left, hero image on the right.
- Background uses a soft white-to-pink gradient.
- The image's left edge fades into the background for a seamless blend.
- Heading is dark and bold; supporting copy is muted.
- Primary action is a red pill button.
- On mobile, the layout stacks with the image above the text.

## 4. Page Inventory

### 4.1 Public Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/` | Home | Hero, about, audience, benefits, how it works, call to action |
| `/login` | Login | Role/account selection and sign-in |
| `/register` | Register | Donor, hospital, or doctor registration |
| `/forgot-password` | Forgot password | Request a reset link |
| `/reset-password` | Reset password | Set a new password |

### 4.2 Donor Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/donor-dashboard` | Donor dashboard | Verification status and donation activities |
| `/donor/profile` | Donor profile | Personal, blood, contact, and consent details |
| `/donor/availability` | Availability | Weekly availability schedule |
| `/donor/medical-reports` | Medical reports | Upload and review report status |
| `/donor/history` | Donation history | Past donations |

### 4.3 Hospital Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/hospital-dashboard` | Hospital dashboard | Institution status and hospital activities |
| `/hospital/profile` | Hospital profile | Institution and contact details |
| `/hospital/search` | Hospital search | Find nearby donors and hospitals |
| `/hospital/inventory` | Blood inventory | Manage units, stock summary, expiry alerts |
| `/hospital/requests` | Request list | View blood requests |
| `/hospital/requests/new` | Create request | Submit a new blood request |
| `/hospital/requests/:id` | Request details | View and manage a request |
| `/hospital/requests/:id/matches` | Matching results | Compatible units and donors |
| `/hospital/reservations` | Reservations | Manage reservations |
| `/hospital/transfers` | Transfers | Manage transfers |
| `/hospital/transfers/:id` | Transfer details | Track transfer state and events |

### 4.4 Doctor Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/doctor-dashboard` | Doctor dashboard | Verification workload overview |
| `/doctor/verifications` | Verification queue | Donor reports awaiting review |
| `/doctor/verifications/:id` | Review report | Eligibility checks and medical report review |

### 4.5 Admin Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/admin-dashboard` | Admin dashboard | Platform administration overview |
| `/admin/hospitals` | Hospital approvals | Review hospital registrations |
| `/admin/users` | User management | Roles, status, and accounts |
| `/admin/audit-logs` | Audit logs | Trace sensitive actions |

### 4.6 Shared Authenticated Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/notifications` | Notifications | In-app notifications and preferences |

## 5. Component Patterns

### 5.1 Buttons

| Type | Style |
| --- | --- |
| Primary | Red background, white text, 4px radius, dark red hover |
| Secondary | White background, red border and text, red fill on hover |
| Danger | Red border/text, solid red on hover |
| Pill | Rounded full, used in the hero |

Rules:

- One primary action per section.
- Use sentence case for labels.
- Keep button height consistent within a form.
- Disable buttons while submitting and show a clear loading label.

### 5.2 Cards

- White surface, 8px radius, soft shadow.
- Optional red top or left accent border for emphasis.
- Hover lift is reserved for interactive cards such as audience cards.

### 5.3 Forms

- Labels above inputs, bold.
- Inputs are full width with 12px padding and 6px radius.
- Focus state uses a red border and a soft red glow.
- Group related fields into `form-section` blocks with a heading.
- Show validation messages close to the field.
- Use helper text for sensitive fields such as passwords and medical data.

### 5.4 Tables

- Used for inventory and administrative lists.
- Header row uses the primary red with white text.
- Rows use thin neutral dividers.
- Tables scroll horizontally on small screens.
- Actions are compact secondary buttons.

### 5.5 Status Badges

- Rounded pill shape.
- Text is short and uppercase or title case.
- Color reflects pending, approved, rejected, or informational state.

### 5.6 Alerts and Notices

- Success: light green background with green text.
- Error: light red background with red text.
- Warning: soft yellow or red-soft background.
- Medical and consent notices use a left red accent border.
- Unread notifications use a soft red background and left accent.

### 5.7 Lists

- Simple vertical lists with 8–12px spacing.
- Dashboard activity links are charcoal, not bright red, to keep the page calm.
- Secondary metadata uses muted text and a smaller size.

## 6. Interaction States

Each data-driven screen should account for:

| State | UI treatment |
| --- | --- |
| Loading | Status text such as "Loading…" or a disabled submit button |
| Empty | Short explanatory message and a next action |
| Error | Inline alert with a retry or correction path |
| Success | Confirmation alert or updated status badge |
| Disabled | Reduced emphasis and no pointer interaction |

## 7. Responsive Design

| Breakpoint | Behavior |
| --- | --- |
| `> 768px` | Full navigation, split hero, multi-column cards |
| `≤ 768px` | Navigation wraps, hero stacks, sections reduce padding, forms remain single column |
| `≤ 560px` | Login choices collapse to one column, containers become full width, headings reduce in size |

Guidelines:

- Keep tap targets at least 44px high.
- Avoid horizontal scrolling except inside tables.
- Let text wrap naturally; do not truncate critical medical labels.

## 8. Accessibility

- Use semantic elements and real buttons/links.
- Every input must have a visible label.
- Maintain sufficient color contrast, especially for muted text on white.
- Do not rely on color alone to communicate status; include a text label.
- Provide meaningful `alt` text for images.
- Keep focus styles visible.
- Announce errors in text near the relevant control.
- Ensure forms are usable with keyboard-only navigation.

## 9. Content and Tone

- Use direct, reassuring language.
- Prefer "can", "may", and "will" over alarming phrasing.
- Explain medical limitations clearly.
- Keep labels short and action-oriented.
- Use Ethiopian address conventions where relevant: subcity and wereda.
- Avoid implying that MEKAKEL provides or guarantees blood.

## 10. Design Constraints and Future Improvements

Current constraints:

- Styling is a mix of semantic CSS classes and Tailwind.
- Some pages use dense forms that could benefit from progressive disclosure.
- Notification updates require navigation or refresh.

Future improvements:

- A shared design-system component library.
- Skeleton loaders instead of plain loading text.
- More consistent empty-state illustrations.
- Mobile-first table alternatives.
- Dark mode with carefully validated medical status colors.
- Accessibility audit and automated visual regression tests.
- Localization for Amharic and other languages.
