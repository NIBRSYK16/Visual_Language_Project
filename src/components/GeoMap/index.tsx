/**
 * 全球科研产出地图组件
 * 使用 D3.js 地理投影实现世界地图可视化
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Paper, FilterCondition, CountryData } from '@/types';
import { aggregateByCountry } from '@/services/dataProcessor';
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

const GeoMap: React.FC<GeoMapProps> = ({ papers, filter, onFilterChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [worldMapData, setWorldMapData] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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
            }
          });

    // 计算颜色比例尺
    const counts = Array.from(countryMap.values()).map((d) => d.count);
    const maxCount = d3.max(counts) || 1;
    const colorScale = d3
      .scaleSequential(d3.interpolateYlOrRd)
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
        // world-atlas 使用 name 字段，需要转换为 ISO 代码
        const countryName = props.name || '';
        const iso = getNameToISO(countryName);
        const data = countryMap.get(iso);
        if (data) {
          return colorScale(data.count);
        }
        return '#e0e0e0'; // 默认灰色（无数据）
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .attr('class', (d: any) => {
        const props = d.properties || {};
        const countryName = props.name || '';
        const iso = getNameToISO(countryName);
        const data = countryMap.get(iso);
        return data ? 'country-with-data' : 'country-no-data';
      })
      .on('mouseover', function (event, d: any) {
        event.stopPropagation();
        const props = d.properties || {};
        const countryName = props.name || '';
        const iso = getNameToISO(countryName);
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
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 0.5);
        const tooltipElement = d3.select('.geo-map-tooltip');
        if (!tooltipElement.empty()) {
          tooltipElement.style('visibility', 'hidden');
        }
      })
      .on('click', function (event, d: any) {
        const props = d.properties || {};
        const countryName = props.name || '';
        const iso = getNameToISO(countryName);
        const data = countryMap.get(iso);
        const displayName = countryName || isoToCountryName[iso] || '未知国家';

        if (data) {
          // 切换选中状态
          if (selectedCountry === iso) {
            // 取消选中
            setSelectedCountry(null);
            onFilterChange({ ...filter, countries: undefined });
          } else {
            // 选中新国家
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
          const countryName = props.name || '';
          const iso = getNameToISO(countryName);
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
      .attr('stroke', '#ccc')
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

  return (
    <div ref={containerRef} className="geo-map-container" style={{ width: '100%', height: '500px' }}>
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
    </div>
  );
};

export default GeoMap;
