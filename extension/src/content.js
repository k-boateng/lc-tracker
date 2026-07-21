// Injected on https://leetcode.com/problems/* (see manifest.json).
// Flow: load stored session -> setSession() on a fresh client -> scrape
// the problem number off the page -> look it up in `problems` -> branch
// into log mode / review mode / not-due.
//
// Styling lives in panel.css (loaded via manifest.json's content_scripts
// "css" entry, before this file runs) — see the header comment there for
// exactly which app files each value was ported from.

// These have to come before main()'s IIFE below, not after it: main()
// starts running synchronously the moment the script loads, and its very
// first suspend point (inside createPanel -> loadPanelState) reads
// PANEL_STATE_KEY from a Promise executor, which runs synchronously too.
// If these were declared later in the file (as module-level `const`,
// after the point where they're read), that read would land in the
// temporal dead zone and throw "Cannot access before initialization" —
// harmless-looking further down the file, but fatal this early.
const PANEL_STATE_KEY = 'lc_notes_panel_pos'
const PANEL_DEFAULTS = { top: 80, width: 320, height: 420, collapsed: false }
const PANEL_MIN_WIDTH = 320
const PANEL_MIN_HEIGHT = 200
const PANEL_MAX_WIDTH = 600
const PANEL_MAX_HEIGHT = 800

const DRAFT_KEY_PREFIX = 'lc_notes_draft_'

// Ported from src/components/ComfortRating.tsx — keep in sync if the
// app's ramp/labels change.
const COMFORT_COLORS = ['#f7768e', '#ff9e64', '#e0af68', '#9ece6a', '#73daca']
const COMFORT_LABELS = ['Blanked', 'Struggled', 'Shaky', 'Solid', 'Fluent']

;(async function main() {
  const panel = await createPanel()

  if (!globalThis.LC_NOTES_CONFIG || !globalThis.LC_NOTES_CONFIG.SUPABASE_URL || globalThis.LC_NOTES_CONFIG.SUPABASE_URL.includes('your-project-ref')) {
    renderMessage(panel, 'missing config.local.js — copy config.example.js, fill in your Supabase project, reload the extension.')
    return
  }

  let session
  try {
    session = await loadSession()
  } catch (e) {
    renderMessage(panel, 'could not read stored session — ' + e.message)
    return
  }
  if (!session) {
    renderMessage(panel, 'not signed in. Click the extension icon to sign in with Google.')
    return
  }

  const client = createLcNotesClient()
  const { error: setErr } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (setErr) {
    renderMessage(panel, 'session expired — sign in again from the extension popup.')
    return
  }

  const meta = extractProblemMeta()
  if (!meta) {
    renderMessage(panel, "couldn't parse the problem number from this page's title. LeetCode may have changed its markup.")
    return
  }

  const userId = session.user.id
  const { data: existing, error: findErr } = await client
    .from('problems')
    .select('*')
    .eq('user_id', userId)
    .eq('leetcode_number', meta.leetcode_number)
    .maybeSingle()

  if (findErr) {
    renderMessage(panel, 'lookup failed — ' + findErr.message)
    return
  }

  if (!existing) {
    await renderLogForm(panel, client, userId, meta)
    return
  }

  if (existing.next_review <= todayISO()) {
    await renderReviewForm(panel, client, existing)
  } else {
    renderNotDue(panel, existing)
  }
})()

// ============================================================
// PANEL CHROME — drag / collapse / resize, persisted in
// chrome.storage.local under one key so there's a single read/write
// instead of scattered ones. Purely presentational: nothing in here
// touches auth, scraping, or the log/review logic below.
// (PANEL_STATE_KEY and friends are declared at the top of the file —
// see the comment there for why.)
// ============================================================

function loadPanelState() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(PANEL_STATE_KEY, (result) => {
      if (chrome.runtime.lastError) {
        console.error('[lc-notes] panel state read failed:', chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
      } else {
        console.debug('[lc-notes] panel state read:', PANEL_STATE_KEY, '->', result[PANEL_STATE_KEY])
        resolve(result[PANEL_STATE_KEY] ?? null)
      }
    })
  })
}

function savePanelState(state) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [PANEL_STATE_KEY]: state }, () => {
      if (chrome.runtime.lastError) {
        console.error('[lc-notes] panel state write failed:', chrome.runtime.lastError, state)
        reject(chrome.runtime.lastError)
      } else {
        console.debug('[lc-notes] panel state written:', PANEL_STATE_KEY, '->', state)
        resolve()
      }
    })
  })
}

// Clamps width/height to the allowed range, then keeps top/left inside
// the viewport for whatever width/height came out of that — order
// matters since a resize can shrink the usable left/top range.
function clampPanelGeometry(state) {
  const width = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, state.width))
  const height = Math.min(PANEL_MAX_HEIGHT, Math.max(PANEL_MIN_HEIGHT, state.height))
  const maxLeft = Math.max(0, window.innerWidth - width)
  const maxTop = Math.max(0, window.innerHeight - height)
  const left = Math.min(maxLeft, Math.max(0, state.left))
  const top = Math.min(maxTop, Math.max(0, state.top))
  return { top, left, width, height, collapsed: state.collapsed }
}

async function createPanel() {
  const stored = await loadPanelState().catch((e) => {
    console.error('[lc-notes] could not read panel state, using defaults:', e)
    return null
  })
  const width = stored?.width ?? PANEL_DEFAULTS.width
  const height = stored?.height ?? PANEL_DEFAULTS.height
  const left = stored?.left ?? Math.max(0, window.innerWidth - width - 16)
  const top = stored?.top ?? PANEL_DEFAULTS.top
  const collapsed = stored?.collapsed ?? PANEL_DEFAULTS.collapsed

  let state = clampPanelGeometry({ top, left, width, height, collapsed })

  const root = document.createElement('div')
  root.id = 'lc-notes-panel'

  // Terminal-window chrome bar — same traffic-light dots + path-style
  // label as Login.tsx / Onboarding.tsx ("~/lc-tracker — login").
  const header = el('div', { class: 'lcn-header' })
  header.appendChild(el('span', { class: 'lcn-dot lcn-dot-danger' }))
  header.appendChild(el('span', { class: 'lcn-dot lcn-dot-warning' }))
  header.appendChild(el('span', { class: 'lcn-dot lcn-dot-success' }))

  const titleEl = el('div', { class: 'lcn-title' }, '~/lc-notes')
  const collapseBtn = el('button', { type: 'button', class: 'lcn-collapse-btn' })

  header.appendChild(titleEl)
  header.appendChild(collapseBtn)

  const body = el('div', { class: 'lcn-body' })
  const resizeHandle = el('div', { class: 'lcn-resize-handle' })

  root.appendChild(header)
  root.appendChild(body)
  root.appendChild(resizeHandle)
  document.body.appendChild(root)

  // Geometry (position/size) is per-user runtime state loaded from
  // storage, not something CSS can know ahead of time — stays inline.
  // Everything else (colors, fonts, borders, the collapsed layout) comes
  // from panel.css, scoped under #lc-notes-panel.
  function applyGeometry() {
    root.style.left = state.left + 'px'
    root.style.top = state.top + 'px'
    root.style.width = state.width + 'px'
    root.style.height = state.collapsed ? 'auto' : state.height + 'px'
    root.classList.toggle('lcn-collapsed', state.collapsed)
    collapseBtn.textContent = state.collapsed ? '▸' : '▾'
    collapseBtn.title = state.collapsed ? 'Expand' : 'Collapse'
  }
  applyGeometry()

  function persist() {
    savePanelState(state).catch(() => {}) // already logged inside savePanelState
  }

  // ---- drag (header, excluding the collapse button) ----
  // Pointer events + setPointerCapture, not mousedown/mousemove/mouseup on
  // document: a plain document-level mouseup misses entirely if the button
  // is released outside the tab's viewport (fast drag, cursor ends up over
  // browser chrome or another window) — the panel still looked like it
  // moved, but persist() never ran, so nothing was ever written to
  // storage. Capturing the pointer on `header` guarantees pointerup (or
  // pointercancel, if the gesture gets interrupted) is delivered there
  // regardless of where the cursor ends up.
  header.addEventListener('pointerdown', (e) => {
    if (e.target === collapseBtn) return
    e.preventDefault()
    header.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startY = e.clientY
    const startLeft = state.left
    const startTop = state.top

    function onMove(ev) {
      state = clampPanelGeometry({
        ...state,
        left: startLeft + (ev.clientX - startX),
        top: startTop + (ev.clientY - startY),
      })
      root.style.left = state.left + 'px'
      root.style.top = state.top + 'px'
    }
    function onUp(ev) {
      header.releasePointerCapture(ev.pointerId)
      header.removeEventListener('pointermove', onMove)
      header.removeEventListener('pointerup', onUp)
      header.removeEventListener('pointercancel', onUp)
      persist()
    }
    header.addEventListener('pointermove', onMove)
    header.addEventListener('pointerup', onUp)
    header.addEventListener('pointercancel', onUp)
  })

  // ---- collapse toggle ----
  // Shared by the header button and setCollapsed() below (used for the
  // not-due panel's auto-collapse) so there's one code path, not two.
  function setCollapsed(next) {
    state = { ...state, collapsed: next }
    applyGeometry()
    persist()
  }
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    setCollapsed(!state.collapsed)
  })

  // ---- resize (bottom-right corner handle) ----
  resizeHandle.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    resizeHandle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = state.width
    const startHeight = state.height

    function onMove(ev) {
      state = clampPanelGeometry({
        ...state,
        width: startWidth + (ev.clientX - startX),
        height: startHeight + (ev.clientY - startY),
      })
      root.style.width = state.width + 'px'
      root.style.height = state.height + 'px'
    }
    function onUp(ev) {
      resizeHandle.releasePointerCapture(ev.pointerId)
      resizeHandle.removeEventListener('pointermove', onMove)
      resizeHandle.removeEventListener('pointerup', onUp)
      resizeHandle.removeEventListener('pointercancel', onUp)
      persist()
    }
    resizeHandle.addEventListener('pointermove', onMove)
    resizeHandle.addEventListener('pointerup', onUp)
    resizeHandle.addEventListener('pointercancel', onUp)
  })

  return {
    body,
    setTitle(text) {
      titleEl.textContent = text
      titleEl.title = text // full text on hover — header truncates with ellipsis
    },
    setCollapsed,
  }
}

// ============================================================
// DRAFT PERSISTENCE — autosaves in-progress log/review form fields so an
// accidental reload or tab switch doesn't lose typed notes. One object
// per problem (key lc_notes_draft_<leetcode_number>), same single-write
// pattern as panel state above, not one storage key per field.
// ============================================================

function draftKeyFor(leetcodeNumber) {
  return `${DRAFT_KEY_PREFIX}${leetcodeNumber}`
}

function loadDraft(leetcodeNumber) {
  const key = draftKeyFor(leetcodeNumber)
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        console.error('[lc-notes] draft read failed:', chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
      } else {
        console.debug('[lc-notes] draft read:', key, '->', result[key])
        resolve(result[key] ?? null)
      }
    })
  })
}

function saveDraft(leetcodeNumber, data) {
  const key = draftKeyFor(leetcodeNumber)
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: data }, () => {
      if (chrome.runtime.lastError) {
        console.error('[lc-notes] draft write failed:', chrome.runtime.lastError, data)
        reject(chrome.runtime.lastError)
      } else {
        console.debug('[lc-notes] draft saved:', key)
        resolve()
      }
    })
  })
}

function deleteDraft(leetcodeNumber) {
  const key = draftKeyFor(leetcodeNumber)
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) {
        console.error('[lc-notes] draft delete failed:', chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
      } else {
        console.debug('[lc-notes] draft deleted:', key)
        resolve()
      }
    })
  })
}

// Coalesces rapid input/change events into one write ~ms after the user
// stops. flush() bypasses the pending delay and writes immediately — used
// by the beforeunload backstop, since there's no time left to wait out a
// debounce once the page is already unloading.
function debounce(fn, ms) {
  let timer = null
  function debounced() {
    clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
  debounced.flush = () => {
    clearTimeout(timer)
    fn()
  }
  return debounced
}

// ---- DOM scraping ----
// Best-effort only — LeetCode's markup changes without notice. The number
// used to live in document.title ("<number>. <name> - LeetCode") but
// LeetCode dropped it from the title at some point — title is now just
// "<name> - LeetCode". The number+name now live in a heading div instead
// (class contains "text-title-large"), so we parse that. Difficulty is
// still matched by exact text rather than relying only on class name,
// since badge class names churn more than visible text does. Scraped
// values are shown as editable fields in the log form, so a bad scrape
// doesn't silently write garbage.
function extractProblemMeta() {
  const titleEl = [...document.querySelectorAll('div[class*="text-title-large"]')]
    .find(el => /^\d+\.\s/.test(el.textContent.trim()))

  if (!titleEl) return null

  const m = titleEl.textContent.trim().match(/^(\d+)\.\s*(.+)$/)
  if (!m) return null
  const leetcode_number = parseInt(m[1], 10)
  const name = m[2].trim()

  let difficulty = null
  const candidates = document.querySelectorAll('div, span, button')
  for (const node of candidates) {
    const text = node.textContent.trim()
    if (node.children.length === 0 && (text === 'Easy' || text === 'Medium' || text === 'Hard')) {
      difficulty = text
      break
    }
  }

  const slugPath = window.location.pathname.split('/').slice(0, 3).join('/')
  const url = window.location.origin + slugPath + '/'

  return { leetcode_number, name, difficulty, url }
}

function renderMessage(panel, text) {
  panel.setTitle('~/lc-notes')
  panel.body.innerHTML = ''
  panel.body.appendChild(el('div', { class: 'lcn-muted' }, text))
}

// ---- Log mode: problem not yet in the table ----
async function renderLogForm(panel, client, userId, meta) {
  panel.setTitle('~/lc-notes — log')
  panel.body.innerHTML = ''

  const numberDisplay = input('text', String(meta.leetcode_number))
  numberDisplay.readOnly = true
  const nameInput = input('text', meta.name)
  const urlInput = input('text', meta.url)
  const difficultySelect = select(['Easy', 'Medium', 'Hard'], meta.difficulty)
  const patternSelect = select(ALL_PATTERNS, ALL_PATTERNS[0])
  const subpatternInput = input('text', '')
  const notesInput = textarea('')
  const comfortInput = comfortRadios()
  const status = el('div', { class: 'lcn-status-error' }, '')
  const draftNote = el('div', { class: 'lcn-draft-note' }, 'Draft restored.')

  const draft = await loadDraft(meta.leetcode_number).catch((e) => {
    console.error('[lc-notes] could not read draft, starting blank:', e)
    return null
  })
  if (draft) {
    if (draft.name != null) nameInput.value = draft.name
    if (draft.url != null) urlInput.value = draft.url
    if (draft.difficulty != null) difficultySelect.value = draft.difficulty
    if (draft.pattern != null) patternSelect.value = draft.pattern
    if (draft.subpattern != null) subpatternInput.value = draft.subpattern
    if (draft.notes != null) notesInput.value = draft.notes
    if (draft.comfort != null) comfortInput.setValue(draft.comfort)
  }

  function currentDraft() {
    return {
      name: nameInput.value,
      url: urlInput.value,
      difficulty: difficultySelect.value,
      pattern: patternSelect.value,
      subpattern: subpatternInput.value,
      notes: notesInput.value,
      comfort: comfortInput.getValue(),
    }
  }
  const scheduleDraftSave = debounce(() => {
    saveDraft(meta.leetcode_number, currentDraft()).catch(() => {}) // already logged inside saveDraft
  }, 400)
  for (const field of [nameInput, urlInput, subpatternInput, notesInput]) {
    field.addEventListener('input', scheduleDraftSave)
  }
  for (const field of [difficultySelect, patternSelect]) {
    field.addEventListener('change', scheduleDraftSave)
  }
  comfortInput.el.addEventListener('change', scheduleDraftSave)

  // Best-effort backstop: if the debounce timer hasn't fired yet when the
  // page unloads (e.g. the user typed and immediately closed the tab),
  // fire one more save attempt synchronously. chrome.storage.local.set is
  // async and beforeunload can't reliably wait for it to finish — this is
  // not a guarantee, just a better chance than doing nothing.
  const beforeUnloadHandler = () => scheduleDraftSave.flush()
  window.addEventListener('beforeunload', beforeUnloadHandler)

  const saveBtn = el('button', { type: 'button', class: 'lcn-btn-primary' }, 'Save')
  saveBtn.addEventListener('click', async () => {
    const comfort = comfortInput.getValue()
    if (!comfort) { status.textContent = 'Pick a comfort rating.'; return }
    saveBtn.disabled = true
    status.textContent = ''
    try {
      // Matches useProblems.addProblem's stub: a brand-new problem starts
      // at interval 0 / ease 2.5 with no prior reviews.
      const stub = { reviews: [], interval: 0, ease_factor: 2.5 }
      const { interval, nextReview, easeFactor } = calculateNextReview(stub, comfort)
      const id = crypto.randomUUID()
      const trimmedNotes = notesInput.value.trim() || null

      const { error: insErr } = await client.from('problems').insert({
        id,
        user_id: userId,
        name: nameInput.value.trim(),
        leetcode_number: meta.leetcode_number,
        url: urlInput.value.trim() || null,
        difficulty: difficultySelect.value,
        pattern: patternSelect.value,
        subpattern: subpatternInput.value.trim() || null,
        source: 'LeetCode',
        date_added: todayISO(),
        notes: trimmedNotes,
        next_review: nextReview,
        interval_days: interval,
        ease_factor: easeFactor,
      })
      if (insErr) throw insErr

      const { error: revErr } = await client.from('reviews').insert({
        problem_id: id,
        user_id: userId,
        date: todayISO(),
        comfort,
        time_spent_minutes: null,
        notes: trimmedNotes,
      })
      if (revErr) throw revErr

      window.removeEventListener('beforeunload', beforeUnloadHandler)
      deleteDraft(meta.leetcode_number).catch(() => {}) // already logged inside deleteDraft

      renderMessageIn(panel, `Logged. Next review ${nextReview}.`)
    } catch (e) {
      status.textContent = e.message || 'Save failed.'
      saveBtn.disabled = false
    }
  })

  if (draft) panel.body.appendChild(draftNote)
  panel.body.appendChild(labeled('LC #', numberDisplay))
  panel.body.appendChild(labeled('Name', nameInput))
  panel.body.appendChild(labeled('URL', urlInput))
  panel.body.appendChild(labeled('Difficulty', difficultySelect))
  panel.body.appendChild(labeled('Pattern', patternSelect))
  panel.body.appendChild(labeled('Subpattern (optional)', subpatternInput))
  panel.body.appendChild(labeled('Comfort (1-5)', comfortInput.el))
  panel.body.appendChild(labeled('Notes (optional)', notesInput))
  panel.body.appendChild(status)
  panel.body.appendChild(saveBtn)
}

// ---- Review mode: problem exists and next_review <= today ----
async function renderReviewForm(panel, client, existing) {
  // leetcode_number is nullable in the schema (older/manually-added rows
  // may not have one) — fall back to just the name if it's missing.
  const numberPrefix = existing.leetcode_number != null ? `#${existing.leetcode_number} ` : ''
  panel.setTitle(`~/lc-notes — review: ${numberPrefix}${existing.name}`)
  panel.body.innerHTML = ''

  // Same badge combo as the due-list row in Dashboard.tsx (OVERDUE +
  // PatternTag + DifficultyBadge), using the row already fetched for the
  // due-check above rather than re-querying.
  const infoRow = el('div', { class: 'lcn-info-row' })
  if (isOverdueISO(existing.next_review)) infoRow.appendChild(overdueBadge())
  if (existing.pattern) infoRow.appendChild(patternTag(existing.pattern))
  if (existing.difficulty) infoRow.appendChild(difficultyBadge(existing.difficulty))
  panel.body.appendChild(infoRow)
  panel.body.appendChild(el('div', { class: 'lcn-muted' }, `Due ${existing.next_review}`))

  let elapsed = 0
  let timerHandle = null
  const timerLabel = el('div', { class: 'lcn-timer-value' }, '00:00')
  const timerBtn = el('button', { type: 'button', class: 'lcn-btn-secondary' }, 'Start timer')
  const timerRow = el('div', { class: 'lcn-timer-row' })
  timerRow.appendChild(timerLabel)
  timerRow.appendChild(timerBtn)

  function formatTime(s) {
    const m = String(Math.floor(s / 60)).padStart(2, '0')
    const sec = String(s % 60).padStart(2, '0')
    return `${m}:${sec}`
  }
  timerBtn.addEventListener('click', () => {
    if (timerHandle) {
      clearInterval(timerHandle)
      timerHandle = null
      timerBtn.textContent = 'Resume'
    } else {
      timerHandle = setInterval(() => {
        elapsed += 1
        timerLabel.textContent = formatTime(elapsed)
      }, 1000)
      timerBtn.textContent = 'Pause'
    }
  })

  const notesInput = textarea('')
  const comfortInput = comfortRadios()
  const status = el('div', { class: 'lcn-status-error' }, '')
  const draftNote = el('div', { class: 'lcn-draft-note' }, 'Draft restored.')
  const submitBtn = el('button', { type: 'button', class: 'lcn-btn-primary' }, 'Submit review')

  const draft = await loadDraft(existing.leetcode_number).catch((e) => {
    console.error('[lc-notes] could not read draft, starting blank:', e)
    return null
  })
  if (draft) {
    if (draft.notes != null) notesInput.value = draft.notes
    if (draft.comfort != null) comfortInput.setValue(draft.comfort)
  }

  function currentDraft() {
    return { notes: notesInput.value, comfort: comfortInput.getValue() }
  }
  const scheduleDraftSave = debounce(() => {
    saveDraft(existing.leetcode_number, currentDraft()).catch(() => {}) // already logged inside saveDraft
  }, 400)
  notesInput.addEventListener('input', scheduleDraftSave)
  comfortInput.el.addEventListener('change', scheduleDraftSave)

  // Best-effort backstop — see the matching comment in renderLogForm for
  // why this can't be a guarantee.
  const beforeUnloadHandler = () => scheduleDraftSave.flush()
  window.addEventListener('beforeunload', beforeUnloadHandler)

  submitBtn.addEventListener('click', async () => {
    const comfort = comfortInput.getValue()
    if (!comfort) { status.textContent = 'Pick a comfort rating.'; return }
    submitBtn.disabled = true
    status.textContent = ''
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null }
    try {
      const problemForSm2 = {
        // calculateNextReview only reads .reviews.length (to tell first
        // review from repeat), .interval and .ease_factor. A row that
        // exists here always has >=1 prior review (log mode always
        // writes one), so a length-1 stub is enough without a second
        // query to fetch the full reviews history.
        reviews: [{}],
        interval: existing.interval_days,
        ease_factor: Number(existing.ease_factor),
      }
      const { interval, nextReview, easeFactor } = calculateNextReview(problemForSm2, comfort)
      const time_spent_minutes = elapsed > 0 ? Math.round(elapsed / 60) : null
      const notes = notesInput.value.trim() || null

      const { error: revErr } = await client.from('reviews').insert({
        problem_id: existing.id,
        user_id: existing.user_id,
        date: todayISO(),
        comfort,
        time_spent_minutes,
        notes,
      })
      if (revErr) throw revErr

      const { error: updErr } = await client
        .from('problems')
        .update({ interval_days: interval, next_review: nextReview, ease_factor: easeFactor })
        .eq('id', existing.id)
      if (updErr) throw updErr

      window.removeEventListener('beforeunload', beforeUnloadHandler)
      deleteDraft(existing.leetcode_number).catch(() => {}) // already logged inside deleteDraft

      renderMessageIn(panel, `Reviewed. Next review ${nextReview}.`)
    } catch (e) {
      status.textContent = e.message || 'Submit failed.'
      submitBtn.disabled = false
    }
  })

  if (draft) panel.body.appendChild(draftNote)
  panel.body.appendChild(timerRow)
  panel.body.appendChild(labeled('Comfort (1-5)', comfortInput.el))
  panel.body.appendChild(labeled('Notes (optional)', notesInput))
  panel.body.appendChild(status)
  panel.body.appendChild(submitBtn)
}

function renderNotDue(panel, existing) {
  panel.setTitle(`~/lc-notes — ${existing.name}`)
  panel.body.innerHTML = ''

  const infoRow = el('div', { class: 'lcn-info-row' })
  if (existing.pattern) infoRow.appendChild(patternTag(existing.pattern))
  if (existing.difficulty) infoRow.appendChild(difficultyBadge(existing.difficulty))
  panel.body.appendChild(infoRow)
  panel.body.appendChild(el('div', { class: 'lcn-muted' }, `Already logged. Next review ${existing.next_review}.`))
  if (existing.notes) {
    const notesSection = el('div', { class: 'lcn-notes-section' })
    // Reuses .lcn-field-label — the same section-label style used for
    // every other labeled field in the panel — rather than a one-off.
    notesSection.appendChild(el('div', { class: 'lcn-field-label' }, 'Notes'))
    notesSection.appendChild(el('div', { class: 'lcn-notes-block' }, existing.notes))
    panel.body.appendChild(notesSection)
  }

  // Nothing to act on here, so don't leave the expanded panel sitting
  // over the problem indefinitely — collapse to the header-only pill
  // after a moment. Reuses the same collapsed flag/stored state as the
  // manual toggle (setCollapsed persists it same as a manual click), so
  // clicking the pill still expands it to re-show this exact content to
  // peek at. This setTimeout only ever runs once per render of this
  // panel, so re-expanding afterward doesn't get auto-collapsed again —
  // there's no recurring timer, just this one delayed call.
  setTimeout(() => panel.setCollapsed(true), 2000)
}

function renderMessageIn(panel, text) {
  panel.body.innerHTML = ''
  panel.body.appendChild(el('div', { class: 'lcn-muted' }, text))
}

// ---- badges — DifficultyBadge.tsx / PatternTag.tsx / Dashboard.tsx OVERDUE ----
function difficultyBadge(difficulty) {
  const variant = difficulty === 'Easy' ? 'lcn-badge-easy' : difficulty === 'Medium' ? 'lcn-badge-medium' : 'lcn-badge-hard'
  return el('span', { class: `lcn-badge ${variant}` }, difficulty)
}
function patternTag(pattern) {
  return el('span', { class: 'lcn-pattern-tag' }, pattern)
}
function overdueBadge() {
  return el('span', { class: 'lcn-badge lcn-badge-overdue' }, 'OVERDUE')
}

// ---- tiny DOM helpers ----
function el(tag, attrs, text) {
  const e = document.createElement(tag)
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'style') e.style.cssText = v
      else e.setAttribute(k, v)
    }
  }
  if (text != null) e.textContent = text
  return e
}
function input(type, value) {
  const i = document.createElement('input')
  i.type = type
  i.value = value ?? ''
  return i
}
function textarea(value) {
  const t = document.createElement('textarea')
  t.value = value
  t.rows = 3
  return t
}
function select(options, selected) {
  const s = document.createElement('select')
  for (const opt of options) {
    const o = document.createElement('option')
    o.value = opt
    o.textContent = opt
    if (opt === selected) o.selected = true
    s.appendChild(o)
  }
  return s
}
// Button-grid comfort picker — ported from ComfortRating.tsx rather than
// styled native radios, since the app's actual rating control is a row of
// colored buttons, not radio inputs. Per-rating color comes in via CSS
// custom properties (same hex + alpha-suffix technique ComfortRating.tsx
// itself uses for the unselected border/bg tints) rather than a separate
// color system.
function comfortRadios() {
  const wrap = el('div', { class: 'lcn-comfort-grid' })
  const buttons = []
  let selected = null

  function applySelected() {
    for (const b of buttons) {
      b.classList.toggle('lcn-selected', Number(b.dataset.value) === selected)
    }
  }

  for (let i = 1; i <= 5; i++) {
    const c = COMFORT_COLORS[i - 1]
    const btn = el('button', { type: 'button', class: 'lcn-comfort-btn', title: COMFORT_LABELS[i - 1] })
    btn.dataset.value = String(i)
    btn.style.setProperty('--lcn-comfort-color', c)
    btn.style.setProperty('--lcn-comfort-border', `${c}66`)
    btn.style.setProperty('--lcn-comfort-bg', `${c}14`)
    btn.appendChild(el('span', { class: 'lcn-comfort-num' }, String(i)))
    btn.appendChild(el('span', { class: 'lcn-comfort-label' }, COMFORT_LABELS[i - 1]))
    btn.addEventListener('click', () => {
      selected = i
      applySelected()
      wrap.dispatchEvent(new Event('change'))
    })
    wrap.appendChild(btn)
    buttons.push(btn)
  }

  return {
    el: wrap,
    getValue() { return selected },
    // Restoring a draft shouldn't itself fire a 'change' (that would
    // immediately re-schedule a save of the value that was just loaded).
    setValue(n) {
      selected = n
      applySelected()
    },
  }
}
function labeled(labelText, control) {
  const wrap = el('div', { class: 'lcn-field' })
  wrap.appendChild(el('div', { class: 'lcn-field-label' }, labelText))
  wrap.appendChild(control)
  return wrap
}
