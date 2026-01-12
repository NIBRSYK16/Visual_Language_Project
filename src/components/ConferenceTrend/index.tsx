/**
 * 顶会趋势分析组件
 * 展示不同会议在不同年份的论文数量趋势
 */

import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { Paper, FilterCondition } from '@/types';
import { applyFilter } from '@/services/dataProcessor';
import './index.less';

interface ConferenceTrendProps {
  papers: Paper[];
  filter: FilterCondition;
}

interface ConferenceYearData {
  year: number;
  [venue: string]: number | string; // venue name -> count
}

const ConferenceTrend: React.FC<ConferenceTrendProps> = ({ papers, filter }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // 绘制趋势图
  const drawTrend = useCallback(() => {
    if (!svgRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = Math.min(width * 0.7, 500);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    // 应用筛选条件
    const filteredPapers = applyFilter(papers, filter);

    if (filteredPapers.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('fill', '#999')
        .text('暂无数据');
      return;
    }

    // 获取所有年份和会议
    const years = Array.from(new Set(filteredPapers.map((p) => p.year).filter((y) => y && y > 0))).sort((a, b) => a - b);
    const venues = Array.from(new Set(filteredPapers.map((p) => p.venue.name))).sort();

    if (years.length === 0 || venues.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('fill', '#999')
        .text('暂无有效数据');
      return;
    }

    // 按年份和会议统计
    const dataByYear: Map<number, Map<string, number>> = new Map();
    years.forEach((year) => {
      dataByYear.set(year, new Map());
      venues.forEach((venue) => {
        dataByYear.get(year)!.set(venue, 0);
      });
    });

    filteredPapers.forEach((paper) => {
      const year = paper.year;
      const venue = paper.venue.name;
      if (year && dataByYear.has(year)) {
        const count = dataByYear.get(year)!.get(venue) || 0;
        dataByYear.get(year)!.set(venue, count + 1);
      }
    });

    // 转换为数组格式
    const data: ConferenceYearData[] = years.map((year) => {
      const yearData: ConferenceYearData = { year };
      venues.forEach((venue) => {
        yearData[venue] = dataByYear.get(year)!.get(venue) || 0;
      });
      return yearData;
    });

    // 设置边距
    const margin = { top: 20, right: 120, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // 创建比例尺
    const xScale = d3.scaleLinear().domain(d3.extent(years) as [number, number]).range([0, chartWidth]).nice();
    const maxCount = d3.max(data, (d) => {
      return venues.reduce((sum, venue) => sum + (d[venue] as number), 0);
    }) || 1;
    const yScale = d3.scaleLinear().domain([0, maxCount]).range([chartHeight, 0]).nice();

    // 创建颜色比例尺
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(venues);

    // 创建堆叠数据（堆叠面积图）
    const stack = d3.stack<any>().keys(venues).order(d3.stackOrderNone).offset(d3.stackOffsetNone);
    const stackedData = stack(data);

    // 创建面积生成器
    const area = d3
      .area<any>()
      .x((d) => xScale(d.data.year))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveMonotoneX);

    // 创建线生成器（用于绘制边界线）
    const line = d3
      .line<any>()
      .x((d) => xScale(d.data.year))
      .y((d) => yScale(d[1]))
      .curve(d3.curveMonotoneX);

    // 创建或获取工具提示
    let tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    const existingTooltip = d3.select('.conference-trend-tooltip');
    if (existingTooltip.empty()) {
      tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'conference-trend-tooltip')
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

    // 绘制堆叠面积
    const areas = g
      .selectAll('.area')
      .data(stackedData)
      .enter()
      .append('path')
      .attr('class', 'area')
      .attr('d', area as any)
      .attr('fill', (d) => colorScale(d.key) as string)
      .attr('opacity', 0.6)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8);
        // 计算该层的总数
        const total = d.reduce((sum, point) => sum + (point[1] - point[0]), 0);
        tooltip
          .html(`<strong>${d.key}</strong><br/>总论文数: ${total.toFixed(0)}`)
          .style('visibility', 'visible')
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 10 + 'px');
      })
      .on('mousemove', function (event) {
        tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 10 + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.6);
        tooltip.style('visibility', 'hidden');
      });

    // 绘制边界线
    const lines = g
      .selectAll('.line')
      .data(stackedData)
      .enter()
      .append('path')
      .attr('class', 'line')
      .attr('d', line as any)
      .attr('fill', 'none')
      .attr('stroke', (d) => colorScale(d.key) as string)
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke-width', 3);
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke-width', 2);
      });

    // 绘制X轴
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.format('d'));
    g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '11px')
      .style('fill', '#666');

    g.append('text')
      .attr('transform', `translate(${chartWidth / 2}, ${chartHeight + 35})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text('年份');

    // 绘制Y轴
    const yAxis = d3.axisLeft(yScale);
    g.append('g').call(yAxis).selectAll('text').style('font-size', '11px').style('fill', '#666');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -chartHeight / 2)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text('论文数量');

    // 绘制图例
    const legend = g
      .append('g')
      .attr('transform', `translate(${chartWidth + 10}, 20)`);

    venues.forEach((venue, index) => {
      const legendItem = legend
        .append('g')
        .attr('transform', `translate(0, ${index * 20})`)
        .style('cursor', 'pointer');

      legendItem
        .append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', colorScale(venue) as string)
        .attr('opacity', 0.6);

      legendItem
        .append('text')
        .attr('x', 20)
        .attr('y', 12)
        .style('font-size', '11px')
        .style('fill', '#333')
        .text(venue);
    });
  }, [papers, filter]);

  useEffect(() => {
    drawTrend();
  }, [drawTrend]);

  return (
    <div ref={containerRef} className="conference-trend-container" style={{ width: '100%', height: '500px' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default ConferenceTrend;
