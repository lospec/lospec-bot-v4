// Runs one thing at a time per key.
//
// Bidding, settling and handing items over all read something (a balance, an
// inventory row, who holds a role) before writing it back, and none of them can
// afford to have that change underneath them while a request is in flight.

const locks = new Map();

// Runs fn while nothing else holds the same key. Waiters run in the order they
// arrived, and a thrown error frees the lock like anything else.
export function withLock (key, fn) {
	const previous = locks.get(key) || Promise.resolve();
	const result = previous.then(fn, fn);
	locks.set(key, result.then(() => {}, () => {}));
	return result;
}
