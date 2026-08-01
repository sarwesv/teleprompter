# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A zero-dependency, client-only web teleprompter ("StreamlinePrompter"). There is **no build system, no package manager, no test framework, and no backend** — just three static files (`index.html`, `styles.css`, `app.js`) plus SVG assets in `Assets/`. Everything runs in the browser and all persistence is `localStorage`.

Note: `README.md` documents an older, simpler version of the app (a basic `.txt` teleprompter). The actual UI and feature set in the code is significantly richer (rich-text editor, script library, voice scroll, themes, draggable eye-line). Trust the code over the README.

## Running / developing

No compile step. Either open `index.html` directly, or serve statically:

```bash
python -m http.server 8000   # then visit http://localhost:8000
# or: npx http-server
```

A local server is required to exercise the File System Access API (`showDirectoryPicker`/`showSaveFilePicker`) and Web Speech API cleanly.

**Cache-busting:** `index.html` loads assets with version query strings — `styles.css?v=1.58` and `app.js?v=1.42`. When you change `styles.css` or `app.js`, bump the corresponding `?v=` number in `index.html` so browsers pick up the change.

## Architecture

All logic lives in `app.js` inside a single `DOMContentLoaded` closure. There are no modules or classes — state is a set of top-level `let` variables (`isPlaying`, `scrollPosition`, `targetScrollPosition`, `currentWordIndex`, `uiWords`, etc.) and DOM references are grouped into `views`, `inputs`, `buttons`, `panels`, `display` objects at the top of the file. Read those objects first to map an element to its behavior.

**Two views, one page.** The app toggles between `#edit-view` and `#play-view` via `switchView()` (adds/removes the `active` class). There is no router.

**Scroll engine (the core).** `scrollLoop()` runs on `requestAnimationFrame`. It maintains two positions: `targetScrollPosition` (where scrolling wants to be) and `scrollPosition` (where it visually is), and eases the latter toward the former with an exponential lerp for smooth gliding. The wrapper is moved with a CSS `translateY(-scrollPosition)`. Auto-scroll advances the target by a px/sec derived from the speed slider; the scrubber, wheel, arrow keys, and voice all move the target and let the loop glide there. `startScrolling`/`stopScrolling` gate `isPlaying` and the rAF handle.

**Word-level model.** Starting the prompter runs the edit view's HTML through `processPrompterNode()`, which clones the rich-text markup but wraps every visible word in a `<span>` (with `data-clean` = lowercased, punctuation-stripped word) and collects them into the `uiWords` array. This array is the backbone for progress %, per-word highlighting, eye-line alignment, and voice matching.

**Voice scroll (Web Speech API).** When enabled, `recognition.onresult` matches newly spoken words against a forward window (~15 words) of `uiWords`, favoring multi-word phrase matches, and advances `currentWordIndex` — moving `targetScrollPosition` so the current word sits on the eye-line. The Voice button hides itself entirely if `SpeechRecognition` is unavailable.

**Eye-line marker.** A draggable "READ HERE" line (`#eye-line-marker`); its vertical position is `eyeLinePercent`, persisted and used everywhere as the anchor offset for aligning a word to the reading position.

**Rich-text editing** uses a `contenteditable` div (`#script-input`) with `document.execCommand` for bold/italic/foreColor (toolbar buttons and Cmd/Ctrl+B/I). Because it's contenteditable, read content via `.innerText` / `.innerHTML`, **not** `.value`.

**Library** is an array persisted to `localStorage`, capped at the 15 most recent, rendered into the sidebar. Its item buttons use inline `onclick` handlers, so the load/delete/rename functions are deliberately exposed on `window` (`window.loadScript`, `window.deleteScript`, `window.renameScript`).

**Configurable hotkeys.** Key bindings live in the `hotkeys` object (persisted), remappable via the `.hotkey-btn` recorder UI in settings; `keydown` resolves the pressed `e.code` back to an action.

## Persistence (localStorage keys)

All state is stored under `teleprompter_*` keys: `_script` / `_script_html` (current script, plain + rich), `_library`, `_theme`, `_font`, `_size_edit`, `_focus`, `_eye_line`, `_hotkeys`. When adding a persisted setting, follow this prefix convention and load it during the initialization block near the bottom of `app.js`.

## Gotcha

Several handlers read the script via `inputs.script.value` (e.g. the input listener and the download/save paths), but `#script-input` is a contenteditable `<div>` with no `.value` property, so those reads yield `undefined`. Use `.innerText` / `.innerHTML` instead — and be aware some existing code paths still have this latent bug if you touch save/download.
