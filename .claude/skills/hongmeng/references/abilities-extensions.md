# UIAbility 与 Extension

## UIAbility（Stage模型）
- 典型生命周期：`onCreate(want, launchParam)` → `onWindowStageCreate(windowStage)`（设置`setUIContent`加载页面） → `onForeground`/`onBackground` → `onWindowStageDestroy` → `onDestroy`。
- 路由入口：在`module.json5`的`abilities`内配置`skills`（如home能力），并在`srcEntry`指向Ability类。
- 任务模式：`launchType`可选`standard`/`singleton`等；跨Ability路由使用`@ohos.app.ability.startAbility`。
- Want参数：通过`want.parameters`传递简单数据，或结合`AbilityContext`访问分布式数据。

## 常用Extension
- `ServiceExtensionAbility`：后台服务/长连接；通过`connectServiceExtensionAbility`绑定，记得在`module.json5`声明且配置权限（如网络）。
- `DataShareExtensionAbility`：数据提供者，遵循URI规范，客户端使用`@ohos.data.dataShare`。
- `FormExtensionAbility`：卡片/Widget提供界面，需声明`forms`配置并处理`onAddForm`/`onUpdateForm`。
- `WorkSchedulerExtensionAbility`：定时/条件任务，使用`@ohos.resourceschedule.workScheduler`。

## 跨Ability通信
- 拉起：`startAbility({ bundleName, abilityName, parameters })`；同模块可用短名。
- 绑定：`connectServiceExtensionAbility`返回`Connection`，实现`onConnect`/`onDisconnect`管理代理。
- AbilityResult：在被调起的Ability中`context.terminateSelfWithResult`返回，调用方使用`startAbilityForResult`接收。

## 权限与安全
- 在`module.json5`声明`requestPermissions`；敏感权限需动态申请（如定位、摄像头）。
- 若使用后台/前台服务，确保声明`keepAlive`/前台服务通知要求，并遵循耗电限制。
