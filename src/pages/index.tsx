/**
 * 主页面
 * 学术文献全景分析系统
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layout, Card, Row, Col, Slider, Space, Table, Tag, Button, Drawer, Tooltip, Input, Select } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import { fetchPapers } from '@/services/api';
import { Paper, FilterCondition } from '@/types';
import { applyFilter } from '@/services/dataProcessor';
import GeoMap from '@/components/GeoMap';
import WordCloud from '@/components/WordCloud';
import CoAuthorNetwork from '@/components/CoAuthorNetwork';
import KeywordEvolution, { KeywordEvolutionRef } from '@/components/KeywordEvolution';
import CountryEvolution, { CountryEvolutionRef } from '@/components/CountryEvolution';
import InstitutionEvolution, { InstitutionEvolutionRef } from '@/components/InstitutionEvolution';
import ConferenceTrend from '@/components/ConferenceTrend';
import ConferencePieChart from '@/components/ConferencePieChart';
import CitationCascade from '@/components/CitationCascade';
import './index.less';

const { Header, Content } = Layout;

const IndexPage: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [filter, setFilter] = useState<FilterCondition>({});
  const [loading, setLoading] = useState(true);
  const [minYear, setMinYear] = useState(2000);
  const [maxYear, setMaxYear] = useState(new Date().getFullYear());
  const [globalYear, setGlobalYear] = useState<number | null>(null);
  const [globalIsPlaying, setGlobalIsPlaying] = useState(false);
  const [paperListVisible, setPaperListVisible] = useState(false);
  const [paperListSearchText, setPaperListSearchText] = useState('');
  const [paperListSortBy, setPaperListSortBy] = useState<'time' | 'venue'>('time');
  
  // 三个演化模块的ref
  const keywordEvolutionRef = useRef<KeywordEvolutionRef>(null);
  const countryEvolutionRef = useRef<CountryEvolutionRef>(null);
  const institutionEvolutionRef = useRef<InstitutionEvolutionRef>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchPapers();
      setPapers(data);

      // 提取年份范围
      const years = data.map((p) => p.year).filter(Boolean);
      if (years.length > 0) {
        const currentMinYear = Math.min(...years);
        const currentMaxYear = Math.max(...years);
        setMinYear(currentMinYear);
        setMaxYear(currentMaxYear);
        setFilter((prev) => ({ ...prev, years: [currentMinYear, currentMaxYear] }));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilter: FilterCondition) => {
    setFilter(newFilter);
  };

  const handleYearSliderChange = (value: [number, number]) => {
    setFilter((prev) => ({ ...prev, years: value }));
  };

  // 处理关键词点击事件
  const handleKeywordClick = (keyword: string) => {
    setFilter((prev) => {
      const currentKeywords = prev.keywords || [];
      // 如果关键词已存在，则移除；否则添加
      if (currentKeywords.includes(keyword)) {
        const newKeywords = currentKeywords.filter((k) => k !== keyword);
        return { ...prev, keywords: newKeywords.length > 0 ? newKeywords : undefined };
      } else {
        return { ...prev, keywords: [...currentKeywords, keyword] };
      }
    });
  };

  // 清除关键词筛选
  const handleClearKeywords = () => {
    setFilter((prev) => ({ ...prev, keywords: undefined }));
  };

  // 统一播放控制
  const handleGlobalPlayPause = () => {
    if (globalIsPlaying) {
      // 暂停所有模块
      keywordEvolutionRef.current?.pause();
      countryEvolutionRef.current?.pause();
      institutionEvolutionRef.current?.pause();
      setGlobalIsPlaying(false);
    } else {
      // 播放所有模块 - 先同步到第一个年份
      const years = filteredPapersForEvolution
        .map((p) => p.year)
        .filter((y) => y && y > 0)
        .sort((a, b) => a - b);
      if (years.length > 0) {
        const firstYear = years[0];
        setGlobalYear(firstYear);
        keywordEvolutionRef.current?.setYear(firstYear);
        countryEvolutionRef.current?.setYear(firstYear);
        institutionEvolutionRef.current?.setYear(firstYear);
      }
      // 然后开始播放
      keywordEvolutionRef.current?.play();
      countryEvolutionRef.current?.play();
      institutionEvolutionRef.current?.play();
      setGlobalIsPlaying(true);
    }
  };

  // 处理单个模块的播放状态变化和年份同步
  const handleKeywordPlayStateChange = (isPlaying: boolean) => {
    if (isPlaying && !globalIsPlaying) {
      setGlobalIsPlaying(true);
    }
  };

  const handleCountryPlayStateChange = (isPlaying: boolean) => {
    if (isPlaying && !globalIsPlaying) {
      setGlobalIsPlaying(true);
    }
  };

  const handleInstitutionPlayStateChange = (isPlaying: boolean) => {
    if (isPlaying && !globalIsPlaying) {
      setGlobalIsPlaying(true);
    }
  };

         // 应用筛选条件（用于大多数视图，包括关键词筛选）
         const filteredPapers = useMemo(() => {
           let currentPapers = papers;

           if (filter.years) {
             currentPapers = currentPapers.filter(
               (p) => p.year >= filter.years![0] && p.year <= filter.years![1],
             );
           }

           if (filter.countries && filter.countries.length > 0) {
             currentPapers = currentPapers.filter((paper) =>
               paper.country && filter.countries!.includes(paper.country),
             );
           }

           if (filter.venues && filter.venues.length > 0) {
             currentPapers = currentPapers.filter((paper) => filter.venues!.includes(paper.venue.name));
           }

           if (filter.keywords && filter.keywords.length > 0) {
             // 将筛选关键词转换为小写用于匹配
             const filterKeywordsLower = filter.keywords.map(k => k.toLowerCase().trim());
             currentPapers = currentPapers.filter((paper) =>
               paper.keywords && paper.keywords.length > 0 &&
               paper.keywords.some((keyword) => {
                 const keywordLower = keyword.toLowerCase().trim();
                 return filterKeywordsLower.includes(keywordLower);
               }),
             );
           }

           if (filter.authors && filter.authors.length > 0) {
             currentPapers = currentPapers.filter((paper) =>
               paper.authors.some((author) => filter.authors!.includes(author.id)),
             );
           }

           return currentPapers;
         }, [papers, filter]);

  // 用于关键词演化的筛选（不包含关键词筛选）
  const filteredPapersForEvolution = useMemo(() => {
    let currentPapers = papers;

    if (filter.years) {
      currentPapers = currentPapers.filter(
        (p) => p.year >= filter.years![0] && p.year <= filter.years![1],
      );
    }

           if (filter.countries && filter.countries.length > 0) {
             currentPapers = currentPapers.filter((paper) =>
               paper.country && filter.countries!.includes(paper.country),
             );
           }

    if (filter.venues && filter.venues.length > 0) {
      currentPapers = currentPapers.filter((paper) => filter.venues!.includes(paper.venue.name));
    }

    // 注意：这里不包含关键词筛选

    if (filter.authors && filter.authors.length > 0) {
      currentPapers = currentPapers.filter((paper) =>
        paper.authors.some((author) => filter.authors!.includes(author.id)),
      );
    }

    return currentPapers;
  }, [papers, filter]);

  // 论文列表的搜索和排序
  const displayedPapers = useMemo(() => {
    if (!filteredPapers || !Array.isArray(filteredPapers)) {
      return [];
    }
    
    let result = [...filteredPapers];
    
    // 搜索功能：搜索论文标题、作者名字、机构名字
    if (paperListSearchText.trim()) {
      const searchLower = paperListSearchText.toLowerCase().trim();
      result = result.filter((paper) => {
        // 搜索标题
        if (paper.title?.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // 搜索作者名字
        if (paper.authors?.some((author) => 
          (author.name || author.id || '').toLowerCase().includes(searchLower)
        )) {
          return true;
        }
        
        // 搜索机构名字
        if (paper.authors?.some((author) => 
          author.affiliations?.some((affiliation) => 
            affiliation?.toLowerCase().includes(searchLower)
          )
        )) {
          return true;
        }
        
        return false;
      });
    }
    
    // 排序功能
    if (paperListSortBy === 'time') {
      // 按时间排序（年份降序）
      result.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (paperListSortBy === 'venue') {
      // 按会议排序（会议名称升序）
      result.sort((a, b) => {
        const venueA = a.venue?.name || '';
        const venueB = b.venue?.name || '';
        return venueA.localeCompare(venueB);
      });
    }
    
    return result;
  }, [filteredPapers, paperListSearchText, paperListSortBy]);

  // 论文列表表格列定义
  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: '30%',
      ellipsis: true,
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: '8%',
      sorter: (a: Paper, b: Paper) => a.year - b.year,
    },
    {
      title: '作者',
      key: 'authors',
      width: '20%',
      render: (_: any, record: Paper) => (
        <div>
          {record.authors.slice(0, 3).map((author) => (
            <Tag key={author.id} style={{ marginBottom: '4px' }}>
              {author.name || author.id}
            </Tag>
          ))}
          {record.authors.length > 3 && <Tag>+{record.authors.length - 3}</Tag>}
        </div>
      ),
    },
    {
      title: '会议/期刊',
      dataIndex: ['venue', 'name'],
      key: 'venue',
      width: '15%',
    },
    {
      title: '关键词',
      key: 'keywords',
      width: '20%',
      render: (_: any, record: Paper) => (
        <div>
          {record.keywords.slice(0, 3).map((keyword, idx) => (
            <Tag key={idx} color="blue" style={{ marginBottom: '4px' }}>
              {keyword}
            </Tag>
          ))}
          {record.keywords.length > 3 && <Tag>+{record.keywords.length - 3}</Tag>}
        </div>
      ),
    },
    {
      title: '引用数',
      dataIndex: 'citations',
      key: 'citations',
      width: '8%',
      sorter: (a: Paper, b: Paper) => a.citations - b.citations,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 固定Header */}
      <Header
        className="fixed-header"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: '#fff',
          padding: '0 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 500 }}>
          学术文献全景分析系统
        </h1>
        <Space>
          <span style={{ whiteSpace: 'nowrap' }}>年份范围:</span>
          <Slider
            range
            min={minYear}
            max={maxYear}
            value={filter.years || [minYear, maxYear]}
            onChange={handleYearSliderChange}
            style={{ width: 300, margin: '0 10px' }}
            disabled={loading}
          />
          <span style={{ whiteSpace: 'nowrap' }}>
            {filter.years ? `${filter.years[0]} - ${filter.years[1]}` : `${minYear} - ${maxYear}`}
          </span>
          <span style={{ whiteSpace: 'nowrap', color: '#666' }}>
            ({filteredPapers.length} 篇论文)
          </span>
          {filter.keywords && filter.keywords.length > 0 && (
            <>
              <span style={{ whiteSpace: 'nowrap', color: '#666', marginLeft: '16px' }}>
                关键词筛选:
              </span>
              {filter.keywords.map((keyword) => (
                <Tag
                  key={keyword}
                  closable
                  onClose={() => {
                    const newKeywords = filter.keywords!.filter((k) => k !== keyword);
                    setFilter((prev) => ({
                      ...prev,
                      keywords: newKeywords.length > 0 ? newKeywords : undefined,
                    }));
                  }}
                  color="blue"
                >
                  {keyword}
                </Tag>
              ))}
              <Button size="small" onClick={handleClearKeywords}>
                清除
              </Button>
            </>
          )}
        </Space>
        {/* 论文列表按钮 */}
        <Button
          type="primary"
          icon={<FileTextOutlined />}
          onClick={() => setPaperListVisible(true)}
          style={{ marginLeft: '16px' }}
        >
          论文列表 ({filteredPapers.length})
        </Button>
      </Header>
      
      {/* 内容区域，添加顶部padding以避免被固定Header遮挡 */}
      <Content style={{ padding: '24px', background: '#f0f2f5', marginTop: '64px' }}>
        {/* 第一行：地图和词云 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Card title="全球科研产出地图" loading={loading}>
              <GeoMap papers={filteredPapers} filter={filter} onFilterChange={handleFilterChange} />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="动态交互词云" loading={loading}>
              <WordCloud papers={filteredPapers} filter={filter} onKeywordClick={handleKeywordClick} />
            </Card>
          </Col>
        </Row>

        {/* 第二行：顶会趋势和会议占比饼图 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Card title="顶会趋势分析" loading={loading}>
              <ConferenceTrend papers={filteredPapers} filter={filter} />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="会议占比分析" loading={loading}>
              <ConferencePieChart papers={filteredPapers} filter={filter} />
            </Card>
          </Col>
        </Row>

        {/* 第三行：作者网络 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card title="作者合作网络" loading={loading}>
              <CoAuthorNetwork papers={filteredPapers} filter={filter} />
            </Card>
          </Col>
        </Row>

        {/* 第四行：关键词演化图谱 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card 
              title="关键词演化图谱" 
              loading={loading}
              extra={
                <Button
                  type="primary"
                  size="small"
                  icon={globalIsPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={handleGlobalPlayPause}
                >
                  {globalIsPlaying ? '暂停全部' : '播放全部'}
                </Button>
              }
            >
              <KeywordEvolution 
                ref={keywordEvolutionRef}
                papers={filteredPapersForEvolution} 
                filter={filter}
                onPlayStateChange={handleKeywordPlayStateChange}
                externalYear={globalYear}
                externalIsPlaying={globalIsPlaying}
              />
            </Card>
          </Col>
        </Row>

        {/* 第五行：国家论文发表数演化 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card title="国家论文发表数演化" loading={loading}>
              <CountryEvolution 
                ref={countryEvolutionRef}
                papers={filteredPapersForEvolution} 
                filter={filter}
                onPlayStateChange={handleCountryPlayStateChange}
                externalYear={globalYear}
                externalIsPlaying={globalIsPlaying}
              />
            </Card>
          </Col>
        </Row>

        {/* 第六行：机构论文发表数演化 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card title="机构论文发表数演化" loading={loading}>
              <InstitutionEvolution 
                ref={institutionEvolutionRef}
                papers={filteredPapersForEvolution} 
                filter={filter}
                onPlayStateChange={handleInstitutionPlayStateChange}
                externalYear={globalYear}
                externalIsPlaying={globalIsPlaying}
              />
            </Card>
          </Col>
        </Row>

        {/* 第七行：引用关系 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card title="文献引用瀑布" loading={loading}>
              <CitationCascade papers={filteredPapers} filter={filter} />
            </Card>
          </Col>
        </Row>

      </Content>
      
      {/* 论文列表侧边栏 */}
      <Drawer
        title={`论文列表 (${displayedPapers.length} / ${filteredPapers.length} 篇)`}
        placement="right"
        width={420}
        open={paperListVisible}
        onClose={() => {
          setPaperListVisible(false);
          setPaperListSearchText('');
        }}
        mask={false}
        style={{ zIndex: 999 }}
        getContainer={false}
      >
        {/* 搜索和排序控件 */}
        <div style={{ marginBottom: '16px' }}>
          <Input
            placeholder="搜索论文标题、作者、机构..."
            prefix={<SearchOutlined />}
            value={paperListSearchText}
            onChange={(e) => setPaperListSearchText(e.target.value)}
            allowClear
            style={{ marginBottom: '12px' }}
          />
          <Select
            value={paperListSortBy}
            onChange={setPaperListSortBy}
            style={{ width: '100%' }}
          >
            <Select.Option value="time">按时间排序（最新优先）</Select.Option>
            <Select.Option value="venue">按会议排序</Select.Option>
          </Select>
        </div>
        
        <div style={{ height: 'calc(100vh - 180px)', overflowY: 'auto', paddingRight: '8px' }}>
          {displayedPapers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              {paperListSearchText ? '未找到匹配的论文' : '暂无论文数据'}
            </div>
          ) : (
            displayedPapers.map((paper, index) => (
            <div
              key={paper.id}
              style={{
                padding: '12px',
                marginBottom: '12px',
                border: '1px solid #e8e8e8',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1890ff';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(24,144,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e8e8e8';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Tooltip
                title={
                  <div style={{ maxWidth: '300px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                      {paper.title}
                    </div>
                    <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                      <strong>年份:</strong> {paper.year}
                    </div>
                    {paper.venue?.name && (
                      <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                        <strong>会议/期刊:</strong> {paper.venue.name}
                      </div>
                    )}
                    {paper.citations !== undefined && (
                      <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                        <strong>引用数:</strong> {paper.citations}
                      </div>
                    )}
                    {paper.authors && paper.authors.length > 0 && (
                      <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                        <strong>作者:</strong> {paper.authors.map(a => a.name || a.id).join(', ')}
                      </div>
                    )}
                    {paper.keywords && paper.keywords.length > 0 && (
                      <div style={{ fontSize: '12px', marginTop: '8px' }}>
                        <strong>关键词:</strong>
                        <div style={{ marginTop: '4px' }}>
                          {paper.keywords.map((keyword, idx) => (
                            <Tag key={idx} color="blue" style={{ marginRight: '4px', marginBottom: '4px' }}>
                              {keyword}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                    {paper.abstract && (
                      <div style={{ fontSize: '12px', marginTop: '8px', maxHeight: '100px', overflowY: 'auto' }}>
                        <strong>摘要:</strong> {paper.abstract}
                      </div>
                    )}
                  </div>
                }
                placement="left"
                overlayStyle={{ maxWidth: '350px' }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    color: '#1890ff',
                    lineHeight: '1.5',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'help',
                  }}
                >
                  {paper.title}
                </div>
              </Tooltip>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ fontWeight: '500' }}>年份:</span> {paper.year}
                  {paper.venue?.name && (
                    <span style={{ marginLeft: '12px' }}>
                      <span style={{ fontWeight: '500' }}>会议:</span> {paper.venue.name}
                    </span>
                  )}
                </div>
                {paper.citations !== undefined && (
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontWeight: '500' }}>引用数:</span> {paper.citations}
                  </div>
                )}
              </div>
              {paper.authors && paper.authors.length > 0 && (
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px', lineHeight: '1.6' }}>
                  <span style={{ fontWeight: '500' }}>作者:</span>{' '}
                  {paper.authors.slice(0, 3).map(a => a.name || a.id).join(', ')}
                  {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
                </div>
              )}
              {paper.keywords && paper.keywords.length > 0 && (
                <div style={{ fontSize: '12px', marginTop: '6px' }}>
                  <span style={{ fontWeight: '500', marginRight: '4px' }}>关键词:</span>
                  {paper.keywords.slice(0, 3).map((keyword, idx) => (
                    <Tag key={idx} color="blue" style={{ marginRight: '4px', marginBottom: '4px' }}>
                      {keyword}
                    </Tag>
                  ))}
                  {paper.keywords.length > 3 && (
                    <Tag style={{ marginBottom: '4px' }}>+{paper.keywords.length - 3}</Tag>
                  )}
                </div>
              )}
            </div>
            ))
          )}
        </div>
      </Drawer>
    </Layout>
  );
};

export default IndexPage;
