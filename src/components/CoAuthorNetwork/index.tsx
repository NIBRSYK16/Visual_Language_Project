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
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchText, setSearchText] = useState<string>('');
  const simulationRef = useRef<d3.Simulation<AuthorNode, AuthorLink> | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<{
    node: AuthorNode;
    x: number;
    y: number;
  } | null>(null);

  // 获取作者的所有论文
  const getAuthorPapers = useCallback((authorId: string, papersList: Paper[]): Paper[] => {
    return papersList.filter((paper) =>
      paper.authors.some((author) => author.id === authorId),
    );
  }, []);

  // 获取作者的信息（国家、机构等）
  const getAuthorInfo = useCallback((authorId: string, papersList: Paper[]): {
    country?: string;
    affiliations: string[];
  } => {
    const affiliationsSet = new Set<string>();
    let country: string | undefined;

    papersList.forEach((paper) => {
      const author = paper.authors.find((a) => a.id === authorId);
      if (author) {
        // 收集所有机构
        if (author.affiliations && author.affiliations.length > 0) {
          author.affiliations.forEach((aff) => {
            if (aff && aff.trim()) {
              affiliationsSet.add(aff.trim());
            }
          });
        }
        // 获取国家（优先使用作者的国家，如果没有则使用论文的国家）
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
        .style('fill', '#aaa')
        .text('暂无作者合作网络数据');
      return;
    }

    // 限制节点数量，避免渲染过多导致卡顿
    const MAX_NODES_TO_DISPLAY = 100;
    let nodesToDisplay: AuthorNode[] = [];

    // 如果有搜索文本，在所有节点中搜索匹配的节点
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      // 改进的搜索函数：支持部分匹配、单词匹配等
      const matchesNode = (node: AuthorNode): boolean => {
        const nodeNameLower = (node.name || '').toLowerCase();
        const nodeIdLower = (node.id || '').toLowerCase();
        
        // 支持多种匹配方式：
        // 1. 完整名称包含搜索文本
        // 2. ID 包含搜索文本
        // 3. 名称的各个部分（单词）包含搜索文本（支持搜索 "John" 找到 "John Smith"）
        const nameParts = nodeNameLower.split(/\s+/);
        const matchesName = nodeNameLower.includes(searchLower) || nameParts.some(part => part.includes(searchLower));
        const matchesId = nodeIdLower.includes(searchLower);
        
        return matchesName || matchesId;
      };
      
      // 在所有节点中搜索匹配的节点（不限制数量）
      const allMatchedNodes = network.nodes.filter(matchesNode);

      if (allMatchedNodes.length > 0) {
        // 找到匹配节点的所有合作者
        const matchedNodeIds = new Set(allMatchedNodes.map((n) => n.id));
        const relatedNodeIds = new Set<string>(matchedNodeIds);
        
        // 找到所有与匹配节点有连接的节点（合作者）
        network.edges.forEach((edge) => {
          if (matchedNodeIds.has(edge.source)) {
            relatedNodeIds.add(edge.target);
          }
          if (matchedNodeIds.has(edge.target)) {
            relatedNodeIds.add(edge.source);
          }
        });

        // 获取所有相关节点
        const relatedNodes = network.nodes.filter((node) => relatedNodeIds.has(node.id));
        
        // 排序：匹配的节点在前，然后是相关节点，都按论文数量排序
        const sortedMatched = allMatchedNodes.sort((a, b) => b.count - a.count);
        const sortedRelated = relatedNodes
          .filter((node) => !matchedNodeIds.has(node.id))
          .sort((a, b) => b.count - a.count);
        
        nodesToDisplay = [...sortedMatched, ...sortedRelated].slice(0, MAX_NODES_TO_DISPLAY);
      } else {
        // 如果没有匹配的节点，显示提示信息
        nodesToDisplay = [];
        svg
          .append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .style('font-size', '16px')
          .style('fill', '#aaa')
          .text(`未找到匹配 "${searchText}" 的作者`);
        return;
      }
    } else {
      // 没有搜索文本时，显示前100个节点（按论文数量排序）
      nodesToDisplay = network.nodes
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_NODES_TO_DISPLAY);
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
      // 只显示与匹配节点相关的连接
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


    const g = svg.append('g'); // 用于缩放和平移的组

    // 添加缩放和平移功能
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // 判断节点是否匹配搜索（改进的搜索逻辑）
    const isNodeMatched = (node: AuthorNode): boolean => {
      if (!searchText.trim()) return false;
      const searchLower = searchText.toLowerCase().trim();
      const nodeNameLower = (node.name || '').toLowerCase();
      const nodeIdLower = (node.id || '').toLowerCase();
      
      // 支持多种匹配方式：
      // 1. 完整名称包含搜索文本
      // 2. ID 包含搜索文本
      // 3. 名称的各个部分（单词）包含搜索文本（支持搜索 "John" 找到 "John Smith"）
      const nameParts = nodeNameLower.split(/\s+/);
      const matchesName = nodeNameLower.includes(searchLower) || nameParts.some(part => part.includes(searchLower));
      const matchesId = nodeIdLower.includes(searchLower);
      
      return matchesName || matchesId;
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
          return '#4dabf7';
        }
        return 'rgba(255, 255, 255, 0.3)';
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
          return '#4dabf7';
        }
        // 使用更亮的颜色方案适配深色主题
        const brightColors = ['#4dabf7', '#51cf66', '#ffa94d', '#f783ac', '#b197fc', '#66d9ef', '#ff6b6b', '#74c0fc', '#ffd43b', '#ff922b'];
        return brightColors[Math.floor(Math.random() * brightColors.length)];
      })
      .attr('stroke', (d) => {
        // 选中的节点使用高亮颜色
        if (selectedAuthor?.node.id === d.id) {
          return '#4dabf7';
        }
        if (isNodeMatched(d)) {
          return '#339af0';
        }
        return 'rgba(255, 255, 255, 0.5)';
      })
      .attr('stroke-width', (d) => {
        // 选中的节点使用更粗的边框
        if (selectedAuthor?.node.id === d.id) {
          return 4;
        }
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
        // 鼠标悬停时高亮节点
        d3.select(this).attr('stroke', '#4dabf7').attr('stroke-width', 3);
      })
      .on('mouseout', function (event, d) {
        // 恢复原始样式（如果未被选中）
        if (selectedAuthor?.node.id !== d.id) {
          if (isNodeMatched(d)) {
            d3.select(this).attr('stroke', '#339af0').attr('stroke-width', 3);
          } else {
            d3.select(this).attr('stroke', 'rgba(255, 255, 255, 0.5)').attr('stroke-width', 1.5);
          }
        } else {
          // 保持选中状态的高亮
          d3.select(this).attr('stroke', '#4dabf7').attr('stroke-width', 4);
        }
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        // 如果点击的是已选中的节点，则关闭卡片
        if (selectedAuthor?.node.id === d.id) {
          setSelectedAuthor(null);
          // 恢复节点样式
            d3.select(this).attr('stroke', isNodeMatched(d) ? '#339af0' : 'rgba(255, 255, 255, 0.5)').attr('stroke-width', isNodeMatched(d) ? 3 : 1.5);
        } else {
          // 获取节点在SVG容器中的坐标
          const container = containerRef.current;
          if (!container) return;
          
          const svgRect = svgRef.current?.getBoundingClientRect();
          if (!svgRect) return;
          
          // 获取节点在SVG中的坐标（考虑缩放和平移）
          const transform = d3.zoomTransform(svg.node() as SVGSVGElement);
          const nodeX = (d.x || 0) * transform.k + transform.x;
          const nodeY = (d.y || 0) * transform.k + transform.y;
          
          // 转换为相对于容器的坐标（容器是相对定位的）
          const x = nodeX;
          const y = nodeY;
          
          setSelectedAuthor({ node: d, x, y });
          // 高亮选中的节点
          d3.select(this).attr('stroke', '#4dabf7').attr('stroke-width', 4);
        }
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
          return '#4dabf7';
        }
        return '#fff';
      })
      .style('stroke', 'rgba(0, 0, 0, 0.5)')
      .style('stroke-width', '0.5px')
      .style('paint-order', 'stroke')
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
  }, [papers, filter, searchText, getAuthorPapers, getAuthorInfo]);

  useEffect(() => {
    drawNetwork();
  }, [drawNetwork]);

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  // 点击外部区域关闭卡片
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        selectedAuthor
      ) {
        setSelectedAuthor(null);
      }
    };

    if (selectedAuthor) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [selectedAuthor]);

  // 渲染作者信息卡片
  const renderAuthorCard = () => {
    if (!selectedAuthor) return null;

    const { node, x, y } = selectedAuthor;
    const displayName = node.name || (node.id ? `作者-${node.id}` : '未知作者');
    const filteredPapers = applyFilter(papers, filter);
    const authorInfo = getAuthorInfo(node.id, filteredPapers);
    const authorPapers = getAuthorPapers(node.id, filteredPapers);
    const MAX_PAPERS_TO_SHOW = 10;

    // 构建作者信息HTML
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

    // 构建论文列表
    const sortedPapers = [...authorPapers].sort((a, b) => (b.year || 0) - (a.year || 0));
    const papersToShow = sortedPapers.slice(0, MAX_PAPERS_TO_SHOW);

    // 计算卡片位置（相对于SVG容器）
    const container = containerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const cardWidth = 450;
    const cardHeight = 500;
    const padding = 15;

    let cardLeft = x + padding;
    let cardTop = y - padding;

    // 如果卡片会超出右边界，显示在节点左侧
    if (cardLeft + cardWidth > containerRect.width) {
      cardLeft = x - cardWidth - padding;
    }

    // 如果卡片会超出下边界，显示在节点上方
    if (cardTop + cardHeight > containerRect.height) {
      cardTop = y - cardHeight - padding;
    }

    // 确保不超出边界
    cardLeft = Math.max(padding, Math.min(cardLeft, containerRect.width - cardWidth - padding));
    cardTop = Math.max(padding, Math.min(cardTop, containerRect.height - cardHeight - padding));

    return (
      <div
        className="author-info-card"
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
          zIndex: 1000,
          overflowY: 'auto',
          lineHeight: '1.6',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>
          {displayName}
        </div>
        <div style={{ fontSize: '12px', color: '#e0e0e0', marginBottom: '4px' }}>
          <span style={{ color: '#87ceeb' }}>论文数:</span> {node.count}
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

  // 获取合作者数量
  const getCoauthorCount = useCallback((nodeId: string, networkLinks: any[]): number => {
    const connectedNodes = new Set<string>();
    networkLinks.forEach((link: any) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      if (sourceId === nodeId) {
        connectedNodes.add(targetId);
      } else if (targetId === nodeId) {
        connectedNodes.add(sourceId);
      }
    });
    return connectedNodes.size;
  }, []);

  return (
    <div ref={containerRef} className="co-author-network-container" style={{ position: 'relative' }}>
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
      {renderAuthorCard()}
    </div>
  );
};

export default CoAuthorNetwork;
