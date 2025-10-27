/**
 * UI控制模块 - 管理节拍器的用户界面
 * @module controls
 * @description 处理用户界面元素的更新、事件绑定和交互逻辑，提供错误处理和优化的用户体验
 */
import { 
  getElement, 
  getElements, 
  addEventListenerSafe, 
  removeEventListenerSafe, 
  setText, 
  toggleClass, 
  debounce, 
  throttle, 
  isValidBPM, 
  isValidTimeSignature, 
  getNoteIcon 
} from '../utils/helpers.js';
import { handleUIError, handleTrainingError } from '../utils/errorManager.js';
import { setBPM, setTimeSignature, setVolume, toggleMetronome } from '../core/metronome.js';
import { getState, updateState, subscribeToState } from '../utils/state.js';
import { CONFIG } from '../utils/config.js';
import { eventLockManager } from '../utils/eventLock.js';

/**
 * UI控制器类 - 统一管理节拍器UI交互、状态同步与视觉反馈
 */
class UIController {
  constructor() {
    this.initialized = false;                // 初始化状态标识
    this.unsubscribeState = null;            // 状态订阅取消函数
    this.eventListeners = new Map();         // 存储事件监听器，用于后续清理
    this.debouncedUpdateBPM = debounce(this._updateBPM.bind(this), 100); // 防抖处理BPM更新

    // TAP Tempo相关变量
    this.lastTapTime = null;                 // 上一次TAP时间戳
    this.tapIntervals = [];                  // TAP时间间隔数组
    this.fastTapWeight = 0.6;                // 快速TAP平滑权重 - 降低权重提高稳定性
    this.smoothedFastInterval = null;        // 快速TAP平滑后的时间间隔
    this.setBPMFromTap = debounce((bpm) => setBPM(bpm), 250); // TAP触发BPM更新防抖 - 延长防抖时间

    // 性能统计数据
    this.performanceStats = {
      updates: 0,          // UI更新次数
      lastUpdateTime: null,// 最后一次更新时间戳
      renderTime: 0        // 首次渲染耗时(ms)
    };
  }

  /**
   * 初始化UI控制器
   * @returns {Promise<boolean>} 初始化成功返回true，失败返回false
   */
  async init() {
    try {
      if (this.initialized) {
        console.warn('⚠️ [controls.js] UI控制器已经初始化');
        return true;
      }

      // 1. 绑定DOM元素（必需元素缺失则初始化失败）
      if (!this._bindElements()) {
        const error = new Error('DOM元素绑定失败');
        handleUIError(error, { context: 'UI控制器初始化' });
        return false;
      }

      // 2. 绑定UI事件监听器
      this._bindEvents();

      // 3. 订阅状态变更（同步UI与核心状态）
      this._subscribeToState();

      // 4. 初始化UI显示（首次渲染）
      const startTime = performance.now();
      this._updateUIDisplay();
      this.performanceStats.renderTime = performance.now() - startTime;
      this.performanceStats.lastUpdateTime = Date.now();

      // 5. 绑定全局事件（备用控制方式）
      this._bindGlobalEvents();

      this.initialized = true;
      console.log('✅ [controls.js] UI控制器初始化成功');
      return true;
    } catch (error) {
      handleUIError(error, { context: 'UI控制器初始化' });
      this._safeCleanup(); // 初始化失败时安全清理资源
      return false;
    }
  }

  /**
   * 绑定DOM元素到实例属性
   * @private
   * @returns {boolean} 绑定成功返回true，缺失必需元素返回false
   */
  _bindElements() {
    try {
      // 显示类元素
      this.bpmDisplay = getElement('#bpm-value');
      this.volumeDisplay = getElement('#volume-value');
      this.denominatorIcon = getElement('#denominator-icon');

      // 控制类元素
      this.bpmSlider = getElement('#bpm-slider');
      this.bpmInput = getElement('#bpm-input');
      this.volumeSlider = getElement('#volume-slider');
      this.beatNumerator = getElement('#beat-numerator');
      this.beatDenominator = getElement('#beat-denominator');

      // 按钮元素
      this.toggleButton = getElement('#toggle-btn');
      this.resetButton = getElement('#reset-btn');
      this.tapButton = getElement('#tap-btn');

      // 消息显示容器
      this.errorMessageContainer = getElement('#error-message');

      // 节拍指示器
      this.indicatorDots = getElements('.beat-dot');

      // 校验必需元素（缺失则初始化失败）
      const requiredElements = [
        { name: 'bpmDisplay', element: this.bpmDisplay },
        { name: 'toggleButton', element: this.toggleButton }
      ];
      const missingElements = requiredElements.filter(item => !item.element);

      if (missingElements.length > 0) {
        const errorMsg = `缺少必需的DOM元素: ${missingElements.map(item => item.name).join(', ')}`;
        const error = new Error(errorMsg);
        handleUIError(error, { context: 'UI元素绑定' });
        return false;
      }

      return true;
    } catch (error) {
      handleUIError(error, { context: '绑定DOM元素' });
      return false;
    }
  }

  /**
   * 绑定所有UI事件监听器
   * @private
   */
  _bindEvents() {
    try {
      // 基础事件绑定（必需元素）
      const eventBindings = [
        // 节拍器启停切换
        { 
          element: this.toggleButton, 
          event: 'click', 
          handler: this._handleToggleClick.bind(this) 
        },
        // 节拍事件（更新指示器）
        { 
          element: window, 
          event: 'metronome:beat', 
          handler: this._handleBeatEvent.bind(this) 
        },
        // 外部TAP事件（键盘快捷键触发）
        { 
          element: window, 
          event: 'metronome:tap', 
          handler: this._handleExternalTap.bind(this) 
        }
      ];

      // 可选元素事件绑定（存在则绑定）
      if (this.resetButton) {
        eventBindings.push({
          element: this.resetButton,
          event: 'click',
          handler: this._handleResetClick.bind(this)
        });
      }

      if (this.bpmSlider) {
        eventBindings.push(
          { 
            element: this.bpmSlider, 
            event: 'input', 
            handler: this._handleBPMInput.bind(this) 
          },
          { 
            element: this.bpmSlider, 
            event: 'change', 
            handler: this._handleBPMChange.bind(this) 
          }
        );
      }

      if (this.bpmInput) {
        eventBindings.push({
          element: this.bpmInput,
          event: 'change',
          handler: this._handleBPMInputChange.bind(this)
        });
      }

      if (this.volumeSlider) {
        eventBindings.push({
          element: this.volumeSlider,
          event: 'input',
          handler: this._handleVolumeInput.bind(this)
        });
      }

      if (this.beatNumerator) {
        eventBindings.push({
          element: this.beatNumerator,
          event: 'change',
          handler: this._handleTimeSignatureChange.bind(this)
        });
      }

      if (this.beatDenominator) {
        eventBindings.push({
          element: this.beatDenominator,
          event: 'change',
          handler: this._handleTimeSignatureChange.bind(this)
        });
      }

      if (this.tapButton) {
        eventBindings.push({
          element: this.tapButton,
          event: 'click',
          handler: () => this._handleTapClick()
        });
      }

      // 执行绑定并存储监听器引用（用于后续清理）
      eventBindings.forEach(binding => {
        const key = `${binding.element}_${binding.event}`;
        this.eventListeners.set(key, {
          element: binding.element,
          event: binding.event,
          handler: binding.handler
        });
        addEventListenerSafe(binding.element, binding.event, binding.handler);
      });
    } catch (error) {
      handleUIError(error, { context: '绑定UI事件监听器' });
    }
  }

  /**
   * 订阅状态变更（同步UI与核心状态）
   * @private
   */
  _subscribeToState() {
    try {
      this.unsubscribeState = subscribeToState((prevState, newState) => {
        // 仅在状态实际变更时更新UI，减少冗余渲染
        this._handleStateChange(prevState, newState);
      });
    } catch (error) {
      handleUIError(error, { context: '订阅状态变更' });
    }
  }

  /**
   * 处理状态变更（按需更新UI元素）
   * @private
   * @param {Object} prevState - 变更前的状态
   * @param {Object} newState - 变更后的新状态
   */
  _handleStateChange(prevState, newState) {
    try {
      // BPM变更：更新BPM显示
      if (prevState.bpm !== newState.bpm) {
        this._updateBPMDisplay(newState.bpm);
      }

      // 音量变更：更新音量显示
      if (prevState.volume !== newState.volume) {
        this._updateVolumeDisplay(newState.volume);
      }

      // 运行状态变更：更新启停按钮显示
      if (prevState.isRunning !== newState.isRunning) {
        this._updateRunningStateDisplay(newState.isRunning);
      }

      // 拍号变更：更新拍号显示与节拍指示器
      if (prevState.beatNumerator !== newState.beatNumerator || 
          prevState.beatDenominator !== newState.beatDenominator) {
        this._updateTimeSignatureDisplay(newState.beatNumerator, newState.beatDenominator);
      }

      // 更新性能统计
      this.performanceStats.updates++;
      this.performanceStats.lastUpdateTime = Date.now();
    } catch (error) {
      handleUIError(error, { context: '处理状态变更' });
    }
  }

  /**
   * 全量更新UI显示（初始化或强制刷新时使用）
   * @private
   * @param {boolean} [forceUpdate=false] - 是否强制更新所有元素
   */
  _updateUIDisplay(forceUpdate = false) {
    try {
      const state = getState();
      this._updateBPMDisplay(state.bpm);
      this._updateVolumeDisplay(state.volume);
      this._updateRunningStateDisplay(state.isRunning);
      this._updateTimeSignatureDisplay(state.beatNumerator, state.beatDenominator);

      // 更新性能统计
      this.performanceStats.updates++;
      this.performanceStats.lastUpdateTime = Date.now();
    } catch (error) {
      handleUIError(error, { context: '更新UI显示' });
    }
  }

  /**
   * 更新BPM相关显示（数值、滑块、输入框）
   * @private
   * @param {number} bpm - 目标BPM值
   */
  _updateBPMDisplay(bpm) {
    // 更新BPM数值显示
    setText(this.bpmDisplay, bpm.toString());

    // 同步BPM滑块（避免UI与状态不一致）
    if (this.bpmSlider && this.bpmSlider.value !== bpm.toString()) {
      this.bpmSlider.value = bpm;
    }

    // 同步BPM输入框（避免UI与状态不一致）
    if (this.bpmInput && this.bpmInput.value !== bpm.toString()) {
      this.bpmInput.value = bpm;
    }
  }

  /**
   * 更新音量相关显示（数值、滑块）
   * @private
   * @param {number} volume - 目标音量值（0-100）
   */
  _updateVolumeDisplay(volume) {
    // 更新音量数值显示
    setText(this.volumeDisplay, volume.toString());

    // 同步音量滑块（避免UI与状态不一致）
    if (this.volumeSlider && this.volumeSlider.value !== volume.toString()) {
      this.volumeSlider.value = volume;
    }
  }

  /**
   * 更新节拍器运行状态显示（启停按钮样式与文本）
   * @private
   * @param {boolean} isRunning - 节拍器是否正在运行
   */
  _updateRunningStateDisplay(isRunning) {
    if (!this.toggleButton) return;

    // 切换按钮样式类
    toggleClass(this.toggleButton, 'start', !isRunning);
    toggleClass(this.toggleButton, 'stop', isRunning);

    // 更新按钮文本
    setText(this.toggleButton, isRunning ? '停止' : '开始');
  }

  /**
   * 更新拍号显示（分子、分母、音符图标）与节拍指示器
   * @private
   * @param {number} numerator - 拍号分子（每小节拍数）
   * @param {number} denominator - 拍号分母（以几分音符为一拍）
   */
  _updateTimeSignatureDisplay(numerator, denominator) {
    // 同步拍号分子输入框
    if (this.beatNumerator && this.beatNumerator.value !== numerator.toString()) {
      this.beatNumerator.value = numerator;
    }

    // 同步拍号分母输入框
    if (this.beatDenominator && this.beatDenominator.value !== denominator.toString()) {
      this.beatDenominator.value = denominator;
    }

    // 更新分母音符图标
    if (this.denominatorIcon) {
      setText(this.denominatorIcon, getNoteIcon(denominator));
    }

    // 同步节拍指示器数量
    this._updateBeatIndicators(numerator);
  }

  /**
   * 更新节拍指示器（根据每小节拍数创建/销毁指示器点）
   * @private
   * @param {number} beatCount - 每小节拍数
   */
  _updateBeatIndicators(beatCount) {
    const container = getElement('#indicator-dots');
    if (!container) return;

    // 清空现有指示器
    container.innerHTML = '';

    // 按拍数创建新指示器点
    for (let i = 0; i < beatCount; i++) {
      const dot = document.createElement('div');
      dot.className = `beat-dot${i === 0 ? ' first' : ''}`; // 第一拍添加特殊类
      container.appendChild(dot);
    }

    // 更新指示器引用
    this.indicatorDots = getElements('.beat-dot');
  }

  /**
   * 处理启停按钮点击事件
   * @private
   */
  _handleToggleClick() {
    try {
      // 事件锁防重复触发（300ms内仅响应一次）
      if (!eventLockManager.tryLock('toggle-metronome', 300)) {
        return;
      }

      // 触发节拍器启停切换
      toggleMetronome();

      // 按钮点击视觉反馈
      if (this.toggleButton) {
        this.toggleButton.classList.add('active');
        setTimeout(() => {
          if (this.toggleButton) {
            this.toggleButton.classList.remove('active');
          }
        }, 200);
      }
    } catch (error) {
      // 区分训练模式错误与普通UI错误
      if (error.message?.includes('training')) {
        handleTrainingError(error, { context: '切换训练模式' });
      } else {
        handleUIError(error, { context: '切换节拍器状态' });
      }
      this._showErrorMessage('无法切换节拍器状态');
    }
  }

  /**
   * 处理重置按钮点击事件（恢复默认设置）
   * @private
   */
  _handleResetClick() {
    try {
      console.log('🔄 [controls.js] 重置按钮被点击');

      // 恢复默认配置
      setBPM(CONFIG.defaultBPM);
      setVolume(CONFIG.defaultVolume);
      setTimeSignature(CONFIG.defaultBeatNumerator, CONFIG.defaultBeatDenominator);

      // 清空TAP Tempo历史数据
      this.tapIntervals = [];
      this.lastTapTime = null;
      this.smoothedFastInterval = null;

      // 显示重置成功通知
      this._showNotification('已重置为默认设置');
    } catch (error) {
      handleUIError(error, { context: '重置节拍器设置' });
      this._showErrorMessage('重置失败');
    }
  }

  /**
   * 处理BPM滑块拖动事件（实时更新显示，防抖更新实际值）
   * @private
   * @param {Event} event - 滑块输入事件对象
   */
  _handleBPMInput(event) {
    try {
      const bpm = parseInt(event.target.value, 10);
      // 验证BPM有效性，有效则更新显示
      if (isValidBPM(bpm)) {
        this._updateBPMDisplay(bpm);
        this.debouncedUpdateBPM(bpm);
      }
    } catch (error) {
      handleUIError(error, { context: '处理BPM滑块输入' });
    }
  }

  /**
   * 处理BPM滑块确认事件（鼠标释放时更新实际BPM值）
   * @private
   * @param {Event} event - 滑块变更事件对象
   */
  _handleBPMChange(event) {
    try {
      const bpm = parseInt(event.target.value, 10);
      if (!isNaN(bpm)) {
        setBPM(bpm);
      }
    } catch (error) {
      handleUIError(error, { context: '处理BPM滑块变更' });
    }
  }

  /**
   * 更新BPM值（确保在有效范围内）
   * @private
   * @param {number} bpm - 待更新的BPM值
   */
  _updateBPM(bpm) {
    try {
      if (!isNaN(bpm)) {
        // 限制BPM在40-300区间内
        const validBPM = Math.max(40, Math.min(300, bpm));
        setBPM(validBPM);
      }
    } catch (error) {
      handleUIError(error, { context: '更新BPM值' });
    }
  }

  /**
   * 处理BPM输入框变更事件（手动输入BPM）
   * @private
   * @param {Event} event - 输入框变更事件对象
   */
  _handleBPMInputChange(event) {
    try {
      let bpm = parseInt(event.target.value, 10);

      // 验证输入有效性（40-300区间）
      if (isNaN(bpm) || bpm < 40 || bpm > 300) {
        // 无效输入：恢复当前BPM显示并提示
        const state = getState();
        this._updateBPMDisplay(state.bpm);
        this._showNotification('BPM必须在40-300之间');
        return;
      }

      // 有效输入：更新BPM
      setBPM(bpm);
    } catch (error) {
      handleUIError(error, { context: '处理BPM输入框变更' });
      this._showErrorMessage('无法更新BPM');
    }
  }

  /**
   * 处理音量滑块输入事件（实时更新音量）
   * @private
   * @param {Event} event - 滑块输入事件对象
   */
  _handleVolumeInput(event) {
    try {
      const volume = parseInt(event.target.value, 10);
      if (!isNaN(volume)) {
        // 限制音量在0-100区间内
        const validVolume = Math.max(0, Math.min(100, volume));
        setVolume(validVolume);
      }
    } catch (error) {
      handleUIError(error, { context: '处理音量滑块输入' });
    }
  }

  /**
   * 处理拍号变更事件（分子/分母变更时触发）
   * @private
   */
  _handleTimeSignatureChange() {
    try {
      const numerator = parseInt(this.beatNumerator.value, 10);
      const denominator = parseInt(this.beatDenominator.value, 10);

      // 验证拍号有效性
      if (!isValidTimeSignature(numerator, denominator)) {
        // 无效拍号：恢复当前显示并提示
        const state = getState();
        this._updateTimeSignatureDisplay(state.beatNumerator, state.beatDenominator);
        this._showNotification('拍号无效，请使用标准拍号');
        return;
      }

      // 有效拍号：更新拍号设置
      setTimeSignature(numerator, denominator);
    } catch (error) {
      handleUIError(error, { context: '处理拍号变更' });
      this._showErrorMessage('无法更新拍号');
    }
  }

  /**
   * 处理外部TAP事件（键盘快捷键触发）
   * @private
   * @param {CustomEvent} e - 外部TAP事件对象（含时间戳）
   */
  _handleExternalTap(e) {
    try {
      // 提取事件时间戳（无则用当前时间）
      const eventTime = e?.detail?.time && typeof e.detail.time === 'number' 
        ? e.detail.time 
        : Date.now();
      this._handleTapClick(eventTime);
    } catch (error) {
      handleUIError(error, { context: '处理键盘TAP事件' });
    }
  }

  /**
   * 处理TAP按钮点击事件（实现TAP Tempo功能）
   * @private
   * @param {number} [nowArg] - 外部传入的时间戳（用于统一键盘/按钮逻辑）
   */
  _handleTapClick(nowArg) {
    try {
      const now = typeof nowArg === 'number' ? nowArg : Date.now();

      // 按钮点击视觉反馈（优先触发）
      if (this.tapButton) {
        this.tapButton.classList.add('active');
        setTimeout(() => {
          if (this.tapButton) {
            this.tapButton.classList.remove('active');
          }
        }, 80);
      }

      // 首次TAP：仅记录时间，不计算BPM
      if (!this.lastTapTime) {
        this.lastTapTime = now;
        return;
      }

      // 非首次TAP：计算时间间隔
      const interval = now - this.lastTapTime;

      // 计算最小有效间隔（防误触：基于平滑值动态调整或用默认值）
      const minInterval = this.smoothedFastInterval
        ? Math.max(30, Math.floor(this.smoothedFastInterval * 0.4))
        : 40;

      // 极短间隔（误触）：忽略并保留上一次时间戳
      if (interval < minInterval) {
        console.log(`⏭️ [controls.js] 极短间隔忽略: ${interval}ms (min=${minInterval}ms)`);
        return;
      }

      // 分支1：快速TAP（间隔<200ms）- 平滑处理
      if (interval < 200) {
        // 初始化或更新平滑间隔
        this.smoothedFastInterval = this.smoothedFastInterval
          ? (interval * this.fastTapWeight) + (this.smoothedFastInterval * (1 - this.fastTapWeight))
          : interval;

        // 计算并更新BPM（防抖处理）
        const bpm = Math.round(60000 / this.smoothedFastInterval);
        const validBPM = Math.max(40, Math.min(300, bpm));
        this.setBPMFromTap(validBPM);

        console.log(`⚡ [controls.js] 快速TAP: ${validBPM} BPM (当前: ${interval}ms, 平滑: ${Math.round(this.smoothedFastInterval)}ms)`);
      }

      // 分支2：正常TAP（200ms≤间隔≤2000ms）- 去极值平均
      else if (interval <= 2000) {
        // 重置快速TAP状态
        this.smoothedFastInterval = null;

        // 记录间隔（增加样本数量提高稳定性）
        this.tapIntervals.push(interval);
        const MAX_INTERVALS = 7; // 增加到7个样本以提高稳定性
        if (this.tapIntervals.length > MAX_INTERVALS) {
          this.tapIntervals.shift();
        }

        // 去极值平均（样本数≥4时剔除首尾）
        const sortedIntervals = [...this.tapIntervals].sort((a, b) => a - b);
        let avgInterval;
        if (sortedIntervals.length >= 4) {
          const trimmed = sortedIntervals.slice(1, sortedIntervals.length - 1);
          avgInterval = trimmed.reduce((sum, val) => sum + val, 0) / trimmed.length;
        } else {
          avgInterval = sortedIntervals.reduce((sum, val) => sum + val, 0) / sortedIntervals.length;
        }

        // 计算并更新BPM（防抖处理）
        const bpm = Math.round(60000 / avgInterval);
        const validBPM = Math.max(40, Math.min(300, bpm));
        this.setBPMFromTap(validBPM);

        console.log(`🎵 [controls.js] TAP BPM: ${validBPM} (平均间隔: ${Math.round(avgInterval)}ms, 样本数: ${this.tapIntervals.length})`);
      }

      // 分支3：TAP超时（间隔>2000ms）- 重置历史数据
      else {
        console.log('⏱️ [controls.js] TAP 超时，重新开始');
        this.tapIntervals = [];
        this.smoothedFastInterval = null;
      }

      // 更新上一次TAP时间戳（仅在有效TAP时更新）
      this.lastTapTime = now;
    } catch (error) {
      handleUIError(error, { context: '处理tap tempo点击' });
    }
  }

  /**
   * 处理节拍事件（更新节拍指示器高亮）
   * @private
   * @param {CustomEvent} event - 节拍事件对象（含当前拍数、是否为第一拍）
   */
  _handleBeatEvent(event) {
    try {
      const { beat, isFirstBeat } = event.detail;
      this._updateBeatIndicator(beat, isFirstBeat);
    } catch (error) {
      handleUIError(error, { context: '处理节拍事件' });
    }
  }

  /**
   * 更新节拍指示器高亮状态
   * @private
   * @param {number} beat - 当前节拍数（1-based）
   * @param {boolean} isFirstBeat - 是否为当前小节的第一拍
   */
  _updateBeatIndicator(beat, isFirstBeat) {
    try {
      if (!this.indicatorDots || this.indicatorDots.length === 0) {
        return;
      }

      // 重置所有指示器，高亮当前节拍
      this.indicatorDots.forEach((dot, index) => {
        toggleClass(dot, 'active', index === beat - 1);

        // 第一拍特殊高亮（200ms后移除）
        if (isFirstBeat && index === 0) {
          toggleClass(dot, 'first-beat', true);
          setTimeout(() => {
            if (dot) {
              toggleClass(dot, 'first-beat', false);
            }
          }, 200);
        }
      });
    } catch (error) {
      handleUIError(error, { context: '更新节拍指示器' });
    }
  }

  /**
   * 销毁UI控制器（清理资源，避免内存泄漏）
   * @example uiController.destroy();
   */
  destroy() {
    try {
      if (!this.initialized) return;

      // 1. 取消状态订阅
      if (this.unsubscribeState) {
        this.unsubscribeState();
        this.unsubscribeState = null;
      }

      // 2. 移除所有事件监听器
      this._removeAllEventListeners();

      // 3. 清理DOM与变量引用
      this._cleanupReferences();

      this.initialized = false;
      console.log('✅ [controls.js] UI控制器已销毁');
    } catch (error) {
      handleUIError(error, { context: '销毁UI控制器' });
    }
  }

  /**
   * 绑定全局事件（当前仅占位，键盘事件由keyboard模块统一管理）
   * @private
   */
  _bindGlobalEvents() {
    try {
      console.log('ℹ️ [controls.js] 全局事件绑定完成（键盘事件由 keyboard.js 管理）');
    } catch (error) {
      handleUIError(error, { context: '绑定全局事件' });
    }
  }

  /**
   * 显示错误消息（自动3秒后隐藏）
   * @private
   * @param {string} message - 错误消息内容
   */
  _showErrorMessage(message) {
    try {
      if (!this.errorMessageContainer) {
        console.error(`❌ [controls.js] ${message}`);
        return;
      }

      // 设置错误消息样式与内容
      this.errorMessageContainer.textContent = message;
      this.errorMessageContainer.classList.add('error');
      this.errorMessageContainer.classList.remove('hidden', 'notification');

      // 3秒后自动隐藏
      setTimeout(() => {
        if (this.errorMessageContainer) {
          this.errorMessageContainer.classList.add('hidden');
        }
      }, 3000);
    } catch (error) {
      console.error('❌ [controls.js] 显示错误消息时出错:', error);
    }
  }

  /**
   * 显示通知消息（自动2秒后隐藏）
   * @private
   * @param {string} message - 通知消息内容
   */
  _showNotification(message) {
    try {
      if (!this.errorMessageContainer) {
        console.log(`ℹ️ [controls.js] ${message}`);
        return;
      }

      // 设置通知消息样式与内容
      this.errorMessageContainer.textContent = message;
      this.errorMessageContainer.classList.add('notification');
      this.errorMessageContainer.classList.remove('hidden', 'error');

      // 2秒后自动隐藏
      setTimeout(() => {
        if (this.errorMessageContainer) {
          this.errorMessageContainer.classList.add('hidden');
        }
      }, 2000);
    } catch (error) {
      console.error('❌ [controls.js] 显示通知时出错:', error);
    }
  }

  /**
   * 移除所有已绑定的事件监听器
   * @private
   */
  _removeAllEventListeners() {
    try {
      this.eventListeners.forEach((binding) => {
        removeEventListenerSafe(binding.element, binding.event, binding.handler);
      });
      this.eventListeners.clear();
    } catch (error) {
      console.error('❌ [controls.js] 移除事件监听器时出错:', error);
    }
  }

  /**
   * 清理DOM与变量引用（避免内存泄漏）
   * @private
   */
  _cleanupReferences() {
    try {
      // 清理DOM元素引用
      this.bpmDisplay = null;
      this.volumeDisplay = null;
      this.denominatorIcon = null;
      this.bpmSlider = null;
      this.bpmInput = null;
      this.volumeSlider = null;
      this.beatNumerator = null;
      this.beatDenominator = null;
      this.toggleButton = null;
      this.resetButton = null;
      this.tapButton = null;
      this.errorMessageContainer = null;
      this.indicatorDots = null;

      // 清理业务变量引用
      this.tapIntervals = [];
      this.lastTapTime = null;
      this.smoothedFastInterval = null;
    } catch (error) {
      console.error('❌ [controls.js] 清理变量引用时出错:', error);
    }
  }

  /**
   * 安全清理函数（初始化失败时调用，确保资源释放）
   * @private
   */
  _safeCleanup() {
    try {
      this._removeAllEventListeners();
      this._cleanupReferences();
      this.initialized = false;
    } catch (error) {
      console.error('❌ [controls.js] 安全清理时出错:', error);
    }
  }

  /**
   * 获取当前UI性能统计数据
   * @returns {Object} 性能统计对象
   * @property {number} updates - UI更新总次数
   * @property {number} renderTime - 首次渲染耗时(ms)
   * @property {number|null} lastUpdateTime - 最后一次更新时间戳
   */
  getPerformanceStats() {
    return { ...this.performanceStats }; // 返回副本，避免外部修改
  }

  /**
   * 检查UI控制器是否已初始化
   * @returns {boolean} 已初始化返回true，否则返回false
   */
  isInitialized() {
    return this.initialized;
  }
}

/**
 * UI控制器单例实例
 * @type {UIController}
 */
export const uiController = new UIController();