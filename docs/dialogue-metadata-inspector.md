# Ink metadata inspector

The metadata inspector is a collapsible pane on the right side of Inky. It edits ordinary Ink tags attached to regular dialogue/content lines and visible choices. The `.ink` document remains the source of truth and continues to use the official compiler, preview, undo, save, include, and export workflows.

## Built-in fields

The inspector provides nine canonical, case-insensitive fields without requiring configuration. Every field is optional. Leaving a field empty removes its tag and allows the Unity runtime to use its normal fallback behavior.

| Inspector field | Ink tag | Runtime value or behavior | Built-in Unity consumer |
| --- | --- | --- | --- |
| ID | `# id:chapter.introduction.01` | `DialogueLineContext.LineId` | None; available to custom event, analytics, quest, save, voice-over, test, or debugging code |
| Localization Key | `# locale:dialogue.introduction.01` | `DialogueLineContext.Locale` | `DialogueLocaleTextPresenter` for dialogue and `ChoicePresenter` for choices |
| Speaker | `# speaker:guide` | Current-speaker participant and `DialogueLineContext.CurrentSpeakerId` | `SpeakerPresenter` and `SpeakerView` |
| Portrait | `# portrait:concerned` | Current speaker's character-scoped portrait override | `SpeakerView` with `DialogueCharacterCatalog` |
| Animation | `# animation:TalkConcerned` | Current speaker's animation key or state | `SpeakerView`, its `Animator`, and an optional `IDialogueAnimationTarget` |
| Audio | `# audio:soft_voice` | `DialogueLineContext.AudioInfoId` | `DialogueTextPresenter` and `TypewriterEffect` |
| Localization Arguments | `# loc-arg:reward,int,{reward}` | Named Unity Smart String argument | `DialogueLocaleTextPresenter` and `ChoicePresenter` |
| Story Skip | `# skip:enable` | Persistent skip permission for the current dialogue session | `DialogueSession`, `DialogueHandler`, and optional `DialogueStorySkipButton` |
| Character Placement | `# placement:fixed-character` | Persistent participant-placement mode for the current dialogue session | `DialoguePresentationState`, `SpeakerPresenter`, and `SpeakerView` |

Whitespace around `:` is accepted while reading. Writes use a single space after `#`, a lowercase canonical key, and no whitespace after `:`. Clearing a field removes the corresponding effective tag. If duplicate managed tags exist, the inspector warns and edits only the final/nearest occurrence. **Remove all managed metadata** removes built-in and configured fields managed in the current context.

Valid undeclared `key:value` tags automatically appear as editable fields with a **Custom** badge when their line is selected. They retain their text and order and are deliberately preserved by **Remove all managed metadata**; clear the individual custom field to remove it. Raw tags that do not use `key:value` syntax are preserved but are not shown as fields.

### Common Unity metadata setup

Before using any predefined tag at runtime:

1. Create a **Dialogue > Metadata Profile** asset.
2. Keep the profile's canonical tag mappings (`id`, `locale`, `loc-arg`, `speaker`, `portrait`, `animation`, `audio`, `skip`, and `placement`), or change them to match the keys authored in Ink and configured in the Inky sidecar.
3. Assign the profile to **Default Metadata Profile** on `DialogueHandler`, or assign a per-story override on `DialogueTrigger`.
4. Add only the presenter components required by the tags the project uses.

`DialogueHandler` requires a valid metadata profile to start a story. A tag can still be optional on every individual line even though its key is mapped in the profile.

### ID (`id`)

Use `id` when another system needs a stable reference to a specific line or choice that does not depend on its displayed or localized text. Common scenarios include analytics, quest reactions, save flags, voice-over manifests, automated tests, and debugging.

```ink
# id:introduction.guide.welcome
Welcome. I have been expecting you.
```

`DialogueMetadataParser` stores the value in `DialogueLineContext.LineId`. No built-in presenter or component performs an action from it. Custom code can subscribe to `DialogueHandler.OnLineReady`, `OnLinePresented`, or `DialogueChoiceController.OnChoicesPrepared` and read the ID from the supplied line context.

The field is optional. Without the tag, `LineId` is an empty string and dialogue behaves normally. Prefer permanent, project-unique IDs containing letters, numbers, dots, hyphens, or underscores. Do not derive them from localized or player-visible text.

**Unity setup:**

- Keep **Line ID Tag** set to `id` in `DialogueMetadataProfile`.
- No built-in presentation component is required.
- Add a custom `MonoBehaviour` only when IDs have project behavior. Give it access to `DialogueHandler`, subscribe to `OnLineReady` or `OnLinePresented`, and read `lineContext.LineId`.
- For choice IDs, subscribe to `DialogueChoiceController.OnChoicesPrepared` and read each option's `LineContext.LineId`.

### Localization Key (`locale`)

Use `locale` when the displayed dialogue or choice text should come from a Unity Localization string table instead of directly from the Ink text.

```ink
# locale:dialogue.introduction.welcome
Welcome. I have been expecting you.
```

For dialogue lines, `DialogueLocaleTextPresenter` uses `DialogueLineContext.Locale` to load the localized value and then presents it through the normal typewriter flow. For choices, `ChoicePresenter` passes the key to `ChoiceView.SetLocalText`. If `locale` is absent, both presenters display the text supplied by Ink.

Use this field only when Unity Localization owns the displayed text. The key must identify an entry in the configured string table. It is optional when the Ink text itself should be displayed.

**Unity setup:**

- Keep **Localization Tag** set to `locale` in `DialogueMetadataProfile`.
- Configure Unity Localization and create the required string-table entries.
- Use `DialogueLocaleTextPresenter` for dialogue lines and set its **Localized Table Name** to the target string table. It extends `DialogueTextPresenter`, so it also needs the normal text and typewriter setup.
- Use `ChoicePresenter` and configured `ChoiceView` instances for localized choices. `ChoicePresenter` automatically forwards a choice's locale key to `ChoiceView.SetLocalText`.

### Localization Arguments (`loc-arg`)

Use `loc-arg` when a Unity Smart String referenced by `locale` contains named placeholders whose values come from Ink. The inspector shows a repeatable structured editor with **Name**, a fixed **Type** dropdown, and type-specific value fields. Choose **Add argument** once for each placeholder; **Update** and **Remove** edit that exact tag occurrence.

```ink
# locale:quest.kael.reward
# loc-arg:reward,int,{reward}
# loc-arg:item,localized,Items,{kael_requested_item}
Kael reward fallback text.
```

The matching Unity table entry can use the named arguments:

```text
Bring {item} to Kael to receive {reward} gold.
```

The supported types are:

| Type | Tag payload | Meaning |
| --- | --- | --- |
| Integer | `reward,int,{reward}` | Passes a whole-number Smart String argument |
| Float | `multiplier,float,{multiplier}` | Passes a decimal-number argument |
| Boolean | `completed,bool,{is_complete}` | Passes a true/false argument |
| String | `player,string,{player_name}` | Passes plain text; the value may contain commas |
| Localized String | `item,localized,Items,{item_key}` | Creates a nested Unity `LocalizedString` using the selected table and entry key |

The type is required because Unity Smart Strings format numbers, booleans, ordinary text, and nested localized entries differently. `localized` is a DialogueSystem argument type, not an Ink type: its **Table** and **Entry key** identify another Unity Localization entry, allowing an item ID such as `sword_iron` to become the translated item name in the active locale.

Both literal values and Ink substitutions such as `{reward}` are valid. Argument names must start with a letter and may contain letters, numbers, `_`, or `-`. The table and entry fields for `localized` cannot contain commas because commas delimit the tag payload.

For a localized choice, the same tags are authored inline inside the choice text region:

```ink
* [Accept # locale:quest.kael.accept # loc-arg:reward,int,{reward}] -> accept
```

No project sidecar configuration is required for this control. `loc-arg` is a built-in repeatable field, so repeated occurrences are intentional and are not reported as duplicate metadata. The inspector still reports malformed rows and duplicate argument names.

### Speaker (`speaker`)

Use `speaker` when a dialogue line needs a current character identity for presentation or game logic.

```ink
# speaker:guide
The path ahead is dangerous.
```

The parser creates the current-speaker participant and exposes its character ID through `DialogueLineContext.CurrentSpeakerId`. `SpeakerPresenter` routes the participant to a `SpeakerView`. The view uses that ID to resolve its display name, optional localized name, default portrait, and default animation from `DialogueCharacterCatalog`.

The field is optional for narration, system messages, or any line that does not need a visible speaker. Without it, the text still plays but no current-speaker participant is created. Although choice metadata can carry `speaker`, the default choice presenter does not render speakers; custom choice UI can read it from `ChoiceOptionContext.LineContext`.

**Unity setup:**

- Keep **Current Speaker Role** set to `speaker` and keep a participant binding whose role and ID tag are both `speaker` in `DialogueMetadataProfile`.
- Add `SpeakerPresenter` beneath the relevant `DialogueHandler`.
- Add one or more `SpeakerView` objects below the presenter. Map a view to the `speaker` slot in **Participant Slots**, or allow the first discovered child view to provide the package's `speaker`/`left` fallback slot.
- Assign the `SpeakerView` name label, image, and animation references only for the visual features that view needs.

### Portrait (`portrait`)

Use `portrait` to select a visual variation for the current speaker, such as `neutral`, `happy`, or `concerned`.

```ink
# speaker:guide
# portrait:concerned
We should turn back.
```

The value is a character-scoped lookup key, not an image path or image data. `SpeakerPresenter` passes the participant to `SpeakerView`, which finds the character in `DialogueCharacterCatalog` and resolves the key from that character's portrait variations. When it is absent or unknown, the view uses the character's default portrait.

`portrait` is optional, but it must not be used without `speaker`. The runtime treats participant details without their participant ID as invalid metadata; with **Reject Invalid Metadata** enabled on `DialogueHandler`, an invalid line stops the dialogue session.

**Unity setup:**

- Keep the current-speaker participant's **Portrait Tag** set to `portrait` in `DialogueMetadataProfile`.
- Create a **Dialogue > Character Catalog** asset and add one entry for every stable character ID.
- Configure each character's display name, optional localized display name, default portrait, default animation, and portrait variations.
- Assign a UI `Image` and the shared `DialogueCharacterCatalog` asset to each applicable `SpeakerView`.
- Add one portrait variation entry for every key used by that character in Ink. Because keys are character-scoped, different characters can all define values such as `happy`, `neutral`, or `angry`.

### Animation (`animation`)

Use `animation` when a speaker portrait or character view should enter a specific state for the line.

```ink
# speaker:guide
# animation:TalkConcerned
Keep your voice down.
```

`SpeakerView` sends the value to its portrait `Animator` and optional `IDialogueAnimationTarget`. When the tag is absent, the view plays its configured default animation state. The value must match a state or key understood by the assigned animation setup.

Like `portrait`, `animation` is optional but requires `speaker`. An animation tag without a speaker ID produces invalid participant metadata.

**Unity setup:**

- Keep the current-speaker participant's **Animation Tag** set to `animation` in `DialogueMetadataProfile`.
- Assign an `Animator` to the applicable `SpeakerView` and create states whose names match the authored values.
- Set the view's **Default Animation State** for lines that omit the tag.
- Optionally place an `IDialogueAnimationTarget` implementation on the view when animation keys must drive behavior other than, or in addition to, `Animator.Play`.

### Audio (`audio`)

Use `audio` to select the typewriter sound profile for a dialogue line—for example, to give different characters, devices, or narration styles distinct typing sounds.

```ink
# audio:soft_voice
Do not wake them.
```

`DialogueTextPresenter` passes `DialogueLineContext.AudioInfoId` to `TypewriterEffect`. The effect looks up a matching `DialogueAudioInfoSO`. If the field is absent, the default audio profile is used. If the key is present but unknown, the component logs a warning and also falls back to the default profile.

The built-in choice presenter does not play choice-specific typewriter audio. Choice metadata can still carry `audio` for custom choice UI.

**Unity setup:**

- Keep **Audio Tag** set to `audio` in `DialogueMetadataProfile`.
- Use `DialogueTextPresenter` or `DialogueLocaleTextPresenter` with a `TypewriterEffect` on the text object.
- Place an `AudioSource` on the typewriter object's parent hierarchy.
- Create `DialogueAudioInfoSO` assets from **Create > ScriptableObjects > DialogueAudioInfoSO**. Set each asset's `id` to the value authored in Ink and configure its clips, frequency, pitch range, and stop behavior.
- Assign one asset as **Default Audio Info** and add every selectable asset to **Audio Infos** on `TypewriterEffect`.

### Story Skip (`skip`)

Use `skip` to control when the current dialogue session may be exited through story-skipping UI or custom code.

```ink
# skip:enable
You may leave whenever you are ready.
```

The allowed values are `enable` and `disable`. The inspector presents them as a fixed dropdown. The directive takes effect after the tagged line finishes presenting and remains active until another directive changes it or the dialogue session ends. Each new session starts with skipping disabled.

`DialogueSession` stores the permission, and `DialogueHandler` exposes it through `CanSkipStory` and `OnStorySkipAvailabilityChanged`. The optional `DialogueStorySkipButton` uses those APIs to enable, disable, show, or hide itself. Pressing the button exits the dialogue immediately; it does not evaluate skipped Ink lines, select choices, or invoke external functions in skipped content.

The field is optional. Omit it when the current line should not change the existing permission. Put mandatory state changes before a skippable section or handle them from the normal dialogue-end flow.

**Unity setup:**

- Keep **Story Skip Tag** set to `skip` in `DialogueMetadataProfile`.
- For built-in UI, add `DialogueStorySkipButton` to a uGUI `Button` under the same `DialogueHandler`. The component uses its local `Button` automatically when no explicit button reference is assigned.
- Optionally assign **Visual Root** and enable **Hide When Unavailable** to hide the control instead of only disabling interaction.
- Custom controls can read `DialogueHandler.CanSkipStory`, subscribe to `OnStorySkipAvailabilityChanged`, and call `DialogueHandler.SkipStory()`.

### Character Placement (`placement`)

Use `placement` when speaker and listener views need either role-based positioning or stable character positions while speakers alternate.

```ink
# placement:fixed-character
# slot.left:guide
# slot.right:traveler
# speaker:guide
Stay close.

# speaker:traveler
I will.
```

The allowed values are:

- `follow-speaker`: route participants by role, so the current speaker and listener use their corresponding views.
- `fixed-character`: keep each character assigned to a stable presentation slot as the active speaker changes.

`DialoguePresentationState` keeps the selected mode for the rest of the session or until another `placement` directive changes it. `SpeakerPresenter` consumes the resolved presentation participants and updates its mapped `SpeakerView` objects.

The field is optional. A new session begins in `follow-speaker` mode, and an omitted tag leaves the current mode unchanged. In fixed mode, related `slot.<slot-id>` tags can explicitly assign a character or use `clear` to empty a slot. Slot fields are project-defined rather than predefined inspector fields; add them in the Configuration tab when writers need them visible before a matching Ink tag exists.

When fixed mode has no explicit slot assignment, the runtime assigns newly encountered characters using the metadata profile's configured auto-placement order.

**Unity setup:**

- Keep **Placement Tag** set to `placement` and **Slot Prefix** set to `slot.` in `DialogueMetadataProfile`.
- Configure **Auto Placement Slots** in the order characters should be assigned when fixed mode has no explicit `slot.*` tags.
- Add `SpeakerPresenter` beneath `DialogueHandler` and create the required `SpeakerView` objects.
- In `SpeakerPresenter.Participant Slots`, map each slot ID used by the profile or Ink—such as `left`, `right`, or `center`—to a view. Child-view fallbacks can supply the standard `speaker`/`left`, `listener`/`right`, and `center` mappings, but explicit mappings are clearer for custom layouts.
- Make sure any `slot.<slot-id>` field authored in Ink uses a slot ID present in the presenter and a character ID matching the relevant participant metadata.

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

1. Save the main `.ink` story. Inky creates an empty project sidecar beside it if one does not already exist.
2. Open **Configuration** in the right inspector.
3. Select a built-in field to set its label, Dialogue/Choice availability, and suggested values, then choose **Save field**.
4. Under **Add custom field**, enter a tag key such as `listener`, `listener_portrait`, or `participant.interviewer`. Add each optional participant detail (for example `participant.interviewer.portrait`) as its own field. New custom fields start in both Dialogue and Choice contexts; select the new field afterward if you want to narrow it.
5. Return to **Metadata** to assign the configured fields on dialogue and choice lines.

Suggested values are one per line. They provide autocomplete choices while remaining editable, so a writer can still enter a value that is not in the list. **Reset override** restores a built-in field's defaults. **Remove field** removes a custom field from project configuration; it does not delete tags already written in `.ink` files.

Saving the main Ink story creates a JSON file beside it using the main story's base name plus `.metadata.json`. The Configuration tab then updates this file as fields are configured:

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

Ink supplies tag strings. The DialogueSystem package's `DialogueMetadataParser` turns those strings into a validated context for both lines and choices by using the active `DialogueMetadataProfile`:

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
| Character placement mode | `placement` (or the profile's configured placement tag) |
| Slot assignment prefix | `slot.` (or the profile's configured slot prefix) |

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

The project requires Node 22.12 or later and npm 10 or later. The desktop application currently uses Electron 44.

From the repository root:

```sh
npm install
npm test
npm start
npm run build -- win64
```

The inherited Spectron suite is retained separately as `npm run test:e2e`; it requires a compatible Spectron installation and a prebuilt platform package, and is not part of the default unit test command.

## Current limitations

- Regular dialogue uses tag-only lines above the content; inline tags at the end of regular dialogue are not managed.
- Choice metadata is limited to a single choice line and does not resolve invisible fallback or multiline conditional choices.
- The configuration file is loaded when a project opens, after the main story is saved, and after every Configuration-tab edit. External edits are not watched continuously; save or reopen the project to reload them. The sidecar is field configuration, not a metadata assignment store.
- An undeclared custom field appears only when that tag already exists in the selected context. Declare it in `.metadata.json` when writers need an empty field available for new assignments.
- Unity profile changes do not rewrite existing `.ink` content. Migrate the Ink tag text when changing a project-owned key, or use separate old/new profiles while different stories are being migrated.
