import unittest

import numpy as np

from face_processing import compare_embeddings


class CompareEmbeddingsTests(unittest.TestCase):
    def test_selects_closest_matching_embedding(self):
        similarity, index = compare_embeddings(np.array([0.0, 0.0]), [[0.7, 0.0], [0.1, 0.0]])
        self.assertEqual(index, 1)
        self.assertAlmostEqual(similarity, 0.9)

    def test_rejects_wrong_shape_reference(self):
        with self.assertRaises(ValueError):
            compare_embeddings(np.array([0.0, 0.0]), [[0.0]])
