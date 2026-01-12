/**
 * 动态交互词云组件
 * 使用 d3-cloud 生成词云图
 */

import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import cloud from 'd3-cloud';
import { Paper, FilterCondition, WordCloudData } from '@/types';
import { extractWordCloudData, applyFilter } from '@/services/dataProcessor';
import './index.less';

interface WordCloudProps {
  papers: Paper[];
  filter: FilterCondition;
  onKeywordClick?: (keyword: string) => void;
}

const WordCloud: React.FC<WordCloudProps> = ({ papers, filter, onKeywordClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // 绘制词云
  const drawWordCloud = useCallback(() => {
    if (!svgRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const filteredPapers = applyFilter(papers, filter);
    const wordData = extractWordCloudData(filteredPapers).slice(0, 50);

           if (wordData.length === 0) {
             svg
               .append('text')
               .attr('x', width / 2)
               .attr('y', height / 2 - 10)
               .attr('text-anchor', 'middle')
               .style('font-size', '16px')
               .style('fill', '#999')
               .text('暂无词云数据');
             svg
               .append('text')
               .attr('x', width / 2)
               .attr('y', height / 2 + 15)
               .attr('text-anchor', 'middle')
               .style('font-size', '12px')
               .style('fill', '#999')
               .text('（当前筛选结果中没有包含关键词的论文）');
             return;
           }

    const maxFrequency = d3.max(wordData, (d) => d.frequency) || 1;
    const minFrequency = d3.min(wordData, (d) => d.frequency) || 0;

    // 字体大小范围调整
    const fontSizeScale = d3
      .scaleLinear()
      .domain([minFrequency, maxFrequency])
      .range([14, 70]);

    // 判断关键词是否被选中
    const isKeywordSelected = (keyword: string): boolean => {
      return filter.keywords?.includes(keyword) || false;
    };

    // 创建或获取工具提示
    if (!tooltipRef.current) {
      const tooltipDiv = d3
        .select('body')
        .append('div')
        .attr('class', 'wordcloud-tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'rgba(0, 0, 0, 0.85)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('pointer-events', 'none')
        .style('font-size', '12px')
        .style('z-index', '1000')
        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.3)');
      tooltipRef.current = tooltipDiv.node() as HTMLDivElement;
    }
    const tooltip = d3.select(tooltipRef.current);

    const layout = cloud()
      .size([width, height])
      .words(
        wordData.map((d, i) => ({
          text: d.word,
          size: fontSizeScale(d.frequency),
          frequency: d.frequency,
          papers: d.papers,
          selected: isKeywordSelected(d.word),
          index: i,
        })),
      )
      .padding(8)
      .rotate(() => {
        // 更多的旋转角度选择，但保持可读性
        const angles = [0, 90];
        return angles[Math.floor(Math.random() * angles.length)];
      })
      .font('Arial, sans-serif')
      .fontWeight('bold')
      .fontSize((d: any) => d.size)
      .on('end', draw);

    layout.start();

    function draw(words: any[]) {
      const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

      // 定义渐变和颜色方案
      const colorSchemes = [
        ['#1890ff', '#096dd9', '#0050b3'], // 蓝色系
        ['#52c41a', '#389e0d', '#237804'], // 绿色系
        ['#fa8c16', '#d46b08', '#ad4e00'], // 橙色系
        ['#eb2f96', '#c41d7f', '#9e1068'], // 粉色系
        ['#722ed1', '#531dab', '#391085'], // 紫色系
        ['#13c2c2', '#08979c', '#006d75'], // 青色系
      ];

      // 为每个词选择颜色
      const getColor = (d: any, isHover: boolean = false): string => {
        if (d.selected) {
          return '#1890ff'; // 选中的关键词使用蓝色
        }
        if (isHover) {
          return '#1890ff'; // 悬停时使用蓝色
        }
        // 根据频率选择颜色方案
        const schemeIndex = Math.floor((d.frequency - minFrequency) / (maxFrequency - minFrequency) * colorSchemes.length);
        const scheme = colorSchemes[Math.min(schemeIndex, colorSchemes.length - 1)];
        // 在同一颜色方案内根据索引选择深浅
        const colorIndex = d.index % scheme.length;
        return scheme[colorIndex];
      };

      g.selectAll('text')
        .data(words)
        .enter()
        .append('text')
        .style('font-size', (d: any) => `${d.size}px`)
        .style('font-family', 'Arial, sans-serif')
        .style('font-weight', 'bold')
        .style('fill', (d: any) => getColor(d))
        .style('stroke', (d: any) => {
          // 为选中的词添加白色描边
          if (d.selected) {
            return '#fff';
          }
          return 'none';
        })
        .style('stroke-width', (d: any) => (d.selected ? '1px' : '0px'))
        .style('stroke-opacity', 0.3)
        .attr('text-anchor', 'middle')
        .attr('transform', (d: any) => `translate(${d.x},${d.y})rotate(${d.rotate})`)
        .text((d: any) => d.text)
        .style('cursor', 'pointer')
        .style('transition', 'all 0.2s ease')
        .on('mouseover', function (event, d: any) {
          d3.select(this)
            .style('fill', getColor(d, true))
            .style('font-size', `${d.size * 1.1}px`)
            .style('opacity', 1)
            .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))');
          tooltip
            .html(
              `<strong>${d.text}</strong><br/>出现次数: ${d.frequency}<br/>相关论文: ${d.papers.length} 篇<br/>点击查看相关论文`,
            )
            .style('visibility', 'visible')
            .style('left', event.pageX + 10 + 'px')
            .style('top', event.pageY - 10 + 'px');
        })
        .on('mousemove', function (event) {
          tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 10 + 'px');
        })
        .on('mouseout', function (event, d: any) {
          d3.select(this)
            .style('fill', getColor(d))
            .style('font-size', `${d.size}px`)
            .style('opacity', 1)
            .style('filter', 'none');
          tooltip.style('visibility', 'hidden');
        })
        .on('click', (event, d: any) => {
          event.stopPropagation();
          const keyword = d.text;
          if (onKeywordClick) {
            onKeywordClick(keyword);
          }
        });
    }
  }, [papers, filter, onKeywordClick]);

  useEffect(() => {
    drawWordCloud();
    const handleResize = () => drawWordCloud();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawWordCloud]);

  return (
    <div ref={containerRef} className="word-cloud-container">
      <svg ref={svgRef} />
    </div>
  );
};

export default WordCloud;
