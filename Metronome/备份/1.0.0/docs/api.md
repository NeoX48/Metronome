# 节拍器应用 API 文档

本文档详细描述了节拍器应用中各模块的API接口、参数和使用方法。

## 核心模块 (core/)

### metronome.js

**主要功能**：提供节拍器的核心控制功能。

#### 初始化与控制函数

```javascript
/**
 * 初始化节拍器
 * @async
 * @returns {Promise<void>}
 * @throws {Error} 初始化失败时抛出错误
 */
async function initMetronome() { ... }

/**
 * 开始节拍器
 * @throws {Error} 开始失败时抛出错误
 */
function startMetronome() { ... }

/**
 * 停止节拍器
 * @throws {Error} 停止失败时抛出错误
 */
function stopMetronome() { ... }

/**
 * 切换节拍器播放状态
 * @returns {boolean} 切换后的状态（true为运行中，false为停止）
 * @throws {Error} 切换失败时抛出错误
 */
function toggleMetronome() { ... }
```

#### 参数设置函数

```javascript
/**
 * 设置BPM（每分钟节拍数）
 * @param {number} bpm - BPM值，范围通常为40-208
 * @returns {number} 设置后的BPM值
 * @throws {Error} 参数无效时抛出错误
 */
function setBPM(bpm) { ... }

/**
 * 设置拍号
 * @param {number} numerator - 拍号分子（每小节的拍数）
 * @param {number} denominator - 拍号分母（以几音符为一拍）
 * @returns {Object} 设置后的拍号对象 {numerator, denominator}
 * @throws {Error} 参数无效时抛出错误
 */
function setTimeSignature(numerator, denominator) { ... }

/**
 * 设置音量
 * @param {number} volume - 音量值，范围为0-100
 * @returns {number} 设置后的音量值
 * @throws {Error} 参数无效时抛出错误
 */
function setVolume(volume) { ... }
```

## 音频模块 (audio/)

### scheduler.js

**主要功能**：精确调度音频事件。

#### Scheduler对象

```javascript
const scheduler = {
    /**
     * 初始化调度器
     * @param {AudioContext} audioContext - Web Audio上下文
     * @returns {void}
     */
    init(audioContext) { ... },
    
    /**
     * 开始调度器
     * @param {number} interval - 事件间隔（毫秒）
     * @param {Function} callback - 每个事件的回调函数
     * @returns {void}
     */
    start(interval, callback) { ... },
    
    /**
     * 停止调度器
     * @returns {void}
     */
    stop() { ... },
    
    /**
     * 暂停调度器
     * @returns {void}
     */
    pause() { ... },
    
    /**
     * 恢复调度器
     * @returns {void}
     */
    resume() { ... },
    
    /**
     * 设置事件间隔
     * @param {number} interval - 事件间隔（毫秒）
     * @returns {void}
     */
    setInterval(interval) { ... },
    
    /**
     * 获取调度器状态
     * @returns {Object} 状态对象
     */
    getState() { ... }
};
```

### soundBuffers.js

**主要功能**：管理音频缓冲区和音效播放。

#### 函数

```javascript
/**
 * 初始化音频缓冲区
 * @async
 * @param {AudioContext} audioContext - Web Audio上下文
 * @returns {Promise<void>}
 * @throws {Error} 初始化失败时抛出错误
 */
async function initSoundBuffers(audioContext) { ... }

/**
 * 播放指定音效
 * @param {string} soundType - 音效类型 ('accent', 'normal')
 * @param {number} volume - 音量值 (0-100)
 * @returns {Promise<void>}
 * @throws {Error} 播放失败时抛出错误
 */
async function playSound(soundType, volume) { ... }

/**
 * 设置主音量
 * @param {number} volume - 音量值 (0-100)
 * @returns {number} 设置后的音量值
 */
function setMasterVolume(volume) { ... }
```

## UI模块 (ui/)

### controls.js

**主要功能**：管理用户界面元素和交互。

#### UIController类

```javascript
/**
 * UI控制器类
 */
class UIController {
    /**
     * 初始化UI控制器
     * @async
     * @returns {Promise<void>}
     * @throws {Error} 初始化失败时抛出错误
     */
    async init() { ... }
    
    /**
     * 销毁UI控制器，清理资源
     * @returns {void}
     */
    destroy() { ... }
}

/**
 * UI控制器实例
 */
export const uiController = new UIController();
```

## 训练模式模块 (training/)

### trainingCore.js

**主要功能**：处理训练会话的核心逻辑。

#### TrainingSessionManager类

```javascript
/**
 * 训练会话管理器类
 */
class TrainingSessionManager {
    /**
     * 开始新的训练会话
     * @async
     * @param {Array<Object>} segments - 训练段落配置数组
     * @returns {Promise<void>}
     * @throws {Error} 开始会话失败时抛出错误
     */
    async startSession(segments) { ... }
    
    /**
     * 暂停训练会话
     * @returns {void}
     */
    pauseSession() { ... }
    
    /**
     * 恢复训练会话
     * @returns {void}
     */
    resumeSession() { ... }
    
    /**
     * 停止训练会话
     * @returns {void}
     */
    stopSession() { ... }
    
    /**
     * 获取当前会话状态
     * @returns {Object} 会话状态对象
     */
    getSessionState() { ... }
    
    /**
     * 检查会话是否正在运行
     * @returns {boolean} 会话运行状态
     */
    isSessionRunning() { ... }
    
    /**
     * 销毁会话管理器
     * @returns {void}
     */
    destroy() { ... }
}

/**
 * 训练会话管理器实例
 */
export const trainingSessionManager = new TrainingSessionManager();

/**
 * 初始化训练模式模块
 * @async
 * @returns {Promise<void>}
 * @throws {Error} 初始化失败时抛出错误
 */
export async function initTrainingMode() { ... }
```

### trainingUI.js

**主要功能**：管理训练模式的用户界面。

#### TrainingUIController类

```javascript
/**
 * 训练模式UI控制器类
 */
class TrainingUIController {
    /**
     * 初始化训练模式UI控制器
     * @async
     * @returns {Promise<void>}
     * @throws {Error} 初始化失败时抛出错误
     */
    async init() { ... }
    
    /**
     * 获取所有段落配置
     * @returns {Array<Object>} 段落配置数组
     */
    getSegmentsConfig() { ... }
    
    /**
     * 销毁训练模式UI控制器
     * @returns {void}
     */
    destroy() { ... }
}

/**
 * 训练模式UI控制器实例
 */
export const trainingUIController = new TrainingUIController();
```

## 工具模块 (utils/)

### config.js

**主要功能**：管理应用配置。

#### CONFIG对象

```javascript
/**
 * 应用配置对象
 */
const CONFIG = {
    defaultBPM: 120,            // 默认BPM值
    minBPM: 40,                 // 最小BPM值
    maxBPM: 208,                // 最大BPM值
    defaultTimeSignature: {     // 默认拍号
        numerator: 4,
        denominator: 4
    },
    defaultVolume: 70,          // 默认音量
    soundTypes: ['accent', 'normal'], // 支持的音效类型
    keyboardShortcuts: {        // 键盘快捷键配置
        toggle: ' ',            // 空格键切换播放
        increaseBPM: '+',       // +键增加BPM
        decreaseBPM: '-',       // -键减少BPM
        reset: 'r',             // R键重置
        toggleTraining: 't'     // T键切换训练模式
    }
};
```

#### 函数

```javascript
/**
 * 更新配置值
 * @param {string} key - 配置键名
 * @param {*} value - 配置值
 * @returns {*} 更新后的配置值
 * @throws {Error} 配置键不存在或值无效时抛出错误
 */
function updateConfig(key, value) { ... }

/**
 * 获取配置值
 * @param {string} key - 配置键名
 * @returns {*} 配置值
 */
function getConfig(key) { ... }
```

### state.js

**主要功能**：管理应用状态。

#### 函数

```javascript
/**
 * 获取当前应用状态
 * @returns {Object} 应用状态对象
 */
function getState() { ... }

/**
 * 更新应用状态
 * @param {Object} newState - 新的状态对象
 * @returns {Object} 更新后的完整状态对象
 */
function updateState(newState) { ... }

/**
 * 订阅状态变更
 * @param {Function} listener - 状态变更监听器函数
 * @returns {Function} 取消订阅函数
 */
function subscribeToState(listener) { ... }

/**
 * 重置应用状态
 * @returns {Object} 重置后的状态对象
 */
function resetState() { ... }
```

### helpers.js

**主要功能**：提供通用辅助函数。

#### 函数

```javascript
/**
 * 安全获取DOM元素
 * @param {string} selector - CSS选择器
 * @returns {HTMLElement|null}
 */
function getElement(selector) { ... }

/**
 * 安全获取多个DOM元素
 * @param {string} selector - CSS选择器
 * @returns {NodeListOf<HTMLElement>}
 */
function getElements(selector) { ... }

/**
 * 安全添加事件监听器
 * @param {EventTarget} element - 目标元素
 * @param {string} event - 事件名称
 * @param {Function} handler - 事件处理函数
 * @param {Object} options - 选项
 * @returns {boolean} 添加是否成功
 */
function addEventListenerSafe(element, event, handler, options = {}) { ... }

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) { ... }

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制时间（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(func, limit) { ... }

/**
 * 格式化BPM值
 * @param {number} bpm - BPM值
 * @returns {string} 格式化后的字符串
 */
function formatBPM(bpm) { ... }

/**
 * 验证BPM值
 * @param {number} bpm - BPM值
 * @returns {boolean} 是否有效
 */
function validateBPM(bpm) { ... }

/**
 * 验证拍号
 * @param {number} numerator - 分子
 * @param {number} denominator - 分母
 * @returns {boolean} 是否有效
 */
function validateTimeSignature(numerator, denominator) { ... }

/**
 * 根据拍号分母获取音符图标
 * @param {number} denominator - 拍号分母
 * @returns {string} 音符图标HTML
 */
function getNoteIcon(denominator) { ... }
```

### keyboard.js

**主要功能**：管理键盘快捷键。

#### KeyboardController类

```javascript
/**
 * 键盘控制器类
 */
class KeyboardController {
    /**
     * 初始化键盘控制器
     * @returns {void}
     */
    init() { ... }
    
    /**
     * 启用键盘控制
     * @returns {void}
     */
    enable() { ... }
    
    /**
     * 禁用键盘控制
     * @returns {void}
     */
    disable() { ... }
    
    /**
     * 销毁键盘控制器
     * @returns {void}
     */
    destroy() { ... }
}

/**
 * 键盘控制器实例
 */
export const keyboardController = new KeyboardController();

/**
 * 获取当前BPM值
 * @returns {number} 当前BPM值
 */
function getCurrentBPM() { ... }
```

## 应用入口 (main.js)

**主要功能**：整合所有模块并初始化应用。

#### 应用对象

```javascript
/**
 * 主应用对象
 */
export const app = {
    /**
     * 初始化应用
     * @async
     * @returns {Promise<void>}
     */
    initialize: initializeApp,
    
    /**
     * 显示错误消息
     * @param {string} message - 错误消息
     * @returns {void}
     */
    showError: showErrorMessage,
    
    /**
     * 加载应用配置
     * @async
     * @returns {Promise<Object>}
     */
    loadConfig: loadAppConfig,
    
    /**
     * 保存应用配置
     * @param {Object} config - 配置对象
     * @returns {void}
     */
    saveConfig: saveAppConfig
};
```

## 事件系统

### 自定义事件

应用使用自定义事件进行模块间通信：

#### 节拍器事件

- **metronome:beat** - 节拍事件
  - detail: { beat, isFirstBeat }

#### 训练模式事件

- **training:start** - 开始训练
  - detail: { segments }
- **training:stop** - 停止训练
- **training:pause** - 暂停训练
- **training:resume** - 恢复训练
- **training:reset** - 重置训练
- **training:started** - 训练已开始
  - detail: { sessionId, segments }
- **training:stopped** - 训练已停止
  - detail: { sessionId, currentSegmentIndex }
- **training:paused** - 训练已暂停
  - detail: { sessionId, currentSegmentIndex, remainingBeats }
- **training:resumed** - 训练已恢复
  - detail: { sessionId }
- **training:segmentChange** - 段落变更
  - detail: { segmentIndex, segment, currentRepeat }
- **training:segmentRepeat** - 段落重复
  - detail: { segmentIndex, segment, currentRepeat }
- **training:update** - 训练状态更新
  - detail: { state }
- **training:complete** - 训练完成
  - detail: { sessionId, totalSegments }

#### 应用事件

- **app:initialized** - 应用已初始化

## 错误处理

所有公共API函数都包含错误处理，在参数无效或操作失败时会抛出适当的错误异常。建议在使用API时使用try-catch语句捕获可能的错误。