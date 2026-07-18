const {
    METADATA_KEYS,
    canonicalMetadataKey
} = require("./metadataDefinitions.js");

const TAG_LINE_PATTERN = /^(\s*)#\s*([A-Za-z][A-Za-z0-9_.-]*)\s*:\s*(.*?)\s*$/;
const ANY_TAG_LINE_PATTERN = /^\s*#/;

function isTagLine(line) {
    return typeof line === "string" && ANY_TAG_LINE_PATTERN.test(line);
}

function parseTagLine(line, row) {
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
            rawLine: line
        };
    }

    const key = match[2];
    const canonicalKey = canonicalMetadataKey(key);

    return {
        row: row,
        indent: match[1],
        key: key,
        canonicalKey: canonicalKey,
        value: match[3].trim(),
        isSupported: canonicalKey != null,
        rawLine: line
    };
}

function parseMetadataBlock(lines, blockStart, blockEnd) {
    const occurrences = {};
    const values = {};
    const duplicates = {};
    const entries = [];

    METADATA_KEYS.forEach(key => {
        occurrences[key] = [];
        values[key] = "";
    });

    if( blockStart <= blockEnd ) {
        for(let row = blockStart; row <= blockEnd; row++) {
            const entry = parseTagLine(lines[row], row);
            if( !entry ) continue;

            entries.push(entry);
            if( entry.isSupported ) {
                occurrences[entry.canonicalKey].push(entry);
                // The nearest tag to the dialogue line is authoritative.
                values[entry.canonicalKey] = entry.value;
            }
        }
    }

    METADATA_KEYS.forEach(key => {
        if( occurrences[key].length > 1 ) {
            duplicates[key] = occurrences[key].slice();
        }
    });

    return {
        entries: entries,
        occurrences: occurrences,
        values: values,
        duplicates: duplicates
    };
}

exports.isTagLine = isTagLine;
exports.parseTagLine = parseTagLine;
exports.parseMetadataBlock = parseMetadataBlock;
