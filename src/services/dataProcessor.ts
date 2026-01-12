/**
 * 数据处理器
 * 处理和分析论文数据，为可视化组件提供数据支持
 */

import { Paper, CountryData, WordCloudData, AuthorNetwork, FilterCondition } from '@/types';

/**
 * 按国家统计论文数据
 * 过滤掉country为null的论文（不显示在地图上）
 */
export function aggregateByCountry(papers: Paper[]): CountryData[] {
  const countryMap = new Map<string, Paper[]>();

  papers.forEach((paper) => {
    // 只统计有country信息的论文
    if (paper.country) {
      if (!countryMap.has(paper.country)) {
        countryMap.set(paper.country, []);
      }
      countryMap.get(paper.country)!.push(paper);
    }
  });

  return Array.from(countryMap.entries()).map(([country, papers]) => ({
    country,
    count: papers.length,
    papers,
  }));
}

/**
 * 提取词云数据
 * 只处理有keywords的论文
 */
export function extractWordCloudData(papers: Paper[]): WordCloudData[] {
  const wordMap = new Map<string, Paper[]>();

  papers.forEach((paper) => {
    // 只处理有keywords的论文
    if (paper.keywords && paper.keywords.length > 0) {
      paper.keywords.forEach((keyword) => {
        const normalized = keyword.toLowerCase().trim();
        if (normalized && normalized.length > 1) {
          if (!wordMap.has(normalized)) {
            wordMap.set(normalized, []);
          }
          wordMap.get(normalized)!.push(paper);
        }
      });
    }
  });

  return Array.from(wordMap.entries())
    .map(([word, papers]) => ({
      word,
      frequency: papers.length,
      papers,
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * 构建作者合作网络
 */
export function buildAuthorNetwork(papers: Paper[]): AuthorNetwork {
  const authorMap = new Map<string, { name: string; count: number; country?: string }>();
  const coauthorMap = new Map<string, Map<string, number>>(); // authorId -> Map<coauthorId, count>

  // 统计作者和合作关系
  papers.forEach((paper) => {
    paper.authors.forEach((author, index) => {
      const authorId = author.id || `author-${index}`;
      
      // 更新作者统计
      if (!authorMap.has(authorId)) {
        // 如果名称缺失，尝试使用 ID 或显示"未知作者"
        const authorName = author.name || (authorId ? `作者-${authorId}` : '未知作者');
        authorMap.set(authorId, {
          name: authorName,
          count: 0,
          country: author.country,
        });
      }
      authorMap.get(authorId)!.count++;

      // 更新合作关系
      if (!coauthorMap.has(authorId)) {
        coauthorMap.set(authorId, new Map());
      }

      paper.authors.forEach((coauthor, coIndex) => {
        if (index !== coIndex) {
          const coauthorId = coauthor.id || `author-${coIndex}`;
          const count = coauthorMap.get(authorId)!.get(coauthorId) || 0;
          coauthorMap.get(authorId)!.set(coauthorId, count + 1);
        }
      });
    });
  });

  // 构建节点和边
  const nodes = Array.from(authorMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    count: data.count,
    country: data.country,
  }));

  const edges: { source: string; target: string; weight: number }[] = [];
  const edgeSet = new Set<string>(); // 避免重复边

  coauthorMap.forEach((coauthors, authorId) => {
    coauthors.forEach((weight, coauthorId) => {
      const edgeKey = [authorId, coauthorId].sort().join('-');
      if (!edgeSet.has(edgeKey)) {
        edges.push({
          source: authorId,
          target: coauthorId,
          weight,
        });
        edgeSet.add(edgeKey);
      }
    });
  });

  return { nodes, edges };
}

/**
 * 应用筛选条件
 */
export function applyFilter(papers: Paper[], filter: FilterCondition): Paper[] {
  let filtered = papers;

  if (filter.countries && filter.countries.length > 0) {
    filtered = filtered.filter((paper) => filter.countries!.includes(paper.country || ''));
  }

  if (filter.venues && filter.venues.length > 0) {
    filtered = filtered.filter((paper) => filter.venues!.includes(paper.venue.name));
  }

  if (filter.years) {
    filtered = filtered.filter(
      (paper) => paper.year >= filter.years![0] && paper.year <= filter.years![1],
    );
  }

  if (filter.keywords && filter.keywords.length > 0) {
    filtered = filtered.filter((paper) =>
      paper.keywords.some((keyword) => filter.keywords!.includes(keyword)),
    );
  }

  if (filter.authors && filter.authors.length > 0) {
    filtered = filtered.filter((paper) =>
      paper.authors.some((author) => filter.authors!.includes(author.id)),
    );
  }

  return filtered;
}
