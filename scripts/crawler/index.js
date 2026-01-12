/**
 * DBLP数据爬虫主脚本
 * 获取2011-2025年顶会论文数据
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { DBLP_VENUE_MAP, YEAR_RANGE, DBLP_API } = require('./config');
const { fetchVenuePapers, sleep, fetchPapersFromDBLP } = require('./dblp-api');

// 输出目录
const OUTPUT_DIR = path.join(__dirname, '../../data/raw');
const OUTPUT_FILE = path.join(__dirname, '../../public/data/papers.json');

/**
 * 确保目录存在
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 特殊处理：USENIX ATC需要从USENIX会议中筛选
 * 因为ATC是USENIX的年度会议，在DBLP中可能标记为usenix atc
 */
async function fetchATCPapers(startYear, endYear) {
  console.log('获取 USENIX ATC 论文...');
  const allPapers = [];

  for (let year = startYear; year <= endYear; year++) {
    console.log(`  获取 ${year} 年数据...`);
    
    // 尝试查询USENIX ATC
    const query = `USENIX Annual Technical Conference ${year}`;
    const url = `https://dblp.org/search/publ/api?q=${encodeURIComponent(query)}&format=json&h=1000`;
    
    try {
      const papers = await new Promise((resolve, reject) => {
        https.get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              const hits = jsonData.result?.hits?.hit || [];
              
              // 筛选出ATC相关的论文
              const atcPapers = hits
                .map((hit) => {
                  const info = hit.info;
                  const venue = (info.venue || info.booktitle || '').toLowerCase();
                  const title = (info.title || '').toLowerCase();
                  const paperYear = info.year ? parseInt(info.year) : year;
                  
                  // 判断是否为ATC论文
                  if (paperYear === year && (venue.includes('atc') || venue.includes('annual technical conference') || 
                      (venue.includes('usenix') && title.includes('atc')))) {
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
                        name: 'USENIX ATC',
                        type: 'conference',
                        tier: '顶会',
                      },
                      year: paperYear,
                      keywords: [],
                      abstract: info.abstract || '',
                      references: [],
                      citations: 0,
                      doi: info.doi || '',
                      url: info.ee || info.url || '',
                      dblpKey: info.key || '',
                    };
                  }
                  return null;
                })
                .filter(Boolean);
              
              resolve(atcPapers);
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });
      
      allPapers.push(...papers);
      console.log(`    ${year} 年获取到 ${papers.length} 篇ATC论文`);
    } catch (error) {
      console.error(`    查询失败: ${error.message}`);
    }

    await sleep(DBLP_API.requestDelay);
  }

  console.log(`USENIX ATC 总共获取到 ${allPapers.length} 篇论文\n`);
  return allPapers;
}

/**
 * 主函数
 */
async function main() {
  console.log('开始爬取顶会论文数据...');
  console.log(`目标年份: ${YEAR_RANGE.start}-${YEAR_RANGE.end}\n`);

  ensureDirectoryExists(OUTPUT_DIR);

  const allPapers = [];
  const venues = Object.keys(DBLP_VENUE_MAP);

  for (const venueName of venues) {
    const venueConfig = DBLP_VENUE_MAP[venueName];
    
    try {
      let papers;
      
      // 特殊处理ATC
      if (venueName === 'ATC') {
        papers = await fetchATCPapers(YEAR_RANGE.start, YEAR_RANGE.end);
      } else {
        papers = await fetchVenuePapers(
          venueConfig.dblpKey,
          YEAR_RANGE.start,
          YEAR_RANGE.end,
          {
            requestDelay: DBLP_API.requestDelay,
            useSemanticScholar: false, // 设置为true会大大增加运行时间
          },
        );
      }

      // 设置venue信息
      papers.forEach((paper) => {
        paper.venue = {
          name: venueConfig.name,
          type: venueConfig.type,
          tier: venueConfig.tier,
        };
      });

      allPapers.push(...papers);
    } catch (error) {
      console.error(`获取 ${venueName} 数据时出错:`, error.message);
    }

    // 会议之间也延迟
    await sleep(DBLP_API.requestDelay);
  }

  // 去重（基于DOI或title）
  const uniquePapers = [];
  const seen = new Set();

  for (const paper of allPapers) {
    const key = paper.doi || paper.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      uniquePapers.push(paper);
    }
  }

  console.log(`\n总共获取到 ${allPapers.length} 篇论文`);
  console.log(`去重后: ${uniquePapers.length} 篇论文`);

  // 保存数据
  ensureDirectoryExists(path.dirname(OUTPUT_FILE));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniquePapers, null, 2), 'utf-8');
  console.log(`\n数据已保存到: ${OUTPUT_FILE}`);

  // 保存原始数据备份
  const backupFile = path.join(OUTPUT_DIR, `papers-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(uniquePapers, null, 2), 'utf-8');
  console.log(`备份已保存到: ${backupFile}`);
}

// 运行脚本
if (require.main === module) {
  main().catch((error) => {
    console.error('爬虫执行失败:', error);
    process.exit(1);
  });
}

module.exports = { main };
