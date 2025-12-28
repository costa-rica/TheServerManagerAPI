function checkBodyReturnMissing(body: any, keys: any) {
	let isValid = true;
	let missingKeys = [];

	for (const field of keys) {
		if (!body[field] || body[field] === "") {
			isValid = false;
			missingKeys.push(field);
		}
	}

	return { isValid, missingKeys };
}

/**
 * Validates if a string is a valid UUID (v4 format)
 * @param value - String to validate
 * @returns true if valid UUID, false otherwise
 */
function isValidUUID(value: string): boolean {
	if (!value || typeof value !== "string") {
		return false;
	}

	// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
	// where x is any hexadecimal digit and y is one of 8, 9, a, or b
	const uuidRegex =
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

	return uuidRegex.test(value);
}

export { checkBodyReturnMissing, isValidUUID };
