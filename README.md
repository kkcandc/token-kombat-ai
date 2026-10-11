# TOKEN KOMBAT

A browser arcade fighter. Twelve stylized toons, one neon ring, first to two rounds. Built as affectionate satire of public AI figures — original title treatment, original announcer lines, no studio logos, no photos.

Play the live build: [token-kombat-ai.vercel.app](https://token-kombat-ai.vercel.app)

Or run it locally with `npm install` and `npm run dev`.

## Controls

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | WASD (arrows too, in CPU bouts) | Arrow keys |
| Jump | W / Up | Up |
| Crouch | S / Down | Down |
| Punch | J or Space | N |
| Kick | K | M |
| Special | L | , (comma) |
| Block | I or Left Shift | . (period) or Right Shift |
| Pause | Esc | Esc |
| Mute | M | M |
| Frame data | F3 or Frames | F3 or Frames |

On a phone, on-screen buttons cover punch, kick, special, block, and movement for player 1.

Crouch slips under high punches and the CUDA beam. Block faces the hit and turns it into chip. Jump is the other way over a beam. Specials spend meter. Meter builds when you land hits, take hits, and just by staying in the round.

Rounds are first to two. A 99-count clock decides a round that runs long: higher health wins, and the booth calls it a loss curve.

Hits are stepped at 60 sim frames a second. A clean connect freezes the round for 2, 4, or 6 frames (light, medium, heavy), kicks the side-on camera in, and rattles the ring under the fixed HUD for the whole freeze and the slide after. The victim leaves a pale smear and a dust kick at their feet so the knockback reads. The camera then settles back to a readable two-shot. Frame data (F3) shows startup, active, recovery, and the advantage of the last hit. Altman's standing punch is the light, his standing kick is the medium: the limb chambers, snaps on the active frames, and recovers. A punch that lands can link into kick or special during the cancel window. A whiff does not.

## How a bout starts

1. Enter the Coliseum.
2. Choose **Versus CPU** or **Local 2P**.
3. Lock a fighter into each slot. Arrow keys move the highlight, Enter assigns, or just click. **Random rival** fills the CPU slot.
4. Start the bout. Intro can be skipped with Enter.

## Roster

| Fighter | Special | What it does |
| --- | --- | --- |
| Sam Altman | Softmax Storm | Three homing orbs, a short loop shield, and a rising punch if the meter was nearly full. |
| Elon Musk | Meme Rocket | A rocket climbs, then dives. A clean hit leaves a roast bubble and a long stun. |
| Jensen Huang | CUDA Beam | Chest-high tensor light. Crouch or jump it. |
| Demis Hassabis | Alpha Rewind | Blinks back and leaves a go-board that slows anyone standing in it. |
| Dario Amodei | Constitutional Counter | A timed window. Swing into it and the clause hits back, with a little health returned. |
| Mira Murati | Mirage Clones | Two copies run in and punch while she slides out. |
| Ilya Sutskever | Singularity Charge | Spends the whole meter on an armored dash punch. More meter, harder hit. |
| Mark Zuckerberg | Feed Grab | Close-range llama peck flurry. Whiff it and one llama still runs the lane. |
| Satya Nadella | Copilot Drop | Drones take a shot, then a cloud drops on the mark. |
| Fei-Fei Li | Crystal Snare | A crystal labels the floor and roots whoever steps on the caption. |
| Yann LeCun | Cake Slam | A layer cake splats into slippery crumbs. |
| Andrej Karpathy | Backprop Spiral | A helix of glyphs with a little tracking. |

The Swisher Booth calls rounds: compile, fine-tune, deploy. Match point ends on the winner's own line, then **SYSTEM HALT**.

## Scripts

```bash
npm install
npm run dev      # local play
npm test         # headless combat checks
npm run build    # production bundle
npm run preview
```

Stack: Vite, TypeScript, Canvas 2.5D. No API keys. No accounts.

## Tone

Public-figure caricatures in flat color: hair, jacket, and prop, not portraits. Jokes stay on the public work — models, launches, boards, safety clauses — and off of bodies and private lives.
