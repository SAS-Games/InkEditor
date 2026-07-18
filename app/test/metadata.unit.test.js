const assert = require("assert").strict;
const fs = require("fs");
const os = require("os");
const path = require("path");
const { JSDOM } = require("jsdom");
const inkjs = require("inkjs");

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
const { MetadataInspectorView } = require("../renderer/metadataInspectorView.js");

function editMetadata(text, row, key, value, definitions) {
    const context = resolveMetadataContext(text, row, definitions);
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
            { text: "* -> next", row: 0 },
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
        const choiceRow = lines.indexOf("* [Ask why # id:choice.ask_guard] -> ask_guard");
        const commentRow = lines.indexOf("This block comment is not dialogue either.");
        const conditionalRow = lines.indexOf("    This conditional content remains outside the metadata context.");

        assert.equal(resolveMetadataContext(text, dialogueRow).metadata.values.audio, "guard_warning_01");
        assert.equal(resolveMetadataContext(text, choiceRow).metadata.values.id, "choice.ask_guard");
        assert.equal(resolveMetadataContext(text, commentRow), null);
        assert.equal(resolveMetadataContext(text, conditionalRow), null);
    });
});

describe("choice metadata parsing and context resolution", function() {
    it("reads native inline tags before a terminal divert", function() {
        const context = resolveMetadataContext(
            "* [Ask about the gate # id:choice.ask_gate # locale:choice.ask_gate] -> ask_gate",
            0
        );

        assert.equal(context.type, "choice");
        assert.equal(context.choiceRow, 0);
        assert.equal(context.metadata.values.id, "choice.ask_gate");
        assert.equal(context.metadata.values.locale, "choice.ask_gate");
    });

    it("supports sticky, named, and conditional choices", function() {
        const cases = [
            "+ [Ask again # id:choice.ask_again] -> ask",
            "* (ask_guard) [Ask the guard # id:choice.ask_guard] -> ask",
            "* {has_key} [Open the gate # id:choice.open_gate] -> open"
        ];

        cases.forEach(text => {
            const context = resolveMetadataContext(text, 0);
            assert.equal(context.type, "choice", text);
            assert.match(context.metadata.values.id, /^choice\./);
        });
    });

    it("keeps unknown inline tags visible while parsing managed tags", function() {
        const context = resolveMetadataContext(
            "* [Enter # quest:forest_gate # audio:ui.confirm] -> enter",
            0
        );

        assert.equal(context.metadata.entries[0].isSupported, false);
        assert.equal(context.metadata.entries[0].rawText, "# quest:forest_gate");
        assert.equal(context.metadata.values.audio, "ui.confirm");
    });

    it("fails closed for fallback, blank, multiline conditional, and malformed tag placement", function() {
        const cases = [
            { text: "* -> fallback", row: 0 },
            { text: "* [] output only -> next", row: 0 },
            { text: "{ condition:\n    * [Nested choice] -> next\n}", row: 1 },
            { text: "* [Choice] # id:post_selection -> next", row: 0 },
            { text: "* [Choice] -> next # id:invalid_position", row: 0 }
        ];

        cases.forEach(testCase => {
            assert.equal(resolveMetadataContext(testCase.text, testCase.row), null, testCase.text);
        });
    });

    it("emits inline fields through the bundled Ink runtime as Choice.tags", function() {
        const source = [
            "Choose.",
            "* [Ask # id:choice.ask # analytics_event:gate.ask] -> END",
            "* Leave # id:choice.leave -> END"
        ].join("\n");
        const story = new inkjs.Compiler(source).Compile();

        while(story.canContinue) story.Continue();

        assert.deepEqual(story.currentChoices[0].tags, ["id:choice.ask", "analytics_event:gate.ask"]);
        assert.deepEqual(story.currentChoices[1].tags, ["id:choice.leave"]);
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

describe("choice metadata text updates", function() {
    it("inserts a missing tag immediately before the terminal divert", function() {
        const text = "* [Ask about the gate] -> ask_gate";
        const updated = editMetadata(text, 0, "id", "choice.ask_gate");
        assert.equal(updated, "* [Ask about the gate # id:choice.ask_gate] -> ask_gate");
    });

    it("inserts metadata before the divert for an unbracketed choice", function() {
        const text = "* Ask about the gate -> ask_gate";
        const updated = editMetadata(text, 0, "id", "choice.ask_gate");
        assert.equal(updated, "* Ask about the gate # id:choice.ask_gate -> ask_gate");
    });

    it("appends a missing tag after existing inline tags", function() {
        const text = "* [Enter # quest:forest_gate] -> enter";
        const updated = editMetadata(text, 0, "audio", "ui.confirm");
        assert.equal(updated, "* [Enter # quest:forest_gate # audio:ui.confirm] -> enter");
    });

    it("updates only the final duplicate with a minimal inline edit", function() {
        const text = "* [Ask # id:first # id:nearest] -> ask";
        const context = resolveMetadataContext(text, 0);
        const edit = setMetadataValue(context, "id", "updated");

        assert.deepEqual(edit.start, { row: 0, column: 18 });
        assert.deepEqual(edit.end, { row: 0, column: 30 });
        assert.equal(edit.text, "# id:updated");
        assert.equal(
            applyEditToText(text, edit),
            "* [Ask # id:first # id:updated] -> ask"
        );
    });

    it("clears a managed choice tag without disturbing unknown tags or the divert", function() {
        const text = "* [Enter # quest:forest_gate # audio:ui.confirm] -> enter";
        const updated = editMetadata(text, 0, "audio", "");
        assert.equal(updated, "* [Enter # quest:forest_gate] -> enter");
    });

    it("removes all managed choice tags while preserving custom tags in order", function() {
        const text = "* [Enter # id:choice.enter # quest:forest_gate # audio:ui.confirm] -> enter";
        const context = resolveMetadataContext(text, 0);
        const updated = applyEditToText(text, removeAllManagedMetadata(context));
        assert.equal(updated, "* [Enter # quest:forest_gate] -> enter");
    });

    it("inserts choice metadata with one undo-suitable edit", function() {
        const text = "* [Leave] -> END";
        const context = resolveMetadataContext(text, 0);
        const edit = setMetadataValue(context, "audio", "ui.cancel");

        assert.deepEqual(edit.start, { row: 0, column: 8 });
        assert.deepEqual(edit.end, { row: 0, column: 8 });
        assert.equal(edit.text, " # audio:ui.cancel");
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
        assert.equal(loaded.definitions.length, 6);
    });

    it("loads schemaVersion 2 custom fields with labels, catalogs, and contexts", function() {
        const story = createStoryDirectory();
        fs.writeFileSync(metadataPathForMainInk(story.mainInkPath), JSON.stringify({
            schemaVersion: 2,
            tags: {
                speaker: { values: ["guard"], contexts: ["dialogue"] },
                mood: {
                    label: "Emotional State",
                    values: ["calm", "suspicious"],
                    contexts: ["dialogue", "choice"]
                },
                analytics_event: {
                    label: "Analytics Event",
                    contexts: ["choice"]
                }
            }
        }), "utf8");

        const loaded = loadMetadataConfiguration(story.mainInkPath);
        const mood = loaded.definitions.find(definition => definition.key === "mood");
        const analytics = loaded.definitions.find(definition => definition.key === "analytics_event");
        const speaker = loaded.definitions.find(definition => definition.key === "speaker");

        assert.equal(loaded.status, "loaded");
        assert.equal(mood.label, "Emotional State");
        assert.deepEqual(mood.contexts, ["dialogue", "choice"]);
        assert.deepEqual(loaded.catalogs.mood, ["calm", "suspicious"]);
        assert.deepEqual(analytics.contexts, ["choice"]);
        assert.deepEqual(speaker.contexts, ["dialogue"]);
    });

    it("uses custom definitions to edit dialogue and choice metadata", function() {
        const story = createStoryDirectory();
        fs.writeFileSync(metadataPathForMainInk(story.mainInkPath), JSON.stringify({
            schemaVersion: 2,
            tags: {
                mood: { label: "Mood", contexts: ["dialogue", "choice"] },
                analytics: { label: "Analytics", contexts: ["choice"] }
            }
        }), "utf8");

        const loaded = loadMetadataConfiguration(story.mainInkPath);
        assert.equal(
            editMetadata("Hello.", 0, "mood", "calm", loaded.definitions),
            "# mood:calm\nHello."
        );
        assert.equal(
            editMetadata("* [Leave] -> END", 0, "analytics", "choice.leave", loaded.definitions),
            "* [Leave # analytics:choice.leave] -> END"
        );
    });

    it("does not manage a context-restricted custom tag in the wrong context", function() {
        const story = createStoryDirectory();
        fs.writeFileSync(metadataPathForMainInk(story.mainInkPath), JSON.stringify({
            schemaVersion: 2,
            tags: {
                analytics: { contexts: ["choice"] }
            }
        }), "utf8");

        const loaded = loadMetadataConfiguration(story.mainInkPath);
        const dialogue = resolveMetadataContext("# analytics:event\nHello.", 1, loaded.definitions);
        const choice = resolveMetadataContext("* [Leave # analytics:event] -> END", 0, loaded.definitions);

        assert.equal(dialogue.metadata.entries[0].isSupported, false);
        assert.equal(choice.metadata.values.analytics, "event");
    });

    it("ignores custom fields in schemaVersion 1 with a migration warning", function() {
        const story = createStoryDirectory();
        fs.writeFileSync(metadataPathForMainInk(story.mainInkPath), JSON.stringify({
            schemaVersion: 1,
            tags: {
                mood: { values: ["calm"] }
            }
        }), "utf8");

        const loaded = loadMetadataConfiguration(story.mainInkPath);
        assert.equal(loaded.definitions.some(definition => definition.key === "mood"), false);
        assert(loaded.warnings.some(message => /schemaVersion 2/.test(message)));
    });

    it("rejects invalid custom keys and sanitizes invalid contexts", function() {
        const story = createStoryDirectory();
        fs.writeFileSync(metadataPathForMainInk(story.mainInkPath), JSON.stringify({
            schemaVersion: 2,
            tags: {
                "bad key": { label: "Bad" },
                mood: { contexts: ["dialogue", "unsupported"] }
            }
        }), "utf8");

        const loaded = loadMetadataConfiguration(story.mainInkPath);
        const mood = loaded.definitions.find(definition => definition.key === "mood");
        assert.equal(loaded.definitions.some(definition => definition.key === "bad key"), false);
        assert.deepEqual(mood.contexts, ["dialogue"]);
        assert(loaded.warnings.length >= 2);
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

describe("metadata inspector fields", function() {
    function createView() {
        const dom = new JSDOM([
            "<main id='main'>",
            "<aside id='metadata-inspector'>",
            "<button class='metadata-collapse'></button>",
            "<p class='metadata-selection-status'></p>",
            "<span class='metadata-line-number'></span>",
            "<span class='metadata-context-type'></span>",
            "<p class='metadata-configuration-status'></p>",
            "<div class='metadata-fields'></div>",
            "<ul class='metadata-validation-list'></ul>",
            "<button class='metadata-remove-all'></button>",
            "</aside>",
            "</main>"
        ].join(""));

        return { dom: dom, view: new MetadataInspectorView(dom.window.document) };
    }

    it("creates custom fields and filters them by the selected context", function() {
        const testView = createView();
        const definitions = [
            { key: "speaker", label: "Speaker", catalog: true, contexts: ["dialogue"] },
            { key: "analytics", label: "Analytics Event", catalog: false, contexts: ["choice"] }
        ];

        testView.view.setDefinitions(definitions);
        testView.view.renderContext({
            type: "choice",
            lineNumber: 4,
            metadata: { values: { analytics: "choice.leave" } }
        }, {
            status: "loaded",
            path: "story.metadata.json",
            catalogs: {}
        }, []);

        assert.equal(testView.view.contextType.textContent, "Choice");
        assert.equal(testView.view.fields.analytics.value, "choice.leave");
        assert.equal(testView.view.fieldWrappers.analytics.hidden, false);
        assert.equal(testView.view.fieldWrappers.speaker.hidden, true);
    });

    it("routes changes from dynamically created fields", function() {
        const testView = createView();
        let changed = null;
        testView.view.setEvents({ fieldChanged: (key, value) => changed = { key: key, value: value } });
        testView.view.setDefinitions([
            { key: "mood", label: "Mood", catalog: true, contexts: ["dialogue", "choice"] }
        ]);

        testView.view.fields.mood.value = "suspicious";
        testView.view.fields.mood.dispatchEvent(new testView.dom.window.Event("change"));

        assert.deepEqual(changed, { key: "mood", value: "suspicious" });
    });
});
