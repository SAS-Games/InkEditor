const assert = require("assert").strict;
const fs = require("fs");
const os = require("os");
const path = require("path");

const { resolveMetadataContext } = require("../renderer/metadataContextResolver.js");
const {
    setMetadataValue,
    removeAllManagedMetadata,
    applyEditToText
} = require("../renderer/metadataDocumentEditor.js");
const {
    metadataPathForMainInk,
    loadMetadataConfiguration
} = require("../renderer/metadataConfigurationLoader.js");
const { validateMetadata } = require("../renderer/metadataValidator.js");

function editMetadata(text, row, key, value) {
    const context = resolveMetadataContext(text, row);
    return applyEditToText(text, setMetadataValue(context, key, value));
}

describe("dialogue metadata parsing and context resolution", function() {
    it("reads all supported tags", function() {
        const text = [
            "# id:guard_warning_01",
            "# locale:dialogue.guard.warning_01",
            "# speaker:guard",
            "# portrait:angry",
            "# animation:TalkAngry",
            "# audio:guard_warning_01",
            "You cannot enter the forest tonight."
        ].join("\n");

        const context = resolveMetadataContext(text, 6);
        assert.deepEqual(context.metadata.values, {
            id: "guard_warning_01",
            locale: "dialogue.guard.warning_01",
            speaker: "guard",
            portrait: "angry",
            animation: "TalkAngry",
            audio: "guard_warning_01"
        });
    });

    it("tolerates whitespace around tag separators", function() {
        const context = resolveMetadataContext("# speaker :   guard   \nHello.", 1);
        assert.equal(context.metadata.values.speaker, "guard");
    });

    it("recognizes supported keys case-insensitively", function() {
        const context = resolveMetadataContext("# SpEaKeR:guard\nHello.", 1);
        assert.equal(context.metadata.values.speaker, "guard");
        assert.equal(context.metadata.occurrences.speaker[0].key, "SpEaKeR");
    });

    it("uses the supported dialogue line under the cursor", function() {
        const context = resolveMetadataContext("# speaker:guard\nHello.\nOther line.", 1);
        assert.equal(context.type, "dialogue");
        assert.equal(context.dialogueRow, 1);
        assert.equal(context.lineNumber, 2);
    });

    it("associates a supported metadata tag with the following dialogue line", function() {
        const context = resolveMetadataContext("# id:greeting\n# speaker:guard\nHello.", 0);
        assert.equal(context.dialogueRow, 2);
        assert.equal(context.metadata.values.id, "greeting");
        assert.equal(context.metadata.values.speaker, "guard");
    });

    it("returns no context for unsupported or ambiguous locations", function() {
        const cases = [
            { text: "== knot ==", row: 0 },
            { text: "* [A choice] -> next", row: 0 },
            { text: "-> END", row: 0 },
            { text: "// A comment", row: 0 },
            { text: "/*\nComment content\n*/", row: 1 },
            { text: "{ condition:\n    Conditional content\n}", row: 1 },
            { text: "# speaker:guard\n\nHello.", row: 0 },
            { text: "# quest:test\nHello.", row: 0 }
        ];

        cases.forEach(testCase => {
            assert.equal(resolveMetadataContext(testCase.text, testCase.row), null, testCase.text);
        });
    });

    it("handles representative Ink constructs conservatively", function() {
        const fixturePath = path.join(__dirname, "fixtures", "dialogue-metadata.ink");
        const text = fs.readFileSync(fixturePath, "utf8");
        const lines = text.split(/\r\n|\r|\n/);
        const dialogueRow = lines.indexOf("You cannot enter the forest tonight.");
        const choiceRow = lines.indexOf("* [Ask why] -> ask_guard");
        const commentRow = lines.indexOf("This block comment is not dialogue either.");
        const conditionalRow = lines.indexOf("    This conditional content is outside the Version 1 context.");

        assert.equal(resolveMetadataContext(text, dialogueRow).metadata.values.audio, "guard_warning_01");
        assert.equal(resolveMetadataContext(text, choiceRow), null);
        assert.equal(resolveMetadataContext(text, commentRow), null);
        assert.equal(resolveMetadataContext(text, conditionalRow), null);
    });
});

describe("dialogue metadata text updates", function() {
    it("updates the matching tag nearest the dialogue line in canonical form", function() {
        const text = "# SPEAKER : old_guard\nHello.\nUnrelated.";
        const updated = editMetadata(text, 1, "speaker", "new_guard");
        assert.equal(updated, "# speaker:new_guard\nHello.\nUnrelated.");
    });

    it("inserts a missing tag directly above the dialogue line", function() {
        const text = "# quest:forest_gate\nHello.\nUnrelated.";
        const updated = editMetadata(text, 1, "speaker", "guard");
        assert.equal(updated, "# quest:forest_gate\n# speaker:guard\nHello.\nUnrelated.");
    });

    it("removes the matching tag when its value is cleared", function() {
        const text = "# speaker:guard\n# quest:forest_gate\nHello.";
        const updated = editMetadata(text, 2, "speaker", "   ");
        assert.equal(updated, "# quest:forest_gate\nHello.");
    });

    it("preserves unknown tags and unrelated Ink content", function() {
        const text = [
            "=== start ===",
            "# quest:forest_gate",
            "# speaker:guard",
            "Hello.",
            "",
            "* [Leave] -> END"
        ].join("\n");

        const updated = editMetadata(text, 3, "speaker", "captain");
        assert.equal(updated, [
            "=== start ===",
            "# quest:forest_gate",
            "# speaker:captain",
            "Hello.",
            "",
            "* [Leave] -> END"
        ].join("\n"));
    });

    it("updates only the nearest duplicate and leaves the other duplicate visible", function() {
        const text = "# speaker:first\n# speaker:nearest\nHello.";
        const context = resolveMetadataContext(text, 2);
        assert.equal(context.metadata.values.speaker, "nearest");
        assert.equal(context.metadata.duplicates.speaker.length, 2);

        const updated = applyEditToText(text, setMetadataValue(context, "speaker", "updated"));
        assert.equal(updated, "# speaker:first\n# speaker:updated\nHello.");
    });

    it("removes only the nearest duplicate when a single field is cleared", function() {
        const text = "# speaker:first\n# speaker:nearest\nHello.";
        const updated = editMetadata(text, 2, "speaker", "");
        assert.equal(updated, "# speaker:first\nHello.");
    });

    it("removes all managed tags explicitly while preserving unknown tags", function() {
        const text = "# speaker:first\n# quest:forest_gate\n# speaker:second\n# audio:voice_01\nHello.";
        const context = resolveMetadataContext(text, 4);
        const updated = applyEditToText(text, removeAllManagedMetadata(context));
        assert.equal(updated, "# quest:forest_gate\nHello.");
    });

    it("produces one minimal edit suitable for a single Ace undo group", function() {
        const text = "# speaker:guard\nHello.";
        const context = resolveMetadataContext(text, 1);
        const edit = setMetadataValue(context, "speaker", "captain");

        assert.deepEqual(edit.start, { row: 0, column: 0 });
        assert.deepEqual(edit.end, { row: 0, column: 15 });
        assert.equal(edit.text, "# speaker:captain");
    });
});

describe("dialogue metadata validation", function() {
    it("warns about empty values, duplicates, invalid identifiers, and catalog mismatches", function() {
        const text = [
            "# id:bad id",
            "# locale:bad locale",
            "# speaker:",
            "# portrait:unknown",
            "# portrait:nearest_unknown",
            "Hello."
        ].join("\n");
        const context = resolveMetadataContext(text, 5);
        const messages = validateMetadata(context, {
            status: "loaded",
            catalogs: { portrait: ["neutral", "angry"] },
            warnings: []
        });
        const codes = messages.map(message => message.code);

        assert(codes.includes("invalid-id"));
        assert(codes.includes("invalid-locale"));
        assert(codes.includes("empty-speaker"));
        assert(codes.includes("duplicate-portrait"));
        assert(codes.includes("catalog-portrait"));
    });
});

describe("metadata configuration loading", function() {
    const temporaryDirectories = [];

    afterEach(function() {
        temporaryDirectories.splice(0).forEach(directory => {
            fs.rmSync(directory, { recursive: true, force: true });
        });
    });

    function createStoryDirectory() {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), "inky-metadata-"));
        temporaryDirectories.push(directory);
        const mainInkPath = path.join(directory, "story.ink");
        fs.writeFileSync(mainInkPath, "Hello.", "utf8");
        return { directory: directory, mainInkPath: mainInkPath };
    }

    it("loads a valid schemaVersion 1 configuration", function() {
        const story = createStoryDirectory();
        const configPath = metadataPathForMainInk(story.mainInkPath);
        fs.writeFileSync(configPath, JSON.stringify({
            schemaVersion: 1,
            tags: {
                speaker: { values: ["player", "guard", "guard"] },
                portrait: { values: ["neutral", "angry"] },
                animation: { values: ["Idle", "Talk"] },
                audio: { values: ["guard_warning_01"] }
            }
        }), "utf8");

        const loaded = loadMetadataConfiguration(story.mainInkPath);
        assert.equal(loaded.status, "loaded");
        assert.deepEqual(loaded.catalogs.speaker, ["player", "guard"]);
        assert.deepEqual(loaded.catalogs.animation, ["Idle", "Talk"]);
        assert.equal(loaded.warnings.length, 0);
    });

    it("handles a missing configuration non-destructively", function() {
        const story = createStoryDirectory();
        const loaded = loadMetadataConfiguration(story.mainInkPath);

        assert.equal(loaded.status, "missing");
        assert.deepEqual(loaded.catalogs, {});
        assert.match(loaded.warnings[0], /free-text/i);
    });

    it("reports malformed JSON without evaluating it", function() {
        const story = createStoryDirectory();
        fs.writeFileSync(metadataPathForMainInk(story.mainInkPath), "{ not valid json", "utf8");

        const loaded = loadMetadataConfiguration(story.mainInkPath);
        assert.equal(loaded.status, "malformed");
        assert.deepEqual(loaded.catalogs, {});
        assert.match(loaded.warnings[0], /invalid JSON/i);
    });
});
