=== introduction ===

# id:guard_warning_01
# locale:dialogue.guard.warning_01
# speaker:guard
# portrait:angry
# animation:TalkAngry
# audio:guard_warning_01
# quest:forest_gate
You cannot enter the forest tonight.

* [Ask why] -> ask_guard
+ [Leave] -> END

== ask_guard ==
// This comment is not dialogue.
/*
This block comment is not dialogue either.
*/
{ gate_is_closed:
    This conditional content is outside the Version 1 context.
}
-> END
