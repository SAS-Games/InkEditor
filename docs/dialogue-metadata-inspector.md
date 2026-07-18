# Ink metadata inspector

The metadata inspector is a collapsible pane on the right side of Inky. It edits ordinary Ink tags attached to regular dialogue/content lines and visible choices. The `.ink` document remains the source of truth and continues to use the official compiler, preview, undo, save, include, and export workflows.

## Built-in fields

The inspector provides these canonical, case-insensitive fields without requiring configuration:

| Inspector field | Ink tag |
| --- | --- |
| ID | `# id:guard_warning_01` |
| Localization Key | `# locale:dialogue.guard.warning_01` |
| Speaker | `# speaker:guard` |
| Portrait | `# portrait:angry` |
| Animation | `# animation:TalkAngry` |
| Audio | `# audio:guard_warning_01` |

Whitespace around `:` is accepted while reading. Writes use a single space after `#`, a lowercase canonical key, and no whitespace after `:`. Clearing a field removes the corresponding effective tag. If duplicate managed tags exist, the inspector warns and edits only the final/nearest occurrence. **Remove all managed metadata** removes all fields managed in the current context.

Unknown tags remain in place, retain their text and order, and are not affected by **Remove all managed metadata**.

## Dialogue metadata

Dialogue metadata uses a contiguous block of tag-only lines immediately above the content:

```ink
# id:guard.warning
# speaker:guard
# portrait:angry
# quest:forest_gate
You cannot enter the forest tonight.
```

Place the cursor on the content or on any managed tag in its block. Scanning stops at a blank or non-tag line. Here, `quest` is preserved as an unknown tag unless the project configuration declares it as a custom field.

## Choice metadata

Choice metadata uses Ink's native inline choice tags. Tags must be part of the choice's display-text segment so they are generated before the player selects the choice:

```ink
* [Ask about the gate # id:choice.ask_gate # locale:choice.ask_gate] -> ask_gate
+ [Ask again # audio:ui.select # analytics_event:gate.ask_again] -> ask_gate
```

Place the cursor anywhere on the `*` or `+` choice line. For bracketed choices, the tags must be inside the choice-only brackets so Ink exposes them before selection through `Choice.tags`; the inspector inserts new fields immediately before `]`. For unbracketed choices, it inserts them at the end of the visible choice text before `->`.

The resolver supports ordinary, sticky, named, and inline-conditional choices. It deliberately fails closed for invisible fallback choices, blank choices, choice tags placed after a divert, and choices inside multiline conditional blocks.

## Portrait semantics

`portrait` is a stable lookup value, not an image path and not image data:

```ink
# speaker:kairos
# portrait:angry
Kairos: You should not have come here.
```

The game decides how `speaker:kairos` plus `portrait:angry` maps to a Sprite, Addressable, texture, or other UI asset. An absent portrait tag can mean "use the default" or "keep the current portrait," depending on the runtime contract. Inky only edits the tag text.

## Project-defined custom fields

Place a JSON file beside the main Ink story and give it the main story's base name plus `.metadata.json`:

```text
story.ink
story.metadata.json
```

Schema Version 2 can add fields without changing Inky's JavaScript:

```json
{
  "schemaVersion": 2,
  "tags": {
    "speaker": {
      "values": ["player", "guard", "merchant"],
      "contexts": ["dialogue"]
    },
    "mood": {
      "label": "Emotional State",
      "values": ["calm", "curious", "suspicious"],
      "contexts": ["dialogue", "choice"]
    },
    "analytics_event": {
      "label": "Analytics Event",
      "contexts": ["choice"]
    }
  }
}
```

Each entry supports:

- `label`: optional inspector label; a readable label is generated from the key when omitted.
- `values`: optional array of editable suggestions. Values are suggestions, not an enforced enum.
- `contexts`: optional array containing `dialogue`, `choice`, or both. Both contexts are used when omitted.

Custom keys must match `^[A-Za-z][A-Za-z0-9_.-]*$`. Keys are written in lowercase. The built-in field entries may also supply catalogs, labels, or narrower contexts. Schema Version 1 configurations remain compatible for built-in catalogs, but custom fields require Version 2.

The configuration is parsed strictly as JSON and is never evaluated as JavaScript. Missing, malformed, or invalid configuration produces non-blocking warnings and leaves the built-in free-text fields available.

See `examples/dialogue-metadata/` for a complete story containing dialogue metadata, choice metadata, a configured custom field, and an unknown preserved tag.

## Runtime access

After continuing dialogue, read the generated line tags from the story's current tags collection. Before selecting a choice, read each generated choice's tags:

```csharp
foreach (Choice choice in story.currentChoices)
{
    IEnumerable<string> tags = choice.tags;
}
```

Ink supplies tag strings; the game remains responsible for splitting `key:value`, validating values, and performing actions.

## Validation

The inspector warns about:

- empty managed tag values;
- duplicate managed tags;
- IDs and localization keys that do not match `^[A-Za-z0-9][A-Za-z0-9_.-]*$`;
- configured catalog mismatches;
- invalid custom keys, labels, catalogs, or contexts;
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

## Current limitations

- Regular dialogue uses tag-only lines above the content; inline tags at the end of regular dialogue are not managed.
- Choice metadata is limited to a single choice line and does not resolve invisible fallback or multiline conditional choices.
- The configuration file is loaded when a project opens and after the main story is saved; it is not watched continuously and is not a metadata assignment store.
- The current LittleAdventure Unity runtime uses a compound `speaker:id::..., image::..., anim::...` value and commonly writes `local`. It accepts canonical `locale` and `audio`, but it does not yet consume separate `portrait`, `animation`, line `id`, or project-defined custom tags. Unity integration requires a separate runtime adapter or processor update.
