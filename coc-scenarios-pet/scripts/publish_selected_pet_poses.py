"""Publish the twelve transparent poses from each selected poses/<animal>-01.png."""
import shutil
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from pet_slot import fit_slot
POSES = ('healthy-back', 'healthy-belly-up', 'healthy-curl', 'healthy-reach',
         'healthy-window-back', 'healthy-float', 'healthy-travel', 'dirty-sit',
         'old-look', 'old-float', 'old-back', 'old-back-right')


def filename(animal, pose):
    if pose in ('old-float', 'old-back', 'old-back-right'):
        suffix = 'winged' if animal == 'dog' else 'magic'
        return f'{animal}-{pose}-{suffix}.png' if pose != 'old-back-right' else f'{animal}-old-back-{suffix}-right.png'
    return f'{animal}-{pose}.png'

PETS = Path(__file__).resolve().parents[1] / 'picture-book/assets/pets'


def extract_sheet(sheet, animal):
    """Select by grid centre, but crop whole alpha components rather than grid boxes."""
    rgba = np.asarray(sheet.convert('RGBA'))
    height, width = rgba.shape[:2]
    count, labels, stats, centres = cv2.connectedComponentsWithStats(
        (rgba[:, :, 3] > 220).astype(np.uint8), 8)
    cells = {}
    for label in range(1, count):
        x, y, w, h, area = map(int, stats[label])
        if area < 5000:
            continue  # e.g. faint separator lines on the cat sheet
        col = min(3, int(centres[label, 0] * 4 / width))
        row = min(2, int(centres[label, 1] * 3 / height))
        index = row * 4 + col
        if index in cells:
            raise ValueError(f'{animal}: multiple figures in cell {index + 1}')
        cells[index] = (label, x, y, w, h)
    if set(cells) != set(range(12)):
        raise ValueError(f'{animal}: missing or misplaced figures: {sorted(set(range(12)) - set(cells))}')
    result = {}
    for index, pose in enumerate(POSES):
        label, x, y, w, h = cells[index]
        pad = 4
        x0, y0 = max(0, x - pad), max(0, y - pad)
        x1, y1 = min(width, x + w + pad), min(height, y + h + pad)
        # Extend the opaque component into its own antialiased edge, but not
        # into grid lines or neighbouring figures. Keep the original RGBA pixels.
        component = (labels == label).astype(np.uint8)
        component = cv2.dilate(component, np.ones((5, 5), np.uint8))
        cropped = rgba[y0:y1, x0:x1].copy()
        cropped[:, :, 3] *= component[y0:y1, x0:x1]
        sprite = fit_slot(Image.fromarray(cropped, 'RGBA'))
        alpha = np.asarray(sprite.getchannel('A'))
        if alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any():
            raise ValueError(f'{animal}: {pose} touches output edge')
        result[filename(animal, pose).removeprefix(f'{animal}-')] = sprite
    return result


def main():
    with tempfile.TemporaryDirectory(prefix='pet-selected-poses-') as staging:
        stage = Path(staging)
        for animal in ('dog', 'cat', 'bird'):
            source = PETS / 'poses' / f'{animal}-01.png'
            with Image.open(source) as sheet:
                if sheet.format != 'PNG' or 'A' not in sheet.getbands():
                    raise ValueError(f'{source}: expected transparent PNG')
                sprites = extract_sheet(sheet, animal)
            for name, sprite in sprites.items():
                if not (PETS / animal / name).is_file():
                    raise FileNotFoundError(PETS / animal / name)
                output = stage / animal / name
                output.parent.mkdir(exist_ok=True)
                sprite.save(output)
        backup = Path(tempfile.mkdtemp(prefix='pet-previous-live-'))
        for animal in ('dog', 'cat', 'bird'):
            for source in (stage / animal).glob('*.png'):
                live = PETS / animal / source.name
                previous = backup / animal / source.name
                previous.parent.mkdir(exist_ok=True)
                shutil.copy2(live, previous)
                shutil.copy2(source, live)
        print(f'Published 36 sprites from poses/*-01.png; previous files: {backup}')


if __name__ == '__main__':
    main()