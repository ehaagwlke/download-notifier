# Chrome Web Store — Privacy Practices Justifications

Reference text for the "Privacy practices" tab on the Chrome Web Store developer dashboard. Paste directly; update only if a permission is added/removed in manifest.json.

## Single purpose description

This extension shows a desktop notification with an optional sound when a browser download finishes, and lets the user open the downloaded file or reveal it in their file manager directly from that notification. It also lets the user optionally hide Chrome's built-in download shelf.

## Permission justifications

| Permission | Justification |
|---|---|
| `downloads` | Needed to detect when a download starts, completes, or changes state (e.g. is flagged dangerous) so the extension can show the corresponding notification and update the toolbar badge. |
| `downloads.open` | Needed for the "Open File" button in the finished-download notification, which opens the downloaded file directly. |
| `downloads.shelf` | Needed to show/hide Chrome's built-in download shelf according to the user's own toggle in the extension's Settings page. |
| `notifications` | Needed to display the desktop notification when a download finishes (with "Open File" / "Reveal in Folder" buttons) and to warn the user when Chrome flags a download as potentially harmful. |
| `tabs` | Needed to detect whether a `chrome://downloads` tab is already open and focus it, instead of opening a duplicate tab, when the user clicks the toolbar icon. |
| `management` | Needed only to detect when the user uninstalls this extension, so it can restore Chrome's default download shelf and clear its own stored settings beforehand. |
| `storage` | Needed to save the user's preferences (notification sound on/off, chosen sound, volume, shelf visibility) locally via `chrome.storage`. |
| `offscreen` | Needed to play the optional notification sound: Manifest V3 service workers cannot play audio directly, so a hidden Offscreen Document is used solely to render the audio element. |

## Remote code use

No — this item does not use remote code. All JavaScript that runs is bundled inside the extension package; nothing is fetched or executed from a remote server at runtime.

## Data usage certification

The extension collects no user data and makes no network requests; all state (the preferences above) stays local via `chrome.storage`. Check "does not collect user data" in that section.
