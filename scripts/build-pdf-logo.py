#!/usr/bin/env python3
"""
Turns a PNG into the two deflate streams a PDF needs.

Reads an 8-bit, non-interlaced PNG (colour type 2 or 6), un-filters it, splits
colour from transparency, and writes packages/notifications/brandLogo.ts.

Usage:
    python3 scripts/build-pdf-logo.py <source.png> <output.ts>

Nothing here depends on a package being installed. zlib and struct ship with
Python, which is the whole reason this is a script and not a build step.
"""

import base64
import struct
import sys
import zlib


def paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def read_png(path):
    raw = open(path, 'rb').read()
    if raw[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit(f'{path} is not a PNG.')

    pos, idat, header = 8, b'', None
    while pos < len(raw):
        length = struct.unpack('>I', raw[pos:pos + 4])[0]
        kind = raw[pos + 4:pos + 8]
        if kind == b'IHDR':
            header = struct.unpack('>IIBBBBB', raw[pos + 8:pos + 21])
        elif kind == b'IDAT':
            idat += raw[pos + 8:pos + 8 + length]
        pos += 12 + length

    if header is None:
        raise SystemExit('No IHDR chunk, so this file is not a readable PNG.')

    width, height, depth, colour, _, _, interlace = header
    if depth != 8:
        raise SystemExit(f'Only 8-bit PNGs are supported; this one is {depth}-bit.')
    if interlace:
        raise SystemExit('Interlaced PNGs are not supported. Re-export without interlacing.')
    if colour not in (2, 6):
        raise SystemExit(f'Colour type {colour} is not supported. Export as RGB or RGBA.')

    channels = 4 if colour == 6 else 3
    data = zlib.decompress(idat)
    stride = width * channels

    out, previous, offset = bytearray(), bytearray(stride), 0
    for _ in range(height):
        kind = data[offset]
        offset += 1
        line = bytearray(data[offset:offset + stride])
        offset += stride

        if kind == 1:
            for x in range(channels, stride):
                line[x] = (line[x] + line[x - channels]) & 255
        elif kind == 2:
            for x in range(stride):
                line[x] = (line[x] + previous[x]) & 255
        elif kind == 3:
            for x in range(stride):
                left = line[x - channels] if x >= channels else 0
                line[x] = (line[x] + ((left + previous[x]) >> 1)) & 255
        elif kind == 4:
            for x in range(stride):
                left = line[x - channels] if x >= channels else 0
                up_left = previous[x - channels] if x >= channels else 0
                line[x] = (line[x] + paeth(left, previous[x], up_left)) & 255
        elif kind != 0:
            raise SystemExit(f'Unknown PNG filter {kind}.')

        out += line
        previous = line

    rgb, alpha = bytearray(), bytearray()
    for pixel in range(width * height):
        at = pixel * channels
        rgb += out[at:at + 3]
        if channels == 4:
            alpha.append(out[at + 3])

    return width, height, bytes(rgb), bytes(alpha)


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__.strip())

    source, target = sys.argv[1], sys.argv[2]
    width, height, rgb, alpha = read_png(source)

    rgb_stream = base64.b64encode(zlib.compress(rgb, 9)).decode()
    alpha_stream = base64.b64encode(zlib.compress(alpha, 9)).decode() if alpha else ''

    def chunks(text):
        return '\n'.join(f"  '{text[i:i + 100]}'," for i in range(0, len(text), 100))

    body = f'''/**
 * The Kongila wordmark, ready to drop into a PDF.
 *
 * Generated from {source} by scripts/build-pdf-logo.py. Do not edit by hand.
 *
 * `rgb` is the image and `alpha` is its transparency, which a PDF carries as
 * a separate greyscale soft mask. Both are raw deflate streams, which is what
 * /FlateDecode expects, so neither is touched between here and the file.
 */

export const BRAND_LOGO = {{
  width: {width},
  height: {height},
  rgb: [
{chunks(rgb_stream)}
  ].join(''),
  alpha: [
{chunks(alpha_stream)}
  ].join('')
}};
'''

    open(target, 'w', encoding='utf-8').write(body)
    print(f'{target}: {width} x {height}, rgb {len(rgb_stream)} chars, alpha {len(alpha_stream)} chars')


if __name__ == '__main__':
    main()
