=== introduction ===

# id:guard_warning_01
# locale:dialogue.guard.warning_01
# speaker:guard
# portrait:angry
# animation:TalkAngry
# audio:guard_warning_01
# quest:forest_gate
You cannot enter the forest tonight.

* [Ask why # id:choice.ask_guard] -> ask_guard
+ [Leave # id:choice.leave] -> END

== ask_guard ==
// This comment is not dialogue.
/*
This block comment is not dialogue either.
*/
{ gate_is_closed:
    This conditional content remains outside the metadata context.
}
-> END
