/**
 * API 接口服务
 * 提供数据获取接口
 */

import request from 'umi-request';
import { Paper, CountryData, WordCloudData, AuthorNetwork } from '@/types';

/**
 * 获取所有论文数据
 */
export async function fetchPapers(): Promise<Paper[]> {
  try {
    const response = await request('/data/papers.json');
    return response;
  } catch (error) {
    console.error('Failed to fetch papers:', error);
    return [];
  }
}

/**
 * 获取国家统计数据
 */
export async function fetchCountryStats(): Promise<CountryData[]> {
  try {
    const response = await request('/data/country_stats.json');
    return response;
  } catch (error) {
    console.error('Failed to fetch country stats:', error);
    return [];
  }
}

/**
 * 获取作者合作网络数据
 */
export async function fetchAuthorNetwork(): Promise<AuthorNetwork> {
  try {
    const response = await request('/data/author_network.json');
    return response;
  } catch (error) {
    console.error('Failed to fetch author network:', error);
    return { nodes: [], edges: [] };
  }
}
