/**
 * UI控制模块 - 管理节拍器的用户界面
 * 
 * @module controls
 * @description 处理用户界面元素的更新、事件绑定和交互逻辑，提供错误处理和优化的用户体验
 */

import { getElement, getElements, addEventListenerSafe, removeEventListenerSafe, setText, toggleClass, debounce, throttle, isValidBPM, isValidTimeSignature, getNoteIcon } from '../utils/helpers.js';
import { handleUIError, handleTrainingError } from '../utils/errorManager.js';
import { setBPM, setTimeSignature, setVolume, toggleMetronome } from '../core/metronome.js';
import { getState, updateState, subscribeToState } from '../utils/state.js';
import { CONFIG } from '../utils/config.js'; 

/**
 * UI控制器类
 */
class UIController {
    constructor() {
        this.initialized = false;
        this.unsubscribeState = null;
        this.eventListeners = new Map(); // 存储事件监听器引用以便后续清理
        this.debouncedUpdateBPM = debounce(this._updateBPM.bind(this), 100);
        this.throttledTapClick = throttle(this._handleTapClick.bind(this), 200);
        this.lastTapTime = null;
        this.tapIntervals = [];
        this._handleKeyDown = this._handleKeyDown.bind(this);
        
        // 性能统计
        this.performanceStats = {
            updates: 0,
            lastUpdateTime: null,
            renderTime: 0
        };
    }
    
    /**
     * 初始化UI控制器
     * @returns {Promise<void>}
     * 
     * @example
     * // 初始化UI控制器
     * await uiController.init();
     */
    /**
     * 初始化UI控制器
     * @returns {Promise<boolean>} 初始化是否成功
     * 
     * @example
     * // 初始化UI控制器
     * const success = await uiController.init();
     */
    async init() {
        try {
            if (this.initialized) {
                console.warn('UI控制器已经初始化');
                return true;
            }
            
            // 绑定DOM元素
            if (!this._bindElements()) {
                const error = new Error('DOM元素绑定失败');
                handleUIError(error, { context: 'UI控制器初始化' });
                return false;
            }
            
            // 绑定事件监听器
            this._bindEvents();
            
            // 订阅状态变更
            this._subscribeToState();
            
            // 初始化UI显示
            const startTime = performance.now();
            this._updateUIDisplay();
            this.performanceStats.renderTime = performance.now() - startTime;
            this.performanceStats.lastUpdateTime = Date.now();
            
            // 绑定全局键盘事件作为备用控制方式
            this._bindGlobalEvents();
            
            this.initialized = true;
            console.log('UI控制器初始化成功');
            return true;
        } catch (error) {
            const handledError = handleUIError(error, { context: 'UI控制器初始化' });
            this._safeCleanup();
            return false;
        }
    }
    
    /**
     * 绑定DOM元素
     * @private
     */
    /**
     * 绑定DOM元素
     * @private
     * @returns {boolean} 绑定是否成功
     */
    _bindElements() {
        try {
            // 显示元素
            this.bpmDisplay = getElement('#bpm-value');
            this.volumeDisplay = getElement('#volume-value');
            this.denominatorIcon = getElement('#denominator-icon');
            
            // 控制元素
            this.bpmSlider = getElement('#bpm-slider');
            this.bpmInput = getElement('#bpm-input');
            this.volumeSlider = getElement('#volume-slider');
            this.beatNumerator = getElement('#beat-numerator');
            this.beatDenominator = getElement('#beat-denominator');
            
            // 按钮
            this.toggleButton = getElement('#toggle-btn');
            this.resetButton = getElement('#reset-btn');
            this.tapButton = getElement('#tap-btn');
            
            // 错误信息显示容器
            this.errorMessageContainer = getElement('#error-message');
            
            // 节拍指示器
            this.indicatorDots = getElements('.beat-dot');
            
            // 检查必需的元素是否存在
            const requiredElements = [
                { name: 'bpmDisplay', element: this.bpmDisplay },
                { name: 'toggleButton', element: this.toggleButton }
            ];
            
            const missingElements = requiredElements.filter(el => !el.element);
            if (missingElements.length > 0) {
                const error = new Error(`缺少必需的DOM元素: ${missingElements.map(el => el.name).join(', ')}`);
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
     * 绑定事件监听器
     * @private
     */
    /**
     * 绑定事件监听器
     * @private
     */
    _bindEvents() {
        try {
            // 存储事件监听器引用以便后续清理
            const eventBindings = [
                { element: this.toggleButton, event: 'click', handler: this._handleToggleClick.bind(this) },
                { element: window, event: 'metronome:beat', handler: this._handleBeatEvent.bind(this) }
            ];
            
            // 可选元素的事件绑定
            if (this.resetButton) {
                eventBindings.push({ 
                    element: this.resetButton, 
                    event: 'click', 
                    handler: this._handleResetClick.bind(this) 
                });
            }
            
            if (this.bpmSlider) {
                eventBindings.push(
                    { element: this.bpmSlider, event: 'input', handler: this._handleBPMInput.bind(this) },
                    { element: this.bpmSlider, event: 'change', handler: this._handleBPMChange.bind(this) }
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
                    handler: this.throttledTapClick 
                });
            }
            
            // 绑定所有事件并存储引用
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
     * 订阅状态变更
     * @private
     */
    /**
     * 订阅状态变更
     * @private
     */
    _subscribeToState() {
        try {
            this.unsubscribeState = subscribeToState((prevState, newState) => {
                // 防止过多的UI更新，只在状态真正改变时更新UI
                this._handleStateChange(prevState, newState);
            });
        } catch (error) {
            handleUIError(error, { context: '订阅状态变更' });
        }
    }
    
    /**
     * 处理状态变更
     * @private
     * @param {Object} prevState - 前一个状态
     * @param {Object} newState - 新的状态
     */
    /**
     * 处理状态变更
     * @private
     * @param {Object} prevState - 前一个状态
     * @param {Object} newState - 新的状态
     */
    _handleStateChange(prevState, newState) {
        try {
            // 优化UI更新：只在必要时更新UI元素
            // 更新BPM显示
            if (prevState.bpm !== newState.bpm) {
                this._updateBPMDisplay(newState.bpm);
            }
            
            // 更新音量显示
            if (prevState.volume !== newState.volume) {
                this._updateVolumeDisplay(newState.volume);
            }
            
            // 更新运行状态显示
            if (prevState.isRunning !== newState.isRunning) {
                this._updateRunningStateDisplay(newState.isRunning);
            }
            
            // 更新拍号显示
            if (prevState.beatNumerator !== newState.beatNumerator ||
                prevState.beatDenominator !== newState.beatDenominator) {
                this._updateTimeSignatureDisplay(newState.beatNumerator, newState.beatDenominator);
            }
        } catch (error) {
            handleUIError(error, { context: '处理状态变更' });
        }
    }
    
    /**
     * 更新UI显示
     * @private
     */
    /**
     * 更新UI显示
     * @private
     * @param {boolean} forceUpdate - 是否强制更新所有UI元素
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
     * 更新BPM显示
     * @private
     * @param {number} bpm - BPM值
     */
    _updateBPMDisplay(bpm) {
        setText(this.bpmDisplay, bpm.toString());
        
        if (this.bpmSlider && this.bpmSlider.value !== bpm.toString()) {
            this.bpmSlider.value = bpm;
        }
        
        if (this.bpmInput && this.bpmInput.value !== bpm.toString()) {
            this.bpmInput.value = bpm;
        }
    }
    
    /**
     * 更新音量显示
     * @private
     * @param {number} volume - 音量值
     */
    _updateVolumeDisplay(volume) {
        setText(this.volumeDisplay, volume.toString());
        
        if (this.volumeSlider && this.volumeSlider.value !== volume.toString()) {
            this.volumeSlider.value = volume;
        }
    }
    
    /**
     * 更新运行状态显示
     * @private
     * @param {boolean} isRunning - 是否正在运行
     */
    _updateRunningStateDisplay(isRunning) {
        if (this.toggleButton) {
            toggleClass(this.toggleButton, 'start', !isRunning);
            toggleClass(this.toggleButton, 'stop', isRunning);
            setText(this.toggleButton, isRunning ? '停止' : '开始');
        }
    }
    
    /**
     * 更新拍号显示
     * @private
     * @param {number} numerator - 拍号分子
     * @param {number} denominator - 拍号分母
     */
    _updateTimeSignatureDisplay(numerator, denominator) {
        if (this.beatNumerator && this.beatNumerator.value !== numerator.toString()) {
            this.beatNumerator.value = numerator;
        }
        
        if (this.beatDenominator && this.beatDenominator.value !== denominator.toString()) {
            this.beatDenominator.value = denominator;
        }
        
        if (this.denominatorIcon) {
            setText(this.denominatorIcon, getNoteIcon(denominator));
        }
        
        // 更新节拍指示器
        this._updateBeatIndicators(numerator);
    }
    
    /**
     * 更新节拍指示器
     * @private
     * @param {number} beatCount - 每小节的拍数
     */
    _updateBeatIndicators(beatCount) {
        const container = getElement('#indicator-dots');
        if (!container) return;
        
        // 清空现有的指示器
        container.innerHTML = '';
        
        // 创建新的指示器点
        for (let i = 0; i < beatCount; i++) {
            const dot = document.createElement('div');
            dot.className = 'beat-dot' + (i === 0 ? ' first' : '');
            container.appendChild(dot);
        }
        
        // 更新引用
        this.indicatorDots = getElements('.beat-dot');
    }
    
    /**
     * 处理切换按钮点击
     * @private
     */
    /**
     * 处理切换按钮点击
     * @private
     */
    _handleToggleClick() {
        try {
            toggleMetronome();
            // 添加视觉反馈
            if (this.toggleButton) {
                this.toggleButton.classList.add('active');
                setTimeout(() => {
                    if (this.toggleButton) {
                        this.toggleButton.classList.remove('active');
                    }
                }, 200);
            }
        } catch (error) {
            // 特殊处理训练模式错误
            if (error.message && error.message.includes('training')) {
                handleTrainingError(error, { context: '切换训练模式' });
            } else {
                handleUIError(error, { context: '切换节拍器状态' });
            }
            this._showErrorMessage('无法切换节拍器状态');
        }
    }
    
    /**
     * 处理重置按钮点击
     * @private
     */
    _handleResetClick() {
        try {
            // 实现重置逻辑
            console.log('重置按钮被点击');
            
            // 重置为默认值
            const defaultBPM = CONFIG.defaultBPM;
            const defaultVolume = CONFIG.defaultVolume;  
            const defaultNumerator = CONFIG.defaultBeatNumerator;
            const defaultDenominator = CONFIG.defaultBeatDenominator;
            
            setBPM(defaultBPM);
            setVolume(defaultVolume);
            setTimeSignature(defaultNumerator, defaultDenominator);
            
            // 清除tap tempo数据
            this.tapIntervals = [];
            this.lastTapTime = null;
            
            // 显示重置成功的反馈
            this._showNotification('已重置为默认设置');
        } catch (error) {
            handleUIError(error, { context: '重置节拍器设置' });
            this._showErrorMessage('重置失败');
        }
    }
    
    /**
     * 处理BPM滑块输入
     * @private
     * @param {Event} event - 事件对象
     */
    /**
     * 处理BPM滑块输入
     * @private
     * @param {Event} event - 事件对象
     */
    _handleBPMInput(event) {
        try {
            const bpm = parseInt(event.target.value, 10);
            // 使用辅助函数验证BPM值
            if (isValidBPM(bpm)) {
                this._updateBPMDisplay(bpm);
                this.debouncedUpdateBPM(bpm);
            }
        } catch (error) {
            handleUIError(error, { context: '处理BPM滑块输入' });
        }
    }
    
    /**
     * 处理BPM滑块变更（鼠标释放时）
     * @private
     * @param {Event} event - 事件对象
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
     * 更新BPM值
     * @private
     * @param {number} bpm - BPM值
     */
    _updateBPM(bpm) {
        try {
            if (!isNaN(bpm)) {
                // 确保BPM在有效范围内
            const validBPM = Math.max(40, Math.min(300, bpm));
                setBPM(validBPM);
            }
        } catch (error) {
            handleUIError(error, { context: '更新BPM值' });
        }
    }
    
    /**
     * 处理BPM输入框变更
     * @private
     * @param {Event} event - 事件对象
     */
    _handleBPMInputChange(event) {
        try {
            let bpm = parseInt(event.target.value, 10);
            
            // 验证输入
            if (isNaN(bpm) || bpm < 40 || bpm > 300) {
                // 恢复到当前值
                const state = getState();
                this._updateBPMDisplay(state.bpm);
                this._showNotification('BPM必须在40-300之间');
                return;
            }
            
            setBPM(bpm);
        } catch (error) {
            handleUIError(error, { context: '处理BPM输入框变更' });
            this._showErrorMessage('无法更新BPM');
        }
    }
    
    /**
     * 处理音量滑块输入
     * @private
     * @param {Event} event - 事件对象
     */
    /**
     * 处理音量滑块输入
     * @private
     * @param {Event} event - 事件对象
     */
    _handleVolumeInput(event) {
        try {
            const volume = parseInt(event.target.value, 10);
            if (!isNaN(volume)) {
                // 确保音量在有效范围内
                const validVolume = Math.max(0, Math.min(100, volume));
                setVolume(validVolume);
            }
        } catch (error) {
            handleUIError(error, { context: '处理音量滑块输入' });
        }
    }
    
    /**
     * 处理拍号变更
     * @private
     */
    _handleTimeSignatureChange() {
        try {
            const numerator = parseInt(this.beatNumerator.value, 10);
            const denominator = parseInt(this.beatDenominator.value, 10);
            
            // 使用辅助函数验证拍号值
            if (!isValidTimeSignature(numerator, denominator)) {
                // 恢复到当前值
                const state = getState();
                this._updateTimeSignatureDisplay(state.beatNumerator, state.beatDenominator);
                this._showNotification('拍号无效，请使用标准拍号');
                return;
            }
            
            setTimeSignature(numerator, denominator);
        } catch (error) {
            handleUIError(error, { context: '处理拍号变更' });
            this._showErrorMessage('无法更新拍号');
        }
    }
    
    /**
     * 处理点击按钮点击
     * @private
     */
    /**
     * 处理点击按钮点击 - 实现tap tempo功能
     * @private
     */
    _handleTapClick() {
        try {
            const now = Date.now();
            
            // 如果有上次点击时间，计算间隔
            if (this.lastTapTime) {
                const interval = now - this.lastTapTime;
                // 只考虑合理的间隔（200ms-2000ms）
                if (interval >= 200 && interval <= 2000) {
                    this.tapIntervals.push(interval);
                    // 只保留最近的5次点击以获得更准确的平均值
                    if (this.tapIntervals.length > 5) {
                        this.tapIntervals.shift();
                    }
                    
                    // 计算平均间隔并转换为BPM
                    const avgInterval = this.tapIntervals.reduce((sum, val) => sum + val, 0) / this.tapIntervals.length;
                    const bpm = Math.round(60000 / avgInterval); // 60,000ms = 1分钟
                    
                    // 限制BPM范围
                    const validBPM = Math.max(40, Math.min(300, bpm));
                    setBPM(validBPM);
                    
                    // 视觉反馈
                    if (this.tapButton) {
                        this.tapButton.classList.add('active');
                        setTimeout(() => {
                            if (this.tapButton) {
                                this.tapButton.classList.remove('active');
                            }
                        }, 200);
                    }
                }
            }
            
            this.lastTapTime = now;
        } catch (error) {
            handleUIError(error, { context: '处理tap tempo点击' });
        }
    }
    
    /**
     * 处理节拍事件
     * @private
     * @param {CustomEvent} event - 节拍事件
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
     * 更新节拍指示器高亮
     * @private
     * @param {number} beat - 当前节拍
     * @param {boolean} isFirstBeat - 是否为第一拍
     */
    /**
     * 更新节拍指示器高亮
     * @private
     * @param {number} beat - 当前节拍
     * @param {boolean} isFirstBeat - 是否为第一拍
     */
    _updateBeatIndicator(beat, isFirstBeat) {
        try {
            // 确保指示器点存在
            if (!this.indicatorDots || this.indicatorDots.length === 0) {
                return;
            }
            
            // 重置所有指示器
            this.indicatorDots.forEach((dot, index) => {
                toggleClass(dot, 'active', index === beat - 1);
                // 为第一拍添加特殊样式
                if (isFirstBeat && index === 0) {
                    toggleClass(dot, 'first-beat', true);
                    // 移除第一拍的特殊样式（可以添加动画效果）
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
     * 销毁UI控制器，清理资源
     * 
     * @example
     * // 销毁UI控制器
     * uiController.destroy();
     */
    /**
     * 销毁UI控制器，清理资源
     * 
     * @example
     * // 销毁UI控制器
     * uiController.destroy();
     */
    destroy() {
        try {
            if (!this.initialized) return;
            
            // 取消状态订阅
            if (this.unsubscribeState) {
                this.unsubscribeState();
                this.unsubscribeState = null;
            }
            
            // 移除所有事件监听器
            this._removeAllEventListeners();
            
            // 移除全局事件监听器
            removeEventListenerSafe(document, 'keydown', this._handleKeyDown);
            
            // 清理变量引用
            this._cleanupReferences();
            
            this.initialized = false;
            console.log('UI控制器已销毁');
        } catch (error) {
            handleUIError(error, { context: '销毁UI控制器' });
        }
    }
    
    /**
     * 绑定全局事件（如键盘快捷键）
     * @private
     */
    _bindGlobalEvents() {
        try {
            // 添加键盘事件监听作为备用控制方式
            addEventListenerSafe(document, 'keydown', this._handleKeyDown);
        } catch (error) {
            handleUIError(error, { context: '绑定全局事件' });
        }
    }
    
    /**
     * 处理键盘事件
     * @private
     * @param {KeyboardEvent} event - 键盘事件对象
     */
    _handleKeyDown(event) {
        try {
            // 防止在输入框中触发快捷键
            const target = event.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }
            
            // 空格键：切换节拍器
            if (event.code === 'Space') {
                event.preventDefault(); // 防止页面滚动
                this._handleToggleClick();
            }
            // R键：重置
            else if (event.code === 'KeyR' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                this._handleResetClick();
            }
        } catch (error) {
            handleUIError(error, { context: '处理键盘事件' });
        }
    }
    
    /**
     * 显示错误消息
     * @private
     * @param {string} message - 错误消息
     */
    _showErrorMessage(message) {
        try {
            if (this.errorMessageContainer) {
                this.errorMessageContainer.textContent = message;
                this.errorMessageContainer.classList.add('error');
                this.errorMessageContainer.classList.remove('hidden');
                
                // 3秒后自动隐藏
                setTimeout(() => {
                    if (this.errorMessageContainer) {
                        this.errorMessageContainer.classList.add('hidden');
                    }
                }, 3000);
            } else {
                console.error(message);
            }
        } catch (error) {
            console.error('显示错误消息时出错:', error);
        }
    }
    
    /**
     * 显示通知消息
     * @private
     * @param {string} message - 通知消息
     */
    _showNotification(message) {
        try {
            if (this.errorMessageContainer) {
                this.errorMessageContainer.textContent = message;
                this.errorMessageContainer.classList.remove('error');
                this.errorMessageContainer.classList.add('notification');
                this.errorMessageContainer.classList.remove('hidden');
                
                // 2秒后自动隐藏
                setTimeout(() => {
                    if (this.errorMessageContainer) {
                        this.errorMessageContainer.classList.add('hidden');
                    }
                }, 2000);
            } else {
                console.log(message);
            }
        } catch (error) {
            console.error('显示通知时出错:', error);
        }
    }
    
    /**
     * 移除所有事件监听器
     * @private
     */
    _removeAllEventListeners() {
        try {
            this.eventListeners.forEach((binding, key) => {
                removeEventListenerSafe(binding.element, binding.event, binding.handler);
            });
            this.eventListeners.clear();
        } catch (error) {
            console.error('移除事件监听器时出错:', error);
        }
    }
    
    /**
     * 清理变量引用
     * @private
     */
    _cleanupReferences() {
        try {
            // 清理DOM引用
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
            
            // 清理其他变量
            this.tapIntervals = [];
            this.lastTapTime = null;
        } catch (error) {
            console.error('清理变量引用时出错:', error);
        }
    }
    
    /**
     * 安全清理函数，确保在初始化失败时也能清理资源
     * @private
     */
    _safeCleanup() {
        try {
            this._removeAllEventListeners();
            this._cleanupReferences();
            this.initialized = false;
        } catch (error) {
            console.error('安全清理时出错:', error);
        }
    }
    
    /**
     * 获取当前性能统计信息
     * @returns {Object} 性能统计数据
     */
    getPerformanceStats() {
        return {
            updates: this.performanceStats.updates,
            renderTime: this.performanceStats.renderTime,
            lastUpdateTime: this.performanceStats.lastUpdateTime
        };
    }
    
    /**
     * 检查UI控制器是否已初始化
     * @returns {boolean} 是否已初始化
     */
    isInitialized() {
        return this.initialized;
    }
}

/**
 * UI控制器实例
 * @type {UIController}
 */
export const uiController = new UIController();