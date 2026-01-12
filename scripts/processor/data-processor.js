/**
 * 数据处理器
 * 将原始爬取数据转换为项目需要的格式
 */

const fs = require('fs');
const path = require('path');

/**
 * 机构名称标准化词典
 */
const institutionAliases = {
  // MIT
  'massachusetts institute of technology': 'MIT',
  'mit': 'MIT',
  // Stanford
  'stanford university': 'Stanford',
  'stanford': 'Stanford',
  // CMU
  'carnegie mellon university': 'CMU',
  'carnegie-mellon university': 'CMU',
  'cmu': 'CMU',
  // 更多机构别名...
};

/**
 * 机构到国家的映射
 */
const institutionToCountry = {
  // 美国
  MIT: 'US',
  Stanford: 'US',
  CMU: 'US',
  'UC Berkeley': 'US',
  'University of California, Berkeley': 'US',
  'University of Washington': 'US',
  'Cornell University': 'US',
  'Harvard University': 'US',
  // 中国
  'Tsinghua University': 'CN',
  'Peking University': 'CN',
  'Shanghai Jiao Tong University': 'CN',
  'Fudan University': 'CN',
  // 欧洲
  'ETH Zurich': 'CH',
  'EPFL': 'CH',
  'University of Cambridge': 'GB',
  'University of Oxford': 'GB',
  // 更多映射...
};

/**
 * 标准化机构名称
 */
function normalizeInstitution(inst) {
  if (!inst) return null;
  const lower = inst.toLowerCase().trim();
  return institutionAliases[lower] || inst;
}

/**
 * 从机构名称推导国家
 */
function getCountryFromInstitution(inst) {
  const normalized = normalizeInstitution(inst);
  return institutionToCountry[normalized] || null;
}

/**
 * 处理 DBLP 数据并转换为 Paper 格式
 * 注意：这是简化版本，实际DBLP API返回的数据结构需要根据实际情况调整
 */
function processDBLPData(rawData) {
  const papers = [];

  // 这里需要根据实际DBLP API返回的数据结构进行解析
  // 以下是示例结构，实际使用时需要调整
  if (rawData.result && rawData.result.hits && rawData.result.hits.hit) {
    const hits = Array.isArray(rawData.result.hits.hit)
      ? rawData.result.hits.hit
      : [rawData.result.hits.hit];

    hits.forEach((hit, index) => {
      const info = hit.info;
      if (!info) return;

      const paper = {
        id: info.key || `paper_${Date.now()}_${index}`,
        title: info.title || '',
        authors: (info.authors?.author || []).map((author, idx) => {
          const authorName = typeof author === 'string' ? author : author.text;
          return {
            id: `author_${authorName.replace(/\s+/g, '_')}_${idx}`,
            name: authorName,
            affiliations: [], // DBLP API 可能不包含机构信息
            country: null,
          };
        }),
        venue: {
          name: info.venue || '',
          type: info.type === 'Journal Articles' ? 'journal' : 'conference',
          tier: '顶会', // 默认，可根据实际情况调整
        },
        year: parseInt(info.year) || new Date().getFullYear(),
        keywords: [], // DBLP API 可能不包含关键词
        abstract: info.ee || '', // 使用电子版链接作为占位
        references: [], // 需要额外处理
        citations: 0, // 需要额外处理
        country: null, // 需要从机构推导
      };

      papers.push(paper);
    });
  }

  return papers;
}

/**
 * 构建作者合作关系
 */
function buildAuthorCoauthorship(papers) {
  const coauthorMap = new Map(); // authorId -> Set of coauthorIds

  papers.forEach((paper) => {
    const authorIds = paper.authors.map((a) => a.id);
    authorIds.forEach((authorId) => {
      if (!coauthorMap.has(authorId)) {
        coauthorMap.set(authorId, new Set());
      }
      authorIds.forEach((coauthorId) => {
        if (authorId !== coauthorId) {
          coauthorMap.get(authorId).add(coauthorId);
        }
      });
    });
  });

  const edges = [];
  const edgeWeights = new Map(); // "source-target" -> count

  coauthorMap.forEach((coauthors, authorId) => {
    coauthors.forEach((coauthorId) => {
      const edgeKey = [authorId, coauthorId].sort().join('-');
      edgeWeights.set(edgeKey, (edgeWeights.get(edgeKey) || 0) + 1);
    });
  });

  edgeWeights.forEach((weight, edgeKey) => {
    const [source, target] = edgeKey.split('-');
    edges.push({ source, target, weight });
  });

  return edges;
}

/**
 * 处理所有原始数据文件
 */
function processAllData() {
  const rawDataDir = path.join(__dirname, '../../data/raw');
  const outputDir = path.join(__dirname, '../../data/processed');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const allPapers = [];
  const files = fs.readdirSync(rawDataDir);

  files.forEach((file) => {
    if (file.endsWith('.json') && file !== 'all_conferences.json') {
      const filePath = path.join(rawDataDir, file);
      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const papers = processDBLPData(rawData);
      allPapers.push(...papers);
    }
  });

  // 保存处理后的论文数据
  const papersFile = path.join(outputDir, 'papers.json');
  fs.writeFileSync(papersFile, JSON.stringify(allPapers, null, 2));
  console.log(`✓ 已处理 ${allPapers.length} 篇论文，保存到: ${papersFile}`);

  // 构建作者合作网络
  const coauthorEdges = buildAuthorCoauthorship(allPapers);
  const networkFile = path.join(outputDir, 'author_network.json');
  fs.writeFileSync(networkFile, JSON.stringify(coauthorEdges, null, 2));
  console.log(`✓ 已构建 ${coauthorEdges.length} 条合作关系，保存到: ${networkFile}`);

  // 按国家统计
  const countryStats = {};
  allPapers.forEach((paper) => {
    // 这里需要从paper.authors的机构推导国家
    // 简化处理
    const country = 'US'; // 占位
    if (!countryStats[country]) {
      countryStats[country] = { country, count: 0, papers: [] };
    }
    countryStats[country].count++;
    countryStats[country].papers.push(paper);
  });
  const countryFile = path.join(outputDir, 'country_stats.json');
  fs.writeFileSync(countryFile, JSON.stringify(Object.values(countryStats), null, 2));
  console.log(`✓ 已统计国家数据，保存到: ${countryFile}`);

  return {
    papers: allPapers,
    coauthorNetwork: coauthorEdges,
    countryStats: Object.values(countryStats),
  };
}

module.exports = {
  processDBLPData,
  buildAuthorCoauthorship,
  processAllData,
  normalizeInstitution,
  getCountryFromInstitution,
};
