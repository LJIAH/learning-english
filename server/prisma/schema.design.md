用户想让我分析一下 `server/prisma/schema.prisma` 文件中各个表的关系。我需要先读取这个文件的内容，然后分析其中的模型和关系。
我已经读取了完整的 schema.prisma 文件，现在需要分析各个表之间的关系。让我梳理一下：

1. User 表 - 核心用户表
2. WordBookRecord - 用户单词学习记录（中间表）
3. WordBook - 单词表
4. PaymentRecord - 支付记录
5. CourseRecord - 课程购买记录（中间表）
6. Course - 课程表
7. Visitor - 访客统计表
8. PageView - PV 页面访问记录
9. TrackEvent - 用户行为表
10. PerformanceEntry - 性能指标表
11. ErrorEntry - 错误指标表

关系分析：

- User 1:N WordBookRecord（一个用户多条学习记录）
- WordBook 1:N WordBookRecord（一个单词被多个用户学习）
- User 1:N PaymentRecord（一个用户多条支付记录）
- User 1:N CourseRecord（一个用户多条课程记录）
- User 1:N Visitor（一个用户可能有多个访客记录？或者是可选的）
- PaymentRecord 1:N CourseRecord（一条支付可能对应多个课程购买）
- Course 1:N CourseRecord（一个课程被多个用户购买）
- Visitor 1:N PageView（一个访客多条页面访问）
- Visitor 1:N TrackEvent（一个访客多条行为记录）
- Visitor 1:N PerformanceEntry（一个访客多条性能记录）
- Visitor 1:N ErrorEntry（一个访客多条错误记录）

WordBookRecord 是 User 和 WordBook 的多对多中间表。
CourseRecord 是 User 和 Course 的多对多中间表，同时关联 PaymentRecord。

让我组织一下回答。
以下是 `schema.prisma` 中各个模型的关系分析：

---

### 一、核心实体表

| 模型            | 说明             |
| --------------- | ---------------- |
| `User`          | 用户表，系统核心 |
| `WordBook`      | 单词库           |
| `Course`        | 课程表           |
| `PaymentRecord` | 支付记录         |

---

### 二、关系关联图

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│    User     │◄──────┤  WordBookRecord  ├──────►│  WordBook   │
│  (1 : N)    │       │   (中间表)        │       │  (1 : N)    │
└──────┬──────┘       └──────────────────┘       └─────────────┘
       │
       │              ┌──────────────────┐
       ├─────────────►│  PaymentRecord   │◄──────┐
       │  (1 : N)     └────────┬─────────┘       │
       │                       │ (1 : N)         │
       │              ┌────────▼─────────┐       │
       └─────────────►│  CourseRecord    │       │
         (1 : N)      │   (中间表)        ├───────┘
                      └────────┬─────────┘
                               │
                      ┌────────▼─────────┐
                      │     Course       │
                      │    (1 : N)       │
                      └──────────────────┘
```

---

### 三、各关系详解

#### 1. `User` ↔ `WordBook`（多对多）

- 通过 **`WordBookRecord`** 中间表关联
- 一个用户可以学习多个单词，一个单词可以被多个用户学习
- `@@unique([userId, wordId])` 保证同一用户同一单词只有一条记录

#### 2. `User` → `PaymentRecord`（一对多）

- 一个用户可有多条支付记录
- 删除用户时级联删除其支付记录

#### 3. `User` → `Course`（多对多）

- 通过 **`CourseRecord`** 中间表关联
- `@@unique([userId, courseId])` 保证同一用户同一课程只有一条记录
- `CourseRecord` 同时关联 `PaymentRecord`，表示该课程购买是通过哪笔支付完成的

#### 4. `PaymentRecord` → `CourseRecord`（一对多）

- 一笔支付可能购买多个课程（或一个课程）
- `CourseRecord.paymentRecordId` 为可选（`String?`），说明存在未支付或免费获取课程的场景

---

### 四、埋点统计模块（Visitor 体系）

```
┌─────────────┐
│   Visitor   │
└──────┬──────┘
       │ 1 : N
       ├────────► PageView          (PV 页面访问)
       ├────────► TrackEvent        (用户行为事件)
       ├────────► PerformanceEntry  (性能指标: FP/FCP/LCP/CLS等)
       └────────► ErrorEntry        (JS错误监控)
```

- `Visitor` 是埋点统计的核心，通过 `anonymousId` 标识匿名访客，可选关联 `User`
- 删除 `Visitor` 时级联删除其所有 PV、事件、性能、错误记录
- `User` → `Visitor` 为 **1:N**，一个用户可能在多个设备/浏览器产生多个访客记录

---

### 五、索引设计亮点

| 表              | 索引                                           | 用途                         |
| --------------- | ---------------------------------------------- | ---------------------------- |
| `WordBook`      | `word`, `tag`, `[word, tag]`                   | 支持按单词、标签快速检索     |
| `PaymentRecord` | `tradeNo`                                      | 按支付宝交易号查询           |
| `PageView`      | `[visitorId, createdAt]`, `[path, createdAt]`  | 支持访客时间线、页面访问统计 |
| `TrackEvent`    | `[visitorId, createdAt]`, `[event, createdAt]` | 支持行为流水和事件聚合查询   |
