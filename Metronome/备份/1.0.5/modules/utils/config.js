/**
 * 配置模块 - 提供节拍器应用的全局配置
 * 
 * @module config
 * @description 集中管理应用的所有配置参数，便于统一修改和维护
 */

import { handleStateError } from './errorManager.js';

// 存储键名
const STORAGE_KEY = 'metronome-config';

// 默认配置常量
const MIN_BPM = 40;
const MAX_BPM = 300;
const ALLOWED_DENOMINATORS = [1, 2, 4, 8, 16];

/**
 * 应用配置对象
 * @type {Object}
 * @property {number} defaultBPM - 默认的每分钟节拍数
 * @property {number} defaultBeatNumerator - 默认的拍号分子（每小节拍数）
 * @property {number} defaultBeatDenominator - 默认的拍号分母（以什么音符为一拍）
 * @property {number} defaultVolume - 默认音量 (0-100)
 * @property {Object} sounds - 音效配置
 * @property {Object} training - 训练模式配置
 * @property {Object} ui - UI相关配置
 * @property {Object} audio - 音频相关配置
 */
export const CONFIG = {
    // 应用版本信息
    version: '1.0.3',
    
    // 节拍器基本配置
    defaultBPM: 120,
    minBPM: MIN_BPM,
    maxBPM: MAX_BPM,
    
    // 拍号配置
    defaultBeatNumerator: 4,
    defaultBeatDenominator: 4,
    minBeatNumerator: 1,
    maxBeatNumerator: 16,
    validDenominators: ALLOWED_DENOMINATORS,
    
    // 音量配置
    defaultVolume: 50,
    minVolume: 0,
    maxVolume: 100,
    
    // 音效配置
    sounds: {
        firstBeatSound: 'high',
        regularBeatSound: 'low',
        availableSounds: ['high', 'low', 'medium', 'click', 'beep']
    },
    
    // 训练模式配置
    training: {
        defaultIncrement: 5,
        defaultBarsPerSegment: 4,
        defaultCycles: 3
    },
    
    // UI配置
    ui: {
        animationDuration: 200,
        highlightPulseDuration: 1000
    },
    
    // 音频配置
    audio: {
        bufferSize: 2048,
        sampleRate: 44100,
        latencyHint: 'interactive'
    }
};

// 原始配置的深拷贝，用于重置功能
const ORIGINAL_CONFIG = JSON.parse(JSON.stringify(CONFIG));

// 配置变更监听器
const configListeners = [];

// 性能统计
const performanceStats = {
    configGets: 0,
    configUpdates: 0,
    failedGets: 0,
    failedUpdates: 0,
    startTime: Date.now()
};

/**
 * 更新配置项
 * @param {string} keyPath - 配置项的路径，支持嵌套，如 'training.defaultIncrement'
 * @param {*} value - 新的配置值
 * @returns {boolean} 是否更新成功
 */
export function updateConfig(keyPath, value) {
    try {
        // 参数验证
        if (!keyPath || typeof keyPath !== 'string') {
            throw new Error('配置路径必须是一个非空字符串');
        }
        
        // 验证配置值是否有效
        if (!validateConfigValue(keyPath, value)) {
            return false;
        }
        
        const keys = keyPath.split('.');
        let current = CONFIG;
        let parent = null;
        let lastKey = null;
        
        // 遍历键路径，找到要更新的配置项
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            
            // 如果不是最后一个键，检查父对象是否存在
            if (i < keys.length - 1) {
                if (!current[key] || typeof current[key] !== 'object') {
                    handleStateError(new Error(`配置路径不存在: ${keyPath}`), { context: 'updateConfig', level: 'warning', data: { keyPath, value } });
                    return false;
                }
                parent = current;
                lastKey = key;
                current = current[key];
            }
        }
        
        // 更新配置值
        const targetKey = keys[keys.length - 1];
        const oldValue = current[targetKey];
        current[targetKey] = value;
        
        // 更新性能统计
        performanceStats.configUpdates++;
        
        // 通知配置变更监听器
        notifyConfigListeners(keyPath, oldValue, value);
        
        return true;
    } catch (error) {
        performanceStats.failedUpdates++;
        handleStateError(error, { context: 'updateConfig', data: { keyPath, value } });
        return false;
    }
}

/**
 * 获取配置项
 * @param {string} keyPath - 配置项的路径，支持嵌套，如 'training.defaultIncrement'
 * @returns {*} 配置值，如果不存在则返回null
 */
export function getConfig(keyPath) {
    try {
        // 参数验证
        if (!keyPath || typeof keyPath !== 'string') {
            throw new Error('配置路径必须是一个非空字符串');
        }
        
        const keys = keyPath.split('.');
        let current = CONFIG;
        
        // 遍历键路径，找到配置项
        for (const key of keys) {
            if (current[key] === undefined) {
                handleStateError(new Error(`配置项不存在: ${keyPath}`), { context: 'getConfig', level: 'debug' });
                return null;
            }
            current = current[key];
        }
        
        // 更新性能统计
        performanceStats.configGets++;
        
        // 返回配置值的拷贝，避免意外修改
        if (typeof current === 'object' && current !== null) {
            return JSON.parse(JSON.stringify(current));
        }
        
        return current;
    } catch (error) {
        performanceStats.failedGets++;
        handleStateError(error, { context: 'getConfig', data: { keyPath } });
        return null;
    }
}

/**
 * 验证配置值是否有效
 * @param {string} keyPath - 配置项的路径
 * @param {*} value - 要验证的配置值
 * @returns {boolean} 是否有效
 * @private
 */
function validateConfigValue(keyPath, value) {
    // 基于配置路径的类型验证
    if (keyPath.includes('BPM')) {
        if (typeof value !== 'number' || isNaN(value)) {
            return false;
        }
        // 确保BPM在合理范围内
        if (keyPath.includes('minBPM') || keyPath.includes('maxBPM')) {
            return value >= 1 && value <= 500;
        }
        return true;
    }
    
    if (keyPath.includes('volume')) {
        return typeof value === 'number' && value >= 0 && value <= 100;
    }
    
    if (keyPath.includes('beatNumerator')) {
        return Number.isInteger(value) && value >= 1 && value <= 32;
    }
    
    if (keyPath.includes('beatDenominator')) {
        return Number.isInteger(value) && value > 0;
    }
    
    return true; // 默认允许
}

/**
 * 通知配置变更监听器
 * @param {string} keyPath - 变更的配置路径
 * @param {*} oldValue - 变更前的值
 * @param {*} newValue - 变更后的值
 * @private
 */
function notifyConfigListeners(keyPath, oldValue, newValue) {
    configListeners.forEach((listener, index) => {
        try {
            listener(keyPath, oldValue, newValue);
        } catch (error) {
            handleStateError(error, { 
                context: 'notifyConfigListeners', 
                level: 'warning',
                data: { 
                    listenerIndex: index,
                    listenerName: listener.name || 'anonymous',
                    keyPath
                }
            });
        }
    });
}

/**
 * 订阅配置变更
 * @param {Function} listener - 配置变更时触发的回调函数
 * @returns {Function} 取消订阅的函数
 */
export function subscribeToConfigChanges(listener) {
    try {
        if (typeof listener !== 'function') {
            throw new Error('监听器必须是一个函数');
        }
        
        configListeners.push(listener);
        
        return function unsubscribe() {
            try {
                const index = configListeners.indexOf(listener);
                if (index > -1) {
                    configListeners.splice(index, 1);
                }
            } catch (error) {
                handleStateError(error, { context: 'unsubscribeConfig', level: 'warning' });
            }
        };
    } catch (error) {
        handleStateError(error, { context: 'subscribeToConfigChanges' });
        return () => {};
    }
}

/**
 * 重置配置到初始状态
 * @returns {boolean} 是否重置成功
 */
export function resetConfig() {
    try {
        // 深度合并原始配置到当前配置
        Object.keys(ORIGINAL_CONFIG).forEach(key => {
            if (typeof ORIGINAL_CONFIG[key] === 'object' && ORIGINAL_CONFIG[key] !== null) {
                CONFIG[key] = JSON.parse(JSON.stringify(ORIGINAL_CONFIG[key]));
            } else {
                CONFIG[key] = ORIGINAL_CONFIG[key];
            }
        });
        
        return true;
    } catch (error) {
        handleStateError(error, { context: 'resetConfig' });
        return false;
    }
}

/**
 * 获取配置模块的性能统计信息
 * @returns {Object} 性能统计数据
 */
export function getConfigPerformanceStats() {
    return {
        configGets: performanceStats.configGets,
        configUpdates: performanceStats.configUpdates,
        failedGets: performanceStats.failedGets,
        failedUpdates: performanceStats.failedUpdates,
        uptime: Date.now() - performanceStats.startTime,
        currentListenerCount: configListeners.length
    };
}

/**
 * 从本地存储加载配置
 * @returns {boolean} 是否加载成功
 */
export function loadConfigFromStorage() {
    try {
        if (typeof localStorage === 'undefined') {
            return false;
        }
        
        const savedConfig = localStorage.getItem(STORAGE_KEY);
        if (savedConfig) {
            const parsedConfig = JSON.parse(savedConfig);
            // 合并保存的配置到当前配置
            Object.keys(parsedConfig).forEach(key => {
                if (CONFIG.hasOwnProperty(key)) {
                    CONFIG[key] = parsedConfig[key];
                }
            });
            return true;
        }
    } catch (error) {
        handleStateError(error, { context: 'loadConfig', level: 'warning' });
    }
    return false;
}

/**
 * 保存配置到本地存储
 * @returns {boolean} 是否保存成功
 */
export function saveConfigToStorage() {
    try {
        if (typeof localStorage === 'undefined') {
            return false;
        }
        
        // 保存配置到本地存储
        localStorage.setItem(STORAGE_KEY, JSON.stringify(CONFIG));
        return true;
    } catch (error) {
        handleStateError(error, { context: 'saveConfig', level: 'warning' });
        return false;
    }
}

/**
 * 验证配置对象
 * @param {Object} config - 要验证的配置对象
 * @returns {boolean} 是否验证成功
 */
export function validateConfig(config) {
    try {
        // 验证必要字段
        if (typeof config !== 'object' || config === null) {
            throw new Error('配置必须是一个对象');
        }
        
        // 验证数值范围
        if (config.bpm && (config.bpm < MIN_BPM || config.bpm > MAX_BPM)) {
            throw new Error(`BPM必须在${MIN_BPM}-${MAX_BPM}之间`);
        }
        
        if (config.volume && (config.volume < 0 || config.volume > 100)) {
            throw new Error('音量必须在0-100之间');
        }
        
        if (config.beatNumerator && config.beatNumerator < 1) {
            throw new Error('拍号分子必须大于0');
        }
        
        if (config.beatDenominator && !ALLOWED_DENOMINATORS.includes(config.beatDenominator)) {
            throw new Error(`拍号分母必须是以下值之一: ${ALLOWED_DENOMINATORS.join(', ')}`);
        }
        
        return true;
    } catch (error) {
        handleStateError(error, { context: 'validateConfig' });
        throw error;
    }
}