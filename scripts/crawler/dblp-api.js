/**
 * DBLP API 交互模块
 */

const https = require('https');
const http = require('http');

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 从DBLP获取会议论文
 * @param {string} venueName - DBLP会议名称（如 'SOSP'）
 * @param {number} year - 年份
 * @returns {Promise<Array>} 论文列表
 */
async function fetchPapersFromDBLP(venueName, year) {
  return new Promise((resolve) => {
    // DBLP API查询格式：使用会议名称和年份
    // 格式: "SOSP 2021" 或 "booktitle:SOSP year:2021"
    const query = `${venueName} ${year}`;
    const url = `https://dblp.org/search/publ/api?q=${encodeURIComponent(query)}&format=json&h=1000`;

    https
      .get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            const hits = jsonData.result?.hits?.hit || [];
            
            const papers = hits
              .map((hit) => {
                const info = hit.info;
                const paperYear = info.year ? parseInt(info.year) : null;
                
                // 检查年份是否匹配
                if (paperYear && paperYear !== year) {
                  return null;
                }
                
                // 检查会议名称是否匹配（在venue或booktitle中）
                const venue = (info.venue || info.booktitle || '').toLowerCase();
                const venueNameLower = venueName.toLowerCase();
                if (!venue.includes(venueNameLower) && venueNameLower !== 'sc') {
                  // SC需要特殊处理，因为可能匹配到其他包含SC的会议
                  return null;
                }
                
                return {
                  id: info.key || info.doi || `dblp-${hit['@id']}`,
                  title: info.title || 'Untitled',
                  authors: (info.authors?.author || []).map((author) => {
                    const name = typeof author === 'string' ? author : author.text || author['@pid'] || '';
                    return {
                      id: typeof author === 'object' && author['@pid'] ? author['@pid'] : name.toLowerCase().replace(/\s+/g, '-'),
                      name: name,
                      affiliations: [],
                      country: undefined,
                    };
                  }),
                  venue: {
                    name: info.venue || info.booktitle || '',
                    type: 'conference',
                    tier: '顶会',
                  },
                  year: paperYear || year,
                  keywords: [],
                  abstract: info.abstract || '',
                  references: [],
                  citations: 0,
                  doi: info.doi || '',
                  url: info.ee || info.url || '',
                  dblpKey: info.key || '',
                };
              })
              .filter(Boolean);

            resolve(papers);
          } catch (error) {
            console.error(`Error parsing DBLP response for ${venueName} ${year}:`, error.message);
            resolve([]);
          }
        });
      })
      .on('error', (error) => {
        console.error(`Error fetching from DBLP for ${venueName} ${year}:`, error.message);
        resolve([]);
      });
  });
}

/**
 * 从Semantic Scholar获取论文补充信息
 * @param {string} title - 论文标题
 * @param {string} doi - DOI（可选）
 * @returns {Promise<Object>} 补充信息
 */
async function fetchPaperDetailsFromSemanticScholar(title, doi = '') {
  await sleep(600);

  return new Promise((resolve) => {
    const query = doi ? `doi:${doi}` : title;
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=1&fields=title,abstract,citationCount,keywords,year,authors,references,externalIds`;

    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            const paper = jsonData.data?.[0];
            if (paper) {
              resolve({
                abstract: paper.abstract || '',
                citations: paper.citationCount || 0,
                keywords: paper.keywords || [],
                year: paper.year,
                references: paper.references?.map((ref) => ref.paperId).filter(Boolean) || [],
              });
            } else {
              resolve(null);
            }
          } catch (error) {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });
}

/**
 * 批量获取会议论文
 * @param {string} venueName - DBLP会议名称
 * @param {number} startYear - 起始年份
 * @param {number} endYear - 结束年份
 * @param {Object} config - 配置对象
 * @returns {Promise<Array>} 论文列表
 */
async function fetchVenuePapers(venueName, startYear, endYear, config = {}) {
  const { requestDelay = 1500, useSemanticScholar = false } = config;
  const allPapers = [];

  console.log(`开始获取 ${venueName} (${startYear}-${endYear}) 的论文...`);

  for (let year = startYear; year <= endYear; year++) {
    console.log(`  获取 ${year} 年数据...`);
    const papers = await fetchPapersFromDBLP(venueName, year);
    
    if (useSemanticScholar && papers.length > 0) {
      console.log(`    补充 ${papers.length} 篇论文的详细信息...`);
      for (const paper of papers) {
        const details = await fetchPaperDetailsFromSemanticScholar(paper.title, paper.doi);
        if (details) {
          paper.abstract = details.abstract || paper.abstract;
          paper.citations = details.citations || paper.citations;
          paper.keywords = details.keywords || paper.keywords;
          paper.year = details.year || paper.year;
          paper.references = details.references || paper.references;
        }
      }
    }

    allPapers.push(...papers);
    console.log(`    ${year} 年获取到 ${papers.length} 篇论文`);

    if (year < endYear) {
      await sleep(requestDelay);
    }
  }

  console.log(`${venueName} 总共获取到 ${allPapers.length} 篇论文\n`);
  return allPapers;
}

module.exports = {
  fetchPapersFromDBLP,
  fetchPaperDetailsFromSemanticScholar,
  fetchVenuePapers,
  sleep,
};
