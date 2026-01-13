/**
 * 主页面
 * 学术文献全景分析系统
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Card, Row, Col, Slider, Space, Table, Tag, Button } from 'antd';
import { fetchPapers } from '@/services/api';
import { Paper, FilterCondition } from '@/types';
import GeoMap from '@/components/GeoMap';
import WordCloud from '@/components/WordCloud';
import CoAuthorNetwork from '@/components/CoAuthorNetwork';
import KeywordEvolution from '@/components/KeywordEvolution';
import ConferenceTrend from '@/components/ConferenceTrend';
import CitationCascade from '@/components/CitationCascade';
import './index.less';

const { Header, Content } = Layout;

const IndexPage: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [filter, setFilter] = useState<FilterCondition>({});
  const [loading, setLoading] = useState(true);
  const [minYear, setMinYear] = useState(2000);
  const [maxYear, setMaxYear] = useState(new Date().getFullYear());

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
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
      </Header>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
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

        {/* 第二行：作者网络 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card title="作者合作网络" loading={loading}>
              <CoAuthorNetwork papers={filteredPapers} filter={filter} />
            </Card>
          </Col>
        </Row>

        {/* 第三行：会议趋势和引用关系 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Card title="关键词演化图谱" loading={loading}>
              <KeywordEvolution papers={filteredPapersForEvolution} filter={filter} />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="顶会趋势分析" loading={loading}>
              <ConferenceTrend papers={filteredPapers} filter={filter} />
            </Card>
          </Col>
        </Row>

        {/* 第四行：引用关系 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card title="文献引用瀑布" loading={loading}>
              <CitationCascade papers={filteredPapers} filter={filter} />
            </Card>
          </Col>
        </Row>

        {/* 论文列表 */}
        <Row gutter={16}>
          <Col span={24}>
            <Card
              title={`论文列表 (${filteredPapers.length} 篇)`}
              loading={loading}
              style={{ marginTop: 16 }}
            >
              <Table
                columns={columns}
                dataSource={filteredPapers}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 篇论文`,
                }}
                scroll={{ x: 1200 }}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default IndexPage;
