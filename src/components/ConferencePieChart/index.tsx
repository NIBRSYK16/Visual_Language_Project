/**
 * 会议占比饼图组件
 * 展示不同会议在论文总数中的占比
 */

import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { Paper, FilterCondition } from '@/types';
import { applyFilter } from '@/services/dataProcessor';
import './index.less';

interface ConferencePieChartProps {
  papers: Paper[];
  filter: FilterCondition;
}

interface ConferenceData {
  name: string;
  count: number;
  percentage: number;
}

const ConferencePieChart: React.FC<ConferencePieChartProps> = ({ papers, filter }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // 获取会议数据
  const getConferenceData = useCallback((): ConferenceData[] => {
    const filteredPapers = applyFilter(papers, filter);
    const venueMap = new Map<string, number>();

    filteredPapers.forEach((paper) => {
      const venueName = paper.venue?.name || 'Unknown';
      venueMap.set(venueName, (venueMap.get(venueName) || 0) + 1);
    });

    const total = filteredPapers.length;
    if (total === 0) return [];

    return Array.from(venueMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }, [papers, filter]);

  // 创建或获取工具提示
  const getTooltip = useCallback(() => {
    let tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    const existingTooltip = d3.select('.conference-pie-tooltip');
    if (existingTooltip.empty()) {
      tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'conference-pie-tooltip')
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

  // 绘制饼图
  const drawChart = useCallback(() => {
    if (!svgRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;
    // 减小半径，留出更多空间给图例和标签
    const radius = Math.min(width, height) / 2 - 80;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const data = getConferenceData();

    if (data.length === 0) {
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

    // 创建饼图生成器
    const pie = d3
      .pie<ConferenceData>()
      .value((d) => d.count)
      .sort(null);

    // 创建弧生成器
    const arc = d3
      .arc<d3.PieArcDatum<ConferenceData>>()
      .innerRadius(0)
      .outerRadius(radius);

    // 创建标签弧（用于放置标签）
    const labelArc = d3
      .arc<d3.PieArcDatum<ConferenceData>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius * 0.6);

    // 创建颜色比例尺
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(data.map((d) => d.name));

    // 创建SVG组
    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    const tooltip = getTooltip();

    // 绘制饼图
    const arcs = g.selectAll<SVGPathElement, d3.PieArcDatum<ConferenceData>>('.arc').data(pie(data));

    arcs
      .enter()
      .append('path')
      .attr('class', 'arc')
      .attr('d', arc)
      .attr('fill', (d) => colorScale(d.data.name) as string)
      .attr('stroke', 'rgba(255, 255, 255, 0.2)')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8).attr('stroke-width', 3);
        tooltip
          .html(
            `<strong>${d.data.name}</strong><br/>论文数: ${d.data.count}<br/>占比: ${d.data.percentage.toFixed(2)}%`,
          )
          .style('visibility', 'visible')
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 10 + 'px');
      })
      .on('mousemove', function (event) {
        tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 10 + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1).attr('stroke-width', 2);
        tooltip.style('visibility', 'hidden');
      });

    // 绘制标签
    const labels = g
      .selectAll<SVGTextElement, d3.PieArcDatum<ConferenceData>>('.label')
      .data(pie(data));

    labels
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('transform', (d) => {
        const [x, y] = labelArc.centroid(d);
        return `translate(${x}, ${y})`;
      })
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#fff')
      .text((d) => {
        const percentage = d.data.percentage;
        return percentage > 5 ? `${percentage.toFixed(1)}%` : '';
      });

    // 绘制图例（调整位置和大小以适应容器）
    const legendWidth = Math.min(150, width * 0.25);
    const legendX = width - legendWidth - 10;
    const legend = svg
      .append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendX}, 20)`);

    const legendItems = legend
      .selectAll<SVGGElement, ConferenceData>('.legend-item')
      .data(data.slice(0, 8)) // 只显示前8个，减少占用空间
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 18})`);

    legendItems
      .append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('fill', (d) => colorScale(d.name) as string);

    legendItems
      .append('text')
      .attr('x', 15)
      .attr('y', 8)
      .style('font-size', '9px')
      .style('fill', '#fff')
      .text((d) => {
        const text = d.name;
        const maxLength = Math.floor((legendWidth - 15) / 6); // 根据可用宽度动态调整
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
      });

    // 添加中心文本（总数）
    const total = data.reduce((sum, d) => sum + d.count, 0);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-10')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .style('fill', '#fff')
      .text('总计');

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '10')
      .style('font-size', '14px')
      .style('fill', '#aaa')
      .text(`${total} 篇论文`);
  }, [getConferenceData, getTooltip]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  return (
    <div className="conference-pie-chart-container">
      <div ref={containerRef} style={{ width: '100%', height: '500px' }}>
        <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default ConferencePieChart;
