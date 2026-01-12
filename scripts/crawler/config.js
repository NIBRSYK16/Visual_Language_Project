/**
 * 爬虫配置文件
 */

// DBLP会议标识映射
const DBLP_VENUE_MAP = {
  'SOSP': {
    dblpKey: 'conf/sosp',
    name: 'SOSP',
    type: 'conference',
    tier: '顶会',
  },
  'OSDI': {
    dblpKey: 'conf/osdi',
    name: 'OSDI',
    type: 'conference',
    tier: '顶会',
  },
  'ATC': {
    dblpKey: 'conf/usenix',
    name: 'USENIX ATC',
    type: 'conference',
    tier: '顶会',
    // ATC是USENIX的会议，需要过滤年份和标题
  },
  'ASPLOS': {
    dblpKey: 'conf/asplos',
    name: 'ASPLOS',
    type: 'conference',
    tier: '顶会',
  },
  'EuroSys': {
    dblpKey: 'conf/eurosys',
    name: 'EuroSys',
    type: 'conference',
    tier: '顶会',
  },
  'SC': {
    dblpKey: 'conf/sc',
    name: 'SC',
    type: 'conference',
    tier: '顶会',
  },
};

// 目标年份范围
const YEAR_RANGE = {
  start: 2011,
  end: 2025,
};

// DBLP API配置
const DBLP_API = {
  baseUrl: 'https://dblp.org/search/publ/api',
  format: 'json',
  maxResults: 1000,
  // DBLP API限制：建议每次请求间隔至少1秒
  requestDelay: 1500, // 毫秒
};

// Semantic Scholar API配置
const SEMANTIC_SCHOLAR_API = {
  baseUrl: 'https://api.semanticscholar.org/graph/v1',
  // 免费API限制：每分钟100次请求
  requestDelay: 600, // 毫秒
};

module.exports = {
  DBLP_VENUE_MAP,
  YEAR_RANGE,
  DBLP_API,
  SEMANTIC_SCHOLAR_API,
};
