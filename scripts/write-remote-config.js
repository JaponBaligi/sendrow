/**
 * Ensures .block/remote.json exists for `block run`.
 * On Railway/hosted deploys, set AIRTABLE_BLOCK_ID and AIRTABLE_BASE_ID.
 * Locally, keep your existing .block/remote.json (gitignored) or use the same env vars.
 */
const fs = require('fs');
const path = require('path');

const remotePath = path.join(process.cwd(), '.block', 'remote.json');
const blockId = process.env.AIRTABLE_BLOCK_ID;
const baseId = process.env.AIRTABLE_BASE_ID;

if (blockId && baseId) {
    fs.mkdirSync(path.dirname(remotePath), { recursive: true });
    fs.writeFileSync(
        remotePath,
        `${JSON.stringify({ blockId, baseId }, null, 2)}\n`,
        'utf8'
    );
    process.exit(0);
}

if (fs.existsSync(remotePath)) {
    try {
        const obj = JSON.parse(fs.readFileSync(remotePath, 'utf8'));
        if (
            obj &&
            typeof obj === 'object' &&
            !Array.isArray(obj) &&
            typeof obj.blockId === 'string' &&
            typeof obj.baseId === 'string'
        ) {
            process.exit(0);
        }
    } catch {
        // fall through
    }
}

console.error(
    'Missing valid .block/remote.json. Set AIRTABLE_BLOCK_ID and AIRTABLE_BASE_ID (e.g. on Railway), or run `block release` / link locally so the file exists.'
);
process.exit(1);
