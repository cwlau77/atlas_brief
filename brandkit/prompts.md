# Higgsfield generation log (Atlas brand identity)

Workspace: Private (free plan). Starting balance 10 credits; ending balance 4.

| Asset | Model | Job id | Credits | Outcome |
|---|---|---|---|---|
| 3D logo render | seedream_v5_pro | (refused) | 0 | `job_minimum_basic_plan_required`: paid plan only |
| 3D logo render | nano_banana_2 (ran as Nano Banana Pro) | 416a1073-80e6-465b-9d35-6c6a5df78c19 | 2 | Rejected by the user: too realistic next to the flat minimal mark. No retry. |
| Masthead backdrop (21:9) | nano_banana_2 | d730c5cf-a2e2-4d3d-8209-d1b55df770fe | 2 | Rejected by the user: vibe does not fit. |
| Share-card backdrop (16:9) | nano_banana_2 | a2540b2a-5e57-4144-b097-86435e3931fa | 2 | Rejected by the user: smoky, too photographic. |

Decision: no generated imagery ships. The flat G5 mark replaces the 3D render (empty archive, Not found, share card) and CSS grain gradients replace both backdrops.

Prompts used are in the implementation plan, Task 7 (the 3D render used a 512 px render of `atlas-mark.svg` as its image reference).

## Footer painting (2026-10-19)

Source: the owner's own Nano Banana (Gemini) generation, supplied as `image_7eb343f5.jpg` (1584 × 672). No Higgsfield credits were used.

Prompt:

> Wide panoramic painting of an arctic mountain range, 21:9. Hand-painted oil on canvas with visible palette-knife and brush texture, like a quiet museum landscape — not a photograph, not 3D, not low-poly. Layered ridges receding into haze: a tall snow-capped central peak with glaciers and snowfields, sharp rocky ridgelines with natural erosion detail, softer distant ranges behind, and a darker foreground ridge with sparse pines. Strictly limited celadon palette: pale celadon #B4CCBE, mid celadon #5E8A79, deep celadon #3A5F52, snow in warm off-white #F8F4EB, shadows in cool grey-green. No blue sky, no saturated colours. The top 40% is empty pale sky that fades smoothly to solid #F8F4EB at the top edge so it blends into a web page. Soft, even morning light from the left. No people, buildings, text, borders or vignette.

Processing: rows 231–671 kept (sky trimmed), centre-cropped to 1400 px wide to remove the Gemini sparkle watermark, then exported with `sips` as `frontend/public/brand/mountains@2x.jpg` (1400 px) and `mountains.jpg` (700 px). JPEG only: this machine's `sips` cannot write WebP. Replace both with a ~3000 px re-export when the owner supplies one.
