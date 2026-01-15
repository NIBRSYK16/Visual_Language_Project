/**
 * 3D作者合作网络组件
 * 使用Three.js实现3D力导向图展示作者合作关系
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Input } from 'antd';
import { Paper, FilterCondition, AuthorNetwork, AuthorNode, AuthorLink } from '@/types';
import { buildAuthorNetwork, applyFilter } from '@/services/dataProcessor';
import './index.less';

const { Search } = Input;

interface CoAuthorNetwork3DProps {
  papers: Paper[];
  filter: FilterCondition;
}

interface Node3D extends AuthorNode {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  sphere?: THREE.Mesh;
  label?: THREE.Sprite;
}

interface Link3D extends AuthorLink {
  line?: THREE.Line;
}

const CoAuthorNetwork3D: React.FC<CoAuthorNetwork3DProps> = ({ papers, filter }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const nodesRef = useRef<Node3D[]>([]);
  const linksRef = useRef<Link3D[]>([]);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const isStableRef = useRef(false); // 标记网络是否已稳定
  const stableFrameCountRef = useRef(0); // 稳定帧计数
  const [selectedAuthor, setSelectedAuthor] = useState<{
    node: AuthorNode;
    x: number;
    y: number;
  } | null>(null);

  // 创建文本精灵 - 改进版本，确保颜色对比明显，无边框
  const createTextSprite = (text: string, fontSize: number, color: string, isHighlighted: boolean = false) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.font = `bold ${fontSize}px Arial`;
    const metrics = context.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    const padding = 8;
    canvas.width = textWidth + padding * 2;
    canvas.height = textHeight + padding * 2;

    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // 添加半透明背景以提高可读性（无边框）
    context.fillStyle = isHighlighted ? 'rgba(77, 171, 247, 0.85)' : 'rgba(0, 0, 0, 0.75)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // 不使用描边，直接使用高对比度文字颜色
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // 使用高对比度颜色，确保清晰可见
    const textColor = isHighlighted ? '#ffffff' : '#ffffff';
    context.fillStyle = textColor;
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      depthTest: false, // 禁用深度测试，确保标签始终在前面
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(canvas.width * 0.5, canvas.height * 0.5, 1);
    sprite.renderOrder = 999; // 设置高渲染顺序，确保标签在节点前面
    return sprite;
  };

  // 初始化3D场景
  const initScene = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 600;

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    // 创建相机
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
    camera.position.set(0, 0, 300);
    cameraRef.current = camera;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 添加光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x4dabf7, 0.8, 1000);
    pointLight1.position.set(200, 200, 200);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff6b6b, 0.6, 1000);
    pointLight2.position.set(-200, -200, 200);
    scene.add(pointLight2);

    // 鼠标交互
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      isDraggingRef.current = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
      previousMousePositionRef.current = previousMousePosition;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !cameraRef.current) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      // 旋转相机
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(cameraRef.current.position);
      // 调低灵敏度（再次降低）
      const ROTATE_SPEED = 0.0015;
      spherical.theta -= deltaX * ROTATE_SPEED;
      spherical.phi += deltaY * ROTATE_SPEED;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

      cameraRef.current.position.setFromSpherical(spherical);
      cameraRef.current.lookAt(0, 0, 0);
    };

    const handleMouseUp = () => {
      isDragging = false;
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      // 略微提高缩放灵敏度，但仍保持平滑，并限制最近/最远距离
      const ZOOM_SPEED = 0.005;
      const delta = e.deltaY * ZOOM_SPEED;
      const distance = cameraRef.current.position.length();
      const newDistance = Math.max(150, Math.min(500, distance + delta));
      cameraRef.current.position.normalize().multiplyScalar(newDistance);
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // 点击检测（延迟绑定，确保在drawNetwork3D之后）
    let clickHandler: ((e: MouseEvent) => void) | null = null;
    
    const setupClickHandler = () => {
      if (clickHandler) {
        container.removeEventListener('click', clickHandler);
      }
      
      clickHandler = (e: MouseEvent) => {
        if (isDraggingRef.current) return;

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const spheres = nodesRef.current.map((n) => n.sphere!).filter(Boolean);
        const intersects = raycaster.intersectObjects(spheres);

        if (intersects.length > 0) {
          const clickedSphere = intersects[0].object as THREE.Mesh;
          const node = nodesRef.current.find((n) => n.sphere === clickedSphere);
          if (node) {
            setSelectedAuthor({
              node,
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }
        } else {
          setSelectedAuthor(null);
        }
      };
      
      container.addEventListener('click', clickHandler);
    };
    
    // 延迟设置点击处理器
    setTimeout(setupClickHandler, 100);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      if (clickHandler) {
        container.removeEventListener('click', clickHandler);
      }
    };
  }, []);

  // 绘制3D网络
  const drawNetwork3D = useCallback(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    // 清除旧的对象
    nodesRef.current.forEach((node) => {
      if (node.sphere) {
        scene.remove(node.sphere);
        node.sphere.geometry.dispose();
        (node.sphere.material as THREE.Material).dispose();
      }
      if (node.label) {
        scene.remove(node.label);
        (node.label.material as THREE.SpriteMaterial).map?.dispose();
        node.label.material.dispose();
      }
    });
    linksRef.current.forEach((link) => {
      if (link.line) {
        scene.remove(link.line);
        link.line.geometry.dispose();
        link.line.material.dispose();
      }
    });

    const filteredPapers = applyFilter(papers, filter);
    const network = buildAuthorNetwork(filteredPapers);

    if (!network || !network.nodes || network.nodes.length === 0) {
      return;
    }

    // buildAuthorNetwork返回的是edges，不是links
    const networkEdges = network.edges || [];

    // 判断节点是否匹配搜索
    const isNodeMatched = (node: AuthorNode): boolean => {
      if (!searchText.trim()) return true; // 如果没有搜索文本，显示所有节点
      const searchLower = searchText.toLowerCase().trim();
      const nodeNameLower = (node.name || '').toLowerCase();
      const nodeIdLower = (node.id || '').toLowerCase();
      const nameParts = nodeNameLower.split(/\s+/);
      const matchesName = nodeNameLower.includes(searchLower) || nameParts.some(part => part.includes(searchLower));
      const matchesId = nodeIdLower.includes(searchLower);
      return matchesName || matchesId;
    };

    // 如果有搜索文本，只显示匹配的节点和与其相连的节点
    let nodesToDisplay: AuthorNode[] = [];
    let linksToDisplay: AuthorLink[] = [];

    if (searchText.trim()) {
      // 找到所有匹配的节点
      const matchedNodes = network.nodes.filter(isNodeMatched);
      const matchedNodeIds = new Set(matchedNodes.map((n) => n.id));
      
      // 找到与匹配节点相连的所有节点
      const connectedNodeIds = new Set<string>();
      matchedNodeIds.forEach((nodeId) => {
        networkEdges.forEach((edge) => {
          if (edge.source === nodeId) {
            connectedNodeIds.add(edge.target);
          }
          if (edge.target === nodeId) {
            connectedNodeIds.add(edge.source);
          }
        });
      });

      // 合并匹配节点和相连节点
      const allDisplayNodeIds = new Set([...matchedNodeIds, ...connectedNodeIds]);
      nodesToDisplay = network.nodes.filter((node) => allDisplayNodeIds.has(node.id));

      // 只显示连接这些节点的边
      const displayNodeIds = new Set(nodesToDisplay.map((n) => n.id));
      linksToDisplay = networkEdges
        .filter((edge) => displayNodeIds.has(edge.source) && displayNodeIds.has(edge.target))
        .map((edge) => ({
          source: nodesToDisplay.find((n) => n.id === edge.source)!,
          target: nodesToDisplay.find((n) => n.id === edge.target)!,
          weight: edge.weight,
        }));
    } else {
      // 没有搜索文本时，限制节点数量
      const MAX_NODES_TO_DISPLAY = 80;
      if (network.nodes.length <= MAX_NODES_TO_DISPLAY) {
        nodesToDisplay = network.nodes;
        // 将edges转换为links格式
        linksToDisplay = networkEdges.map((edge) => ({
          source: nodesToDisplay.find((n) => n.id === edge.source) || { id: edge.source, name: '', count: 0 },
          target: nodesToDisplay.find((n) => n.id === edge.target) || { id: edge.target, name: '', count: 0 },
          weight: edge.weight,
        }));
      } else {
        // 优先选择论文数量多的节点
        const sortedNodes = [...network.nodes].sort((a, b) => b.count - a.count);
        nodesToDisplay = sortedNodes.slice(0, MAX_NODES_TO_DISPLAY);
        const nodeIds = new Set(nodesToDisplay.map((n) => n.id));
        // 将edges转换为links格式，并过滤
        linksToDisplay = networkEdges
          .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
          .map((edge) => ({
            source: nodesToDisplay.find((n) => n.id === edge.source)!,
            target: nodesToDisplay.find((n) => n.id === edge.target)!,
            weight: edge.weight,
          }));
      }
    }

    // 初始化3D节点（使用更均匀的初始分布，减少初始碰撞）
    const nodes3D: Node3D[] = nodesToDisplay.map((node, index) => {
      // 使用球面分布而不是随机分布，减少初始碰撞
      const radius = 100;
      const theta = Math.acos(2 * (index / nodesToDisplay.length) - 1); // 纬度
      const phi = 2 * Math.PI * index * 0.618; // 黄金角度分布
      const position = new THREE.Vector3(
        radius * Math.sin(theta) * Math.cos(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(theta),
      );
      const velocity = new THREE.Vector3(0, 0, 0);
      return {
        ...node,
        position,
        velocity,
      };
    });
    nodesRef.current = nodes3D;

    // 创建3D链接
    const links3D: Link3D[] = linksToDisplay.map((link) => ({
      ...link,
    }));
    linksRef.current = links3D;

    // 创建节点球体
    nodes3D.forEach((node) => {
      const radius = Math.sqrt(node.count) * 2 + 3;
      const geometry = new THREE.SphereGeometry(radius, 16, 16);
      
      const isMatched = isNodeMatched(node);
      const isSelected = selectedAuthor?.node.id === node.id;
      
      let color: number;
      if (isSelected) {
        color = 0x4dabf7;
      } else if (isMatched) {
        color = 0x4dabf7;
      } else {
        const brightColors = [0x4dabf7, 0x51cf66, 0xffa94d, 0xf783ac, 0xb197fc, 0x66d9ef, 0xff6b6b, 0x74c0fc, 0xffd43b, 0xff922b];
        color = brightColors[Math.floor(Math.random() * brightColors.length)];
      }

      const material = new THREE.MeshPhongMaterial({
        color,
        emissive: isSelected || isMatched ? color : 0x000000,
        emissiveIntensity: isSelected || isMatched ? 0.3 : 0,
        shininess: 100,
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(node.position);
      sphere.userData = { node };
      node.sphere = sphere;
      scene.add(sphere);

      // 创建标签 - 确保始终在节点前面显示
      const labelText = node.name || (node.id ? `作者-${node.id}` : '未知作者');
      const isHighlighted = isMatched || isSelected;
      const labelColor = isHighlighted ? '#4dabf7' : '#fff';
      const label = createTextSprite(labelText, 12, labelColor, isHighlighted);
      if (label) {
        // 将标签位置设置在节点前面（相对于相机方向）
        label.position.copy(node.position);
        // 将标签放在节点上方，并稍微向前偏移，确保始终可见
        label.position.y += radius + 8;
        // 设置标签始终面向相机
        label.lookAt(cameraRef.current?.position || new THREE.Vector3(0, 0, 0));
        node.label = label;
        scene.add(label);
      }
    });

    // 创建连线
    links3D.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const sourceNode = nodes3D.find((n) => n.id === sourceId);
      const targetNode = nodes3D.find((n) => n.id === targetId);
      if (!sourceNode || !targetNode) return;

      const geometry = new THREE.BufferGeometry().setFromPoints([
        sourceNode.position,
        targetNode.position,
      ]);

      const sourceMatched = searchText.trim() ? isNodeMatched(sourceNode) : false;
      const targetMatched = searchText.trim() ? isNodeMatched(targetNode) : false;
      const isMatched = sourceMatched || targetMatched;
      const material = new THREE.LineBasicMaterial({
        color: isMatched ? 0x4dabf7 : 0xffffff,
        opacity: isMatched ? 0.6 : 0.3,
        transparent: true,
      });

      const line = new THREE.Line(geometry, material);
      link.line = line;
      scene.add(line);
    });
  }, [papers, filter, searchText, selectedAuthor]);

  // 3D力导向模拟
  const simulatePhysics = useCallback(() => {
    if (nodesRef.current.length === 0) return;

    const hasSearch = searchText.trim().length > 0;

    // 有搜索时，使用静态布局，只更新连线位置，避免持续收缩和漂浮
    if (hasSearch) {
      const nodes = nodesRef.current;
      const links = linksRef.current;

      links.forEach((link) => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        const sourceNode = nodes.find((n) => n.id === sourceId);
        const targetNode = nodes.find((n) => n.id === targetId);
        if (!sourceNode || !targetNode || !link.line) return;

        const geometry = link.line.geometry as THREE.BufferGeometry;
        geometry.setFromPoints([sourceNode.position, targetNode.position]);
      });

      return;
    }

    // 如果网络已稳定，只更新连线位置（不更新节点位置）
    if (isStableRef.current) {
      const links = linksRef.current;
      const nodes = nodesRef.current;
      links.forEach((link) => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        const sourceNode = nodes.find((n) => n.id === sourceId);
        const targetNode = nodes.find((n) => n.id === targetId);
        if (!sourceNode || !targetNode || !link.line) return;

        const geometry = link.line.geometry as THREE.BufferGeometry;
        geometry.setFromPoints([sourceNode.position, targetNode.position]);
      });
      return;
    }

    const nodes = nodesRef.current;
    const links = linksRef.current;
    const damping = 0.7; // 阻尼
    const repulsionStrength = 15; // 排斥力强度
    const attractionStrength = 0.004; // 吸引力强度
    const maxVelocity = 0.8; // 速度限制
    const minDistance = 5; // 最小距离，避免除零
    const stabilityThreshold = 0.02; // 稳定阈值
    const stableFramesRequired = 15; // 需要连续稳定的帧数

    let maxSpeed = 0;

    // 计算排斥力
    nodes.forEach((nodeA, i) => {
      nodeA.velocity.multiplyScalar(damping);
      nodes.forEach((nodeB, j) => {
        if (i === j) return;
        const distance = nodeA.position.distanceTo(nodeB.position);
        if (distance > minDistance) {
          // 使用更平滑的力函数
          const force = repulsionStrength / (distance * distance + 1);
          const direction = new THREE.Vector3()
            .subVectors(nodeA.position, nodeB.position)
            .normalize();
          nodeA.velocity.add(direction.multiplyScalar(force));
        }
      });
    });

    // 计算吸引力（基于链接）
    links.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const sourceNode = nodes.find((n) => n.id === sourceId);
      const targetNode = nodes.find((n) => n.id === targetId);
      if (!sourceNode || !targetNode) return;

      const distance = sourceNode.position.distanceTo(targetNode.position);
      const idealDistance = 80;
      // 使用更平滑的吸引力计算
      const force = (distance - idealDistance) * attractionStrength * (link.weight || 1);

      if (Math.abs(force) > 0.001) { // 只在力足够大时应用
        const direction = new THREE.Vector3()
          .subVectors(targetNode.position, sourceNode.position)
          .normalize();

        sourceNode.velocity.add(direction.multiplyScalar(force));
        targetNode.velocity.sub(direction.multiplyScalar(force));
      }
    });

    // 更新位置并检测稳定性
    nodes.forEach((node) => {
      // 限制速度
      const speed = node.velocity.length();
      if (speed > maxVelocity) {
        node.velocity.normalize().multiplyScalar(maxVelocity);
      }
      
      maxSpeed = Math.max(maxSpeed, speed);
      
      // 如果速度很小，直接设为0以减少抖动
      if (speed < 0.003) {
        node.velocity.set(0, 0, 0);
      } else {
        // 进一步降低移动速度
        const velocityStep = node.velocity.clone().multiplyScalar(0.5);
        node.position.add(velocityStep);
      }
      
      // 限制在合理范围内
      const maxDistance = 150;
      if (node.position.length() > maxDistance) {
        node.position.normalize().multiplyScalar(maxDistance);
      }

      // 更新3D对象位置
      if (node.sphere) {
        node.sphere.position.copy(node.position);
      }
      if (node.label && cameraRef.current) {
        const radius = Math.sqrt(node.count) * 2 + 3;
        node.label.position.copy(node.position);
        node.label.position.y += radius + 8;
        // 确保标签始终面向相机
        node.label.lookAt(cameraRef.current.position);
      }
    });

    // 检测稳定性
    if (maxSpeed < stabilityThreshold) {
      stableFrameCountRef.current++;
      if (stableFrameCountRef.current >= stableFramesRequired) {
        isStableRef.current = true;
        // 将所有速度设为0，并停止动画循环
        nodes.forEach((node) => {
          node.velocity.set(0, 0, 0);
        });
        // 停止动画循环
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      }
    } else {
      stableFrameCountRef.current = 0;
    }

    // 更新连线
    links.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const sourceNode = nodes.find((n) => n.id === sourceId);
      const targetNode = nodes.find((n) => n.id === targetId);
      if (!sourceNode || !targetNode || !link.line) return;

      const geometry = link.line.geometry as THREE.BufferGeometry;
      geometry.setFromPoints([sourceNode.position, targetNode.position]);
    });
  }, [searchText]);

  // 动画循环
  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    simulatePhysics();
    
    // 更新所有标签的朝向，确保始终面向相机
    if (cameraRef.current) {
      nodesRef.current.forEach((node) => {
        if (node.label) {
          node.label.lookAt(cameraRef.current!.position);
        }
      });
    }
    
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [simulatePhysics]);

  // 初始化
  useEffect(() => {
    const cleanup = initScene();
    return () => {
      if (cleanup) cleanup();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [initScene]);

  // 绘制网络
  useEffect(() => {
    drawNetwork3D();
  }, [drawNetwork3D]);

  // 启动动画循环
  useEffect(() => {
    if (isStableRef.current) {
      // 如果已稳定，只渲染一次
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      return;
    }
    
    const startAnimation = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      
      if (!isStableRef.current) {
        simulatePhysics();
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        animationFrameRef.current = requestAnimationFrame(startAnimation);
      } else {
        // 稳定后停止动画循环
        animationFrameRef.current = null;
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(startAnimation);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [simulatePhysics]);

  // 窗口大小调整
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = 600;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 获取作者的所有论文
  const getAuthorPapers = useCallback((authorId: string, papersList: Paper[]): Paper[] => {
    return papersList.filter((paper) =>
      paper.authors.some((author) => author.id === authorId),
    );
  }, []);

  // 获取作者的信息
  const getAuthorInfo = useCallback((authorId: string, papersList: Paper[]): {
    country?: string;
    affiliations: string[];
  } => {
    const affiliationsSet = new Set<string>();
    let country: string | undefined;

    papersList.forEach((paper) => {
      const author = paper.authors.find((a) => a.id === authorId);
      if (author) {
        if (author.affiliations && author.affiliations.length > 0) {
          author.affiliations.forEach((aff) => {
            if (aff && aff.trim()) {
              affiliationsSet.add(aff.trim());
            }
          });
        }
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

  const filteredPapers = applyFilter(papers, filter);
  const selectedNode = selectedAuthor?.node;
  const authorInfo = selectedNode ? getAuthorInfo(selectedNode.id, filteredPapers) : null;
  const authorPapers = selectedNode ? getAuthorPapers(selectedNode.id, filteredPapers) : [];

  return (
    <div className="co-author-network-3d-container">
      <div className="co-author-network-search">
        <Search
          placeholder="搜索作者名称或ID"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
      </div>
      <div ref={containerRef} className="network-3d-canvas" />
      {selectedAuthor && selectedNode && (
        <div
          className="author-card"
          style={{
            position: 'absolute',
            left: `${selectedAuthor.x + 20}px`,
            top: `${selectedAuthor.y}px`,
            background: 'rgba(26, 26, 46, 0.95)',
            border: '1px solid rgba(77, 171, 247, 0.5)',
            borderRadius: '8px',
            padding: '16px',
            minWidth: '300px',
            maxWidth: '400px',
            maxHeight: '500px',
            overflowY: 'auto',
            zIndex: 1000,
            color: '#fff',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>
              {selectedNode.name || selectedNode.id}
            </div>
            <button
              onClick={() => setSelectedAuthor(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 8px',
              }}
            >
              ×
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
            论文数: {selectedNode.count} | 合作数: {selectedNode.connections || 0}
          </div>
          {authorInfo && (
            <>
              {authorInfo.country && (
                <div style={{ fontSize: '11px', color: '#e0e0e0', marginBottom: '4px' }}>
                  <span style={{ color: '#87ceeb' }}>国家:</span> {authorInfo.country}
                </div>
              )}
              {authorInfo.affiliations.length > 0 && (
                <div style={{ fontSize: '11px', color: '#e0e0e0', marginBottom: '4px' }}>
                  <span style={{ color: '#87ceeb' }}>机构:</span>{' '}
                  {authorInfo.affiliations.slice(0, 3).join(', ')}
                  {authorInfo.affiliations.length > 3 && ` (+${authorInfo.affiliations.length - 3})`}
                </div>
              )}
            </>
          )}
          {authorPapers.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '11px', color: '#87ceeb' }}>
                发表的论文 ({authorPapers.length}):
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {authorPapers.slice(0, 10).map((paper, index) => (
                  <div
                    key={paper.id}
                    style={{
                      marginBottom: '8px',
                      fontSize: '10px',
                      lineHeight: '1.4',
                    }}
                  >
                    <span style={{ color: '#87ceeb', fontWeight: 500 }}>{index + 1}.</span>{' '}
                    {(() => {
                      // 构建论文链接：优先使用url，其次doi，再次dblpKey
                      let paperUrl: string | undefined;
                      if (paper.url) {
                        paperUrl = paper.url;
                      } else if (paper.doi) {
                        paperUrl = `https://doi.org/${paper.doi}`;
                      } else if (paper.dblpKey) {
                        paperUrl = `https://dblp.org/rec/${paper.dblpKey}.html`;
                      }
                      
                      // 如果有链接，使用a标签；否则使用span
                      if (paperUrl) {
                        return (
                          <a
                            href={paperUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#4dabf7',
                              textDecoration: 'none',
                              wordBreak: 'break-word',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#74c0fc';
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#4dabf7';
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            {paper.title}
                          </a>
                        );
                      } else {
                        return (
                          <span
                            style={{
                              color: '#e8f4f8',
                              wordBreak: 'break-word',
                              cursor: 'default',
                            }}
                          >
                            {paper.title}
                          </span>
                        );
                      }
                    })()}
                    <div style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>
                      {paper.venue?.name} ({paper.year})
                    </div>
                  </div>
                ))}
                {authorPapers.length > 10 && (
                  <div style={{ fontSize: '10px', color: '#aaa', marginTop: '8px' }}>
                    ...还有 {authorPapers.length - 10} 篇论文
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoAuthorNetwork3D;
