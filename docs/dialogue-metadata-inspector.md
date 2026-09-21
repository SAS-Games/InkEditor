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
| Story Skip | `# skip:enable` |

Whitespace around `:` is accepted while reading. Writes use a single space after `#`, a lowercase canonical key, and no whitespace after `:`. Clearing a field removes the corresponding effective tag. If duplicate managed tags exist, the inspector warns and edits only the final/nearest occurrence. **Remove all managed metadata** removes built-in and configured fields managed in the current context.

Valid undeclared `key:value` tags automatically appear as editable fields with a **Custom** badge when their line is selected. They retain their text and order and are deliberately preserved by **Remove all managed metadata**; clear the individual custom field to remove it. Raw tags that do not use `key:value` syntax are preserved but are not shown as fields.

## Story skip control

Use dialogue metadata to decide when a Unity story-skip button becomes available:

```ink
# skip:enable
You have heard enough to leave whenever you want.
```

`enable` unlocks story skipping after the tagged line has finished presenting. The permission remains active on later lines and choices, so the player can either keep advancing line by line or press Skip. A later `# skip:disable` line revokes the permission after that line finishes. Each new dialogue session starts with skipping disabled.

The Unity `DialogueStorySkipButton` component reads this state from `DialogueHandler`. Pressing it exits the current dialogue immediately; it does not evaluate skipped Ink lines, select choices, or invoke external functions in the skipped content. Put required game-state changes before the unlock point or handle them from the normal dialogue-end event.

## Dialogue metadata

Dialogue metadata uses a contiguous block of tag-only lines immediately above the content:

```ink
# id:guard.warning
# speaker:guard
# portrait:angry
# quest:forest_gate
You cannot enter the forest tonight.
```

Place the cursor on the content or on any well-formed `key:value` tag in its block. Scanning stops at a blank or non-tag line. Here, `quest` automatically appears as an editable custom field. Declaring it in the project configuration is optional and adds a stable label, suggestions, and context restrictions.

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

## Generic conversation roles

Conversation roles are optional and composable. `speaker` identifies the active voice. A configured `listener` identifies the primary addressee when the game needs to keep both characters visible:

```ink
# speaker:alice
# portrait:happy
# listener:bob
# listener_portrait:concerned
Alice: We should leave.
```

The same fields cover different narrative forms without a separate mode:

```ink
The wind moved through the empty hall. // narration: no roles required

# speaker:alice
# portrait:concerned
Alice: I need to think. // monologue: no listener required

# speaker:bob
# listener:alice
Bob: I agree. // dialogue: active speaker plus optional listener
```

`listener` is the recommended optional second role. For additional or domain-specific participants, use the explicit `participant.<role>` namespace:

```ink
# participant.interviewer:maya
# participant.interviewer.name:Detective Maya
# participant.interviewer.portrait:focused
# participant.interviewer.animation:Question
What did you see?
```

Only the role ID (`participant.interviewer:maya`) is required. The matching name, portrait, and animation tags are optional, so a choice or line does not need to show every field. Explicit namespacing keeps generic roles distinct from ordinary custom tags such as `mood` or `quest`.

## Project-defined custom fields

Use the inspector's **Configuration** tab to manage project fields without writing JSON by hand. The workflow is:

1. Save the main `.ink` story so Inky knows where the project sidecar belongs.
2. Open **Configuration** in the right inspector.
3. Select a built-in field to set its label, Dialogue/Choice availability, and suggested values, then choose **Save field**.
4. Under **Add custom field**, enter a tag key such as `listener`, `listener_portrait`, or `participant.interviewer`. Add each optional participant detail (for example `participant.interviewer.portrait`) as its own field. New custom fields start in both Dialogue and Choice contexts; select the new field afterward if you want to narrow it.
5. Return to **Metadata** to assign the configured fields on dialogue and choice lines.

Suggested values are one per line. They provide autocomplete choices while remaining editable, so a writer can still enter a value that is not in the list. **Reset override** restores a built-in field's defaults. **Remove field** removes a custom field from project configuration; it does not delete tags already written in `.ink` files.

The Configuration tab creates a JSON file beside the main Ink story using the main story's base name plus `.metadata.json`:

```text
story.ink
story.metadata.json
```

The UI writes Schema Version 2. The resulting file can still be reviewed, version-controlled, or edited by advanced users:

```json
{
  "schemaVersion": 2,
  "tags": {
    "speaker": {
      "values": ["player", "guard", "merchant"],
      "contexts": ["dialogue"]
    },
    "listener": {
      "label": "Listener",
      "values": ["player", "guard", "merchant"],
      "contexts": ["dialogue"]
    },
    "listener_portrait": {
      "label": "Listener Portrait",
      "values": ["neutral", "happy", "concerned"],
      "contexts": ["dialogue"]
    },
    "participant.interviewer": {
      "label": "Interviewer",
      "values": ["maya", "guard"],
      "contexts": ["dialogue"]
    },
    "participant.interviewer.portrait": {
      "label": "Interviewer Portrait",
      "values": ["neutral", "focused"],
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

The editor preserves unrelated top-level properties and unrelated properties inside an existing tag definition. It re-reads the file before every write so external changes are retained. The configuration is parsed strictly as JSON and is never evaluated as JavaScript. If the file is malformed, Configuration editing is disabled and Inky will not overwrite it; fix the JSON manually and reopen or save the project to reload it. Missing or invalid configuration produces non-blocking warnings and leaves the built-in free-text fields available.

See `examples/dialogue-metadata/` for a complete story containing dialogue metadata, optional listener roles, choice metadata, configured custom fields, and an automatically discovered tag.

## Runtime access

After continuing dialogue, read the generated line tags from the story's current tags collection. Before selecting a choice, read each generated choice's tags:

```csharp
foreach (Choice choice in story.currentChoices)
{
    IEnumerable<string> tags = choice.tags;
}
```

Ink supplies tag strings. In LittleAdventure, `DialogueMetadataParser` turns those strings into a validated context for both lines and choices by using the active `DialogueMetadataProfile`:

```csharp
DialogueMetadataSchema schema = metadataProfile.GetSchema();
DialogueLineContext line = DialogueMetadataParser.ParseLine(text, story.currentTags, schema);

if (line.TryGetParticipant("listener", out DialogueParticipant listener))
{
    string characterId = listener.CharacterId;
    string portraitKey = listener.PortraitKey;
}

if (line.TryGetTagValue("quest", out string questId))
{
    // React to project-specific metadata.
}
```

The default profile maps the documented canonical fields to the runtime's standard `speaker` and `listener` roles. A project can instead map tags such as `actor`, `face`, and `loc_key` onto the same runtime semantics, or configure a different generic participant prefix and suffixes. Other valid keys remain arbitrary custom metadata.

### Vanilla Ink and configurable Unity tag names

The customized Inky editor is optional at runtime. A writer can use official Ink/Inky and ordinary tags:

```ink
Hello there.
# actor:mira
# actor_display:Mira
# face:happy
# loc_key:dialogue.mira.hello
# mood:friendly
```

Create a **Dialogue > Metadata Profile** asset in Unity and map:

| Runtime semantic | Project tag |
| --- | --- |
| Localization | `loc_key` |
| Story skip permission | `skip` (or the profile's configured skip tag) |
| Participant `speaker` ID | `actor` |
| Participant `speaker` name | `actor_display` |
| Participant `speaker` portrait | `face` |

Assign the profile as the handler's default, or assign a per-story override on `DialogueTrigger`. Presenters consume stable runtime properties and do not know which Ink tag supplied them. Unmapped tags such as `mood` remain available through `TryGetTagValue`.

The `.metadata.json` sidecar configures this Inky inspector's fields, labels, contexts, and suggested values. It does not rename Ink tags or control Unity runtime semantics. If both tools are used, give the Inky field and the Unity profile binding the same project-owned tag key.

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
- The configuration file is loaded when a project opens, after the main story is saved, and after every Configuration-tab edit. External edits are not watched continuously; save or reopen the project to reload them. The sidecar is field configuration, not a metadata assignment store.
- An undeclared custom field appears only when that tag already exists in the selected context. Declare it in `.metadata.json` when writers need an empty field available for new assignments.
- Unity profile changes do not rewrite existing `.ink` content. Migrate the Ink tag text when changing a project-owned key, or use separate old/new profiles while different stories are being migrated.
- The default LittleAdventure profile intentionally does not support the legacy compound `speaker:id::..., image::..., anim::...` format.
