/**
 * 训练模式核心模块 - 处理节拍器训练会话的实际运行和控制
 * 
 * @module trainingCore
 * @description 管理训练会话的创建、运行、暂停和完成等核心逻辑，提供错误处理和性能优化
 */

import { getState, updateState } from '../utils/state.js';
import { setBPM, setTimeSignature, toggleMetronome, stopMetronome } from '../core/metronome.js';
import { handleTrainingError } from '../utils/errorManager.js';
import { throttle, debounce } from '../utils/helpers.js';

/**
 * 训练会话管理器类
 */
class TrainingSessionManager {
    constructor() {
        this.sessionId = null;
        this.segments = [];
        this.currentSegmentIndex = 0;
        this.currentRepeat = 1;
        this.remainingBeats = 0;
        this.isRunning = false;
        this.timer = null;
        this.lastBeatTime = 0;
        this.eventListeners = new Map(); // 存储事件监听器引用
        this.isInitialized = false;
        this._handleBeat = this._handleBeat.bind(this); // 绑定this上下文
        this._debouncedUpdateState = debounce(this._updateTrainingState.bind(this), 50);
        this.performanceStats = {
            startTime: 0,
            totalBeats: 0,
            processedBeats: 0,
            averageResponseTime: 0
        };
    }
    
    /**
     * 初始化训练会话管理器
     * @returns {boolean} 初始化是否成功
     */
    init() {
        try {
            if (this.isInitialized) {
                console.warn('训练会话管理器已经初始化');
                return true;
            }
            
            this.isInitialized = true;
            console.log('训练会话管理器初始化成功');
            return true;
        } catch (error) {
            handleTrainingError(error, { context: '初始化训练会话管理器' });
            return false;
        }
    }

    /**
     * 开始新的训练会话
     * @param {Array<Object>} segments - 训练段落配置数组
     * @returns {Promise<boolean>} 会话是否成功启动
     * 
     * @example
     * // 开始训练会话
     * await trainingSessionManager.startSession([
     *   { bpm: 120, beats: 4, repeats: 2 },
     *   { bpm: 140, beats: 4, repeats: 1 }
     * ]);
     */
    async startSession(segments) {
        try {
            // 参数验证
            if (!Array.isArray(segments) || segments.length === 0) {
                throw new Error('无效的训练段落配置：必须提供至少一个段落');
            }
            
            // 验证每个段落配置
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                if (!segment || typeof segment !== 'object') {
                    throw new Error(`段落 ${i + 1} 配置无效`);
                }
                if (typeof segment.bpm !== 'number' || segment.bpm < 40 || segment.bpm > 208) {
                    throw new Error(`段落 ${i + 1} 的BPM必须在40-208之间`);
                }
                if (typeof segment.beats !== 'number' || segment.beats < 1 || segment.beats > 16) {
                    throw new Error(`段落 ${i + 1} 的节拍数必须在1-16之间`);
                }
                if (typeof segment.repeats !== 'number' || segment.repeats < 1 || segment.repeats > 100) {
                    throw new Error(`段落 ${i + 1} 的重复次数必须在1-100之间`);
                }
            }
            
            // 停止之前可能正在运行的会话
            this.stopSession();
            
            // 初始化会话
            this.sessionId = 'session-' + Date.now();
            this.segments = segments;
            this.currentSegmentIndex = 0;
            this.currentRepeat = 1;
            
            // 获取第一个段落配置
            const firstSegment = segments[0];
            this.remainingBeats = firstSegment.beats;
            
            // 重置性能统计
            this._resetPerformanceStats();
            this.performanceStats.startTime = Date.now();
            this.performanceStats.totalBeats = segments.reduce((total, seg) => total + (seg.beats * seg.repeats), 0);
            
            // 配置节拍器
            if (!this._configureMetronome(firstSegment)) {
                return false;
            }
            
            // 启动节拍器
            toggleMetronome();
            
            // 标记会话为运行中
            this.isRunning = true;
            
            // 初始化节拍计时
            this.lastBeatTime = Date.now();
            
            // 订阅节拍事件（使用存储的绑定函数）
            this._addEventListener(window, 'metronome:beat', this._handleBeat);
            
            // 触发训练开始事件
            this._dispatchEvent('training:started', {
                sessionId: this.sessionId,
                segments: this.segments
            });
            
            // 触发第一个段落开始事件
            this._dispatchEvent('training:segmentChange', {
                segmentIndex: this.currentSegmentIndex,
                segment: firstSegment,
                currentRepeat: this.currentRepeat
            });
            
            // 更新状态
            this._updateTrainingState();
            
            console.log(`训练会话开始: ${this.sessionId}`);
            return true;
        } catch (error) {
            const handledError = handleTrainingError(error, { context: '开始训练会话' });
            this._dispatchEvent('training:error', { error: handledError.message });
            return false;
        }
    }
    
    /**
     * 暂停训练会话
     * @returns {boolean} 暂停是否成功
     */
    pauseSession() {
        try {
            if (!this.isRunning) {
                console.warn('训练会话未在运行，无法暂停');
                return false;
            }
            
            if (!this.sessionId) {
                console.warn('没有活动的会话，无法暂停');
                return false;
            }
            
            // 暂停节拍器
            toggleMetronome();
            
            // 更新状态
            this.isRunning = false;
            
            // 触发暂停事件
            this._dispatchEvent('training:paused', {
                sessionId: this.sessionId,
                currentSegmentIndex: this.currentSegmentIndex,
                remainingBeats: this.remainingBeats
            });
            
            // 更新状态
            this._updateTrainingState();
            
            console.log(`训练会话暂停: ${this.sessionId}`);
            return true;
        } catch (error) {
            handleTrainingError(error, { context: '暂停训练会话' });
            return false;
        }
    }
    
    /**
     * 恢复训练会话
     * @returns {boolean} 恢复是否成功
     */
    resumeSession() {
        try {
            if (this.isRunning) {
                console.warn('训练会话已经在运行，无需恢复');
                return false;
            }
            
            if (!this.sessionId) {
                console.warn('没有活动的会话，无法恢复');
                return false;
            }
            
            // 恢复节拍器
            toggleMetronome();
            
            // 更新状态
            this.isRunning = true;
            
            // 触发恢复事件
            this._dispatchEvent('training:resumed', {
                sessionId: this.sessionId
            });
            
            // 更新状态
            this._updateTrainingState();
            
            console.log(`训练会话恢复: ${this.sessionId}`);
            return true;
        } catch (error) {
            handleTrainingError(error, { context: '恢复训练会话' });
            return false;
        }
    }
    
    /**
     * 停止训练会话
     * @param {boolean} isComplete - 是否是由于完成而停止
     * @returns {boolean} 停止是否成功
     */
    stopSession(isComplete = false) {
        try {
            if (!this.sessionId) {
                return false;
            }
            
            // 停止节拍器
            stopMetronome();
            
            // 清理定时器
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
            
            // 移除所有事件监听器
            this._removeAllEventListeners();
            
            // 触发停止事件
            if (this.isRunning && !isComplete) {
                this._dispatchEvent('training:stopped', {
                    sessionId: this.sessionId,
                    currentSegmentIndex: this.currentSegmentIndex,
                    performanceStats: this.performanceStats
                });
            }
            
            // 清理全局状态中的训练状态
            const currentState = getState();
            if (currentState.trainingState) {
                updateState({ trainingState: null });
            }
            
            // 重置状态
            this.isRunning = false;
            console.log(`训练会话停止: ${this.sessionId}`);
            
            // 清除会话ID
            this.sessionId = null;
            
            // 重置会话相关状态
            this.segments = [];
            this.currentSegmentIndex = 0;
            this.currentRepeat = 1;
            this.remainingBeats = 0;
            
            return true;
        } catch (error) {
            handleTrainingError(error, { context: '停止训练会话' });
            return false;
        }
    }
    
    /**
     * 配置节拍器
     * @private
     * @param {Object} segment - 训练段落配置
     * @returns {boolean} 配置是否成功
     */
    _configureMetronome(segment) {
        try {
            if (!segment || typeof segment !== 'object') {
                throw new Error('无效的段落配置');
            }
            
            // 设置BPM
            setBPM(segment.bpm);
            
            // 设置拍号
            setTimeSignature(segment.beats, 4); // 假设分母总是4
            
            console.log(`节拍器已配置: ${segment.bpm} BPM, ${segment.beats}/4`);
            return true;
        } catch (error) {
            handleTrainingError(error, { context: '配置节拍器' });
            this._dispatchEvent('training:error', { error: '无法配置节拍器' });
            return false;
        }
    }
    
    /**
     * 处理节拍事件
     * @private
     * @param {CustomEvent} event - 节拍事件
     */
    _handleBeat(event) {
        try {
            if (!this.isRunning || !this.sessionId) {
                return;
            }
            
            const startTime = performance.now();
            const currentTime = Date.now();
            
            // 安全地获取事件详情
            const detail = event && event.detail || {};
            const { beat = 0, isFirstBeat = false } = detail;
            
            // 减少剩余节拍数
            this.remainingBeats = Math.max(0, this.remainingBeats - 1);
            
            // 更新性能统计
            this.performanceStats.processedBeats++;
            
            // 检查是否完成当前段落
            if (this.remainingBeats <= 0) {
                this._handleSegmentCompletion();
            } else {
                // 使用防抖更新状态，避免频繁更新
                this._debouncedUpdateState();
            }
            
            // 更新节拍时间
            this.lastBeatTime = currentTime;
            
            // 更新性能统计
            const responseTime = performance.now() - startTime;
            this.performanceStats.averageResponseTime = 
                (this.performanceStats.averageResponseTime * (this.performanceStats.processedBeats - 1) + responseTime) / 
                this.performanceStats.processedBeats;
        } catch (error) {
            handleTrainingError(error, { context: '处理节拍事件' });
        }
    }
    
    /**
     * 处理段落完成
     * @private
     */
    _handleSegmentCompletion() {
        try {
            // 获取当前段落
            const currentSegment = this.segments[this.currentSegmentIndex];
            if (!currentSegment) {
                throw new Error('无法获取当前段落配置');
            }
            
            // 检查是否需要重复当前段落
            if (this.currentRepeat < currentSegment.repeats) {
                // 增加重复计数并重新开始此段落
                this.currentRepeat++;
                this.remainingBeats = currentSegment.beats;
                
                // 触发段落重复事件
                this._dispatchEvent('training:segmentRepeat', {
                    segmentIndex: this.currentSegmentIndex,
                    segment: currentSegment,
                    currentRepeat: this.currentRepeat
                });
                
                console.log(`重复段落 ${this.currentSegmentIndex + 1}, 第 ${this.currentRepeat} 次`);
            } else {
                // 检查是否有下一个段落
                if (this.currentSegmentIndex < this.segments.length - 1) {
                    // 移动到下一个段落
                    this.currentSegmentIndex++;
                    this.currentRepeat = 1;
                    
                    const nextSegment = this.segments[this.currentSegmentIndex];
                    if (!nextSegment) {
                        throw new Error('无法获取下一个段落配置');
                    }
                    this.remainingBeats = nextSegment.beats;
                    
                    // 配置下一个段落的节拍器
                    if (!this._configureMetronome(nextSegment)) {
                        // 如果配置失败，停止会话
                        this.stopSession();
                        return;
                    }
                    
                    // 触发段落变更事件
                    this._dispatchEvent('training:segmentChange', {
                        segmentIndex: this.currentSegmentIndex,
                        segment: nextSegment,
                        currentRepeat: this.currentRepeat
                    });
                    
                    console.log(`切换到段落 ${this.currentSegmentIndex + 1}`);
                } else {
                    // 所有段落都完成了
                    this._completeSession();
                    return; // 提前返回，避免后续的状态更新
                }
            }
            
            // 更新状态
            this._updateTrainingState();
        } catch (error) {
            handleTrainingError(error, { context: '处理段落完成' });
            this._dispatchEvent('training:error', { error: '处理段落完成时出错' });
            this.stopSession();
        }
    }
    
    /**
     * 完成整个训练会话
     * @private
     */
    _completeSession() {
        try {
            const sessionId = this.sessionId; // 保存会话ID，因为stopSession会清除它
            const totalSegments = this.segments.length;
            
            // 计算会话持续时间
            this.performanceStats.duration = Date.now() - this.performanceStats.startTime;
            
            // 停止会话，标记为完成
            this.stopSession(true);
            
            // 触发完成事件
            this._dispatchEvent('training:complete', {
                sessionId: sessionId,
                totalSegments: totalSegments,
                performanceStats: this.performanceStats
            });
            
            console.log(`训练会话完成: ${sessionId}`);
        } catch (error) {
            handleTrainingError(error, { context: '完成训练会话' });
        }
    }
    
    /**
     * 更新训练状态
     * @private
     */
    _updateTrainingState() {
        try {
            // 获取当前段落
            const currentSegment = this.segments[this.currentSegmentIndex];
            
            // 计算进度信息
            const progress = this.performanceStats.totalBeats > 0 
                ? (this.performanceStats.processedBeats / this.performanceStats.totalBeats) * 100 
                : 0;
            
            // 更新全局状态
            updateState({
                trainingState: {
                    sessionId: this.sessionId,
                    currentSegmentIndex: this.currentSegmentIndex,
                    currentSegment: currentSegment,
                    currentRepeat: this.currentRepeat,
                    remainingBeats: this.remainingBeats,
                    isRunning: this.isRunning,
                    progress: Math.min(100, Math.max(0, progress)),
                    performanceStats: { ...this.performanceStats }
                }
            });
            
            // 触发更新事件
            this._dispatchEvent('training:update', {
                state: getState().trainingState
            });
        } catch (error) {
            handleTrainingError(error, { context: '更新训练状态' });
        }
    }
    
    /**
     * 分发自定义事件
     * @private
     * @param {string} eventName - 事件名称
     * @param {Object} detail - 事件详情
     * @returns {boolean} 事件分发是否成功
     */
    _dispatchEvent(eventName, detail) {
        try {
            if (!eventName || typeof eventName !== 'string') {
                console.error('无效的事件名称');
                return false;
            }
            
            window.dispatchEvent(new CustomEvent(eventName, {
                detail: detail || {},
                bubbles: true,
                cancelable: true
            }));
            return true;
        } catch (error) {
            console.error(`分发事件 ${eventName} 失败:`, error);
            return false;
        }
    }
    
    /**
     * 添加事件监听器并存储引用
     * @private
     * @param {HTMLElement|Window|Document} element - 事件目标元素
     * @param {string} eventName - 事件名称
     * @param {Function} handler - 事件处理函数
     */
    _addEventListener(element, eventName, handler) {
        try {
            if (!element || !eventName || typeof handler !== 'function') {
                return;
            }
            
            const key = `${element}_${eventName}_${handler.toString()}`;
            this.eventListeners.set(key, { element, eventName, handler });
            element.addEventListener(eventName, handler);
        } catch (error) {
            console.error('添加事件监听器失败:', error);
        }
    }
    
    /**
     * 移除所有事件监听器
     * @private
     */
    _removeAllEventListeners() {
        try {
            this.eventListeners.forEach((binding, key) => {
                try {
                    binding.element.removeEventListener(binding.eventName, binding.handler);
                } catch (error) {
                    console.error(`移除事件监听器 ${binding.eventName} 失败:`, error);
                }
            });
            this.eventListeners.clear();
        } catch (error) {
            console.error('移除所有事件监听器失败:', error);
        }
    }
    
    /**
     * 重置性能统计
     * @private
     */
    _resetPerformanceStats() {
        this.performanceStats = {
            startTime: 0,
            duration: 0,
            totalBeats: 0,
            processedBeats: 0,
            averageResponseTime: 0
        };
    }
    
    /**
     * 获取当前会话状态
     * @returns {Object|null} 会话状态或null（如果没有活动会话）
     */
    getSessionState() {
        if (!this.sessionId) {
            return null;
        }
        
        return {
            sessionId: this.sessionId,
            isRunning: this.isRunning,
            currentSegmentIndex: this.currentSegmentIndex,
            currentRepeat: this.currentRepeat,
            remainingBeats: this.remainingBeats,
            totalSegments: this.segments.length,
            segments: [...this.segments], // 返回副本以防止外部修改
            performanceStats: { ...this.performanceStats }
        };
    }
    
    /**
     * 检查会话是否正在运行
     * @returns {boolean}
     */
    isSessionRunning() {
        return this.isRunning && !!this.sessionId;
    }
    
    /**
     * 尝试恢复会话（用于错误恢复）
     * @returns {boolean} 恢复是否成功
     */
    attemptRecovery() {
        try {
            if (!this.sessionId) {
                return false;
            }
            
            console.log('尝试恢复训练会话');
            
            // 重新订阅事件
            this._addEventListener(window, 'metronome:beat', this._handleBeat);
            
            // 更新状态
            this._updateTrainingState();
            
            // 触发恢复事件
            this._dispatchEvent('training:recovered', {
                sessionId: this.sessionId
            });
            
            return true;
        } catch (error) {
            handleTrainingError(error, { context: '恢复训练会话' });
            return false;
        }
    }
    
    /**
     * 获取性能统计信息
     * @returns {Object} 性能统计数据
     */
    getPerformanceStats() {
        return { ...this.performanceStats };
    }
    
    /**
     * 销毁会话管理器，清理资源
     * @returns {boolean} 销毁是否成功
     */
    destroy() {
        try {
            this.stopSession();
            this._removeAllEventListeners();
            this.isInitialized = false;
            console.log('训练会话管理器已销毁');
            return true;
        } catch (error) {
            console.error('销毁训练会话管理器时出错:', error);
            return false;
        }
    }
}

/**
 * 训练会话管理器实例
 * @type {TrainingSessionManager}
 */
export const trainingSessionManager = new TrainingSessionManager();

// 存储全局事件监听器引用
const globalEventListeners = new Map();

/**
 * 添加全局事件监听器
 * @private
 * @param {string} eventName - 事件名称
 * @param {Function} handler - 事件处理函数
 */
function addGlobalEventListener(eventName, handler) {
    try {
        globalEventListeners.set(eventName, handler);
        window.addEventListener(eventName, handler);
    } catch (error) {
        console.error(`添加全局事件监听器 ${eventName} 失败:`, error);
    }
}

/**
 * 移除所有全局事件监听器
 * @private
 */
function removeAllGlobalEventListeners() {
    globalEventListeners.forEach((handler, eventName) => {
        try {
            window.removeEventListener(eventName, handler);
        } catch (error) {
            console.error(`移除全局事件监听器 ${eventName} 失败:`, error);
        }
    });
    globalEventListeners.clear();
}

/**
 * 初始化训练模式模块
 * @returns {Promise<boolean>} 初始化是否成功
 * 
 * @example
 * // 初始化训练模式
 * const success = await initTrainingMode();
 */
export async function initTrainingMode() {
    try {
        // 初始化会话管理器
        if (!trainingSessionManager.init()) {
            throw new Error('训练会话管理器初始化失败');
        }
        
        // 清除现有的事件监听器，避免重复绑定
        removeAllGlobalEventListeners();
        
        // 使用节流优化事件处理
        const throttledStartSession = throttle(async (event) => {
            try {
                const detail = event && event.detail || {};
                const { segments } = detail;
                if (!segments) {
                    throw new Error('缺少训练段落配置');
                }
                const success = await trainingSessionManager.startSession(segments);
                if (!success) {
                    window.dispatchEvent(new CustomEvent('training:initFailed', {
                        detail: { error: '启动训练会话失败' }
                    }));
                }
            } catch (error) {
                handleTrainingError(error, { context: '处理训练开始事件' });
                window.dispatchEvent(new CustomEvent('training:error', {
                    detail: { error: error.message || '处理训练开始事件失败' }
                }));
            }
        }, 300);
        
        // 监听训练相关事件
        addGlobalEventListener('training:start', throttledStartSession);
        
        addGlobalEventListener('training:stop', () => {
            try {
                trainingSessionManager.stopSession();
            } catch (error) {
                handleTrainingError(error, { context: '处理训练停止事件' });
            }
        });
        
        addGlobalEventListener('training:pause', () => {
            try {
                trainingSessionManager.pauseSession();
            } catch (error) {
                handleTrainingError(error, { context: '处理训练暂停事件' });
            }
        });
        
        addGlobalEventListener('training:resume', () => {
            try {
                trainingSessionManager.resumeSession();
            } catch (error) {
                handleTrainingError(error, { context: '处理训练恢复事件' });
            }
        });
        
        addGlobalEventListener('training:reset', () => {
            try {
                trainingSessionManager.stopSession();
            } catch (error) {
                handleTrainingError(error, { context: '处理训练重置事件' });
            }
        });
        
        // 监听窗口卸载事件，清理资源
        addGlobalEventListener('beforeunload', () => {
            try {
                trainingSessionManager.stopSession();
                removeAllGlobalEventListeners();
            } catch (error) {
                console.error('窗口卸载时清理资源失败:', error);
            }
        });
        
        console.log('训练模式模块初始化成功');
        return true;
    } catch (error) {
        const handledError = handleTrainingError(error, { context: '初始化训练模式模块' });
        return false;
    }
}

/**
 * 清理训练模式模块
 * @returns {boolean} 清理是否成功
 */
export function cleanupTrainingMode() {
    try {
        removeAllGlobalEventListeners();
        trainingSessionManager.destroy();
        console.log('训练模式模块已清理');
        return true;
    } catch (error) {
        console.error('清理训练模式模块失败:', error);
        return false;
    }
}