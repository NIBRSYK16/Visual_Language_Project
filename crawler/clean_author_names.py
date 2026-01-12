"""
清理作者名称中的DBLP消歧序号
去除作者名字末尾的序号（如 "0001", "0002" 等）
"""

import json
import os
import sys
import re
from pathlib import Path
from typing import Dict, List


def clean_author_name(name: str) -> str:
    """
    清理作者名称，去除DBLP消歧序号
    
    Args:
        name: 原始作者名称（可能包含序号，如 "Sameer Agarwal 0002"）
        
    Returns:
        清理后的作者名称（如 "Sameer Agarwal"）
    """
    if not name:
        return name
    
    # 匹配名字末尾的序号模式（空格 + 4位数字，如 " 0001", " 0024"）
    # 也匹配其他长度的数字，如 " 1", " 123" 等
    pattern = r'\s+\d{1,4}$'
    cleaned = re.sub(pattern, '', name)
    
    return cleaned.strip()


def clean_paper(paper: Dict) -> Dict:
    """
    清理单篇论文的作者名称
    
    Args:
        paper: 论文字典
        
    Returns:
        清理后的论文字典
    """
    if 'authors' in paper and isinstance(paper['authors'], list):
        for author in paper['authors']:
            if 'name' in author and author['name']:
                original_name = author['name']
                cleaned_name = clean_author_name(original_name)
                
                # 如果名称被修改，保存原始名称（可选）
                if cleaned_name != original_name:
                    author['name'] = cleaned_name
                    # 可选：保存原始名称到新字段
                    # author['name_original'] = original_name
    
    return paper


def clean_papers_file(input_file: str, output_file: str = None, backup: bool = True) -> Dict[str, int]:
    """
    清理JSON文件中的作者名称
    
    Args:
        input_file: 输入JSON文件路径
        output_file: 输出JSON文件路径（如果为None，覆盖原文件）
        backup: 是否备份原文件
        
    Returns:
        统计信息字典
    """
    input_path = Path(input_file)
    
    if not input_path.exists():
        raise FileNotFoundError(f"输入文件不存在: {input_file}")
    
    # 确定输出文件
    if output_file is None:
        output_path = input_path
    else:
        output_path = Path(output_file)
    
    # 备份原文件
    if backup and output_path == input_path:
        backup_path = input_path.parent / f"{input_path.stem}_backup{input_path.suffix}"
        print(f"备份原文件到: {backup_path}")
        import shutil
        shutil.copy2(input_path, backup_path)
    
    # 读取数据
    print(f"读取文件: {input_path}")
    with open(input_path, 'r', encoding='utf-8') as f:
        papers = json.load(f)
    
    print(f"总共 {len(papers)} 篇论文")
    
    # 统计信息
    stats = {
        'total_papers': len(papers),
        'total_authors': 0,
        'cleaned_names': 0,
        'unique_cleaned_names': set(),
    }
    
    # 清理作者名称
    print("清理作者名称...")
    for paper in papers:
        if 'authors' in paper and isinstance(paper['authors'], list):
            for author in paper['authors']:
                stats['total_authors'] += 1
                if 'name' in author and author['name']:
                    original_name = author['name']
                    cleaned_name = clean_author_name(original_name)
                    
                    if cleaned_name != original_name:
                        stats['cleaned_names'] += 1
                        author['name'] = cleaned_name
                    
                    stats['unique_cleaned_names'].add(cleaned_name)
        
        clean_paper(paper)
    
    stats['unique_cleaned_names'] = len(stats['unique_cleaned_names'])
    
    # 保存清理后的数据
    print(f"保存到: {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(papers, f, ensure_ascii=False, indent=2)
    
    return stats


def clean_directory(input_dir: str, output_dir: str = None, backup: bool = True):
    """
    批量清理目录中的所有JSON文件
    
    Args:
        input_dir: 输入目录路径
        output_dir: 输出目录路径（如果为None，覆盖原文件）
        backup: 是否备份原文件
    """
    input_path = Path(input_dir)
    
    if not input_path.exists() or not input_path.is_dir():
        raise FileNotFoundError(f"输入目录不存在: {input_dir}")
    
    output_path = Path(output_dir) if output_dir else input_path
    
    # 查找所有JSON文件
    json_files = list(input_path.glob('*.json'))
    
    if not json_files:
        print(f"目录中没有找到JSON文件: {input_dir}")
        return
    
    print(f"找到 {len(json_files)} 个JSON文件\n")
    
    # 统计信息
    total_stats = {
        'total_files': len(json_files),
        'total_papers': 0,
        'total_authors': 0,
        'total_cleaned': 0,
    }
    
    # 处理每个文件
    for json_file in json_files:
        print(f"\n处理: {json_file.name}")
        print("-" * 60)
        
        if output_dir:
            output_file = output_path / json_file.name
        else:
            output_file = None
        
        try:
            stats = clean_papers_file(str(json_file), str(output_file) if output_file else None, backup)
            
            total_stats['total_papers'] += stats['total_papers']
            total_stats['total_authors'] += stats['total_authors']
            total_stats['total_cleaned'] += stats['cleaned_names']
            
            print(f"  论文数: {stats['total_papers']}")
            print(f"  作者总数: {stats['total_authors']}")
            print(f"  清理的名称: {stats['cleaned_names']}")
            print(f"  唯一作者名: {stats['unique_cleaned_names']}")
        
        except Exception as e:
            print(f"  错误: {e}")
            continue
    
    # 输出总统计
    print("\n" + "=" * 60)
    print("批量处理完成！")
    print("=" * 60)
    print(f"处理文件数: {total_stats['total_files']}")
    print(f"论文总数: {total_stats['total_papers']}")
    print(f"作者总数: {total_stats['total_authors']}")
    print(f"清理的名称总数: {total_stats['total_cleaned']}")
    print(f"清理比例: {total_stats['total_cleaned']/total_stats['total_authors']*100:.1f}%" if total_stats['total_authors'] > 0 else "N/A")


def main():
    """主函数"""
    print("=" * 60)
    print("清理作者名称中的DBLP消歧序号")
    print("=" * 60)
    print()
    
    if len(sys.argv) < 2:
        print("使用方法:")
        print("  清理单个文件:")
        print("    python clean_author_names.py <输入文件> [输出文件]")
        print()
        print("  批量清理目录:")
        print("    python clean_author_names.py --dir <输入目录> [输出目录]")
        print()
        print("示例:")
        print("  python clean_author_names.py ../data/raw/papers_by_venue/EuroSys.json")
        print("  python clean_author_names.py --dir ../data/raw/papers_by_venue")
        sys.exit(1)
    
    try:
        if sys.argv[1] == '--dir':
            # 批量处理目录
            if len(sys.argv) < 3:
                print("错误: 需要指定输入目录")
                sys.exit(1)
            
            input_dir = sys.argv[2]
            output_dir = sys.argv[3] if len(sys.argv) > 3 else None
            
            clean_directory(input_dir, output_dir)
        else:
            # 处理单个文件
            input_file = sys.argv[1]
            output_file = sys.argv[2] if len(sys.argv) > 2 else None
            
            stats = clean_papers_file(input_file, output_file)
            
            print("\n" + "=" * 60)
            print("处理完成！")
            print("=" * 60)
            print(f"论文总数: {stats['total_papers']}")
            print(f"作者总数: {stats['total_authors']}")
            print(f"清理的名称: {stats['cleaned_names']}")
            print(f"唯一作者名: {stats['unique_cleaned_names']}")
            if stats['total_authors'] > 0:
                print(f"清理比例: {stats['cleaned_names']/stats['total_authors']*100:.1f}%")
    
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
