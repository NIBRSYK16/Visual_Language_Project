"""
主爬虫脚本
整合多个数据源，获取2011-2025年顶会论文数据
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Dict
from datetime import datetime

from config import VENUES, YEAR_START, YEAR_END, OUTPUT_DIR, OUTPUT_FILE, BACKUP_DIR
from dblp_crawler import fetch_venue_papers


def ensure_directory(path: str):
    """确保目录存在"""
    Path(path).mkdir(parents=True, exist_ok=True)


def deduplicate_papers(papers: List[Dict]) -> List[Dict]:
    """
    去除重复论文
    
    Args:
        papers: 论文列表
        
    Returns:
        去重后的论文列表
    """
    seen = set()
    unique_papers = []
    
    for paper in papers:
        # 使用DOI或标题作为唯一标识
        key = paper.get('doi') or paper.get('title', '').lower().strip()
        if key and key not in seen:
            seen.add(key)
            unique_papers.append(paper)
    
    return unique_papers


def main():
    """主函数"""
    print("=" * 60)
    print("学术文献数据爬虫")
    print("=" * 60)
    print(f"目标年份: {YEAR_START}-{YEAR_END}")
    print(f"目标会议: {', '.join(VENUES.keys())}\n")
    
    # 确保输出目录存在
    ensure_directory(OUTPUT_DIR)
    ensure_directory(BACKUP_DIR)
    
    all_papers = []
    
    # 遍历每个会议
    for venue_key, venue_config in VENUES.items():
        try:
            print(f"\n处理会议: {venue_key}")
            
            # 获取论文
            papers = fetch_venue_papers(
                venue_config['name'],
                venue_config['search_terms'],
                YEAR_START,
                YEAR_END
            )
            
            # 设置venue信息
            for paper in papers:
                paper['venue'] = {
                    'name': venue_config['name'],
                    'type': venue_config['type'],
                    'tier': venue_config['tier'],
                }
            
            all_papers.extend(papers)
            print(f"  {venue_key} 完成: {len(papers)} 篇论文")
            
        except Exception as e:
            print(f"  {venue_key} 处理失败: {e}")
            continue
    
    # 去重
    print(f"\n去重前: {len(all_papers)} 篇论文")
    unique_papers = deduplicate_papers(all_papers)
    print(f"去重后: {len(unique_papers)} 篇论文")
    
    # 保存数据
    output_path = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(unique_papers, f, ensure_ascii=False, indent=2)
    print(f"\n数据已保存到: {output_path}")
    
    # 保存备份
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(BACKUP_DIR, f'papers_{timestamp}.json')
    with open(backup_path, 'w', encoding='utf-8') as f:
        json.dump(unique_papers, f, ensure_ascii=False, indent=2)
    print(f"备份已保存到: {backup_path}")
    
    # 统计信息
    print("\n" + "=" * 60)
    print("统计信息:")
    print("=" * 60)
    
    # 按会议统计
    venue_stats = {}
    for paper in unique_papers:
        venue_name = paper['venue']['name']
        venue_stats[venue_name] = venue_stats.get(venue_name, 0) + 1
    
    for venue_name, count in sorted(venue_stats.items(), key=lambda x: x[1], reverse=True):
        print(f"  {venue_name}: {count} 篇")
    
    # 按年份统计
    year_stats = {}
    for paper in unique_papers:
        year = paper.get('year')
        if year:
            year_stats[year] = year_stats.get(year, 0) + 1
    
    print(f"\n年份分布:")
    for year in sorted(year_stats.keys()):
        print(f"  {year}: {year_stats[year]} 篇")
    
    print("\n爬取完成！")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
