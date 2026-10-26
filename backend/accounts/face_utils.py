import cv2
import numpy as np


def decode_uploaded_image(file_obj):
    image = cv2.imdecode(np.frombuffer(file_obj.read(), np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return None, None
    return image, cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
