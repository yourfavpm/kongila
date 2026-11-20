# Regenerating the invoice PDF logo

`packages/notifications/brandLogo.ts` holds the Kongila wordmark as two raw
deflate streams, ready for a PDF to embed. It is generated, not hand-written.

Why it is not just the PNG: a PDF cannot take a PNG's RGBA directly. The colour
and the transparency go in as two separate streams, and converting them at
runtime would mean un-filtering 440 x 126 pixels on every invoice.

## When to regenerate

When the logo changes. The source is
`apps/admin-panel/public/images/kongilalogo-cropped.png`.

## How

The source PNG must be 8-bit, non-interlaced, colour type 6 (RGBA) or 2 (RGB).
Most export tools produce that by default. Run:

```bash
python3 scripts/build-pdf-logo.py \
  apps/admin-panel/public/images/kongilalogo-cropped.png \
  packages/notifications/brandLogo.ts
```

Then check the result by generating an invoice and opening it, rather than by
trusting that it worked. A logo that embedded wrongly usually renders as a
black rectangle, not as an error.
