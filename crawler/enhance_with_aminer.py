"""
使用AMiner API增强论文数据
注意：AMiner API需要论文ID，如果数据中没有论文ID，此脚本主要用于测试API连接
"""

import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict
from tqdm import tqdm
from aminer_api import AMinerAPI
from data_enhancer import infer_country_from_affiliation
from config import OUTPUT_DIR, OUTPUT_FILE, DBLP_API


def main():
    """主函数"""
    input_file = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
    
    if not os.path.exists(input_file):
        print(f"错误: 输入文件不存在: {input_file}")
        print("请先运行爬虫脚本获取数据")
        sys.exit(1)
    
    print("=" * 60)
    print("AMiner API 连接测试工具")
    print("=" * 60)
    print(f"输入文件: {input_file}\n")
    
    # 获取API密钥和用户ID
    api_key = os.environ.get('AMINER_API_KEY')
    user_id = os.environ.get('AMINER_USER_ID')
    
    if not api_key:
        api_key = input("请输入AMiner API密钥（或设置环境变量 AMINER_API_KEY）: ").strip()
        if not api_key:
            print("错误: 需要API密钥")
            print("\n获取API密钥的方法：")
            print("1. 访问 https://www.aminer.org")
            print("2. 注册/登录账号")
            print("3. 在控制台申请API密钥")
            sys.exit(1)
    
    if not user_id:
        user_id = input("请输入用户ID（或设置环境变量 AMINER_USER_ID，在控制台账号资料中查看）: ").strip()
        if not user_id:
            print("错误: 需要用户ID")
            print("\n获取用户ID的方法：")
            print("1. 登录 https://www.aminer.org")
            print("2. 在控制台 -> 账号资料中查看用户ID")
            sys.exit(1)
    
    # 创建API客户端
    try:
        client = AMinerAPI(api_key, user_id)
        print("API客户端创建成功\n")
    except Exception as e:
        print(f"创建API客户端失败: {e}")
        sys.exit(1)
    
    # 重要提示
    print("=" * 60)
    print("⚠️  重要提示")
    print("=" * 60)
    print("AMiner API的论文详情接口需要论文ID才能调用")
    print("当前数据中只有标题、DOI等信息，没有AMiner论文ID")
    print("因此无法直接使用此脚本批量增强数据")
    print("\n此脚本主要用于测试API连接是否正常")
    print("\n可能的解决方案：")
    print("1. 使用网页爬虫（enhance_with_scraper.py）从论文链接爬取")
    print("2. 如果有AMiner论文ID列表，可以修改代码使用")
    print("3. 查看AMiner API文档，看是否有组合API可以根据条件搜索")
    print("=" * 60)
    
    response = input("\n是否继续测试API连接? (y/n): ")
    if response.lower() != 'y':
        print("已取消")
        return
    
    # 测试API连接（使用文档中的示例论文ID）
    print("\n测试API连接...")
    test_paper_id = "5390877f20f70186a0d2fb46"  # 文档中的示例ID
    
    try:
        detail = client.get_paper_detail(test_paper_id)
        if detail:
            print("\n✓ API连接成功！")
            print(f"\n测试论文信息：")
            print(f"  标题: {detail.get('title', 'N/A')}")
            print(f"  摘要: {'有' if detail.get('abstract') else '无'}")
            print(f"  关键词: {'有' if detail.get('keywords') else '无'}")
            print(f"  作者数: {len(detail.get('authors', []))}")
            print(f"  年份: {detail.get('year', 'N/A')}")
            if detail.get('authors'):
                print(f"  第一作者机构: {detail['authors'][0].get('org', 'N/A')}")
        else:
            print("\n✗ API调用失败：未找到论文")
    except Exception as e:
        print(f"\n✗ API调用失败: {e}")
        print("\n可能的原因：")
        print("1. API密钥或用户ID错误")
        print("2. Token生成失败")
        print("3. API服务异常")
        print("4. 网络连接问题")
        return
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
    print("\n注意：由于需要论文ID，当前无法批量增强数据")
    print("建议使用网页爬虫方法（enhance_with_scraper.py）来增强数据")


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
