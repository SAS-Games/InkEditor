# Dialogue metadata inspector

The dialogue metadata inspector is a collapsible pane on the right side of Inky. It edits ordinary Ink tags attached to a selected content line. The `.ink` document remains the only source of truth, continues to use official Ink syntax, and follows Inky's normal compile, preview, undo, save, include, and export workflows.

## Supported tags

Version 1 manages these canonical, case-insensitive keys:

| Inspector field | Ink tag |
| --- | --- |
| Line ID | `# id:guard_warning_01` |
| Localization Key | `# locale:dialogue.guard.warning_01` |
| Speaker | `# speaker:guard` |
| Portrait | `# portrait:angry` |
| Animation | `# animation:TalkAngry` |
| Audio | `# audio:guard_warning_01` |

Whitespace around `:` is accepted while reading. Writes use a single space after `#`, a lowercase canonical key, and no whitespace after `:`. Clearing a field removes the corresponding tag nearest the selected dialogue line. If duplicate managed tags exist, the inspector warns and edits only the tag nearest the dialogue line. The explicit **Remove all managed metadata** action removes every supported tag in the block.

Unsupported tags are left in place and retain their original text and ordering.

## Selecting a context

When the cursor is on a regular dialogue/content line, the inspector scans the contiguous block of tag lines immediately above it. Scanning stops at a blank or non-tag line. When the cursor is on a supported managed tag, the inspector associates the entire contiguous tag block with the first regular content line directly below it.

Version 1 deliberately fails closed on choices, knots, stitches, gathers, diverts, declarations, comments, and conditional blocks. Those locations show **No supported dialogue line selected.** Future context resolvers can add those constructs without changing the tag parser or document editor.

## Optional project configuration

Place a JSON file beside the main Ink story and give it the main story's base name plus `.metadata.json`:

```text
story.ink
story.metadata.json
```

Example:

```json
{
  "schemaVersion": 1,
  "tags": {
    "speaker": { "values": ["player", "guard", "merchant"] },
    "portrait": { "values": ["neutral", "happy", "angry"] },
    "animation": { "values": ["Idle", "Talk", "TalkAngry"] },
    "audio": { "values": ["guard_warning_01"] }
  }
}
```

Configured values appear as suggestions in editable fields. Writers may still enter free text. Missing configuration, malformed JSON, unsupported schema versions, and catalog mismatches produce non-blocking warnings and never prevent Ink from being saved. Configuration is parsed strictly as JSON and is never evaluated as JavaScript.

See `examples/dialogue-metadata/` for a complete Ink story and matching configuration.

## Validation

The inspector warns about:

- empty managed tag values;
- duplicate managed tags;
- line IDs and localization keys that do not match `^[A-Za-z0-9][A-Za-z0-9_.-]*$`;
- configured catalog mismatches;
- missing, malformed, or unsupported metadata configuration.

Warnings do not block editing, compilation, or saving.

## Development and packaging

The project requires Node 18 or later because the current development dependencies include jsdom 24. Node 20 with npm 10 is recommended and matches Electron 30's embedded Node generation.

From `app/`:

```sh
npm install
npm test
npm start
npm run build-package -- win64
```

The inherited Spectron suite is retained separately as `npm run test:e2e`; it requires a compatible Spectron installation and a prebuilt platform package, and is not part of the default unit test command.

## Version 1 limitations

- Only regular dialogue/content lines are resolved.
- The configuration file is loaded when a project opens and after the main story is saved; it is not a metadata assignment store.
- Catalogs provide suggestions rather than enforced enums.
- Inline tags at the end of content and multiple tags on one standalone line are not managed.
- The current LittleAdventure Unity runtime uses a compound `speaker:id::..., image::..., anim::...` value and commonly writes `local`. It accepts canonical `locale` and `audio`, but it does not yet consume separate `portrait`, `animation`, or line `id` tags. Unity integration is outside Version 1 and requires a later runtime adapter or processor update.
