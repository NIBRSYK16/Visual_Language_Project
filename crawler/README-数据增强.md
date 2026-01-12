# 数据增强说明

## 问题

从DBLP爬取的数据缺少以下信息：
- **country**: 国家信息（用于地图可视化）
- **keywords**: 关键词（用于词云和关键词演化）
- **abstract**: 摘要
- **citations**: 引用数
- **references**: 引用关系

这是因为DBLP数据库本身不提供这些信息。

## 解决方案

### 方案1：使用Semantic Scholar API（推荐，但耗时）

Semantic Scholar API可以提供：
- keywords（关键词）
- abstract（摘要）
- citations（引用数）
- references（引用关系）
- authors.affiliations（作者机构，可用于推断country）

**优点**：
- 数据相对完整
- 可以自动获取机构信息并推断country

**缺点**：
- 运行时间很长（免费版限制每分钟100次请求）
- 对于19万+篇论文，可能需要数天时间

**使用方法**：
```bash
cd crawler
python enhance_data.py
```

### 方案2：手动补充关键字段（快速但不完整）

如果只需要补充country字段，可以：
1. 使用第三方数据集（如DBLP Discovery Dataset）
2. 手动标注部分数据
3. 接受缺失，让系统处理null值

### 方案3：接受缺失数据（最简单）

如果数据量太大，可以：
1. 保持country为null
2. 在地图可视化中，对于country为null的论文，可以：
   - 不显示在地图上
   - 或者标记为"未知国家"
   - 或者从其他字段推断（不太准确）

## 当前数据情况

从您的数据文件看：
- 所有论文的`country`字段都是`null`
- 所有论文的`keywords`都是空数组`[]`
- 所有论文的`abstract`都是空字符串`""`
- 所有论文的`citations`都是`0`
- 所有论文的`references`都是空数组`[]`
- 所有作者的`affiliations`都是空数组`[]`

## 建议

考虑到数据量（19万+篇论文），建议：

1. **短期方案**：先使用现有数据，在地图可视化中处理null值
2. **长期方案**：分批使用Semantic Scholar API补充数据（可能需要几天时间）
3. **折中方案**：只对部分重要论文（如高引用论文）使用API补充

## 使用数据增强工具

### 完整增强（使用Semantic Scholar API）

```bash
cd crawler
python enhance_data.py
```

这会：
- 提示是否使用Semantic Scholar API
- 如果选择是，会为每篇论文调用API
- 自动推断country
- 备份原文件
- 保存增强后的数据

### 仅补充country（如果已有机构信息）

如果您的数据中已经有机构信息，可以使用：

```python
from data_enhancer import enhance_paper_country_simple

# 处理单篇论文
enhanced = enhance_paper_country_simple(paper)
```

## 注意事项

1. **API限制**：Semantic Scholar免费版限制每分钟100次请求
2. **运行时间**：19万篇论文可能需要数天时间
3. **数据质量**：API返回的数据可能不完整或不准确
4. **备份**：运行增强工具前会自动备份原文件

## 其他数据源

如果不想使用API，可以考虑：

1. **DBLP Discovery Dataset (D3)**：包含机构信息的公开数据集
2. **ACM Digital Library**：需要访问权限
3. **手动标注**：对于重要论文手动补充
4. **接受缺失**：在可视化中处理null值
