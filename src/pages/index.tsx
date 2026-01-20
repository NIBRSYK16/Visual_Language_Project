/**
 * 主页面
 * 学术文献可视化分析
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layout, Card, Row, Col, Slider, Space, Table, Tag, Button, Drawer, Tooltip, Input, Select, Popover } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import { fetchPapers } from '@/services/api';
import { Paper, FilterCondition } from '@/types';
import { applyFilter, extractWordCloudData } from '@/services/dataProcessor';
import GeoMap from '@/components/GeoMap';
import WordCloud from '@/components/WordCloud';
import CoAuthorNetwork from '@/components/CoAuthorNetwork';
import KeywordEvolution, { KeywordEvolutionRef } from '@/components/KeywordEvolution';
import CountryEvolution, { CountryEvolutionRef } from '@/components/CountryEvolution';
import InstitutionEvolution, { InstitutionEvolutionRef } from '@/components/InstitutionEvolution';
import ConferenceTrend from '@/components/ConferenceTrend';
import ConferencePieChart from '@/components/ConferencePieChart';
import CitationCascade from '@/components/CitationCascade';
import KeywordSphere3D from '@/components/KeywordSphere3D';
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
  const [selectedEvolutionView, setSelectedEvolutionView] = useState<'keyword' | 'country' | 'institution'>('keyword');
  const [keywordFilterVisible, setKeywordFilterVisible] = useState(false);
  
  // 三个演化模块的ref（仅用于右侧放大版，左侧缩略图不带交互）
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

  // 获取所有唯一关键词（用于全局选择器）
  const allKeywords = useMemo(() => {
    const wordCloudData = extractWordCloudData(papers);
    return wordCloudData.map(item => item.word).sort();
  }, [papers]);

  // 统一播放控制（只控制右侧放大版，左侧缩略图不参与）
  const handleGlobalPlayPause = () => {
    if (globalIsPlaying) {
      // 暂停右侧所有模块
      keywordEvolutionRef.current?.pause();
      countryEvolutionRef.current?.pause();
      institutionEvolutionRef.current?.pause();
      setGlobalIsPlaying(false);
    } else {
      // 播放右侧所有模块 - 先同步到第一个年份
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

  // 处理单个模块的播放状态变化（不触发全局同步）
  // 只有当用户点击"播放全部"按钮时，才会同步播放所有模块
  const handleKeywordPlayStateChange = (isPlaying: boolean) => {
    // 不设置 globalIsPlaying，让各个模块独立播放
  };

  const handleCountryPlayStateChange = (isPlaying: boolean) => {
    // 不设置 globalIsPlaying，让各个模块独立播放
  };

  const handleInstitutionPlayStateChange = (isPlaying: boolean) => {
    // 不设置 globalIsPlaying，让各个模块独立播放
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
          author.affiliations && 
          Array.isArray(author.affiliations) &&
          author.affiliations.some((affiliation) => 
            affiliation && 
            typeof affiliation === 'string' &&
            affiliation.toLowerCase().includes(searchLower)
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
          background: '#1a1a2e',
          padding: '0 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 500, color: '#fff' }}>
          学术文献可视化分析
        </h1>
        <Space>
          <span style={{ whiteSpace: 'nowrap', color: '#fff' }}>年份范围:</span>
          <Slider
            range
            min={minYear}
            max={maxYear}
            value={filter.years || [minYear, maxYear]}
            onChange={handleYearSliderChange}
            style={{ width: 300, margin: '0 10px' }}
            disabled={loading}
          />
          <span style={{ whiteSpace: 'nowrap', color: '#fff' }}>
            {filter.years ? `${filter.years[0]} - ${filter.years[1]}` : `${minYear} - ${maxYear}`}
          </span>
          <span style={{ whiteSpace: 'nowrap', color: '#aaa' }}>
            ({filteredPapers.length} 篇论文)
          </span>
          <Button
            size="small"
            onClick={() => setKeywordFilterVisible((v) => !v)}
            style={{
              marginLeft: 8,
              background: 'rgba(255, 255, 255, 0.06)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
            }}
          >
            关键词筛选
          </Button>
          {filter.keywords && filter.keywords.length > 0 && (
            <>
              <span style={{ whiteSpace: 'nowrap', color: '#aaa', marginLeft: '16px' }}>
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
                  style={{
                    background: 'rgba(77, 171, 247, 0.3)',
                    borderColor: 'rgba(77, 171, 247, 0.6)',
                    color: '#ffffff',
                  }}
                >
                  {keyword}
                </Tag>
              ))}
              <Button 
                size="small" 
                onClick={handleClearKeywords}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                }}
              >
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
      
      {/* 全局关键词选择器（通过按钮展开/收起） */}
      {keywordFilterVisible && (
        <div
          style={{
            position: 'fixed',
            top: '64px',
            left: 0,
            right: 0,
            zIndex: 999,
            background: 'rgba(26, 26, 46, 0.95)',
            borderBottom: '2px solid rgba(77, 171, 247, 0.3)',
            padding: '12px 24px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ color: '#e8f4f8', fontWeight: 500, marginRight: '8px', whiteSpace: 'nowrap' }}>
              关键词筛选:
            </span>
            {allKeywords.slice(0, 50).map((keyword) => {
              const isSelected = filter.keywords?.some(
                (k) => k.toLowerCase().trim() === keyword.toLowerCase().trim()
              );
              return (
                <Tag
                  key={keyword}
                  onClick={() => handleKeywordClick(keyword)}
                  style={{
                    cursor: 'pointer',
                    background: isSelected
                      ? 'rgba(77, 171, 247, 0.4)'
                      : 'rgba(255, 255, 255, 0.1)',
                    borderColor: isSelected
                      ? 'rgba(77, 171, 247, 0.8)'
                      : 'rgba(255, 255, 255, 0.3)',
                    color: isSelected ? '#ffffff' : '#e8f4f8',
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(77, 171, 247, 0.2)';
                      e.currentTarget.style.borderColor = 'rgba(77, 171, 247, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    }
                  }}
                >
                  {keyword}
                </Tag>
              );
            })}
            {allKeywords.length > 50 && (
              <span style={{ color: '#b8d4e3', fontSize: '12px' }}>
                ... 还有 {allKeywords.length - 50} 个关键词
              </span>
            )}
            {filter.keywords && filter.keywords.length > 0 && (
              <Button
                size="small"
                onClick={handleClearKeywords}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  marginLeft: '8px',
                }}
              >
                清除全部
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* 内容区域，根据关键词筛选条是否展开调整顶部间距 */}
      <Content
        style={{
          padding: '0 24px 24px',
          background: '#0a0a0a',
          marginTop: '64px',
          paddingTop: keywordFilterVisible ? '80px' : '4px',
        }}
      >
        {/* 第一行：地图热力图在左边，其他三个视图在右边垂直排列 */}
        <Row gutter={16} style={{ marginBottom: 12 }}>
          {/* 左边：地图热力图 */}
          <Col span={14}>
            <Card title="全球科研产出地图" loading={loading} style={{ height: '100%' }}>
              {/* 左侧地图保持较大，但不压缩右侧三个视图过多 */}
              <div style={{ height: '480px' }}>
                <GeoMap papers={filteredPapers} filter={filter} onFilterChange={handleFilterChange} />
              </div>
            </Card>
          </Col>
          {/* 右边：三个视图垂直排列（每个视图有足够高度，整体略高于左侧地图） */}
          <Col span={10}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Card
                title="动态交互词云"
                loading={loading}
                size="small"
                style={{ height: 200, overflow: 'hidden' }}
              >
                <div style={{ height: '100%' }}>
                  <WordCloud papers={filteredPapers} filter={filter} onKeywordClick={handleKeywordClick} />
                </div>
              </Card>
              <Card
                title="顶会趋势分析"
                loading={loading}
                size="small"
                style={{ height: 200, overflow: 'hidden' }}
              >
                <div style={{ height: '100%' }}>
                  <ConferenceTrend papers={filteredPapers} filter={filter} />
                </div>
              </Card>
              <Card
                title="会议占比分析"
                loading={loading}
                size="small"
                style={{ height: 200, overflow: 'hidden' }}
              >
                <div style={{ height: '100%' }}>
                  <ConferencePieChart papers={filteredPapers} filter={filter} />
                </div>
              </Card>
            </div>
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

        {/* 第四行：单个卡片，通过“选择趋势图”按钮切换三种趋势图 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card
              title={
                selectedEvolutionView === 'keyword'
                  ? '关键词演化图谱'
                  : selectedEvolutionView === 'country'
                  ? '国家论文发表数演化'
                  : '机构论文发表数演化'
              }
              loading={loading}
              extra={
                <Space>
                  <Popover
                    trigger="click"
                    placement="bottomRight"
                    content={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Button
                          type={selectedEvolutionView === 'keyword' ? 'primary' : 'default'}
                          size="small"
                          onClick={() => setSelectedEvolutionView('keyword')}
                        >
                          关键词演化
                        </Button>
                        <Button
                          type={selectedEvolutionView === 'country' ? 'primary' : 'default'}
                          size="small"
                          onClick={() => setSelectedEvolutionView('country')}
                        >
                          国家论文发表数演化
                        </Button>
                        <Button
                          type={selectedEvolutionView === 'institution' ? 'primary' : 'default'}
                          size="small"
                          onClick={() => setSelectedEvolutionView('institution')}
                        >
                          机构论文发表数演化
                        </Button>
                      </div>
                    }
                  >
                    <Button size="small">选择趋势图</Button>
                  </Popover>
                  <Button
                    type="primary"
                    size="small"
                    icon={globalIsPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    onClick={handleGlobalPlayPause}
                  >
                    {globalIsPlaying ? '暂停全部' : '播放全部'}
                  </Button>
                </Space>
              }
              style={{ minHeight: 360, display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ flex: 1, minHeight: 0 }}>
                {selectedEvolutionView === 'keyword' && (
                  <KeywordEvolution
                    ref={keywordEvolutionRef}
                    papers={filteredPapersForEvolution}
                    filter={filter}
                    onPlayStateChange={handleKeywordPlayStateChange}
                    externalYear={globalYear}
                    externalIsPlaying={globalIsPlaying}
                  />
                )}
                {selectedEvolutionView === 'country' && (
                  <CountryEvolution
                    ref={countryEvolutionRef}
                    papers={filteredPapersForEvolution}
                    filter={filter}
                    onPlayStateChange={handleCountryPlayStateChange}
                    externalYear={globalYear}
                    externalIsPlaying={globalIsPlaying}
                  />
                )}
                {selectedEvolutionView === 'institution' && (
                  <InstitutionEvolution
                    ref={institutionEvolutionRef}
                    papers={filteredPapersForEvolution}
                    filter={filter}
                    onPlayStateChange={handleInstitutionPlayStateChange}
                    externalYear={globalYear}
                    externalIsPlaying={globalIsPlaying}
                  />
                )}
              </div>
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

        {/* 第八行：3D关键词球形 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card title="3D关键词球形" loading={loading}>
              <KeywordSphere3D papers={filteredPapers} filter={filter} onKeywordClick={handleKeywordClick} />
            </Card>
          </Col>
        </Row>

      </Content>
      
      {/* 论文列表侧边栏 - 使用自定义悬浮框 */}
      {paperListVisible && (
        <div
          className="paper-list-sidebar"
          style={{
            position: 'fixed',
            top: '64px',
            right: 0,
            width: '420px',
            height: 'calc(100vh - 64px)',
            background: '#1a1a2e',
            borderLeft: '2px solid rgba(77, 171, 247, 0.3)',
            boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 标题栏 */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '2px solid rgba(77, 171, 247, 0.3)',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#e8f4f8' }}>
              论文列表 ({displayedPapers.length} / {filteredPapers.length} 篇)
            </div>
            <button
              onClick={() => {
                setPaperListVisible(false);
                setPaperListSearchText('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#e8f4f8',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 8px',
                lineHeight: '1',
              }}
            >
              ×
            </button>
          </div>
          
          {/* 搜索和排序控件 */}
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(77, 171, 247, 0.2)', flexShrink: 0 }}>
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
          
          {/* 论文列表内容区域 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingRight: '8px' }}>
          {displayedPapers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#b8d4e3' }}>
              {paperListSearchText ? '未找到匹配的论文' : '暂无论文数据'}
            </div>
          ) : (
            displayedPapers.map((paper, index) => (
            <div
              key={paper.id}
              style={{
                padding: '12px',
                marginBottom: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                background: '#1a1a2e',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#4dabf7';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(77, 171, 247, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
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
                    color: '#4dabf7',
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
              <div style={{ fontSize: '12px', color: '#b8d4e3', marginBottom: '6px', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ fontWeight: '500', color: '#e8f4f8' }}>年份:</span> {paper.year}
                  {paper.venue?.name && (
                    <span style={{ marginLeft: '12px' }}>
                      <span style={{ fontWeight: '500', color: '#e8f4f8' }}>会议:</span> {paper.venue.name}
                    </span>
                  )}
                </div>
                {paper.citations !== undefined && (
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontWeight: '500', color: '#e8f4f8' }}>引用数:</span> {paper.citations}
                  </div>
                )}
              </div>
              {paper.authors && paper.authors.length > 0 && (
                <div style={{ fontSize: '12px', color: '#b8d4e3', marginBottom: '6px', lineHeight: '1.6' }}>
                  <span style={{ fontWeight: '500', color: '#e8f4f8' }}>作者:</span>{' '}
                  {paper.authors.slice(0, 3).map(a => a.name || a.id).join(', ')}
                  {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
                </div>
              )}
              {paper.keywords && paper.keywords.length > 0 && (
                <div style={{ fontSize: '12px', marginTop: '6px' }}>
                  <span style={{ fontWeight: '500', marginRight: '4px', color: '#e8f4f8' }}>关键词:</span>
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
        </div>
      )}
    </Layout>
  );
};

export default IndexPage;
