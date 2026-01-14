#!/usr/bin/env python3
"""
从Semantic Scholar API获取论文引用关系的脚本
先进行小规模测试
"""

import json
import time
import sys
import os

try:
    import requests
except ImportError:
    print("错误: 需要安装requests库")
    print("请运行: pip install requests")
    sys.exit(1)

from typing import Dict, List, Optional
from difflib import SequenceMatcher

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Semantic Scholar API配置
SEMANTIC_SCHOLAR_API_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
SEMANTIC_SCHOLAR_PAPER_URL = "https://api.semanticscholar.org/graph/v1/paper"
API_KEY = None  # 可以设置API key以提高限制
RATE_LIMIT_DELAY = 0.1  # 每次请求之间的延迟（秒）

def similarity(a: str, b: str) -> float:
    """计算两个字符串的相似度"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def normalize_title(title: str) -> str:
    """标准化标题：移除标点、转换为小写"""
    import re
    # 移除标点符号，保留空格
    title = re.sub(r'[^\w\s]', '', title)
    # 转换为小写并去除多余空格
    title = ' '.join(title.lower().split())
    return title

def search_paper_semantic_scholar(title: str, authors: List[str] = None, year: int = None) -> Optional[str]:
    """
    在Semantic Scholar中搜索论文，返回paperId
    """
    try:
        # 构建搜索查询 - 使用更精确的查询
        # 尝试使用标题的关键部分
        query = title[:200]  # 限制查询长度
        
        params = {
            "query": query,
            "limit": 10,  # 增加结果数量以提高匹配率
        }
        if year:
            params["year"] = year
        
        headers = {}
        if API_KEY:
            headers["x-api-key"] = API_KEY
        
        response = requests.get(SEMANTIC_SCHOLAR_API_URL, params=params, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print(f"  API错误: {response.status_code} - {response.text[:100]}")
            return None
        
        data = response.json()
        papers = data.get("data", [])
        
        if not papers:
            print(f"  未找到搜索结果")
            return None
        
        print(f"  找到 {len(papers)} 个搜索结果")
        
        # 匹配最相似的论文
        normalized_title = normalize_title(title)
        best_match = None
        best_score = 0.0
        
        for paper in papers:
            paper_title = paper.get("title", "")
            if not paper_title:
                continue
                
            normalized_paper_title = normalize_title(paper_title)
            
            # 计算标题相似度
            score = similarity(normalized_title, normalized_paper_title)
            
            # 如果年份匹配，增加分数
            if year and paper.get("year") == year:
                score += 0.15
            
            # 如果作者匹配，增加分数
            if authors:
                paper_authors = [author.get("name", "") for author in paper.get("authors", [])]
                if paper_authors:
                    # 检查是否有共同作者
                    common_authors = set(a.lower() for a in authors) & set(a.lower() for a in paper_authors)
                    if common_authors:
                        score += 0.1 * len(common_authors) / max(len(authors), len(paper_authors))
            
            if score > best_score:
                best_score = score
                best_match = paper
        
        print(f"  最佳匹配分数: {best_score:.2f}")
        if best_match:
            print(f"  匹配论文: {best_match.get('title', '')[:60]}...")
        
        # 降低阈值以提高匹配率
        if best_score < 0.6:  # 降低到60%相似度阈值
            print(f"  相似度太低，放弃匹配")
            return None
        
        return best_match.get("paperId")
    
    except Exception as e:
        print(f"  搜索错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def get_paper_references(paper_id: str) -> List[Dict]:
    """
    获取论文的引用列表
    """
    try:
        url = f"{SEMANTIC_SCHOLAR_PAPER_URL}/{paper_id}"
        params = {
            "fields": "references.title,references.authors,references.year,references.url,references.paperId"
        }
        
        headers = {}
        if API_KEY:
            headers["x-api-key"] = API_KEY
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print(f"  API错误: {response.status_code}")
            return []
        
        data = response.json()
        references = data.get("references", [])
        
        return references
    
    except Exception as e:
        print(f"  获取引用错误: {str(e)}")
        return []

def match_reference_to_local_paper(reference: Dict, local_papers: List[Dict]) -> Optional[str]:
    """
    将引用论文匹配到本地论文库
    返回匹配的论文ID，如果未匹配则返回None
    """
    ref_title = reference.get("title", "")
    if not ref_title:
        return None
        
    ref_year = reference.get("year")
    ref_authors = [author.get("name", "") for author in reference.get("authors", []) if author.get("name")]
    
    normalized_ref_title = normalize_title(ref_title)
    
    best_match = None
    best_score = 0.0
    
    for paper in local_papers:
        paper_title = paper.get("title", "")
        if not paper_title:
            continue
            
        normalized_paper_title = normalize_title(paper_title)
        paper_year = paper.get("year")
        
        # 计算标题相似度
        score = similarity(normalized_ref_title, normalized_paper_title)
        
        # 如果年份匹配，增加分数
        if ref_year and paper_year and ref_year == paper_year:
            score += 0.15
        
        # 如果作者匹配，增加分数
        paper_authors = [author.get("name", "") for author in paper.get("authors", []) if author.get("name")]
        if ref_authors and paper_authors:
            # 使用小写比较以提高匹配率
            ref_authors_lower = [a.lower().strip() for a in ref_authors]
            paper_authors_lower = [a.lower().strip() for a in paper_authors]
            common_authors = set(ref_authors_lower) & set(paper_authors_lower)
            if common_authors:
                score += 0.15 * len(common_authors) / max(len(ref_authors), len(paper_authors))
        
        if score > best_score:
            best_score = score
            best_match = paper
    
    # 降低阈值以提高匹配率
    if best_score < 0.65:  # 降低到65%相似度阈值
        return None
    
    return best_match.get("id")

def process_papers(papers: List[Dict], test_limit: int = 10) -> Dict[str, Dict]:
    """
    处理论文列表，获取引用关系
    """
    results = {}
    
    # 只处理前test_limit篇论文进行测试
    test_papers = papers[:test_limit]
    
    print(f"开始处理 {len(test_papers)} 篇论文...")
    
    for idx, paper in enumerate(test_papers, 1):
        paper_id = paper.get("id")
        title = paper.get("title", "")
        authors = [author.get("name", "") for author in paper.get("authors", [])]
        year = paper.get("year")
        
        print(f"\n[{idx}/{len(test_papers)}] 处理论文: {title[:60]}...")
        
        # 搜索论文在Semantic Scholar中的ID
        print("  搜索Semantic Scholar...")
        semantic_id = search_paper_semantic_scholar(title, authors, year)
        
        if not semantic_id:
            print("  未找到匹配的论文")
            results[paper_id] = {
                "paperId": paper_id,
                "semanticScholarId": None,
                "references": [],
                "matched_count": 0,
                "total_references": 0
            }
            time.sleep(RATE_LIMIT_DELAY)
            continue
        
        print(f"  找到Semantic Scholar ID: {semantic_id}")
        
        # 获取引用列表
        print("  获取引用关系...")
        references = get_paper_references(semantic_id)
        
        if not references:
            print("  未找到引用关系")
            results[paper_id] = {
                "paperId": paper_id,
                "semanticScholarId": semantic_id,
                "references": [],
                "matched_count": 0,
                "total_references": 0
            }
            time.sleep(RATE_LIMIT_DELAY)
            continue
        
        print(f"  找到 {len(references)} 条引用")
        
        # 匹配引用到本地论文
        matched_references = []
        matched_count = 0
        
        print("  开始匹配引用论文...")
        for idx, ref in enumerate(references, 1):
            if idx % 10 == 0:
                print(f"    已处理 {idx}/{len(references)} 条引用...")
            
            matched_id = match_reference_to_local_paper(ref, papers)
            
            ref_data = {
                "title": ref.get("title", ""),
                "authors": [author.get("name", "") for author in ref.get("authors", []) if author.get("name")],
                "year": ref.get("year"),
                "url": ref.get("url", ""),
                "semanticScholarId": ref.get("paperId"),
                "matched": matched_id is not None,
                "localPaperId": matched_id
            }
            
            if matched_id:
                matched_count += 1
                if matched_count <= 3:  # 只打印前3个匹配成功的
                    print(f"    ✓ 匹配: {ref_data['title'][:50]}... -> {matched_id}")
            
            matched_references.append(ref_data)
        
        print(f"  匹配到 {matched_count}/{len(references)} 篇本地论文 ({matched_count/len(references)*100:.1f}%)")
        
        results[paper_id] = {
            "paperId": paper_id,
            "semanticScholarId": semantic_id,
            "references": matched_references,
            "matched_count": matched_count,
            "total_references": len(references)
        }
        
        # 延迟以避免API限制
        time.sleep(RATE_LIMIT_DELAY)
    
    return results

def main():
    # 读取论文数据
    papers_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "data", "papers.json")
    
    if not os.path.exists(papers_file):
        print(f"错误: 找不到文件 {papers_file}")
        return
    
    print(f"读取论文数据: {papers_file}")
    with open(papers_file, 'r', encoding='utf-8') as f:
        papers = json.load(f)
    
    print(f"总共 {len(papers)} 篇论文")
    
    # 测试处理前10篇论文
    test_limit = 10
    print(f"\n测试模式: 只处理前 {test_limit} 篇论文")
    
    # 处理论文
    results = process_papers(papers, test_limit=test_limit)
    
    # 保存结果
    output_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "data", "references_test.json")
    print(f"\n保存结果到: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # 统计信息
    total_papers = len(results)
    papers_with_references = sum(1 for r in results.values() if r.get("total_references", 0) > 0)
    total_references = sum(r.get("total_references", 0) for r in results.values())
    total_matched = sum(r.get("matched_count", 0) for r in results.values())
    
    print("\n" + "="*50)
    print("处理完成！统计信息:")
    print(f"  处理论文数: {total_papers}")
    print(f"  有引用关系的论文: {papers_with_references}")
    print(f"  总引用数: {total_references}")
    print(f"  匹配到本地论文: {total_matched}")
    print(f"  匹配率: {total_matched/total_references*100:.1f}%" if total_references > 0 else "  匹配率: 0%")
    print("="*50)

if __name__ == "__main__":
    main()
