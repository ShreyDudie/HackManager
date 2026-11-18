import unittest

from app import app


class CompareContractTests(unittest.TestCase):
    def test_compare_accepts_reference_list_in_the_same_multipart_body_as_the_image(self):
        schema = app.openapi()
        operation = schema["paths"]["/internal/face/compare"]["post"]
        body = operation["requestBody"]["content"]["multipart/form-data"]["schema"]
        fields = schema["components"]["schemas"][body["$ref"].split("/")[-1]]["properties"]
        self.assertIn("file", fields)
        self.assertEqual(fields["references"]["type"], "string")
