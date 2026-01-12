# Python爬虫使用说明

## 概述

使用Python编写的学术文献数据爬虫，从DBLP等数据源获取2011-2025年顶会论文数据。

## 安装

### 1. 安装Python依赖

```bash
cd crawler
pip install -r requirements.txt
```

或者使用conda：

```bash
conda install --file requirements.txt
```

## 使用方法

### 基本使用

```bash
python main.py
```

### 配置

编辑 `config.py` 文件可以修改：

- **会议列表**: 修改 `VENUES` 字典
- **年份范围**: 修改 `YEAR_START` 和 `YEAR_END`
- **请求延迟**: 修改 `DBLP_API['request_delay']` 和 `SEMANTIC_SCHOLAR_API['request_delay']`
- **输出路径**: 修改 `OUTPUT_DIR` 和 `OUTPUT_FILE`

## 数据来源

### DBLP数据库（主要数据源）

- 提供论文基础信息：标题、作者、年份、会议、DOI等
- 免费使用，无需API key
- 建议请求间隔：1.5秒

### Semantic Scholar API（可选补充）

- 可以补充：引用数、关键词、摘要、引用关系
- 免费版限制：每分钟100次请求
- 当前版本默认不启用（可修改代码启用）

## 输出文件

- **主要输出**: `../public/data/papers.json` - 系统使用的数据文件
- **备份文件**: `../data/raw/papers_{timestamp}.json` - 带时间戳的备份文件

## 数据格式

输出的JSON文件格式符合项目的Paper接口定义，包含以下字段：

- `id`: 论文唯一标识
- `title`: 论文标题
- `authors`: 作者列表（包含id、name、affiliations、country）
- `venue`: 会议信息（name、type、tier）
- `year`: 发表年份
- `keywords`: 关键词列表（DBLP不提供，为空数组）
- `abstract`: 摘要（部分论文有）
- `references`: 引用ID列表（DBLP不提供，为空数组）
- `citations`: 被引用次数（DBLP不提供，为0）
- `doi`: DOI标识
- `url`: 论文链接

## 注意事项

1. **运行时间**: 由于API限制，完整爬取可能需要较长时间（约30-60分钟）
2. **数据完整性**: 
   - DBLP可能不包含所有论文
   - 某些字段（关键词、引用数）需要从其他来源补充
3. **网络要求**: 需要能够访问DBLP和Semantic Scholar的API
4. **使用条款**: 请遵守DBLP和Semantic Scholar的使用条款

## 故障排查

### 问题：获取不到数据

- 检查网络连接
- 确认API可访问（访问 https://dblp.org/search/publ/api）
- 检查会议名称是否正确

### 问题：请求被限制

- 增加请求延迟时间（在config.py中修改）
- 分批运行爬虫（修改年份范围）

### 问题：依赖安装失败

- 确保Python版本 >= 3.7
- 使用虚拟环境：
  ```bash
  python -m venv venv
  source venv/bin/activate  # Windows: venv\Scripts\activate
  pip install -r requirements.txt
  ```

## 扩展功能

### 启用Semantic Scholar补充数据

在 `main.py` 中，可以添加代码使用Semantic Scholar API补充数据：

```python
from semantic_scholar_crawler import enhance_paper_with_semantic_scholar

# 在处理每个论文后
paper = enhance_paper_with_semantic_scholar(paper)
```

注意：这会大大增加运行时间。
