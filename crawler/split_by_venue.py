"""
按照会议拆分论文数据
将一个大JSON文件按照会议名称拆分成多个JSON文件
"""

import json
import os
import sys
from pathlib import Path
from collections import defaultdict
from typing import Dict, List


def sanitize_filename(name: str) -> str:
    """
    将文件名中的非法字符替换为下划线
    
    Args:
        name: 原始文件名
        
    Returns:
        清理后的文件名
    """
    # Windows和Linux/Mac的非法字符
    illegal_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
    for char in illegal_chars:
        name = name.replace(char, '_')
    # 替换多个连续的下划线为单个
    while '__' in name:
        name = name.replace('__', '_')
    return name.strip('_')


def split_papers_by_venue(input_file: str, output_dir: str = None) -> Dict[str, int]:
    """
    按照会议拆分论文数据
    
    Args:
        input_file: 输入JSON文件路径
        output_dir: 输出目录（如果为None，使用输入文件所在目录）
        
    Returns:
        每个会议的论文数量统计字典
    """
    # 确定输出目录
    if output_dir is None:
        input_path = Path(input_file)
        output_dir = input_path.parent / f"{input_path.stem}_split"
    else:
        output_dir = Path(output_dir)
    
    # 创建输出目录
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"读取文件: {input_file}")
    with open(input_file, 'r', encoding='utf-8') as f:
        papers = json.load(f)
    
    print(f"总共 {len(papers)} 篇论文\n")
    
    # 按照会议分组
    venue_papers = defaultdict(list)
    unknown_count = 0
    
    for paper in papers:
        venue = paper.get('venue', {})
        venue_name = venue.get('name', 'Unknown') if isinstance(venue, dict) else str(venue) if venue else 'Unknown'
        
        if venue_name == 'Unknown' or not venue_name:
            unknown_count += 1
            venue_name = 'Unknown'
        
        venue_papers[venue_name].append(paper)
    
    print(f"找到 {len(venue_papers)} 个不同的会议\n")
    
    # 保存每个会议的数据
    stats = {}
    for venue_name, papers_list in venue_papers.items():
        # 清理文件名
        safe_filename = sanitize_filename(venue_name)
        output_file = output_dir / f"{safe_filename}.json"
        
        # 保存JSON文件
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(papers_list, f, ensure_ascii=False, indent=2)
        
        stats[venue_name] = len(papers_list)
        print(f"  {venue_name}: {len(papers_list)} 篇论文 -> {output_file.name}")
    
    if unknown_count > 0:
        print(f"\n注意: 有 {unknown_count} 篇论文的会议信息未知，已保存到 Unknown.json")
    
    return stats


def main():
    """主函数"""
    # 从命令行参数获取输入文件和输出目录
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    else:
        # 默认输入文件路径（相对于脚本目录的父目录）
        script_dir = Path(__file__).parent
        input_file = script_dir.parent / 'data' / 'raw' / 'papers_20260112_134359.json'
        input_file = str(input_file)
    
    if len(sys.argv) > 2:
        output_dir = sys.argv[2]
    else:
        output_dir = None
    
    # 检查文件是否存在
    if not os.path.exists(input_file):
        print(f"错误: 找不到输入文件: {input_file}")
        print("\n使用方法:")
        print("  python split_by_venue.py [输入文件路径] [输出目录]")
        print("\n示例:")
        print("  python split_by_venue.py ../data/raw/papers_20260112_134359.json ../data/raw/papers_by_venue")
        sys.exit(1)
    
    print("=" * 60)
    print("按会议拆分论文数据")
    print("=" * 60)
    print()
    
    try:
        # 拆分数据
        stats = split_papers_by_venue(input_file, output_dir)
        
        # 输出统计信息
        print("\n" + "=" * 60)
        print("拆分完成！统计信息：")
        print("=" * 60)
        print(f"\n总共 {len(stats)} 个会议")
        print(f"论文总数: {sum(stats.values())} 篇\n")
        
        # 按论文数量排序
        sorted_stats = sorted(stats.items(), key=lambda x: x[1], reverse=True)
        
        print("各会议论文数量（前20个）：")
        for venue_name, count in sorted_stats[:20]:
            print(f"  {venue_name}: {count} 篇")
        
        if len(sorted_stats) > 20:
            print(f"\n  ... 还有 {len(sorted_stats) - 20} 个会议")
        
        # 确定输出目录
        input_path = Path(input_file)
        if output_dir:
            output_path = Path(output_dir)
        else:
            output_path = input_path.parent / f"{input_path.stem}_split"
        
        print(f"\n输出目录: {output_path.absolute()}")
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
