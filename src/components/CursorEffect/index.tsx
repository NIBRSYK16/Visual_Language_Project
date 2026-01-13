/**
 * 酷炫鼠标光标特效组件
 * 实现移动轨迹小白点效果
 */

import React, { useEffect, useRef } from 'react';
import './index.less';

const CursorEffect: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const cursorDisplayRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const animationFrameRef = useRef<number | null>(null);
  const lastDotTimeRef = useRef(0);
  const lastDotPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // 创建轨迹点
    const createTrailDot = (x: number, y: number) => {
      const dot = document.createElement('div');
      dot.className = 'cursor-trail-dot';
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      document.body.appendChild(dot);

      // 快速淡出并消失
      setTimeout(() => {
        dot.style.opacity = '0';
        dot.style.transform = 'translate(-50%, -50%) scale(0.5)';
      }, 10);

      // 清理
      setTimeout(() => {
        if (dot.parentNode) {
          dot.parentNode.removeChild(dot);
        }
      }, 400); // 400ms后完全消失
    };

    // 鼠标移动事件
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      const prev = mousePositionRef.current;
      const dx = x - prev.x;
      const dy = y - prev.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      mousePositionRef.current = { x, y };

      // 控制生成频率：每移动一定距离或时间间隔生成一个点
      const now = Date.now();
      const timeSinceLastDot = now - lastDotTimeRef.current;
      const distanceSinceLastDot = Math.sqrt(
        Math.pow(x - lastDotPositionRef.current.x, 2) + 
        Math.pow(y - lastDotPositionRef.current.y, 2)
      );

      // 如果移动距离超过15px或时间超过50ms，创建一个新点
      if (distanceSinceLastDot > 15 || timeSinceLastDot > 50) {
        createTrailDot(prev.x, prev.y); // 在旧位置创建点
        lastDotTimeRef.current = now;
        lastDotPositionRef.current = { x, y };
      }
    };

    // 鼠标进入页面
    const handleMouseEnter = () => {
      if (cursorRef.current) {
        cursorRef.current.style.opacity = '1';
      }
    };

    // 鼠标离开页面
    const handleMouseLeave = () => {
      if (cursorRef.current) {
        cursorRef.current.style.opacity = '0';
      }
    };

    // 点击效果
    const handleClick = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      
      // 创建点击波纹效果
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          createTrailDot(x, y);
        }, i * 20);
      }
      
      // 光标点击动画
      if (cursorRef.current) {
        cursorRef.current.style.transform = 'translate(-50%, -50%) scale(1.5)';
        cursorRef.current.style.borderColor = '#ff6b6b';
        setTimeout(() => {
          if (cursorRef.current) {
            cursorRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
            cursorRef.current.style.borderColor = '#ffffff';
          }
        }, 200);
      }
    };

    // 动画循环：平滑更新主光标位置
    const animate = () => {
      const target = mousePositionRef.current;
      const current = cursorDisplayRef.current;

      // 线性插值，让主光标平滑追随鼠标
      const FOLLOW_SPEED = 0.25;
      const nx = current.x + (target.x - current.x) * FOLLOW_SPEED;
      const ny = current.y + (target.y - current.y) * FOLLOW_SPEED;
      cursorDisplayRef.current = { x: nx, y: ny };

      if (cursorRef.current) {
        cursorRef.current.style.left = `${nx}px`;
        cursorRef.current.style.top = `${ny}px`;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);

    // 绑定事件
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      document.removeEventListener('click', handleClick);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <div ref={cursorRef} className="custom-cursor" />
    </>
  );
};

export default CursorEffect;
