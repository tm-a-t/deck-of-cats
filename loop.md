1. Look for new real-player feedback (game logs).
2. If there is none, AI Tester plays the current local build. It records current bugs, friction, and interest verdict.
3. If that local build has major untested changes and feels playable, AI Tester asks to send it to external testing.
4. AI Game Designer reads the summary, rules.md, and changelog.md.
5. AI Game Designer picks one main improvement hypothesis.
6. AI Game Designer proposes a rule-level change.
7. AI Developer implements it and updates rules.md + changelog.md.
8. AI Developer validates locally with smoke tests.

Then repeat.