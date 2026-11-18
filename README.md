# Unplugged

**A gentle habit companion for phone-free moments.** Plan what you'll bring instead of your phone, remember to grab it before you leave, and keep track of the moments you unplugged.

Unplugged isn't a blocker or a quit-smoking-style app. You choose when you want a phone-free moment, on the train, at an appointment or waiting for a friend, and Unplugged makes sure you have something better in your hands.

**Live demo:** https://susangadegone.github.io/Unplugged/

## How it works: Plan → Remember → Do → Reflect

1. **Plan**: pick where you're going and roughly how long. Unplugged suggests the best-fit offline activity (book, magazine, knitting, sketchbook, journal, puzzles, or just looking around) and writes an **if-then plan** for you: *"When I'm at the dentist, I'll flip through my magazine."*
2. **Remember**: your next moment sits on the home screen with exactly what to bring. A "Did you grab it?" checklist at the door makes sure it's in your bag. There's an optional reminder 10 minutes before you leave.
3. **Do**: tap "I'm here. Start." You'll see your own plan sentence, a tiny starter step ("Just read one page") and a calm timer.
4. **Reflect**: what did you do, and how did it feel? Your moments and phone-free minutes only ever go up. If you ended up on your phone, that's okay, and your next plan will be ready.

## Why it works

- **The problem:** about 1 in 4 US adults use their smartphone "almost constantly", and just over half say they spend too much time on it ([Pew Research Center, 2026](https://www.pewresearch.org/short-reads/2026/09/01/about-half-of-americans-say-they-spend-too-much-time-on-their-smartphone/)).
- **Small reductions matter:** cutting smartphone use by about 1 hour a day improved anxiety and depressive symptoms and life satisfaction, with more lasting effects than full abstinence ([Brailovskaia et al., 2022](https://pubmed.ncbi.nlm.nih.gov/35389685/)).
- **If-then planning works:** implementation intentions have a medium-to-large effect on reaching goals (Gollwitzer & Sheeran, 2006 meta-analysis, d = 0.65).

## Design principles

- **Quick-touch:** you open it for seconds, so it never competes for your attention.
- **Replacement, not restriction:** the language stays positive and there are no streaks that reset.
- **Private by design:** there's no account, and everything stays in your browser's localStorage.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

No build step: plain HTML, CSS and JavaScript. Add it to your home screen to install it as an app.

## Notes and limits

- Reminders use the browser Notification API and only fire while the app is open. They're best effort, especially on iOS. The home-screen card and door checklist work everywhere.
- Data lives in this browser only, so clearing site data resets it.

## Roadmap

Calendar integration (auto-plan for upcoming appointments and trips), custom activities, reminder preferences, history and insights, home-screen widgets, and AI "surprise me" suggestions.
