const { canonicalMetadataKey } = require("./metadataDefinitions.js");
const {
    LOCALIZATION_ARGUMENT_KEY,
    serializeLocalizationArgument
} = require("./metadataLocalizationArguments.js");

function replaceLineEdit(lines, row, newLine) {
    return {
        start: { row: row, column: 0 },
        end: { row: row, column: lines[row].length },
        text: newLine
    };
}

function replaceInlineEdit(row, startColumn, endColumn, text) {
    return {
        start: { row: row, column: startColumn },
        end: { row: row, column: endColumn },
        text: text
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

function removeChoiceEntries(line, entries) {
    let updatedLine = line;
    const orderedEntries = entries.slice().sort((left, right) => right.startColumn - left.startColumn);

    orderedEntries.forEach(entry => {
        let startColumn = entry.startColumn;
        while(startColumn > 0 && /\s/.test(line[startColumn - 1])) startColumn--;
        updatedLine = updatedLine.substring(0, startColumn) + updatedLine.substring(entry.endColumn);
    });

    return updatedLine;
}

function setChoiceMetadataValue(context, canonicalKey, normalizedValue, nearestOccurrence) {
    const row = context.choiceRow;
    const line = context.lines[row];

    if( normalizedValue.length === 0 ) {
        if( !nearestOccurrence ) return null;
        return replaceLineEdit(context.lines, row, removeChoiceEntries(line, [nearestOccurrence]));
    }

    const canonicalTag = "# " + canonicalKey + ":" + normalizedValue;
    if( nearestOccurrence ) {
        if( canonicalTag === line.substring(nearestOccurrence.startColumn, nearestOccurrence.endColumn) ) return null;
        return replaceInlineEdit(row, nearestOccurrence.startColumn, nearestOccurrence.endColumn, canonicalTag);
    }

    return replaceInlineEdit(row, context.insertColumn, context.insertColumn, " " + canonicalTag);
}

function setMetadataValue(context, key, value) {
    const canonicalKey = canonicalMetadataKey(key, context && context.definitions);
    if( !context || !canonicalKey ) return null;

    const normalizedValue = String(value == null ? "" : value).trim();
    const occurrences = context.metadata.occurrences[canonicalKey] || [];
    const nearestOccurrence = occurrences.length ? occurrences[occurrences.length - 1] : null;

    if( context.type === "choice" ) {
        return setChoiceMetadataValue(context, canonicalKey, normalizedValue, nearestOccurrence);
    }

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

function setLocalizationArgument(context, occurrenceIndex, argument) {
    if( !context ) return null;

    const serializedValue = serializeLocalizationArgument(argument);
    const occurrences = context.metadata.occurrences[LOCALIZATION_ARGUMENT_KEY] || [];
    const occurrence = Number.isInteger(occurrenceIndex) ? occurrences[occurrenceIndex] : null;
    const canonicalTag = "# " + LOCALIZATION_ARGUMENT_KEY + ":" + serializedValue;

    if( context.type === "choice" ) {
        const row = context.choiceRow;
        const line = context.lines[row];
        if( occurrence ) {
            if( canonicalTag === line.substring(occurrence.startColumn, occurrence.endColumn) ) return null;
            return replaceInlineEdit(row, occurrence.startColumn, occurrence.endColumn, canonicalTag);
        }
        return replaceInlineEdit(row, context.insertColumn, context.insertColumn, " " + canonicalTag);
    }

    if( occurrence ) {
        const canonicalLine = occurrence.indent + canonicalTag;
        if( canonicalLine === context.lines[occurrence.row] ) return null;
        return replaceLineEdit(context.lines, occurrence.row, canonicalLine);
    }

    const dialogueLine = context.lines[context.dialogueRow] || "";
    const indent = (dialogueLine.match(/^\s*/) || [""])[0];
    return insertLineEdit(context.dialogueRow, indent + canonicalTag);
}

function removeLocalizationArgument(context, occurrenceIndex) {
    if( !context || !Number.isInteger(occurrenceIndex) ) return null;

    const occurrences = context.metadata.occurrences[LOCALIZATION_ARGUMENT_KEY] || [];
    const occurrence = occurrences[occurrenceIndex];
    if( !occurrence ) return null;

    if( context.type === "choice" ) {
        const updatedLine = removeChoiceEntries(context.lines[context.choiceRow], [occurrence]);
        return replaceLineEdit(context.lines, context.choiceRow, updatedLine);
    }

    return removeLineEdit(occurrence.row);
}

function removeAllManagedMetadata(context) {
    if( !context ) return null;

    if( context.type === "choice" ) {
        const managedEntries = context.metadata.entries.filter(entry => entry.isSupported && !entry.isDiscovered);
        if( managedEntries.length === 0 ) return null;

        const updatedLine = removeChoiceEntries(context.lines[context.choiceRow], managedEntries);
        return replaceLineEdit(context.lines, context.choiceRow, updatedLine);
    }

    if( context.blockStart > context.blockEnd ) return null;

    const remainingLines = context.metadata.entries
        .filter(entry => !entry.isSupported || entry.isDiscovered)
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
exports.setLocalizationArgument = setLocalizationArgument;
exports.removeLocalizationArgument = removeLocalizationArgument;
exports.removeAllManagedMetadata = removeAllManagedMetadata;
exports.applyEditToText = applyEditToText;
