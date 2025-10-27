/**
 * 状态管理模块 - 管理节拍器应用的全局状态
 * 
 * @module state
 * @description 提供状态的存储、更新和订阅功能，实现响应式架构
 */

import { CONFIG } from './config.js';
import { handleStateError } from './errorManager.js';
import { throttle } from './helpers.js';

/**
 * 应用状态对象
 * @type {Object}
 * @property {number} bpm - 当前的每分钟节拍数
 * @property {number} beatNumerator - 当前拍号分子
 * @property {number} beatDenominator - 当前拍号分母
 * @property {number} volume - 当前音量
 * @property {boolean} isRunning - 节拍器是否正在运行
 * @property {boolean} isTrainingMode - 是否处于训练模式
 * @property {Object} trainingState - 训练模式的状态
 * @property {number} currentBeat - 当前节拍
 * @property {number} currentBar - 当前小节
 */
let state = {
    bpm: CONFIG.defaultBPM,
    beatNumerator: CONFIG.defaultBeatNumerator,
    beatDenominator: CONFIG.defaultBeatDenominator,
    volume: CONFIG.defaultVolume,
    isRunning: false,
    isTrainingMode: false,
    trainingState: {
        isActive: false,
        segments: [],
        currentSegmentIndex: 0,
        barsInCurrentSegment: 0,
        totalBarsCompleted: 0
    },
    currentBeat: 0,
    currentBar: 0
};

/**
 * 状态变更监听器列表
 * @type {Array<Function>}
 */
const listeners = [];

/**
 * 性能统计信息
 * @type {Object}
 */
const performanceStats = {
    stateUpdates: 0,
    listenerCalls: 0,
    failedUpdates: 0,
    failedListenerCalls: 0,
    startTime: Date.now()
};

/**
 * 节流的状态更新函数
 * 限制状态更新的频率，防止过多的状态更新导致性能问题
 */
const throttledStateUpdates = {};
const THROTTLE_DELAY = 100; // 状态更新节流延迟（毫秒）

/**
 * 获取当前状态
 * @returns {Object} 当前状态的深拷贝
 */
export function getState() {
    try {
        // 使用更高效的深度克隆方法
        return JSON.parse(JSON.stringify(state));
    } catch (error) {
        handleStateError(error, { context: 'getState', message: '获取状态失败' });
        // 返回空对象作为后备
        return {};
    }
}

/**
 * 更新状态
 * @param {Object} newState - 要更新的状态对象
 * @returns {void}
 */
export function updateState(newState) {
    try {
        // 参数验证
        if (!newState || typeof newState !== 'object') {
            throw new Error('状态更新必须是一个对象');
        }
        
        // 合并新旧状态
        const prevState = getState();
        state = { ...state, ...newState };
        
        // 更新性能统计
        performanceStats.stateUpdates++;
        
        // 通知所有监听器
        notifyListeners(prevState, state);
    } catch (error) {
        performanceStats.failedUpdates++;
        handleStateError(error, { context: 'updateState', data: { newState } });
    }
}

/**
 * 更新训练模式状态
 * @param {Object} newTrainingState - 要更新的训练状态
 * @returns {void}
 */
export function updateTrainingState(newTrainingState) {
    try {
        // 参数验证
        if (!newTrainingState || typeof newTrainingState !== 'object') {
            throw new Error('训练状态更新必须是一个对象');
        }
        
        updateState({
            trainingState: { ...state.trainingState, ...newTrainingState }
        });
    } catch (error) {
        handleStateError(error, { context: 'updateTrainingState', data: { newTrainingState } });
    }
}

/**
 * 订阅状态变更
 * @param {Function} listener - 状态变更时触发的回调函数
 * @returns {Function} 取消订阅的函数
 */
export function subscribeToState(listener) {
    try {
        // 验证listener是否为函数
        if (typeof listener !== 'function') {
            throw new Error('监听器必须是一个函数');
        }
        
        // 添加监听器
        listeners.push(listener);
        
        // 返回取消订阅函数
        return function unsubscribe() {
            try {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            } catch (error) {
                handleStateError(error, { context: 'unsubscribe', level: 'warning' });
            }
        };
    } catch (error) {
        handleStateError(error, { context: 'subscribeToState' });
        
        // 返回一个空的取消订阅函数
        return () => {};
    }
}

/**
 * 通知所有监听器状态已变更
 * @param {Object} prevState - 变更前的状态
 * @param {Object} newState - 变更后的状态
 * @private
 */
function notifyListeners(prevState, newState) {
    listeners.forEach((listener, index) => {
        try {
            performanceStats.listenerCalls++;
            listener(prevState, newState);
        } catch (error) {
            performanceStats.failedListenerCalls++;
            handleStateError(error, { 
                context: 'notifyListeners', 
                level: 'warning',
                data: { 
                    listenerIndex: index,
                    listenerName: listener.name || 'anonymous'
                }
            });
        }
    });
}

/**
 * 重置状态到默认值
 * @returns {void}
 */
export function resetState() {
    try {
        updateState({
            bpm: CONFIG.defaultBPM,
            beatNumerator: CONFIG.defaultBeatNumerator,
            beatDenominator: CONFIG.defaultBeatDenominator,
            volume: CONFIG.defaultVolume,
            isRunning: false,
            isTrainingMode: false,
            trainingState: {
                isActive: false,
                segments: [],
                currentSegmentIndex: 0,
                barsInCurrentSegment: 0,
                totalBarsCompleted: 0
            },
            currentBeat: 0,
            currentBar: 0
        });
        
        // 重置性能统计
        Object.assign(performanceStats, {
            stateUpdates: 0,
            listenerCalls: 0,
            failedUpdates: 0,
            failedListenerCalls: 0,
            startTime: Date.now()
        });
    } catch (error) {
        handleStateError(error, { context: 'resetState' });
    }
}

/**
 * 获取状态的差异
 * @param {Object} prevState - 前一个状态
 * @param {Object} newState - 新的状态
 * @returns {Object} 状态差异对象
 * @private
 */
function getStateDiff(prevState, newState) {
    try {
        const diff = {};
        
        Object.keys(newState).forEach(key => {
            if (prevState[key] !== newState[key]) {
                // 如果是对象，递归比较
                if (typeof prevState[key] === 'object' && 
                    typeof newState[key] === 'object' &&
                    prevState[key] !== null &&
                    newState[key] !== null) {
                    const nestedDiff = getStateDiff(prevState[key], newState[key]);
                    if (Object.keys(nestedDiff).length > 0) {
                        diff[key] = nestedDiff;
                    }
                } else {
                    diff[key] = newState[key];
                }
            }
        });
        
        return diff;
    } catch (error) {
        handleStateError(error, { context: 'getStateDiff', level: 'warning' });
        return {};
    }
}

/**
 * 获取状态管理的性能统计信息
 * @returns {Object} 性能统计数据
 */
export function getStatePerformanceStats() {
    return {
        stateUpdates: performanceStats.stateUpdates,
        listenerCalls: performanceStats.listenerCalls,
        failedUpdates: performanceStats.failedUpdates,
        failedListenerCalls: performanceStats.failedListenerCalls,
        uptime: Date.now() - performanceStats.startTime,
        currentListenerCount: listeners.length
    };
}

/**
 * 清除所有状态监听器
 * @returns {number} 被清除的监听器数量
 */
export function clearAllListeners() {
    const count = listeners.length;
    listeners.length = 0;
    return count;
}

/**
 * 批量更新状态（带节流）
 * 适用于频繁触发的状态更新场景
 * @param {string} updateId - 更新标识符
 * @param {Object} newState - 要更新的状态
 */
export function batchUpdateState(updateId, newState) {
    if (!throttledStateUpdates[updateId]) {
        throttledStateUpdates[updateId] = throttle(() => {
            updateState(newState);
        }, THROTTLE_DELAY);
    }
    throttledStateUpdates[updateId]();
}