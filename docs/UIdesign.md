# MEKAKEL — UI Design

Design specification for the MEKAKEL web client (React 19, Tailwind CSS 4, global `index.css`).
Companion files: `index.css` (implementation), the UI Design canvas (visual mockups), the SRS and System Architecture documents.

---

## 1. Design goals

| Goal | What it means in the interface |
|---|---|
| Trust | Calm white surfaces, one strong brand red, clear medical warnings and verification states |
| Speed under pressure | Emergency requests first, one primary action per screen, matching results ranked and labelled |
| Clarity | Plain labels, status badges with text (never color alone), inline validation messages |
| Accessibility | Visible focus rings, 4.5:1+ text contrast, keyboard-reachable forms, reduced-motion support |
| Responsive | Usable from 360 px phones to wide desktops; tables scroll inside their own container |

---

## 2. Design tokens

### 2.1 Color

| Token | Value | Use |
|---|---|---|
| `--red` | `#c8190b` | Primary buttons, links, headings accents, table headers |
| `--red-dark` | `#a01208` | Hover and gradient end |
| `--red-deep` | `#7d0e06` | Hero gradient start |
| `--red-soft` | `#fdeceb` | Tinted backgrounds, info badges, alert boxes |
| `--red-tint` | `#fff6f5` | Row hover, unread items |
| `--red-ring` | `rgba(200,25,11,.16)` | Focus ring |
| `--text` | `#1d1d1f` | Body text and headings |
| `--text-2` | `#4a4a4f` | Secondary text |
| `--muted` | `#6b6b72` | Helper text |
| `--bg-soft` | `#f7f7f7` | Section and row backgrounds |
| `--bg-page` | `#faf9f9` | Auth and dashboard page background |
| `--border` | `#e6e6e6` | Card and divider lines |
| `--border-strong` | `#d4d4d8` | Input borders |

**Status colors**

| Status | Text | Background | Border |
|---|---|---|---|
| Success / approved | `#198754` | `#e8f5e9` | `#a5d6a7` |
| Warning / pending | `#8a6d3b` | `#fff3cd` | `#f1df9c` |
| Error / rejected | `#d32f2f` | `#ffebee` | `#ef9a9a` |
| Info | `#c8190b` | `#fdeceb` | `#f0b8b4` |

### 2.2 Typography

| Role | Font | Size | Weight |
|---|---|---|---|
| Hero title | Montserrat | clamp 30–52 px | 800, uppercase |
| Page title (h1) | Montserrat | 24–32 px | 800 |
| Section title (h2) | Montserrat | 24–34 px | 800, red underline accent |
| Card title (h3) | Montserrat | 18–20 px | 700 |
| Body | Poppins | 16 px, line-height 1.65 | 400 |
| Helper / small | Poppins | 12.5–14 px | 400–500 |
| Buttons, labels | Poppins | 13–15 px | 600 |
| Nav links | Poppins | 13 px, uppercase, 0.04em tracking | 500 |

### 2.3 Shape, depth and motion

| Token | Value |
|---|---|
| Radius | 8 px (small) · 14 px (cards) · 20 px (page cards) · 999 px (buttons, badges) |
| Shadow small | `0 1px 2px / 0 1px 3px` at 5–6% black |
| Shadow card | `0 6px 24px` at 7% black |
| Shadow hover | `0 14px 38px` at 13% black |
| Shadow brand | `0 8px 22px` at 28% red (primary buttons) |
| Motion | 0.2–0.4 s ease-out; cards lift 4–6 px on hover; page content fades up 0.5 s; disabled when `prefers-reduced-motion` |
| Spacing | 4 px base: 8 · 12 · 16 · 20 · 24 · 32 · 48 · 72 · 88 px |

---

## 3. Components

| Component | Class | Specification |
|---|---|---|
| Navbar | `.navigationbar` | Sticky, frosted white logo row; red gradient link bar below with white uppercase links and animated underline on hover |
| Hero | `.hero` | Full-width image, dark-to-red overlay, centered white title, one primary pill button |
| Primary button | `.register-button`, `.login-button`, `.hero-buttons button` | Red gradient pill, white text, brand shadow, lifts 2 px on hover, grey when disabled |
| Secondary button | `.back-button`, `.secondary-button` | White pill with red 2 px border; fills red on hover |
| Danger button | `.danger-button` | Same as secondary, in error red |
| Card | `.user-card`, `.dashboard-card`, `.form-section` | White, 1 px border, 14 px radius, soft shadow; hover lift on interactive cards |
| Form field | `.form-group` | Label above (600), 12 × 14 px padding, 1.5 px border, red focus ring, helper text below |
| File input | `.form-group input[type=file]` | Dashed box with red pill "Choose file" button |
| Alert | `.register-error`, `.register-success` | Colored background, 5 px left bar, 14.5 px text |
| Status badge | `.status-badge-*` | Pill with leading dot: pending (amber), approved (green), rejected (red), info (soft red) |
| Table | `.data-table` in `.table-wrapper` | Red gradient header, uppercase 12.5 px labels, zebra rows, red-tint hover, horizontal scroll on small screens |
| Availability row | `.availability-row` | Checkbox, day label, two time inputs; disabled times greyed |
| Donor link | `.donor-links a` | Full-width row with arrow; slides 3 px on hover |
| Eligibility list | `.eligibility-list` | Row per rule with pass (green), fail (red) or info (red) mark |
| Notification item | `.notification-item` | White card with left border; unread uses red border and tint |
| Footer | `.footer` | Dark charcoal gradient, 4 px red top border, white links |

---

## 4. Layout and responsive rules

| Breakpoint | Behavior |
|---|---|
| Desktop (1024 px and up) | Content max-width 1100–1180 px, 3–4 column card grids, forms max 820 px |
| Tablet (769–1023 px) | Grids fall to 2 columns (`auto-fit, minmax(240px, 1fr)`) |
| Mobile (768 px and below) | Single column, padding 1–1.6 rem, link bar wraps, phone and time inputs go full width, report rows stack |
| Tables | Scroll horizontally inside `.table-wrapper`; page never scrolls sideways |

---

## 5. Page inventory and wireframes

### 5.1 Public pages

| Route | Page | Main content |
|---|---|---|
| `/` | Home | Hero, About, Who can use, Why MEKAKEL, How it works, Call to action, Footer |
| `/login` | Login | Individual / Hospital switch, email, password, forgot link |
| `/register` | Register | Medical warning, then account-type form |
| `/forgot-password`, `/reset-password` | Password recovery | Email form, then new password with show toggle |

**Home**
```
+--------------------------------------------------------------+
| MEKAKEL                                                      |  white logo row
+--------------------------------------------------------------+
| HOME   ABOUT   HOW IT WORKS   LOGIN                          |  red link bar
+--------------------------------------------------------------+
|                 FIND BLOOD, SAVE LIVES                       |
|        (one line of purpose)   [Become a donor] [Hospital]   |  hero, dark-red overlay
+--------------------------------------------------------------+
|                 Who can use MEKAKEL?                         |
| [Donors] [Hospitals] [Doctors] [Administrators]              |  4 cards
+--------------------------------------------------------------+
|        Why MEKAKEL  (01)(02)(03) numbered cards              |
+--------------------------------------------------------------+
|        How it works  (white card, red-bar subheadings)       |
+--------------------------------------------------------------+
|        Every minute matters   [Join now]   (red band)        |
+--------------------------------------------------------------+
| footer                                                       |
+--------------------------------------------------------------+
```

**Login**
```
          +---------------------------------------+
          | ▔▔▔▔▔▔▔▔▔ red top border ▔▔▔▔▔▔▔▔▔▔▔ |
          |            Welcome back               |
          |   [ Individual ]   [ Hospital ]       |
          |   Email     [______________________]  |
          |   Password  [______________________]  |
          |   [            Log in               ] |
          |   Forgot password? · Create account   |
          +---------------------------------------+
```

### 5.2 Donor area

| Route | Page |
|---|---|
| `/donor-dashboard` | Verification status, eligibility, availability, quick links |
| `/donor/profile` | Personal data, body measurements, privacy toggles |
| `/donor/availability` | Weekly schedule (day, time) |
| `/donor/medical-reports` | Upload and status list |
| `/donor/history` | Donation records |

```
Donor dashboard
+---------------------------+  +---------------------------+
| Verification  [Pending]   |  | Eligibility               |
| A doctor is reviewing...  |  | Age 18+            Passed |
+---------------------------+  | Weight 50 kg+      Passed |
+---------------------------+  | 90-day interval    Not yet|
| Availability              |  +---------------------------+
| Mon 08:00 · Wed 14:00 ... |  +---------------------------+
+---------------------------+  | Quick links →  →  →       |
                               +---------------------------+
```

### 5.3 Hospital area

| Route | Page |
|---|---|
| `/hospital-dashboard` | Stock summary, open requests, expiry alerts |
| `/hospital/profile`, `/hospital/search` | Profile and staff; nearby hospital and donor search |
| `/hospital/inventory` | Unit table with filters, add / edit unit |
| `/hospital/requests`, `/requests/new`, `/requests/:id` | Request list, form, detail |
| `/hospital/requests/:id/matches` | Ranked units and donors, reserve actions |
| `/hospital/reservations` | Active reservations with confirm / cancel |
| `/hospital/transfers`, `/transfers/:id` | Transfer list and timeline |

```
Matching results
< Back to requests
Matching results  [EMERGENCY]
Request: O negative · Red cells · 2 units
[Compatible units] [Compatible donors] [Required] [Shortfall]   summary tiles
+--------------------------------------------------------------+
| Blood units (FEFO order)                                     |
| RANK | BAG ID | TYPE | EXPIRES | HOSPITAL      |             |
| 1    | ...    | O-   | 4 days  | Own hospital  | [Reserve]   |
+--------------------------------------------------------------+
| Compatible donors   name · reasons · [Score 78]              |
+--------------------------------------------------------------+
```

### 5.4 Doctor and administrator areas

| Route | Page |
|---|---|
| `/doctor-dashboard`, `/doctor/verifications`, `/doctor/verifications/:id` | Queue of pending reports; decision form (Verified, Rejected with reason, More information) |
| `/admin-dashboard` | Platform overview |
| `/admin/hospitals` | Pending hospitals, approve / reject / suspend with notes |
| `/admin/users` | Users, roles, activate / deactivate |
| `/admin/audit-logs` | Filter bar and log table |
| `/notifications` | Notification list and preferences (all roles) |

---

## 6. States and feedback

| State | Treatment |
|---|---|
| Loading | Short text or skeleton inside the card; buttons show disabled style |
| Empty | One sentence explaining what will appear and the action to fill it |
| Error | `.register-error` box above the form; field-level message under the field |
| Success | `.register-success` box; redirect after account actions |
| Disabled | Grey fill, `not-allowed` cursor, 70% opacity |
| Destructive action | Secondary danger button with a confirmation step |

Status vocabulary shown to users: Pending, Verified, Rejected, Additional information required, Available, Reserved, Expired, Requested, Approved, Dispatched, Received, Completed, Cancelled.

---

## 7. Accessibility checklist

- Text contrast 4.5:1 or higher (white on `#c8190b` is about 5.9:1; muted text `#6b6b72` on white is about 5.2:1).
- Every input has a visible label; errors are written text, not color only.
- `:focus-visible` shows a 3 px red ring on every interactive element.
- Status badges carry words as well as color.
- Motion is removed under `prefers-reduced-motion`.
- Tap targets are at least 40 px high; tables are scrollable by keyboard.

---

## 8. Implementation notes

- Brand tokens live in `:root` of `frontend/src/index.css`; change a color once and the whole UI follows.
- Base resets sit in `@layer base`, so Tailwind utility classes still override component styles.
- Fonts load from Google Fonts (Montserrat 500–800, Poppins 400–600) with Arial as fallback.
- Mockups for Home, Login, Donor dashboard and Matching results are in the UI Design canvas.
- Not yet designed: inventory form, transfer timeline, admin tables, doctor review screen and notification preferences.
