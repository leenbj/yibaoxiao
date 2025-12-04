# 概览与工程结构

- 术语：Stage模型=当前主流模型；UIAbility=界面入口；Extension（Service/DataShare/Form等）=扩展能力；HAP=可安装模块；HAR=共享库；API Version=系统能力版本。
- 项目根常见文件：`build-profile.json5`（签名/构建配置）、`oh-package.json5`（依赖）、`AppScope/app.json5`（应用级配置，标识/包名/允许的模块）。
- 模块目录（如`entry/`）：`module.json5`（Abilities、权限、路由入口）、`src/main/ets/`（ArkTS代码）、`src/main/resources/`（资源）、`src/main/module.json5`与`src/main/resources/base/profile/`（配置）。
- 入口配置示例（`module.json5`片段）：
  ```json5
  {
    "module": {
      "type": "entry",
      "name": "entry",
      "abilities": [{
        "name": "EntryAbility",
        "srcEntry": "./ets/entryability/EntryAbility.ts",
        "launchType": "standard",
        "skills": [{ "entities": ["entity.system.home"], "actions": ["action.system.home"] }]
      }],
      "requestPermissions": [
        { "name": "ohos.permission.INTERNET" }
      ]
    }
  }
  ```
- 资源访问：使用`$r('app.string.xxx')`、`$r('app.media.img')`；多分辨率按`resources/base/media`等子目录放置。
- 多设备适配：布局使用弹性组件（`Row/Column/Stack/Grid/RelativeContainer`）与`Constraint`，窗口信息通过`@ohos.window`获取，分辨率/方向变化在`onWindowStageCreate`或窗口回调中处理。
- 架构建议：UI层ArkUI组件化，业务逻辑放`/src/main/ets/feature/*`或`/src/main/ets/services/*`，避免在Ability中堆积逻辑；资源/常量集中管理，网络/存储封装成可替换服务，方便多端。
