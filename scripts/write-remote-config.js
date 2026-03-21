const fs = require('fs');
const path = require('path');

const remotePath = path.join(process.cwd(), '.block', 'remote.json');
const blockId =
    process.env.AIRTABLE_BLOCK_ID || process.env.blockId || process.env.BLOCK_ID;
const baseId =
    process.env.AIRTABLE_BASE_ID || process.env.baseId || process.env.BASE_ID;

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
    'Missing valid .block/remote.json. Set blockId + baseId (or AIRTABLE_BLOCK_ID + AIRTABLE_BASE_ID), or keep a local .block/remote.json.'
);
process.exit(1);
