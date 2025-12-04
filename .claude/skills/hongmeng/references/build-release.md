# 构建、签名、发布与调试

## 依赖与构建
- 依赖：使用`ohpm`管理，根目录`oh-package.json5`写依赖；执行`ohpm install`同步。
- 构建：IDE内置`Build`/`Run`，或命令行`hvigorw assembleDebug`/`assembleRelease`（确保`hvigor`脚本存在）；多模块时指定`-p entry`。
- 变体：在`build-profile.json5`定义product/flavor（如`dev/stage/prod`），区分包名/Server地址。

## 签名与profile
- 在`build-profile.json5`配置签名：
  ```json5
  {
    "signingConfigs": {
      "release": {
        "material": "sign/release.p12",
        "alias": "release",
        "storePassword": "****",
        "keyPassword": "****"
      }
    },
    "profiles": {
      "release": {
        "signingConfig": "release",
        "app": "sign/app-release-profile.json"
      }
    }
  }
  ```
- Profile文件包含包名/调试证书映射；不同环境使用不同profile与签名对。
- Dev模式可用IDE生成调试签名；正式发布需生产证书并妥善保管。

## 打包产物
- HAP：单模块安装包；多HAP可组成App Bundle。
- HAR：代码/资源库，供其他模块复用，不可直接安装。
- 资源裁剪：启用按特性/分辨率拆分，减少包体。

## 测试与验收
- 单测/集成：使用`@ohos.app.ability.abilityDelegatorRegistry`编写UIAbility测试；核心逻辑可用ArkTS单元测试。
- 真机验证：优先目标设备；检查权限弹窗、首帧、横竖屏/折叠态、弱网/断网、前后台切换、通知、文件权限。
- 隐私合规：只请求必要权限，展示隐私政策/用途说明，日志不包含敏感信息。

## 发布
- 渠道：华为应用市场（AppGallery）或企业分发；遵循最新发布指引与安全检查要求。
- 上架材料：包体、签名、隐私合规说明、权限用途、适配设备范围、截屏与说明文档。
- 版本策略：遵循语义化版本；升级前保持数据迁移脚本/兼容逻辑。
