# 节拍器应用

版本：1.0.5

一个现代化、模块化的节拍器应用，具有基本节拍功能、多种训练模式、预备拍功能和节拍静音控制功能。

## 预览启动方法
```bash
python -m http.server 8000
```

## 项目结构

```
Metronome/
├── index.html           # 主页面
├── main.js              # 应用入口文件
├── index.js             # 额外入口文件
├── styles.css           # 样式文件
├── modules/             # 模块化代码目录
│   ├── core/            # 核心功能模块
│   │   ├── metronome.js     # 节拍器核心逻辑
│   │   └── metronome.bak.js # 节拍器备份文件
│   ├── audio/           # 音频处理模块
│   │   ├── scheduler.js       # 音频调度器
│   │   └── soundBuffers.js    # 音频缓冲区管理
│   ├── ui/              # 用户界面模块
│   │   └── controls.js        # UI控制逻辑
│   ├── training/        # 训练模式模块
│   │   ├── trainingCore.js    # 训练核心逻辑
│   │   └── trainingUI.js      # 训练UI组件
│   └── utils/           # 工具函数模块
│       ├── config.js          # 配置管理
│       ├── state.js           # 状态管理
│       ├── helpers.js         # 辅助函数
│       ├── keyboard.js        # 键盘控制
│       ├── errorHandler.js    # 错误处理
│       ├── errorManager.js    # 错误管理
│       ├── eventLock.js       # 事件锁机制
│       ├── init.js            # 初始化函数
│       ├── cleanup.js         # 资源清理
│       ├── audioErrorBoundary.js # 音频错误边界
│       └── math.js            # 数学工具函数
├── docs/                # 文档
│   ├── api.md                 # API文档
│   ├── architecture.md        # 架构设计文档
│   └── architecture-optimization.md # 架构优化文档
├── tests/               # 测试目录
│   └── utils/                 # 工具函数测试
├── 备份/                # 备份文件目录
│   ├── 1.0.0/                # 1.0.0版本备份
│   └── 1.0.3/                # 1.0.3版本备份
└── .record_point        # 检查点记录文件
```

## 功能特性

- **基本节拍功能**：设置和调整BPM、拍号和音量
- **训练模式**：创建和运行自定义训练序列，支持变速、分段、随机变速和节奏控制模式
- **预备拍功能**：在训练开始前设置0-8拍的预备拍，提供全屏数字倒数显示
- **键盘控制**：支持键盘快捷键操作
- **响应式设计**：适配不同屏幕尺寸
- **模块化架构**：代码组织清晰，易于维护和扩展
- **TAP测速功能**：通过点击来测量BPM，具有优化的平滑算法减少抖动
- **事件锁机制**：防止事件冲突，提高应用稳定性
- **优化的音频调度**：修复第一拍叠音问题，提供更准确的节拍体验
- **节拍静音控制**：支持单独静音特定节拍，提供视觉反馈（静音节拍点不高亮显示）
- **重构的核心模块**：节拍器核心逻辑重构为类实例模式，提供更好的封装性和可维护性

## 安装与使用

1. 克隆或下载项目到本地
2. 在项目目录下启动Web服务器
   ```bash
   npx http-server -p 8081
   ```
3. 打开浏览器访问 `http://localhost:8081`

## API使用指南

### 核心模块 API

```javascript
// 获取节拍器实例
import { getMetronome } from './modules/core/metronome.js';
const metronome = getMetronome();

// 初始化节拍器
await metronome.init();

// 控制节拍器
metronome.start();  // 开始播放
metronome.stop();   // 停止播放
metronome.toggle(); // 切换播放状态

// 设置参数
metronome.setBPM(120);              // 设置为120 BPM
metronome.setTimeSignature(4, 4);   // 设置为4/4拍
metronome.setVolume(80);            // 设置音量为80%

// 旧版API兼容（已弃用）
import { getGlobalMetronome } from './modules/core/metronome.js';
const legacyMetronome = getGlobalMetronome(); // 包含弃用警告

// 销毁节拍器实例（清理资源）
import { destroyMetronome } from './modules/core/metronome.js';
destroyMetronome();
```

### 训练模式 API

```javascript
// 初始化训练模式
import { initTrainingMode } from './modules/training/trainingCore.js';
await initTrainingMode();

// 控制训练会话
import { trainingSessionManager } from './modules/training/trainingCore.js';
await trainingSessionManager.startSession([
  { bpm: 120, beats: 4, repeats: 2 },
  { bpm: 140, beats: 4, repeats: 1 }
]);
trainingSessionManager.pauseSession();
trainingSessionManager.resumeSession();
trainingSessionManager.stopSession();
```

### UI控制 API

```javascript
// 初始化UI控制器
import { uiController } from './modules/ui/controls.js';
await uiController.init();

// 初始化训练模式UI控制器
import { trainingUIController } from './modules/training/trainingUI.js';
await trainingUIController.init();
```

## 键盘快捷键

- **空格键**：开始/停止节拍器
- **+** / **-**：增加/减少BPM
- **0-9**：快速设置预设BPM
- **T**：切换到训练模式
- **R**：重置节拍器
- **点击节拍点**：静音/取消静音特定节拍（最下方一排节拍点）

## 错误处理

应用内置了全局错误处理机制，可以捕获和显示未处理的错误。模块代码中也包含了详细的错误处理和异常捕获逻辑，确保应用的稳定性。

## 性能优化

- 使用防抖和节流函数优化UI交互，特别是在TAP测速功能中
- 采用高效的音频调度算法确保节拍精度，修复第一拍叠音问题
- 模块化设计减少初始加载时间
- 事件驱动架构减少不必要的计算
- 事件锁机制防止事件冲突，提高应用响应性能
- TAP测速优化算法，通过增加样本数量和优化平滑权重提高测量稳定性

## 开发说明

### 模块开发

1. 按照功能分类在相应目录下创建新模块
2. 遵循现有的模块接口设计模式
3. 使用JSDoc格式为函数和类添加文档注释
4. 添加必要的错误处理

### 测试

测试文件应放在 `tests/` 目录下，遵循与源代码相同的目录结构。

## 浏览器兼容性

支持现代浏览器（Chrome、Firefox、Safari、Edge的最新版本）。需要浏览器支持Web Audio API和ES Modules。

## 许可证

MIT