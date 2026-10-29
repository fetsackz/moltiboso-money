# Moltiboso Money

A living-room game show modelled on Ludwig's Mogul Money (itself Jeopardy-style). The Host runs the game from a laptop; the Contestants watch a TV and buzz in with physical buzzers.

## People

**Host**:
The MC who runs the game, reads Questions aloud and judges answers. Never a Contestant.
_Avoid_: MC, admin, game master

**Contestant**:
A player sitting on the sofa (2–6 per game), with a name, an optional photo and a score.
_Avoid_: player, participant, team

**Picker**:
The Contestant who chooses the next Question: whoever last answered correctly.
_Avoid_: chooser, active player

## Screens

**Stage**:
The audience-facing view shown on the TV. It never shows an answer before the Host reveals it.
_Avoid_: display, TV view, frontend

**Host Console**:
The Host's private control view on the laptop screen, showing answers and controls.
_Avoid_: admin panel, dashboard, controller

## Game content

**Game File**:
One YAML file describing a single game night: Contestants, Rounds, Final Wager and sounds.
_Avoid_: config, question pack, log

**Round**:
One Board of Categories × values, played until every Question on it is used. A game has two; Round 2 values are doubled.

**Board**:
The grid of Categories and values the Picker chooses from.
_Avoid_: overview, grid

**Category**:
A themed column of Questions on a Board.

**Question**:
One cell of a Board: the text read to Contestants (optionally with image or audio) plus its answer.
_Avoid_: clue, prompt

**Bonus Question**:
A Question secretly marked in the Game File that only the Picker answers, after placing a wager.
_Avoid_: Daily Double

**Final Wager**:
The last Question of the game; every Contestant secretly wagers and writes an answer on paper.
_Avoid_: Final Jeopardy, final round

## Rules

**Steal**:
After a wrong answer, another Contestant who has not yet tried buzzes in on the same Question.
_Avoid_: rebound

**Wager Floor**:
The minimum betting allowance; a Contestant may always wager up to the larger of their score and the floor.

## Running the show

**Continue**:
The Host's single timing control, which advances time within the show (start Countdown, reveal answer, return to the Board) and never changes scores.
_Avoid_: next, advance

**Countdown**:
An optional answer timer the Host starts after a buzz; running out only signals time is up.
_Avoid_: timer, shot clock

**Soundboard**:
Up to five custom sounds the Host can play at will.

**Save**:
The automatically kept state of a game in progress for one Game File; only starting a New Game discards it.
_Avoid_: session, snapshot
