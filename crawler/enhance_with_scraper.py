"""
使用网页爬虫增强论文数据
从论文链接爬取摘要、关键词、机构等信息
"""

import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict
from tqdm import tqdm
from web_scraper import enhance_paper_with_scraper, get_session
from data_enhancer import infer_country_from_affiliation
from config import OUTPUT_DIR, OUTPUT_FILE, DBLP_API


def enhance_papers_with_scraper(papers: List[Dict], start_idx: int = 0, end_idx: int = None) -> List[Dict]:
    """
    批量使用网页爬虫增强论文数据
    
    Args:
        papers: 论文列表
        start_idx: 开始索引
        end_idx: 结束索引（不包含）
        
    Returns:
        增强后的论文列表
    """
    if end_idx is None:
        end_idx = len(papers)
    
    enhanced_papers = papers[:start_idx] if start_idx > 0 else []
    session = get_session()
    
    print(f"\n开始爬取论文信息（索引 {start_idx} 到 {end_idx-1}）...")
    
    for i in tqdm(range(start_idx, end_idx), desc="爬取论文"):
        paper = papers[i]
        try:
            # 增强论文信息
            enhanced = enhance_paper_with_scraper(paper, session)
            
            # 推断国家信息（从机构）
            if not enhanced.get('country') and enhanced.get('authors'):
                for author in enhanced['authors']:
                    affiliations = author.get('affiliations', [])
                    if affiliations:
                        for affiliation in affiliations:
                            if isinstance(affiliation, str):
                                country = infer_country_from_affiliation(affiliation)
                                if country:
                                    enhanced['country'] = country
                                    break
                        if enhanced.get('country'):
                            break
            
            enhanced_papers.append(enhanced)
            
            # 延迟，避免请求过快
            if (i + 1) % 10 == 0:
                time.sleep(DBLP_API['request_delay'])
            else:
                time.sleep(0.5)  # 每次请求后短暂延迟
        
        except Exception as e:
            print(f"\n处理论文 {i+1} 时出错: {e}")
            enhanced_papers.append(paper)  # 如果出错，保留原始数据
    
    return enhanced_papers


def main():
    """主函数"""
    input_file = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
    
    if not os.path.exists(input_file):
        print(f"错误: 输入文件不存在: {input_file}")
        print("请先运行爬虫脚本获取数据")
        sys.exit(1)
    
    print("=" * 60)
    print("网页爬虫数据增强工具")
    print("=" * 60)
    print(f"输入文件: {input_file}\n")
    
    # 读取数据
    print("读取数据...")
    with open(input_file, 'r', encoding='utf-8') as f:
        papers = json.load(f)
    
    print(f"读取到 {len(papers)} 篇论文\n")
    
    # 统计缺失信息
    missing_abstract = sum(1 for p in papers if not p.get('abstract'))
    missing_keywords = sum(1 for p in papers if not p.get('keywords') or len(p.get('keywords', [])) == 0)
    missing_country = sum(1 for p in papers if not p.get('country'))
    
    print("数据统计:")
    print(f"  缺失abstract: {missing_abstract} ({missing_abstract/len(papers)*100:.1f}%)")
    print(f"  缺失keywords: {missing_keywords} ({missing_keywords/len(papers)*100:.1f}%)")
    print(f"  缺失country: {missing_country} ({missing_country/len(papers)*100:.1f}%)")
    print()
    
    # 询问处理范围
    print(f"总共 {len(papers)} 篇论文")
    print("\n选项:")
    print("  1. 处理所有论文（耗时较长）")
    print("  2. 处理部分论文（指定范围）")
    print("  3. 处理前N篇论文（测试用）")
    
    choice = input("\n请选择 (1/2/3，默认3): ").strip() or "3"
    
    start_idx = 0
    end_idx = len(papers)
    
    if choice == "2":
        start_idx = int(input(f"起始索引 (0-{len(papers)-1}): ") or "0")
        end_idx = int(input(f"结束索引 ({start_idx+1}-{len(papers)}): ") or str(len(papers)))
        end_idx = min(end_idx, len(papers))
    elif choice == "3":
        count = int(input("处理前多少篇论文 (默认100): ") or "100")
        end_idx = min(count, len(papers))
    
    print(f"\n将处理第 {start_idx} 到 {end_idx-1} 篇论文（共 {end_idx - start_idx} 篇）")
    print("预计时间: 约 {} 分钟".format((end_idx - start_idx) * 0.5 / 60))
    
    confirm = input("确认继续? (y/n): ")
    if confirm.lower() != 'y':
        print("已取消")
        return
    
    # 增强数据
    enhanced_papers = enhance_papers_with_scraper(papers, start_idx, end_idx)
    
    # 如果只处理了部分，需要合并
    if start_idx > 0 or end_idx < len(papers):
        if end_idx < len(papers):
            enhanced_papers.extend(papers[end_idx:])
        papers = enhanced_papers
    else:
        papers = enhanced_papers
    
    # 统计增强结果
    enhanced_abstract = sum(1 for p in papers if p.get('abstract'))
    enhanced_keywords = sum(1 for p in papers if p.get('keywords') and len(p.get('keywords', [])) > 0)
    enhanced_country = sum(1 for p in papers if p.get('country'))
    
    print("\n增强结果:")
    print(f"  有abstract: {enhanced_abstract} ({enhanced_abstract/len(papers)*100:.1f}%)")
    print(f"  有keywords: {enhanced_keywords} ({enhanced_keywords/len(papers)*100:.1f}%)")
    print(f"  有country: {enhanced_country} ({enhanced_country/len(papers)*100:.1f}%)")
    
    # 备份原文件
    backup_file = input_file.replace('.json', f'_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
    print(f"\n备份原文件到: {backup_file}")
    
    # 读取原文件内容用于备份
    with open(input_file, 'r', encoding='utf-8') as f:
        original_content = f.read()
    with open(backup_file, 'w', encoding='utf-8') as f:
        f.write(original_content)
    
    # 保存增强后的数据
    print(f"保存增强后的数据到: {input_file}")
    with open(input_file, 'w', encoding='utf-8') as f:
        json.dump(papers, f, ensure_ascii=False, indent=2)
    
    print("\n数据增强完成！")


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
