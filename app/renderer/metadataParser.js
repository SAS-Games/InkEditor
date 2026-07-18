const {
    METADATA_DEFINITIONS,
    canonicalMetadataKey
} = require("./metadataDefinitions.js");

const TAG_LINE_PATTERN = /^(\s*)#\s*([A-Za-z][A-Za-z0-9_.-]*)\s*:\s*(.*?)\s*$/;
const INLINE_TAG_PATTERN = /^#\s*([A-Za-z][A-Za-z0-9_.-]*)\s*:\s*(.*?)\s*$/;
const ANY_TAG_LINE_PATTERN = /^\s*#/;

function availableDefinitions(definitions) {
    return Array.isArray(definitions) ? definitions : METADATA_DEFINITIONS;
}

function definitionForCanonicalKey(canonicalKey, definitions) {
    if( !canonicalKey ) return null;
    return availableDefinitions(definitions).find(definition => definition.key === canonicalKey) || null;
}

function isTagLine(line) {
    return typeof line === "string" && ANY_TAG_LINE_PATTERN.test(line);
}

function parseTagLine(line, row, definitions) {
    if( !isTagLine(line) ) return null;

    const match = TAG_LINE_PATTERN.exec(line);
    if( !match ) {
        return {
            row: row,
            indent: (line.match(/^\s*/) || [""])[0],
            key: null,
            canonicalKey: null,
            value: null,
            isSupported: false,
            isDiscovered: false,
            rawLine: line
        };
    }

    const key = match[2];
    const canonicalKey = canonicalMetadataKey(key, availableDefinitions(definitions));
    const definition = definitionForCanonicalKey(canonicalKey, definitions);

    return {
        row: row,
        indent: match[1],
        key: key,
        canonicalKey: canonicalKey,
        value: match[3].trim(),
        isSupported: canonicalKey != null,
        isDiscovered: Boolean(definition && definition.discovered),
        rawLine: line
    };
}

function isEscaped(text, index) {
    let slashCount = 0;
    for(let position = index - 1; position >= 0 && text[position] === "\\"; position--) slashCount++;
    return slashCount % 2 === 1;
}

function findInlineTagColumns(line, startColumn, endColumn) {
    const columns = [];
    const start = Math.max(0, Number(startColumn) || 0);
    const end = Math.min(line.length, Number.isInteger(endColumn) ? endColumn : line.length);

    for(let column = start; column < end; column++) {
        if( line[column] === "#" && !isEscaped(line, column) ) columns.push(column);
    }

    return columns;
}

function parseInlineTagEntries(line, row, startColumn, endColumn, definitions) {
    const tagColumns = findInlineTagColumns(line, startColumn, endColumn);

    return tagColumns.map((column, index) => {
        const nextColumn = index + 1 < tagColumns.length ? tagColumns[index + 1] : endColumn;
        let contentEndColumn = nextColumn;
        while(contentEndColumn > column + 1 && /\s/.test(line[contentEndColumn - 1])) contentEndColumn--;

        const rawText = line.substring(column, contentEndColumn);
        const match = INLINE_TAG_PATTERN.exec(rawText);
        if( !match ) {
            return {
                row: row,
                startColumn: column,
                endColumn: contentEndColumn,
                key: null,
                canonicalKey: null,
                value: null,
                isSupported: false,
                isDiscovered: false,
                rawText: rawText
            };
        }

        const key = match[1];
        const canonicalKey = canonicalMetadataKey(key, availableDefinitions(definitions));
        const definition = definitionForCanonicalKey(canonicalKey, definitions);
        return {
            row: row,
            startColumn: column,
            endColumn: contentEndColumn,
            key: key,
            canonicalKey: canonicalKey,
            value: match[2].trim(),
            isSupported: canonicalKey != null,
            isDiscovered: Boolean(definition && definition.discovered),
            rawText: rawText
        };
    });
}

function summarizeMetadata(entries, definitions) {
    const occurrences = {};
    const values = {};
    const duplicates = {};
    const keys = availableDefinitions(definitions).map(definition => definition.key);

    keys.forEach(key => {
        occurrences[key] = [];
        values[key] = "";
    });

    entries.forEach(entry => {
        if( !entry.isSupported ) return;

        occurrences[entry.canonicalKey].push(entry);
        // The nearest tag to the content line, or the final inline choice tag, is authoritative.
        values[entry.canonicalKey] = entry.value;
    });

    keys.forEach(key => {
        if( occurrences[key].length > 1 ) duplicates[key] = occurrences[key].slice();
    });

    return {
        entries: entries,
        occurrences: occurrences,
        values: values,
        duplicates: duplicates
    };
}

function parseMetadataBlock(lines, blockStart, blockEnd, definitions) {
    const entries = [];

    if( blockStart <= blockEnd ) {
        for(let row = blockStart; row <= blockEnd; row++) {
            const entry = parseTagLine(lines[row], row, definitions);
            if( entry ) entries.push(entry);
        }
    }

    return summarizeMetadata(entries, definitions);
}

function parseInlineMetadata(line, row, startColumn, endColumn, definitions) {
    return summarizeMetadata(
        parseInlineTagEntries(line, row, startColumn, endColumn, definitions),
        definitions
    );
}

exports.isTagLine = isTagLine;
exports.isEscaped = isEscaped;
exports.parseTagLine = parseTagLine;
exports.parseMetadataBlock = parseMetadataBlock;
exports.parseInlineMetadata = parseInlineMetadata;
