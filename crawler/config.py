"""
爬虫配置文件
"""

# 目标会议列表
VENUES = {
    'SOSP': {
        'name': 'SOSP',
        'type': 'conference',
        'tier': '顶会',
        'search_terms': ['SOSP'],
    },
    'OSDI': {
        'name': 'OSDI',
        'type': 'conference',
        'tier': '顶会',
        'search_terms': ['OSDI'],
    },
    'ATC': {
        'name': 'USENIX ATC',
        'type': 'conference',
        'tier': '顶会',
        'search_terms': ['USENIX Annual Technical Conference', 'USENIX ATC'],
    },
    'ASPLOS': {
        'name': 'ASPLOS',
        'type': 'conference',
        'tier': '顶会',
        'search_terms': ['ASPLOS'],
    },
    'EuroSys': {
        'name': 'EuroSys',
        'type': 'conference',
        'tier': '顶会',
        'search_terms': ['EuroSys'],
    },
    'SC': {
        'name': 'SC',
        'type': 'conference',
        'tier': '顶会',
        'search_terms': ['Supercomputing', 'SC Conference'],
    },
}

# 年份范围
YEAR_START = 2011
YEAR_END = 2025

# API配置
DBLP_API = {
    'base_url': 'https://dblp.org/search/publ/api',
    'request_delay': 1.5,  # 秒
    'timeout': 30,
}

SEMANTIC_SCHOLAR_API = {
    'base_url': 'https://api.semanticscholar.org/graph/v1',
    'request_delay': 0.6,  # 秒（免费版限制每分钟100次）
    'timeout': 30,
}

# 输出配置
OUTPUT_DIR = '../public/data'
OUTPUT_FILE = 'papers.json'
BACKUP_DIR = '../data/raw'
