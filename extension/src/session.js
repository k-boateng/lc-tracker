// Session persistence via chrome.storage.local, shared by popup.js and
// content.js. Not localStorage: a content script's localStorage is
// leetcode.com's own storage, not the extension's, and a service worker
// has no localStorage at all. chrome.storage.local is the one store both
// contexts can read/write.
//
// Wrapped in explicit Promises (rather than relying on chrome.storage's
// native promise support) since that landed in Chrome at different times
// across APIs — the callback form works everywhere MV3 does.

const LC_NOTES_SESSION_KEY = 'lc_notes_session'

function saveSession(session) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [LC_NOTES_SESSION_KEY]: session }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve()
    })
  })
}

function loadSession() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(LC_NOTES_SESSION_KEY, (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve(result[LC_NOTES_SESSION_KEY] ?? null)
    })
  })
}

function clearSession() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(LC_NOTES_SESSION_KEY, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve()
    })
  })
}
