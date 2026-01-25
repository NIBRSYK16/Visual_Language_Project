/**
 * 顶会趋势分析组件
 * 展示不同会议在不同年份的论文数量趋势
 */

import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { Paper, FilterCondition } from "@/types";
import { applyFilter } from "@/services/dataProcessor";
import "./index.less";

interface ConferenceTrendProps {
  papers: Paper[];
  filter: FilterCondition;
}

interface ConferenceYearData {
  year: number;
  [venue: string]: number | string; // venue name -> count
}

const ConferenceTrend: React.FC<ConferenceTrendProps> = ({
  papers,
  filter,
}) => {
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
    // 小视图中：直接使用容器高度绘图，确保完整显示
    const height = container.clientHeight || Math.min(width * 0.5, 260);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    // 应用筛选条件
    const filteredPapers = applyFilter(papers, filter);

    if (filteredPapers.length === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("fill", "#aaa")
        .text("暂无数据");
      return;
    }

    // 获取所有年份和会议
    const years = Array.from(
      new Set(filteredPapers.map((p) => p.year).filter((y) => y && y > 0))
    ).sort((a, b) => a - b);
    const venues = Array.from(
      new Set(filteredPapers.map((p) => p.venue.name))
    ).sort();

    if (years.length === 0 || venues.length === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("fill", "#aaa")
        .text("暂无有效数据");
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

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // 创建比例尺
    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(years) as [number, number])
      .range([0, chartWidth])
      .nice();
    const maxCount =
      d3.max(data, (d) => {
        return venues.reduce((sum, venue) => sum + (d[venue] as number), 0);
      }) || 1;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range([chartHeight, 0])
      .nice();

    // 创建颜色比例尺
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(venues);

    // 创建堆叠数据（堆叠面积图）
    const stack = d3
      .stack<any>()
      .keys(venues)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);
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
    const existingTooltip = d3.select(".conference-trend-tooltip");
    if (existingTooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "conference-trend-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "rgba(0, 0, 0, 0.9)")
        .style("color", "white")
        .style("padding", "10px 14px")
        .style("border-radius", "6px")
        .style("pointer-events", "none")
        .style("font-size", "12px")
        .style("z-index", "9999")
        .style("box-shadow", "0 4px 12px rgba(0,0,0,0.4)")
        .style("line-height", "1.6");
      tooltipRef.current = tooltip.node() as HTMLDivElement;
    } else {
      tooltip = existingTooltip as d3.Selection<
        HTMLDivElement,
        unknown,
        HTMLElement,
        any
      >;
      tooltipRef.current = tooltip.node() as HTMLDivElement;
    }

    // 绘制堆叠面积
    const areas = g
      .selectAll(".area")
      .data(stackedData)
      .enter()
      .append("path")
      .attr("class", "area")
      .attr("d", area as any)
      .attr("fill", (d) => colorScale(d.key) as string)
      .attr("opacity", 0.6)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("opacity", 0.8);
        // 计算该层的总数
        const total = d.reduce((sum, point) => sum + (point[1] - point[0]), 0);
        tooltip
          .html(`<strong>${d.key}</strong><br/>总论文数: ${total.toFixed(0)}`)
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
        d3.select(this).attr("opacity", 0.6);
        tooltip.style("visibility", "hidden");
      });

    // 绘制边界线
    const lines = g
      .selectAll(".line")
      .data(stackedData)
      .enter()
      .append("path")
      .attr("class", "line")
      .attr("d", line as any)
      .attr("fill", "none")
      .attr("stroke", (d) => colorScale(d.key) as string)
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke-width", 3);
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-width", 2);
      });

    // 绘制X轴
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.format("d"));
    g.append("g")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "11px")
      .style("fill", "#aaa");

    g.append("text")
      .attr("transform", `translate(${chartWidth / 2}, ${chartHeight + 35})`)
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#666")
      .text("年份");

    // 绘制Y轴
    const yAxis = d3.axisLeft(yScale);
    g.append("g")
      .call(yAxis)
      .selectAll("text")
      .style("font-size", "11px")
      .style("fill", "#666");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -45)
      .attr("x", -chartHeight / 2)
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#666")
      .text("论文数量");

    // 绘制图例
    const legend = g
      .append("g")
      .attr("transform", `translate(${chartWidth + 10}, 20)`);

    venues.forEach((venue, index) => {
      const legendItem = legend
        .append("g")
        .attr("transform", `translate(0, ${index * 20})`)
        .style("cursor", "pointer");

      legendItem
        .append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", colorScale(venue) as string)
        .attr("opacity", 0.6);

      legendItem
        .append("text")
        .attr("x", 20)
        .attr("y", 12)
        .style("font-size", "11px")
        .style("fill", "#fff")
        .text(venue);
    });

    // 添加垂直参考线和年份信息显示
    const focus = g.append("g").attr("class", "focus").style("display", "none");

    // 垂直参考线
    const focusLine = focus
      .append("line")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "3,3")
      .attr("y1", 0)
      .attr("y2", chartHeight);

    // 年份标签背景
    const focusRect = focus
      .append("rect")
      .attr("x", -30)
      .attr("y", chartHeight + 5)
      .attr("width", 60)
      .attr("height", 20)
      .attr("fill", "rgba(0, 0, 0, 0.8)")
      .attr("rx", 4);

    // 年份文本
    const focusText = focus
      .append("text")
      .attr("x", 0)
      .attr("y", chartHeight + 18)
      .attr("text-anchor", "middle")
      .style("fill", "white")
      .style("font-size", "12px")
      .style("font-weight", "bold");

    // 添加透明的覆盖层来捕获鼠标事件
    const overlay = g
      .append("rect")
      .attr("class", "overlay")
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("mouseover", () => focus.style("display", null))
      .on("mouseout", () => focus.style("display", "none"))
      .on("mousemove", function (event) {
        const [mouseX] = d3.pointer(event);
        const year = Math.round(xScale.invert(mouseX));

        // 找到最接近的年份数据
        const yearData =
          data.find((d) => d.year === year) ||
          data.reduce((prev, curr) =>
            Math.abs(curr.year - year) < Math.abs(prev.year - year)
              ? curr
              : prev
          );

        if (yearData) {
          const xPos = xScale(yearData.year);
          focusLine.attr("x1", xPos).attr("x2", xPos);
          focusRect.attr("x", xPos - 30);
          focusText.attr("x", xPos).text(yearData.year);

          // 构建该年份各顶会的论文数量信息
          const venueCounts = venues
            .map((venue) => ({
              venue,
              count: yearData[venue] as number,
            }))
            .filter((item) => item.count > 0)
            .sort((a, b) => b.count - a.count);

          const totalCount = venueCounts.reduce(
            (sum, item) => sum + item.count,
            0
          );

          let tooltipHtml = `<strong>${yearData.year} 年</strong><br/>`;
          tooltipHtml += `<div style="margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 6px;">`;
          tooltipHtml += `<div style="margin-bottom: 4px; font-size: 11px; color: #e0e0e0;">总论文数: <strong style="color: #fff;">${totalCount}</strong></div>`;

          venueCounts.forEach((item) => {
            const color = colorScale(item.venue) as string;
            tooltipHtml += `<div style="margin-bottom: 3px; font-size: 11px;">`;
            tooltipHtml += `<span style="display: inline-block; width: 10px; height: 10px; background: ${color}; margin-right: 6px; border-radius: 2px;"></span>`;
            tooltipHtml += `${item.venue}: <strong style="color: #fff;">${item.count}</strong> 篇`;
            tooltipHtml += `</div>`;
          });

          tooltipHtml += `</div>`;

          // 计算tooltip位置，避免超出屏幕边界
          const tooltipWidth = 250;
          const tooltipHeight = 150;
          let tooltipLeft = event.pageX + 15;
          let tooltipTop = event.pageY - 15;

          // 如果tooltip会超出右边界，显示在鼠标左侧
          if (tooltipLeft + tooltipWidth > window.innerWidth) {
            tooltipLeft = event.pageX - tooltipWidth - 15;
          }

          // 如果tooltip会超出下边界，显示在鼠标上方
          if (tooltipTop + tooltipHeight > window.innerHeight) {
            tooltipTop = event.pageY - tooltipHeight - 15;
          }

          // 确保不超出左边界和上边界
          tooltipLeft = Math.max(15, tooltipLeft);
          tooltipTop = Math.max(15, tooltipTop);

          tooltip
            .html(tooltipHtml)
            .style("visibility", "visible")
            .style("left", tooltipLeft + "px")
            .style("top", tooltipTop + "px")
            .style("max-width", tooltipWidth + "px");
        }
      });
  }, [papers, filter]);

  useEffect(() => {
    drawTrend();
  }, [drawTrend]);

  return (
    <div
      ref={containerRef}
      className="conference-trend-container"
      style={{ width: "100%", height: "100%", minHeight: 0 }}
    >
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default ConferenceTrend;
