# 内联的第三方代码：@liquidglass/web 引擎

- 来源：<https://github.com/Wei-Zhang09/LiquidGlassUI>（`packages/web`）
- 许可：**MIT**（见同目录 `LICENSE`，Copyright (c) 2026 Wei-Zhang09）
- 内联时间：2026-11-11，对应上游 commit `b3b8c2bd82c3499e96d46e1edaa9a7819a7f5157`
- 内联文件（原样复制，未改动逻辑）：
  - `capabilities.ts` —— 能力门控（UA 嗅探；`CSS.supports` 对 `backdrop-filter: url()` 会**谎报 true**）
  - `refraction.ts` —— Snell 定律边缘折射剖面 + 位移贴图 + 逐像素镜面高光贴图
  - `sdf.ts` —— 圆角矩形有向距离场（含多形状融合）
  - `core/filter-registry.ts` —— SVG 滤镜注册表，按几何参数缓存
  - `generated/tokens.ts` / `tokens.css` —— 设计令牌（光学参数、圆角、模糊档位）

## 为什么内联而不是 npm 安装

上游 v0.1.0 **尚未发布到 npm**（`registry.npmjs.org/@liquidglass/web` 返回 Not found），
只能取源码。引擎零运行时依赖（`dependencies: {}`，仅 peer `react>=18`），内联成本低。
未内联 `elements/`（Web Components）与 `react/` 封装：本项目已有 BentoCard / 浮层组件体系，
改用自定义元素会引入 shadow DOM 与既有 Tailwind 样式的冲突，收益不抵成本。
接入方式见 `src/hooks/useLiquidGlass.ts` —— 只借用引擎（滤镜注册表 + 能力门控）。

## 采用它替代此前手写方案的原因

1. **真折射 vs 磨砂**：`backdrop-filter: blur()` 只是磨砂；本库用 SDF + Snell 折射剖面
   让背景在玻璃边缘真实弯折，再叠一层按 `dot(法线, 光向)` 逐像素生成的镜面高光。
2. **能力门控更可靠**：我们此前用 `CSS.supports('backdrop-filter','url(#x)')` 判断，
   Firefox/Safari 返回 true 但**静默不渲染**；本库用 UA 嗅探并给出 refraction→frost→solid 三级降级。
3. **边缘高光做法更稳**：我们此前用 `mask-composite: exclude` 画 1.2px 边环，上游实测该做法
   在圆角处有硬切接缝（亮度突跳 +38/+55），改用多层 inset box-shadow + `mix-blend-mode: screen`。
4. **性能**：滤镜按 `尺寸×圆角×表面×模糊` 缓存，多个同尺寸卡片共用一个 SVG 滤镜。

## 升级方式

上游更新时重新复制上述文件即可；若届时已发布 npm 包，改为 `npm install @liquidglass/web`
并删除本目录与 `src/hooks/useLiquidGlass.ts` 中的相对导入。
