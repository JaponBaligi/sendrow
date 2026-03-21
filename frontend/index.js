import {
    initializeBlock,
    useBase,
    useRecords,
    Button,
    Box,
    Text,
} from '@airtable/blocks/ui';
import React, { useState } from 'react';

function CopyRowExtension() {
    const base = useBase();
    const tables = base.tables;

    const [sourceTableId, setSourceTableId] = useState(tables[0]?.id || null);
    const [targetTableId, setTargetTableId] = useState(tables[1]?.id || null);
    const [status, setStatus] = useState('');

    const sourceTable = base.getTableByIdIfExists(sourceTableId);
    const targetTable = base.getTableByIdIfExists(targetTableId);
    const records = useRecords(sourceTable);

    async function copyRecord(record) {
        if (!targetTable) {
            setStatus('No target table selected.');
            return;
        }

        const targetFieldNames = targetTable.fields.map((f) => f.name);
        const newFields = {};

        for (const field of sourceTable.fields) {
            if (targetFieldNames.includes(field.name)) {
                const value = record.getCellValue(field);
                if (value !== null && value !== undefined) {
                    newFields[field.name] = value;
                }
            }
        }

        try {
            await targetTable.createRecordAsync(newFields);
            setStatus(`Copied "${record.name}" to ${targetTable.name}.`);
        } catch (e) {
            setStatus(`Error: ${e.message}`);
        }
    }

    return (
        <Box padding={3}>
            <Text fontWeight="bold" fontSize={16} marginBottom={2}>
                Copy row to another table
            </Text>

            <Box marginBottom={2}>
                <Text>Source table:</Text>
                <select
                    onChange={(e) => setSourceTableId(e.target.value)}
                    value={sourceTableId || ''}
                >
                    {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                        </option>
                    ))}
                </select>
            </Box>

            <Box marginBottom={3}>
                <Text>Target table:</Text>
                <select
                    onChange={(e) => setTargetTableId(e.target.value)}
                    value={targetTableId || ''}
                >
                    {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                        </option>
                    ))}
                </select>
            </Box>

            <Text fontWeight="bold" marginBottom={1}>
                Records in {sourceTable?.name}:
            </Text>

            {records &&
                records.map((record) => (
                    <Box
                        key={record.id}
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        marginBottom={1}
                        padding={2}
                        border="default"
                        borderRadius={3}
                    >
                        <Text>{record.name || record.id}</Text>
                        <Button
                            onClick={() => copyRecord(record)}
                            variant="primary"
                            size="small"
                        >
                            Copy to {targetTable?.name || '...'}
                        </Button>
                    </Box>
                ))}

            {status && (
                <Box marginTop={3} padding={2} backgroundColor="lightGray1" borderRadius={3}>
                    <Text>{status}</Text>
                </Box>
            )}
        </Box>
    );
}

initializeBlock(() => <CopyRowExtension />);
