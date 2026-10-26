import cv2
import numpy as np
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from .face_utils import decode_uploaded_image


class DecodeUploadedImageTests(SimpleTestCase):
    def test_decodes_a_valid_uploaded_image(self):
        success, encoded = cv2.imencode(".jpg", np.zeros((2, 2, 3), dtype=np.uint8))
        self.assertTrue(success)

        image, image_rgb = decode_uploaded_image(SimpleUploadedFile("face.jpg", encoded.tobytes()))

        self.assertEqual(image.shape, (2, 2, 3))
        self.assertEqual(image_rgb.shape, (2, 2, 3))

    def test_rejects_invalid_image_data(self):
        image, image_rgb = decode_uploaded_image(SimpleUploadedFile("face.jpg", b"not an image"))

        self.assertIsNone(image)
        self.assertIsNone(image_rgb)
