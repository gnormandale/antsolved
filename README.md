# Ant Piano-Movers Cause Problems on Purpose — Interactive Solution 

An agent-based simulation of collective geometric puzzle-solving, inspired by **Dreyer, Haluts, Korman, Gov, Fonio & Feinerman (2025)**, *"Comparing cooperative geometric puzzle solving in ants versus humans"*, Proceedings of the National Academy of Sciences, 122(1), e2414274121.

---

## Background

Researchers at the Weizmann Institute of Science challenged groups of longhorn crazy ants (*Paratrechina longicornis*) and humans with an identical geometric puzzle: maneuver a T-shaped load through a rectangular arena divided into three chambers connected by narrow slits — a physical realisation of the classical **piano-movers problem** from motion planning and robotics.

Their key finding was that large ant groups outperformed small ones — and even outperformed communication-restricted human groups — by developing **emergent cognitive abilities**. Individual ants cannot grasp the global structure of the puzzle, but the collective motion of a large group translates into short-term directional memory (encoded in the group's internally ordered state, analogous to ordered spins in statistical mechanics) and a wall-sliding heuristic reminiscent of the right-hand rule for maze solving. Small groups, by contrast, exhibit diffusive random-walk dynamics with frequent dead-ends and backtracking.

This simulation recreates those dynamics with two distinct agent populations, a simulated-annealing framework for stuck detection and recovery, a nest-direction bias, and tuneable parameters that let you explore the puzzle's difficulty space.

---

## Biological Motivation: Causing Problems on Purpose 

The simulated annealing framework draws on the **exploration–exploitation tradeoff** fundamental to animal foraging (Mehlhorn et al., 2015; Addicott et al., 2017). In uncertain or changing reward landscapes, organisms must flexibly alternate between exploiting known rewards and exploring alternatives (Stephens & Krebs, 1986; Charnov, 1976). This produces behaviour that appears irrational — Skinner's (1948) pigeons developed seemingly purposeless rituals under non-contingent reinforcement, and while these have been reinterpreted as species-typical foraging responses (Staddon & Simmelhag, 1971; Timberlake & Lucas, 1985), the broader principle holds: animals routinely take actions that move them away from a goal in order to sample an uncertain reward landscape. Anselme (2023) argues these "suboptimal" behaviours reflect **adaptive uncertainty resolution** rather than genuine irrationality.

In this simulation, SA maps directly onto this dynamic. Low temperature corresponds to exploitation (directed nestward motion); high temperature corresponds to exploration (scattered headings, random torque, direction reversals that send the load back through chambers). The apparently counterproductive retreat allows the collective to escape local traps and discover new approach angles. Crucially, this requires **no individual awareness** of the T-shape's geometry and **no inter-agent communication** — only environmental feedback from whether the load is moving or stuck, transmitted through shared physical forces. This is consistent with Dreyer et al. (2025), who showed that emergent collective cognition in ant groups arises from the ordered state of the group, not from individual understanding or direct communication.

---

## The Puzzle

A **T-shaped load** begins in the leftmost of three chambers. The chambers are connected by narrow vertical slits in the dividing walls. The goal is to transport the load rightward through both slits into the third chamber (the "nest"). Because of the T's asymmetric geometry, the load must be **rotated** to fit through the slits — pure forward pushing is insufficient.

The T-shape is defined with a 38×12 px crossbar and a 14×36 px stem. Being non-convex, the T does not need its full bounding box to clear a slit at once — different parts can pass through sequentially. At an optimal rotation of approximately 115°, the widest vertical cross-section through the T is only ~29 px, making the theoretical minimum slit width (with wall clearance) **37 px**.

---

## Two Agent Populations

The simulation models two distinct populations that cooperate on the same load, reflecting different behavioural strategies:

### Sliders (cyan)

Represent the emergent wall-following behaviour observed in large ant groups.

- **Wall-sliding heuristic**: When the load contacts a wall, sliders maintain their collective heading and scan along the boundary toward the nearest slit — analogous to the right-hand rule for maze solving.
- **Gap-seeking**: When the load approaches an internal wall, sliders bias their heading toward the slit centre, steering the T toward openings rather than colliding blindly.
- **Fast simulated annealing**: Temperature rises quickly when stuck and cools quickly when making progress. Sliders are rapid adapters.
- **High persistence**: After wall contact, the collective ordered state preserves direction. Memory is stored in group alignment, not in any individual.

### Pushers (orange)

Represent simpler brute-force agents that lack wall-awareness.

- **Direct pushing**: Pushers aim straight toward the current goal direction with no wall-following or gap-seeking logic.
- **Slow simulated annealing**: Temperature rises and cools sluggishly. Pushers are slow to recognise when a strategy isn't working and slow to settle down after a breakthrough.
- **Higher individual force**: Pushers apply more force per agent, providing raw motive power.
- **Higher wander noise**: Less precisely coordinated, introducing a degree of useful randomness.

Both populations attach to the load's perimeter and apply pulling forces based on their heading. The load moves as a rigid body under the aggregate of all forces and torques, subject to collision with the arena walls.

---

## Simulated Annealing (SA)

Each agent carries a **per-agent temperature** governing how exploratory its behaviour is:

| Temperature | Meaning |
|---|---|
| Low (near 0) | Directed, low noise, coordinated — efficient nestward motion |
| High (toward 3.0) | Experimental — headings scatter, random torque rotates the load, direction reversals become likely |

### Heating (stuck)

When the load fails to make meaningful progress, all agents' temperatures rise. The rate is population-dependent: sliders heat at 0.0018 per tick (fast), pushers at 0.0004 per tick (slow). This means sliders recognise trouble quickly, while pushers keep pushing futilely for longer.

### Cooling (moving)

When progress resumes, temperatures drop. Sliders cool with a multiplicative factor of 0.93 (fast snap to directed), pushers with 0.99 (slow wind-down). After a breakthrough, sliders immediately coordinate while pushers are still slightly scattered.

### Direction Reversal

When the average temperature across all agents exceeds a threshold, the collective may **reverse its travel direction** entirely, sending the load back through a chamber to try a new approach angle. The probability of reversal scales with temperature. On reversal, agent headings are shaken by a random perturbation proportional to the current temperature, and random torque may be applied to rotate the T-shape into novel orientations.

---

### References

- Addicott, M.A., Pearson, J.M., Sweitzer, M.M., Barack, D.L. & Platt, M.L. (2017). A primer on foraging and the explore/exploit trade-off for psychiatry research. *Neuropsychopharmacology*, 42(10), 1931–1939.
- Anselme, P. (2023). Information matters more than primary reward. *Animal Behavior and Cognition*, 10(4), 331–350.
- Charnov, E.L. (1976). Optimal foraging, the marginal value theorem. *Theoretical Population Biology*, 9(2), 129–136.
- Dreyer, T., Haluts, A., Korman, A., Gov, N., Fonio, E. & Feinerman, O. (2025). Comparing cooperative geometric puzzle solving in ants versus humans. *PNAS*, 122(1), e2414274121.
- Mehlhorn, K., Newell, B.R., Todd, P.M., Lee, M.D., Morgan, K., Braithwaite, V.A., Hausmann, D., Fiedler, K. & Gonzalez, C. (2015). Unpacking the exploration–exploitation tradeoff: A synthesis of human and animal literatures. *Decision*, 2(3), 191–215.
- Skinner, B.F. (1948). 'Superstition' in the pigeon. *Journal of Experimental Psychology*, 38, 168–172.
- Staddon, J.E.R. & Simmelhag, V.L. (1971). The 'superstition' experiment: A reexamination of its implications for the principles of adaptive behavior. *Psychological Review*, 78(1), 3–43.
- Stephens, D.W. & Krebs, J.R. (1986). *Foraging Theory*. Princeton University Press.
- Timberlake, W. & Lucas, G.A. (1985). The basis of superstitious behavior: Chance contingency, stimulus substitution, or appetitive behavior? *Journal of the Experimental Analysis of Behavior*, 44(3), 279–299.

---

## Nest-Direction Bias

A biologically motivated asymmetry ensures that **retreating is always uncomfortable**:

- **Moving toward the nest (→)**: Temperature can cool all the way to its baseline (0.02). The collective becomes calm and directed.
- **Moving away from the nest (←)**: Temperature can never cool below the **Temp Floor** parameter (default 0.75). Agents remain restless and primed to reverse back toward home.

An additional **Nest Bias** parameter blends the retreat heading back toward the nest direction. At high values, even agents nominally retreating leftward angle back rightward, creating tight oscillatory probing behaviour near walls rather than committed backward motion.

---

## Gap Width and T-Shape Geometry

The slit width is tuneable from **37 px to 120 px**. The lower bound is computed from the T-shape's non-convex geometry:

The T-shape has eight vertices forming an L-shaped cross-section. As a non-convex polygon, different parts of the T can pass through the slit sequentially during a continuous rotation. The **critical passage width** — the minimum slit that allows any feasible transit — is determined by the angle that minimises the widest single vertical slice through the rotated T. This minimum occurs at approximately 115° rotation, where the critical slice is ~29 px. Adding wall-thickness clearance yields a hard floor of 37 px.

- **At 120 px**: The T passes through with almost no rotation needed. Trivial for all group sizes.
- **At 64 px (default)**: Moderate rotation required. Large slider groups solve reliably; small pusher-only groups struggle.
- **At 37–40 px**: The T must achieve a precise ~115° rotation to thread through. Even large groups need many attempts, significant SA-driven exploration, and multiple reversals.

---

## Tuneable Parameters

### Population Controls

| Parameter | Range | Default | Effect |
|---|---|---|---|
| Sliders | 5–80 | 55 | Number of wall-sliding, fast-SA agents (cyan) |
| Pushers | 5–80 | 45 | Number of direct-pushing, slow-SA agents (orange) |

### Simulation Parameters

| Parameter | Range | Default | Effect |
|---|---|---|---|
| Temp Floor | 0.10–1.80 | 0.75 | Minimum temperature when retreating. Higher = more restless during retreat, faster reversal back nestward |
| Nest Bias | 0–100% | 65% | How strongly agents angle nestward during retreat. 0% = pure retreat; 100% = agents always pull toward nest |
| Gap Width | 37–120 px | 64 px | Slit width between chambers. Resets simulation on change. 37 px = theoretical minimum for T passage |

### Playback Controls

| Control | Function |
|---|---|
| RUN / PAUSE | Start or pause the simulation |
| RESET | Reinitialise the arena, load, and all agents |
| Speed (1–16×) | Number of physics ticks per animation frame |

---

## Reading the Display

### Arena

The arena is divided into three chambers by vertical blue walls with highlighted slit openings. A green tint on the rightmost chamber marks the nest (goal). "START" labels the initial load position; "NEST →" marks the target.

### Load

The T-shaped load changes colour to indicate its state: **red** when moving toward the nest, **amber** when retreating, and **green** when the puzzle is solved. A white arrow on the load shows the current travel direction.

### Agents

**Cyan dots** are sliders; **orange dots** are pushers. Bright agents are attached to the load and pulling; faint agents are wandering toward it. A **glowing ring** around an attached agent indicates elevated temperature (agitated/experimental state). Short tick marks show each agent's heading direction.

### Trail

The load's path is drawn behind it with colour encoding: **green** segments for nestward motion, **red** segments for retreat. This makes it easy to see oscillatory probing behaviour, reversals, and the overall solution trajectory.

### HUD Indicators

On-canvas status labels appear in the top-left corner:

- **WALL-SLIDE** (cyan): The load is in wall contact and sliders are executing boundary-following.
- **GAP-SEEK** (green): The load is near an internal wall and sliders are steering toward a slit.
- **SLIDER T=** (cyan): Mean temperature of the slider population.
- **PUSHER T=** (orange): Mean temperature of the pusher population.

### Stats Bar

Below the canvas, a stats bar shows: population counts, per-population average temperature (colour-coded green/amber/red), current chamber (1–3), travel direction (→ or ←), and total simulation steps.

---

## Suggested Experiments

1. **Slider-only vs pusher-only**: Set one population to its minimum (5) and the other to maximum (80). Sliders alone solve faster on average because they exploit wall-following; pushers alone rely on brute force and SA-driven exploration.

2. **Narrow gap challenge**: Set gap width to 38–42 px and watch the ants struggle to discover the ~115° rotation window. Increase the speed to 12–16× for long runs.

3. **Temperature floor sweep**: At the default gap, try temp floor values from 0.1 (calm retreats, slow reversal) to 1.5 (frantic retreats, near-instant reversal). Observe how this affects the tradeoff between committed exploration and oscillatory probing.

4. **Nest bias extremes**: At 0% the collective commits fully to retreating when reversed — it will travel far leftward before re-reversing. At 100% retreats are immediately pulled back rightward, creating a jittery oscillation near the current wall. The sweet spot for efficient solving is typically 50–70%.

5. **Population ratio tuning**: The default 55/45 split reflects a slight slider majority. Try 70/30 (mostly intelligent navigation, less raw force) vs 30/70 (mostly brute force, less wall-awareness) and compare step counts to solve.

---

## Implementation Notes

### Physics

The load is modelled as a rigid body with three degrees of freedom (x, y, θ). Forces and torques from attached agents are summed and applied with linear damping (friction coefficient 0.91 for translation, 0.87 for rotation). Collisions are resolved iteratively (up to 5 passes per tick) by pushing load vertices out of wall regions and damping the velocity component into the wall.

### Agent Attachment

Agents wander toward the load and attach when they come within 11 px of the load's perimeter (measured as distance to the nearest edge of the T polygon). On attachment, their position is recorded as a polar offset from the load's centre, and they are rigidly carried with the load's rotation thereafter. Agents detach stochastically at a rate that scales with their population type and current temperature.

### Configuration Space

Following the original paper, the puzzle's configuration space is three-dimensional (x, y, θ). The simulation does not explicitly discretise this space into the paper's labelled states (a through h), but the emergent behaviour — including persistent wall-sliding, slit-seeking, and backtracking through chambers — reproduces the qualitative dynamics described by Dreyer et al.

---

## Reference

Dreyer, T., Haluts, A., Korman, A., Gov, N., Fonio, E. & Feinerman, O. (2025). Comparing cooperative geometric puzzle solving in ants versus humans. *Proceedings of the National Academy of Sciences*, 122(1), e2414274121. https://doi.org/10.1073/pnas.2414274121

---

## Files

| File | Description |
|---|---|
| `ant_piano_movers.jsx` | React component — the full interactive simulation |
| `README.md` | This file |
