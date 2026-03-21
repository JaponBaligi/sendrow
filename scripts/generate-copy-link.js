const crypto = require('crypto');

const recordId = process.argv[2];
const SECRET = process.env.COPY_LINK_SECRET;
const baseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

if (!recordId) {
    console.error('Usage: node scripts/generate-copy-link.js <recordId> [expUnix]');
    process.exit(1);
}
if (!SECRET) {
    console.error('Set COPY_LINK_SECRET (same value as the server).');
    process.exit(1);
}

const exp =
    process.argv[3] !== undefined
        ? parseInt(process.argv[3], 10)
        : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

function sign(recordId, expSec) {
    return crypto.createHmac('sha256', SECRET).update(`${recordId}:${expSec}`).digest('hex');
}

const sig = sign(recordId, exp);
const path = `/api/copy?recordId=${encodeURIComponent(recordId)}&exp=${exp}&sig=${sig}`;

if (baseUrl) {
    console.log(baseUrl + path);
} else {
    console.log(path);
    console.error('(Set PUBLIC_BASE_URL to print a full URL, e.g. https://your-app.up.railway.app)');
}
