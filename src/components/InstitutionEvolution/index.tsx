/**
 * 机构演化图谱组件
 * 横向柱状图展示机构论文数量变化，支持动画播放
 */

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Button, Space } from "antd";
import { PlayCircleOutlined, PauseCircleOutlined } from "@ant-design/icons";
import * as d3 from "d3";
import { Paper, FilterCondition } from "@/types";
import { applyFilter } from "@/services/dataProcessor";
import "./index.less";

interface InstitutionEvolutionProps {
  papers: Paper[];
  filter: FilterCondition;
  onPlayStateChange?: (isPlaying: boolean) => void;
  externalYear?: number | null;
  externalIsPlaying?: boolean;
  compact?: boolean;
  height?: number;
}

export interface InstitutionEvolutionRef {
  play: () => void;
  pause: () => void;
  setYear: (year: number | null) => void;
}

interface InstitutionData {
  institution: string;
  count: number;
}

const InstitutionEvolution = forwardRef<
  InstitutionEvolutionRef,
  InstitutionEvolutionProps
>(
  (
    {
      papers,
      filter,
      onPlayStateChange,
      externalYear,
      externalIsPlaying,
      compact,
      height: propHeight,
    },
    ref
  ) => {
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

    // 获取年份范围（使用选定的年份区间）
    const getYearRange = useCallback(() => {
      const filteredPapers = applyFilter(papers, filter);
      const years = filteredPapers
        .map((p) => p.year)
        .filter((y) => y && y > 0)
        .sort((a, b) => a - b);
      if (years.length === 0) return [];

      // 如果用户选择了年份区间，使用该区间；否则使用所有数据的年份范围
      if (filter.years && filter.years.length === 2) {
        const [minSelected, maxSelected] = filter.years;
        const availableYears = years.filter(
          (y) => y >= minSelected && y <= maxSelected
        );
        if (availableYears.length === 0) return [];
        return Array.from(
          { length: maxSelected - minSelected + 1 },
          (_, i) => minSelected + i
        ).filter((y) => availableYears.includes(y));
      } else {
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        return Array.from(
          { length: maxYear - minYear + 1 },
          (_, i) => minYear + i
        );
      }
    }, [papers, filter]);

    // 获取指定年份的机构数据
    const getYearData = useCallback(
      (year: number): InstitutionData[] => {
        const filteredPapers = applyFilter(papers, filter);
        const yearPapers = filteredPapers.filter((p) => p.year === year);

        const institutionMap = new Map<string, number>();
        yearPapers.forEach((paper) => {
          paper.authors.forEach((author) => {
            if (
              author.affiliations &&
              Array.isArray(author.affiliations) &&
              author.affiliations.length > 0
            ) {
              author.affiliations.forEach((affiliation) => {
                if (affiliation && typeof affiliation === "string") {
                  const normalized = affiliation.trim();
                  if (normalized) {
                    institutionMap.set(
                      normalized,
                      (institutionMap.get(normalized) || 0) + 1
                    );
                  }
                }
              });
            }
          });
        });

        return Array.from(institutionMap.entries())
          .map(([institution, count]) => ({ institution, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15); // 显示前15个
      },
      [papers, filter]
    );

    // 创建或获取工具提示
    const getTooltip = useCallback(() => {
      let tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
      const existingTooltip = d3.select(".institution-evolution-tooltip");
      if (existingTooltip.empty()) {
        tooltip = d3
          .select("body")
          .append("div")
          .attr("class", "institution-evolution-tooltip")
          .style("position", "absolute")
          .style("visibility", "hidden")
          .style("background", "rgba(0, 0, 0, 0.85)")
          .style("color", "white")
          .style("padding", "8px 12px")
          .style("border-radius", "4px")
          .style("pointer-events", "none")
          .style("font-size", "12px")
          .style("z-index", "9999")
          .style("box-shadow", "0 2px 8px rgba(0,0,0,0.3)");
        tooltipRef.current = tooltip.node() as HTMLDivElement;
      } else {
        tooltip = existingTooltip as unknown as d3.Selection<
          HTMLDivElement,
          unknown,
          HTMLElement,
          any
        >;
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
        const containerH = container.clientHeight || 0;
        const isCompact = compact === true;
        const minHeight = isCompact ? 280 : 360;
        const baseHeight =
          containerH > 0
            ? containerH
            : Math.max(Math.min(width * 0.45, 420), minHeight);
        const height = Math.max(baseHeight, minHeight); // 自适应且保证最小高度

        const svg = d3.select(svgRef.current);
        // 每次根据容器尺寸更新画布，避免在主/次视图切换时尺寸不匹配
        svg.attr("width", width).attr("height", height);
        svg.selectAll(".year-placeholder").remove();

        if (year === null) {
          svg.selectAll("g.chart-container").remove();
          svg
            .append("text")
            .attr("class", "year-placeholder")
            .attr("x", width / 2)
            .attr("y", height / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("fill", "#aaa")
            .text("请选择年份或点击播放");
          return;
        }

        const data = getYearData(year);

        if (data.length === 0) {
          svg.selectAll("g.chart-container, text").remove();
          return;
        }

        // 设置边距（紧凑模式收紧）
        const margin = isCompact
          ? { top: 12, right: 70, bottom: 30, left: 140 }
          : { top: 24, right: 120, bottom: 48, left: 220 };
        const chartWidth = Math.max(width - margin.left - margin.right, 140);
        const chartHeight = Math.max(height - margin.top - margin.bottom, 140);

        // 获取或创建图表容器并水平居中
        let g = svg.select<SVGGElement>("g.chart-container") as d3.Selection<
          SVGGElement,
          unknown,
          null,
          undefined
        >;
        const offsetX = (width - chartWidth) / 2;
        if (g.empty()) {
          g = svg
            .append("g")
            .attr("class", "chart-container")
            .attr("transform", `translate(${offsetX},${margin.top})`);
        } else {
          g.attr("transform", `translate(${offsetX},${margin.top})`);
        }

        // 创建比例尺
        const xScale = d3
          .scaleLinear()
          .domain([0, d3.max(data, (d) => d.count) || 1])
          .range([0, chartWidth])
          .nice();

        // 紧凑模式减少展示条数，避免柱子过厚
        const maxItems = isCompact ? 8 : 15;
        const displayItems: (InstitutionData | null)[] = [];
        const emptySlots = Math.max(maxItems - data.length, 0);
        const topPad = Math.floor(emptySlots / 2);
        const bottomPad = emptySlots - topPad;

        // 在上下均匀填充占位符，让柱子在竖直方向居中
        for (let i = 0; i < topPad; i++) {
          displayItems.push(null);
        }
        displayItems.push(...data.slice(0, maxItems));
        for (let i = 0; i < bottomPad; i++) {
          displayItems.push(null);
        }
        const yDomain = displayItems.map((d, i) =>
          d ? d.institution : `_placeholder_${i}`
        );
        const yScale = d3
          .scaleBand()
          .domain(yDomain)
          .range([0, chartHeight])
          .padding(isCompact ? 0.1 : 0.18);

        // 创建颜色比例尺（固定颜色映射）
        const allInstitutions = new Set<string>();
        const years = getYearRange() || [];
        years.forEach((y) => {
          getYearData(y).forEach((d) => allInstitutions.add(d.institution));
        });
        const colorScale = d3
          .scaleOrdinal(d3.schemeCategory10)
          .domain(Array.from(allInstitutions));

        const tooltip = getTooltip();

        // 绘制柱状图（只绘制有数据的项）
        const barsData = displayItems.filter(
          (d) => d !== null
        ) as InstitutionData[];
        const bars = g
          .selectAll<SVGRectElement, InstitutionData>(".bar")
          .data(barsData, (d) => d.institution);

        bars
          .exit()
          .transition()
          .duration(300)
          .ease(d3.easeCubicInOut)
          .attr("width", 0)
          .attr("y", chartHeight)
          .remove();

        const barsEnter = bars
          .enter()
          .append("rect")
          .attr("class", "bar")
          .attr("x", 0)
          .attr("y", (d) => yScale(d.institution)!)
          .attr("width", 0)
          .attr("height", yScale.bandwidth())
          .attr("fill", (d) => colorScale(d.institution) as string)
          .attr("rx", 4)
          .attr("ry", 4)
          .style("cursor", "pointer");

        barsEnter
          .merge(bars as any)
          .transition()
          .duration(300)
          .ease(d3.easeCubicInOut)
          .attr("y", (d) => yScale(d.institution)!)
          .attr("width", (d) => xScale(d.count))
          .attr("fill", (d) => colorScale(d.institution) as string);

        // 添加交互
        g.selectAll(".bar")
          .on("mouseover", function (event, d: any) {
            d3.select(this).attr("opacity", 0.7);
            tooltip
              .html(`<strong>${d.institution}</strong><br/>论文数: ${d.count}`)
              .style("visibility", "visible")
              .style("left", event.pageX + 10 + "px")
              .style("top", event.pageY - 10 + "px");
          })
          .on("mousemove", function (event) {
            tooltip
              .style("left", event.pageX + 10 + "px")
              .style("top", event.pageY - 10 + "px");
          })
          .on("mouseout", function () {
            d3.select(this).attr("opacity", 1);
            tooltip.style("visibility", "hidden");
          });

        // 绘制标签（截断长名称，只绘制有数据的项）
        const labelsData = displayItems.filter(
          (d) => d !== null
        ) as InstitutionData[];
        const labels = g
          .selectAll<SVGTextElement, InstitutionData>(".label")
          .data(labelsData, (d) => d.institution);

        labels.exit().remove();

        const labelsEnter = labels
          .enter()
          .append("text")
          .attr("class", "label")
          .attr("x", -5)
          .attr("y", (d) => yScale(d.institution)! + yScale.bandwidth() / 2)
          .attr("dy", "0.35em")
          .attr("text-anchor", "end")
          .style("font-size", "9px")
          .style("fill", "#fff")
          .text((d) => {
            const text = d.institution;
            return text.length > 40 ? text.substring(0, 40) + "..." : text;
          });

        labelsEnter
          .merge(labels as any)
          .transition()
          .duration(300)
          .ease(d3.easeCubicInOut)
          .attr("y", (d) => yScale(d.institution)! + yScale.bandwidth() / 2);

        // 绘制数值标签（只绘制有数据的项）
        const valueLabelsData = displayItems.filter(
          (d) => d !== null
        ) as InstitutionData[];
        const valueLabels = g
          .selectAll<SVGTextElement, InstitutionData>(".value-label")
          .data(valueLabelsData, (d) => d.institution);

        valueLabels.exit().remove();

        const valueLabelsEnter = valueLabels
          .enter()
          .append("text")
          .attr("class", "value-label")
          .attr("x", (d) => xScale(d.count) + 5)
          .attr("y", (d) => yScale(d.institution)! + yScale.bandwidth() / 2)
          .attr("dy", "0.35em")
          .style("font-size", "9px")
          .style("fill", "#aaa")
          .text((d) => d.count.toString())
          .attr("opacity", 0);

        valueLabelsEnter
          .merge(valueLabels as any)
          .transition()
          .duration(300)
          .ease(d3.easeCubicInOut)
          .attr("x", (d) => xScale(d.count) + 5)
          .attr("y", (d) => yScale(d.institution)! + yScale.bandwidth() / 2)
          .attr("opacity", 1)
          .text((d) => d.count.toString());

        // 绘制或更新坐标轴
        let axesGroup = g.select<SVGGElement>("g.axes-group") as d3.Selection<
          SVGGElement,
          unknown,
          null,
          undefined
        >;
        if (axesGroup.empty()) {
          axesGroup = g.append("g").attr("class", "axes-group") as d3.Selection<
            SVGGElement,
            unknown,
            null,
            undefined
          >;
        }

        // 更新X轴
        const xAxis = d3.axisBottom(xScale);
        let xAxisGroup = axesGroup.select<SVGGElement>(
          "g.x-axis"
        ) as d3.Selection<SVGGElement, unknown, null, undefined>;
        if (xAxisGroup.empty()) {
          xAxisGroup = axesGroup
            .append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${chartHeight})`) as d3.Selection<
            SVGGElement,
            unknown,
            null,
            undefined
          >;
          xAxisGroup.call(xAxis);
          xAxisGroup
            .selectAll("text")
            .style("font-size", "9px")
            .style("fill", "#666");

          axesGroup
            .append("text")
            .attr("class", "x-axis-label")
            .attr(
              "transform",
              `translate(${chartWidth / 2}, ${chartHeight + 30})`
            )
            .style("text-anchor", "middle")
            .style("font-size", "10px")
            .style("fill", "#aaa")
            .text("论文数量");
        } else {
          xAxisGroup.transition().duration(500).call(xAxis);
        }

        // 更新年份标题
        let yearLabel = g.select<SVGTextElement>(
          "text.year-label"
        ) as d3.Selection<SVGTextElement, unknown, null, undefined>;
        if (yearLabel.empty()) {
          yearLabel = g
            .append("text")
            .attr("class", "year-label")
            .attr("x", chartWidth / 2)
            .attr("y", -5)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .style("fill", "#fff");
        }
        yearLabel.text(`${year}年`);
      },
      [getYearData, getYearRange, getTooltip]
    );

    // 初始化显示第一个年份
    useEffect(() => {
      const years = getYearRange() || [];
      if (
        years.length > 0 &&
        currentYear === null &&
        externalYear === undefined
      ) {
        setCurrentYear(years[0]);
        isInitializedRef.current = false;
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
        const years = getYearRange() || [];
        if (years.length === 0) return;

        let currentIndex = years.indexOf(currentYear || years[0]);
        if (currentIndex === -1) currentIndex = 0;

        setIsPlaying(true);
        onPlayStateChange?.(true);
        animationTimerRef.current = setInterval(() => {
          currentIndex = (currentIndex + 1) % years.length;
          setCurrentYear(years[currentIndex]);
        }, 800);
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

    const years = getYearRange() || [];

    return (
      <div className="institution-evolution-container">
        {!compact && (
          <div
            className="institution-evolution-controls"
            style={{ marginBottom: "16px", textAlign: "right" }}
          >
            <Space>
              <Button
                type="primary"
                icon={
                  isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                }
                onClick={handlePlayPause}
                disabled={years.length === 0}
              >
                {isPlaying ? "暂停" : "播放"}
              </Button>
              {currentYear && (
                <span style={{ fontSize: "14px", color: "#666" }}>
                  当前年份: {currentYear}
                </span>
              )}
            </Space>
          </div>
        )}
        <div
          ref={containerRef}
          style={{
            width: "100%",
            maxWidth: compact ? "100%" : "1100px",
            height: `${propHeight ?? (compact ? 240 : 420)}px`,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
    );
  }
);

InstitutionEvolution.displayName = "InstitutionEvolution";

export default InstitutionEvolution;
