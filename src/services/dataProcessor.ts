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
    // 将筛选关键词转换为小写用于匹配
    const filterKeywordsLower = filter.keywords.map(k => k.toLowerCase().trim());
    filtered = filtered.filter((paper) =>
      paper.keywords && paper.keywords.length > 0 &&
      paper.keywords.some((keyword) => {
        const keywordLower = keyword.toLowerCase().trim();
        return filterKeywordsLower.includes(keywordLower);
      }),
    );
  }

  if (filter.authors && filter.authors.length > 0) {
    filtered = filtered.filter((paper) =>
      paper.authors.some((author) => filter.authors!.includes(author.id)),
    );
  }

  return filtered;
}

/**
 * 机构统计信息
 */
export interface InstitutionData {
  name: string;
  count: number;
  papers: Paper[];
}

/**
 * 学者统计信息
 */
export interface ScholarData {
  id: string;
  name: string;
  count: number;
  country?: string;
  affiliations: string[];
}

/**
 * 获取国家的Top N机构
 * 统计该国家所有符合要求的论文中，所有作者所属的机构
 */
export function getTopInstitutionsByCountry(
  papers: Paper[],
  country: string,
  topN: number = 5,
): InstitutionData[] {
  const institutionMap = new Map<string, Paper[]>();
  
  // 大小写不敏感匹配
  const normalizeCountry = (c: string) => c?.trim().toLowerCase() || '';
  const targetCountry = normalizeCountry(country);
  
  // 调试信息
  console.log('getTopInstitutionsByCountry 调用:', {
    country,
    targetCountry,
    papersCount: papers.length,
  });

  let matchedPapersCount = 0;
  papers.forEach((paper) => {
    // 检查论文或作者是否属于该国家（大小写不敏感）
    const paperCountry = normalizeCountry(paper.country || '');
    const authorCountries = paper.authors.map(a => normalizeCountry(a.country || ''));
    const isCountryMatch = 
      paperCountry === targetCountry ||
      authorCountries.some(authorCountry => authorCountry === targetCountry);

    if (!isCountryMatch) return;
    
    matchedPapersCount++;

    // 统计这篇论文中所有作者的机构（不限制作者必须是该国家的）
    paper.authors.forEach((author) => {
      if (author.affiliations && author.affiliations.length > 0) {
        author.affiliations.forEach((affiliation) => {
          if (affiliation && affiliation.trim()) {
            const normalized = affiliation.trim();
            if (!institutionMap.has(normalized)) {
              institutionMap.set(normalized, []);
            }
            // 避免重复计算同一篇论文
            if (!institutionMap.get(normalized)!.some((p) => p.id === paper.id)) {
              institutionMap.get(normalized)!.push(paper);
            }
          }
        });
      }
    });
  });
  
  console.log('getTopInstitutionsByCountry 结果:', {
    matchedPapersCount,
    institutionsCount: institutionMap.size,
  });

  return Array.from(institutionMap.entries())
    .map(([name, papers]) => ({
      name,
      count: papers.length,
      papers,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

/**
 * 获取机构的Top N学者
 */
export function getTopScholarsByInstitution(
  papers: Paper[],
  institution: string,
  topN: number = 5,
): ScholarData[] {
  const scholarMap = new Map<
    string,
    {
      name: string;
      count: number;
      country?: string;
      affiliations: Set<string>;
    }
  >();

  papers.forEach((paper) => {
    paper.authors.forEach((author) => {
      // 检查作者是否属于该机构
      const hasInstitution =
        author.affiliations &&
        author.affiliations.some((aff) => aff.trim() === institution.trim());

      if (hasInstitution) {
        const authorId = author.id || `author-${author.name}`;
        if (!scholarMap.has(authorId)) {
          scholarMap.set(authorId, {
            name: author.name || authorId,
            count: 0,
            country: author.country,
            affiliations: new Set(),
          });
        }
        const scholar = scholarMap.get(authorId)!;
        scholar.count++;
        if (author.affiliations) {
          author.affiliations.forEach((aff) => scholar.affiliations.add(aff));
        }
      }
    });
  });

  return Array.from(scholarMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      count: data.count,
      country: data.country,
      affiliations: Array.from(data.affiliations),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
