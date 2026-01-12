"""
数据增强脚本
使用Semantic Scholar API等数据源补充缺失的信息
包括：keywords, abstract, citations, references, country
"""

import json
import time
import requests
from typing import Dict, List, Optional
from tqdm import tqdm
from config import SEMANTIC_SCHOLAR_API
from semantic_scholar_crawler import fetch_paper_details, enhance_paper_with_semantic_scholar


def infer_country_from_affiliation(affiliation: str) -> Optional[str]:
    """
    从机构名称推断国家
    这是一个简单的映射，可以扩展
    """
    if not affiliation:
        return None
    
    affiliation_lower = affiliation.lower()
    
    # 中国机构
    if any(keyword in affiliation_lower for keyword in [
        'china', 'chinese', 'beijing', 'shanghai', 'tsinghua', 'peking',
        'fudan', 'zhejiang', 'nju', 'nankai', 'tianjin', '中', '清华', '北大',
        '北航', '中科院', 'cas', 'harbin', 'xi\'an', 'xian'
    ]):
        return 'China'
    
    # 美国机构
    if any(keyword in affiliation_lower for keyword in [
        'united states', 'usa', 'mit', 'stanford', 'berkeley', 'caltech',
        'carnegie mellon', 'cmu', 'harvard', 'yale', 'princeton', 'cornell',
        'georgia tech', 'gatech', 'utexas', 'texas', 'michigan', 'washington',
        'university of california', 'uc ', 'uc-', 'ucberkeley'
    ]):
        return 'United States'
    
    # 英国机构
    if any(keyword in affiliation_lower for keyword in [
        'united kingdom', 'uk', 'england', 'cambridge', 'oxford', 'imperial',
        'ucl', 'university college london', 'edinburgh', 'manchester'
    ]):
        return 'United Kingdom'
    
    # 德国机构
    if any(keyword in affiliation_lower for keyword in [
        'germany', 'german', 'munich', 'berlin', 'tum', 'tu berlin',
        'max planck', 'saarland', 'karlsruhe'
    ]):
        return 'Germany'
    
    # 法国机构
    if any(keyword in affiliation_lower for keyword in [
        'france', 'french', 'paris', 'inria', 'ens', 'cnrs'
    ]):
        return 'France'
    
    # 日本机构
    if any(keyword in affiliation_lower for keyword in [
        'japan', 'japanese', 'tokyo', 'kyoto', 'osaka', 'nagoya'
    ]):
        return 'Japan'
    
    # 瑞士机构
    if any(keyword in affiliation_lower for keyword in [
        'switzerland', 'swiss', 'eth zurich', 'epfl', 'lausanne'
    ]):
        return 'Switzerland'
    
    # 加拿大机构
    if any(keyword in affiliation_lower for keyword in [
        'canada', 'canadian', 'toronto', 'waterloo', 'ubc', 'mcgill'
    ]):
        return 'Canada'
    
    # 新加坡机构
    if any(keyword in affiliation_lower for keyword in [
        'singapore', 'nus', 'national university of singapore', 'ntu'
    ]):
        return 'Singapore'
    
    # 韩国机构
    if any(keyword in affiliation_lower for keyword in [
        'korea', 'korean', 'seoul', 'kaist', 'postech'
    ]):
        return 'South Korea'
    
    return None


def infer_country_from_author_name(author_name: str) -> Optional[str]:
    """
    从作者姓名推断国家（非常不准确，仅作为最后手段）
    通常不推荐使用，但可以作为补充
    """
    # 这个方法不太可靠，暂时返回None
    return None


def enhance_paper_data(paper: Dict, use_semantic_scholar: bool = True) -> Dict:
    """
    增强论文数据，补充缺失字段
    
    Args:
        paper: 论文字典（会被修改）
        use_semantic_scholar: 是否使用Semantic Scholar API
        
    Returns:
        增强后的论文字典
    """
    # 1. 使用Semantic Scholar补充keywords, abstract, citations, references, authors.affiliations
    needs_enhancement = (
        not paper.get('keywords') or len(paper.get('keywords', [])) == 0 or
        not paper.get('abstract') or
        paper.get('citations', 0) == 0 or
        not any(author.get('affiliations') for author in paper.get('authors', []))
    )
    
    if use_semantic_scholar and needs_enhancement:
        enhance_paper_with_semantic_scholar(paper)
    
    # 2. 推断country（通过作者机构）
    if not paper.get('country'):
        # 检查作者是否有机构信息
        for author in paper.get('authors', []):
            affiliations = author.get('affiliations', [])
            if affiliations:
                for affiliation in affiliations:
                    if isinstance(affiliation, str):
                        country = infer_country_from_affiliation(affiliation)
                        if country:
                            paper['country'] = country
                            break
                if paper.get('country'):
                    break
    
    # 如果仍然没有country，保持为None（前端会处理）
    
    return paper


def enhance_papers_batch(papers: List[Dict], use_semantic_scholar: bool = True, batch_size: int = 100) -> List[Dict]:
    """
    批量增强论文数据
    
    Args:
        papers: 论文列表
        use_semantic_scholar: 是否使用Semantic Scholar API
        batch_size: 批处理大小（用于进度显示）
        
    Returns:
        增强后的论文列表
    """
    enhanced_papers = []
    
    print(f"\n开始增强 {len(papers)} 篇论文的数据...")
    print(f"使用Semantic Scholar API: {use_semantic_scholar}")
    
    for i, paper in enumerate(tqdm(papers, desc="增强数据")):
        try:
            enhanced = enhance_paper_data(paper, use_semantic_scholar)
            enhanced_papers.append(enhanced)
            
            # 限制API请求频率
            if use_semantic_scholar and (i + 1) % 10 == 0:
                time.sleep(SEMANTIC_SCHOLAR_API['request_delay'])
        except Exception as e:
            print(f"\n处理论文 {i+1} 时出错: {e}")
            enhanced_papers.append(paper)  # 如果出错，保留原始数据
    
    return enhanced_papers


if __name__ == '__main__':
    # 测试
    test_paper = {
        'id': 'test-1',
        'title': 'Test Paper',
        'authors': [
            {
                'id': 'author-1',
                'name': 'John Doe',
                'affiliations': ['MIT', 'Massachusetts Institute of Technology'],
                'country': None,
            }
        ],
        'country': None,
        'keywords': [],
        'abstract': '',
        'citations': 0,
    }
    
    enhanced = enhance_paper_data(test_paper, use_semantic_scholar=False)
    print(f"Country inferred: {enhanced.get('country')}")
