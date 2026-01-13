/**
 * 关键词演化图谱组件
 * 横向柱状图展示关键词排名变化，支持动画播放
 */

import React, { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { Button, Space } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import * as d3 from 'd3';
import { Paper, FilterCondition } from '@/types';
import { applyFilter } from '@/services/dataProcessor';
import './index.less';

interface KeywordEvolutionProps {
  papers: Paper[];
  filter: FilterCondition;
  onPlayStateChange?: (isPlaying: boolean) => void;
  externalYear?: number | null;
  externalIsPlaying?: boolean;
}

export interface KeywordEvolutionRef {
  play: () => void;
  pause: () => void;
  setYear: (year: number | null) => void;
}

interface KeywordData {
  keyword: string;
  count: number;
}

const KeywordEvolution = forwardRef<KeywordEvolutionRef, KeywordEvolutionProps>(
  ({ papers, filter, onPlayStateChange, externalYear, externalIsPlaying }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    play: () => {
      if (!isPlaying) {
        handlePlayPause();
      }
    },
    pause: () => {
      if (isPlaying) {
        handlePlayPause();
      }
    },
    setYear: (year: number | null) => {
      setCurrentYear(year);
    },
  }));

  // 同步外部播放状态
  useEffect(() => {
    if (externalIsPlaying !== undefined) {
      if (externalIsPlaying && !isPlaying) {
        handlePlayPause();
      } else if (!externalIsPlaying && isPlaying) {
        handlePlayPause();
      }
    }
  }, [externalIsPlaying]);

  // 同步外部年份
  useEffect(() => {
    if (externalYear !== undefined && externalYear !== currentYear) {
      setCurrentYear(externalYear);
    }
  }, [externalYear]);

  // 获取年份范围
  const getYearRange = useCallback(() => {
    const filteredPapers = applyFilter(papers, filter);
    const years = filteredPapers
      .map((p) => p.year)
      .filter((y) => y && y > 0)
      .sort((a, b) => a - b);
    if (years.length === 0) return [];
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    return Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  }, [papers, filter]);

  // 获取指定年份的关键词数据
  const getYearData = useCallback(
    (year: number): KeywordData[] => {
      const filteredPapers = applyFilter(papers, filter);
      const yearPapers = filteredPapers.filter((p) => p.year === year);

      const keywordMap = new Map<string, number>();
      yearPapers.forEach((paper) => {
        paper.keywords.forEach((keyword) => {
          const normalized = keyword.toLowerCase().trim();
          if (normalized && normalized.length > 1) {
            keywordMap.set(normalized, (keywordMap.get(normalized) || 0) + 1);
          }
        });
      });

      return Array.from(keywordMap.entries())
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15); // 显示前15个
    },
    [papers, filter],
  );

  // 创建或获取工具提示
  const getTooltip = useCallback(() => {
    let tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    const existingTooltip = d3.select('.keyword-evolution-tooltip');
    if (existingTooltip.empty()) {
      tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'keyword-evolution-tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'rgba(0, 0, 0, 0.85)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('pointer-events', 'none')
        .style('font-size', '12px')
        .style('z-index', '9999')
        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.3)');
      tooltipRef.current = tooltip.node() as HTMLDivElement;
    } else {
      tooltip = existingTooltip as d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
      tooltipRef.current = tooltip.node() as HTMLDivElement;
    }
    return tooltip;
  }, []);

  // 绘制图表
  const drawChart = useCallback(
    (year: number | null) => {
      if (!svgRef.current || !containerRef.current) {
        return;
      }

      const container = containerRef.current;
      const width = container.clientWidth || 800;
      const height = Math.min(width * 0.4, 350); // 更扁的高度

      const svg = d3.select(svgRef.current);

      // 只在初始化时设置尺寸和清空
      if (!isInitializedRef.current) {
        svg.attr('width', width).attr('height', height);
        svg.selectAll('*').remove();
        isInitializedRef.current = true;
      }

      if (year === null) {
        if (svg.select('g.chart-container').empty()) {
          svg
            .append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
          .style('font-size', '16px')
          .style('fill', '#aaa')
          .text('请选择年份或点击播放');
        }
        return;
      }

      const data = getYearData(year);

      if (data.length === 0) {
        svg.selectAll('g.chart-container, text').remove();
        svg
          .append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .style('font-size', '16px')
          .style('fill', '#aaa')
          .text(`${year}年暂无数据`);
        return;
      }

      // 设置边距
      const margin = { top: 20, right: 100, bottom: 40, left: 150 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;

      // 获取或创建图表容器
      let g = svg.select('g.chart-container');
      if (g.empty()) {
        g = svg.append('g').attr('class', 'chart-container').attr('transform', `translate(${margin.left},${margin.top})`);
      }

      // 创建比例尺
      const xScale = d3.scaleLinear().domain([0, d3.max(data, (d) => d.count) || 1]).range([0, chartWidth]).nice();
      
      // 固定显示15个位置，即使数据不足也保持一致的柱子宽度
      const maxItems = 15;
      const displayItems: (KeywordData | null)[] = [];
      for (let i = 0; i < maxItems; i++) {
        if (i < data.length) {
          displayItems.push(data[i]);
        } else {
          displayItems.push(null); // 占位符
        }
      }
      const yDomain = displayItems.map((d, i) => d ? d.keyword : `_placeholder_${i}`);
      const yScale = d3.scaleBand().domain(yDomain).range([0, chartHeight]).padding(0.2);

      // 创建颜色比例尺（固定颜色映射）
      const allKeywords = new Set<string>();
      const years = getYearRange();
      years.forEach((y) => {
        getYearData(y).forEach((d) => allKeywords.add(d.keyword));
      });
      const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(Array.from(allKeywords));

      const tooltip = getTooltip();

      // 绘制柱状图 - 使用 key function 确保平滑过渡（只绘制有数据的项）
      const barsData = displayItems.filter(d => d !== null) as KeywordData[];
      const bars = g
        .selectAll<SVGRectElement, KeywordData>('.bar')
        .data(barsData, (d) => d.keyword);

      bars
        .exit()
        .transition()
        .duration(300)
        .ease(d3.easeCubicInOut)
        .attr('width', 0)
        .attr('y', chartHeight)
        .remove();

        const barsEnter = bars
          .enter()
          .append('rect')
          .attr('class', 'bar')
          .attr('x', 0)
          .attr('y', (d) => yScale(d.keyword)!)
          .attr('width', 0)
          .attr('height', yScale.bandwidth())
          .attr('fill', (d) => colorScale(d.keyword) as string)
          .attr('rx', 4)
          .attr('ry', 4)
          .style('cursor', 'pointer');

      barsEnter
        .merge(bars as any)
        .transition()
        .duration(300)
        .ease(d3.easeCubicInOut)
        .attr('y', (d) => yScale(d.keyword)!)
        .attr('width', (d) => xScale(d.count))
        .attr('fill', (d) => colorScale(d.keyword) as string);

      // 添加交互
      g.selectAll('.bar')
        .on('mouseover', function (event, d: any) {
          d3.select(this).attr('opacity', 0.7);
          tooltip
            .html(`<strong>${d.keyword}</strong><br/>出现次数: ${d.count}`)
            .style('visibility', 'visible')
            .style('left', event.pageX + 10 + 'px')
            .style('top', event.pageY - 10 + 'px');
        })
        .on('mousemove', function (event) {
          tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 10 + 'px');
        })
        .on('mouseout', function () {
          d3.select(this).attr('opacity', 1);
          tooltip.style('visibility', 'hidden');
        });

      // 绘制标签 - 使用 key function（只绘制有数据的项）
      const labelsData = displayItems.filter(d => d !== null) as KeywordData[];
      const labels = g
        .selectAll<SVGTextElement, KeywordData>('.label')
        .data(labelsData, (d) => d.keyword);

      labels.exit().remove();

        const labelsEnter = labels
          .enter()
          .append('text')
          .attr('class', 'label')
          .attr('x', -5)
          .attr('y', (d) => yScale(d.keyword)! + yScale.bandwidth() / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'end')
          .style('font-size', '10px')
          .style('fill', '#fff')
          .text((d) => d.keyword);

        labelsEnter
          .merge(labels as any)
          .transition()
          .duration(300)
          .ease(d3.easeCubicInOut)
          .attr('y', (d) => yScale(d.keyword)! + yScale.bandwidth() / 2);

      // 绘制数值标签（只绘制有数据的项）
      const valueLabelsData = displayItems.filter(d => d !== null) as KeywordData[];
      const valueLabels = g
        .selectAll<SVGTextElement, KeywordData>('.value-label')
        .data(valueLabelsData, (d) => d.keyword);

      valueLabels.exit().remove();

        const valueLabelsEnter = valueLabels
          .enter()
          .append('text')
          .attr('class', 'value-label')
          .attr('x', (d) => xScale(d.count) + 5)
          .attr('y', (d) => yScale(d.keyword)! + yScale.bandwidth() / 2)
          .attr('dy', '0.35em')
          .style('font-size', '9px')
          .style('fill', '#666')
          .text((d) => d.count.toString())
          .attr('opacity', 0);

        valueLabelsEnter
          .merge(valueLabels as any)
          .transition()
          .duration(300)
          .ease(d3.easeCubicInOut)
          .attr('x', (d) => xScale(d.count) + 5)
          .attr('y', (d) => yScale(d.keyword)! + yScale.bandwidth() / 2)
          .attr('opacity', 1)
          .text((d) => d.count.toString());

      // 绘制或更新坐标轴
      let axesGroup = g.select('g.axes-group');
      if (axesGroup.empty()) {
        axesGroup = g.append('g').attr('class', 'axes-group');
      }

      // 更新X轴
      const xAxis = d3.axisBottom(xScale);
      let xAxisGroup = axesGroup.select('g.x-axis');
      if (xAxisGroup.empty()) {
        xAxisGroup = axesGroup.append('g').attr('class', 'x-axis').attr('transform', `translate(0, ${chartHeight})`);
        xAxisGroup.call(xAxis);
        xAxisGroup.selectAll('text').style('font-size', '9px').style('fill', '#aaa');

          axesGroup
            .append('text')
            .attr('class', 'x-axis-label')
            .attr('transform', `translate(${chartWidth / 2}, ${chartHeight + 30})`)
            .style('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('fill', '#aaa')
            .text('出现次数');
        } else {
          xAxisGroup.transition().duration(300).ease(d3.easeCubicInOut).call(xAxis);
      }

      // 更新年份标题
      let yearLabel = g.select('text.year-label');
      if (yearLabel.empty()) {
        yearLabel = g
          .append('text')
          .attr('class', 'year-label')
          .attr('x', chartWidth / 2)
          .attr('y', -5)
          .attr('text-anchor', 'middle')
          .style('font-size', '16px')
          .style('font-weight', 'bold')
          .style('fill', '#fff');
      }
      yearLabel.text(`${year}年`);
    },
    [getYearData, getYearRange, getTooltip],
  );

  // 初始化显示第一个年份
  useEffect(() => {
    const years = getYearRange();
    if (years.length > 0 && currentYear === null && externalYear === undefined) {
      setCurrentYear(years[0]);
      isInitializedRef.current = false; // 重置初始化标志
    }
  }, [getYearRange, currentYear, externalYear]);

  // 绘制图表
  useEffect(() => {
    drawChart(currentYear);
  }, [drawChart, currentYear]);

  // 播放/暂停控制
  const handlePlayPause = () => {
    if (isPlaying) {
      // 暂停
      if (animationTimerRef.current) {
        clearInterval(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      setIsPlaying(false);
      onPlayStateChange?.(false);
    } else {
      // 播放
      const years = getYearRange();
      if (years.length === 0) return;

      let currentIndex = years.indexOf(currentYear || years[0]);
      if (currentIndex === -1) currentIndex = 0;

      setIsPlaying(true);
      onPlayStateChange?.(true);
      animationTimerRef.current = setInterval(() => {
        currentIndex = (currentIndex + 1) % years.length;
        setCurrentYear(years[currentIndex]);
      }, 800); // 每800ms切换一年
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearInterval(animationTimerRef.current);
      }
    };
  }, []);

  const years = getYearRange();

  return (
    <div className="keyword-evolution-container">
      <div className="keyword-evolution-controls" style={{ marginBottom: '16px', textAlign: 'right' }}>
        <Space>
          <Button
            type="primary"
            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={handlePlayPause}
            disabled={years.length === 0}
          >
            {isPlaying ? '暂停' : '播放'}
          </Button>
          {currentYear && (
            <span style={{ fontSize: '14px', color: '#666' }}>
              当前年份: {currentYear}
            </span>
          )}
        </Space>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '350px' }}>
        <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
});

KeywordEvolution.displayName = 'KeywordEvolution';

export default KeywordEvolution;
