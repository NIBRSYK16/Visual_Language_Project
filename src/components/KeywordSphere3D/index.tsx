/**
 * 3D球形关键词可视化组件
 * 使用Three.js实现真正的3D效果
 */

import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Paper } from '@/types';
import './index.less';

interface KeywordSphere3DProps {
  papers: Paper[];
  filter?: any;
  onKeywordClick?: (keyword: string) => void;
}

interface KeywordData {
  keyword: string;
  frequency: number;
  normalizedKeyword: string;
}

const KeywordSphere3D: React.FC<KeywordSphere3DProps> = ({ papers, filter, onKeywordClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0, y: 0 });

  // 提取并处理关键词数据
  const keywordsData = useMemo(() => {
    const keywordMap = new Map<string, number>();

    papers.forEach((paper) => {
      if (paper.keywords && paper.keywords.length > 0) {
        paper.keywords.forEach((keyword) => {
          const normalized = keyword.trim();
          if (normalized && normalized.length > 1) {
            keywordMap.set(normalized, (keywordMap.get(normalized) || 0) + 1);
          }
        });
      }
    });

    return Array.from(keywordMap.entries())
      .map(([keyword, frequency]) => ({
        keyword,
        frequency,
        normalizedKeyword: keyword.replace(/\s+/g, '_'),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 300); // 增加到300个关键词
  }, [papers]);

  useEffect(() => {
    if (!containerRef.current || keywordsData.length === 0) {
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // 创建相机
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 500;
    cameraRef.current = camera;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 创建文字精灵组
    const textGroup = new THREE.Group();
    scene.add(textGroup);

    // 创建字体加载器（使用Canvas 2D渲染文字）
    const createTextSprite = (text: string, fontSize: number, color: string) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;

      // 根据文字长度动态调整canvas大小
      const padding = 10;
      context.font = `bold ${fontSize}px Arial`;
      const metrics = context.measureText(text);
      const textWidth = metrics.width;
      const textHeight = fontSize;

      canvas.width = textWidth + padding * 2;
      canvas.height = textHeight + padding * 2;

      // 使用透明背景，只添加文字阴影效果
      context.clearRect(0, 0, canvas.width, canvas.height);

      // 添加文字描边（白色）增强可读性
      context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      context.lineWidth = 2;
      context.font = `bold ${fontSize}px Arial`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.strokeText(text, canvas.width / 2, canvas.height / 2);

      // 绘制文字
      context.fillStyle = color;
      context.fillText(text, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        alphaTest: 0.1
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(canvas.width * 0.5, canvas.height * 0.5, 1);

      return sprite;
    };

    // 计算频率范围用于颜色和大小映射
    const frequencies = keywordsData.map((k) => k.frequency);
    const minFreq = Math.min(...frequencies);
    const maxFreq = Math.max(...frequencies);

    // 使用斐波那契球面分布
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const radius = 200;

    keywordsData.forEach((keywordData, i) => {
      const y = 1 - (i / (keywordsData.length - 1)) * 2;
      const radius_at_y = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      const x = Math.cos(theta) * radius_at_y;
      const z = Math.sin(theta) * radius_at_y;

      // 计算字体大小和颜色
      const normalizedFreq = (keywordData.frequency - minFreq) / (maxFreq - minFreq);
      const fontSize = 14 + normalizedFreq * 18;
      // 使用更亮的颜色，从青色到紫色渐变
      const hue = 180 + normalizedFreq * 180; // 180到360的色相范围（青到紫）
      const saturation = 70 + normalizedFreq * 20; // 70%到90%饱和度
      const lightness = 55 + normalizedFreq * 25; // 55%到80%亮度
      const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

      const sprite = createTextSprite(keywordData.normalizedKeyword, fontSize, color);
      if (sprite) {
        sprite.position.set(x * radius, y * radius, z * radius);
        sprite.userData = { keyword: keywordData.keyword, frequency: keywordData.frequency };
        textGroup.add(sprite);
      }
    });

    // 添加环境光（更亮一些）
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // 添加多个点光源增强3D效果
    const pointLight1 = new THREE.PointLight(0xffffff, 0.8);
    pointLight1.position.set(200, 200, 200);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x8888ff, 0.6);
    pointLight2.position.set(-200, -200, 200);
    scene.add(pointLight2);

    // 鼠标交互
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      rotationRef.current.y += deltaX * 0.005;
      rotationRef.current.x += deltaY * 0.005;

      // 限制X轴旋转角度
      rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    // 鼠标滚轮缩放
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * 0.01;
      camera.position.z = Math.max(200, Math.min(800, camera.position.z + delta));
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // 鼠标悬停检测
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseMoveHover = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(textGroup.children, true);

      // 重置所有sprite的缩放
      textGroup.children.forEach((child) => {
        if (child instanceof THREE.Sprite) {
          child.scale.set(100, 25, 1);
        }
      });

      // 高亮悬停的sprite
      if (intersects.length > 0) {
        const sprite = intersects[0].object as THREE.Sprite;
        sprite.scale.set(150, 37.5, 1);
        container.style.cursor = 'pointer';
        if (sprite.userData.keyword) {
          container.title = `${sprite.userData.keyword} (${sprite.userData.frequency}次)`;
        }
      } else {
        container.style.cursor = isDraggingRef.current ? 'grabbing' : 'grab';
        container.title = '';
      }
    };

    container.addEventListener('mousemove', handleMouseMoveHover);

    // 点击选择关键词
    const handleClick = (e: MouseEvent) => {
      // 如果正在拖拽，不触发点击
      if (isDraggingRef.current) {
        return;
      }

      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(textGroup.children, true);

      if (intersects.length > 0 && onKeywordClick) {
        const sprite = intersects[0].object as THREE.Sprite;
        if (sprite.userData.keyword) {
          onKeywordClick(sprite.userData.keyword);
        }
      }
    };

    container.addEventListener('click', handleClick);

    // 自动旋转
    let autoRotateSpeed = 0.002;
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (!isDraggingRef.current) {
        rotationRef.current.y += autoRotateSpeed;
      }

      textGroup.rotation.y = rotationRef.current.y;
      textGroup.rotation.x = rotationRef.current.x;

      renderer.render(scene, camera);
    };

    animate();

    // 鼠标离开时恢复自动旋转
    let hoverTimeout: NodeJS.Timeout;
    container.addEventListener('mouseenter', () => {
      autoRotateSpeed = 0.001; // 减慢速度
    });
    container.addEventListener('mouseleave', () => {
      hoverTimeout = setTimeout(() => {
        autoRotateSpeed = 0.002; // 恢复速度
      }, 1000);
    });

    // 窗口大小调整
    const handleResize = () => {
      const newWidth = container.clientWidth || 800;
      const newHeight = container.clientHeight || 600;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // 清理函数
    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousemove', handleMouseMoveHover);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mouseenter', () => {});
      container.removeEventListener('mouseleave', () => {});
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (hoverTimeout) clearTimeout(hoverTimeout);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [keywordsData, onKeywordClick]);

  if (keywordsData.length === 0) {
    return (
      <div className="keyword-sphere-3d-container" style={{ textAlign: 'center', padding: '40px' }}>
        暂无关键词数据
      </div>
    );
  }

  return <div className="keyword-sphere-3d-container" ref={containerRef} />;
};

export default KeywordSphere3D;
