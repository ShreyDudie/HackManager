import cv2
import numpy as np

MAX_IMAGE_PIXELS = 16_000_000


def decode_image(data: bytes):
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return None, None
    if image.shape[0] * image.shape[1] > MAX_IMAGE_PIXELS:
        return None, None
    return image, cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
