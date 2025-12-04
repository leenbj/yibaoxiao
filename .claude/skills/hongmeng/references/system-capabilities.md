# 常用系统能力与权限

## 权限申明与请求
- 在`module.json5` -> `requestPermissions`声明，如`ohos.permission.INTERNET`、`ohos.permission.GET_NETWORK_INFO`、`ohos.permission.ACCESS_BLUETOOTH`等。
- 动态申请：使用`@ohos.abilityAccessCtrl`获取`AtManager`调用`requestPermissionsFromUser`；调用前可用`verifyAccessToken`校验。
- 敏感权限（摄像头/麦克风/定位/通知等）需在UI弹窗请求，失败时给出降级路径。

## 存储与数据
- 偏好：`@ohos.data.preferences`用于KV配置，初始化`preferences.getPreferences(context, 'name')`，读写`put/get/flush`。
- RDB：`@ohos.data.rdb`提供本地关系库，需定义`STORE_CONFIG`与表结构SQL，事务/索引自行管理。
- 文件：`@ohos.file.fs`或`@ohos.fileio`操作文件，沙箱路径通过`context.filesDir`、`cacheDir`获取；媒体库访问需相应权限与`@ohos.multimedia.medialibrary`。
- 分布式/跨设备：轻量可用`@ohos.data.distributedDataObject`，或分布式RDB/DataShare按场景选择。

## 网络与请求
- HTTP：`@ohos.net.http`创建`http.createHttp()`, `request`支持超时/证书；上传/下载可监听进度。
- WebSocket：`@ohos.net.websocket`；长连接后台需配合`ServiceExtensionAbility`。
- 网络状态：`@ohos.net.connection`监听网络变化，根据结果重试或降级。

## 位置与传感器
- 定位：声明`ohos.permission.LOCATION`/`ACCESS_LOCATION_IN_BACKGROUND`，使用`@ohos.location.geolocation`，注意前台服务/隐私弹窗。
- 传感器：`@ohos.sensor`订阅加速度、陀螺仪等，注意频率与资源释放。

## 媒体与相机
- 相机：`@ohos.multimedia.camera`，需`CAMERA`与存储权限；流式输出给`ImageReceiver`或`Surface`。
- 播放：`@ohos.multimedia.media`的`AVPlayer`/`AVRecorder`，监听`stateChange`处理播放状态。

## 通知与前台服务
- 通知：声明`ohos.permission.NOTIFICATION_CONTROLLER`（部分版本需用户授权），使用`@ohos.notificationManager`创建渠道与发布通知。
- 前台服务：在`module.json5`配置`distributedNotificationEnabled/keepAlive`等，并在服务中发布前台通知。

## 设备与系统
- 设备信息：`@ohos.deviceInfo`或`@ohos.systemParameter`获取型号/版本/分辨率；用于适配但避免过度分支。
- 蓝牙/Wi-Fi/NFC等需对应权限与Kit（如`@ohos.bluetooth.*`、`@ohos.wifiManager`），使用前检查开关状态并引导用户。

## 日志与调试
- 日志：`hilog.info/debug/error(tag, fmt, ...)`；生产环境避免输出敏感数据。
- 工具：`hdc shell`与`hilog`过滤关键字；性能问题使用`SmartPerf`或IDE性能分析。
