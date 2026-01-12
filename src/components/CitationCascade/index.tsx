/**
 * 文献引用瀑布组件
 * 展示文献之间的引用关系，使用时间轴布局
 */

import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { Paper, FilterCondition } from '@/types';
import { applyFilter } from '@/services/dataProcessor';
import './index.less';

interface CitationCascadeProps {
  papers: Paper[];
  filter: FilterCondition;
}

const CitationCascade: React.FC<CitationCascadeProps> = ({ papers, filter }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // 绘制引用瀑布图（时间轴布局）
  const drawCascade = useCallback(() => {
    if (!svgRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = Math.min(width * 1.2, 700);

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

    // 设置边距
    const margin = { top: 40, right: 150, bottom: 60, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // 按年份分组
    const papersByYear = new Map<number, Paper[]>();
    filteredPapers.forEach((paper) => {
      if (paper.year) {
        if (!papersByYear.has(paper.year)) {
          papersByYear.set(paper.year, []);
        }
        papersByYear.get(paper.year)!.push(paper);
      }
    });

    const years = Array.from(papersByYear.keys()).sort((a, b) => a - b);

    if (years.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('fill', '#999')
        .text('暂无有效年份数据');
      return;
    }

    // 创建年份比例尺
    const yearScale = d3.scaleBand().domain(years.map(String)).range([0, chartHeight]).padding(0.3);

    // 创建论文映射
    const paperMap = new Map<string, Paper>();
    filteredPapers.forEach((paper) => {
      paperMap.set(paper.id, paper);
    });

    // 构建引用关系（只包含在当前数据中的引用）
    const links: Array<{ source: Paper; target: Paper }> = [];
    filteredPapers.forEach((paper) => {
      paper.references.forEach((refId) => {
        const referencedPaper = paperMap.get(refId);
        if (referencedPaper && referencedPaper.year && paper.year && referencedPaper.year < paper.year) {
          links.push({ source: referencedPaper, target: paper });
        }
      });
    });

    // 创建或获取工具提示
    let tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    const existingTooltip = d3.select('.citation-cascade-tooltip');
    if (existingTooltip.empty()) {
      tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'citation-cascade-tooltip')
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
        .style('max-width', '300px');
      tooltipRef.current = tooltip.node() as HTMLDivElement;
    } else {
      tooltip = existingTooltip as d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
      tooltipRef.current = tooltip.node() as HTMLDivElement;
    }

    // 绘制连接线（引用关系）
    const linkGroup = g.append('g').attr('class', 'links');
    linkGroup
      .selectAll('.link')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', (d) => {
        const sourceYear = d.source.year!;
        const targetYear = d.target.year!;
        const sourceY = yearScale(String(sourceYear))! + yearScale.bandwidth() / 2;
        const targetY = yearScale(String(targetYear))! + yearScale.bandwidth() / 2;

        // 在年份内找到论文的x位置（简化：假设论文在年份带的中间）
        const sourceX = chartWidth * 0.3;
        const targetX = chartWidth * 0.3;

        // 使用曲线路径
        return `M ${sourceX} ${sourceY} C ${sourceX + 50} ${sourceY}, ${targetX + 50} ${targetY}, ${targetX} ${targetY}`;
      })
      .attr('stroke', '#999')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4)
      .attr('fill', 'none');

    // 为每个年份绘制论文节点
    years.forEach((year) => {
      const yearPapers = papersByYear.get(year)!;
      const yearY = yearScale(String(year))!;
      const yearHeight = yearScale.bandwidth();

      // 在年份带内均匀分布论文
      const paperCount = yearPapers.length;
      const paperSpacing = Math.min(yearHeight / (paperCount + 1), 15);
      const startY = yearY + (yearHeight - paperSpacing * (paperCount - 1)) / 2;

      yearPapers.forEach((paper, index) => {
        const paperY = startY + index * paperSpacing;
        const paperX = chartWidth * 0.3;

        // 绘制节点圆圈
        const nodeGroup = g
          .append('g')
          .attr('class', 'node')
          .attr('transform', `translate(${paperX},${paperY})`)
          .style('cursor', 'pointer');

        nodeGroup
          .append('circle')
          .attr('r', 6)
          .attr('fill', '#1890ff')
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .on('mouseover', function (event) {
            d3.select(this).attr('r', 8);
            const title = paper.title.length > 50 ? paper.title.substring(0, 50) + '...' : paper.title;
            tooltip
              .html(
                `<strong>${title}</strong><br/>年份: ${paper.year}<br/>引用数: ${paper.citations}<br/>作者数: ${paper.authors.length}`,
              )
              .style('visibility', 'visible')
              .style('left', event.pageX + 10 + 'px')
              .style('top', event.pageY - 10 + 'px');
          })
          .on('mousemove', function (event) {
            tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 10 + 'px');
          })
          .on('mouseout', function () {
            d3.select(this).attr('r', 6);
            tooltip.style('visibility', 'hidden');
          });

        // 绘制论文标题标签
        nodeGroup
          .append('text')
          .attr('x', 12)
          .attr('y', 4)
          .style('font-size', '10px')
          .style('fill', '#333')
          .text(paper.title.length > 30 ? paper.title.substring(0, 30) + '...' : paper.title)
          .style('pointer-events', 'none');
      });
    });

    // 绘制年份轴（Y轴）
    const yearAxis = g
      .append('g')
      .attr('class', 'year-axis')
      .call(d3.axisLeft(yearScale).tickFormat((d) => d + '年'))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#666');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -60)
      .attr('x', -chartHeight / 2)
      .style('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text('年份');

    // 绘制统计信息（右侧）
    const statsGroup = g.append('g').attr('class', 'stats').attr('transform', `translate(${chartWidth * 0.5 + 20}, 0)`);

    statsGroup
      .append('text')
      .attr('y', -10)
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text('统计信息');

    let statsY = 20;
    statsGroup
      .append('text')
      .attr('y', statsY)
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(`总论文数: ${filteredPapers.length}`);

    statsY += 20;
    statsGroup
      .append('text')
      .attr('y', statsY)
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(`引用关系数: ${links.length}`);

    statsY += 20;
    statsGroup
      .append('text')
      .attr('y', statsY)
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(`年份范围: ${years[0]} - ${years[years.length - 1]}`);

    // 添加标题
    g.append('text')
      .attr('x', chartWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text('文献引用关系时间轴');
  }, [papers, filter]);

  useEffect(() => {
    drawCascade();
  }, [drawCascade]);

  return (
    <div ref={containerRef} className="citation-cascade-container" style={{ width: '100%', height: '700px' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default CitationCascade;
