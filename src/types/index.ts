/**
 * 统一数据模型定义
 * 根据 prepare.md 规格定义
 */

/**
 * 作者信息
 */
export interface Author {
  id: string;
  name: string;
  affiliations: string[];
  country?: string;
}

/**
 * 会议/期刊信息
 */
export interface Venue {
  name: string;
  type: 'conference' | 'journal';
  tier: string; // 顶会/A类等
}

/**
 * 论文核心数据结构
 */
export interface Paper {
  id: string;
  title: string;
  authors: Author[];
  venue: Venue;
  year: number;
  keywords: string[];
  abstract: string;
  references: string[]; // 引用ID列表
  citations: number;
  country?: string; // 从机构推导
  url?: string; // 论文URL
  doi?: string; // DOI标识
  dblpKey?: string; // DBLP键值
}

/**
 * 国家产出数据（用于地图可视化）
 */
export interface CountryData {
  country: string;
  count: number;
  papers: Paper[];
}

/**
 * 词云数据（用于词云可视化）
 */
export interface WordCloudData {
  word: string;
  frequency: number;
  papers: Paper[];
}

/**
 * 作者网络节点
 */
export interface AuthorNode {
  id: string;
  name: string;
  count: number; // 论文数量
  country?: string;
}

/**
 * 作者网络边
 */
export interface AuthorEdge {
  source: string; // 作者ID
  target: string; // 作者ID
  weight: number; // 合作次数
}

/**
 * 作者合作网络数据
 */
export interface AuthorNetwork {
  nodes: AuthorNode[];
  edges: AuthorEdge[];
}

/**
 * 会议趋势数据
 */
export interface ConferenceTrendData {
  venue: string;
  year: number;
  count: number; // 发文数量
  acceptanceRate?: number; // 录用率
  institutions: string[]; // 机构列表
}

/**
 * 关键词演化数据
 */
export interface KeywordEvolutionData {
  keyword: string;
  year: number;
  frequency: number;
  papers: Paper[];
}

/**
 * 关键词共现数据
 */
export interface KeywordCooccurrence {
  keyword1: string;
  keyword2: string;
  weight: number; // 共现次数
}

/**
 * 引用关系数据
 */
export interface CitationNode {
  id: string;
  paper: Paper;
  children?: CitationNode[];
  x?: number; // 布局坐标
  y?: number;
  depth?: number;
}

/**
 * 全局筛选条件
 */
export interface FilterCondition {
  countries?: string[];
  venues?: string[];
  years?: [number, number]; // 年份范围
  keywords?: string[];
  authors?: string[];
}
