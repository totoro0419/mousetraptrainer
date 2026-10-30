# Mousetrap Trainer — Luminous Minimalism Design System v2

Status: **implemented in PR #1; source and CI verified; device visual QA pending**  
Scope: Home / Script / Cloze rehearsal / Audio rehearsal / Bottom sheets / Settings / Navigation / Scroll stick  
Baseline: the default-branch files inspected on 2026-10-30. A QA pass is mandatory before adopting.

## 0. Product principle

**Bright, spatial, precise.** Create premium quality through white surfaces, restrained directional highlights, layered soft shadows, smooth motion, and exact type/spacing. Do not fake sophistication using serif fonts, decorative containers, "YOU" badges, random icons, pills, or color blocks. This is a script reader and rehearsal tool, not a theatrical poster.

Hard constraints:
- Light-only UI in this design release; no dark home and no sepia/ivory/amber palette.
- Sans-serif for *all* Latin and Japanese text, script included. No Georgia, Times New Roman, Mincho, serif, or text shadows.
- No "YOU" label, avatar/monogram, badge, outlined/chip-style speaker label, or redundant explanatory eyebrow text.
- Every scene/speech row remains full width, separated by 1px hairline; **no cards around individual speeches**.
- Selected own character is shown through the speaker's name and restrained accent, never a big colored rectangle.
- Scroll stick remains **one translucent circular disk only**: no icon, knob, ring, explanation, background dock, or tooltip in the visible UI.
- Tappable vocabulary and phrases must be visibly distinguishable from plain text.
- Keep all current functions and user data semantics intact; styling is not permission to remove search, filters, rehearsal, selection, save, or accessibility.

## 1. Visual foundation

### 1.1 Color tokens

| CSS token | Value | Usage |
|---|---|---|
| --ui-canvas | #F7F9FD | app canvas behind surfaces |
| --ui-surface | #FFFFFF | page and speech background |
| --ui-surface-raised | #FFFFFF | raised controls, trays, sheets |
| --ui-text | #152238 | primary text |
| --ui-text-secondary | #64748B | secondary labels (4.76:1 on white) |
| --ui-text-tertiary | #66758A | tertiary where it meets contrast needs |
| --ui-line | #E7ECF3 | hairlines |
| --ui-accent | #4568DF | links, role name, controlled emphasis (4.89:1 on white) |
| --ui-accent-pressed | #3656CE | pressed/active state |
| --ui-accent-wash | #F3F6FF | interaction tint, not an own-speech card |
| --ui-focus | #3155D5 | focus ring |
| --ui-success | #26735E | memorized status |
| --ui-review | #985C22 | review status |
| --ui-danger | #AE3D40 | destructive/error affordance |

The primary button uses a modest **vertical highlight gradient** from #4568DF to #3B5DDD; **no broad saturated gradients elsewhere**. App-background ambient glow may appear only in the *home hero*, opacity capped at 0.12; it must not cover script text.

### 1.2 Radius and spacing

Base unit 4px. Spacing steps: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px.

- Hairline / full-width script rows: 0px radius.
- Small icon button: 10px radius.
- Text input / select: 12px radius.
- Primary CTA / secondary CTA: 13px radius.
- Floating toolbar: 16px radius.
- Sheets: 20px top corners.
- Never apply 999px capsule radius to labels or speaker names.

### 1.3 Elevation + highlights

Lighting direction: upper-left. Surface contrast primarily comes from **white specular edge + two soft shadows**, not from thick gray strokes.

Levels (CSS-ready):

~~~css
:root {
  --ui-canvas: #f7f9fd;
  --ui-surface: #fff;
  --ui-surface-raised: #fff;
  --ui-text: #152238;
  --ui-text-secondary: #64748b;
  --ui-text-tertiary: #66758a;
  --ui-line: #e7ecf3;
  --ui-accent: #4568df;
  --ui-accent-pressed: #3656ce;
  --ui-accent-wash: #f3f6ff;
  --ui-focus: #3155d5;
  --ui-success: #26735e;
  --ui-review: #985c22;
  --ui-danger: #ae3d40;
  --ui-shadow-0: none;
  --ui-shadow-1: 0 2px 6px rgba(28, 50, 95, .045),
                 0 8px 18px rgba(28, 50, 95, .055);
  --ui-shadow-2: 0 6px 14px rgba(28, 50, 95, .07),
                 0 20px 44px rgba(28, 50, 95, .09);
  --ui-shadow-3: 0 12px 32px rgba(28, 50, 95, .12),
                 0 34px 72px rgba(28, 50, 95, .10);
  --ui-specular: inset 0 1px 0 rgba(255, 255, 255, .94);
  --ui-ease: cubic-bezier(.22, 1, .36, 1);
  color-scheme: light;
  font-family: Inter, "Segoe UI", "Noto Sans JP", system-ui, sans-serif;
}
~~~

- Level 0: script rows, speaker names, inline links, settings rows — **no shadows**.
- Level 1: home primary/secondary buttons, select control when appropriate.
- Level 2: floating top/bottom toolbars, popup menus.
- Level 3: modal bottom sheet only.
- Active states: button goes down by 1px and loses some shadow. Do not animate shadows on every speech row.
- Preserve translucent bright top edge only on physically raised objects.
- Never use text shadows, glassy text, glowing letter outlines, or gradient fills on a speech line.

### 1.4 Typography

Latin: Inter with system-ui fallback; Japanese: Noto Sans JP / system sans fallbacks. No remote font/CDN requirement: system fallback must look correct offline. Font weights restricted to 400, 500, 600, 650/700 where variable weight is available.

| Element | Desktop | Mobile | Weight / line |
|---|---|---|---|
| Home title | 40px / 1.15 | 32px / 1.18 | 650 |
| Page heading | 24px / 1.25 | 20px / 1.25 | 650 |
| Speaker | 12px / 1.4 | 11px / 1.4 | 650, normal tracking |
| English script | user setting 16–32px; default 20px | same | 400, current line-height setting preserved |
| Japanese direction | 12px / 1.55 | 11.5px / 1.55 | 400 |
| Body | 15px / 1.65 | 14px / 1.65 | 400 |
| Secondary / caption | 12–13px / 1.5 | 12px / 1.5 | 500 |
| Button | 15px / 1.2 | 14px / 1.2 | 600 |

No needless letterspacing on speaker names; no uppercase English "eyebrow" above each content block. Ensure sensible line breaks with overflow-wrap:anywhere for long script tokens.

## 2. Screen composition

### Home

- Entire app remains light. Header height 58–64px; minimal brand at left, settings only at right. Do not repeat an oversized logo or title in multiple toolbars.
- Center content width 640–720px on desktop; mobile horizontal padding 22–24px, tablet 32px. Hero top margin 52–72px desktop, 36–44px mobile.
- Heading: **The Mousetrap** in bold sans, one primary title. One subtle line indicating where to resume; hide when empty. No "YOUR WORKSPACE" / editorial section marker.
- Character selector: one ordinary **text row**, "自分の役" left, chosen role right with chevron. Top and bottom 1px separators. No white card, avatar, colored box, or monogram.
- Action: large raised **台本を読む / 続きから読む** gradient CTA (height 54–56px); adjacent secondary **稽古する** button with white finish and softer shadow on large layouts, full width stacked on mobile.
- Progress: collapse by default and display a compact text count, not an infographic card. Scenes: flat list with hairline separators and tiny chevrons; no number badges.
- The full-screen home may use one diffuse blue ambient glow near the upper-right perimeter. Nothing floating behind text.

### Script reader

- **Full-bleed white script rows**. Scroll area fills width; do not reimpose the old 790px wrapper. Text inner padding: mobile 20px, tablet 28px, desktop 36px. English lines may use max-width: 92ch for readability on wide desktop while the row/hairline spans full width.
- Sticky reader toolbar (height ~58px) can have translucent white surface, 1px hairline and shadow-1 after scrolling. Keep role switcher/search/scene/type actions, but let icons be unboxed until hover/focus.
- Speech article: no outer margin/radius/shadow/border-left by default. Border-bottom: 1px solid --ui-line. Vertical padding 18px top / 22px bottom mobile; 20px / 26px desktop.
- Speaker: normal plain text; **mine** has accent text color + 650 weight. Others have secondary color + 600 weight. **No "YOU" badge** and no colored block around the row.
- Current/selected speech only: near-white blue wash, e.g. linear-gradient(90deg,rgba(69,104,223,.055),transparent 65%), with a narrow 2px accent inset on the leading edge **only when currently selected**. The user's other speeches remain pure white.
- Directions: Japanese short summary only in muted 11.5–12px plain text, tight margins. Tap to see original English in sheet. No "Stage direction" label or informational frame.
- Clickable vocab/phrases: keep ink text color, use 1px **dotted** underline color rgba(69,104,223,.72), text underline offset .17em. Hover/focus adds a subtle blue wash and accent text color; no words as inline rectangular cards. Non-clickable text has no underline and no button semantics. Preserve existing conditional vocabulary lookup.
- Analysis: unobtrusive "more" control aligned right; preserve click/swipe semantics and progress state. No major reordering in this design iteration.
- Status: tiny accessible progress indicator; optional on demand, not repeated large labels.

### Rehearsal

- Cloze view uses the same full-width speech row geometry. The masked answer is a clean line with "タップして正解を表示" secondary text; no dashed beige rectangle. Reveal changes content, not the width of the article.
- Current line gets the same selected-row wash as the reader. Future and previous speech use text hierarchy, not blanket opacity that harms readability.
- Audio view: one large speaker name and one central message, **no giant decorative circular audio icon**. Current stage remains light, with one balanced central content column and a persistent action tray.
- Bottom controls: elevated, light tray separated from script by a soft top shadow + hairline. The key button has gradient/specular/shadow-1; secondary actions are calm and readable.
- Completion state: title, small progress sentence, two buttons; no celebration illustration or decorative card.

### Sheets & settings

- Bottom sheet: #FFFFFF, top radius 20px, shadow-3, soft neutral scrim rgba(20,32,58,.25), top handle only if interactive; no strong blur behind text.
- Group sections with spacing and one hairline; remove decorative uppercase categories and duplicate captions. Dictionary title is sans 26px/650; English original text in normal sans.
- Role picker: single-choice list rows, hairline separators, selected row indicated with text color and check at trailing edge. No boxed role chips/cards.
- Settings: one text row per setting, no independent floating cards; form controls may use shadow-1 sparingly.

### Navigation & stick

- Desktop: slim sidebar if it exists in current shell; subtle white surface and 1px right border. Mobile: bottom navigation 62–68px incl. safe area; a **single elevated translucent surface** with top hairline/shadow. Active state = icon and label contrast; no oversized filled capsule.
- Stick: one 62×62px circle, background rgba(115,136,172,.22), faint white rim, shadow 0 6px 18px rgba(29,54,98,.09). No icon, central dot, outer dock, text or second disc. Drag remains hardware-accelerated transform only; existing speed and double-flick navigation remain untouched. Soften on idle, darken translucent fill during drag.

## 3. Interaction states

| Element | Default | Hover / focus | Pressed / selected | Disabled |
|---|---|---|---|---|
| Primary CTA | 54px, gradient, shadow-1, highlight | 10–15% stronger shadow; 2px focus ring | translateY(1px), darker gradient | reduced contrast but still legible |
| Secondary CTA | white, subtle line, shadow-1 | slight blue-gray tint | shadow-0 | reduced contrast |
| Role selector | flat text row | light background tint, focus outline on actionable row | selected choice check at end | not applicable |
| Speech row | white, thin rule | no broad elevation; subtle only on deliberate hover | selected wash and 2px leading inset | not applicable |
| Word button | dotted underline | accent text + underline + faint tint | slightly stronger tint | if no meaning: plain non-button |
| Toolbar icon | neutral ink on transparent | 38–44px hit box with hover wash | slightly darker, no badge | faded |
| Sheet | raised surface | not applicable | 180–240ms entrance | not applicable |

Touch targets >= 44×44 CSS px for primary navigational controls; inline vocabulary words use natural line-height and may have invisible hit area without changing typesetting or reducing adjacent accuracy.

## 4. Motion & performance

- User action feedback: 100–140ms.
- Button elevation interaction: 120ms.
- Panel/filter expansion: 180–220ms.
- Bottom sheet: 220–260ms with --ui-ease.
- Route transition: crossfade/translate at most 160–200ms **after target content is mounted**, never a blank loading animation.
- Speech row progress update: 140–180ms background transition only; no row movement while reading.
- If prefers-reduced-motion: reduce, disable translational animations and nonessential transitions.
- Restrict backdrop-filter to small fixed navigation/sheets; never apply blur, filter, shadow animation or layered gradients to 1,164 script rows.
- No third-party motion library, remote font request or large runtime dependency for this redesign.

## 5. Concrete files and implementation sequence

Existing architecture is static ES modules; do not migrate frameworks.

1. **Refactor** dist/styles.css: remove conflicting historical warm-color and serif declarations instead of continually appending overrides. Replace old tokens + all hard-coded beige/yellow/Georgia uses. Add the consolidated tokens, elevation, typography, layout and responsive styles.
2. dist/app.js: simplify home markup, duplicate role/title labels and surrounding chrome *without removing features or their persisted settings*. Keep route/data handlers intact. Update selectors only where necessary.
3. dist/modules/reader.js: adapt speech/toolbar DOM classes to plain speaker labels, selected-state wash, accessible dictionary word affordance. Preserve tokenization, IntersectionObserver, content-visibility:auto, swipe state, scroll restore and openSheet behavior.
4. dist/modules/rehearsal.js: simplify cloze mask and audio stage; preserve existing state transitions, audio boundaries, session resume and selected role.
5. dist/modules/ui.js: apply consistent button/sheet states but keep IDs/handler contracts.
6. dist/modules/stick.js: **no behavior changes**; only ensure one disk, translucency/shadow as stated.
7. dist/index.html and dist/manifest.webmanifest: synchronize theme-color with --ui-canvas; verify PWA icon remains visible on a white launcher.
8. Re-run tests and add focused DOM/UI regression checks where feasible; verify main deployment only after the implementation PR passes.

## 6. Responsive targets

- 320px phone: no sideways scrolling, role selector truncates gracefully, reader toolbar actions usable.
- 360–430px phone: primary baseline design. 20–22px speech padding.
- 768px tablet: 28px speech padding; no unnecessary narrow centered column.
- 1024–1440px desktop: 36px speech padding; full-width row surfaces. Hero max width 720px.
- Landscape and browser text zoom 200%: navigation doesn't overlap speech; sheets and CTA stay usable.
- Safe-area bottom padding respected for bottom navigation/stick/sheet.
- Avoid fixed heights for lines whose translations or directions wrap.

## 7. Acceptance criteria

Visual:
- [ ] Every page has a light palette, no warm beige/yellow and no serif font.
- [ ] No "YOU" badge, role avatar, speaker capsule, decorative chapter circle, or large audio emblem.
- [ ] Home has a clear primary CTA and one secondary action; no information overload.
- [ ] Current-role and other dialogue distinguishable using speaker name alone.
- [ ] Every dialogue row reaches full content width and has a subtle divider, not a floating card.
- [ ] Clickable dictionary terms have a visible dotted underline, and non-clickable terms do not.
- [ ] Light directional shadows/specular edge make raised controls visibly distinct; no text shadow.
- [ ] Stick is a single translucent circle without visual clutter.

Functional regression:
- [ ] Role selector works from home and reader; selected role persists.
- [ ] Script search, filters, scene jump, own-line jump and inline dictionary operate as before.
- [ ] Swipe mastery/review, undo, progress persistence and scroll position restoration work.
- [ ] Cloze hide/reveal/previous, audio play/pause/fallback and session resume work.
- [ ] Mobile/tablet/desktop, offline/PWA, keyboard focus, reduced motion checked.
- [ ] npm test and npm run build pass. Browser screenshots should be reviewed at 360px, 768px, 1280px; passing unit tests alone is insufficient.

## 8. Supporting design rationale

- Apple HIG: visual hierarchy and depth should communicate meaningful separation, not arbitrary ornament. https://developer.apple.com/design/human-interface-guidelines/spatial-layout/
- Material Design 3: elevation can use restrained tonal difference and shadow rather than only borders. https://developer.android.com/develop/ui/compose/designsystems/material3

**Note:** These are product-specific design choices, not values prescribed by Apple or Google. Implementation is included in PR #1; passing CI does not substitute for visual and device testing.

## 9. Custom controls and sheet swipe behavior (2026-10-30 extension)

- **No platform-native select menus:** every select control retains its semantic value internally but is visually replaced by an in-app text trigger and accessible choice sheet. Applies to home role, script filters, rehearsal role/scene and settings.
- **No stock Android form skins:** checkbox toggles, role radio choices, range sliders, number-field spinners and focus indicators follow the app's custom design tokens. The OS keyboard, external file picker and permission dialogs remain delegated to the operating system.
- **Native change events preserved:** selecting an option updates the existing select value, emits input and change events and refreshes the visual trigger, preserving state and save logic.
- **Swipe dismiss:** the header or handle can be dragged down. The sheet body can also be pulled down when its scroll position is at the top. Over 96px, or over 38px at greater than 0.78px/ms, dismisses with a short downward animation. Short and horizontal gestures do not close. Upward header movement greater than 65px expands the sheet.
- **Accessibility:** visible focus, labeled controls, selected-choice indication, aria-haspopup dialog semantics and focus restoration after close.
- **Verification:** existing tests and automated Chromium phone/desktop interaction checks. Physical Android QA remains separate.
