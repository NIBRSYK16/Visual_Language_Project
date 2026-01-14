/**
 * 全球科研产出地图组件
 * 使用 D3.js 地理投影实现世界地图可视化
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Paper, FilterCondition, CountryData } from '@/types';
import { aggregateByCountry, getTopInstitutionsByCountry, getTopScholarsByInstitution, InstitutionData, ScholarData } from '@/services/dataProcessor';
import { getCountryISO, isoToCountryName } from '@/utils/countryMapper';
import { getNameToISO } from '@/utils/countryNameToISO';
import './index.less';

interface GeoMapProps {
  papers: Paper[];
  filter: FilterCondition;
  onFilterChange: (filter: FilterCondition) => void;
}

interface MapFeature {
  properties: {
    NAME: string;
    NAME_LONG: string;
    ISO_A3: string;
    [key: string]: any;
  };
  geometry: any;
}

interface InstitutionCardData {
  country: string;
  countryName: string;
  x: number;
  y: number;
}

interface ScholarCardData {
  authorId: string;
  authorName: string;
  x: number;
  y: number;
}

interface InstitutionScholarsData {
  institution: string;
  scholars: ScholarData[];
  x: number;
  y: number;
}

const GeoMap: React.FC<GeoMapProps> = ({ papers, filter, onFilterChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [worldMapData, setWorldMapData] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [institutionCard, setInstitutionCard] = useState<InstitutionCardData | null>(null);
  const [institutionScholars, setInstitutionScholars] = useState<InstitutionScholarsData | null>(null);
  const [scholarCard, setScholarCard] = useState<ScholarCardData | null>(null);

  // 加载世界地图数据
  useEffect(() => {
    const loadWorldMap = async () => {
      try {
        // 使用 Natural Earth 110m 数据（简化版世界地图）
        const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        const topojson = await response.json();
        
        // 使用 topojson-client 将 TopoJSON 转换为 GeoJSON
        const topojsonClient = await import('topojson-client');
        const countries = topojsonClient.feature(topojson, (topojson as any).objects.countries);
        
        setWorldMapData(countries);
      } catch (error) {
        console.error('Failed to load world map data:', error);
        // 如果在线加载失败，可以提示用户使用本地数据
      }
    };

    loadWorldMap();
  }, []);

  // 绘制地图
  const drawMap = useCallback(() => {
    if (!svgRef.current || !worldMapData) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = Math.min(width * 0.6, 600);

    // 清空 SVG
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('width', width).attr('height', height);

    // 创建投影
    const projection = d3
      .geoMercator()
      .scale(width / 6.5)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // 计算国家统计数据
    // 使用传入的 papers（已经应用了筛选条件）
    const countryData = aggregateByCountry(papers);
    const countryMap = new Map<string, CountryData>();
    countryData.forEach((data) => {
      const iso = getCountryISO(data.country);
      if (iso) {
        countryMap.set(iso, data);
      } else {
        // 调试：输出无法映射的国家
        console.warn(`无法映射国家: ${data.country}, 论文数: ${data.count}`);
      }
    });

    // 计算颜色比例尺（深色主题适配）
    const counts = Array.from(countryMap.values()).map((d) => d.count);
    const maxCount = d3.max(counts) || 1;
    // 使用更亮的颜色方案，从深蓝到亮黄
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain([0, maxCount]);

    // 创建工具提示（使用全局选择器，避免类型问题）
    if (!tooltipRef.current) {
      const tooltipDiv = d3
        .select('body')
        .append('div')
        .attr('class', 'geo-map-tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'rgba(0, 0, 0, 0.85)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('pointer-events', 'none')
        .style('font-size', '12px')
        .style('z-index', '9999')
        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.3)')
        .style('white-space', 'nowrap');

      tooltipRef.current = tooltipDiv.node() as HTMLDivElement;
    }

    // 绘制国家
    const countries = svg
      .append('g')
      .attr('class', 'countries')
      .selectAll('path')
      .data(worldMapData.features)
      .enter()
      .append('path')
      .attr('d', path as any)
      .attr('fill', (d: any) => {
        const props = d.properties || {};
        // 优先使用 ISO_A3 字段（如果存在），否则使用 NAME 或 NAME_LONG 转换
        let iso = props.ISO_A3 || '';
        if (!iso) {
          const countryName = props.NAME || props.NAME_LONG || props.name || '';
          iso = getNameToISO(countryName);
        }
        const data = countryMap.get(iso);
        if (data) {
          return colorScale(data.count);
        }
        return '#2a2a3e'; // 默认深灰色（无数据）
      })
      .attr('stroke', 'rgba(255, 255, 255, 0.2)')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .attr('class', (d: any) => {
        const props = d.properties || {};
        // 优先使用 ISO_A3 字段（如果存在），否则使用 NAME 或 NAME_LONG 转换
        let iso = props.ISO_A3 || '';
        if (!iso) {
          const countryName = props.NAME || props.NAME_LONG || props.name || '';
          iso = getNameToISO(countryName);
        }
        const data = countryMap.get(iso);
        return data ? 'country-with-data' : 'country-no-data';
      })
      .on('mouseover', function (event, d: any) {
        event.stopPropagation();
        const props = d.properties || {};
        // 优先使用 ISO_A3 字段（如果存在），否则使用 NAME 或 NAME_LONG 转换
        let iso = props.ISO_A3 || '';
        if (!iso) {
          const countryName = props.NAME || props.NAME_LONG || props.name || '';
          iso = getNameToISO(countryName);
        }
        const countryName = props.NAME || props.NAME_LONG || props.name || '';
        const data = countryMap.get(iso);
        const displayName = countryName || isoToCountryName[iso] || '未知国家';

        d3.select(this).attr('stroke', '#1890ff').attr('stroke-width', 2);

        const tooltipElement = d3.select('.geo-map-tooltip');
        if (!tooltipElement.empty()) {
          if (data) {
            tooltipElement
              .html(
                `<strong>${displayName}</strong><br/>论文数量: ${data.count}<br/>ISO: ${iso || 'N/A'}`,
              )
              .style('visibility', 'visible')
              .style('left', event.pageX + 10 + 'px')
              .style('top', event.pageY - 10 + 'px');
          } else {
            tooltipElement
              .html(`<strong>${displayName}</strong><br/>暂无数据`)
              .style('visibility', 'visible')
              .style('left', event.pageX + 10 + 'px')
              .style('top', event.pageY - 10 + 'px');
          }
        }
      })
      .on('mousemove', function (event) {
        event.stopPropagation();
        const tooltipElement = d3.select('.geo-map-tooltip');
        if (!tooltipElement.empty()) {
          tooltipElement
            .style('left', event.pageX + 10 + 'px')
            .style('top', event.pageY - 10 + 'px');
        }
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke', 'rgba(255, 255, 255, 0.2)').attr('stroke-width', 0.5);
        const tooltipElement = d3.select('.geo-map-tooltip');
        if (!tooltipElement.empty()) {
          tooltipElement.style('visibility', 'hidden');
        }
      })
      .on('click', function (event, d: any) {
        event.stopPropagation();
        const props = d.properties || {};
        // 优先使用 ISO_A3 字段（如果存在），否则使用 NAME 或 NAME_LONG 转换
        let iso = props.ISO_A3 || '';
        if (!iso) {
          const countryName = props.NAME || props.NAME_LONG || props.name || '';
          iso = getNameToISO(countryName);
        }
        const countryName = props.NAME || props.NAME_LONG || props.name || '';
        const data = countryMap.get(iso);
        const displayName = countryName || isoToCountryName[iso] || '未知国家';

        // 优先使用countryMap中的数据（如果有），这是最准确的
        let actualCountryName = data?.country;
        
        // 如果countryMap中没有数据（可能因为筛选条件导致），尝试通过ISO代码查找
        if (!actualCountryName && iso) {
          // 尝试通过ISO代码反向查找：检查所有countryData，看哪个的ISO代码匹配
          const allCountryData = aggregateByCountry(papers);
          for (const countryData of allCountryData) {
            const countryISO = getCountryISO(countryData.country);
            if (countryISO === iso) {
              actualCountryName = countryData.country;
              break;
            }
          }
          
          // 如果还是找不到，尝试通过ISO代码的常见映射查找
          if (!actualCountryName) {
            // 常见ISO代码到数据中实际使用的国家名称的映射
            const isoToDataName: Record<string, string> = {
              'USA': 'USA',
              'CHN': 'China',
              'GBR': 'United Kingdom',
              'DEU': 'Germany',
              'FRA': 'France',
              'JPN': 'Japan',
              'CAN': 'Canada',
              'ITA': 'Italy',
              'ESP': 'Spain',
              'IND': 'India',
              'AUS': 'Australia',
              'KOR': 'South Korea',
              'NLD': 'Netherlands',
              'CHE': 'Switzerland',
              'SWE': 'Sweden',
              'SGP': 'Singapore',
              'ISR': 'Israel',
              'BRA': 'Brazil',
              'RUS': 'Russia',
            };
            
            const mappedName = isoToDataName[iso];
            if (mappedName) {
              // 验证这个名称是否在数据中存在
              const found = allCountryData.find(cd => 
                cd.country.toLowerCase() === mappedName.toLowerCase()
              );
              if (found) {
                actualCountryName = found.country; // 使用数据中的实际格式
              } else {
                // 如果找不到，直接使用映射名称（可能数据中还没有这个国家）
                actualCountryName = mappedName;
              }
            }
          }
        }
        
        // 如果还是找不到，使用显示名称
        if (!actualCountryName) {
          actualCountryName = displayName;
        }

        // 调试信息
        console.log('点击地图:', {
          iso,
          countryName,
          displayName,
          hasData: !!data,
          dataCountry: data?.country,
          actualCountryName,
        });

        // 即使没有数据也显示卡片（可能筛选后没有数据）
        // 获取点击位置
        const container = containerRef.current;
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        const clickX = event.clientX - containerRect.left;
        const clickY = event.clientY - containerRect.top;
        
        // 显示机构卡片（使用数据中的实际国家名称）
        setInstitutionCard({
          country: actualCountryName, // 使用数据中的实际国家名称
          countryName: displayName, // 显示用的名称
          x: clickX,
          y: clickY,
        });
        
        // 同时更新筛选（保持原有功能）
        if (data) {
          if (selectedCountry === iso) {
            setSelectedCountry(null);
            onFilterChange({ ...filter, countries: undefined });
          } else {
            setSelectedCountry(iso);
            onFilterChange({ ...filter, countries: [displayName] });
          }
        }
      });

    // 高亮选中的国家
    if (selectedCountry) {
      svg
        .selectAll('.country-with-data')
        .filter((d: any) => {
          const props = d.properties || {};
          // 优先使用 ISO_A3 字段（如果存在），否则使用 NAME 或 NAME_LONG 转换
          let iso = props.ISO_A3 || '';
          if (!iso) {
            const countryName = props.NAME || props.NAME_LONG || props.name || '';
            iso = getNameToISO(countryName);
          }
          return iso === selectedCountry;
        })
        .attr('stroke', '#1890ff')
        .attr('stroke-width', 3);
    }

    // 添加图例
    const legendWidth = 200;
    const legendHeight = 20;
    const legendX = width - legendWidth - 20;
    const legendY = 20;

    const legend = svg
      .append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendX}, ${legendY})`);

    // 图例标题
    legend
      .append('text')
      .attr('x', legendWidth / 2)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#e8f4f8')
      .text('论文数量');

    // 渐变定义
    const gradientId = 'color-gradient';
    const gradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
      gradient
        .append('stop')
        .attr('offset', `${(i / numStops) * 100}%`)
        .attr('stop-color', colorScale((maxCount * i) / numStops));
    }

    // 绘制渐变条
    legend
      .append('rect')
      .attr('x', 0)
      .attr('y', 10)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', `url(#${gradientId})`)
      .attr('stroke', 'rgba(255, 255, 255, 0.3)')
      .attr('stroke-width', 1);

    // 图例刻度
    const legendScale = d3.scaleLinear().domain([0, maxCount]).range([0, legendWidth]);
    const legendAxis = d3.axisBottom(legendScale).ticks(5).tickFormat(d3.format(',.0f'));

    legend
      .append('g')
      .attr('class', 'legend-axis')
      .attr('transform', `translate(0, ${10 + legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .style('font-size', '10px');
  }, [papers, filter, worldMapData, selectedCountry, onFilterChange]);

  // 当地图数据或论文数据变化时重绘
  useEffect(() => {
    drawMap();
  }, [drawMap]);

  // 当筛选条件变化时，更新选中状态
  useEffect(() => {
    if (!filter.countries || filter.countries.length === 0) {
      setSelectedCountry(null);
    }
  }, [filter.countries]);

  // 点击外部区域关闭卡片
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (institutionCard) {
          setInstitutionCard(null);
        }
        if (institutionScholars) {
          setInstitutionScholars(null);
        }
        if (scholarCard) {
          setScholarCard(null);
        }
      }
    };

    if (institutionCard || institutionScholars || scholarCard) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [institutionCard, institutionScholars, scholarCard]);

  // 获取作者信息（复用作者合作网络的逻辑）
  const getAuthorInfo = useCallback((authorId: string, papersList: Paper[]): {
    country?: string;
    affiliations: string[];
  } => {
    const affiliationsSet = new Set<string>();
    let country: string | undefined;

    papersList.forEach((paper) => {
      const author = paper.authors.find((a) => a.id === authorId);
      if (author) {
        if (author.affiliations && author.affiliations.length > 0) {
          author.affiliations.forEach((aff) => {
            if (aff && aff.trim()) {
              affiliationsSet.add(aff.trim());
            }
          });
        }
        if (!country && author.country) {
          country = author.country;
        }
      }
    });

    return {
      country,
      affiliations: Array.from(affiliationsSet),
    };
  }, []);

  const getAuthorPapers = useCallback((authorId: string, papersList: Paper[]): Paper[] => {
    return papersList.filter((paper) =>
      paper.authors.some((author) => author.id === authorId),
    );
  }, []);

  // 应用筛选条件
  const applyFilter = useCallback((papersList: Paper[], filterCondition: FilterCondition): Paper[] => {
    let filtered = papersList;

    if (filterCondition.countries && filterCondition.countries.length > 0) {
      filtered = filtered.filter((paper) => filterCondition.countries!.includes(paper.country || ''));
    }

    if (filterCondition.venues && filterCondition.venues.length > 0) {
      filtered = filtered.filter((paper) => filterCondition.venues!.includes(paper.venue.name));
    }

    if (filterCondition.years) {
      filtered = filtered.filter(
        (paper) => paper.year >= filterCondition.years![0] && paper.year <= filterCondition.years![1],
      );
    }

    if (filterCondition.keywords && filterCondition.keywords.length > 0) {
      const filterKeywordsLower = filterCondition.keywords.map(k => k.toLowerCase().trim());
      filtered = filtered.filter((paper) =>
        paper.keywords && paper.keywords.length > 0 &&
        paper.keywords.some((keyword) => {
          const keywordLower = keyword.toLowerCase().trim();
          return filterKeywordsLower.includes(keywordLower);
        }),
      );
    }

    if (filterCondition.authors && filterCondition.authors.length > 0) {
      filtered = filtered.filter((paper) =>
        paper.authors.some((author) => filterCondition.authors!.includes(author.id)),
      );
    }

    return filtered;
  }, []);

  // 渲染机构卡片
  const renderInstitutionCard = () => {
    if (!institutionCard) return null;

    const { country, countryName, x, y } = institutionCard;
    // 先应用筛选条件，然后统计该国家的机构
    // 使用 country（数据中的实际国家名称，如"USA"）而不是 countryName（显示名称）
    const filteredPapers = applyFilter(papers, filter);
    const institutions = getTopInstitutionsByCountry(filteredPapers, country, 5);
    
    // 调试信息
    console.log('机构卡片数据:', {
      country,
      countryName,
      filteredPapersCount: filteredPapers.length,
      institutionsCount: institutions.length,
      institutions: institutions.map(i => ({ name: i.name, count: i.count })),
      cardPosition: { x, y }
    });

    const container = containerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const cardWidth = 350;
    const cardHeight = Math.min(400, 100 + institutions.length * 60);
    const padding = 15;

    let cardLeft = x + padding;
    let cardTop = y - padding;

    if (cardLeft + cardWidth > containerRect.width) {
      cardLeft = x - cardWidth - padding;
    }
    if (cardTop + cardHeight > containerRect.height) {
      cardTop = y - cardHeight - padding;
    }

    cardLeft = Math.max(padding, Math.min(cardLeft, containerRect.width - cardWidth - padding));
    cardTop = Math.max(padding, Math.min(cardTop, containerRect.height - cardHeight - padding));

    return (
      <div
        className="institution-card"
        style={{
          position: 'absolute',
          left: `${cardLeft}px`,
          top: `${cardTop}px`,
          width: `${cardWidth}px`,
          maxHeight: `${cardHeight}px`,
          background: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 1001,
          overflowY: 'auto',
          lineHeight: '1.6',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>
            {countryName} - Top 5 机构
          </div>
          <button
            onClick={() => setInstitutionCard(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 8px',
            }}
          >
            ×
          </button>
        </div>
        {institutions.length === 0 ? (
          <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
            暂无机构数据
          </div>
        ) : (
          <div>
            {institutions.map((institution, index) => (
              <div
                key={institution.name}
                style={{
                  marginBottom: '12px',
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff', marginBottom: '4px' }}>
                  {index + 1}. {institution.name}
                </div>
                <div style={{ fontSize: '11px', color: '#aaa' }}>
                  {institution.count} 篇论文
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 渲染机构学者列表卡片
  const renderInstitutionScholars = () => {
    if (!institutionScholars) return null;

    const { institution, scholars, x, y } = institutionScholars;
    const filteredPapers = applyFilter(papers, filter);

    const container = containerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const cardWidth = 320;
    const cardHeight = Math.min(400, 80 + scholars.length * 55);
    const padding = 15;

    let cardLeft = x + padding;
    let cardTop = y - padding;

    if (cardLeft + cardWidth > containerRect.width) {
      cardLeft = x - cardWidth - padding;
    }
    if (cardTop + cardHeight > containerRect.height) {
      cardTop = y - cardHeight - padding;
    }

    cardLeft = Math.max(padding, Math.min(cardLeft, containerRect.width - cardWidth - padding));
    cardTop = Math.max(padding, Math.min(cardTop, containerRect.height - cardHeight - padding));

    return (
      <div
        className="institution-scholars-card"
        style={{
          position: 'absolute',
          left: `${cardLeft}px`,
          top: `${cardTop}px`,
          width: `${cardWidth}px`,
          maxHeight: `${cardHeight}px`,
          background: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 1001,
          overflowY: 'auto',
          lineHeight: '1.6',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
            {institution} - Top 5 学者
          </div>
          <button
            onClick={() => setInstitutionScholars(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 8px',
            }}
          >
            ×
          </button>
        </div>
        {scholars.length === 0 ? (
          <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
            暂无学者数据
          </div>
        ) : (
          <div>
            {scholars.map((scholar, index) => (
              <div
                key={scholar.id}
                style={{
                  marginBottom: '10px',
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
                onClick={() => {
                  const container = containerRef.current;
                  if (!container) return;
                  const containerRect = container.getBoundingClientRect();
                  const cardX = cardLeft + cardWidth + 20;
                  const cardY = cardTop + 60 + index * 55;
                  
                  setScholarCard({
                    authorId: scholar.id,
                    authorName: scholar.name,
                    x: cardX,
                    y: cardY,
                  });
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#fff', marginBottom: '4px' }}>
                      {index + 1}. {scholar.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#aaa' }}>
                      {scholar.count} 篇论文
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#87ceeb' }}>→</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 渲染学者卡片（复用作者合作网络的卡片逻辑）
  const renderScholarCard = () => {
    if (!scholarCard || !scholarCard.authorId) return null;

    const { authorId, authorName, x, y } = scholarCard;
    const filteredPapers = applyFilter(papers, filter);
    const authorInfo = getAuthorInfo(authorId, filteredPapers);
    const authorPapers = getAuthorPapers(authorId, filteredPapers);
    const MAX_PAPERS_TO_SHOW = 10;

    const container = containerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const cardWidth = 450;
    const cardHeight = 500;
    const padding = 15;

    let cardLeft = x + padding;
    let cardTop = y - padding;

    if (cardLeft + cardWidth > containerRect.width) {
      cardLeft = x - cardWidth - padding;
    }
    if (cardTop + cardHeight > containerRect.height) {
      cardTop = y - cardHeight - padding;
    }

    cardLeft = Math.max(padding, Math.min(cardLeft, containerRect.width - cardWidth - padding));
    cardTop = Math.max(padding, Math.min(cardTop, containerRect.height - cardHeight - padding));

    const sortedPapers = [...authorPapers].sort((a, b) => (b.year || 0) - (a.year || 0));
    const papersToShow = sortedPapers.slice(0, MAX_PAPERS_TO_SHOW);

    let authorInfoHtml = null;
    if (authorInfo.country || authorInfo.affiliations.length > 0) {
      authorInfoHtml = (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          {authorInfo.country && (
            <div style={{ fontSize: '11px', color: '#e0e0e0', marginBottom: '4px' }}>
              <span style={{ color: '#87ceeb' }}>国家:</span> {authorInfo.country}
            </div>
          )}
          {authorInfo.affiliations.length > 0 && (
            <div style={{ fontSize: '11px', color: '#e0e0e0', marginBottom: '4px' }}>
              <span style={{ color: '#87ceeb' }}>机构:</span>{' '}
              {authorInfo.affiliations.slice(0, 3).join('; ')}
              {authorInfo.affiliations.length > 3 &&
                ` (还有 ${authorInfo.affiliations.length - 3} 个机构...)`}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className="scholar-card"
        style={{
          position: 'absolute',
          left: `${cardLeft}px`,
          top: `${cardTop}px`,
          width: `${cardWidth}px`,
          maxHeight: `${cardHeight}px`,
          background: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '10px 14px',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 1001,
          overflowY: 'auto',
          lineHeight: '1.6',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
            {authorName}
          </div>
          <button
            onClick={() => setScholarCard(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 8px',
            }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: '12px', color: '#e0e0e0', marginBottom: '4px' }}>
          <span style={{ color: '#87ceeb' }}>论文数:</span> {authorPapers.length}
        </div>
        {authorInfoHtml}
        {authorPapers.length > 0 && (
          <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '11px', color: '#87ceeb' }}>
              发表的论文:
            </div>
            <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
              {papersToShow.map((paper, index) => {
                const title = paper.title || '无标题';
                const year = paper.year || '未知年份';
                const venue = paper.venue?.name || '';
                const displayTitle = title.length > 60 ? title.substring(0, 60) + '...' : title;
                const paperUrl = paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : '');

                return (
                  <div
                    key={paper.id}
                    style={{
                      marginBottom: '6px',
                      fontSize: '11px',
                      lineHeight: '1.5',
                      paddingLeft: '4px',
                    }}
                  >
                    <span style={{ color: '#87ceeb', fontWeight: 500 }}>{index + 1}.</span>{' '}
                    {paperUrl ? (
                      <a
                        href={paperUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#87ceeb',
                          textDecoration: 'none',
                          cursor: 'pointer',
                          borderBottom: '1px dotted #87ceeb',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#5dade2';
                          e.currentTarget.style.borderBottomColor = '#5dade2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#87ceeb';
                          e.currentTarget.style.borderBottomColor = '#87ceeb';
                        }}
                      >
                        {displayTitle}
                      </a>
                    ) : (
                      <span style={{ color: '#fff' }}>{displayTitle}</span>
                    )}
                    <br />
                    <span style={{ color: '#aaa', fontSize: '10px', marginLeft: '16px' }}>
                      {year}
                      {venue ? ` · ${venue}` : ''}
                    </span>
                  </div>
                );
              })}
              {authorPapers.length > MAX_PAPERS_TO_SHOW && (
                <div
                  style={{
                    marginTop: '6px',
                    paddingTop: '6px',
                    borderTop: '1px solid rgba(255,255,255,0.2)',
                    fontSize: '10px',
                    color: '#aaa',
                    fontStyle: 'italic',
                    textAlign: 'center',
                  }}
                >
                  还有 {authorPapers.length - MAX_PAPERS_TO_SHOW} 篇论文未显示...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="geo-map-container" style={{ width: '100%', height: '500px', position: 'relative' }}>
      {!worldMapData && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#999',
          }}
        >
          加载地图数据中...
        </div>
      )}
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
      {renderInstitutionCard()}
      {renderInstitutionScholars()}
      {renderScholarCard()}
    </div>
  );
};

export default GeoMap;
