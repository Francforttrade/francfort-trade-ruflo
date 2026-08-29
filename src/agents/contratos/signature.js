function isSignatureComplete({ sellerSigned, buyerSigned } = {}) {
	return Boolean(sellerSigned) && Boolean(buyerSigned);
}

module.exports = { isSignatureComplete };
