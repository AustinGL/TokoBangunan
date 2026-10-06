import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

/**
 * Lazy routes (Kasir, Laporan...) are real dynamic imports that vite has to
 * transform on first use. Testing Library's default 1s wait is too short for
 * that when the machine is busy (the full suite running in parallel), which
 * made navigation tests fail at random and pass on a rerun. Raising the cap
 * costs nothing when the element appears quickly: a wait returns as soon as
 * it is found, and only a genuinely missing element waits the full time.
 */
configure({ asyncUtilTimeout: 10_000 })

/**
 * jsdom (29.1.1, this project's installed version) implements no methods at
 * all on HTMLDialogElement - showModal, close and show are all `undefined`,
 * verified directly against a fresh jsdom instance. The `open` attribute
 * itself reflects correctly (jsdom's generic boolean-attribute handling),
 * so this polyfill only needs to supply the three missing methods, wiring
 * them to that existing attribute plus a synthetic `close` event - the one
 * piece of native <dialog> behaviour any test here (src/ui/Sheet.test.tsx)
 * actually depends on.
 */
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
