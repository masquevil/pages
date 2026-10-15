"""Selected transparent sheets crop into the existing page sprite slots."""
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from publish_selected_pet_poses import PETS, extract_sheet  # noqa: E402


class SelectedPetPosesTest(unittest.TestCase):
    def test_all_selected_sheets_have_twelve_transparent_sprites(self):
        for animal in ('dog', 'cat', 'bird'):
            with self.subTest(animal=animal), Image.open(PETS / 'poses' / f'{animal}-01.png') as sheet:
                sprites = extract_sheet(sheet, animal)
                self.assertEqual(len(sprites), 12)
                for name, sprite in sprites.items():
                    alpha = np.asarray(sprite.getchannel('A'))
                    self.assertEqual(sprite.size, (290, 310), name)
                    self.assertGreater(np.count_nonzero(alpha > 128), 3000, name)
                    self.assertFalse(alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any(), name)


if __name__ == '__main__':
    unittest.main()