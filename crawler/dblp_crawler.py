"""
DBLP数据库爬虫
使用DBLP API获取论文数据
"""

import requests
import time
import json
from typing import List, Dict
from tqdm import tqdm
from config import DBLP_API, YEAR_START, YEAR_END


def fetch_papers_from_dblp(venue_name: str, year: int) -> List[Dict]:
    """
    从DBLP获取指定会议和年份的论文
    
    Args:
        venue_name: 会议名称
        year: 年份
        
    Returns:
        论文列表
    """
    papers = []
    seen_ids = set()
    
    # 使用多种查询策略
    queries = [
        f"venue:{venue_name}:{year}",  # 根据测试，这个格式有效
        f"venue:{venue_name} {year}",
        f"{venue_name} {year}",
    ]
    
    for query in queries:
        url = f"{DBLP_API['base_url']}?q={query}&format=json&h=1000"
        
        try:
            response = requests.get(url, timeout=DBLP_API['timeout'])
            response.raise_for_status()
            
            data = response.json()
            hits = data.get('result', {}).get('hits', {}).get('hit', [])
            
            # 如果hits不是列表，转换为列表
            if not isinstance(hits, list):
                hits = [hits] if hits else []
            
            for hit in hits:
                info = hit.get('info', {})
                paper_year = info.get('year')
                
                # 检查年份是否匹配
                if not paper_year:
                    continue
                try:
                    if int(paper_year) != year:
                        continue
                except (ValueError, TypeError):
                    continue
                
                # 检查是否为proceedings或会议信息（过滤掉）
                title = info.get('title', '')
                if not title or title == 'Untitled':
                    continue
                
                title_lower = title.lower()
                # 过滤掉proceedings、workshop信息等
                if any(keyword in title_lower for keyword in [
                    'proceedings', 'workshop proceedings', 'conference proceedings',
                    'call for', 'program committee', 'organizing committee',
                    'table of contents', 'author index', 'symposium on',
                    'conference on', 'international conference'
                ]):
                    # 但如果标题很短（<100字符）且包含会议名称，可能是论文标题
                    if len(title) > 100:
                        continue
                
                # 检查会议名称是否匹配（在venue或booktitle中）
                venue = (info.get('venue') or info.get('booktitle') or '').lower()
                venue_name_lower = venue_name.lower()
                
                # 对于SC，需要更严格的匹配
                if venue_name_lower == 'sc':
                    if 'supercomputing' not in venue and 'sc conference' not in venue:
                        continue
                elif venue_name_lower not in venue:
                    continue
                
                # 生成唯一ID并去重
                paper_id = info.get('key') or info.get('doi') or f"dblp-{hit.get('@id', '')}"
                if paper_id in seen_ids:
                    continue
                seen_ids.add(paper_id)
                
                # 提取作者信息
                authors = []
                authors_data = info.get('authors', {})
                
                # 处理authors字段（可能是dict或list）
                if isinstance(authors_data, dict):
                    author_list = authors_data.get('author', [])
                elif isinstance(authors_data, list):
                    author_list = authors_data
                else:
                    author_list = []
                
                if not isinstance(author_list, list):
                    author_list = [author_list]
                
                for author in author_list:
                    if isinstance(author, str):
                        name = author
                        author_id = name.lower().replace(' ', '-').replace('.', '')
                    elif isinstance(author, dict):
                        name = author.get('text') or author.get('@pid', '')
                        author_id = author.get('@pid') or name.lower().replace(' ', '-').replace('.', '')
                    else:
                        continue
                    
                    if name:
                        authors.append({
                            'id': author_id,
                            'name': name,
                            'affiliations': [],
                            'country': None,
                        })
                
                paper = {
                    'id': paper_id,
                    'title': title,
                    'authors': authors,
                    'venue': {
                        'name': info.get('venue') or info.get('booktitle') or venue_name,
                        'type': 'conference',
                        'tier': '顶会',
                    },
                    'year': int(paper_year),
                    'keywords': [],
                    'abstract': info.get('abstract', ''),
                    'references': [],
                    'citations': 0,
                    'doi': info.get('doi', ''),
                    'url': info.get('ee', '') or info.get('url', ''),
                    'dblpKey': info.get('key', ''),
                }
                
                papers.append(paper)
        
        except requests.exceptions.RequestException:
            continue
        except json.JSONDecodeError:
            continue
        except Exception:
            continue
        
        # 如果第一个查询有结果，就不尝试其他查询了
        if papers:
            break
    
    return papers


def fetch_venue_papers(venue_name: str, search_terms: List[str], start_year: int, end_year: int) -> List[Dict]:
    """
    批量获取会议论文
    
    Args:
        venue_name: 会议名称（用于显示）
        search_terms: 搜索关键词列表
        start_year: 起始年份
        end_year: 结束年份
        
    Returns:
        论文列表
    """
    all_papers = []
    
    print(f"\n开始获取 {venue_name} ({start_year}-{end_year}) 的论文...")
    
    for year in tqdm(range(start_year, end_year + 1), desc=f"  {venue_name}", leave=False):
        # 尝试每个搜索关键词
        papers_for_year = []
        for search_term in search_terms:
            papers = fetch_papers_from_dblp(search_term, year)
            if papers:
                papers_for_year = papers
                break
        
        all_papers.extend(papers_for_year)
        time.sleep(DBLP_API['request_delay'])
    
    print(f"  {venue_name} 总共获取到 {len(all_papers)} 篇论文")
    return all_papers


if __name__ == '__main__':
    # 测试
    print("测试DBLP API连接...")
    papers = fetch_papers_from_dblp('SOSP', 2021)
    print(f"获取到 {len(papers)} 篇论文")
    if papers:
        print(f"\n示例论文:")
        paper = papers[0]
        print(f"  标题: {paper['title']}")
        print(f"  年份: {paper['year']}")
        print(f"  作者数: {len(paper['authors'])}")
        print(f"  会议: {paper['venue']['name']}")
