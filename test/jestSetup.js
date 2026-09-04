// pdf-parse (v2) loads pdfjs-dist's "legacy" Node build, which feature-detects
// a browser environment by probing for a few DOM globals before falling back
// to its Node code path. Under plain `node`, that probe correctly finds
// nothing and takes the Node path; under Jest's VM-sandboxed global object,
// the same probe gets confused and throws `ReferenceError: DOMMatrix is not
// defined` at require-time. We only ever call getText() (no rendering), so
// minimal stand-ins are enough to satisfy the probe without needing real
// canvas/DOM behavior.
if (typeof globalThis.DOMMatrix === 'undefined') {
	globalThis.DOMMatrix = class DOMMatrix {};
}
if (typeof globalThis.ImageData === 'undefined') {
	globalThis.ImageData = class ImageData {};
}
if (typeof globalThis.Path2D === 'undefined') {
	globalThis.Path2D = class Path2D {};
}
