---
name: somed-ig-carousel
description: Make Instagram carousel posts (轮播贴文) for SOMED Skin Studio (@somed.skinstudio), a premium clinical skincare studio (高级科技护肤) featuring the SOMED R2. Use whenever Hannah asks for a SOMED / somed.skinstudio IG post, carousel, 轮播 or 贴文 on any topic. Renders 1080×1350 slides (2160×2700 PNG) in the fixed light "Clinical" brand look with the mint/sage/deep-green palette.
---

# SOMED Skin Studio IG 轮播（浅色 Clinical 版）

Hannah runs @somed.skinstudio, a premium clinical skincare studio (Premium Clinical Skincare · 高级科技护肤) with the SOMED R2 as its hero product. She gives a topic every day; you write the copy, decide the slide count, render the slides, and send them. Every carousel uses the ONE template in `scripts/render.js`. Never invent a new style. Only the copy and photos change. She should never have to repeat a rule written here.

The layout follows the 琰琰说说看 editorial structure (serif headline, rule, outlined cards with line icons, numbered rows, tip bar, summary grid + comment box). It is recoloured for a light, clean, clinical feel. Never use coral pink (#FF8FA3) or a dark photo background on content slides.

## Brand palette (fixed, do not change)

| Token | Hex | Use |
|---|---|---|
| 01 Signature Mint Green | `#C8E5CB` | Main colour: cover background, icon circles, highlighter under the keyword |
| 02 Soft Sage Green | `#A5C9A8` | Secondary: card borders, dividers, decorative circles |
| 03 Botanical Deep Green | `#376B4C` | Accent: headline keyword, card titles, number circles, tip bar, end-slide background, bottom bar |
| 04 Clinical White | `#F8FAF6` | Content-slide background, white space |

Derived neutrals (already in the script): ink `#22392B` for headline line 1, body text `#3F4F44`, muted `#6B7F70` for the hook line. The hex values were picked by eye from a product photo, so they may differ from the official brand codes. If Hannah gives official codes, update `C` at the top of `render.js`.

## Logo (top-left circle)

- The script uses `assets/logo.png` (or `.jpg/.svg`) in this skill folder automatically. If it's missing, it prints a warning and shows a text circle reading "SOMED".
- When Hannah uploads the SOMED logo, copy it to `assets/logo.png` in the skill folder (and keep a copy next to the spec, passing `"logo": "<path>"`, if the skill folder is read-only). If there's no logo, tell her once that the text circle is a placeholder.

## How to build (every time)

1. Write a spec JSON in the scratchpad (the format is below; `examples/demo.json` is a full example).
2. Run `node <skill>/scripts/render.js spec.json <outDir>`. Playwright and Chromium are preinstalled. Fonts: if `fc-list | grep "Noto Serif CJK SC"` is empty, run `apt-get install -y fonts-noto-cjk` first.
3. The script runs a layout check. Fix every `⚠` (shorten the copy, never shrink the font sizes) and re-render until it reports `排版检查通过`.
4. Open `_contact_sheet.png` yourself and check that nothing overlaps, no text covers a face or the product, and the rhythm works.
5. Send the PNGs into chat in order (SendUserFile, display `render`), then send the copy as a numbered list plus the IG caption.
6. When she asks to download, send all files again in order (display `attach`) and remind her to turn on IG「上传最高质量」.
7. For tweaks, edit the spec, re-render, and resend only the changed slides.

Files are named `<topic>轮播_01_HD.png` … `_0N_HD.png`.

## Choosing the slide count (you decide from the information she gives)

- Thin topic or a single tip → **3 张**: cover + view + end
- Normal topic → **5 张**: cover + 2 inner slides + view + end
- Rich topic / product launch / step-by-step → **7 张**: cover + 4 inner slides + view + end
- Maximum 8. Mix `cards` and `list` for the inner slides. Use `product` whenever SOMED R2 or a treatment is the subject (normally as the last inner slide, right before view). The last inner slide hands off to view through its hook, e.g. `那到底适不适合你？往左滑 →`.

## Spec format

```json
{
  "topic": "R2术后修护",
  "logo": "optional/path.png",
  "slides": [ { "type": "...", ... } ]
}
```

Any text field supports `**重点**` (deep green, bold) and `\n` (line break). `title` is always `[line1, line2]`. Line 2 automatically gets the mint highlighter.

Common optional fields: `photo` (path), `photoPos` (CSS object-position), `photoHint` (shown as a small grey 「📷 建议照片」 note in the header when there's no photo), `hook`.

| type | Fields | Notes |
|---|---|---|
| `cover` | `eyebrow:[a,b]`, `title`, `tag`, `summary`, `hook` | Mint background with decorative circles; a full-bleed photo fades into mint at the bottom. Title max 9 characters per line. No quotation marks「“ ”」. |
| `cards` | `title`, `lead`, `cards:[{icon,title,desc}×3]`, `tip`, `hook` | Default card titles: 为什么… / 放着不管会怎样 / 怎么做. Desc max 2 short lines. |
| `list` | `title`, `sub`, `items:[{title,desc}×3]`, `tip`, `hook` | Numbered key points. Leave out `tip` if space is tight. |
| `product` | `title`, `name`, `photo`, `photoFit`(`cover`/`contain`), `features:[{icon,label,desc}×2–4]`, `hook` | Product photo in a rounded frame + a feature grid. A white or mint background photo looks best; use `contain` for cut-outs. |
| `view` | `eyebrow`(default 专业建议), `title`, `cardTitle`(SOMED 的建议 / SOMED 的做法), `stance`, `points:[4–5]`, `why`, `hook` | Always the slide right before end. |
| `end` | `title`, `grid:[{label,unit?,answer}×4]`, `question`, `invite` | Deep-green background, saveable summary. The grid must not repeat the view points. |

Icons: `drop shield sparkle sun clock layers check leaf flask face target wave calendar heart alert bulb chat`.

## Copy rules

- Simplified Chinese. Premium, calm, professional, warm: like a skin therapist explaining clearly, not a hard sell. Flow: hook → mechanism → what to do → SOMED's view → takeaway.
- Headlines follow symptom → hidden cause (`毛孔越来越明显` / `可能是胶原在流失`) or myth-buster (`做完疗程不用保养？` / `修护才是关键`).
- Hook line (small grey line above the footer): max ~20 characters, a question, teaser or save prompt. Never a photo credit. On a slide with statistics, add `｜资料：<来源>`.
- **SOMED's view (view slide)**: if Hannah didn't give the studio's own view or practice for this topic, ask her in ONE short question before building. Never invent it; keep her wording.
- **Product facts**: use only what Hannah provides about SOMED R2 (technology, effects, duration, frequency, price). Anything missing becomes `[待填：…]` and is flagged to her. No invented statistics, studies, certifications or doctor quotes. A source she hasn't given becomes `[来源待补]`.
- **Compliance**: no medical claims. Never use 治疗/治愈/根治/保证/永久/100%/无副作用. Prefer 改善、帮助、维持、视个人肤况而定. When content touches sensitive or irritated skin or post-procedure care, include once: `症状持续请先咨询皮肤科医生`. Never place before/after photos or product photos directly next to research claims.
- End-slide CTA invites comments with a low-barrier, public-friendly question (`你最想改善的是哪一个？` / `你是 A 派还是 B 派？`). Never ask embarrassing or personal health questions. Never promise giveaways or DM rewards unless Hannah says she'll deliver them. A booking line in the caption is fine (`预约 / 咨询请私讯 @somed.skinstudio`).
- Bio line on the end slide (automatic): `SOMED Skin Studio｜高级科技护肤 · 专业皮肤管理`. Change it in the spec with `"bio"` only if she asks.

## IG caption

After the slides, write: a hook line, 3–5 short lines of value, the same comment question as the end slide, a booking line, then 8–15 hashtags (mix Chinese and English, e.g. `#SOMED #somedskinstudio #科技护肤 #皮肤管理 #clinicalskincare #skincare #护肤 #敏感肌` plus topic tags). If results or efficacy are mentioned, add `效果因人而异，护理前请先由专业人员评估肤况。`

## Photos

- Cover: product (SOMED R2), treatment-room close-up, or a model. Keep faces and the product above the text block (bottom ~45%). Set `photoPos`.
- Inner slides: faceless photos only (textures, product, tools), because cards cover two-thirds of the slide. The light overlay keeps the text readable.
- Flag any photo under ~1500px on its short side as possibly soft and ask for the original.
- Without photos, the slides still work (clean clinical background). Fill in `photoHint` so she knows what to shoot.
