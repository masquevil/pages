"""Fit a transparent pet drawing in the existing 290×310 page slot."""
import numpy as np
from PIL import Image


def fit_slot(image):
    alpha = np.asarray(image.getchannel('A'))
    ys, xs = np.where(alpha > 50)
    if len(xs) == 0:
        raise ValueError('没有找到宠物轮廓')
    crop = image.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    scale = min(230 / crop.width, 266 / crop.height)
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    crop = crop.resize(size, Image.Resampling.LANCZOS)
    result = Image.new('RGBA', (290, 310), (0, 0, 0, 0))
    result.alpha_composite(crop, ((290 - size[0]) // 2, 310 - 13 - size[1]))
    return result