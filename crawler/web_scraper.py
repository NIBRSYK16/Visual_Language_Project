"""
网页爬虫 - 从论文链接爬取摘要等信息
支持ACM Digital Library、IEEE Xplore等
"""

import requests
import time
import re
from typing import Dict, Optional
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from config import DBLP_API


def get_session():
    """创建带请求头的session"""
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
    })
    return session


def extract_acm_abstract(soup: BeautifulSoup) -> Optional[str]:
    """从ACM Digital Library页面提取摘要"""
    # ACM的摘要通常在多个位置，尝试多种选择器
    selectors = [
        'div.abstractSection.abstractInFull p',
        'div.abstractSection p',
        'div.abstract p',
        'section.abstract p',
        '[class*="abstract"] p',
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            text = element.get_text(strip=True)
            if text and len(text) > 50:  # 确保是真正的摘要
                return text
    
    return None


def extract_acm_keywords(soup: BeautifulSoup) -> list:
    """从ACM页面提取关键词"""
    keywords = []
    
    # 尝试多种选择器
    selectors = [
        'div.keywords span',
        'div.keywords a',
        'span.keyword',
        '[class*="keyword"]',
    ]
    
    for selector in selectors:
        elements = soup.select(selector)
        if elements:
            for elem in elements:
                text = elem.get_text(strip=True)
                if text and text.lower() not in ['keywords', 'keyword', 'subject']:
                    keywords.append(text)
            if keywords:
                break
    
    return keywords


def extract_acm_affiliations(soup: BeautifulSoup) -> list:
    """从ACM页面提取作者机构"""
    affiliations = []
    
    # ACM的机构信息通常在author section
    author_section = soup.select_one('div.author-info, div.author, section.author')
    if author_section:
        # 查找机构相关的文本
        affil_elements = author_section.select('span.affiliation, div.affiliation, [class*="affiliation"]')
        for elem in affil_elements:
            text = elem.get_text(strip=True)
            if text and text not in affiliations:
                affiliations.append(text)
    
    return affiliations


def extract_ieee_abstract(soup: BeautifulSoup) -> Optional[str]:
    """从IEEE Xplore页面提取摘要"""
    selectors = [
        'div.abstract-text',
        'div.abstract p',
        'section.abstract p',
        '[class*="abstract"]',
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            text = element.get_text(strip=True)
            # 移除"Abstract:"等前缀
            text = re.sub(r'^Abstract[:\s]*', '', text, flags=re.IGNORECASE)
            if text and len(text) > 50:
                return text
    
    return None


def extract_ieee_keywords(soup: BeautifulSoup) -> list:
    """从IEEE页面提取关键词"""
    keywords = []
    
    selectors = [
        'div.keywords span',
        'div.keywords a',
        'span.keyword',
    ]
    
    for selector in selectors:
        elements = soup.select(selector)
        if elements:
            for elem in elements:
                text = elem.get_text(strip=True)
                if text and text.lower() not in ['keywords', 'index terms']:
                    keywords.append(text)
            if keywords:
                break
    
    return keywords


def extract_ieee_affiliations(soup: BeautifulSoup) -> list:
    """从IEEE页面提取作者机构"""
    affiliations = []
    
    author_section = soup.select_one('div.author, section.author-info')
    if author_section:
        affil_elements = author_section.select('span.affiliation, div.affiliation')
        for elem in affil_elements:
            text = elem.get_text(strip=True)
            if text and text not in affiliations:
                affiliations.append(text)
    
    return affiliations


def fetch_paper_details_from_url(url: str, session: Optional[requests.Session] = None) -> Dict:
    """
    从论文URL爬取详细信息
    
    Args:
        url: 论文URL（通常是DOI链接）
        session: requests session（可选）
        
    Returns:
        包含摘要、关键词、机构等信息的字典
    """
    if not url:
        return {}
    
    if session is None:
        session = get_session()
    
    result = {
        'abstract': '',
        'keywords': [],
        'affiliations': [],
    }
    
    try:
        # 发送请求
        response = session.get(url, timeout=30, allow_redirects=True)
        response.raise_for_status()
        
        # 解析HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 根据URL判断出版商
        final_url = response.url.lower()
        
        if 'acm.org' in final_url or 'dl.acm.org' in final_url:
            # ACM Digital Library
            result['abstract'] = extract_acm_abstract(soup) or ''
            result['keywords'] = extract_acm_keywords(soup)
            result['affiliations'] = extract_acm_affiliations(soup)
        
        elif 'ieee.org' in final_url or 'ieeexplore.ieee.org' in final_url:
            # IEEE Xplore
            result['abstract'] = extract_ieee_abstract(soup) or ''
            result['keywords'] = extract_ieee_keywords(soup)
            result['affiliations'] = extract_ieee_affiliations(soup)
        
        else:
            # 通用提取（尝试常见的选择器）
            abstract = extract_acm_abstract(soup) or extract_ieee_abstract(soup)
            if abstract:
                result['abstract'] = abstract
            
            keywords = extract_acm_keywords(soup) or extract_ieee_keywords(soup)
            if keywords:
                result['keywords'] = keywords
    
    except requests.exceptions.RequestException as e:
        # 网络错误，静默失败
        pass
    except Exception as e:
        # 其他错误，静默失败
        pass
    
    return result


def enhance_paper_with_scraper(paper: Dict, session: Optional[requests.Session] = None) -> Dict:
    """
    使用网页爬虫增强论文信息
    
    Args:
        paper: 论文字典
        session: requests session（可选，用于复用连接）
        
    Returns:
        增强后的论文字典（修改原字典）
    """
    url = paper.get('url') or paper.get('doi')
    if not url:
        return paper
    
    # 如果没有https://前缀，添加
    if url.startswith('doi:'):
        url = url.replace('doi:', 'https://doi.org/')
    elif not url.startswith('http'):
        url = f'https://doi.org/{url}'
    
    # 爬取详细信息
    details = fetch_paper_details_from_url(url, session)
    
    # 更新论文信息（只更新空字段）
    if not paper.get('abstract') and details.get('abstract'):
        paper['abstract'] = details['abstract']
    
    if (not paper.get('keywords') or len(paper.get('keywords', [])) == 0) and details.get('keywords'):
        paper['keywords'] = details['keywords']
    
    # 更新作者机构信息
    if details.get('affiliations'):
        for i, author in enumerate(paper.get('authors', [])):
            if i < len(details['affiliations']):
                if not author.get('affiliations'):
                    author['affiliations'] = [details['affiliations'][i]]
                elif details['affiliations'][i] not in author['affiliations']:
                    author['affiliations'].append(details['affiliations'][i])
    
    return paper


if __name__ == '__main__':
    # 测试
    test_urls = [
        'https://doi.org/10.1145/2043556.2043570',
        'https://doi.org/10.1109/TVCG.2024.3456341',
    ]
    
    session = get_session()
    for url in test_urls:
        print(f"\n测试URL: {url}")
        result = fetch_paper_details_from_url(url, session)
        print(f"摘要长度: {len(result.get('abstract', ''))}")
        print(f"关键词: {result.get('keywords', [])}")
        print(f"机构数: {len(result.get('affiliations', []))}")
        time.sleep(2)  # 延迟
