# 世界地图数据说明

## 数据来源

地图组件使用在线数据源：Natural Earth 110m 简化版世界地图

- CDN 地址: `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`
- 格式: TopoJSON
- 分辨率: 110m（中等分辨率，适合网页显示）

## 本地数据（可选）

如果需要使用本地数据（离线使用或更快的加载速度），可以：

1. 下载地图数据：
```bash
# 下载 TopoJSON 格式
curl -o public/data/countries-110m.json https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
```

2. 修改组件中的加载路径：
在 `src/components/GeoMap/index.tsx` 中，将：
```typescript
const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
```
改为：
```typescript
const response = await fetch('/data/countries-110m.json');
```

## 其他数据源选项

### Natural Earth 数据
- 50m 分辨率（更详细）: `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json`
- 10m 分辨率（最详细）: `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json`

### GeoJSON 格式
如果需要 GeoJSON 格式，可以使用 d3 转换：
```javascript
const topojson = await d3.json('countries-110m.json');
const geojson = d3.geoFeature(topojson, topojson.objects.countries);
```

## 数据字段说明

地图数据中的国家属性：
- `NAME`: 国家短名称
- `NAME_LONG`: 国家完整名称
- `ISO_A3`: ISO 3166-1 alpha-3 国家代码（用于数据匹配）

## 注意事项

1. 地图数据文件较大（110m 约 500KB），建议使用 CDN 或本地缓存
2. 某些小国或争议地区可能没有独立的 ISO 代码
3. 地图投影使用 Mercator 投影，适合显示大部分地区
