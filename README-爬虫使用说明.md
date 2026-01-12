# 数据爬虫使用说明

## 概述

本爬虫脚本用于从DBLP数据库获取2011-2025年期间以下顶会的论文数据：
- SOSP
- OSDI
- USENIX ATC
- ASPLOS
- EuroSys
- SC (Supercomputing)

## 使用方法

### 1. 运行爬虫

```bash
cd literature-analysis-platform
node scripts/crawler/index.js
```

### 2. 输出文件

- **主要输出**: `public/data/papers.json` - 系统使用的数据文件
- **备份文件**: `data/raw/papers-{timestamp}.json` - 原始数据备份

## 数据来源

### DBLP数据库

- **API地址**: https://dblp.org/search/publ/api
- **数据格式**: JSON
- **访问限制**: 建议每次请求间隔至少1.5秒

### 数据字段说明

从DBLP获取的数据包含以下字段：
- `id`: 论文唯一标识（DBLP key或DOI）
- `title`: 论文标题
- `authors`: 作者列表（姓名和ID）
- `venue`: 会议信息
- `year`: 发表年份
- `doi`: DOI标识
- `url`: 论文链接
- `dblpKey`: DBLP数据库中的key

**注意**: 以下字段需要后续处理或使用其他数据源补充：
- `keywords`: 关键词（DBLP不提供，需要从其他来源获取）
- `abstract`: 摘要（部分论文有）
- `citations`: 引用数（需要从Semantic Scholar等获取）
- `references`: 引用关系（需要从其他来源获取）
- `country`: 国家信息（需要从作者机构推导）

## 配置说明

编辑 `scripts/crawler/config.js` 可以修改：

- **年份范围**: 修改 `YEAR_RANGE.start` 和 `YEAR_RANGE.end`
- **请求延迟**: 修改 `DBLP_API.requestDelay`（毫秒）
- **会议列表**: 修改 `DBLP_VENUE_MAP` 添加或修改会议

## 特殊说明

### USENIX ATC

ATC在DBLP中的标识较为特殊，脚本已做特殊处理，会尝试多种查询方式：
- `venue:conf/usenix:YYYY title:ATC`
- `venue:conf/atc:YYYY`
- `venue:conf/usenix/annual:YYYY`

### API限制

- DBLP API：建议每次请求间隔1.5秒以上
- Semantic Scholar API：免费版限制每分钟100次请求（如启用）

### 数据完整性

- DBLP数据可能不完整（特别是新论文）
- 某些字段（如关键词、引用数）需要从其他数据源补充
- 建议结合会议官网验证数据准确性

## 数据后处理建议

获取基础数据后，建议：

1. **验证数据完整性**: 对照会议官网检查论文数量
2. **补充缺失字段**:
   - 使用Semantic Scholar API获取引用数、关键词等
   - 从论文PDF或网站提取摘要
   - 从作者机构信息推导国家
3. **数据清洗**:
   - 去除重复论文
   - 标准化作者姓名
   - 规范化关键词

## 故障排查

### 问题：获取数据为空

- 检查网络连接
- 确认DBLP API可访问
- 检查会议标识是否正确

### 问题：请求被限制

- 增加请求延迟时间
- 分批运行爬虫（按会议或年份）

### 问题：数据不完整

- DBLP可能未收录所有论文
- 建议结合会议官网补充数据
- 使用Semantic Scholar API补充信息

## 注意事项

1. **遵守使用条款**: 请遵守DBLP的使用条款和API限制
2. **数据用途**: 确保数据使用符合相关法律法规
3. **定期更新**: 新论文可能需要时间才能被DBLP收录
4. **数据验证**: 建议人工验证关键数据
