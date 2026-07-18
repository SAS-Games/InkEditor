const { canonicalMetadataKey } = require("./metadataDefinitions.js");

function replaceLineEdit(lines, row, newLine) {
    return {
        start: { row: row, column: 0 },
        end: { row: row, column: lines[row].length },
        text: newLine
    };
}

function insertLineEdit(row, newLine) {
    return {
        start: { row: row, column: 0 },
        end: { row: row, column: 0 },
        text: newLine + "\n"
    };
}

function removeLineEdit(row) {
    return {
        start: { row: row, column: 0 },
        end: { row: row + 1, column: 0 },
        text: ""
    };
}

function setMetadataValue(context, key, value) {
    const canonicalKey = canonicalMetadataKey(key);
    if( !context || !canonicalKey ) return null;

    const normalizedValue = String(value == null ? "" : value).trim();
    const occurrences = context.metadata.occurrences[canonicalKey] || [];
    const nearestOccurrence = occurrences.length ? occurrences[occurrences.length - 1] : null;

    if( normalizedValue.length === 0 ) {
        return nearestOccurrence ? removeLineEdit(nearestOccurrence.row) : null;
    }

    if( nearestOccurrence ) {
        const canonicalLine = nearestOccurrence.indent + "# " + canonicalKey + ":" + normalizedValue;
        if( canonicalLine === context.lines[nearestOccurrence.row] ) return null;
        return replaceLineEdit(context.lines, nearestOccurrence.row, canonicalLine);
    }

    const dialogueLine = context.lines[context.dialogueRow] || "";
    const indent = (dialogueLine.match(/^\s*/) || [""])[0];
    return insertLineEdit(context.dialogueRow, indent + "# " + canonicalKey + ":" + normalizedValue);
}

function removeAllManagedMetadata(context) {
    if( !context || context.blockStart > context.blockEnd ) return null;

    const remainingLines = context.metadata.entries
        .filter(entry => !entry.isSupported)
        .map(entry => entry.rawLine);

    if( remainingLines.length === context.metadata.entries.length ) return null;

    return {
        start: { row: context.blockStart, column: 0 },
        end: { row: context.blockEnd + 1, column: 0 },
        text: remainingLines.length ? remainingLines.join("\n") + "\n" : ""
    };
}

function positionToOffset(text, position) {
    const lines = String(text).split("\n");
    let offset = 0;

    for(let row = 0; row < position.row; row++) {
        offset += (lines[row] || "").length + 1;
    }

    return offset + position.column;
}

function applyEditToText(text, edit) {
    if( !edit ) return text;

    const normalizedText = String(text).replace(/\r\n|\r/g, "\n");
    const startOffset = positionToOffset(normalizedText, edit.start);
    const endOffset = positionToOffset(normalizedText, edit.end);
    return normalizedText.substring(0, startOffset) + edit.text + normalizedText.substring(endOffset);
}

exports.setMetadataValue = setMetadataValue;
exports.removeAllManagedMetadata = removeAllManagedMetadata;
exports.applyEditToText = applyEditToText;
