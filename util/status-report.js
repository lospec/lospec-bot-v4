// Working out what to say about a run that has just ended or just begun.
//
// Kept apart from status.js, which patches console, writes files and connects
// to discord the moment it is imported - none of which this needs.

export function describeDuration (ms) {
	const seconds = Math.max(0, Math.round(ms / 1000));
	if (seconds < 60) return seconds + ' second' + (seconds === 1 ? '' : 's');

	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return minutes + ' minute' + (minutes === 1 ? '' : 's');

	const hours = Math.floor(minutes / 60);
	const spare = minutes % 60;

	return hours + ' hour' + (hours === 1 ? '' : 's') + (spare ? ' ' + spare + 'm' : '');
}


// What happened to the run before this one. The unclean case is the one worth
// having: a run that never got to record its own ending was killed, ran out of
// memory, or had the host go away, and no handler ever saw it.
export function describePreviousRun (previous, startedAt = Date.now()) {
	if (!previous?.startedAt) return {
		clean: true,
		text: 'First run on this machine, or the run marker was cleared.',
	};

	if (!previous.stoppedAt) return {
		clean: false,
		text: 'The previous run never shut down cleanly — it was killed, ran out of memory, or the host '
			+ 'went away. It had been up for ' + describeDuration(startedAt - new Date(previous.startedAt).getTime()) + '.',
	};

	const downFor = describeDuration(startedAt - new Date(previous.stoppedAt).getTime());

	if (previous.reason === 'restart') return {
		clean: true,
		text: 'Restarted' + (previous.by ? ' by **' + previous.by + '**' : '') + ', down for ' + downFor + '.',
	};

	if (previous.reason === 'crash') return {
		clean: true,
		text: 'Back up after a crash, down for ' + downFor + '. The report for it is above.',
	};

	return {clean: true, text: 'Shut down cleanly, down for ' + downFor + '.'};
}


// The attached file: what went wrong, and the log leading up to it. Trimmed
// from the front when it is too big, because the end is the part that matters.
export function buildCrashLog ({label, error, startedAt, logs = [], pid, maxBytes = 1024 * 1024}) {
	const report = [
		'Lospec Bot crash report',
		'when:   ' + new Date().toISOString(),
		'cause:  ' + label,
		'uptime: ' + describeDuration(Date.now() - startedAt),
		'pid:    ' + pid + '   node: ' + process.version,
		'',
		'--- error ---',
		error?.stack || String(error),
		'',
		'--- last ' + logs.length + ' log lines ---',
		...logs,
		'',
	].join('\n');

	if (report.length <= maxBytes) return report;

	return '[trimmed - this log was longer than ' + maxBytes + ' characters]\n' + report.slice(-maxBytes);
}
