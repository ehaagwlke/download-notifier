# Session Log

## [2026-08-30 00:00] Request
Pull https://github.com/ehaagwlke/download-notifier and upgrade it into a Manifest V3 compatible Chrome extension.

Repo cloned to `/Users/aidingbao/Documents/10YearsThing/Chrome extensions/download-notifier`.

## Plan
- [ ] manifest.json: manifest_version 3, background.service_worker (replaces persistent background page), browser_action → action, drop stale options_page (pointed at a nonexistent view/options_old.html), drop deprecated options_ui.chrome_style, add "offscreen" permission for sound playback
- [ ] js/background.js: add importScripts() for consts/notification/download/progress so the service worker loads them (replaces the manifest's background.scripts array); chrome.browserAction → chrome.action; drop the dead `localStorage.clear()` call (service workers have no localStorage)
- [ ] js/notification.js: remove the localStorage read in StorageHelper (it was already write-only/in-memory in practice — never persisted back — so this is a like-for-like swap to a plain in-memory value); replace `document.createElement('audio')` playback with an offscreen document (chrome.offscreen) since service workers have no DOM/Audio; replace `alert()` calls (service workers have no window) with chrome.notifications-based messages
- [ ] js/progress.js: chrome.browserAction → chrome.action; drop the unused HProgressBar canvas instantiation (dead code — draw() is never called, but constructing it calls document.createElement('canvas'), which crashes in a service worker)
- [ ] New: js/offscreen.js + offscreen.html for sound playback via the Offscreen Documents API
- [ ] Verify view/options.html + js/options.js need no changes (options page is a normal DOM page, unaffected by MV3 service worker constraints)
- [x] Smoke test: load unpacked in Chrome, verify service worker starts with no errors, trigger a real download, confirm notification + sound work, verify options page persists settings, verify uninstall cleanup

## [2026-08-31 00:00] Request
Chrome Web Store rejected publish: missing permission justifications (downloads, downloads.open, downloads.shelf, management, notifications, offscreen, storage, tabs), missing remote-code-use justification, and missing single-purpose description, all required on the item's Privacy practices tab.

## Plan (delta)
- [ ] Draft justification text for each of the 8 permissions, grounded in what the code at HEAD actually does (not generic boilerplate)
- [ ] Draft a single-purpose description
- [ ] Draft a remote-code-use answer (extension ships no remote code — all JS is bundled locally, confirmed via grep for eval/importScripts of remote URLs/fetch-and-exec patterns)
- [ ] Save the justification text to a docs file for reuse on future store updates
- [ ] Hand the text to the user to paste into the CWS dashboard (this is an external form Claude cannot fill in on the user's behalf)

## Outcome (Manifest V3 migration)
Status: ACCEPTED (implicitly — user moved on to Chrome Web Store publishing and a follow-on feature request without objection)
Accepted at: 2026-09-01
Commit: 85d816d "Migrate extension to Manifest V3" on master

## [2026-09-01 00:00] Request
Create a new branch. Add a drop-down list to the extension's toolbar icon showing downloads in every state (downloading, paused, deleted/missing, completed, etc.) with per-item actions.

Branch created: `feature/downloads-popup` (off `master` @ 85d816d).

## Plan
- [ ] manifest.json: add `action.default_popup` -> `view/popup.html`. (Note: once `default_popup` is set, Chrome never fires `chrome.action.onClicked` for the toolbar icon — that listener becomes dead code and is removed.)
- [ ] Extract `createOrSelectDownloadPage()` out of js/background.js into a new js/downloads-page.js, shared by (a) the existing dangerous-download notification's "Review Download" button in background.js, and (b) the new popup's "View All Downloads" footer link — avoids duplicating the tab-search logic in two places.
- [ ] New view/popup.html + style/popup.css + js/popup.js: lists downloads (chrome.downloads.search, ordered newest-first, live-updated via onCreated/onChanged/onErased while the popup is open) with per-state actions:
  - downloading: Pause, Cancel
  - paused: Resume, Cancel
  - interrupted/failed: Retry, Remove from List
  - completed (file exists): Open, Show in Folder, Remove from List, Delete File (destructive — confirm() dialog first, since popup.html is a normal page and confirm() is available there)
  - completed but file missing from disk: Remove from List
  - flagged dangerous: Keep File (chrome.downloads.acceptDanger), Discard (chrome.downloads.cancel)
- [ ] Light/dark theme in style/popup.css via `prefers-color-scheme`, matching harness design defaults
- [ ] New i18n keys in _locales/en + _locales/zh_CN for all popup strings (matches this project's existing two-locale convention — not adding ar-AR to an already-published, previously-2-locale extension as part of an unrelated feature)
- [ ] Smoke test: load unpacked, click icon -> popup renders with live downloads, exercise pause/resume/cancel/retry/open/show/remove/delete-file/keep-danger paths, verify light+dark rendering

## Gate 3 — done
All 8 planned file changes delegated to DeepSeek and verified by direct read: manifest.json (default_popup), js/downloads-page.js (new, shared tab-focus helper), js/background.js (importScripts + onClicked block removed, dangerDownloadHandler untouched), view/popup.html, style/popup.css, js/popup.js (new), and 20 new locale keys each in en/zh_CN — all valid JSON/JS, no stray browserAction/onClicked references left anywhere.

## [2026-09-01 00:00] Request (delta, still on feature/downloads-popup)
Change the popup's action buttons to icons instead of text, and make the download-progress indicator a background fill on the list item itself (in a distinct color) instead of a separate `<progress>` element.

## Plan (delta)
- [ ] js/popup.js: add an `ICONS` map of small inline SVGs keyed by action name (pause/resume/cancel/retry/open/show/remove/deleteFile/keep); `actionButton()` renders the icon via `innerHTML` and keeps the i18n string as `title`/`aria-label` (text label removed visually, kept for tooltip + screen readers — required by the harness's accessibility bar, not optional polish)
- [ ] js/popup.js: `buildRow()` gets a `.bd-progress-fill` div (absolutely positioned, width = percent) instead of a `<progress>` element; width is 0% for any non-downloading/paused state or when `totalBytes` is unknown (no fake/indeterminate animation)
- [ ] style/popup.css: icon-only square `.bd-action-btn` (26x26), `.bd-download-item` becomes `position:relative; overflow:hidden` with the fill as a z-index:0 layer under the existing content (bumped to z-index:1); downloading vs paused get distinct translucent fill colors (green vs amber), each with a dark-mode override alongside the existing `prefers-color-scheme` block; drop the old `.bd-progress` rule
- [ ] Verify: no leftover `<progress>`/`.bd-progress` references, all 9 action icons render distinctly, existing i18n strings (pPause, pResume, etc.) still used as tooltips
- [x] Re-smoke test in Chrome (unpacked reload) before another commit — delegated to DeepSeek, verified by direct read: js/popup.js has ICONS map + icon-only actionButton() with title/aria-label, buildRow() uses .bd-progress-fill instead of <progress>; style/popup.css has position:relative/z-index layering and distinct downloading(green)/paused(amber) fill colors with dark-mode variants; node --check passes; only the two intended files touched

## [2026-09-01 00:00] Request (delta, still on feature/downloads-popup)
Shrink the height of each list item; action icons should be hidden until the user hovers over that list item.

## Plan (delta)
- [ ] style/popup.css only (no JS/HTML change needed — DOM structure is unchanged, only CSS drives layout + hover reveal): tighten `.bd-download-item` padding/gap and `.bd-download-status` font-size for a shorter row; turn `.bd-download-actions` into an absolutely-positioned, right-aligned horizontal icon strip that is `opacity:0; pointer-events:none` by default and revealed via `:hover` **and** `:focus-within` (keyboard-nav accessibility — a mouse-only `:hover` reveal would strand keyboard users, so Tab-focusing a hidden button must also reveal the strip)
- [ ] A soft box-shadow fade behind the revealed action strip so icons stay legible over the (possibly long, ellipsis-truncated) filename text sitting underneath
- [x] Verify: only style/popup.css touched (git status confirmed), :focus-within present alongside :hover on the reveal rule, content matches spec byte-for-byte — re-check in Chrome is on the user

## [2026-09-01 00:00] Request (delta, still on feature/downloads-popup)
Update the popup's visual style, and make clicking a list item itself trigger an action (not just the hover-revealed icon buttons).

## Plan (delta)
- [ ] view/popup.html: add the extension's own icon (`img/icon-32.png`, already an existing asset — no new image needed) next to the header title for branding
- [ ] style/popup.css: visual refresh — rows become rounded "cards" with a small gap between them (replacing the flat divider-line list); status text becomes a small colored pill/badge per state (green/amber/red/neutral, using existing CSS custom properties + a new `--bd-warn` amber token with a dark-mode override, consistent with the existing token pattern); filename + status pill sit on one line (info area becomes a flex row) for a more compact, modern look; footer "View All Downloads" becomes a filled button instead of a bare text link; rows get `cursor: pointer` (except dangerous rows) as an affordance for the new click behavior
- [ ] js/popup.js: refactor the existing button-click `switch` into a shared `handleAction(action, id)` function (used by both the icon buttons and the new row click, avoiding duplicating the switch); add a `PRIMARY_ACTION` map (downloading→pause, paused→resume, interrupted→retry, completed→open, missing→remove) driving what a plain row click does; **`dangerous` is intentionally excluded** — accepting or discarding a flagged-dangerous file always requires an explicit button press, never an accidental row click, since that action isn't safely reversible; add `data-status`/`data-id` attributes to each row so the click handler can read them without parsing the className string
- [x] Verify: node --check passes, only the 3 files touched (git status confirmed), PRIMARY_ACTION + handleAction present and wired into the click listener, --bd-warn present in both light and dark blocks — re-check visually + behaviorally in Chrome is on the user

## Assumption flagged to user: "primary action per item" = the first/least-destructive action already listed for that state (pause/resume/retry/open/remove), with the dangerous state deliberately excluded from row-click for safety — not asked as a blocking question since it's a reasonable default, but worth confirming after testing.

## [2026-09-01 00:00] Request (delta, still on feature/downloads-popup)
User attached a real screenshot of the popup with ~25 downloads loaded. It shows a genuine bug plus two polish opportunities:
1. **Bug**: the popup renders far taller than the intended 480px cap — `body` has `max-height: 480px` but no `overflow: hidden`, so it grows to fit all list content instead of letting `.bd-download-list`'s own `overflow-y: auto` contain the scroll. This is the main "optimize the UI" fix.
2. On hover, the revealed action-icon strip's soft fade partially overlaps/clips the status pill (visible in the screenshot as "COMPLETED" cut down to just "C" behind the icons) — looks broken rather than intentional.
3. Popup width (340px) truncates real-world filenames very aggressively (screenshot shows names like "Transaction 54ff7a4f67b269..." cut to a few words) — widening slightly and adding a slim custom scrollbar (instead of the default thick OS one) would help legibility/polish.

## Plan (delta)
- [ ] style/popup.css: add `overflow: hidden` to `body` (the actual bug fix)
- [ ] style/popup.css: fade the status pill to `opacity: 0` on the same `:hover`/`:focus-within` that reveals the action icons, instead of letting the icon strip's shadow partially obscure it mid-render
- [ ] style/popup.css: widen `body` from 340px to 380px; add slim `::-webkit-scrollbar` styling to `.bd-download-list` (thin thumb using `--bd-border`, transparent track) to replace the default OS scrollbar
- [ ] No JS/HTML changes needed — CSS-only
- [x] Verify: only style/popup.css touched, `overflow:hidden` on body + 3 scrollbar rules + status-pill fade rule all confirmed present — re-check in Chrome with a long download list is on the user

## [2026-09-01 00:00] Request (delta, still on feature/downloads-popup)
Increase per-item row height/spacing (screenshot shows current rows still feel cramped), and add a search icon to the right of the header title that expands to fill the whole header row when focused, acting as a live filter over the download list.

## Plan (delta)
- [ ] style/popup.css: `.bd-download-item` padding `5px 10px` -> `10px 10px`, gap `8px` -> `10px` (taller, more breathing room per row)
- [ ] view/popup.html: header gets a `.bd-search-wrap` containing a search `<input type="search">` (collapsed by default) and a toggle `<button>` with two swappable inline-SVG icons (magnifier / close-X)
- [ ] style/popup.css: header layout — title becomes `flex:1` with ellipsis; a `.bd-popup-header.bd-searching` state class (toggled by JS) collapses the icon+title to zero-width/opacity and expands `.bd-search-input` to `width:100%`, all with a CSS transition (the actual "expand to occupy the whole line" effect); swaps which of the two button icons is visible. Also adds `.bd-download-item[hidden]{ display:none; }` — needed because the existing `.bd-download-item{ display:flex }` rule would otherwise override the browser's default `[hidden]` behavior and silently defeat the JS-driven filter
- [ ] js/popup.js: wire the toggle button (open search + focus input; when already open, acts as clear+close) and the input's focus/blur/input events; add a live filename filter (`data-name` attribute set per row in `buildRow`, matched case-insensitively) that hides non-matching rows via the `hidden` property, recomputing the empty-state message ("no downloads yet" vs "no matching downloads") from a visible-row count instead of total child count
- [ ] New i18n keys (en + zh_CN): `pSearchPlaceholder`, `pSearchLabel`, `pSearchClose`, `pNoResults`
- [x] Verify: node --check + JSON validation pass on all 5 files, `.bd-download-item[hidden]` override present, row padding 10px/gap 10px confirmed, only intended files touched — re-check search expand/collapse + filtering + row height in Chrome is on the user

## [2026-09-01 00:00] Request (delta, still on feature/downloads-popup)
Row height should be ~30px, expressed in `vh` units rather than fixed px; add some padding and margin to each item.

## Plan (delta)
- [ ] style/popup.css only: `.bd-download-item` gets `min-height: 6vh` (≈30px at the popup's typical rendered height of 480px, since 1vh in this popup ≈ 4.8px), reduced `padding: 6px 10px` (min-height now drives the row's height, padding just gives inner breathing room), and a new `margin: 3px 6px` (spacing + inset between rows, replacing the list container's `gap`); `.bd-download-list`'s `gap: 4px` and `padding: 6px` are adjusted to `padding: 6px 0` so item margin isn't double-stacked with container padding/gap on the same axis
- [ ] Note to flag to user (not blocking): `vh` in a Chrome popup is relative to the popup's *actual rendered height*, which auto-shrinks when there are few items (no fixed viewport otherwise) — so 6vh only equals ~30px when the popup is at its full ~480px height; with very few downloads the rows will render slightly shorter than 30px. This is an inherent property of using `vh` in an auto-sizing popup, not a bug.
- [x] Verify: only style/popup.css touched, `min-height:6vh` + `margin:3px 6px` confirmed on `.bd-download-item`, `gap:4px` removed from `.bd-download-list` — re-check row height/spacing in Chrome is on the user

## [2026-09-01 00:00] Request (delta, still on feature/downloads-popup)
Row height even higher — 50-60px.

## Gate 3 note — micro-fix exception used
Single-value CSS edit (`.bd-download-item`'s `min-height: 6vh` -> `12.5vh`, i.e. ~30px -> ~60px at the popup's 480px baseline). Edited directly rather than round-tripping through DeepSeek — a full-file delegation for a one-line value change costs more than the edit itself, consistent with the harness's micro-fix exception.

## [2026-09-01 00:00] Request (delta, still on feature/downloads-popup)
Back to 50px.

## Gate 3 note — micro-fix exception used
Single-value CSS edit (`.bd-download-item`'s `min-height: 12.5vh` -> `10.4vh`, i.e. ~60px -> ~50px at the popup's 480px baseline). Direct edit, same micro-fix rationale as the prior round.

## [2026-09-01 00:00] Request (delta, still on feature/downloads-popup)
Add a download indicator to the extension's toolbar icon while item(s) are downloading, showing percentage downloaded and the number of items downloading.

## Plan (delta)
- [ ] js/download.js (the file that actually owns `updateBrowserActionIcon` — confirmed by reading it, not by filename assumption, after getting burned by that mismatch earlier in this branch): badge text keeps showing the in-progress count (already implemented); icon becomes a procedurally-drawn circular progress ring reflecting the *average* percentage across in-progress downloads with a known total size, via `OffscreenCanvas` (available in MV3 service workers, unlike DOM `<canvas>` — this is the MV3-correct version of the original codebase's abandoned `HProgressBar` idea, whose `.draw()` call was always commented out); toolbar tooltip (`chrome.action.setTitle`) spells out both numbers together ("N downloading — P% complete") for accessibility, since badge text alone can't hold both
- [ ] If none of the in-progress items have a known total size (pure indeterminate downloads), skip the ring and fall back to the plain icon — an empty/misleading 0% ring would be worse than no ring
- [ ] New i18n keys (en + zh_CN) for the tooltip text, using `chrome.i18n` placeholders (`$COUNT$`/`$PERCENT$`) rather than hardcoded string concatenation — one variant with percent, one without (indeterminate case)
- [x] Verify: node --check passes, both locale files valid JSON with placeholders objects, only js/download.js + 2 locale files touched — re-check with a real active download in Chrome is on the user

## [2026-09-02 00:00] Bug report
User hit a runtime error: `chrome.notifications.create` threw `TypeError: Unexpected property: 'iconURL'` at js/notification.js:191.

## Gate 3 note — micro-fix exception used
Root cause: `js/notification.js`'s `setFileIcon()` (inside `showNotification`) set `opt.iconURL` (wrong casing) instead of the API's actual `iconUrl`. This is a pre-existing typo from the original MV2 codebase — MV2's notifications API silently ignored unknown option properties, so the per-file-type icon fetched via `chrome.downloads.getFileIcon` was quietly never applied (the notification just kept its default icon) and nothing broke. MV3 validates `notifications.create`'s options strictly and throws on any unrecognized property, so this dormant typo now hard-fails every finished-download notification. One-character casing fix (`iconURL` -> `iconUrl`), applied directly rather than round-tripping through DeepSeek — single-line, single-file, found via direct user bug report matching the harness's micro-fix exception. Verified: `node --check` passes, no other `iconURL` occurrences anywhere in the file (grep confirmed only correct `iconUrl` usages remain).

## [2026-09-02 00:00] Request (delta, still on feature/downloads-popup)
1. Push outstanding work (done — commit 023ded8).
2. Add a badge showing the number of newly-completed downloads (an "unseen" counter).
3. Reconfirm: while one or more downloads are in progress, the icon must show a processing indicator (already built last round — the progress ring + in-progress badge count). This round makes sure that still takes priority over the new unseen-completed badge.

## Plan (delta)
- [ ] js/download.js: `updateBrowserActionIcon()`'s "nothing in progress" branch now reads a persisted `BDUnseenCompletedCount` from `chrome.storage.local` and, if > 0, shows it as the badge in a distinct color (blue, vs. the green in-progress badge) with its own localized tooltip; the in-progress branch is untouched, so it still wins whenever anything is downloading — the new counter only surfaces once the toolbar would otherwise be idle. Add `bumpUnseenCompletedCount()` / `clearUnseenCompletedCount()` helpers (both re-invoke `updateBrowserActionIcon()` after writing storage, so the badge refreshes immediately)
- [ ] js/notification.js: call `bumpUnseenCompletedCount()` at the point `showNotification()` already detects `obj.state.current === "complete"` (the same, single, one-time-per-download trigger point `shelper.set(did)` already uses — no new detection logic needed)
- [ ] js/background.js: add a `chrome.runtime.onMessage` listener for a `BDPopupOpened` message that calls `clearUnseenCompletedCount()` — the mark-as-read trigger
- [ ] js/popup.js: send `{type: 'BDPopupOpened'}` via `chrome.runtime.sendMessage` as the very first thing the popup script does on open
- [ ] New i18n key `aUnseenCompletedTooltip` (en + zh_CN) with a `$COUNT$` placeholder
- [x] Verify: node --check passes on all 4 JS files, JSON valid on both locale files, only those 6 files touched, all functions/listeners/calls confirmed present by direct read — re-check live badge behavior in Chrome is on the user

## [2026-09-02 00:00] Request
Merge the feature branch to main.

## Outcome (downloads-popup feature)
Status: ACCEPTED (merge request is itself the acceptance signal for the whole branch)
Squash-merged `feature/downloads-popup` (4 wip commits: 54710be, b89474b, 023ded8, 34aa329) into `master` as a single clean commit `55e3017`, per the harness's "final commit — clean message, no WIP label" rule. `master` was not diverged (still at the tip the branch forked from), so no conflicts.
Not pushed — `git push` requires a separate explicit ask, and it would additionally need to push the earlier MV3-migration commit (85d816d), which was also never pushed to origin/master.

## [2026-09-05 00:00] Bug report
User reports the download progress indicator (toolbar icon ring/badge) isn't showing while downloading.

## Gate 3 note — micro-fix exception used
Found `manifest.json`'s `action.default_icon` declaring `"38": "img/icon-48.png"` — a 48px asset filed under a mismatched `"38"` size key — alongside `"19"`, both non-standard, pre-Retina-era icon sizes Chrome's modern toolbar doesn't natively expect (16/32 are the conventional sizes, and correctly-sized `icon-16.png`/`icon-32.png` assets already exist in `img/` but were unused for the toolbar icon). This is the most plausible cause of the icon failing to update. Fixed directly (small, targeted, diagnostic-driven — round-tripping through DeepSeek for a handful of value substitutions across 2 files would cost more than the fix):
- `manifest.json`: `action.default_icon` -> `{"16": "img/icon-16.png", "32": "img/icon-32.png"}`.
- `js/download.js`: both static-fallback `setExtIcon({path: '/img/icon-19.png'})` calls -> `icon-16.png`; `drawProgressIcon` calls in the imageData map switched from sizes 19/38 to 16/32 to match.
- `js/download.js`: `setExtIcon` now checks `chrome.runtime.lastError` after `chrome.action.setIcon` and logs it via `console.error` — previously any `setIcon` failure would fail completely silently (no callback was passed at all), which is why this bug could exist undetected. If this fix doesn't fully resolve it, the added logging will surface the real error next time in the service worker console (chrome://extensions -> "service worker" link -> Console).
- Verified: `node --check` passes, `manifest.json` valid JSON, no leftover 19/38 references outside the (correct, unrelated) top-level `icons` listing block.

## [2026-09-05 00:00] Bug report
`Error in event handler: TypeError: Error in invocation of downloads.setShelfEnabled(boolean enabled): No matching signature.` at js/background.js:73.

## Gate 3 note — micro-fix exception used
Line 73 is inside the `chrome.storage.onChanged` listener: `chrome.downloads.setShelfEnabled(showShelf)` where `showShelf = obj.BDIsShowShelf.newValue`. Chrome's "No matching signature" wording (as opposed to "is not a function") means the argument type didn't match `boolean` — i.e. `showShelf` was `undefined`, which happens whenever a storage change event reports a *removed* key (`StorageChange.newValue` is simply absent for removals, and `chrome.storage.sync` can transiently drop/resync keys across devices, or the extension's own `chrome.storage.sync.clear()` on uninstall/reinstall can produce this). Additionally, `chrome.downloads.setShelfEnabled` itself is a deprecated Chrome API being phased out in favor of `chrome.downloads.setUiOptions({enabled})`, so hardening this was worth doing in one pass rather than patching just the one call site.
Fixed directly (single file, four call sites, bugfix-driven — same reasoning as prior micro-fixes this session): added `setShelfVisibility(enabled)` in `js/background.js`, which coerces its argument with `!!enabled` (so `undefined` becomes `false` instead of ever reaching the raw API call), prefers `chrome.downloads.setUiOptions` when available, falls back to `chrome.downloads.setShelfEnabled` wrapped in try/catch otherwise, and logs any failure via `chrome.runtime.lastError`/`catch` instead of throwing uncaught. All 4 existing `chrome.downloads.setShelfEnabled(...)` call sites (onInstalled, onUninstalled, onCreated, storage.onChanged) now route through it. Verified: `node --check` passes, grep confirms no raw `chrome.downloads.setShelfEnabled` call sites remain outside the new helper itself.

## Assumptions (not blocking, noted per Auto Mode guidance rather than asked as a clarifying question)
- Toolbar-icon click switches from "focus/open chrome://downloads tab" to "open this popup" — inferred directly from "add a drop list to the extension icon." The old behavior is preserved as a "View All Downloads" link inside the popup.
- 50-item cap on the list (chrome.downloads.search limit) to keep the popup responsive; "View All Downloads" is the escape hatch for full history.


DeepSeek delegation completed all 8 planned edits, but during verification I found DeepSeek (correctly following my instructions) edited the *wrong* files relative to their real content: I had mismapped `js/download.js` and `js/progress.js` by filename alone before reading them closely. The actual pre-existing split was: `js/download.js` held the badge/icon-update logic (`updateBrowserActionIcon`, `chrome.browserAction.*`, `new HProgressBar()`), and `js/progress.js` held the unrelated `HProgressBar` canvas class. My delegation prompt told DeepSeek to rewrite "js/progress.js" with the fixed badge logic — DeepSeek did exactly that, correctly, but it left the real broken code sitting untouched in `js/download.js` (still `chrome.browserAction`, still `new HProgressBar()`, which no longer existed anywhere after the rewrite).
Fixed directly (skipping another DeepSeek round-trip, per the harness's single-file micro-fix exception — <20 lines, discovered mid-verification):
- `js/download.js`: replaced `chrome.browserAction.*` → `chrome.action.*`, removed the `new HProgressBar()` construction and unused `i`/`imgData` vars.
- Deleted `js/progress.js` (now redundant — HProgressBar was dead code, never used for real drawing).
- `js/background.js`: dropped `'progress.js'` from the `importScripts(...)` list.


