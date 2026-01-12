/**
 * 作者合作网络组件
 * 使用 D3 力导向图展示作者合作关系
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Input } from 'antd';
import { Paper, FilterCondition, AuthorNetwork, AuthorNode, AuthorLink } from '@/types';
import { buildAuthorNetwork, applyFilter } from '@/services/dataProcessor';
import './index.less';

const { Search } = Input;

interface CoAuthorNetworkProps {
  papers: Paper[];
  filter: FilterCondition;
}

const CoAuthorNetwork: React.FC<CoAuthorNetworkProps> = ({ papers, filter }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const simulationRef = useRef<d3.Simulation<AuthorNode, AuthorLink> | null>(null);

  const drawNetwork = useCallback(() => {
    if (!svgRef.current) return;

    const container = svgRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = 600; // 固定高度

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // 清空 SVG
    svg.attr('width', width).attr('height', height);

    const filteredPapers = applyFilter(papers, filter);
    const network = buildAuthorNetwork(filteredPapers);

    if (network.nodes.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('fill', '#999')
        .text('暂无作者合作网络数据');
      return;
    }

    // 限制节点数量，避免渲染过多导致卡顿
    const MAX_NODES_TO_DISPLAY = 100;
    let nodesToDisplay = network.nodes
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_NODES_TO_DISPLAY);

    // 如果有搜索文本，优先显示匹配的节点
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      const matchedNodes = nodesToDisplay.filter(
        (node) =>
          node.name.toLowerCase().includes(searchLower) || node.id.toLowerCase().includes(searchLower),
      );
      const unmatchedNodes = nodesToDisplay.filter(
        (node) =>
          !node.name.toLowerCase().includes(searchLower) &&
          !node.id.toLowerCase().includes(searchLower),
      );

      // 重新排序：匹配的节点在前，但保持各自的排序
      nodesToDisplay = [...matchedNodes, ...unmatchedNodes].slice(0, MAX_NODES_TO_DISPLAY);
    }

    const nodeIdsToDisplay = new Set(nodesToDisplay.map((n) => n.id));
    let linksToDisplay = network.edges.filter(
      (link) => nodeIdsToDisplay.has(link.source) && nodeIdsToDisplay.has(link.target),
    );

    // 如果有搜索文本，高亮与匹配节点相关的连接
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      const matchedNodeIds = new Set(
        nodesToDisplay
          .filter(
            (node) =>
              node.name.toLowerCase().includes(searchLower) || node.id.toLowerCase().includes(searchLower),
          )
          .map((n) => n.id),
      );
      linksToDisplay = linksToDisplay.filter(
        (link) => matchedNodeIds.has(link.source) || matchedNodeIds.has(link.target),
      );
    }

    // 重新映射 source/target 为节点对象，以便力导向图使用
    const nodeMap = new Map<string, AuthorNode>(nodesToDisplay.map((node) => [node.id, node]));
    const links = linksToDisplay.map((link) => ({
      ...link,
      source: nodeMap.get(link.source)!,
      target: nodeMap.get(link.target)!,
    }));

    const simulation = d3
      .forceSimulation<AuthorNode, AuthorLink>(nodesToDisplay)
      .force('link', d3.forceLink<AuthorNode, AuthorLink>(links).id((d) => d.id).distance(80).strength(0.7))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d: any) => Math.sqrt(d.count) * 3 + 5));

    simulationRef.current = simulation;

    // 创建或获取工具提示
    if (!tooltipRef.current) {
      const tooltipDiv = d3
        .select('body')
        .append('div')
        .attr('class', 'coauthor-network-tooltip')
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

    const g = svg.append('g'); // 用于缩放和平移的组

    // 添加缩放和平移功能
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // 判断节点是否匹配搜索
    const isNodeMatched = (node: AuthorNode): boolean => {
      if (!searchText.trim()) return false;
      const searchLower = searchText.toLowerCase().trim();
      return node.name.toLowerCase().includes(searchLower) || node.id.toLowerCase().includes(searchLower);
    };

    // 绘制边
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d: any) => {
        // 如果连接的两端都是匹配的节点，使用高亮颜色
        const sourceMatched = isNodeMatched(d.source);
        const targetMatched = isNodeMatched(d.target);
        if (sourceMatched || targetMatched) {
          return '#1890ff';
        }
        return '#999';
      })
      .attr('stroke-opacity', (d: any) => {
        const sourceMatched = isNodeMatched(d.source);
        const targetMatched = isNodeMatched(d.target);
        if (sourceMatched || targetMatched) {
          return 0.8;
        }
        return 0.3;
      })
      .attr('stroke-width', (d: any) => {
        const sourceMatched = isNodeMatched(d.source);
        const targetMatched = isNodeMatched(d.target);
        if (sourceMatched || targetMatched) {
          return Math.sqrt(d.weight) * 3;
        }
        return Math.sqrt(d.weight) * 2;
      });

    // 绘制节点
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodesToDisplay)
      .enter()
      .append('circle')
      .attr('r', (d) => Math.sqrt(d.count) * 3) // 节点大小根据论文数量
      .attr('fill', (d) => {
        // 匹配搜索的节点使用高亮颜色
        if (isNodeMatched(d)) {
          return '#1890ff';
        }
        return d3.schemeCategory10[Math.floor(Math.random() * 10)];
      })
      .attr('stroke', (d) => {
        if (isNodeMatched(d)) {
          return '#0050b3';
        }
        return '#fff';
      })
      .attr('stroke-width', (d) => {
        if (isNodeMatched(d)) {
          return 3;
        }
        return 1.5;
      })
      .call(
        d3
          .drag<SVGCircleElement, AuthorNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended),
      )
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke', '#1890ff').attr('stroke-width', 3);
        const displayName = d.name || (d.id ? `作者-${d.id}` : '未知作者');
        tooltip
          .html(`<strong>${displayName}</strong><br/>论文数: ${d.count}<br/>合作数: ${getCoauthorCount(d.id, links)}`)
          .style('visibility', 'visible')
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 10 + 'px');
      })
      .on('mousemove', function (event) {
        tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 10 + 'px');
      })
      .on('mouseout', function (event, d) {
        // 恢复原始样式
        if (isNodeMatched(d)) {
          d3.select(this).attr('stroke', '#0050b3').attr('stroke-width', 3);
        } else {
          d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5);
        }
        tooltip.style('visibility', 'hidden');
      });

    // 添加标签
    const labels = g
      .append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodesToDisplay)
      .enter()
      .append('text')
      .text((d) => d.name || (d.id ? `作者-${d.id}` : '未知作者')) // 显示作者名称或ID
      .style('font-size', (d) => {
        // 匹配的节点使用更大的字体
        if (isNodeMatched(d)) {
          return '12px';
        }
        return '10px';
      })
      .style('fill', (d) => {
        // 匹配的节点使用高亮颜色
        if (isNodeMatched(d)) {
          return '#1890ff';
        }
        return '#333';
      })
      .style('font-weight', (d) => {
        if (isNodeMatched(d)) {
          return 'bold';
        }
        return 'normal';
      })
      .style('pointer-events', 'none') // 避免遮挡鼠标事件
      .attr('dx', (d) => Math.sqrt(d.count) * 3 + 8)
      .attr('dy', 4);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);

      labels.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
    });

    function dragstarted(event: any, d: AuthorNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: AuthorNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: AuthorNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // 辅助函数：获取合作者数量
    function getCoauthorCount(nodeId: string, links: any[]): number {
      const connectedNodes = new Set<string>();
      links.forEach((link) => {
        if (link.source.id === nodeId) {
          connectedNodes.add(link.target.id);
        } else if (link.target.id === nodeId) {
          connectedNodes.add(link.source.id);
        }
      });
      return connectedNodes.size;
    }
  }, [papers, filter, searchText]);

  useEffect(() => {
    drawNetwork();
  }, [drawNetwork]);

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  return (
    <div className="co-author-network-container">
      <div className="co-author-network-search">
        <Search
          placeholder="搜索作者姓名或ID"
          allowClear
          onSearch={handleSearch}
          onChange={handleSearchChange}
          value={searchText}
          style={{ width: '100%', marginBottom: '10px' }}
        />
      </div>
      <svg ref={svgRef} />
    </div>
  );
};

export default CoAuthorNetwork;
