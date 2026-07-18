=== forest_gate ===

# id:guard_warning_01
# locale:dialogue.guard.warning_01
# speaker:guard
# portrait:angry
# animation:TalkAngry
# audio:guard_warning_01
# quest:forest_gate
You cannot enter the forest tonight.

* [Ask the guard why] -> ask_guard
* [Leave] -> END

== ask_guard ==

# id:guard_explanation_01
# locale:dialogue.guard.explanation_01
# speaker:guard
# portrait:concerned
# animation:Talk
# audio:guard_explanation_01
There are wolves beyond the old bridge.

-> END
