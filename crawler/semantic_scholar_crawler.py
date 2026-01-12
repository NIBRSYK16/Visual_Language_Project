"""
Semantic Scholar API爬虫
用于补充论文的详细信息（引用数、关键词、摘要等）
"""

import requests
import time
from typing import Dict, Optional
from config import SEMANTIC_SCHOLAR_API


def fetch_paper_details(paper_title: str, doi: str = None) -> Optional[Dict]:
    """
    从Semantic Scholar获取论文详细信息
    
    Args:
        paper_title: 论文标题
        doi: DOI（可选）
        
    Returns:
        论文详细信息字典，如果未找到则返回None
    """
    if not paper_title and not doi:
        return None
    
    # 构建查询
    query = f"doi:{doi}" if doi else paper_title
    url = f"{SEMANTIC_SCHOLAR_API['base_url']}/paper/search"
    params = {
        'query': query,
        'limit': 1,
        'fields': 'title,abstract,citationCount,keywords,year,authors,references,externalIds,authors.affiliations'
    }
    
    try:
        time.sleep(SEMANTIC_SCHOLAR_API['request_delay'])
        response = requests.get(url, params=params, timeout=SEMANTIC_SCHOLAR_API['timeout'])
        response.raise_for_status()
        
        data = response.json()
        papers = data.get('data', [])
        
        if papers:
            paper = papers[0]
            # 提取作者及其机构信息
            authors_with_affiliations = []
            for author in paper.get('authors', []):
                author_data = {
                    'name': author.get('name', ''),
                    'affiliations': author.get('affiliations', []),
                }
                authors_with_affiliations.append(author_data)
            
            return {
                'abstract': paper.get('abstract', ''),
                'citations': paper.get('citationCount', 0),
                'keywords': paper.get('keywords', []),
                'year': paper.get('year'),
                'references': [ref.get('paperId') for ref in paper.get('references', []) if ref.get('paperId')],
                'authors_with_affiliations': authors_with_affiliations,  # 用于推断country
            }
    
    except requests.exceptions.RequestException as e:
        pass  # 静默失败，不影响主流程
    except Exception as e:
        pass
    
    return None


def enhance_paper_with_semantic_scholar(paper: Dict) -> Dict:
    """
    使用Semantic Scholar数据增强论文信息
    
    Args:
        paper: 论文字典
        
    Returns:
        增强后的论文字典（修改原字典）
    """
    details = fetch_paper_details(paper.get('title', ''), paper.get('doi', ''))
    
    if details:
        # 补充基本信息
        if not paper.get('abstract'):
            paper['abstract'] = details.get('abstract', '')
        if paper.get('citations', 0) == 0:
            paper['citations'] = details.get('citations', 0)
        if not paper.get('keywords') or len(paper.get('keywords', [])) == 0:
            paper['keywords'] = details.get('keywords', [])
        if not paper.get('year'):
            paper['year'] = details.get('year') or paper.get('year')
        if not paper.get('references') or len(paper.get('references', [])) == 0:
            paper['references'] = details.get('references', [])
        
        # 更新作者机构信息
        authors_with_affiliations = details.get('authors_with_affiliations', [])
        if authors_with_affiliations:
            # 匹配并更新作者信息
            paper_authors = paper.get('authors', [])
            for i, author in enumerate(paper_authors):
                if i < len(authors_with_affiliations):
                    ss_author = authors_with_affiliations[i]
                    # 如果名称匹配（简单的模糊匹配），更新机构信息
                    if ss_author.get('name') and author.get('name'):
                        # 更新机构信息
                        author['affiliations'] = ss_author.get('affiliations', [])
    
    return paper
