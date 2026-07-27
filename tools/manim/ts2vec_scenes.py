"""Short Manim clips supporting the TS2Vec blog post.

Render (720p30 keeps the files small enough to commit):

    manim -qm --format=mp4 tools/manim/ts2vec_scenes.py DilatedReceptiveField
    manim -qm --format=mp4 tools/manim/ts2vec_scenes.py ContrastivePullPush
    manim -qm --format=mp4 tools/manim/ts2vec_scenes.py HierarchicalPooling

Then move the mp4s into images/ts2vec/.

NOTE: there is no LaTeX on this machine — use Text(), never MathTex()/Tex().
Colours match assets/css/book.css so the clips sit naturally in the article.
Frame is 14.22 x 8 units; keep everything inside x = ±7.0, y = ±3.9.
"""

from manim import *

config.background_color = "#ffffff"

INK = "#212529"
MUTED = "#7d7d7d"
ACCENT = "#0071bc"
POS = "#14806a"
NEG = "#b83a4b"
FAINT = "#c9d1d9"


def label(text, size=26, color=INK):
    return Text(text, font_size=size, color=color)


# ---------------------------------------------------------------------------
# 1. Dilated convolutions: the receptive field doubles with every block
# ---------------------------------------------------------------------------

class DilatedReceptiveField(Scene):
    """One output at the top, fanning down over 15 inputs. RF: 3 -> 7 -> 15."""

    def construct(self):
        n, centre = 15, 7
        x0, dx = -5.4, 10.8 / (n - 1)
        rows_y = [-2.5, -1.1, 0.3, 1.7]          # index 0 = inputs (bottom)

        # which nodes at each level feed the single top output
        levels = [
            list(range(n)),                      # inputs
            [1, 3, 5, 7, 9, 11, 13],             # after dilation-1 block
            [3, 7, 11],                          # after dilation-2 block
            [7],                                 # after dilation-4 block
        ]

        def pos(level, i):
            return np.array([x0 + i * dx, rows_y[level], 0.0])

        title = label("Dilated convolutions: the receptive field doubles each block", 27)
        title.to_edge(UP, buff=0.3)
        rf_text = label("one output, receptive field = 1 timestamp", 23, ACCENT)
        rf_text.next_to(title, DOWN, buff=0.25)
        self.play(FadeIn(title, shift=DOWN * 0.15), FadeIn(rf_text), run_time=0.7)

        inputs = VGroup(*[Dot(pos(0, i), radius=0.085, color=FAINT) for i in range(n)])
        in_lbl = label("input timestamps", 19, MUTED).next_to(inputs, DOWN, buff=0.22)
        self.play(LaggedStartMap(FadeIn, inputs, lag_ratio=0.03), FadeIn(in_lbl), run_time=0.8)

        for k, dil in enumerate([1, 2, 4], start=1):
            below, above = levels[k - 1], levels[k]
            edges, nodes = VGroup(), VGroup()

            for i in above:
                nodes.add(Dot(pos(k, i), radius=0.085, color=ACCENT))
                for j in (i - dil, i, i + dil):
                    if j in below:
                        on_chain = (i == centre)
                        edges.add(Line(pos(k - 1, j), pos(k, i),
                                       stroke_width=3 if on_chain else 1.6,
                                       color=ACCENT,
                                       stroke_opacity=0.9 if on_chain else 0.3))

            tag = label(f"block {k} — dilation {dil}", 21, ACCENT)
            tag.move_to(np.array([4.9, rows_y[k], 0.0]))
            self.play(Create(edges), FadeIn(nodes), FadeIn(tag), run_time=0.9)

            reach = 2 ** k - 1                    # centre +/- reach
            span = range(centre - reach, centre + reach + 1)
            rf = 2 ** (k + 1) - 1
            new_rf = label(f"one output, receptive field = {rf} timestamps", 23, ACCENT)
            new_rf.move_to(rf_text)
            self.play(*[inputs[j].animate.set_color(ACCENT).scale(1.2) for j in span],
                      Transform(rf_text, new_rf), run_time=0.7)
            self.play(FadeOut(tag), run_time=0.2)

        formula = label("RF(L) = 2^(L+1) − 1        10 blocks  →  2047 timestamps", 26)
        formula.to_edge(DOWN, buff=0.35)
        box = SurroundingRectangle(formula, color=ACCENT, buff=0.2, corner_radius=0.1)
        self.play(FadeOut(in_lbl), FadeIn(formula), Create(box), run_time=0.8)
        self.wait(1.8)


# ---------------------------------------------------------------------------
# 2. The contrastive loss: pull the positive in, push the impostors out
# ---------------------------------------------------------------------------

class ContrastivePullPush(Scene):
    def construct(self):
        title = label("The contrastive step: pull the positive in, push impostors out", 27)
        title.to_edge(UP, buff=0.3)
        self.play(FadeIn(title, shift=DOWN * 0.15), run_time=0.6)

        origin = np.array([-3.3, -0.5, 0.0])
        scale = 2.0

        def tip(angle_deg):
            a = np.deg2rad(angle_deg)
            return origin + scale * np.array([np.cos(a), np.sin(a), 0.0])

        def arrow(angle_deg, color, width=5):
            return Arrow(origin, tip(angle_deg), buff=0, color=color, stroke_width=width,
                         max_tip_length_to_length_ratio=0.13)

        start = {"a": 68.0, "b": 36.0, "c": -40.0, "d": 152.0}
        colors = {"a": ACCENT, "b": POS, "c": NEG, "d": NEG}
        texts = {"a": "anchor", "b": "positive", "c": "impostor", "d": "impostor"}
        offs = {"a": UP * 0.28, "b": RIGHT * 0.8, "c": DOWN * 0.3, "d": UP * 0.32}

        arrows = {k: arrow(v, colors[k], 6 if k == "a" else 5) for k, v in start.items()}
        names = {k: label(texts[k], 20, colors[k]).move_to(tip(start[k]) + offs[k])
                 for k in start}

        caption = label("impostors = other series at the same timestamp", 19, MUTED)
        caption.move_to(np.array([-3.3, -2.95, 0.0]))

        self.play(*[GrowArrow(a) for a in arrows.values()],
                  *[FadeIn(t) for t in names.values()], FadeIn(caption), run_time=1.0)

        def panel(p_line, l_line, l_colour, rows):
            g = VGroup(label("similarity → exp → softmax", 21, MUTED),
                       *[label(r, 21, c) for r, c in rows],
                       label(p_line, 22, INK),
                       label(l_line, 23, l_colour))
            g.arrange(DOWN, aligned_edge=LEFT, buff=0.24)
            g.move_to(np.array([3.6, 0.15, 0.0]))
            return g

        before = panel("p(positive) = 2.61 / 3.67 = 0.71",
                       "loss = −ln(0.71) = 0.34", ACCENT,
                       [("positive   exp(0.96) = 2.61", POS),
                        ("impostor   exp(−0.70) = 0.50", NEG),
                        ("impostor   exp(−0.58) = 0.56", NEG)])
        self.play(LaggedStartMap(FadeIn, before, lag_ratio=0.1), run_time=1.1)

        step = label("gradient:  ∂ℓ/∂s⁺ = p⁺ − 1 < 0   (raise it)      ∂ℓ/∂sⱼ = pⱼ > 0   (lower it)",
                     21, MUTED)
        step.to_edge(DOWN, buff=0.3)
        self.play(FadeIn(step), run_time=0.5)

        end = {"a": 68.0, "b": 60.0, "c": -66.0, "d": 176.0}
        anims = []
        for k, target in end.items():
            anims.append(Transform(arrows[k], arrow(target, colors[k], 6 if k == "a" else 5)))
            anims.append(names[k].animate.move_to(tip(target) + offs[k]))

        after = panel("p(positive) = 2.72 / 3.54 = 0.77",
                      "loss = −ln(0.77) = 0.26", POS,
                      [("positive   exp(1.00) = 2.72", POS),
                       ("impostor   exp(−0.95) = 0.39", NEG),
                       ("impostor   exp(−0.85) = 0.43", NEG)])

        self.play(*anims, Transform(before, after), run_time=1.7)
        self.wait(1.8)


# ---------------------------------------------------------------------------
# 3. Hierarchical contrasting: max-pool, contrast again, average
# ---------------------------------------------------------------------------

class HierarchicalPooling(Scene):
    def construct(self):
        title = label("Hierarchical contrasting: pool, contrast again, average", 27)
        title.to_edge(UP, buff=0.3)
        self.play(FadeIn(title, shift=DOWN * 0.15), run_time=0.6)

        counts = [8, 4, 2, 1]
        rows_y = [1.55, 0.35, -0.85, -2.05]
        losses = ["0.47", "0.52", "0.61", "0.68"]
        spans = ["1 step", "2 steps", "4 steps", "8 steps"]
        centre_x, box_w, gap = 0.55, 0.66, 0.16
        rows = []

        for i, (k, y) in enumerate(zip(counts, rows_y)):
            row = VGroup(*[
                RoundedRectangle(width=box_w, height=0.46, corner_radius=0.07,
                                 stroke_color=ACCENT, stroke_width=2,
                                 fill_color=ACCENT, fill_opacity=0.10)
                for _ in range(k)
            ]).arrange(RIGHT, buff=gap)
            row.move_to(np.array([centre_x, y, 0.0]))

            loss_tag = label(f"L_dual = {losses[i]}", 22)
            loss_tag.move_to(np.array([4.6, y, 0.0]))
            span_tag = label(f"each vector spans {spans[i]}", 19, MUTED)
            span_tag.move_to(np.array([-4.7, y, 0.0]))

            if i == 0:
                self.play(LaggedStartMap(FadeIn, row, lag_ratio=0.06), run_time=0.7)
            else:
                prev = rows[-1]
                brackets = VGroup(*[
                    Line(prev[2 * j + s].get_bottom(), row[j].get_top(),
                         stroke_width=2, color=MUTED, stroke_opacity=0.65)
                    for j in range(k) for s in (0, 1)
                ])
                pool_lbl = label("max-pool, kernel 2", 19, MUTED)
                pool_lbl.move_to(np.array([-4.7, (rows_y[i - 1] + y) / 2, 0.0]))
                self.play(Create(brackets), FadeIn(pool_lbl), run_time=0.55)
                self.play(LaggedStartMap(FadeIn, row, lag_ratio=0.08),
                          FadeOut(pool_lbl), run_time=0.5)

            self.play(FadeIn(loss_tag), FadeIn(span_tag), run_time=0.45)
            rows.append(row)

        total = label("L_total  =  average of the level losses  =  0.57", 25, ACCENT)
        total.to_edge(DOWN, buff=0.3)
        box = SurroundingRectangle(total, color=ACCENT, buff=0.18, corner_radius=0.1)
        self.play(FadeIn(total), Create(box), run_time=0.8)
        self.wait(1.8)
