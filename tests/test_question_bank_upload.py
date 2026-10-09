import asyncio
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi import UploadFile, HTTPException
from server.app import upload_question_bank

class QuestionBankUploadTest(unittest.TestCase):
    def upload(self, bank):
        with tempfile.TemporaryDirectory() as directory, patch('server.app.UPLOAD_DIR', Path(directory)):
            return asyncio.run(upload_question_bank(UploadFile(filename='题库.json', file=io.BytesIO(json.dumps(bank).encode()))))

    def test_json_bank_keeps_answers_images_and_difficulty(self):
        bank = self.upload({'name': '测试题库', 'questions': [{'question': '观察图回答', 'options': ['A', 'B'], 'answer': 'A', 'type': 'single', 'difficulty': 'medium', 'images': ['/question-bank/image2.png']}]})
        self.assertEqual(bank['questions'][0]['answer'], 'A')
        self.assertEqual(bank['name'], '测试题库')
        self.assertTrue(bank['id'])

    def test_invalid_bank_is_rejected(self):
        with self.assertRaises(HTTPException):
            self.upload({'questions': [{'question': '没有答案'}]})
