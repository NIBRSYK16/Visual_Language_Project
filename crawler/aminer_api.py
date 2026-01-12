"""
AMiner API客户端
用于从AMiner获取论文详细信息
使用JWT Token认证
"""

import requests
import time
import jwt
import datetime
from typing import Dict, Optional, List
from config import DBLP_API


class AMinerAPI:
    """AMiner API客户端"""
    
    def __init__(self, api_key: str, user_id: str):
        """
        初始化AMiner API客户端
        
        Args:
            api_key: AMiner API密钥（从控制台获取）
            user_id: 用户ID（从控制台账号资料查看）
        """
        self.api_key = api_key
        self.user_id = user_id
        self.base_url = 'https://datacenter.aminer.cn/gateway/open_platform/api'
    
    def _generate_token(self, expire_seconds: int = 7200) -> str:
        """
        生成JWT Token
        
        Args:
            expire_seconds: Token过期时间（秒），默认2小时
            
        Returns:
            JWT Token字符串
        """
        # Header参数
        header = {
            "alg": "HS256",
            "sign_type": "SIGN"
        }
        
        # Payload参数
        exp_time = datetime.datetime.utcnow() + datetime.timedelta(seconds=expire_seconds)
        current_timestamp = datetime.datetime.now().timestamp()
        
        payload = {
            "user_id": self.user_id,
            "exp": exp_time.timestamp(),
            "timestamp": current_timestamp
        }
        
        try:
            token = jwt.encode(payload, self.api_key, algorithm="HS256", headers=header)
            return token
        except Exception as e:
            raise Exception(f"生成Token失败: {e}")
    
    def _get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        token = self._generate_token()
        return {
            'Authorization': token,
        }
    
    def get_paper_detail(self, paper_id: str) -> Optional[Dict]:
        """
        获取论文详细信息
        
        Args:
            paper_id: AMiner论文ID
            
        Returns:
            论文详细信息，如果未找到返回None
        """
        url = f'{self.base_url}/paper/detail'
        params = {
            'id': paper_id,
        }
        
        try:
            headers = self._get_headers()
            response = requests.get(url, params=params, headers=headers, timeout=30)
            
            # 检查响应状态
            if response.status_code == 401:
                raise Exception("认证失败：请检查API Key和User ID是否正确")
            elif response.status_code == 403:
                data = response.json()
                error_code = data.get('code')
                if error_code == 40302:
                    raise Exception("Token已过期")
                elif error_code == 40307:
                    raise Exception("无效的API Key")
                elif error_code == 40308:
                    raise Exception("无效的Token")
                else:
                    raise Exception(f"权限错误: {data.get('msg', '未知错误')}")
            
            response.raise_for_status()
            
            data = response.json()
            
            # 检查返回码
            if data.get('code') != 200:
                error_msg = data.get('msg', '未知错误')
                error_code = data.get('code')
                raise Exception(f"API错误 (code={error_code}): {error_msg}")
            
            # 提取数据
            if data.get('success') and data.get('data'):
                paper_data = data['data']
                # 如果data是列表，取第一个
                if isinstance(paper_data, list) and len(paper_data) > 0:
                    return paper_data[0]
                elif isinstance(paper_data, dict):
                    return paper_data
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"请求失败: {e}")
        except Exception as e:
            raise Exception(f"处理响应时出错: {e}")
        
        return None
    
    def search_paper_by_doi(self, doi: str) -> Optional[Dict]:
        """
        通过DOI搜索论文（如果AMiner支持）
        
        注意：根据文档，AMiner API主要是通过论文ID获取详情
        如果需要通过DOI或其他条件搜索，可能需要使用组合API
        这里提供一个基础框架，实际使用时可能需要调整
        
        Args:
            doi: 论文DOI
            
        Returns:
            论文信息，如果未找到返回None
        """
        # 注意：AMiner API文档中没有明确说明搜索接口
        # 可能需要使用组合API或其他方式
        # 这里暂时返回None，需要根据实际API文档调整
        return None
    
    def enhance_paper(self, paper: Dict) -> Dict:
        """
        使用AMiner API增强论文信息
        
        注意：AMiner API需要论文ID，而我们的数据只有标题、DOI等
        因此这个方法目前无法直接使用，需要先通过其他方式获取论文ID
        
        Args:
            paper: 论文字典（需要包含title、doi等字段）
            
        Returns:
            增强后的论文字典（如果没有论文ID，返回原字典）
        """
        # 由于AMiner API需要论文ID，而我们只有标题/DOI
        # 这里提供一个框架，实际使用时需要先获取论文ID
        
        # 如果有AMiner论文ID，可以直接使用
        aminer_id = paper.get('aminer_id') or paper.get('aminerId')
        if aminer_id:
            detail = self.get_paper_detail(aminer_id)
            if detail:
                self._merge_paper_data(paper, detail)
            return paper
        
        # 如果没有论文ID，需要先搜索（但AMiner API文档中没有明确说明搜索接口）
        # 可以尝试通过DOI搜索，但需要确认AMiner是否支持
        doi = paper.get('doi', '')
        if doi:
            # 这里需要根据实际API文档实现搜索功能
            # 暂时返回原字典
            pass
        
        return paper
    
    def _merge_paper_data(self, paper: Dict, aminer_data: Dict):
        """
        合并AMiner数据到论文字典
        
        Args:
            paper: 原始论文字典
            aminer_data: AMiner返回的数据
        """
        # 补充摘要
        if not paper.get('abstract'):
            abstract = aminer_data.get('abstract') or aminer_data.get('abstract_zh')
            if abstract:
                paper['abstract'] = abstract
        
        # 补充关键词
        if not paper.get('keywords') or len(paper.get('keywords', [])) == 0:
            keywords = aminer_data.get('keywords') or aminer_data.get('keywords_zh')
            if keywords:
                if isinstance(keywords, list):
                    paper['keywords'] = keywords
                elif isinstance(keywords, str):
                    # 如果关键词是逗号分隔的字符串，分割成列表
                    paper['keywords'] = [k.strip() for k in keywords.split(',') if k.strip()]
        
        # 补充年份
        if not paper.get('year') and aminer_data.get('year'):
            paper['year'] = aminer_data.get('year')
        
        # 补充作者机构信息
        authors_data = aminer_data.get('authors')
        if authors_data and isinstance(authors_data, list):
            paper_authors = paper.get('authors', [])
            for i, aminer_author in enumerate(authors_data[:len(paper_authors)]):
                if i < len(paper_authors):
                    # 获取机构信息
                    org = aminer_author.get('org') or aminer_author.get('org_zh')
                    if org:
                        if not paper_authors[i].get('affiliations'):
                            paper_authors[i]['affiliations'] = [org] if isinstance(org, str) else org
                        else:
                            # 合并机构
                            if isinstance(org, str):
                                org_list = [org]
                            else:
                                org_list = org
                            for o in org_list:
                                if o not in paper_authors[i]['affiliations']:
                                    paper_authors[i]['affiliations'].append(o)


def enhance_paper_with_aminer(paper: Dict, api_client: AMinerAPI) -> Dict:
    """
    使用AMiner API增强单篇论文
    
    Args:
        paper: 论文字典
        api_client: AMinerAPI客户端实例
        
    Returns:
        增强后的论文字典
    """
    return api_client.enhance_paper(paper)


if __name__ == '__main__':
    # 测试代码
    print("AMiner API测试")
    print("=" * 60)
    print("\n使用说明：")
    print("1. 访问 https://www.aminer.org 注册账号")
    print("2. 在控制台申请API密钥")
    print("3. 在控制台账号资料查看用户ID")
    print("4. 设置环境变量或运行时输入")
    print("\n注意：")
    print("- AMiner API需要论文ID才能获取详情")
    print("- 如果只有标题/DOI，需要先通过其他方式获取论文ID")
    print("- 或者使用组合API（根据条件搜索）")
