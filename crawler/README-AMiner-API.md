# AMiner API 使用说明

## 概述

AMiner（学术搜索系统）提供API服务，可以获取论文的详细信息，包括摘要、关键词、引用数、作者机构等。

## 获取API密钥

### 步骤

1. **访问AMiner官网**
   - 网址：https://www.aminer.org
   - 注册/登录账号

2. **申请API访问权限**
   - 访问开发者中心（通常在网站底部或用户中心）
   - 申请API密钥
   - 查看API文档：https://doc.302.ai/

3. **获取API密钥**
   - API密钥通常格式类似：`your_api_key_here`
   - 妥善保管，不要泄露

## API接口说明

### 基础URL
```
https://datacenter.aminer.cn/gateway/open_platform/api
```

### 认证方式
使用JWT Token认证，需要：
1. 使用API Key和User ID生成JWT Token
2. 在请求头中添加：
```
Authorization: {生成的JWT_Token}
```

### JWT Token生成

需要使用`PyJWT`库生成Token：

```python
import jwt
import datetime

api_key = "your_api_key"
user_id = "your_user_id"

header = {"alg": "HS256", "sign_type": "SIGN"}
exp_time = datetime.datetime.utcnow() + datetime.timedelta(seconds=7200)
payload = {
    "user_id": user_id,
    "exp": exp_time.timestamp(),
    "timestamp": datetime.datetime.now().timestamp()
}

token = jwt.encode(payload, api_key, algorithm="HS256", headers=header)
```

### 主要接口

#### 1. 论文详情接口（主要接口）
- **URL**: `/paper/detail`
- **方法**: GET
- **参数**:
  - `id`: AMiner论文ID（必填）
- **返回**: 论文详细信息，包括摘要、关键词、作者机构等
- **费用**: 0.01元/次

**注意**：此接口需要论文ID，如果只有标题/DOI，需要先通过其他方式获取论文ID。

#### 2. 组合API（根据条件搜索）
- **费用**: 0.2元/次
- 可以根据论文发布时间、期刊等条件获取论文信息
- 具体接口文档请参考AMiner API文档

#### 3. 机构详情接口（可选）
- **URL**: `/organization/detail`
- **方法**: POST
- **参数**:
  - `ids`: 机构ID数组（JSON格式）
- **返回**: 机构详细信息

## 使用方法

### 方法1：使用环境变量（推荐）

```bash
export AMINER_API_KEY="your_api_key_here"
export AMINER_USER_ID="your_user_id"
python enhance_with_aminer.py
```

### 方法2：运行时输入

运行脚本时，会提示输入API密钥和用户ID

## 运行脚本

### 基本使用

```bash
cd crawler
python enhance_with_aminer.py
```

### 运行步骤

1. **输入API密钥**（如果没有设置环境变量）
2. **选择处理范围**：
   - 选项1：处理所有论文（可能受API限制）
   - 选项2：处理部分论文（指定索引范围）
   - 选项3：处理前N篇论文（推荐用于测试）
3. **确认开始处理**

## 可获取的信息

如果已有论文ID，使用AMiner API可以获取：

- ✅ **摘要（Abstract）**：论文摘要
- ✅ **关键词（Keywords）**：论文关键词
- ✅ **作者机构（Affiliations）**：作者所属机构
- ✅ **国家信息（Country）**：从机构信息推断

**注意**：论文详情接口不返回引用数，需要单独调用其他接口。

## 注意事项

### 1. API限制

- **速率限制**：AMiner API通常有调用频率限制
  - 免费版：通常每分钟10-100次请求
  - 付费版：限制更高
  - 具体限制请查看API文档

- **请求延迟**：脚本中设置了1秒延迟，避免触发限制
  - 如果仍然被限制，可以增加延迟时间

### 2. 数据匹配（重要限制）

- **AMiner API需要论文ID才能获取详情**
- 如果只有标题/DOI，无法直接使用论文详情接口
- 需要先通过其他方式获取论文ID，或者使用组合API
- 这是当前代码的主要限制

### 3. 数据完整性

- 不是所有论文都能在AMiner中找到
- 某些论文可能信息不完整
- 建议结合其他数据源

### 4. 成本

- **免费版**：通常有每日/每月调用限制
- **付费版**：根据套餐不同有不同的限制
- 请查看AMiner官网了解详细价格

## 运行时间估算

- **10篇论文**：约10-15秒（包含延迟）
- **100篇论文**：约2-3分钟
- **3641篇论文**：约1-2小时（受API限制影响）

## 故障排查

### 问题：API密钥无效

- 检查API密钥是否正确
- 确认API密钥是否已激活
- 查看API文档确认密钥格式

### 问题：请求被限制（429错误）

- 增加请求延迟时间（修改代码中的 `time.sleep(1.0)`）
- 减少批量处理的数量
- 检查API使用量是否超限

### 问题：找不到论文

- AMiner数据库中可能没有该论文
- 论文标题匹配可能不准确
- 可以尝试手动搜索确认论文是否存在

### 问题：数据格式错误

- 检查API返回的数据格式
- 查看API文档了解返回数据格式
- 可能需要调整数据解析逻辑

## 与其他方法比较

| 方法 | 优点 | 缺点 |
|------|------|------|
| AMiner API | 数据相对完整、有机构信息、有引用数 | 需要API密钥、有速率限制、可能匹配不到 |
| 网页爬虫 | 免费、数据真实 | 需要处理不同页面结构、可能被限制 |
| Semantic Scholar API | 统一接口 | 可能匹配不到、免费版限制严格 |

## 建议工作流程

1. **先测试**：使用选项3，处理前10-20篇论文，验证效果
2. **检查结果**：查看增强后的数据，确认质量
3. **批量处理**：如果效果满意，处理更多论文
4. **结合使用**：可以先用AMiner API，再用网页爬虫补充缺失的部分

## 相关资源

- AMiner官网：https://www.aminer.org
- API文档：https://doc.302.ai/
- 开发者中心：在AMiner官网查找
