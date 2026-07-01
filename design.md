# Blueprint

## Overview

Blueprint is Endian's design system — inspired by the [Blueprint theme](https://syedhamzazaidi.github.io) from the Paper portfolio (`../code/syedhamzazaidi.github.io`). The aesthetic treats every surface like a technical document: a narrow reading column on a grid field, monospace labels, dashed annotation frames, and sky-blue accents that read as instrumentation rather than decoration.

Prioritize clarity and scanability over visual noise. Hierarchy comes from typography role (sans for prose, mono for structure), left-edge accent bars, and translucent borders — not from heavy shadows or saturated fills. Color signals structure, state, and links; the grid signals precision.

This is the default theme. Token names are shared CSS custom properties so platform UI, the builder, and generated scaffolds can stay aligned. Source reference: `styles/base.css` and `styles/themes/blueprint.css` in the portfolio repo.

## Colors

Blueprint uses semantic tokens, not a numeric gray scale. Each name encodes role on the page:

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#102a43` | Page background; grid field |
| `--color-surface` | `rgba(15, 42, 67, 0.92)` | Primary paper column, cards, panels |
| `--color-surface-muted` | `rgba(12, 36, 58, 0.88)` | Aside cards, annotation frames |
| `--color-text` | `#dbeafe` | Body copy |
| `--color-title` | `#ffffff` | Page titles, hero headlines |
| `--color-heading` | `#93c5fd` | Section headings, labels |
| `--color-muted` | `#bad7f5` | Secondary prose, org names, dates |
| `--color-meta` | `#7dd3fc` | Metadata strip, REF tags, timestamps |
| `--color-accent` | `#38bdf8` | Accent bars, links on hover, focus, connectors |
| `--color-link` | `#bfdbfe` | Inline links |
| `--color-rule` | `rgba(191, 219, 254, 0.34)` | Horizontal rules, table borders, section underlines |

**Grid overlays** layer on top of surfaces — never replace them:

- Page grid: `rgba(147, 197, 253, 0.12)` lines at **24×24px**
- Card grid: same color at **12×12px** inside aside frames and diagrams

**Border variants:**

- Solid panel: `rgba(191, 219, 254, 0.32)` — paper edge, viewport frames
- Dashed annotation: `rgba(56, 189, 248, 0.55)` — margin callouts, note cards
- Connector stroke: `rgba(56, 189, 248, 0.78)` dashed `4 3` — leader lines to asides

**State colors** (Endian extensions — use sparingly):

| Role | Color | Use |
| --- | --- | --- |
| Success | `#4ade80` | Build passed, block activated |
| Warning | `#fbbf24` | Stub block, pending migration |
| Error | `#f87171` | Build failed, validation error |
| Info | `#38bdf8` | Same as accent; links, focus, active step |

Hold **WCAG AA** (4.5:1) for body text on `--color-surface`. `--color-muted` is for secondary content only, never primary actions.

## Typography

Two families, four roles:

| Role | Family | Use |
| --- | --- | --- |
| `--font-body` | **DM Sans** | Prose, buttons, navigation |
| `--font-title` | **DM Sans** | Titles, hero lines |
| `--font-heading` | **DM Mono** | Section headings, eyebrows, REF tags |
| `--font-meta` | **DM Mono** | Dates, IDs, code paths, table headers |
| `--font-mono` | **DM Mono** | Inline code, skills, terminal output |

Load from Google Fonts:

```
DM Sans: 400, 500, 600, 700
DM Mono: 400, 500, 700
```

**Scale** (Blueprint defaults):

| Token | Size | Weight | Line height | Notes |
| --- | --- | --- | --- | --- |
| Title | `2.1rem` | 700 | 1.25 | Left-aligned; `--color-title` |
| Section heading | `0.82rem` | 700 | 1.2 | Uppercase, `letter-spacing: 0.14em`; underline rule below |
| Body | `1rem` | 400 | 1.58 | Default reading size |
| Subsection title | `1rem` | 600 | 1.4 | Role / job title |
| Meta / date | `0.85rem` | 400–500 | 1.45 | Mono; `--color-meta` or `--color-muted` |
| Aside label | `0.68rem` | 700 | 1.2 | Uppercase, `letter-spacing: 0.12em` |
| Aside body | `0.72–0.78rem` | 400 | 1.4–1.45 | Compact annotation copy |
| REF tag | `0.55rem` | 500 | 1 | Uppercase, `letter-spacing: 0.08em` |

Section headings (`h2`) always use mono, uppercase, and a bottom rule — they are structural markers, not marketing display type. Prefer **two weights per view** (400 body + 600/700 emphasis).

## Layout

Blueprint centers content in a **paper column** — a single authoritative reading width surrounded by optional margin gutters.

| Token | Value | Role |
| --- | --- | --- |
| `--paper-width` | `760px` | Main column max-width |
| `--paper-padding-x` | `1.5rem` | Horizontal inset (mobile: `1.25rem`) |
| `--paper-padding-y` | `3rem` | Vertical inset (mobile: `2rem`) |
| `--section-gap` | `2.15rem` | Space between major sections |
| `--margin-aside-width` | `11.5rem` | Width of floated annotation cards |
| `--margin-aside-gap` | `2.75rem` | Gap between column and aside |

**Spacing scale** (4px base): 4, 8, 12, 16, 24, 32, 48, 64, 96px.

Rhythm: **8px** inside a group (list items, form fields), **16–24px** between groups, **32–48px** between sections.

**Breakpoints:**

| Name | Width | Behavior |
| --- | --- | --- |
| `sm` | 600px | Stack subsection headers; tighten paper padding |
| `md` | 768px | Hide secondary nav links on platform |
| `lg` | 960px | Two-column builder layout |
| `xl` | 1180px | Margin asides float outside paper column; REF connectors appear |
| `2xl` | 1200px | Max marketing content width |

At **≥1180px**, annotated subsections (`paper-subsection--annotated`) may attach aside cards to the left or right gutter with dashed SVG leader lines. Below that width, asides stack inline — never clip or hide their content.

**Grid field:** the page body carries a 24px grid. Cards and asides carry a finer 12px grid. Do not remove the field grid on marketing pages; it anchors the engineering-document feel.

## Elevation & Depth

Blueprint prefers **tonal separation and borders** over drop shadows.

| Level | Treatment |
| --- | --- |
| Page | Grid field on `--color-bg`; no shadow |
| Paper / card | `--color-surface` fill + `1px solid rgba(191, 219, 254, 0.32)` |
| Aside / annotation | Dashed border + inset `box-shadow: inset 0 0 0 1px rgba(191, 219, 254, 0.08)` + 12px grid |
| Elevated panel (builder chrome) | `#252526`-style dark panel optional; `0 8px 32px rgba(0, 0, 0, 0.5)` only when simulating an app window |
| Popover / menu | Same as card + `0 4px 16px rgba(0, 0, 0, 0.25)` |

**Corner brackets** on annotation frames: `0.55rem` L-shaped borders at top-left and bottom-right (`rgba(56, 189, 248, 0.7)`). Use on aside cards and diagram viewports — not on every card.

Shadows are the exception. When in doubt, add a border.

## Motion

Motion clarifies state change or draws attention to live data — never decorates idle screens.

| Interaction | Duration | Easing |
| --- | --- | --- |
| Theme / color transition | `300ms` | `ease` |
| Hover border / background | `150ms` | `ease-out` |
| Scan line / live diagram | `2.8–11s` | `ease-in-out`, infinite |
| Page reveal (marketing) | `400ms` | `cubic-bezier(0.16, 1, 0.3, 1)` |

**Live diagrams** (e.g. face-scan viewport): slow orbital rotation (`11s`) and horizontal scan sweep (`2.8s`). These are the only acceptable looping animations.

Honor `prefers-reduced-motion`: freeze loops, disable mesh drift, set reveal opacity to 1 with no transform.

Default UI feedback should feel **instant**. A duration of `0ms` is often correct for buttons and toggles.

## Shapes

| Element | Radius | Border |
| --- | --- | --- |
| Paper column | `0` | Solid 1px |
| Subsection block | `0` | `3px solid` left accent bar in `--color-accent` |
| Aside / annotation card | `0` | Dashed 1px + corner brackets |
| Buttons (platform) | `999px` pill or `6px` | Solid or translucent |
| Inputs | `6px` | Solid translucent |
| Builder window chrome | `8px` | Solid 1px |

Reserve **999px** for pills (step nodes, tags, primary CTAs). Do not mix sharp paper corners with large rounded cards in the same view — pick one family per surface type.

**Connectors:** dashed SVG paths with round caps, open-circle endpoints, and small arrow ticks at the destination. Color: `rgba(56, 189, 248, 0.78)`.

## Components

Tokens below map to CSS classes in the portfolio and to Endian surfaces.

### Paper column

The primary content container. Max-width `--paper-width`, centered, `--color-surface` background, solid border. Used for: resume sections, long-form docs, narrow marketing prose blocks.

### Section (`paper-section`)

Mono uppercase heading with bottom rule. Gap below heading: `0.55rem`. Section margin-bottom: `--section-gap`.

### Subsection (`paper-subsection`)

Left accent bar (`3px solid --color-accent`), `1rem` padding-left. Header row: title + org on the left, date in mono on the right. Lists at `0.875rem`, tight line-height (`1.48`).

### Aside card (`paper-aside-card`)

Annotation frame for context that should not interrupt the main column.

- Label: mono, uppercase, `--color-accent`
- Body: `0.72–0.78rem`
- List bullets: `▸` prefix in accent color
- At `≥1180px`: float into margin with REF tag + connector

### REF callout

Tag format: `REF·A`, `REF·B`, … Mono, uppercase, bordered pill on `--color-surface-muted`. Connector: dashed horizontal leader from subsection to aside.

### Metadata strip (`paper-meta`)

Top-of-page context row. Mono, `--color-meta`, `0.8rem`. Flex row, space-between, wraps on narrow screens.

### Buttons

| Variant | Background | Text | Border |
| --- | --- | --- | --- |
| Primary | `--color-accent` | `#102a43` | none |
| Secondary | transparent | `--color-text` | `1px solid rgba(191, 219, 254, 0.32)` |
| Ghost | transparent | `--color-link` | none; underline on hover |

Heights: 32px compact, 40px default, 48px hero. Focus: `outline: 2px solid --color-accent; outline-offset: 2px`.

### Inputs

`--color-surface-muted` fill, `1px solid rgba(191, 219, 254, 0.32)`, 6px radius, DM Sans body. Placeholder in `--color-muted`.

### Pipeline / step nodes (agent loop)

Horizontal step pills: mono step number (`01`–`05`) in accent + sans label. Forward arrows in accent. Feedback loop: text caption or connector — keep it minimal; do not overpower the row.

### Builder chrome

Three-panel layout: project tree · chat · preview. Optional window chrome bar (mono, `#323233` background). Preview panel carries `--color-surface` with a `--color-accent` label.

### Block status badges

| State | Style |
| --- | --- |
| `enabled` | Solid accent pill |
| `stub` | Dashed border, `--color-warning` text |
| `disabled` | `--color-muted`, no border |

## Voice & Content

Copy follows the document metaphor — precise, scannable, no filler.

- **Section labels** are uppercase mono markers: `EXPERIENCE`, `THE AGENT LOOP`, `RUNTIME ARCHITECTURE`.
- **Annotations** use sentence case in aside cards; labels are single words: `Note`, `Awards`, `REF·A`.
- **Buttons** use verb + noun: `Open Builder`, `Start building`, `Deploy Project` — never `Submit`, `OK`, or bare verbs.
- **Errors** state what happened and what to do next: `Build failed. Fix TypeScript errors in src/pages/PlantsPage.tsx and retry.`
- **Empty states** name the first action: `No analyses yet. Upload a plant photo to run your first check.`
- **In-progress** uses present participle + ellipsis: `Deploying…`, `Analyzing…`
- Use numerals (`5 steps`, `16 blocks`), curly quotes, and the `…` character. Skip `please` and superlatives.

Platform marketing may use slightly longer prose than the resume, but section headings stay structural — not slogan lines.

## Do's and Don'ts

**Do**

- Use DM Sans for reading and DM Mono for anything structural (labels, dates, code, REF tags).
- Keep the paper column narrow; let the grid field breathe on wide screens.
- Use left accent bars and dashed frames to mark annotated or secondary content.
- Float margin asides only at `≥1180px`; stack them inline below that.
- Pair state color with text or an icon — never color alone.
- Show `:focus-visible` rings on every interactive element.
- Apply tokens via CSS custom properties; do not hardcode hex in components.

**Don't**

- Do not use heavy gradients or neon glow as the primary hierarchy tool (subtle mesh on hero only).
- Do not mix Instrument Sans / green-accent landing tokens with Blueprint in the same view — migrate platform UI to these tokens.
- Do not put corner brackets on every card; reserve them for annotations and diagrams.
- Do not use `--color-muted` for primary actions or critical warnings.
- Do not animate loops on static content pages.
- Do not exceed two font weights in a single component.
- Do not use drop shadows when a 1px border suffices.

## Adoption in Endian

| Surface | Status | Notes |
| --- | --- | --- |
| Portfolio reference | Canonical | `syedhamzazaidi.github.io` — Blueprint theme |
| Platform landing | Migrate | Replace `--accent: #22c55e` / Instrument Sans with Blueprint tokens |
| Builder UI | Migrate | Align chrome, panels, and step labels to paper + mono pattern |
| Generated scaffold | Partial | shadcn/Tailwind; map Tailwind theme to Blueprint tokens in `tailwind.config` |

**Quick start** — add to any Endian CSS entry point:

```css
:root {
  --font-body: "DM Sans", system-ui, sans-serif;
  --font-title: "DM Sans", system-ui, sans-serif;
  --font-heading: "DM Mono", ui-monospace, monospace;
  --font-meta: "DM Mono", ui-monospace, monospace;
  --font-mono: "DM Mono", ui-monospace, monospace;

  --color-bg: #102a43;
  --color-surface: rgba(15, 42, 67, 0.92);
  --color-surface-muted: rgba(12, 36, 58, 0.88);
  --color-text: #dbeafe;
  --color-title: #ffffff;
  --color-heading: #93c5fd;
  --color-muted: #bad7f5;
  --color-meta: #7dd3fc;
  --color-accent: #38bdf8;
  --color-link: #bfdbfe;
  --color-rule: rgba(191, 219, 254, 0.34);

  --paper-width: 760px;
  --section-gap: 2.15rem;
}
```

## Alternate themes

The portfolio ships six additional themes (arXiv, Brutalist, Editor, Newspaper, Swiss, Terminal) under `styles/themes/`. They share `base.css` layout tokens but swap palettes and type. **Blueprint is the Endian default.** Other themes are useful for demos or user preference in exported scaffolds — not for core platform chrome.
