---
name: hongmeng
description: HarmonyOS/鸿蒙应用开发指导，涵盖环境搭建、ArkTS/ArkUI开发、Stage模型、Ability/Extension、系统能力调用、构建签名发布、调试与多端适配。用户提出鸿蒙应用开发、API/Kit使用、调试发布、分布式特性等需求时使用。
---

# 鸿蒙开发技能

## 快速工作流
- 明确目标设备与API Level（常用API 10/11+），选择Stage模型项目。
- 环境：安装DevEco Studio与对应鸿蒙/开放鸿蒙SDK，配置模拟器或真机（打开开发者模式、USB调试）。
- 项目规划：`entry` HAP作为主模块，公共能力用HAR库；UIAbility承载页面，按业务拆分包。
- 路由与状态：ArkUI组件化，使用`router`或`Navigation`管理页面栈；State/Storage见references/arkts-ui.md。
- 权限与系统能力：先在`module.json5`声明权限与abilities，再在代码中按需申请/校验，能力用法见references/system-capabilities.md。
- 调试：DevEco Studio模拟器/真机，`hilog`/`hdc shell`查看日志，`AbilityDelegatorRegistry`做端上用例。
- 构建发布：签名与构建配置写在`build-profile.json5`，按渠道生成Debug/Release包，流程见references/build-release.md。

## 参考导航
- 概览与结构：见`references/overview.md`。
- ArkTS/ArkUI与路由：见`references/arkts-ui.md`。
- UIAbility与Extension：见`references/abilities-extensions.md`。
- 常用系统能力与权限：见`references/system-capabilities.md`。
- 构建、签名、发布与调试：见`references/build-release.md`。
