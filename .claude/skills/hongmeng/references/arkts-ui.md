# ArkTS 与 ArkUI

## 组件与状态
- 入口页面：`@Entry`组件绑定到UIAbility的路由首屏，`@Component`定义可复用组件。
- 状态：`@State`管理本地状态，`@Prop`接收父组件参数，`@Link`实现父子双向绑定，`@StorageLink/@StorageProp`连接全局存储（参考`@ohos.data.preferences`封装）。
- 生命周期：`aboutToAppear`/`aboutToDisappear`用于数据拉取/收尾，页面路由回调可在`UIAbility.onForeground`配合。
- 资源与样式：`$r('app.string.xxx')`取资源；主题可在`resources/base/profile/theme.json`定义，全局样式通过`@Styles`或统一常量封装。

## 布局要点
- 常用布局：`Row`/`Column`（flex方向）、`Stack`（层叠）、`Grid`（宫格）、`List`/`LazyForEach`（长列表）、`Swiper`（轮播）。
- 约束/自适应：`Flex`, `RelativeContainer`适配多尺寸；使用`padding/margin/layoutWeight`构建弹性布局，避免写死像素。
- 动画：`animateTo`或内置`transition`用于状态切换，适当使用`ImplicitAnimationOptions`。

## 路由与导航
- 声明式导航：`Navigation` + `NavPathStack`管理页面栈，便于参数传递与后退控制。
- 轻量路由：`router.pushUrl({ url: 'pages/Detail', params: { id } })`，`router.replaceUrl`/`back`管理栈。确保页面在`module.json5`的`pages`数组中注册。
- 页面间通信：路由参数、全局存储、事件总线（自定义`eventemitter`）或跨Ability通信（参考`abilities-extensions.md`）。

## 与能力交互
- 在UI层调用系统能力前，优先封装Service/Repository，UI只调用抽象接口，便于Mock与单测。
- 耗时操作（网络/IO）使用`async/await`或`Promise`，避免阻塞UI；必要时用`taskpool`并发。

## 测试与调试
- 组件级：可使用UI测试框架（如ArkUI Test）或`@ohos.app.ability.abilityDelegatorRegistry`做页面级用例。
- 性能：`hilog`埋点、`SmartPerf`或IDE性能面板；检查长列表`LazyForEach`虚拟化，图片用`Image`支持`sourceSize`与缓存。
