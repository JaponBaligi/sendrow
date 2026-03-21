/**
 * List tables in AIRTABLE_BASE_ID (needs PAT with schema.bases:read).
 * Run from repo root:
 *   node --env-file=.env scripts/list-tables.js
 * (Node 20+). Or set AIRTABLE_PAT and AIRTABLE_BASE_ID in the shell.
 */
const PAT = process.env.AIRTABLE_PAT;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

async function main() {
    if (!PAT || !BASE_ID) {
        console.error('Set AIRTABLE_PAT and AIRTABLE_BASE_ID (e.g. node --env-file=.env scripts/list-tables.js)');
        process.exit(1);
    }
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
        headers: { Authorization: `Bearer ${PAT}` },
    });
    const text = await res.text();
    if (!res.ok) {
        console.error(text);
        process.exit(1);
    }
    const data = JSON.parse(text);
    for (const t of data.tables || []) {
        console.log(`${t.name}\n  id: ${t.id}\n`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
