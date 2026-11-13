# NextAlloc Design System

**Aesthetic Direction:** Institutional Editorial Minimalism  
**Posture:** Light-first, 3-surface section rhythm, restrained NextAlloc Saffron accent, open whitespace, typographic hierarchy over card chrome.

---

## 1. Color Palette & 3-Surface Section Rhythm

All colors MUST be referenced via CSS custom properties defined in `app/frontend/src/styles/tokens.css`. Never place literal hex codes in JSX or component CSS.

### The 3-Surface Section Rhythm
Avoid boxy card-in-card grids by separating page bands with three distinct surface levels:

1. **Paper White & Warm Bone (`--na-surface: #FFFFFF` / `--na-canvas: #F7F5F0`)**  
   Primary reading and interaction surfaces: `--na-canvas` (`#F7F5F0`) is the default page ground; `--na-surface` (`#FFFFFF`) and `--na-surface-raised` (`#FDFCFA`) carry forms, primary panels, and tables.
2. **Warm Stone (`--na-stone: #F0EDE5`)**  
   Gentle secondary section band, slightly deeper than `--na-canvas`. Use for alternating editorial bands, inset summaries (`--na-well: #F0EDE7`), or secondary strips without adding heavy borders.
3. **Deep Forest Anchor (`--na-anchor: #0D201A` / `--na-anchor-2: #142B24`)**  
   High-contrast dark anchor surface for the Login brand panel, dark sidebar accent, or authoritative summary bands. Always pair with `--na-anchor-ink` (`#F7F5F0`) primary text and `--na-anchor-muted` (`#A3B8B0`) secondary text. Use `--na-anchor-2` (`#142B24`) for subtle surface separation on dark bands without borders.

### Canvas, Surface & Anchor Tokens
| Token | Hex / Value | Role |
| --- | --- | --- |
| `--na-canvas` | `#F7F5F0` | Warm bone page background across all views |
| `--na-surface` | `#FFFFFF` | Paper white — primary interactive panels, forms, tables, modals |
| `--na-surface-raised` | `#FDFCFA` | Subtle elevated surfaces (sticky headers, popovers) |
| `--na-stone` | `#F0EDE5` | Warm stone section band for gentle rhythm without boxy borders |
| `--na-well` | `#F0EDE7` | Borderless inset surface for grouping without card chrome |
| `--na-anchor` | `#0D201A` | Deep Forest Slate — high-contrast section bands, Login left panel / dark sidebar accent |
| `--na-anchor-2` | `#142B24` | Slightly lifted forest surface for subtle separation without borders |
| `--na-anchor-ink` | `#F7F5F0` | Warm stone primary text on `--na-anchor` |
| `--na-anchor-muted` | `#A3B8B0` | Secondary muted text on `--na-anchor` |

### Ink (Typography on Light Surfaces)
| Token | Hex / Value | Role |
| --- | --- | --- |
| `--na-ink-primary` | `#1A1A2E` | Headings, body copy, table data, active nav items |
| `--na-ink-secondary` | `#71717A` | Helper text, subtitles, table headers, timestamps |
| `--na-ink-tertiary` | `#A1A1AA` | Placeholders, disabled labels, subtle icons |
| `--na-ink-inverse` | `#FFFFFF` | Text on dark or filled accent buttons |

### Accent (NextAlloc Saffron) & Signal Highlight
| Token | Hex / Value | Role |
| --- | --- | --- |
| `--na-accent` | `#EE8420` | Primary CTA fills, active navigation rail, `:focus-visible` ring, key numeric highlights |
| `--na-accent-hover` | `#D96E14` | Hover and pressed state for primary CTAs |
| `--na-accent-subtle` | `#FDF4E8` | Soft background tint for active nav items or highlight pills |
| `--na-accent-ink` | `#92490A` | Accessible dark amber text placed on `--na-accent-subtle` or `--na-canvas` |
| `--na-signal` | `#DDF326` | Crisp Lime highlight — **ONLY** for small visual indicator dots/bars or fill chips paired strictly with `--na-anchor` (`#0D201A`) dark text |

### WCAG Contrast Rules
- **Saffron CTA & Text:** Reserve `--na-accent` (`#EE8420`) for primary CTA fills (`--na-ink-inverse` or `--na-ink-primary`), active nav borders, and focus rings; keep under 5% of any viewport. Whenever saffron-toned text sits on `--na-surface`, `--na-canvas`, or `--na-accent-subtle`, use `--na-accent-ink` (`#92490A`, `>= 5.4:1` contrast) rather than `#EE8420`.
- **Signal Lime (`--na-signal: #DDF326`):** Strictly for small indicator dots, progress bars, or fill chips paired with `--na-anchor` (`#0D201A`) dark text (`>= 12:1` WCAG AAA contrast). **NEVER** render `--na-signal` as text on `--na-surface` (`#FFFFFF`), `--na-canvas` (`#F7F5F0`), or `--na-stone` (`#F0EDE5`).
- **Dark Anchor Bands:** Every element on `--na-anchor` (`#0D201A`) or `--na-anchor-2` (`#142B24`) MUST swap to `--na-anchor-ink` (`#F7F5F0`, `>= 14:1`) or `--na-anchor-muted` (`#A3B8B0`, `>= 7.5:1`) — never leave zinc or charcoal grey text on a dark surface.

### Borders & Rules
| Token | Value | Role |
| --- | --- | --- |
| `--na-border-subtle` | `rgba(26, 26, 46, 0.05)` | Ultra-light table row rules and inner separators |
| `--na-border` | `rgba(26, 26, 46, 0.08)` | Hairline 1px section dividers, container edges |
| `--na-border-strong` | `rgba(26, 26, 46, 0.16)` | Input field edges, secondary button outlines, vertical metric dividers |

### Status Colors & Pill Tokens
Never communicate status by color alone; always include a text label or semantic icon.

| State | Background Token | Value | Text Token | Value | Border Token |
| --- | --- | --- | --- | --- | --- |
| Success | `--na-success-bg` (`--na-status-success-bg`) | `#ECFDF5` | `--na-success-text` (`--na-status-success-text`) | `#166534` | `--na-success-border` |
| Warning | `--na-warning-bg` (`--na-status-warning-bg`) | `#FFFBEB` | `--na-warning-text` (`--na-status-warning-text`) | `#92400E` | `--na-warning-border` |
| Error | `--na-error-bg` (`--na-status-error-bg`) | `#FFF1F2` | `--na-error-text` (`--na-status-error-text`) | `#9F1239` | `--na-error-border` |
| Info | `--na-info-bg` (`--na-status-info-bg`) | `#EFF6FF` | `--na-info-text` (`--na-status-info-text`) | `#1E40AF` | `--na-info-border` |
| Neutral | `--na-neutral-bg` (`--na-status-neutral-bg`) | `#F0EDE5` | `--na-neutral-text` (`--na-status-neutral-text`) | `#1A1A2E` | `--na-neutral-border` |

---

## 2. Typography Scale

**Font Families:**
- `--na-font-sans`: `'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif` (Primary UI & body)
- `--na-font-display`: `'Sora Variable', Sora, 'Inter Variable', Inter, system-ui, sans-serif` (Hero/brand display moments only)
- `--na-font-mono`: `'JetBrains Mono', ui-monospace, 'Cascadia Code', 'Fira Code', monospace` (IDs, hashes in detail drawers, code, measurements)

**Weight Discipline:** Use at most three weights across the product: `400` (regular body), `500` (medium labels/nav), and `600` (semi-bold headings/CTAs; `700` reserved for display numerals). Never synthesize bold/italic (`font-synthesis: none`).

**Case Discipline:** Sentence case everywhere. No uppercase tracked eyebrows or uppercase table headers.

| Role | Token | Size | Line Height | Weight | Usage |
| --- | --- | --- | --- | --- | --- |
| Display | `--na-text-display` | `40px` (`2.5rem`) | `1.2` | `700` | Large metric headlines, brand display |
| Heading 1 | `--na-text-h1` | `28px` (`1.75rem`) | `1.2` | `600` | Page title (one per view) |
| Heading 2 | `--na-text-h2` | `22px` (`1.375rem`) | `1.2` | `600` | Major section heading |
| Heading 3 | `--na-text-h3` | `18px` (`1.125rem`) | `1.2` | `600` | Subsection or dialog title |
| Heading 4 | `--na-text-h4` | `16px` (`1rem`) | `1.3` | `500` | Compact panel or group title |
| Body Lg | `--na-text-body-lg` | `16px` (`1rem`) | `1.5` | `400` | Lead sentences, prominent descriptions |
| Body Md | `--na-text-body-md` | `15px` (`0.9375rem`) | `1.5` | `400` | Standard prose, form controls |
| Body Sm | `--na-text-body-sm` | `14px` (`0.875rem`) | `1.5` | `400–500` | Table cells, nav items, secondary copy |
| Caption | `--na-text-caption` | `13px` (`0.8125rem`) | `1.4` | `400–500` | Field labels, table heads, metadata, timestamps |
| Mono | `--na-text-mono` | `14px` (`0.875rem`) | `1.4` | `400` | Tabular figures, run IDs, code |

**Numerals:** Apply `.tabular-nums` (`font-variant-numeric: tabular-nums`) to every number in tables, metric rows, scores, dates, and pagination counts.

---

## 3. Spacing Philosophy

Based on a strict 4px grid via `--na-space-1` (`4px`) through `--na-space-16` (`160px`):
`4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160px`.

- **Surface Ladder:** Prefer whitespace first, then a 1px `--na-border` hairline divider, then a borderless `--na-stone` / `--na-well` band, and only then a `--na-surface` card when items are independently interactive.
- **Section Separation:** Separate major sections by `--na-space-8` (`40px`) or `--na-space-9` (`48px`), a surface step (`--na-canvas` → `--na-stone` → `--na-anchor`), or a full-width `.na-divider` (`1px solid var(--na-border)`).
- **Internal Padding:** Keep card/panel padding at `--na-space-6` (`24px`) on desktop and `--na-space-4` (`16px`) on mobile.
- **Sibling Gaps:** Use `gap` in flex/grid containers (`--na-space-3` to `--na-space-6`), never ad-hoc margins on individual children.

---

## 4. Component Rules

### Navigation (`Shell`)
- **Desktop (`>=1024px`):** Persistent `240px` left sidebar (`--na-surface` with `1px solid var(--na-border)` right border, or `--na-anchor` dark forest rail with `--na-anchor-ink` text), logo at top, navigation links in middle, role pill and truncated user name in footer.
- **Tablet (`768px–1023px`):** Collapsed `64px` icon-only rail with accessible hover/focus tooltips (`0ms` focus delay).
- **Mobile (`<768px`):** Top bar with hamburger button (`44x44px` hit target); sidebar slides in as a drawer over a backdrop (`z-index: var(--na-z-modal)`).
- **Active Item:** `3px` left border in `--na-accent` + `--na-accent-subtle` background fill (or `--na-anchor-2` on dark rail), weight `500`.
- **Hover:** `background-color` transition (`150ms`), never `transition: all`.

### Page Headers
- Left-aligned `<h1>` (`--na-text-h1`, sentence case) paired with at most one line of contextual metadata (cohort period or last updated timestamp in `--na-ink-secondary`, `--na-text-caption`).
- Place primary page action (if any) right-aligned on desktop, stacking cleanly below the title on mobile.
- No eyebrow labels above `<h1>`.

### Tables
- Full-width `--na-surface` or directly on `--na-canvas` with horizontal `1px solid var(--na-border-subtle)` / `--na-border` row dividers only (no outer heavy box, no vertical cell borders).
- Column headers (`<th>`): `--na-text-caption` (`13px`), weight `500`, `--na-ink-secondary`, sentence case, `white-space: nowrap`.
- All numeric/count/date columns use `.tabular-nums` and right-align where appropriate for comparison.
- On mobile (`<768px`), allow horizontal scroll within a `min-w-0` wrapper or stack key row title + primary action cleanly.

### Forms & Inputs
- Visible `<label>` above every field (`--na-text-caption`, weight `500`, `--na-ink-primary`), never placeholder-only.
- Constant `1px solid var(--na-border-strong)` border, `--na-radius-md` (`6px`), `--na-surface` background, `40px` height (`44px` touch target on mobile; `16px` font-size on mobile to prevent iOS zoom).
- Focus uses `outline: 2px solid var(--na-accent); outline-offset: -1px;` — never mutate border width on focus.
- Disabled state sets `opacity: 0.55`, `cursor: not-allowed`, and native `disabled` attribute together.
- Reserve `min-height: 1.4em` below inputs for inline validation errors (`--na-error-text`).

### Buttons
- **Primary:** `--na-accent` background, `--na-ink-inverse` text, `--na-radius-md` (`6px`), hover `--na-accent-hover`. **Maximum one filled primary button per view/dialog.**
- **Secondary:** `--na-surface` background, `1px solid var(--na-border-strong)`, `--na-ink-primary` text.
- **Ghost:** Transparent background, `--na-ink-primary` text, subtle `--na-stone` fill on hover.
- **Danger:** `--na-error-bg` fill, `--na-error-text` text, `1px solid var(--na-error-border)`.
- Explicit `type="button"` or `type="submit"` on every `<button>`. Labels use concise action verbs in sentence case; keep icons as separate SVG elements rather than literal text arrows.

### Status Badges
- Slim inline pills (`--na-radius-sm` `4px` or pill), `--na-text-caption` (`12–13px`), weight `500`, sentence case.
- Use `--na-status-{state}-bg`, `--na-status-{state}-text`, and `1px solid var(--na-status-{state}-border)`.
- Display at most 2 status badges per card/row to prevent visual clutter.
- Use exact status strings returned by the backend API; never invent statuses or decorative pulsing dots.

### Dialogs / Modals
- Surface `--na-surface`, `--na-radius-lg` (`8px`), `--na-shadow-md`, `z-index: var(--na-z-modal)`.
- Backdrop: `rgba(26, 26, 46, 0.35)` with instant or `150ms` opacity fade.
- Close via `Escape`, close button (`aria-label="Close"`), or backdrop click; trap focus and restore focus on close.

### Charts
- Limit chart palette to `--na-ink-primary` (`#1A1A2E`), `--na-accent` (`#EE8420`), `--na-anchor` (`#0D201A`), `--na-ink-secondary` (`#71717A`), and `--na-success-text` / `--na-info-text` for multi-series distinction.
- Hairline gridlines in `--na-border`; axis labels in `--na-text-caption` `--na-ink-secondary` with `.tabular-nums`.
- Show real empty state (`"No data available for this period"`) when series are empty—never render placeholder numbers.

### Empty States
- State what is empty, why it matters, and provide at most one next action (if applicable).
- Set cleanly in typography inside `--na-stone` / `--na-well` or centered over whitespace; no giant decorative SVG illustrations.

---

## 5. Motion Budget

- **Allowed Properties:** `transform`, `opacity`, and explicit `color` / `background-color` / `border-color` only.
- **Forbidden:** `transition: all`, layout animations (`width`, `height`, `top`, `left`, `margin`, `padding`), bounce/spring overshoots, infinite pulsing dots, or floating blurs.
- **Timings:**
  - Micro interactions (hover, press): `--na-duration-fast` (`150ms`) with `--na-easing-standard` (`cubic-bezier(0.16, 1, 0.3, 1)`).
  - Drawers, panels, modals: `--na-duration-base` (`200ms`) with `--na-easing-standard`.
- **Reduced Motion:** `base.css` enforces `@media (prefers-reduced-motion: reduce)` globally to collapse transitions and animations to `0.01ms`.

---

## 6. Responsive Breakpoints

| Breakpoint | Target | Layout Behavior |
| --- | --- | --- |
| `360px` | Small mobile | Single column, `16px` gutter, hamburger drawer nav, stacked forms & actions |
| `390px` | Standard mobile | Single column, `16px` gutter, `16px` minimum input font size |
| `768px` | Tablet | `64px` collapsed icon-only sidebar rail, `24px` container padding, 2-col grids where appropriate |
| `1024px` | Small desktop | `240px` persistent sidebar, 12-col content grid |
| `1280px` | Standard desktop | Max-width `1280px` content container, `32px` container padding |
| `1440px` | Wide desktop | Content container holds at `1280px` centered; gutters expand naturally |

---

## 7. Anti-Patterns (Explicitly Forbidden)

- **No nested bordered cards (card-in-card).** Maximum one containment boundary per item.
- **No `border` + wide soft `shadow` together** on the same element.
- **No uppercase tracked eyebrows** (`text-xs uppercase tracking-widest`) above headings or table headers.
- **No middle-dot separator chains** (`A · B · C`) or decorative pulsing dots.
- **No invented metrics, fake percentages, or placeholder counts.** Show `"—"` when real API data is absent.
- **No fake security/institutional jargon** (e.g., `"National Production Node"`, `"Cryptographic Authority"`, `"Federal SSO Gateway"`).
- **No cryptographic hashes or solver internals (`CP-SAT`, `MIP`) on primary user dashboards**—keep technical metadata behind expandable `"View details"` disclosures or dedicated admin technical views.
- **No emoji icons** (use `lucide-react` for UI icons).
- **No `--na-signal` (`#DDF326`) lime text on white or warm bone backgrounds** (strictly dark `--na-anchor` `#0D201A` text on lime chips/dots).
- **No purple-to-blue gradients or neon dark-mode glassmorphism.**

---

## 8. Hallmark Floor Compliance Checklist

- [ ] **Rule 1 (Tokens):** All colors, fonts, spacing, radii, and z-indices reference `--na-*` CSS tokens from `tokens.css`.
- [ ] **Rule 2 (Motion):** Never use `transition: all`; animate `transform`, `opacity`, or specific color properties only.
- [ ] **Rule 3 (Containment):** Zero card-in-card nesting; never combine border and wide shadow on one surface.
- [ ] **Rule 4 (Overflow):** `overflow-x: clip` set on `html` and `body`; zero horizontal scroll from `320px` to `1920px`; no `100vw`.
- [ ] **Rule 5 (Density & Copy):** Sentence case everywhere; no uppercase tracked labels/eyebrows; no middle-dot chains; no invented numbers.
- [ ] **Rule 6 (Focus):** `:focus-visible` instant `2px` offset ring in `--na-accent` on every interactive element.
- [ ] **Rule 7 (Reduced Motion):** `@media (prefers-reduced-motion: reduce)` disables all transitions and animations.
- [ ] **Rule 8 (Contrast & Type):** Body text `>= 15px` (`16px` on mobile inputs), labels `>= 13px`, WCAG AA contrast (`>= 4.5:1` body, `>= 3:1` UI edges), `.tabular-nums` on all numeric data.
- [ ] **Rule 9 (Controls):** One filled primary button per page/dialog; `44px` minimum touch target on mobile; explicit `type` on every `<button>`.
- [ ] **Gate 20 (Stamp):** Hallmark stamp comment present on Line 1 of `tokens.css` and `base.css`.
