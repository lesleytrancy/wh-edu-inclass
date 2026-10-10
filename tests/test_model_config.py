import json
import os
import unittest
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from urllib.error import HTTPError

from server.model_config import load_ai_environment
from server.app import ModelServiceError, ai_failure, call_model


class ModelConfigTest(unittest.TestCase):
    def test_worker_overwrites_stale_ai_env_without_changing_unrelated_settings(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text('DOUBAO_THINKING_MODEL=ep-new\nDOUBAO_THINKING_REASONING_EFFORT=high\nAI_DATA_DIR=/ignored\nBOCHA_API_KEY=\n')
            with patch.dict(os.environ, {'DOUBAO_THINKING_MODEL': '', 'AI_DATA_DIR': '/original'}, clear=True):
                load_ai_environment(path)
                self.assertEqual(os.environ['DOUBAO_THINKING_MODEL'], 'ep-new')
                self.assertEqual(os.environ['DOUBAO_THINKING_REASONING_EFFORT'], 'high')
                self.assertEqual(os.environ['AI_DATA_DIR'], '/original')
                path.write_text('DOUBAO_THINKING_MODEL=ep-changed\n')
                load_ai_environment(path)
                self.assertEqual(os.environ['DOUBAO_THINKING_MODEL'], 'ep-changed')

    def test_missing_local_file_preserves_deployment_environment(self):
        with patch.dict(os.environ, {'DOUBAO_THINKING_MODEL': 'ep-deployment'}, clear=True):
            load_ai_environment(Path('/not-a-config-directory/.env'))
            self.assertEqual(os.environ['DOUBAO_THINKING_MODEL'], 'ep-deployment')

    def test_upstream_rate_limit_remains_actionable_and_does_not_leak_body(self):
        error = HTTPError('https://example.org', 429, 'rate limited', {}, BytesIO(json.dumps({'error': {'code': 'RateLimitExceeded', 'message': 'private prompt should not be returned'}}).encode()))
        with patch.dict(os.environ, {'DOUBAO_API_KEY': 'test-secret', 'DOUBAO_FLASH_MODEL': 'flash'}, clear=True), patch('server.app.urlopen', side_effect=error):
            with self.assertRaises(ModelServiceError) as caught:
                call_model([], purpose='flash')
        response = ai_failure(caught.exception, 'generic error')
        self.assertEqual(response.status_code, 429)
        self.assertIn('RateLimitExceeded', response.detail)
        self.assertNotIn('test-secret', response.detail)
        self.assertNotIn('private prompt', response.detail)

    def test_upstream_auth_error_has_configuration_hint(self):
        error = HTTPError('https://example.org', 401, 'unauthorized', {}, BytesIO(b'{"error":{"code":"InvalidApiKey"}}'))
        with patch.dict(os.environ, {'DOUBAO_API_KEY': 'test-secret', 'DOUBAO_THINKING_MODEL': 'thinking'}, clear=True), patch('server.app.urlopen', side_effect=error):
            with self.assertRaisesRegex(ModelServiceError, 'DOUBAO_API_KEY'):
                call_model([])
