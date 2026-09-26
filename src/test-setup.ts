import '@testing-library/jest-dom/vitest'

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
