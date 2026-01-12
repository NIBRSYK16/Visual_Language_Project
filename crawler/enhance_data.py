"""
数据增强主脚本
读取爬取的数据，补充缺失信息，保存增强后的数据
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from data_enhancer import enhance_papers_batch
from config import OUTPUT_DIR, OUTPUT_FILE, BACKUP_DIR


def main():
    """主函数"""
    input_file = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
    
    if not os.path.exists(input_file):
        print(f"错误: 输入文件不存在: {input_file}")
        print("请先运行爬虫脚本获取数据")
        sys.exit(1)
    
    print("=" * 60)
    print("数据增强工具")
    print("=" * 60)
    print(f"输入文件: {input_file}\n")
    
    # 读取数据
    print("读取数据...")
    with open(input_file, 'r', encoding='utf-8') as f:
        papers = json.load(f)
    
    print(f"读取到 {len(papers)} 篇论文\n")
    
    # 统计缺失信息
    missing_country = sum(1 for p in papers if not p.get('country'))
    missing_keywords = sum(1 for p in papers if not p.get('keywords') or len(p.get('keywords', [])) == 0)
    missing_abstract = sum(1 for p in papers if not p.get('abstract'))
    missing_citations = sum(1 for p in papers if p.get('citations', 0) == 0)
    
    print("数据统计:")
    print(f"  缺失country: {missing_country} ({missing_country/len(papers)*100:.1f}%)")
    print(f"  缺失keywords: {missing_keywords} ({missing_keywords/len(papers)*100:.1f}%)")
    print(f"  缺失abstract: {missing_abstract} ({missing_abstract/len(papers)*100:.1f}%)")
    print(f"  缺失citations: {missing_citations} ({missing_citations/len(papers)*100:.1f}%)")
    print()
    
    # 询问用户是否使用Semantic Scholar API
    use_semantic_scholar = False
    if missing_keywords > 0 or missing_abstract > 0 or missing_citations > 0:
        print("\n警告: 使用Semantic Scholar API会大大增加运行时间")
        print(f"预计需要: {len(papers) * 0.6 / 60:.1f} 分钟（仅API延迟）")
        print(f"对于 {len(papers)} 篇论文，完整处理可能需要数小时甚至数天")
        print("\n建议:")
        print("  1. 先运行测试版本: python enhance_data_test.py (处理前100篇)")
        print("  2. 或分批处理（修改脚本中的处理范围）")
        print("  3. 或只处理部分重要论文")
        
        response = input("\n是否使用Semantic Scholar API补充keywords/abstract/citations? (y/n, 默认n): ")
        use_semantic_scholar = response.lower() == 'y'
        
        if use_semantic_scholar:
            confirm = input("确认继续? 这可能需要很长时间！(y/n): ")
            use_semantic_scholar = confirm.lower() == 'y'
            
            if use_semantic_scholar:
                # 询问是否分批处理
                batch_response = input("是否分批处理？(y/n, 默认n): ")
                if batch_response.lower() == 'y':
                    batch_size = int(input("每批处理多少篇论文? (建议100-1000): ") or "1000")
                    start_idx = int(input(f"从第几篇开始? (0-{len(papers)-1}, 默认0): ") or "0")
                    end_idx = min(start_idx + batch_size, len(papers))
                    papers = papers[start_idx:end_idx]
                    print(f"将处理第 {start_idx} 到 {end_idx-1} 篇论文（共 {len(papers)} 篇）")
    
    # 增强数据
    enhanced_papers = enhance_papers_batch(papers, use_semantic_scholar=use_semantic_scholar)
    
    # 统计增强结果
    enhanced_country = sum(1 for p in enhanced_papers if p.get('country'))
    enhanced_keywords = sum(1 for p in enhanced_papers if p.get('keywords') and len(p.get('keywords', [])) > 0)
    enhanced_abstract = sum(1 for p in enhanced_papers if p.get('abstract'))
    enhanced_citations = sum(1 for p in enhanced_papers if p.get('citations', 0) > 0)
    
    print("\n增强结果:")
    print(f"  有country: {enhanced_country} ({enhanced_country/len(enhanced_papers)*100:.1f}%)")
    print(f"  有keywords: {enhanced_keywords} ({enhanced_keywords/len(enhanced_papers)*100:.1f}%)")
    print(f"  有abstract: {enhanced_abstract} ({enhanced_abstract/len(enhanced_papers)*100:.1f}%)")
    print(f"  有citations: {enhanced_citations} ({enhanced_citations/len(enhanced_papers)*100:.1f}%)")
    
    # 备份原文件
    backup_file = input_file.replace('.json', f'_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
    print(f"\n备份原文件到: {backup_file}")
    os.rename(input_file, backup_file)
    
    # 保存增强后的数据
    output_file = input_file
    print(f"保存增强后的数据到: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(enhanced_papers, f, ensure_ascii=False, indent=2)
    
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
