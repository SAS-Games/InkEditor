=== forest_gate ===

# id:guard_warning_01
# locale:dialogue.guard.warning_01
# speaker:guard
# portrait:angry
# listener:player
# listener_portrait:neutral
# animation:TalkAngry
# audio:guard_warning_01
# mood:suspicious
# quest:forest_gate
You cannot enter the forest tonight.

* [Ask the guard why # id:choice.ask_guard # locale:choice.forest_gate.ask_guard # mood:curious # analytics_event:forest_gate.ask_guard] -> ask_guard
* [Leave # id:choice.leave # locale:choice.forest_gate.leave # audio:ui.cancel # analytics_event:forest_gate.leave] -> END

== ask_guard ==

# id:guard_explanation_01
# locale:dialogue.guard.explanation_01
# speaker:guard
# portrait:concerned
# listener:player
# listener_portrait:neutral
# animation:Talk
# audio:guard_explanation_01
# mood:calm
There are wolves beyond the old bridge.

-> END
