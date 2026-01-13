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
  const layoutCacheRef = useRef<Map<string, { x: number; y: number; rotate: number }>>(new Map());

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

    // 词云应该显示所有可能的关键词，所以排除关键词筛选
    // 只应用其他筛选条件（年份、国家、会议等）
    const filterWithoutKeywords = { ...filter, keywords: undefined };
    const filteredPapers = applyFilter(papers, filterWithoutKeywords);
    const wordData = extractWordCloudData(filteredPapers).slice(0, 50);

           if (wordData.length === 0) {
             svg
               .append('text')
               .attr('x', width / 2)
               .attr('y', height / 2 - 10)
               .attr('text-anchor', 'middle')
               .style('font-size', '16px')
               .style('fill', '#aaa')
               .text('暂无词云数据');
             svg
               .append('text')
               .attr('x', width / 2)
               .attr('y', height / 2 + 15)
               .attr('text-anchor', 'middle')
               .style('font-size', '12px')
               .style('fill', '#aaa')
               .text('（当前筛选结果中没有包含关键词的论文）');
             return;
           }

    const maxFrequency = d3.max(wordData, (d) => d.frequency) || 1;
    const minFrequency = d3.min(wordData, (d) => d.frequency) || 0;

    // 字体大小范围调整（更大的范围，更明显的差异）
    const fontSizeScale = d3
      .scaleLinear()
      .domain([minFrequency, maxFrequency])
      .range([16, 80]);

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

    // 只在年份改变时重新计算布局，否则使用缓存的布局
    const yearKey = filter.years ? `${filter.years[0]}-${filter.years[1]}` : 'all';
    const shouldRecalculateLayout = !layoutCacheRef.current.has(yearKey) || 
      layoutCacheRef.current.size === 0 ||
      !wordData.every(d => layoutCacheRef.current.has(`${yearKey}-${d.word}`));

    // 如果不需要重新计算布局，直接使用缓存的位置绘制
    if (!shouldRecalculateLayout) {
      const cachedWords = wordData.map((d, i) => {
        const cacheKey = `${yearKey}-${d.word}`;
        const cached = layoutCacheRef.current.get(cacheKey);
        return {
          text: d.word,
          size: fontSizeScale(d.frequency),
          frequency: d.frequency,
          papers: d.papers,
          selected: isKeywordSelected(d.word),
          index: i,
          x: cached?.x || 0,
          y: cached?.y || 0,
          rotate: cached?.rotate || 0,
        };
      });
      draw(cachedWords);
      return;
    }

    // 需要重新计算布局时，使用d3-cloud进行布局
    // d3-cloud会自动处理碰撞检测，避免重叠
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
        // 随机选择角度
        const angles = [0, -15, 15, -30, 30, -45, 45, 90];
        return angles[Math.floor(Math.random() * angles.length)];
      })
      .font('Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif')
      .fontWeight('600')
      .fontSize((d: any) => d.size)
      .on('end', (words: any[]) => {
        // 保存布局到缓存
        words.forEach((word: any) => {
          const cacheKey = `${yearKey}-${word.text}`;
          layoutCacheRef.current.set(cacheKey, {
            x: word.x,
            y: word.y,
            rotate: word.rotate,
          });
        });
        draw(words);
      });

    layout.start();

    function draw(words: any[]) {
      const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

      // 深色主题适配的颜色方案（更亮的颜色）
      const colorSchemes = [
        ['#4dabf7', '#339af0'], // 亮蓝色系
        ['#51cf66', '#40c057'], // 亮绿色系
        ['#ffa94d', '#ff922b'], // 亮橙色系
        ['#f783ac', '#f06595'], // 亮粉色系
        ['#b197fc', '#9775fa'], // 亮紫色系
        ['#66d9ef', '#51cfcf'], // 亮青色系
        ['#ff6b6b', '#ff5252'], // 亮红色系
        ['#74c0fc', '#4dabf7'], // 亮深蓝系
      ];

      // 为每个词选择颜色（使用更智能的分配策略）
      const getColor = (d: any, isHover: boolean = false): string => {
        if (d.selected) {
          return '#1890ff'; // 选中的关键词使用蓝色
        }
        if (isHover) {
          return '#1890ff'; // 悬停时使用蓝色
        }
        // 根据索引分配颜色方案，确保颜色分布均匀
        const schemeIndex = d.index % colorSchemes.length;
        const scheme = colorSchemes[schemeIndex];
        // 根据频率在颜色方案内选择深浅
        const frequencyRatio = (d.frequency - minFrequency) / (maxFrequency - minFrequency || 1);
        const colorIndex = Math.floor(frequencyRatio * (scheme.length - 1));
        return scheme[colorIndex] || scheme[0];
      };
      
      // 首字母大写函数
      const capitalizeFirst = (str: string): string => {
        if (!str || str.length === 0) return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
      };

      const texts = g.selectAll('text')
        .data(words)
        .enter()
        .append('text')
        .style('font-size', (d: any) => `${d.size}px`)
        .style('font-family', 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif')
        .style('font-weight', '600')
        .style('fill', (d: any) => getColor(d))
        .style('stroke', (d: any) => {
          // 为选中的词添加描边
          if (d.selected) {
            return '#1890ff';
          }
          return 'none';
        })
        .style('stroke-width', (d: any) => {
          if (d.selected) {
            return '2px';
          }
          return '0px';
        })
        .style('stroke-opacity', (d: any) => (d.selected ? 0.8 : 0))
        .style('opacity', 0) // 初始透明，用于动画
        .attr('text-anchor', 'middle')
        .attr('transform', (d: any) => `translate(${d.x},${d.y})rotate(${d.rotate})`)
        .text((d: any) => capitalizeFirst(d.text)) // 首字母大写
        .style('cursor', 'pointer')
        .style('filter', (d: any) => {
          // 为选中的词添加阴影
          if (d.selected) {
            return 'drop-shadow(0 0 6px rgba(24, 144, 255, 0.5))';
          }
          return 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.08))';
        });
      
      // 添加淡入动画
      texts.transition()
        .duration(800)
        .delay((d: any, i: number) => i * 20)
        .style('opacity', 1);
      
      // 绑定事件处理器
      texts.on('mouseover', function (event, d: any) {
          d3.select(this)
            .transition()
            .duration(200)
            .style('fill', getColor(d, true))
            .style('font-size', `${d.size * 1.15}px`)
            .style('opacity', 1)
            .style('filter', 'drop-shadow(0 4px 12px rgba(24, 144, 255, 0.5))')
            .style('stroke', '#1890ff')
            .style('stroke-width', '2px')
            .style('stroke-opacity', 0.8);
          
          // 计算应用当前筛选条件后包含该关键词的论文数量
          // 如果已经有关键词筛选，需要合并筛选条件
          const currentFilter = { ...filter };
          const keywordToCheck = d.text;
          
          // 如果当前关键词不在筛选列表中，需要临时添加它来计算数量
          const tempFilter = currentFilter.keywords?.includes(keywordToCheck)
            ? currentFilter
            : { ...currentFilter, keywords: [...(currentFilter.keywords || []), keywordToCheck] };
          
          const papersWithKeyword = applyFilter(papers, tempFilter);
          const count = papersWithKeyword.length;
          
          tooltip
            .html(
              `<strong>${d.text}</strong><br/>出现次数: ${d.frequency}<br/>相关论文: ${count} 篇<br/>点击查看相关论文`,
            )
            .style('visibility', 'visible')
            .style('left', event.pageX + 10 + 'px')
            .style('top', event.pageY - 10 + 'px');
        })
        .on('mousemove', function (event) {
          tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 10 + 'px');
        })
        .on('mouseout', function (event, d: any) {
          const element = d3.select(this);
          const filterValue = d.selected
            ? 'drop-shadow(0 0 6px rgba(24, 144, 255, 0.5))'
            : 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.08))';
          const strokeValue = d.selected ? '#1890ff' : 'none';
          const strokeWidth = d.selected ? '2px' : '0px';
          const strokeOpacity = d.selected ? 0.8 : 0;
          
          element
            .transition()
            .duration(200)
            .style('fill', getColor(d))
            .style('font-size', `${d.size}px`)
            .style('opacity', 1)
            .style('filter', filterValue)
            .style('stroke', strokeValue)
            .style('stroke-width', strokeWidth)
            .style('stroke-opacity', strokeOpacity);
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
