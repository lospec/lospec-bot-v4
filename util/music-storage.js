// Private files kept beside the music on Spaces (music/<name>): the chip2mp3
// builds the bot renders game-music files with, and the chiptune.app id index.
// They aren't public on the CDN; only the bot reads them, with the Spaces keys.

import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const BUCKET = 'lospec';
const PREFIX = 'music/';

export const useSpaces = Boolean(process.env.SPACES_KEY && process.env.SPACES_SECRET);
const s3 = useSpaces ? new S3Client({
	endpoint: 'https://nyc3.digitaloceanspaces.com',
	region: 'us-east-1',
	credentials: {accessKeyId: process.env.SPACES_KEY, secretAccessKey: process.env.SPACES_SECRET},
}) : null;

// A stored file, or null if there isn't one
export async function readStored (name) {
	if (!useSpaces) return null;
	try {
		const file = await s3.send(new GetObjectCommand({Bucket: BUCKET, Key: PREFIX + name}));
		return Buffer.from(await file.Body.transformToByteArray());
	}
	catch (err) {
		if (err.name === 'NoSuchKey') return null;
		throw err;
	}
}

export async function store (name, body, contentType = 'application/octet-stream') {
	if (!useSpaces) throw new Error('Set SPACES_KEY and SPACES_SECRET to store files on Spaces.');
	await s3.send(new PutObjectCommand({Bucket: BUCKET, Key: PREFIX + name, Body: body, ContentType: contentType, ACL: 'private'}));
}

// The names (relative to music/) of stored files starting with `prefix`
export async function listStored (prefix) {
	if (!useSpaces) return [];
	const names = [];
	let ContinuationToken;
	do {
		const page = await s3.send(new ListObjectsV2Command({Bucket: BUCKET, Prefix: PREFIX + prefix, ContinuationToken}));
		for (const object of page.Contents || []) names.push({name: object.Key.slice(PREFIX.length), size: object.Size, modified: object.LastModified});
		ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
	} while (ContinuationToken);
	return names;
}
