const {
    isTagLine,
    parseTagLine,
    parseMetadataBlock
} = require("./metadataParser.js");

function splitLines(text) {
    return String(text == null ? "" : text).split(/\r\n|\r|\n/);
}

function classifyBlockComments(lines) {
    const commentRows = new Set();
    let inBlockComment = false;

    for(let row = 0; row < lines.length; row++) {
        const line = lines[row];
        let position = 0;

        while(position < line.length) {
            if( inBlockComment ) {
                commentRows.add(row);
                const end = line.indexOf("*/", position);
                if( end === -1 ) break;
                inBlockComment = false;
                position = end + 2;
            } else {
                const lineComment = line.indexOf("//", position);
                const blockStart = line.indexOf("/*", position);

                if( blockStart === -1 || (lineComment !== -1 && lineComment < blockStart) ) {
                    break;
                }

                commentRows.add(row);
                inBlockComment = true;
                position = blockStart + 2;
            }
        }
    }

    return commentRows;
}

function classifyConditionalBlocks(lines) {
    const conditionalRows = new Set();
    let depth = 0;

    for(let row = 0; row < lines.length; row++) {
        const trimmed = lines[row].trim();
        const beginsConditional = trimmed.startsWith("{");

        if( depth > 0 || beginsConditional ) conditionalRows.add(row);

        if( beginsConditional && !trimmed.endsWith("}") ) depth++;
        if( depth > 0 && trimmed.startsWith("}") ) depth--;
    }

    return conditionalRows;
}

function isSupportedDialogueLine(lines, row, commentRows, conditionalRows) {
    if( row < 0 || row >= lines.length ) return false;
    if( commentRows.has(row) || conditionalRows.has(row) ) return false;

    const trimmed = lines[row].trim();
    if( trimmed.length === 0 || isTagLine(lines[row]) ) return false;

    if( /^(\/\/|\/\*|\*\/)/.test(trimmed) ) return false;
    if( /^(INCLUDE|VAR|CONST|LIST|EXTERNAL)\b/i.test(trimmed) ) return false;
    if( /^(===|==|=)/.test(trimmed) ) return false;
    if( /^(->|<-|~)/.test(trimmed) ) return false;
    if( /^(\*+|\++|-+)(?:\s|$)/.test(trimmed) ) return false;
    if( /^[{}]/.test(trimmed) ) return false;

    return true;
}

function findTagBlock(lines, row) {
    let blockStart = row;
    let blockEnd = row;

    while(blockStart > 0 && isTagLine(lines[blockStart - 1])) blockStart--;
    while(blockEnd + 1 < lines.length && isTagLine(lines[blockEnd + 1])) blockEnd++;

    return { blockStart: blockStart, blockEnd: blockEnd };
}

function resolveMetadataContext(text, cursorRow) {
    const lines = splitLines(text);
    const row = Number(cursorRow);

    if( !Number.isInteger(row) || row < 0 || row >= lines.length ) return null;

    const commentRows = classifyBlockComments(lines);
    const conditionalRows = classifyConditionalBlocks(lines);
    let dialogueRow = null;
    let blockStart = row;
    let blockEnd = row - 1;

    const tagAtCursor = parseTagLine(lines[row], row);
    if( tagAtCursor && tagAtCursor.isSupported ) {
        const block = findTagBlock(lines, row);
        blockStart = block.blockStart;
        blockEnd = block.blockEnd;
        dialogueRow = blockEnd + 1;

        if( !isSupportedDialogueLine(lines, dialogueRow, commentRows, conditionalRows) ) {
            return null;
        }
    } else if( isSupportedDialogueLine(lines, row, commentRows, conditionalRows) ) {
        dialogueRow = row;

        if( row > 0 && isTagLine(lines[row - 1]) ) {
            blockEnd = row - 1;
            blockStart = blockEnd;
            while(blockStart > 0 && isTagLine(lines[blockStart - 1])) blockStart--;
        }
    } else {
        return null;
    }

    return {
        type: "dialogue",
        dialogueRow: dialogueRow,
        lineNumber: dialogueRow + 1,
        blockStart: blockStart,
        blockEnd: blockEnd,
        metadata: parseMetadataBlock(lines, blockStart, blockEnd),
        lines: lines
    };
}

exports.splitLines = splitLines;
exports.isSupportedDialogueLine = isSupportedDialogueLine;
exports.resolveMetadataContext = resolveMetadataContext;
