# csrenderer 参考源码与接口核对

参考用户提供的 Java 源码，仅借鉴功能与数据协议；未将压缩包或其源码纳入本项目。

## 读榜协议

`Accesser.accessDetailedRankings` 使用管理站的 `GET https://accoding.buaa.edu.cn:4000/api/contests/{id}/rank`。返回值的外层 JSON 是字符串，字符串内部才是榜单数组。因此 `response.json()` 后还需要再解析一次。脚本也接受已经解析好的数组，格式错误则明确报错。

原站 `/contest-ng/factory.js` 中 `Rank` 工厂使用完全相同的地址，并执行 `Rank.data = JSON.parse(res.data)`。其 `doRankStatistics` 遍历每名用户的 `detail`：每个题目明细计一次尝试，`result === 'AC'` 计一次通过。`wrong_count + 1` 是另一项提交次数统计，不是本看板的口径。

本脚本按赛事详情的 `contest_problem_list.order` 排序，将题序映射到榜单的 A、B、C…键。保留原站 Z 之后的键规则，展示标签采用 AA、AB…。空结果（尚在评测）计入尝试，空明细不计入；重复提交不会重复增加人数。

`Accesser.accessRankings` 则读取**不带 4000 端口**的旧地址，期望 `triedPeopleCount`、`acceptedPeopleCount` 等聚合映射。这与管理站接口的返回形状不同，不能把该方法原样复制到当前脚本。看板保持同源读取，不向另一个端口发送 Cookie。

## 可借鉴的功能

| 参考文件 | 功能 | 本项目状态 |
| --- | --- | --- |
| RankingsPanel2 / SingleProblemPanel | 彩色双柱、人数、倒计时 | 已实现，支持未开始、进行中和已结束 |
| SingleProblemPanel | 新增通过时的上浮提示 | 1.2.0 已加入；显示本次刷新新增的通过人数，首次加载不播放，尊重减少动态效果设置 |
| SubmissionsPanel | 按选手、题目、结果、耗时等排序的提交列表 | 后续候选；赛时页已有提交筛选，应优先补充该页排序，避免重复拉取数据 |
| Settings / SingleProblemPanel | 手动指定总人数及固定纵轴 | 后续候选；当前纵轴自动按榜单人数缩放 |
| Accesser.accessSubmissions | `/submissions_package` 批量导出 | 未接入；参考结构包含源码及选手信息，柱状统计不需要这些内容 |

原程序主循环每秒读榜且不断重绘；浏览器版保持 15/30/60 秒刷新，并在关闭或后台时暂停，动画使用 CSS，不增加接口轮询。

## 2026-09-14 验证

- 当前账号的可管理赛事与小组赛事列表均仅提供赛事 1299；该赛未开始。真实 `/rank` 返回 JSON 字符串 `"[]"`，看板正确显示十道题与零人数，时间来自服务器，赛时主题正常。
- 比对原站 `Rank` 源码与参考 Java 中的统计定义。
- 非空榜使用无个人信息的合成数据验证：十一题人数逐项与参考图一致；进行中、已结束、权限错误、失败保留、重试、暂停与关闭中断通过。
- 单元测试覆盖普通数组、双层 JSON、待评测的空结果、空明细与无效响应。
- 尚无该账号可访问的真实非空榜可用于验证；不把模拟结果称为真实进行中或已结束比赛的实测。
