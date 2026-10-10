"""Bounded Bocha web search; failures leave local QA available."""
import json
import os
from urllib.parse import urlparse
from urllib.request import Request, urlopen

BOCHA_SEARCH_ENDPOINT = 'https://api.bocha.cn/v1/web-search'


def search_web(query: str) -> dict:
    key = os.getenv('BOCHA_API_KEY', '').strip()
    if not key:
        return {'status': 'unconfigured', 'sources': []}
    try:
        request = Request(BOCHA_SEARCH_ENDPOINT, data=json.dumps({
            'query': query[:1000], 'count': 5, 'freshness': 'noLimit',
            'summary': True,
        }).encode(), headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}, method='POST')
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read())
        if not isinstance(payload, dict) or payload.get('code') != 200:
            return {'status': 'unavailable', 'sources': []}
        results = payload['data']['webPages']['value']
        if not isinstance(results, list):
            return {'status': 'unavailable', 'sources': []}
        sources = []
        for item in results:
            if not isinstance(item, dict):
                continue
            url = item.get('url', '')
            if not isinstance(url, str):
                continue
            parsed = urlparse(url)
            if parsed.scheme not in {'http', 'https'} or not parsed.hostname:
                continue
            sources.append({'name': str(item.get('name') or url)[:300], 'url': url,
                            'excerpt': str(item.get('summary') or item.get('snippet') or '')[:1800], 'kind': 'web'})
            if len(sources) == 5:
                break
        return {'status': 'completed' if sources else 'no_results', 'sources': sources}
    except Exception:
        return {'status': 'unavailable', 'sources': []}
